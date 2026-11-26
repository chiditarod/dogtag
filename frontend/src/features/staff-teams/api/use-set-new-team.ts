import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamQueryKey } from '@/features/teams/api/use-team';
import { apiFetch } from '@/lib/api-client';
import type { Team } from '@/types/api';
import type { NewTeamSetting } from '../types';
import { staffTeamQueryKey } from './use-staff-team';

/** Admins and operators set the "new team" flag (`auto`, `yes` or `no`) through the team update. */
export function useSetNewTeam(teamId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newTeamSetting: NewTeamSetting) =>
      apiFetch<{ team: Team }>(`/teams/${teamId}`, {
        method: 'PATCH',
        json: { team: { new_team_setting: newTeamSetting } },
      }),
    onSuccess: async ({ team }) => {
      queryClient.setQueryData(teamQueryKey(teamId), team);
      // The permissions hook also refetches when the team query is rewritten. Waiting here keeps the
      // mutation pending until the staff team shows the new setting, so a select reading it
      // does not flash the old value.
      await queryClient.invalidateQueries({ queryKey: staffTeamQueryKey(teamId) });
    },
  });
}
