/** A team a sent email belongs to (a deleted team reads as null on the row). */
export interface SentEmailTeam {
  id: number;
  name: string;
}

/** One row of `GET /api/v1/staff/sent_emails`. */
export interface SentEmail {
  id: number;
  created_at: string;
  kind: string | null;
  recipient: string;
  subject: string | null;
  status: string;
  status_changed_at: string | null;
  error: string | null;
  team: SentEmailTeam | null;
}

export interface SentEmailsMeta {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

export interface SentEmailsFilters {
  /** The team filter echoed back; `name` is null when that team no longer exists. */
  team: { id: number; name: string | null } | null;
  /** The user filter echoed back; `email` is null when that user no longer exists. */
  user: { id: number; email: string | null } | null;
  kinds: string[];
  statuses: string[];
}

export interface SentEmailsResponse {
  sent_emails: SentEmail[];
  meta: SentEmailsMeta;
  filters: SentEmailsFilters;
}

export type EmailStatusFilter = 'any' | 'sent' | 'queued' | 'failed';

export interface EmailFilterValues {
  teamId?: number;
  /** The account's own emails (`sent_emails.user_id`), whatever address they went to. */
  userId?: number;
  status: EmailStatusFilter;
  kind?: string;
  recipient: string;
  page: number;
}
