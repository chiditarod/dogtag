import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { ReopenPaymentResult } from '../types';

/** Reopens one refunded payment so the team can pay again, then refreshes the payments list. */
export function useReopenPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: number) =>
      apiFetch<ReopenPaymentResult>(`/staff/payments/${paymentId}/reopen`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff', 'payments'] }),
  });
}
