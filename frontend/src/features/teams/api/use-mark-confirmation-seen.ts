import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setTeamChecklist } from '@/features/teams/api/use-team';
import { apiFetch } from '@/lib/api-client';
import type { Checklist } from '@/types/api';

/** Records that the captain has seen the completion confirmation. */
export function useMarkConfirmationSeen(teamId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ checklist: Checklist }>(`/teams/${teamId}/confirmation`, {
        method: 'POST',
      }),
    onSuccess: ({ checklist }) => setTeamChecklist(queryClient, teamId, checklist),
  });
}
