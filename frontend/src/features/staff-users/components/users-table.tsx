import { Link } from 'react-router-dom';
import { ListCell, ListRow, ListTable } from '@/components/list/list-table';
import { t } from '@/locales/en';
import type { StaffUserRow } from '../api/types';
import { RoleTags } from './role-tags';

/** The full name, or the email for an account with no name, so the link is never empty. A null part is left out. */
export function userName(user: Pick<StaffUserRow, 'first_name' | 'last_name' | 'email'>): string {
  return [user.first_name, user.last_name].map((part) => part?.trim() ?? '').filter(Boolean).join(' ') || user.email;
}

const COLUMNS = ['name', 'email', 'phone', 'teams', 'roles'] as const;

/** One markup: a table from `sm`, stacked cards below it. */
export function UsersTable({ users }: { users: StaffUserRow[] }) {
  return (
    <ListTable
      label={t('staff.users.list')}
      columns={COLUMNS.map((column) => ({ key: column, label: t(`staff.users.col.${column}`) }))}
    >
      {users.map((user) => (
        <ListRow key={user.id} data-user-id={user.id} className="bg-white">
          <ListCell className="break-words font-semibold">
            <Link to={`/staff/users/${user.id}`} className="text-link underline">
              {userName(user)}
            </Link>
          </ListCell>
          <ListCell className="text-sm text-navy/70 [overflow-wrap:anywhere]">{user.email}</ListCell>
          <ListCell className="text-sm">{user.phone?.trim() || '—'}</ListCell>
          <ListCell className="space-y-0.5 text-sm">
            {user.teams.length === 0 ? (
              <span className="text-navy/60">{t('staff.users.noTeams')}</span>
            ) : (
              user.teams.map((team) => (
                <div key={team.id} className="break-words">
                  <Link to={`/teams/${team.id}`} className="text-link underline">
                    {team.name} <span className="text-navy/60 no-underline">{team.race.year}</span>
                  </Link>
                </div>
              ))
            )}
          </ListCell>
          <ListCell>
            <RoleTags roles={user.roles} />
          </ListCell>
        </ListRow>
      ))}
    </ListTable>
  );
}
