import { useMe } from '@/features/auth/api/use-me';
import { useStaffTeam } from '@/features/staff-teams/api/use-staff-team';
import type { StaffTeam } from '@/features/staff-teams/types';
import { isStaff } from '@/features/staff/utils';
import type { Team } from '@/types/api';
import {
  READ_ONLY_PERMISSIONS,
  racerPermissions,
  staffPermissions,
  type TeamPermissions,
} from './permissions';

export type StaffState = 'none' | 'loading' | 'ready' | 'error';

/**
 * What the viewer may do on this team page.
 *
 * A racer gets today's rules and never calls the staff endpoint. A staff viewer gets no controls
 * (and no Pay of any kind) until `GET /staff/teams/:id` answers, and stays read-only if it
 * fails, even on their own team: the server's `can` flags are the only source of staff rules.
 *
 * `teamUpdatedAt` is the `dataUpdatedAt` of the page's own `useTeam` query. It is passed in, not read
 * here, because a second observer on the shared team query with another `queryFn` would replace
 * the query's fetcher and break its later refetches.
 */
export function useTeamPermissions(
  team: Team,
  { teamUpdatedAt }: { teamUpdatedAt: number },
): {
  permissions: TeamPermissions;
  staffTeam: StaffTeam | undefined;
  staffQuery: ReturnType<typeof useStaffTeam>;
  staffState: StaffState;
} {
  const me = useMe().data;
  const staff = isStaff(me);
  const staffQuery = useStaffTeam(team.id, {
    enabled: staff,
    teamUpdatedAt,
  });

  if (!staff || !me) {
    return {
      permissions: racerPermissions(team),
      staffTeam: undefined,
      staffQuery,
      staffState: 'none',
    };
  }
  if (staffQuery.data) {
    return {
      permissions: staffPermissions(team, staffQuery.data, me.id),
      staffTeam: staffQuery.data,
      staffQuery,
      staffState: 'ready',
    };
  }
  return {
    permissions: READ_ONLY_PERMISSIONS,
    staffTeam: undefined,
    staffQuery,
    staffState: staffQuery.isError ? 'error' : 'loading',
  };
}
