import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '@/features/auth/api/use-me';
import { DiscardDialog } from '@/components/ui/discard-dialog';
import { NotFound } from '@/components/ui/not-found';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { useLeaveGuard } from '@/components/ui/use-leave-guard';
import { ApiError } from '@/lib/api-client';
import { DEFAULT_TIME_ZONE, formatMonthYear } from '@/lib/dates';
import { t } from '@/locales/en';
import { useStaffUser } from '../api/use-staff-users';
import { DeleteUser } from './delete-user';
import { RoleTags } from './role-tags';
import { UserDetailsCard } from './user-details-card';
import { UserRolesCard } from './user-roles-card';
import { UserTeamsCard } from './user-teams-card';
import { userName } from './users-table';

const link = 'font-semibold text-link hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-link';

export function UserPage({ userId }: { userId: number }) {
  const { data, isPending, isError, error, refetch } = useStaffUser(userId);
  const { data: viewer } = useMe();
  // Each card reports its unsaved edits here.
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [rolesDirty, setRolesDirty] = useState(false);
  const { blocker, allowLeave } = useLeaveGuard(detailsDirty || rolesDirty);

  if (isPending) return <QueryLoading />;
  if (isError) {
    return error instanceof ApiError && error.status === 404 ? <NotFound /> : <QueryError onRetry={() => void refetch()} />;
  }
  const user = data;
  const email = encodeURIComponent(user.email);
  const canSeeEmails = viewer?.roles?.some((role) => role === 'admin' || role === 'operator') ?? false;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Link to="/staff/users" className={`text-sm ${link}`}>
          {t('staff.users.back')}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 space-y-1">
            <h1 className="font-display text-2xl font-semibold [overflow-wrap:anywhere]">{userName(user)}</h1>
            <p className="text-sm text-navy/70 [overflow-wrap:anywhere]">
              {t('staff.users.accountSince', {
                email: user.email,
                date: formatMonthYear(user.created_at, DEFAULT_TIME_ZONE),
              })}
            </p>
            {!user.can_edit && user.roles.length > 0 && <RoleTags roles={user.roles} />}
          </div>
          <DeleteUser user={user} onDeleted={allowLeave} />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 md:grid-cols-2">
        <UserDetailsCard user={user} onDirtyChange={setDetailsDirty} />
        <div className="min-w-0 space-y-4">
          {user.can_edit && <UserRolesCard user={user} onDirtyChange={setRolesDirty} />}
          <UserTeamsCard teams={user.teams} canSeeEmails={canSeeEmails} />
        </div>
      </div>

      <p className="text-sm">
        <Link to={`/staff/payments?race_id=all&q=${email}`} className={link}>
          {t('staff.users.paymentsLink')}
        </Link>
        {canSeeEmails && (
          <>
            <span aria-hidden="true"> · </span>
            <Link to={`/staff/emails?recipient=${email}`} className={link}>
              {t('staff.users.emailsLink')}
            </Link>
          </>
        )}
      </p>

      {blocker.state === 'blocked' && (
        <DiscardDialog body={t('staff.users.discardBody')} onKeep={() => blocker.reset()} onDiscard={() => blocker.proceed()} />
      )}
    </div>
  );
}
