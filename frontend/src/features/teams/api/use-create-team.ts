import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsQueryKey } from '@/features/teams/api/use-teams';
import { apiFetch } from '@/lib/api-client';
import type { Team } from '@/types/api';

export interface CreateTeamInput {
  raceId: number;
  name: string;
  description: string;
  experience: number;
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ raceId, ...team }: CreateTeamInput) =>
      apiFetch<{ team: Team }>('/teams', {
        method: 'POST',
        json: { race_id: raceId, team },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: teamsQueryKey }),
  });
}
