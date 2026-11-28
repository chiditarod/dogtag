import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/locales/en';
import { buildRace, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

function mockRaces(...races: ReturnType<typeof buildRace>[]) {
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
    http.get('/api/v1/races', () => HttpResponse.json({ races })),
  );
}

afterEach(() => vi.useRealTimers());

describe('RaceList', () => {
  it('shows an open race with date, close date and a start button', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-01-10T12:00:00Z') });
    mockRaces(buildRace());
    renderApp('/');
    const card = (await screen.findByText('CHIditarod 2027')).closest('li')!;
    expect(within(card).getByText('Sat, Mar 6, 2027')).toBeInTheDocument();
    expect(
      within(card).getByText('Registration closes Fri, Feb 19, 2027'),
    ).toBeInTheDocument();
    expect(within(card).getByText(t('races.open'))).toBeInTheDocument();
    expect(
      within(card).getByRole('link', { name: t('races.start') }),
    ).toHaveAttribute('href', '/register/races/1/teams/new');
  });

  it("shows dates in the race's own time zone", async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-01-10T12:00:00Z') });
    mockRaces(
      buildRace({
        time_zone: 'America/Los_Angeles',
        // 00:00 Mar 6 in Chicago, still Mar 5 in Los Angeles.
        race_datetime: '2027-03-06T06:00:00.000Z',
        // Midnight Feb 15 in Los Angeles: a deadline, so shown as Feb 14.
        registration_close: '2027-02-15T08:00:00.000Z',
      }),
    );
    renderApp('/');
    const card = (await screen.findByText('CHIditarod 2027')).closest('li')!;
    expect(within(card).getByText('Fri, Mar 5, 2027')).toBeInTheDocument();
    expect(
      within(card).getByText('Registration closes Sun, Feb 14, 2027'),
    ).toBeInTheDocument();
  });

  it("links each tile to its Who's registered page", async () => {
    mockRaces(
      buildRace({ id: 3 }),
      buildRace({ id: 4, name: 'Other', open_for_registration: false, registration_status: 'closed' }),
    );
    renderApp('/');
    await screen.findByText('CHIditarod 2027');
    const links = screen.getAllByRole('link', { name: t('races.whoRegistered') });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/register/races/3/registrations',
      '/register/races/4/registrations',
    ]);
  });

  it('shows a closed race with the closed badge and no start button', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-03-01T12:00:00Z') });
    mockRaces(buildRace({ open_for_registration: false, registration_status: 'closed' }));
    renderApp('/');
    expect(await screen.findByText(t('races.closed'))).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t('races.start') })).toBeNull();
  });

  it('does not show an Opens date for a closed race whose registration is over', async () => {
    mockRaces(
      buildRace({
        open_for_registration: false,
        registration_status: 'closed',
        // Even with an opening date in the future, the server status decides.
        registration_open: '2099-01-01T06:00:00.000Z',
      }),
    );
    renderApp('/');
    expect(await screen.findByText(t('races.closed'))).toBeInTheDocument();
    expect(screen.queryByText(/^Opens/)).toBeNull();
  });

  it('shows the waitlist badge and a start button for a full open race', async () => {
    mockRaces(buildRace({ full: true, registration_status: 'waitlist' }));
    renderApp('/');
    expect(await screen.findByText(t('races.waitlist'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('races.start') })).toBeInTheDocument();
    expect(screen.queryByText(t('races.open'))).toBeNull();
  });

  it('shows when registration opens for a race that has not opened yet', async () => {
    mockRaces(
      buildRace({ open_for_registration: false, registration_status: 'not_yet_open' }),
    );
    renderApp('/');
    expect(await screen.findByText('Opens Tue, Dec 1, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t('races.start') })).toBeNull();
  });

  it('decides "not yet open" from the server status, not the browser clock', async () => {
    // The browser clock says registration opened long ago; the server says it has not.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2030-01-01T12:00:00Z') });
    mockRaces(
      buildRace({ open_for_registration: false, registration_status: 'not_yet_open' }),
    );
    renderApp('/');
    expect(await screen.findByText('Opens Tue, Dec 1, 2026')).toBeInTheDocument();
  });

  it('renders races in the order the server sends them', async () => {
    mockRaces(
      buildRace({ id: 3, name: 'Third by date' }),
      buildRace({ id: 1, name: 'First by date' }),
      buildRace({ id: 2, name: 'Second by date' }),
    );
    renderApp('/');
    await screen.findByText('Third by date');
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Third by date', 'First by date', 'Second by date']);
  });

  it('shows an error with a retry button', async () => {
    let calls = 0;
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user })),
      http.get('/api/v1/races', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: 'server_error', errors: {} }, { status: 500 })
          : HttpResponse.json({ races: [buildRace()] });
      }),
    );
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent(t('common.genericError'));
    await userEvent.click(screen.getByRole('button', { name: t('common.retry') }));
    expect(await screen.findByText('CHIditarod 2027')).toBeInTheDocument();
  });
});
