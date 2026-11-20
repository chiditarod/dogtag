import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { Team } from '@/types/api';

export const teamsQueryKey = ['teams'] as const;

/**
 * `skipUnauthorized` is for callers on a public page (the race list): a 401 there is just
 * "no teams to show", not a reason to send the visitor to the login page.
 */
export function useTeams({
  enabled = true,
  skipUnauthorized = false,
}: { enabled?: boolean; skipUnauthorized?: boolean } = {}) {
  return useQuery({
    queryKey: teamsQueryKey,
    enabled,
    queryFn: async () =>
      (await apiFetch<{ teams: Team[] }>('/teams', { skipUnauthorized })).teams,
  });
}
