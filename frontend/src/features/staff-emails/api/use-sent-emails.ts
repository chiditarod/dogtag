import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { EmailFilterValues, SentEmailsResponse } from './types';

export const sentEmailsKey = ['staff', 'sent_emails'] as const;

/** Only filters that are set go on the URL; the `any` status is never sent. */
export function sentEmailsPath({ teamId, userId, status, kind, recipient, page }: EmailFilterValues): string {
  const params = new URLSearchParams();
  if (teamId !== undefined) params.set('team_id', String(teamId));
  if (userId !== undefined) params.set('user_id', String(userId));
  if (status !== 'any') params.set('status', status);
  if (kind) params.set('kind', kind);
  if (recipient) params.set('recipient', recipient);
  params.set('page', String(page));
  return `/staff/sent_emails?${params.toString()}`;
}

export function useSentEmails(values: EmailFilterValues) {
  return useQuery({
    queryKey: [...sentEmailsKey, values],
    queryFn: () => apiFetch<SentEmailsResponse>(sentEmailsPath(values)),
    placeholderData: keepPreviousData,
  });
}
