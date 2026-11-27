import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamQueryKey } from '@/features/teams/api/use-team';
import { apiFetch } from '@/lib/api-client';
import type { Team } from '@/types/api';
import type { NewTeamSetting, StaffTeam } from '../types';
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
      // The permissions hook also invalidates the staff team when the team query is rewritten, which
      // would cancel an awaited invalidate. A fetchQuery with its own fetcher is not cancelled by that,
      // so the mutation stays pending until the staff team shows the new setting.
      await queryClient.fetchQuery({
        queryKey: staffTeamQueryKey(teamId),
        queryFn: async () =>
          (await apiFetch<{ staff_team: StaffTeam }>(`/staff/teams/${teamId}`)).staff_team,
        staleTime: 0,
      });
    },
  });
}
