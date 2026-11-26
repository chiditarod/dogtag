import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { StaffUser } from '../api/types';
import { useUpdateStaffUser } from '../api/use-staff-users';

const ROLES = ['admin', 'operator', 'refunder'] as const;
type Role = (typeof ROLES)[number];

const LABELS = {
  admin: 'staff.users.role.admin',
  operator: 'staff.users.role.operator',
  refunder: 'staff.users.role.refunder',
} as const;

const FIELD_LABELS: Record<string, Parameters<typeof t>[0]> = {
  first_name: 'staff.users.field.first_name',
  last_name: 'staff.users.field.last_name',
  email: 'staff.users.field.email',
  phone: 'staff.users.field.phone',
};

const known = (roles: string[]): Role[] => ROLES.filter((role) => roles.includes(role));
const sameRoles = (a: Role[], b: Role[]) => a.length === b.length && a.every((role, i) => role === b[i]);

/** "Phone can't be blank": the label of a field the server complained about, then its message. */
function fieldProblems(errors: Record<string, string[]>): string[] {
  return Object.entries(errors)
    .filter(([field]) => field !== 'roles')
    .flatMap(([field, messages]) =>
      messages.map((message) => `${FIELD_LABELS[field] ? t(FIELD_LABELS[field]) : field.replace(/_/g, ' ')} ${message}`),
    );
}

/**
 * Admins only (`can_edit`). Saving sends only `roles`, but the server validates the whole user, so a
 * legacy user with, say, no phone comes back with that field's error: show it rather than swallow it.
 */
export function UserRolesCard({ user, onDirtyChange }: { user: StaffUser; onDirtyChange: (dirty: boolean) => void }) {
  const titleId = useId();
  const helpId = useId();
  const update = useUpdateStaffUser(user.id);
  // What the server last said, so a save clears the dirty state before the refetch lands.
  const [saved, setSaved] = useState<Role[]>(() => known(user.roles));
  const [ticked, setTicked] = useState<Role[]>(saved);
  const [done, setDone] = useState(false);
  const dirty = !sameRoles(ticked, saved);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const error = update.error instanceof ApiError ? update.error : null;
  const roleErrors = error?.errors.roles ?? [];
  const problems = error ? fieldProblems(error.errors) : [];
  const failure =
    update.isError && roleErrors.length === 0 && problems.length === 0
      ? error?.error || t('common.genericError')
      : null;

  function toggle(role: Role, checked: boolean) {
    setTicked((current) => known(checked ? [...current, role] : current.filter((r) => r !== role)));
    setDone(false);
    if (update.isError) update.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    update.mutate(
      { roles: ticked },
      {
        onSuccess: (updated) => {
          const next = known(updated.roles);
          setSaved(next);
          setTicked(next);
          setDone(true);
        },
      },
    );
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="min-w-0 space-y-3">
      <h2 id={titleId} className="font-display text-lg font-semibold">
        {t('staff.users.rolesHeading')}
      </h2>
      <form onSubmit={submit} className="space-y-3">
        <fieldset aria-labelledby={titleId} aria-describedby={helpId} className="space-y-1">
          {ROLES.map((role) => {
            const locked = user.is_self && role === 'admin';
            return (
              <label key={role} className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={locked || ticked.includes(role)}
                  disabled={locked}
                  onChange={(event) => toggle(role, event.target.checked)}
                />
                {t(LABELS[role])}
              </label>
            );
          })}
        </fieldset>
        <p id={helpId} className="text-sm text-navy/80">
          {t('staff.users.rolesHelp')}
        </p>
        {user.is_self && <p className="text-sm text-navy/80">{t('staff.users.selfAdmin')}</p>}
        {roleErrors.length > 0 && (
          <ul role="alert" className="space-y-0.5 text-sm font-semibold text-starText">
            {roleErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
        {problems.length > 0 && (
          <p role="alert" className="text-sm font-semibold text-starText">
            {t('staff.users.fixDetailsFirst', { problems: problems.join('; ') })}
          </p>
        )}
        {failure && (
          <p role="alert" className="text-sm font-semibold text-starText">
            {failure}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={update.isPending} disabled={!dirty}>
            {t('staff.users.saveRoles')}
          </Button>
          <span role="status" className="text-sm font-semibold text-navy/70">
            {done && !dirty ? t('staff.users.saved') : ''}
          </span>
        </div>
      </form>
    </Card>
  );
}
