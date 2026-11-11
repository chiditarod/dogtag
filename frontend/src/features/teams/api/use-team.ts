import {
  useQuery,
  type Query,
  type QueryClient,
} from '@tanstack/react-query';
import { useRef } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { Checklist, Team } from '@/types/api';

/** Ids are normalised to strings so route params and API ids share one cache entry. */
export const teamQueryKey = (teamId: string | number | undefined) =>
  ['team', String(teamId)] as const;

export const FUNDRAISING_POLL_MS = 10_000;
export const FUNDRAISING_POLL_MAX_ATTEMPTS = 30;

interface UseTeamOptions {
  /**
   * While the team is finalized but `classy_fundraising_url` is still null,
   * refetch every 10s, at most 30 times (5 minutes).
   */
  pollForFundraisingUrl?: boolean;
}

export function useTeam(
  teamId: string | number | undefined,
  { pollForFundraisingUrl = false }: UseTeamOptions = {},
) {
  // dataUpdateCount when polling began; counts completed refetches since.
  const pollStart = useRef<number | null>(null);

  return useQuery({
    queryKey: teamQueryKey(teamId),
    queryFn: async () =>
      (await apiFetch<{ team: Team }>(`/teams/${teamId}`)).team,
    enabled: teamId !== undefined,
    refetchInterval: (query: Query<Team>) => {
      if (!pollForFundraisingUrl) return false;
      const checklist = query.state.data?.checklist;
      if (!checklist?.finalized || checklist.classy_fundraising_url) {
        pollStart.current = null;
        return false;
      }
      pollStart.current ??= query.state.dataUpdateCount;
      const attempts = query.state.dataUpdateCount - pollStart.current;
      return attempts < FUNDRAISING_POLL_MAX_ATTEMPTS
        ? FUNDRAISING_POLL_MS
        : false;
    },
  });
}

/** Writes a fresh checklist (e.g. from a mutation response) into the cached team. */
export function setTeamChecklist(
  queryClient: QueryClient,
  teamId: string | number,
  checklist: Checklist,
) {
  queryClient.setQueryData<Team>(teamQueryKey(teamId), (team) =>
    team ? { ...team, checklist } : team,
  );
}
