import type { StaffTeam, StaffTeamCan } from './types';

export const noCan: StaffTeamCan = {
  update_team: false,
  set_captain: false,
  add_racers: false,
  edit_racers: false,
  remove_racers: false,
  edit_questions: false,
  delete_team: false,
  take_payment: false,
  set_new_team: false,
  view_emails: false,
  view_payments: false,
};

/** A staff team owned by account holder 7, with every `can` flag off except those given. */
export function buildStaffTeam(
  can: Partial<StaffTeamCan> = {},
  overrides: Partial<StaffTeam> = {},
): StaffTeam {
  return {
    id: 9,
    race_id: 1,
    finalized: false,
    team_number: null,
    new_team: null,
    new_team_overridden: false,
    new_team_setting: 'auto',
    computed_new_team: null,
    years_raced: 0,
    collaborating: null,
    racing_with: [],
    captain: null,
    captain_inferred: false,
    account_holder: {
      id: 7,
      first_name: 'Owner',
      last_name: 'Person',
      email: 'owner@example.com',
      phone: null,
    },
    sent_emails_count: 0,
    payments: [],
    can: { ...noCan, ...can },
    ...overrides,
  };
}

/** The `GET /staff/teams/:id` response body. */
export function staffTeamBody(can: Partial<StaffTeamCan> = {}, overrides: Partial<StaffTeam> = {}) {
  return { staff_team: buildStaffTeam(can, overrides) };
}
