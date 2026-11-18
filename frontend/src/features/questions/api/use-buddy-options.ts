import { useQuery } from '@tanstack/react-query';
import type { BuddyOption } from '@/features/questions/types';
import { apiFetch } from '@/lib/api-client';

export const buddyOptionsQueryKey = (teamId: string | number) =>
  ['team-buddy-options', String(teamId)] as const;

/** Other teams in the race, already sorted by the server. Fetched only when `enabled`. */
export function useBuddyOptions(teamId: string | number, enabled = true) {
  return useQuery({
    queryKey: buddyOptionsQueryKey(teamId),
    queryFn: async () =>
      (await apiFetch<{ teams: BuddyOption[] }>(`/teams/${teamId}/buddy_options`)).teams,
    enabled,
  });
}
