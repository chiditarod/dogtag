import { useId } from 'react';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import { useSetNewTeam } from '../api/use-set-new-team';
import type { NewTeamSetting, StaffTeam } from '../types';
import { automaticOptionLabel } from '../utils';

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const [first] = Object.values(error.errors).flat();
    return first ?? error.error;
  }
  return t('staff.team.saveFailed');
}

/**
 * Staff set the "new team" flag. It saves on change, so there is no draft to guard; while the save
 * (and the refresh of the staff team) is in flight the chosen value shows, and a refusal puts the
 * server's value back.
 */
export function NewTeamSelect({ staffTeam }: { staffTeam: StaffTeam }) {
  const id = useId();
  const messageId = `${id}-message`;
  const setNewTeam = useSetNewTeam(staffTeam.id);
  const value = setNewTeam.isPending ? setNewTeam.variables : staffTeam.new_team_setting;
  return (
    <div className="space-y-1">
      <select
        id={id}
        aria-label={t('staff.team.newTeam')}
        value={value}
        disabled={setNewTeam.isPending}
        aria-describedby={setNewTeam.isError ? messageId : undefined}
        onChange={(event) => setNewTeam.mutate(event.target.value as NewTeamSetting)}
        className="min-h-11 w-full min-w-0 rounded-md border border-flag bg-white px-2 text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link disabled:opacity-60"
      >
        <option value="auto">{automaticOptionLabel(staffTeam)}</option>
        <option value="yes">{t('staff.team.newTeamYes')}</option>
        <option value="no">{t('staff.team.newTeamNo')}</option>
      </select>
      {setNewTeam.isError && (
        <p id={messageId} role="alert" className="text-sm font-semibold text-starText">
          {errorText(setNewTeam.error)}
        </p>
      )}
      <p role="status" className="text-sm text-green-900 empty:hidden">
        {setNewTeam.isSuccess ? t('staff.team.saved') : ''}
      </p>
    </div>
  );
}
