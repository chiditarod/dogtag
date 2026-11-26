import type { StaffTeam } from '@/features/staff-teams/types';
import type { Team } from '@/types/api';

/** Everything the team page gates on, in one place. All booleans. */
export interface TeamPermissions {
  editTeam: boolean;
  addRacers: boolean;
  editRacers: boolean;
  removeRacers: boolean;
  setCaptain: boolean;
  editQuestions: boolean;
  deleteTeam: boolean;
  /** Offer the past-racers picker (the account holder's own past teams). */
  pastRacers: boolean;
  /** Offer `Add yourself` (the viewer is the account holder). */
  addYourself: boolean;
  /**
   * The racer fee card's Pay button. Starting a card charge is not read-only, so a staff viewer
   * does not get it until the staff team has loaded, nor if that request failed.
   */
  pay: boolean;
  /** Staff taking payment for a team (`can.take_payment`). Also off while loading or after a failure. */
  staffPay: boolean;
  staffLinks: boolean;
  closedForRacersNote: boolean;
}

/** The server refuses to remove a racer from a team that is complete apart from its captain. */
export const completeButCaptain = (team: Team) => {
  const { checklist } = team;
  return (
    checklist.racers.filled >= checklist.racers.total &&
    checklist.questions.done &&
    checklist.fee.done
  );
};

const canRemoveRacers = (team: Team) =>
  !team.checklist.finalized && !completeButCaptain(team);

/** Today's rules for a racer (and for staff until the staff team has loaded, see `useTeamPermissions`). */
export function racerPermissions(team: Team): TeamPermissions {
  const open = team.race.open_for_registration;
  return {
    editTeam: true,
    addRacers: open,
    editRacers: true,
    removeRacers: open && canRemoveRacers(team),
    setCaptain: open,
    editQuestions: open,
    deleteTeam: team.deletable && open,
    pastRacers: open,
    addYourself: open,
    pay: true,
    staffPay: false,
    staffLinks: false,
    closedForRacersNote: false,
  };
}

/** Staff rules: the server's `can` flags, plus the racer-only guards it does not model. */
export function staffPermissions(
  team: Team,
  staffTeam: StaffTeam,
  meId: number,
): TeamPermissions {
  const { can } = staffTeam;
  const racer = racerPermissions(team);
  const isAccountHolder = staffTeam.account_holder?.id === meId;
  return {
    editTeam: can.update_team,
    addRacers: can.add_racers,
    editRacers: can.edit_racers,
    removeRacers: can.remove_racers && canRemoveRacers(team),
    setCaptain: can.set_captain,
    editQuestions: can.edit_questions,
    deleteTeam: can.delete_team,
    pastRacers: racer.pastRacers && isAccountHolder,
    addYourself: racer.addYourself && isAccountHolder,
    pay: true,
    staffPay: can.take_payment,
    staffLinks: true,
    closedForRacersNote: team.race.registration_status === 'closed' && can.update_team,
  };
}

/** A staff viewer until the staff team answers (or if it fails): nothing that changes anything. */
export const READ_ONLY_PERMISSIONS: TeamPermissions = {
  editTeam: false,
  addRacers: false,
  editRacers: false,
  removeRacers: false,
  setCaptain: false,
  editQuestions: false,
  deleteTeam: false,
  pastRacers: false,
  addYourself: false,
  pay: false,
  staffPay: false,
  staffLinks: false,
  closedForRacersNote: false,
};
