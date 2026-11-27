import type { PaymentStatus } from '@/features/staff-payments/types';

export interface StaffTeamPerson {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

export interface StaffTeamPayment {
  id: number;
  requirement_id: number;
  name: string;
  amount_cents: number | null;
  paid_at: string;
  status: PaymentStatus;
}

/** What this viewer may do on the team, decided by the server (`StaffTeamPermissions`). */
export interface StaffTeamCan {
  update_team: boolean;
  set_captain: boolean;
  add_racers: boolean;
  edit_racers: boolean;
  remove_racers: boolean;
  edit_questions: boolean;
  delete_team: boolean;
  take_payment: boolean;
  set_new_team: boolean;
  view_emails: boolean;
  view_payments: boolean;
}

export type NewTeamSetting = 'auto' | 'yes' | 'no';

/** `GET /api/v1/staff/teams/:id` (the `staff_team` object). */
export interface StaffTeam {
  id: number;
  race_id: number;
  finalized: boolean;
  team_number: number | null;
  new_team: boolean | null;
  new_team_overridden: boolean;
  new_team_setting: NewTeamSetting;
  computed_new_team: boolean | null;
  years_raced: number | null;
  collaborating: boolean | null;
  racing_with: string[];
  captain: StaffTeamPerson | null;
  captain_inferred: boolean;
  /** Null when the owner's account is gone (teams.user_id has no foreign key). */
  account_holder: StaffTeamPerson | null;
  sent_emails_count: number;
  payments: StaffTeamPayment[];
  can: StaffTeamCan;
}
