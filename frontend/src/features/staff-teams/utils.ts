import { t } from '@/locales/en';
import type { StaffTeam } from './types';

/** Yes, No or "No racers yet", the wording staff see for the new-team flag. */
export function yesNoUnknown(flag: boolean | null): string {
  if (flag === null) return t('staff.team.newTeamUnknown');
  return t(flag ? 'staff.team.newTeamYes' : 'staff.team.newTeamNo');
}

/** The read-only text for the flag, marking a value an admin set by hand. */
export function newTeamLabel({ new_team, new_team_overridden }: StaffTeam): string {
  const label = yesNoUnknown(new_team);
  return new_team_overridden ? t('staff.team.setByAdmin', { value: label }) : label;
}

/** What "Automatic" would give now, e.g. `Automatic (now No: 3 years raced)`. */
export function automaticOptionLabel({ computed_new_team, years_raced }: StaffTeam): string {
  const years =
    computed_new_team === null || years_raced === null
      ? ''
      : t(years_raced === 1 ? 'staff.team.yearsRaced_one' : 'staff.team.yearsRaced_other', {
          n: years_raced,
        });
  return t('staff.team.newTeamAuto', { value: yesNoUnknown(computed_new_team), years });
}
