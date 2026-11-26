import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { StaffUser, StaffUserPayload } from '../api/types';
import { useUpdateStaffUser } from '../api/use-staff-users';

const FIELDS = ['first_name', 'last_name', 'email', 'phone'] as const;
type FieldName = (typeof FIELDS)[number];
type Values = Record<FieldName, string>;

const LABELS = {
  first_name: 'staff.users.field.first_name',
  last_name: 'staff.users.field.last_name',
  email: 'staff.users.field.email',
  phone: 'staff.users.field.phone',
} as const;

/** Trimmed, so a stored value with stray spaces does not look edited on load (drafts are compared trimmed). */
const valuesOf = (user: Pick<StaffUser, FieldName>): Values => ({
  first_name: user.first_name.trim(),
  last_name: user.last_name.trim(),
  email: user.email.trim(),
  phone: (user.phone ?? '').trim(),
});

/** A form for admins (`can_edit`), plain text for everyone else. */
export function UserDetailsCard({ user, onDirtyChange }: { user: StaffUser; onDirtyChange: (dirty: boolean) => void }) {
  const titleId = useId();
  const update = useUpdateStaffUser(user.id);
  // What the server last said, so a save clears the dirty state before the refetch lands.
  const [saved, setSaved] = useState<Values>(() => valuesOf(user));
  // The draft starts as the raw stored value, so it is trimmed on both sides when compared.
  const [draft, setDraft] = useState<Values>(saved);
  const [done, setDone] = useState(false);
  const changed = FIELDS.filter((field) => draft[field].trim() !== saved[field]);
  const dirty = changed.length > 0;
  // The read-only view follows the live user, not the mount-time state.
  const current = valuesOf(user);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const errors = update.error instanceof ApiError ? update.error.errors : {};
  const failure =
    update.isError && Object.keys(errors).length === 0
      ? update.error instanceof ApiError && update.error.error
        ? update.error.error
        : t('common.genericError')
      : null;

  function edit(field: FieldName, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDone(false);
    if (update.isError) update.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const payload: StaffUserPayload = Object.fromEntries(changed.map((field) => [field, draft[field].trim()]));
    update.mutate(payload, {
      onSuccess: (updated) => {
        const next = valuesOf(updated);
        setSaved(next);
        setDraft(next);
        setDone(true);
      },
    });
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="min-w-0 space-y-3">
      <h2 id={titleId} className="font-display text-lg font-semibold">
        {t('staff.users.details')}
      </h2>
      {user.can_edit ? (
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            {(['first_name', 'last_name'] as const).map((field) => (
              <Field key={field} label={t(LABELS[field])} name={field} error={errors[field]}>
                <Input value={draft[field]} onChange={(event) => edit(field, event.target.value)} />
              </Field>
            ))}
          </div>
          <Field label={t(LABELS.email)} name="email" error={errors.email}>
            <Input type="email" value={draft.email} onChange={(event) => edit('email', event.target.value)} />
          </Field>
          <Field label={t(LABELS.phone)} name="phone" error={errors.phone}>
            <Input type="tel" value={draft.phone} onChange={(event) => edit('phone', event.target.value)} />
          </Field>
          {failure && (
            <p role="alert" className="text-sm font-semibold text-starText">
              {failure}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={update.isPending} disabled={!dirty}>
              {t('staff.users.saveDetails')}
            </Button>
            <span role="status" className="text-sm font-semibold text-navy/70">
              {done && !dirty ? t('staff.users.saved') : ''}
            </span>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-3 text-sm sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field} className="min-w-0">
              <dt className="text-xs font-semibold uppercase text-navy/60">{t(LABELS[field])}</dt>
              <dd className="[overflow-wrap:anywhere]">{current[field] || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-sm text-navy/70">{t('staff.users.detailsCaption')}</p>
    </Card>
  );
}
