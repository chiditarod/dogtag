import { useMemo } from 'react';
import { useMe } from '@/features/auth/api/use-me';
import { useTeams } from '@/features/teams/api/use-teams';
import type { Team } from '@/types/api';

/**
 * The logged-in racer's teams grouped by race id. Empty while loading, when the request
 * fails, and when logged out (no teams request is made then), so the race list never
 * waits on it or shows an error for it.
 */
export function useMyTeamsByRace(): Map<number, Team[]> {
  const me = useMe();
  const { data } = useTeams({ enabled: Boolean(me.data) });

  return useMemo(() => {
    const byRace = new Map<number, Team[]>();
    for (const team of data ?? []) {
      byRace.set(team.race.id, [...(byRace.get(team.race.id) ?? []), team]);
    }
    return byRace;
  }, [data]);
}
