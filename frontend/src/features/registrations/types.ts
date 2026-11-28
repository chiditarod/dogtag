export type RegistrationStaffInfo = {
  assigned_team_number: number | null;
  payments_paid: number;
  payments_total: number;
  updated_at: string;
  new_team: boolean | null;
};

export type RegistrationRow = {
  id: number;
  name: string;
  description: string | null;
  mine: boolean;
  can_show: boolean;
  deletable: boolean;
  percent_complete: number;
  experience_label: string;
  racer_years: number;
  answers: Record<string, string | null>;
  waitlist_position: number | null;
  created_at: string;
  staff: RegistrationStaffInfo | null;
};

export type EmailLists = { owners: string[]; racers: string[] };

export type RegistrationsResponse = {
  race: {
    id: number;
    name: string;
    time_zone: string;
    max_teams: number;
    finalized_count: number;
    full: boolean;
    open_for_registration: boolean;
  };
  filter_fields: { key: string; label: string }[];
  registering_kind: 'registering' | 'waitlist';
  viewer: { staff: boolean; can_email: boolean };
  finalized: RegistrationRow[];
  registering: RegistrationRow[];
  emails: { to: string; finalized: EmailLists; registering: EmailLists } | null;
};

export type RegistrationsTab = 'registered' | 'registering';
