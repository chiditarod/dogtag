import { describe, expect, it } from 'vitest';
import { buildStaffTeam, noCan } from '@/features/staff-teams/test-fixtures';
import type { StaffTeamCan } from '@/features/staff-teams/types';
import { buildChecklist, buildRace, buildTeam } from '@/test/fixtures';
import type { Team } from '@/types/api';
import {
  READ_ONLY_PERMISSIONS,
  racerPermissions,
  staffPermissions,
  type TeamPermissions,
} from './permissions';

const allCan: StaffTeamCan = Object.fromEntries(
  Object.keys(noCan).map((key) => [key, true]),
) as unknown as StaffTeamCan;

const closedRace = buildRace({ open_for_registration: false, registration_status: 'closed' });
const completeChecklist = {
  racers: { filled: 5, total: 5, captain: false, done: false },
  questions: { required: false, done: true },
};

const fixtures: Record<string, Team> = {
  open: buildTeam(),
  closed: buildTeam({ race: closedRace }),
  'final edits': buildTeam({ race: closedRace, deletable: false }),
  finalized: buildTeam({
    deletable: false,
    checklist: buildChecklist({ finalized: true, remaining: 0 }),
  }),
  'complete but captain': buildTeam({
    checklist: buildChecklist({
      ...completeChecklist,
      fee: { ...buildChecklist().fee, done: true },
    }),
  }),
};

// The gates as they were written inline before this module (roster-card.tsx,
// questions-card.tsx, delete-team.tsx), kept here verbatim so a reviewer can compare.
function oldInlineGates(team: Team) {
  const { race, checklist } = team;
  const open = race.open_for_registration;
  const completeButCaptain =
    checklist.racers.filled >= checklist.racers.total &&
    checklist.questions.done &&
    checklist.fee.done;
  return {
    addRacers: open,
    canRemove: open && !checklist.finalized && !completeButCaptain,
    questionsOpen: open,
    showDelete: team.deletable && open,
  };
}

describe('racerPermissions', () => {
  it.each(Object.entries(fixtures))('matches the old inline gates for a %s team', (_name, team) => {
    const old = oldInlineGates(team);
    const open = team.race.open_for_registration;
    expect(racerPermissions(team)).toEqual({
      editTeam: true,
      addRacers: old.addRacers,
      editRacers: true,
      removeRacers: old.canRemove,
      setCaptain: open,
      editQuestions: old.questionsOpen,
      deleteTeam: old.showDelete,
      pastRacers: open,
      addYourself: open,
      pay: true,
      staffPay: false,
      staffLinks: false,
      closedForRacersNote: false,
    } satisfies TeamPermissions);
  });
});

describe('staffPermissions', () => {
  it('copies the server can flags', () => {
    const team = fixtures.open;
    expect(staffPermissions(team, buildStaffTeam(allCan), 1)).toMatchObject({
      editTeam: true,
      addRacers: true,
      editRacers: true,
      removeRacers: true,
      setCaptain: true,
      editQuestions: true,
      deleteTeam: true,
      staffPay: true,
      staffLinks: true,
      pay: true,
    });
    expect(staffPermissions(team, buildStaffTeam(noCan), 1)).toMatchObject({
      editTeam: false,
      addRacers: false,
      editRacers: false,
      removeRacers: false,
      setCaptain: false,
      editQuestions: false,
      deleteTeam: false,
      staffPay: false,
      staffLinks: true,
      pay: false,
    });
    // A refunder on their own team may still pay as a racer; the server authorizes :edit for the owner.
    expect(staffPermissions(team, buildStaffTeam(noCan), 7).pay).toBe(true);
  });

  it('keeps the finalized and complete-but-captain guards on remove', () => {
    expect(staffPermissions(fixtures.finalized, buildStaffTeam(allCan), 1).removeRacers).toBe(
      false,
    );
    expect(
      staffPermissions(fixtures['complete but captain'], buildStaffTeam(allCan), 1).removeRacers,
    ).toBe(false);
  });

  it('gives past racers and add yourself only to the account holder', () => {
    const team = fixtures.open;
    const staffTeam = buildStaffTeam(allCan);
    const owner = staffPermissions(team, staffTeam, 7);
    expect(owner.pastRacers).toBe(true);
    expect(owner.addYourself).toBe(true);
    const other = staffPermissions(team, staffTeam, 99);
    expect(other.pastRacers).toBe(false);
    expect(other.addYourself).toBe(false);
  });

  it('gives no past racers or add yourself for a team with no account holder', () => {
    const permissions = staffPermissions(
      fixtures.open,
      buildStaffTeam(allCan, { account_holder: null }),
      7,
    );
    expect(permissions.pastRacers).toBe(false);
    expect(permissions.addYourself).toBe(false);
  });

  it('still needs registration to be open for the owner-only shortcuts', () => {
    const permissions = staffPermissions(fixtures.closed, buildStaffTeam(allCan), 7);
    expect(permissions.pastRacers).toBe(false);
    expect(permissions.addYourself).toBe(false);
  });

  it('shows the closed note only for a closed race when the viewer may update the team', () => {
    const closedNote = (team: Team, can: Partial<StaffTeamCan>) =>
      staffPermissions(team, buildStaffTeam(can), 1).closedForRacersNote;
    expect(closedNote(fixtures.closed, { update_team: true })).toBe(true);
    expect(closedNote(fixtures.closed, { update_team: false })).toBe(false);
    expect(closedNote(fixtures.open, { update_team: true })).toBe(false);
    const notYetOpen = buildTeam({
      race: buildRace({ open_for_registration: false, registration_status: 'not_yet_open' }),
    });
    expect(closedNote(notYetOpen, { update_team: true })).toBe(false);
    const waitlist = buildTeam({
      race: buildRace({ open_for_registration: false, registration_status: 'waitlist' }),
    });
    expect(closedNote(waitlist, { update_team: true })).toBe(false);
  });
});

describe('READ_ONLY_PERMISSIONS', () => {
  it('turns every flag off, including every kind of Pay', () => {
    expect(Object.values(READ_ONLY_PERMISSIONS).every((flag) => flag === false)).toBe(true);
    expect(READ_ONLY_PERMISSIONS.pay).toBe(false);
    expect(READ_ONLY_PERMISSIONS.staffPay).toBe(false);
  });
});
