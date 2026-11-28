import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { SentEmailsResponse } from '../api/types';
import { emailsResponse, sentEmail } from '../test-fixtures';

const requests: URL[] = [];

function serve(response: SentEmailsResponse | ((url: URL) => SentEmailsResponse), roles = ['operator']) {
  requests.length = 0;
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles } })),
    http.get('/api/v1/staff/sent_emails', ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      return HttpResponse.json(typeof response === 'function' ? response(url) : response);
    }),
  );
}

const dataRows = () =>
  screen.getAllByRole('row').filter((row) => within(row).queryAllByRole('cell').length > 0);

describe('EmailsPage', () => {
  it('lists emails with kind words, team link, status badge and when it changed', async () => {
    serve(emailsResponse([sentEmail(), sentEmail({ id: 2, subject: 'Mystery', team: null, kind: 'new_thing', status_changed_at: null })]));
    renderApp('/staff/emails');
    expect(await screen.findByRole('heading', { name: 'Emails sent' })).toBeInTheDocument();
    await screen.findByText("You're in! Doge Sled is registered");
    const rows = dataRows();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Team finalized')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: 'Doge Sled' })).toHaveAttribute('href', '/register/teams/7');
    expect(within(rows[0]).getByText('Sent')).toBeInTheDocument();
    expect(within(rows[1]).getByText('New thing')).toBeInTheDocument();
    expect(within(rows[1]).queryByRole('link')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('2 emails');
    expect(screen.getByText(/Newest first/)).toBeInTheDocument();
  });

  it('shows the team chip from the URL, and removing it drops team_id from the next request', async () => {
    serve((url) =>
      emailsResponse([sentEmail()], {
        filters: {
          team: url.searchParams.has('team_id') ? { id: 7, name: 'Doge Sled' } : null,
          user: null,
          kinds: ['welcome'],
          statuses: ['sent', 'queued', 'failed'],
        },
      }),
    );
    renderApp('/staff/emails?team_id=7');
    const chip = await screen.findByRole('button', { name: 'Remove filter Team: Doge Sled' });
    expect(requests[0].searchParams.get('team_id')).toBe('7');
    await userEvent.click(chip);
    await waitFor(() => expect(requests.some((url) => !url.searchParams.has('team_id'))).toBe(true));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Remove filter Team/ })).toBeNull());
  });

  it('falls back to the team number when the team no longer exists', async () => {
    serve(
      emailsResponse([], {
        filters: { team: { id: 9, name: null }, user: null, kinds: [], statuses: ['sent', 'queued', 'failed'] },
      }),
    );
    renderApp('/staff/emails?team_id=9');
    expect(await screen.findByRole('button', { name: 'Remove filter Team: #9' })).toBeInTheDocument();
  });

  it('shows the user chip from the URL, and removing it drops user_id from the next request', async () => {
    serve((url) =>
      emailsResponse([sentEmail()], {
        filters: {
          team: null,
          user: url.searchParams.has('user_id') ? { id: 12, email: 'ada@example.com' } : null,
          kinds: ['welcome'],
          statuses: ['sent', 'queued', 'failed'],
        },
      }),
    );
    renderApp('/staff/emails?user_id=12');
    const chip = await screen.findByRole('button', { name: 'Remove filter User: ada@example.com' });
    expect(requests[0].searchParams.get('user_id')).toBe('12');
    expect(requests[0].searchParams.has('recipient')).toBe(false);
    await userEvent.click(chip);
    await waitFor(() => expect(requests.some((url) => !url.searchParams.has('user_id'))).toBe(true));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Remove filter User/ })).toBeNull());
  });

  it('falls back to the user number when the user no longer exists', async () => {
    serve(
      emailsResponse([], {
        filters: { team: null, user: { id: 12, email: null }, kinds: [], statuses: ['sent', 'queued', 'failed'] },
      }),
    );
    renderApp('/staff/emails?user_id=12');
    expect(await screen.findByRole('button', { name: 'Remove filter User: #12' })).toBeInTheDocument();
  });

  it('treats a junk user_id or team_id in the URL as absent: no chip and not sent', async () => {
    serve(emailsResponse([sentEmail()]));
    renderApp('/staff/emails?user_id=abc&team_id=0');
    await screen.findByText("You're in! Doge Sled is registered");
    expect(requests[0].searchParams.has('user_id')).toBe(false);
    expect(requests[0].searchParams.has('team_id')).toBe(false);
    expect(screen.queryByRole('button', { name: /Remove filter (User|Team)/ })).toBeNull();
  });

  it('offers exactly Any, Sent, Queued and Failed, and Failed sends status=failed', async () => {
    serve(emailsResponse([sentEmail()]));
    renderApp('/staff/emails');
    await screen.findByText("You're in! Doge Sled is registered");
    const select = screen.getByLabelText('Status');
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Any',
      'Sent',
      'Queued',
      'Failed',
    ]);
    expect(requests[0].searchParams.has('status')).toBe(false);
    await userEvent.selectOptions(select, 'Failed');
    await waitFor(() => expect(requests.some((url) => url.searchParams.get('status') === 'failed')).toBe(true));
    expect(await screen.findByRole('button', { name: 'Remove filter Status: Failed' })).toBeInTheDocument();
  });

  it('filters by kind in plain words', async () => {
    serve(emailsResponse([sentEmail()]));
    renderApp('/staff/emails');
    await screen.findByText("You're in! Doge Sled is registered");
    const select = screen.getByLabelText('Kind');
    expect(within(select).getByRole('option', { name: 'Registration reminder' })).toBeInTheDocument();
    await userEvent.selectOptions(select, 'Password reset');
    await waitFor(() => expect(requests.some((url) => url.searchParams.get('kind') === 'password_reset')).toBe(true));
    expect(await screen.findByRole('button', { name: 'Remove filter Kind: Password reset' })).toBeInTheDocument();
  });

  it('shows the error of a failed row under its badge', async () => {
    serve(
      emailsResponse([
        sentEmail({ id: 3, status: 'failed', error: 'Net::SMTPAuthenticationError: 535 Incorrect authentication data' }),
      ]),
    );
    renderApp('/staff/emails');
    await screen.findByRole('table');
    const row = dataRows()[0];
    expect(within(row).getByText('Failed')).toBeInTheDocument();
    expect(within(row).getByText(/535 Incorrect authentication data/)).toBeInTheDocument();
  });

  it('shows Queued and how long a queued row has waited', async () => {
    serve(emailsResponse([sentEmail({ id: 4, status: 'queued', created_at: new Date(Date.now() - 2 * 60_000).toISOString(), status_changed_at: null })]));
    renderApp('/staff/emails');
    await screen.findByRole('table');
    const row = dataRows()[0];
    expect(within(row).getByText('Queued')).toBeInTheDocument();
    expect(within(row).getByText('for 2 min')).toBeInTheDocument();
  });

  it('times a queued row from its last status change, not its creation', async () => {
    const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
    serve(emailsResponse([sentEmail({ id: 5, status: 'queued', created_at: ago(300), status_changed_at: ago(3) })]));
    renderApp('/staff/emails');
    await screen.findByRole('table');
    expect(within(dataRows()[0]).getByText('for 3 min')).toBeInTheDocument();
  });

  it('searches by recipient once after the debounce', async () => {
    serve(emailsResponse([sentEmail()]));
    renderApp('/staff/emails?page=2');
    await screen.findByText("You're in! Doge Sled is registered");
    await userEvent.type(screen.getByRole('searchbox', { name: 'Recipient email' }), 'ada@');
    await waitFor(() => expect(requests.some((url) => url.searchParams.get('recipient') === 'ada@')).toBe(true));
    const searches = requests.filter((url) => url.searchParams.has('recipient'));
    expect(searches).toHaveLength(1);
    expect(searches[0].searchParams.get('page')).toBe('1');
  });

  it('Clear all drops every filter', async () => {
    serve(emailsResponse([sentEmail()]));
    renderApp('/staff/emails?status=failed&kind=welcome');
    await userEvent.click(await screen.findByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Remove filter/ })).toBeNull());
    expect(screen.getByLabelText('Status')).toHaveValue('any');
  });

  it('has a Filters (n) sheet for the selects', async () => {
    serve(emailsResponse([sentEmail()]));
    renderApp('/staff/emails?status=failed&kind=welcome');
    await userEvent.click(await screen.findByRole('button', { name: 'Filters (2)' }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByLabelText('Status')).toHaveValue('failed');
    expect(within(sheet).getByLabelText('Kind')).toHaveValue('welcome');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows an empty state when nothing matches', async () => {
    serve(emailsResponse([]));
    renderApp('/staff/emails?status=failed');
    expect(await screen.findByText('No emails match these filters.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('0 emails');
  });

  it('a refunder sees not allowed and no request is made', async () => {
    serve(emailsResponse([sentEmail()]), ['refunder']);
    renderApp('/staff/emails');
    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Emails sent' })).toBeNull();
    expect(requests).toHaveLength(0);
  });
});
