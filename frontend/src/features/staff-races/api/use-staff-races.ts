import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { RacePayload, StaffRace, StaffRaceSummary } from './types';

export const staffRacesKey = ['staff', 'races'] as const;
export const staffRaceKey = (id: number | string) => [...staffRacesKey, id] as const;

/** The race list, newest race day first. */
export function useStaffRaces() {
  return useQuery({
    queryKey: staffRacesKey,
    queryFn: async () => (await apiFetch<{ races: StaffRaceSummary[] }>('/staff/races')).races,
  });
}

export function useStaffRace(id: number | string | undefined) {
  return useQuery({
    queryKey: staffRaceKey(id ?? ''),
    queryFn: async () => (await apiFetch<{ race: StaffRace }>(`/staff/races/${id}`)).race,
    enabled: id !== undefined,
  });
}

/** Writes refresh the list and every open race, since both show the same counts and problems. */
function useInvalidateRaces() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: staffRacesKey });
}

export function useCreateRace() {
  const invalidate = useInvalidateRaces();
  return useMutation({
    mutationFn: async (race: RacePayload) =>
      (await apiFetch<{ race: StaffRace }>('/staff/races', { method: 'POST', json: { race } })).race,
    onSuccess: invalidate,
  });
}

export function useUpdateRace(id: number | string) {
  const invalidate = useInvalidateRaces();
  return useMutation({
    mutationFn: async (race: RacePayload) =>
      (await apiFetch<{ race: StaffRace }>(`/staff/races/${id}`, { method: 'PUT', json: { race } })).race,
    onSuccess: invalidate,
  });
}

/** A 422 with `code: "race_has_teams"` means the race still has teams. */
export function useDeleteRace(id: number | string) {
  const invalidate = useInvalidateRaces();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/staff/races/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
