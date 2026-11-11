import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setTeamChecklist } from '@/features/teams/api/use-team';
import { teamsQueryKey } from '@/features/teams/api/use-teams';
import { apiFetch } from '@/lib/api-client';
import type { Checklist } from '@/types/api';

export type PayVariables =
  | { requirementId: number; mock: true }
  | { requirementId: number; mock?: false; stripeToken: string; stripeEmail: string };

/**
 * Pays the team's fee: POST /payments with a Checkout token, or
 * /mock_payments (dev/test MockPaymentRequirement) with no card.
 */
export function usePay(teamId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: PayVariables) =>
      apiFetch<{ checklist: Checklist }>(
        `/teams/${teamId}/${variables.mock ? 'mock_payments' : 'payments'}`,
        {
          method: 'POST',
          json: variables.mock
            ? { requirement_id: variables.requirementId }
            : {
                requirement_id: variables.requirementId,
                stripe_token: variables.stripeToken,
                stripe_email: variables.stripeEmail,
              },
        },
      ),
    onSuccess: ({ checklist }) => {
      setTeamChecklist(queryClient, teamId, checklist);
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey });
    },
  });
}
