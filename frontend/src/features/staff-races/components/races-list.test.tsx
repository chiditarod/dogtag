import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import { staffRaceSummary } from '../test-fixtures';
import type { StaffRaceSummary } from '../api/types';

function serve(races: StaffRaceSummary[], roles = ['operator']) {
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles } })),
    http.get('/api/v1/staff/races', () => HttpResponse.json({ races })),
  );
}

const rows = () => within(screen.getByRole('table', { name: t('staff.races.list') })).getAllByRole('row');

describe('staff races list', () => {
  it('lists races in API order with setup problems and a link to each race', async () => {
    serve([
      staffRaceSummary({ id: 7, name: 'CHIditarod 2027', setup_problems: ['No fee set up'] }),
      staffRaceSummary({
        id: 3,
        name: 'CHIditarod 2026',
        registration_status: 'closed',
        teams: { finalized: 80, total: 80 },
      }),
    ]);
    renderApp('/staff/races');

    expect(await screen.findByRole('heading', { name: t('staff.races.heading') })).toBeInTheDocument();
    await screen.findByRole('table', { name: t('staff.races.list') });
    const [header, first, second] = rows();
    expect(within(header).getAllByRole('columnheader')).toHaveLength(5);
    expect(within(first).getByRole('link', { name: 'CHIditarod 2027' })).toHaveAttribute(
      'href',
      '/register/staff/races/7',
    );
    expect(within(second).getByRole('link', { name: 'CHIditarod 2026' })).toHaveAttribute(
      'href',
      '/register/staff/races/3',
    );
    expect(within(first).getByText('No fee set up')).toHaveClass('text-starText');
    expect(within(first).queryByText(t('staff.races.ready'))).not.toBeInTheDocument();
    expect(within(second).getByText(t('staff.races.ready'))).toBeInTheDocument();
    expect(screen.getByText(t('staff.races.caption'))).toBeInTheDocument();
  });

  it('shows the race day, status with its deadline, and the team counts', async () => {
    serve([
      staffRaceSummary({ id: 1, teams: { finalized: 40, total: 52 } }),
      staffRaceSummary({
        id: 2,
        name: 'Next Year',
        registration_status: 'not_yet_open',
        registration_open: '2027-12-07T18:00:00Z',
        teams: { finalized: 0, total: 0 },
      }),
      staffRaceSummary({ id: 3, name: 'Past', registration_status: 'closed', max_teams: null, teams: { finalized: 5, total: 5 } }),
      staffRaceSummary({ id: 4, name: 'Full', registration_status: 'waitlist' }),
    ]);
    renderApp('/staff/races');
    await screen.findByRole('table', { name: t('staff.races.list') });
    const [, open, notYet, closed, waitlist] = rows();

    expect(within(open).getByText('Sat, Mar 13, 2027')).toBeInTheDocument();
    expect(within(open).getByText(t('races.open'))).toBeInTheDocument();
    expect(within(open).getByText(/closes Mon, Feb 1, 2027/)).toBeInTheDocument();
    expect(within(open).getByText(/40 of 100 registered/)).toBeInTheDocument();
    expect(within(open).getByText('12 still registering')).toBeInTheDocument();

    expect(within(notYet).getByText(t('staff.races.notYetOpen'))).toBeInTheDocument();
    expect(within(notYet).getByText(/opens Tue, Dec 7, 2027/)).toBeInTheDocument();
    expect(within(notYet).queryByText(/still registering/)).not.toBeInTheDocument();

    expect(within(closed).getByText(t('races.closed'))).toBeInTheDocument();
    expect(within(closed).queryByText(/closes|opens/)).not.toBeInTheDocument();
    expect(within(closed).getByText(/5 registered/)).toBeInTheDocument();
    expect(within(waitlist).getByText(t('races.waitlist'))).toBeInTheDocument();
  });

  it('has a New race button, and an empty message with no races', async () => {
    serve([]);
    renderApp('/staff/races');
    expect(await screen.findByText(t('staff.races.empty'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('staff.races.new') })).toHaveAttribute(
      'href',
      '/register/staff/races/new',
    );
  });

  it('offers a retry when the list fails to load', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['operator'] } })),
      http.get('/api/v1/staff/races', () => HttpResponse.json({ error: 'boom', errors: {} }, { status: 500 })),
    );
    renderApp('/staff/races');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
