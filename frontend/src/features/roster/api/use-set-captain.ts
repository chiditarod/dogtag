import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamQueryKey } from '@/features/teams/api/use-team';
import { teamsQueryKey } from '@/features/teams/api/use-teams';
import { apiFetch } from '@/lib/api-client';
import type { Team } from '@/types/api';

/**
 * Makes one of the team's racers its captain. The cached team moves the star
 * at once; a failure puts the previous team back, and the server's team
 * replaces the guess on success.
 */
export function useSetCaptain(teamId: number) {
  const queryClient = useQueryClient();
  const key = teamQueryKey(teamId);
  return useMutation({
    mutationFn: (personId: number) =>
      apiFetch<{ team: Team }>(`/teams/${teamId}/captain`, {
        method: 'PUT',
        json: { person_id: personId },
      }),
    onMutate: async (personId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Team>(key);
      queryClient.setQueryData<Team>(key, (team) =>
        team
          ? {
              ...team,
              captain_id: personId,
              checklist: {
                ...team.checklist,
                racers: {
                  ...team.checklist.racers,
                  captain: true,
                  done: team.checklist.racers.filled >= team.checklist.racers.total,
                },
              },
            }
          : team,
      );
      return { previous };
    },
    onError: (_error, _personId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: ({ team }) => {
      queryClient.setQueryData(key, team);
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey });
    },
  });
}
