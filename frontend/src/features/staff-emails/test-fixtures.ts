import type { SentEmail, SentEmailsResponse } from './api/types';

/** A copy of `SentEmail::KINDS` (app/models/sent_email.rb). A kind added there fails kinds.test.ts until it gets a label. */
export const SERVER_KINDS = [
  'welcome',
  'team_finalized',
  'team_waitlisted',
  'refund',
  'email_changed',
  'password_reset',
  'classy_fundraising',
  'registration_reminder',
  'feedback',
];

export function sentEmail(overrides: Partial<SentEmail> = {}): SentEmail {
  return {
    id: 1,
    created_at: '2026-12-09T20:14:00Z',
    kind: 'team_finalized',
    recipient: 'ada@example.com',
    subject: "You're in! Doge Sled is registered",
    status: 'sent',
    status_changed_at: '2026-12-09T20:14:05Z',
    error: null,
    team: { id: 7, name: 'Doge Sled' },
    ...overrides,
  };
}

export function emailsResponse(
  rows: SentEmail[],
  overrides: Partial<SentEmailsResponse> = {},
): SentEmailsResponse {
  return {
    sent_emails: rows,
    meta: { page: 1, per_page: 25, total_count: rows.length, total_pages: rows.length > 0 ? 1 : 0 },
    filters: { team: null, user: null, kinds: SERVER_KINDS, statuses: ['sent', 'queued', 'failed'] },
    ...overrides,
  };
}
