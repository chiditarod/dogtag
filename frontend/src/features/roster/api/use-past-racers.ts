import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface PastRacer {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  zipcode: string | null;
  experience: number | null;
  twitter: string | null;
  last_team_name: string | null;
  last_race_name: string | null;
  last_raced_year: number | null;
}

export const pastRacersQueryKey = (teamId: string | number) =>
  ['past-racers', String(teamId)] as const;

/** Most recent first; the server already excludes people on this team. */
export function usePastRacers(teamId: string | number, enabled: boolean) {
  return useQuery({
    queryKey: pastRacersQueryKey(teamId),
    queryFn: async () =>
      (
        await apiFetch<{ past_racers: PastRacer[] }>(
          `/teams/${teamId}/past_racers`,
        )
      ).past_racers,
    enabled,
  });
}
