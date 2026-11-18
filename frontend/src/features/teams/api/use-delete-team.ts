import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamQueryKey } from '@/features/teams/api/use-team';
import { teamsQueryKey } from '@/features/teams/api/use-teams';
import { apiFetch } from '@/lib/api-client';

export function useDeleteTeam(teamId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/teams/${teamId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: teamQueryKey(teamId) });
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey });
    },
  });
}
