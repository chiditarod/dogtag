import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { NewStaffRaceResponse, RacePayload, StaffRaceResponse, StaffRaceSummary } from './types';

export const staffRacesKey = ['staff', 'races'] as const;
/** The id is a string so `7` (from the list) and `"7"` (from the URL) share one cache entry. */
export const staffRaceKey = (id: number | string) => [...staffRacesKey, String(id)] as const;

/** The race list, newest race day first. */
export function useStaffRaces() {
  return useQuery({
    queryKey: staffRacesKey,
    queryFn: async () => (await apiFetch<{ races: StaffRaceSummary[] }>('/staff/races')).races,
  });
}

/** The race and the zones the time zone select offers. */
export function useStaffRace(id: number | string | undefined) {
  return useQuery({
    queryKey: staffRaceKey(id ?? ''),
    queryFn: () => apiFetch<StaffRaceResponse>(`/staff/races/${id}`),
    enabled: id !== undefined,
  });
}

/** Defaults for a new race, and the selectable zones. */
export function useNewStaffRace() {
  return useQuery({
    queryKey: [...staffRacesKey, 'new'] as const,
    queryFn: () => apiFetch<NewStaffRaceResponse>('/staff/races/new'),
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
    mutationFn: (race: RacePayload) =>
      apiFetch<StaffRaceResponse>('/staff/races', { method: 'POST', json: { race } }),
    onSuccess: invalidate,
  });
}

export function useUpdateRace(id: number | string) {
  const invalidate = useInvalidateRaces();
  return useMutation({
    mutationFn: (race: RacePayload) =>
      apiFetch<StaffRaceResponse>(`/staff/races/${id}`, { method: 'PUT', json: { race } }),
    onSuccess: invalidate,
  });
}

/** A 422 with `code: "race_has_teams"` means the race still has teams. */
export function useDeleteRace(id: number | string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRaces();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/staff/races/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      // Drop the deleted race first so the open page does not refetch it (a 404) while it navigates away.
      queryClient.removeQueries({ queryKey: staffRaceKey(id) });
      return invalidate();
    },
  });
}
