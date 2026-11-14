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
      within(card).getByText('Registration closes Sat, Feb 20, 2027'),
    ).toBeInTheDocument();
    expect(within(card).getByText(t('races.open'))).toBeInTheDocument();
    expect(
      within(card).getByRole('link', { name: t('races.start') }),
    ).toHaveAttribute('href', '/register/races/1/teams/new');
  });

  it('shows a closed race with the closed badge and no start button', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-03-01T12:00:00Z') });
    mockRaces(buildRace({ open_for_registration: false }));
    renderApp('/');
    expect(await screen.findByText(t('races.closed'))).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t('races.start') })).toBeNull();
  });

  it('shows the waitlist badge and a start button for a full open race', async () => {
    mockRaces(buildRace({ full: true }));
    renderApp('/');
    expect(await screen.findByText(t('races.waitlist'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('races.start') })).toBeInTheDocument();
    expect(screen.queryByText(t('races.open'))).toBeNull();
  });

  it('shows when registration opens for a race that has not opened yet', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-11T12:00:00Z') });
    mockRaces(buildRace({ open_for_registration: false }));
    renderApp('/');
    expect(await screen.findByText('Opens Tue, Dec 1, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t('races.start') })).toBeNull();
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
