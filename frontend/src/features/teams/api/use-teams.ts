import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { Team } from '@/types/api';

export const teamsQueryKey = ['teams'] as const;

export function useTeams({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: teamsQueryKey,
    enabled,
    queryFn: async () => (await apiFetch<{ teams: Team[] }>('/teams')).teams,
  });
}
