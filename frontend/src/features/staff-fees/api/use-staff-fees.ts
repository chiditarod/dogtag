import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { FeeResponse, FeesResponse, NewFeePayload, TierPayload } from './types';

export const staffFeesKey = ['staff', 'fees'] as const;
/** Ids are strings so `7` (from a row) and `"7"` (from the URL) share one cache entry. */
export const raceFeesKey = (raceId: number | string) => [...staffFeesKey, 'race', String(raceId)] as const;
export const feeKey = (id: number | string) => [...staffFeesKey, 'fee', String(id)] as const;

// The literal key (PR 5's `staffRacesKey` lives in another feature): the overview's fees card and
// its `setup_problems` come from the race endpoints.
const racesKey = ['staff', 'races'] as const;

/** A race's fees, and the types a new one may use. */
export function useFees(raceId: number | string | undefined) {
  return useQuery({
    queryKey: raceFeesKey(raceId ?? ''),
    queryFn: () => apiFetch<FeesResponse>(`/staff/races/${raceId}/requirements`),
    enabled: raceId !== undefined,
  });
}

/** One fee with its prices, and its race. */
export function useFee(id: number | string | undefined) {
  return useQuery({
    queryKey: feeKey(id ?? ''),
    queryFn: () => apiFetch<FeeResponse>(`/staff/requirements/${id}`),
    enabled: id !== undefined,
  });
}

/** Every write refreshes the fee lists and the races, which show the same counts and problems. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [...staffFeesKey, 'race'] }),
      queryClient.invalidateQueries({ queryKey: racesKey }),
    ]);
}

/** Stores the fee a write returned, so the open page shows it without another fetch. */
function useStoreFee(feeId?: number | string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  return (response: FeeResponse) => {
    queryClient.setQueryData(feeKey(feeId ?? response.requirement.id), response);
    return invalidate();
  };
}

/** A new fee comes with its first price. */
export function useCreateFee(raceId: number | string) {
  const store = useStoreFee();
  return useMutation({
    mutationFn: (payload: NewFeePayload) =>
      apiFetch<FeeResponse>(`/staff/races/${raceId}/requirements`, { method: 'POST', json: payload }),
    onSuccess: store,
  });
}

export function useRenameFee(id: number | string) {
  const store = useStoreFee(id);
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<FeeResponse>(`/staff/requirements/${id}`, { method: 'PATCH', json: { requirement: { name } } }),
    onSuccess: store,
  });
}

/** A 422 with `code: "fee_has_payments"` means teams have paid it. */
export function useDeleteFee(id: number | string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/staff/requirements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      // Drop the deleted fee first so the open page does not refetch it (a 404) while it navigates away.
      queryClient.removeQueries({ queryKey: feeKey(id) });
      return invalidate();
    },
  });
}

export function useAddPrice(feeId: number | string) {
  const store = useStoreFee(feeId);
  return useMutation({
    mutationFn: (tier: Required<TierPayload>) =>
      apiFetch<FeeResponse>(`/staff/requirements/${feeId}/tiers`, { method: 'POST', json: { tier } }),
    onSuccess: store,
  });
}

export function useUpdatePrice(tierId: number | string, feeId: number | string) {
  const store = useStoreFee(feeId);
  return useMutation({
    mutationFn: (tier: TierPayload) =>
      apiFetch<FeeResponse>(`/staff/tiers/${tierId}`, { method: 'PATCH', json: { tier } }),
    onSuccess: store,
  });
}

/** A 422 with `code: "only_price_of_paid_fee"` means a paid fee must keep one price. */
export function useDeletePrice(tierId: number | string, feeId: number | string) {
  const store = useStoreFee(feeId);
  return useMutation({
    mutationFn: () => apiFetch<FeeResponse>(`/staff/tiers/${tierId}`, { method: 'DELETE' }),
    onSuccess: store,
  });
}
