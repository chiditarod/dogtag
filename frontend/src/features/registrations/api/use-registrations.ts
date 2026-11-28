import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { ApiError } from '@/lib/api-client';
import type { RegistrationsResponse } from '../types';

export const registrationsQueryKey = (raceId: number) => ['registrations', raceId] as const;

export function useRegistrations(raceId: number) {
  return useQuery<RegistrationsResponse, ApiError>({
    queryKey: registrationsQueryKey(raceId),
    queryFn: () => apiFetch<RegistrationsResponse>(`/races/${raceId}/registrations`),
    enabled: Number.isInteger(raceId) && raceId > 0,
    // An unknown race is a 404 the page shows at once; retries would only delay it.
    retry: false,
  });
}
