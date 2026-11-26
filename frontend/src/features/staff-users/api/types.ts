/** The race a team belongs to, as the staff users API reports it. */
export interface StaffUserTeamRace {
  id: number;
  name: string;
  year: number;
}

/** A team on a list row: id, name and race. */
export interface StaffUserRowTeam {
  id: number;
  name: string;
  race: StaffUserTeamRace;
}

/** The fields every staff user payload carries. */
export interface StaffUserBase {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  roles: string[];
}

/** One row of `GET /api/v1/staff/users`. */
export interface StaffUserRow extends StaffUserBase {
  teams: StaffUserRowTeam[];
}

/** A team on the user's own page. */
export interface StaffUserTeam extends StaffUserRowTeam {
  assigned_team_number: number | null;
  finalized: boolean;
  percent_complete: number;
}

/** `GET /api/v1/staff/users/:id`. */
export interface StaffUser extends StaffUserBase {
  created_at: string;
  teams: StaffUserTeam[];
  can_edit: boolean;
  can_destroy: boolean;
  is_self: boolean;
  /** Why this user cannot be deleted, or null. */
  delete_blocker: string | null;
}

export interface StaffUsersMeta {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

export interface StaffUsersResponse {
  users: StaffUserRow[];
  meta: StaffUsersMeta;
}

/** The `PATCH /api/v1/staff/users/:id` body (inside `user`): send only what changes. */
export interface StaffUserPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  roles?: string[];
}

export interface UserFilterValues {
  q: string;
  page: number;
}
