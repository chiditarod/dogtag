import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { Race } from '@/types/api';

export const racesQueryKey = ['races'] as const;

export function useRaces() {
  return useQuery({
    queryKey: racesQueryKey,
    queryFn: async () => (await apiFetch<{ races: Race[] }>('/races')).races,
  });
}

export function useRace(id: string | number | undefined) {
  return useQuery({
    queryKey: [...racesQueryKey, String(id)],
    queryFn: async () =>
      (await apiFetch<{ race: Race }>(`/races/${id}`)).race,
    enabled: id !== undefined,
  });
}
