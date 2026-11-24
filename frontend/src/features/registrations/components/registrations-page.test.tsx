import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '@/lib/api-client';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { RegistrationRow, RegistrationsResponse } from '../types';
import { mailtoHref } from '../utils';

function row(overrides: Partial<RegistrationRow> = {}): RegistrationRow {
  return {
    id: 1,
    name: 'Doge Sled',
    description: 'Shibas pulling a cart.',
    mine: false,
    can_show: false,
    deletable: false,
    percent_complete: 100,
    experience_label: 'Twice',
    racer_years: 14,
    answers: {},
    waitlist_position: null,
    created_at: '2026-01-07T15:00:00Z',
    staff: null,
    ...overrides,
  };
}

function response(overrides: Partial<RegistrationsResponse> = {}): RegistrationsResponse {
  return {
    race: {
      id: 7,
      name: 'CHIditarod 2027',
      time_zone: 'America/Chicago',
      max_teams: 150,
      finalized_count: 2,
      full: false,
      open_for_registration: true,
    },
    filter_fields: [],
    registering_kind: 'registering',
    viewer: { staff: false, can_email: false },
    finalized: [
      row({ id: 1, name: 'Doge Sled', answers: { 'racer-type': 'Racer' } }),
      row({ id: 2, name: 'Mush Hour', mine: true, can_show: true, answers: { 'racer-type': 'Art Cart' } }),
    ],
    registering: [row({ id: 3, name: 'Late Starters', percent_complete: 60, experience_label: 'First year' })],
    emails: null,
    ...overrides,
  };
}

const staff = (overrides = {}) => ({
  assigned_team_number: 7,
  payments_paid: 2,
  payments_total: 2,
  updated_at: '2026-01-08T15:00:00Z',
  new_team: null,
  ...overrides,
});

function serve(data: RegistrationsResponse | (() => RegistrationsResponse), roles: string[] = []) {
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles } })),
    http.get('/api/v1/races/7/registrations', () =>
      HttpResponse.json(typeof data === 'function' ? data() : data),
    ),
  );
}

afterEach(() => clearCsrfToken());

