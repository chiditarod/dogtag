import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { StaffTeam } from '../types';

export const staffTeamQueryKey = (teamId: string | number | undefined) =>
  ['staff', 'team', String(teamId)] as const;

interface UseStaffTeamOptions {
  /** Only staff ask; a racer never calls the staff endpoint. */
  enabled: boolean;
  /** The racer team query's `dataUpdatedAt`: a change after the first load means the page data moved. */
  teamUpdatedAt: number;
}

/** `GET /api/v1/staff/teams/:id`: who is who, the payments and what this viewer may do. */
export function useStaffTeam(
  teamId: string | number | undefined,
  { enabled, teamUpdatedAt }: UseStaffTeamOptions,
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

  // The permissions (`can`) and payments depend on the team, so refetch whenever the racer team
  // query updates. Its first load (0 -> a timestamp) is not an update.
  const lastUpdatedAt = useRef(teamUpdatedAt);
  useEffect(() => {
    const previous = lastUpdatedAt.current;
    lastUpdatedAt.current = teamUpdatedAt;
    if (!enabled || previous === 0 || previous === teamUpdatedAt) return;
    void queryClient.invalidateQueries({ queryKey: staffTeamQueryKey(teamId) });
  }, [teamUpdatedAt, enabled, teamId, queryClient]);

  return query;
}
