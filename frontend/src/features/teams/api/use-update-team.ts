import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamQueryKey } from '@/features/teams/api/use-team';
import { teamsQueryKey } from '@/features/teams/api/use-teams';
import { apiFetch } from '@/lib/api-client';
import type { Team } from '@/types/api';

export interface UpdateTeamInput {
  name: string;
  description: string;
  experience: number;
}

export function useUpdateTeam(teamId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (team: UpdateTeamInput) =>
      apiFetch<{ team: Team }>(`/teams/${teamId}`, {
        method: 'PATCH',
        json: { team },
      }),
    onSuccess: ({ team }) => {
      queryClient.setQueryData(teamQueryKey(teamId), team);
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey });
    },
  });
}