describe('RegistrationsPage', () => {
  it("shows registered teams with the viewer's own team linked and others plain", async () => {
    serve(response());
    renderApp('/races/7/registrations');

    expect(await screen.findByRole('heading', { name: t('registrations.heading') })).toBeInTheDocument();
    expect(screen.getByText('CHIditarod 2027 · 2 of 150 spots taken')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `‹ ${t('registrations.allRaces')}` })).toHaveAttribute(
      'href',
      '/register',
    );
    const mine = screen.getByRole('link', { name: 'Mush Hour' });
    expect(mine).toHaveAttribute('href', '/register/teams/2');
    expect(screen.getByText(t('registrations.mine'))).toBeInTheDocument();
    expect(screen.getByText('Doge Sled')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Doge Sled' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Registered (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('2 teams');
  });

  it('hides staff columns, team numbers and email links from a racer', async () => {
    serve(response());
    renderApp('/races/7/registrations');
    await screen.findByText('Doge Sled');

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Team', 'Team experience', "Racers' years"]);
    expect(screen.queryByText(t('registrations.col.payments'))).toBeNull();
    expect(screen.queryByRole('link', { name: /bcc/ })).toBeNull();
  });

  it('switches to Still registering and shows progress', async () => {
    serve(response());
    const click = userEvent.setup();
    const { router } = renderApp('/races/7/registrations');
    await click.click(await screen.findByRole('tab', { name: 'Still registering (1)' }));

    expect(screen.getByRole('tab', { name: 'Still registering (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText('60% done')).toBeInTheDocument();
    expect(screen.getByText('Late Starters')).toBeInTheDocument();
    expect(screen.queryByText('Doge Sled')).toBeNull();
    expect(router.state.location.search).toContain('tab=registering');
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('reads Waitlist with positions when the race is full', async () => {
    serve(
      response({
        registering_kind: 'waitlist',
        registering: [
          row({ id: 4, name: 'Mush Hour 2', waitlist_position: 1, created_at: '2026-01-09T15:00:00Z' }),
        ],
      }),
    );
    const click = userEvent.setup();
    renderApp('/races/7/registrations');
    await click.click(await screen.findByRole('tab', { name: 'Waitlist (1)' }));

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('On the waitlist since Jan 9')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('search and a filter narrow both tab counts and write the URL', async () => {
    serve(
      response({
        filter_fields: [{ key: 'racer-type', label: 'Team type' }],
        registering: [row({ id: 3, name: 'Doge Pups', answers: { 'racer-type': 'Racer' } })],
      }),
    );
    const click = userEvent.setup();
    const { router } = renderApp('/races/7/registrations');
    await screen.findByText('Doge Sled');

    await click.type(screen.getByRole('searchbox', { name: t('registrations.search') }), 'doge');
    expect(await screen.findByRole('tab', { name: 'Registered (1)' }, { timeout: 1500 })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Still registering (1)' })).toBeInTheDocument();

    await click.selectOptions(screen.getByLabelText('Team type'), 'Racer');
    expect(router.state.location.search).toContain('f_racer-type=Racer');
    expect(router.state.location.search).toContain('q=doge');
  });

  it('has no Filters button or selects when the race has no filter fields', async () => {
    serve(response());
    renderApp('/races/7/registrations');
    await screen.findByText('Doge Sled');
    expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('opens a Filters sheet with the count of active filters', async () => {
    serve(response({ filter_fields: [{ key: 'racer-type', label: 'Team type' }] }));
    const click = userEvent.setup();
    renderApp('/races/7/registrations?f_racer-type=Racer');
    await click.click(await screen.findByRole('button', { name: 'Filters (1)' }));

    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByLabelText('Team type')).toHaveValue('Racer');
    await click.click(within(sheet).getByRole('button', { name: t('registrations.clearFilters') }));
    expect(within(sheet).getByLabelText('Team type')).toHaveValue('');
    await click.click(within(sheet).getByRole('button', { name: t('registrations.done') }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
  });

  it('shows staff columns and per-tab bcc links for an operator', async () => {
    const emails = {
      to: 'dogtag@chiditarod.org',
      finalized: { owners: ['o1@example.com'], racers: ['r1@example.com', 'r2@example.com'] },
      registering: { owners: ['o3@example.com'], racers: [] },
    };
    serve(
      response({
        viewer: { staff: true, can_email: true },
        emails,
        finalized: [
          row({ id: 1, name: 'Doge Sled', can_show: true, staff: staff({ new_team: true }) }),
          row({ id: 2, name: 'Mush Hour', can_show: true, staff: staff({ assigned_team_number: null, payments_paid: 1 }) }),
        ],
        registering: [row({ id: 3, name: 'Late Starters', staff: staff({ payments_paid: 0 }) })],
      }),
      ['operator'],
    );
    const click = userEvent.setup();
    renderApp('/races/7/registrations');
    await screen.findByText('Doge Sled');

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      '#',
      'Team',
      'Experience',
      'Payments',
      'New team',
    ]);
    expect(screen.getAllByText('Team: Twice')).toHaveLength(2);
    expect(screen.getAllByText('Racers: 14')).toHaveLength(2);
    expect(screen.getByText('2 of 2 paid')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 paid')).toBeInTheDocument();
    expect(screen.getAllByText('Jan 8')).toHaveLength(2);
    expect(screen.getByText('New team', { selector: 'span.rounded-full' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Doge Sled' })).toHaveAttribute('href', '/register/teams/1');

    expect(screen.getByRole('link', { name: t('registrations.emailOwners') })).toHaveAttribute(
      'href',
      mailtoHref(emails.to, emails.finalized.owners),
    );
    expect(screen.getByRole('link', { name: t('registrations.emailRacers') })).toHaveAttribute(
      'href',
      mailtoHref(emails.to, emails.finalized.racers),
    );

    await click.click(screen.getByRole('tab', { name: 'Still registering (1)' }));
    expect(screen.getByRole('link', { name: t('registrations.emailOwners') })).toHaveAttribute(
      'href',
      mailtoHref(emails.to, emails.registering.owners),
    );
    // No racers on that tab, so no racers link.
    expect(screen.queryByRole('link', { name: t('registrations.emailRacers') })).toBeNull();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Team',
      'Team experience',
      'Progress',
      'Payments',
      'New team',
    ]);
  });

  it('keeps one cell per column when a staff row has no new-team tag and another row is deletable', async () => {
    serve(
      response({
        viewer: { staff: true, can_email: false },
        finalized: [
          row({ id: 1, name: 'Doge Sled', staff: staff({ new_team: null }) }),
          row({ id: 2, name: 'Mush Hour', deletable: true, staff: staff({ new_team: true }) }),
        ],
      }),
      ['admin'],
    );
    renderApp('/races/7/registrations');
    await screen.findByText('Doge Sled');

    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual([
      '#',
      'Team',
      'Experience',
      'Payments',
      'New team',
      'Actions',
    ]);
    // The first row has no tag and no Delete button; its cells must still line up under the headers.
    for (const rowEl of screen.getAllByRole('row').slice(1)) {
      expect(within(rowEl).getAllByRole('cell')).toHaveLength(headers.length);
    }
    // Hiding an empty cell is for cards only (below sm), never for the table.
    const emptyCells = screen.getAllByRole('cell').filter((cell) => cell.textContent === '');
    expect(emptyCells.length).toBeGreaterThan(0);
    for (const cell of emptyCells) expect(cell.className).toContain('max-sm:empty:hidden');
  });

  it('refunder sees staff columns but no email links', async () => {
    serve(
      response({
        viewer: { staff: true, can_email: false },
        emails: null,
        finalized: [row({ id: 1, name: 'Doge Sled', staff: staff() })],
      }),
      ['refunder'],
    );
    renderApp('/races/7/registrations');
    await screen.findByText('Doge Sled');
    expect(screen.getByText('2 of 2 paid')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /bcc/ })).toBeNull();
  });

  it('deletes a deletable team and refetches the list', async () => {
    let deleted = false;
    serve(() =>
      response({
        finalized: [
          row({ id: 1, name: 'Doge Sled' }),
          ...(deleted ? [] : [row({ id: 2, name: 'Mush Hour', deletable: true })]),
        ],
        registering: [],
      }),
    );
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
      http.delete('/api/v1/teams/2', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const click = userEvent.setup();
    const { router } = renderApp('/races/7/registrations');
    await click.click(await screen.findByRole('button', { name: 'Delete Mush Hour' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Delete Mush Hour?');
    await click.click(screen.getByRole('button', { name: t('team.deleteConfirm') }));

    await waitFor(() => expect(screen.queryByText('Mush Hour')).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Doge Sled')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register/races/7/registrations');
  });

  it('shows Race not found for an unknown race and for a non-numeric id', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user })),
      http.get('/api/v1/races/99/registrations', () =>
        HttpResponse.json({ error: 'not_found', errors: {} }, { status: 404 }),
      ),
    );
    const first = renderApp('/races/99/registrations');
    expect(await screen.findByText(t('registrations.raceNotFound'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('registrations.allRaces') })).toHaveAttribute('href', '/register');
    first.unmount();

    renderApp('/races/abc/registrations');
    expect(await screen.findByText(t('registrations.raceNotFound'))).toBeInTheDocument();
  });

  it('shows an error with a retry for other failures', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user })),
      http.get('/api/v1/races/7/registrations', () =>
        HttpResponse.json({ error: 'boom', errors: {} }, { status: 500 }),
      ),
    );
    renderApp('/races/7/registrations');
    expect(await screen.findByRole('alert')).toHaveTextContent(t('common.genericError'));
    expect(screen.getByRole('button', { name: t('common.retry') })).toBeInTheDocument();
  });

  it('says when no teams match a search', async () => {
    serve(response({ registering: [] }));
    renderApp('/races/7/registrations?q=zzz');
    expect(await screen.findByText(t('registrations.noMatches'))).toBeInTheDocument();
  });

  it('says so when a tab has no teams at all', async () => {
    serve(response({ finalized: [], registering: [] }));
    const click = userEvent.setup();
    renderApp('/races/7/registrations');
    expect(await screen.findByText(t('registrations.emptyRegistered'))).toBeInTheDocument();
    await click.click(screen.getByRole('tab', { name: 'Still registering (0)' }));
    expect(screen.getByText(t('registrations.emptyRegistering'))).toBeInTheDocument();
  });
});
