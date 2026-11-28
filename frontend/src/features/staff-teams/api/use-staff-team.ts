import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { Team } from '@/types/api';
import type { StaffTeam } from '../types';

export const staffTeamQueryKey = (teamId: string | number | undefined) =>
  ['staff', 'team', String(teamId)] as const;

interface UseStaffTeamOptions {
  /** Only staff ask; a racer never calls the staff endpoint. */
  enabled: boolean;
  /**
   * The racer team query's data. React Query's structural sharing keeps the same object when a refetch
   * returns the same team (e.g. the fundraising-URL poll), so a new object means the team changed.
   */
  team: Team;
}

/** `GET /api/v1/staff/teams/:id`: who is who, the payments and what this viewer may do. */
export function useStaffTeam(
  teamId: string | number | undefined,
  { enabled, team }: UseStaffTeamOptions,
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: staffTeamQueryKey(teamId),
    queryFn: async () =>
      (await apiFetch<{ staff_team: StaffTeam }>(`/staff/teams/${teamId}`)).staff_team,
    enabled: enabled && teamId !== undefined,
    // A 403 (or any failure) leaves the page read-only; asking again would not change the answer.
    retry: false,
  });

  // The permissions (`can`) and payments depend on the team, so refetch whenever the racer team data
  // changes. A refetch that returns the same team keeps the same object and asks for nothing.
  const lastTeam = useRef(team);
  useEffect(() => {
    const previous = lastTeam.current;
    lastTeam.current = team;
    if (!enabled || previous === team) return;
    // cancelRefetch false: a fetch already running (e.g. the new-team mutation's own) is joined, not cancelled.
    void queryClient.invalidateQueries({ queryKey: staffTeamQueryKey(teamId) }, { cancelRefetch: false });
  }, [team, enabled, teamId, queryClient]);

  return query;
}
