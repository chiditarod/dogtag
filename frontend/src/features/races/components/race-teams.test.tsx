import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { t } from '@/locales/en';
import { buildChecklist, buildRace, buildTeam, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

const raceOne = buildRace({ id: 1, name: 'Race One' });
const raceTwo = buildRace({ id: 2, name: 'Race Two' });

function mockLoggedIn(
  races: ReturnType<typeof buildRace>[],
  teams: ReturnType<typeof buildTeam>[],
) {
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
    http.get('/api/v1/races', () => HttpResponse.json({ races })),
    http.get('/api/v1/teams', () => HttpResponse.json({ teams })),
  );
}

async function tileFor(name: string) {
  return (await screen.findByText(name)).closest('li')!;
}

describe('RaceList: your teams', () => {
  it("shows the racer's team under its own race with a status chip, and nowhere else", async () => {
    mockLoggedIn(
      [raceOne, raceTwo],
      [buildTeam({ id: 9, name: 'Cart Pushers', race: raceOne })],
    );
    renderApp('/');

    const tile = await tileFor('Race One');
    expect(await within(tile).findByText(t('races.yourTeams'))).toBeInTheDocument();
    expect(within(tile).getByRole('link', { name: /Cart Pushers/ })).toHaveAttribute(
      'href',
      '/register/teams/9',
    );
    expect(within(tile).getByText('2 things left')).toBeInTheDocument();

    const other = await tileFor('Race Two');
    expect(within(other).queryByText(t('races.yourTeams'))).toBeNull();
    expect(within(other).queryByText('Cart Pushers')).toBeNull();
  });

  it('shows a finalized team with its number', async () => {
    mockLoggedIn(
      [raceOne],
      [
        buildTeam({
          id: 10,
          name: 'Done Team',
          race: raceOne,
          checklist: buildChecklist({ finalized: true, remaining: 0, team_number: 42 }),
        }),
      ],
    );
    renderApp('/');

    const tile = await tileFor('Race One');
    expect(await within(tile).findByText('Finalized #42')).toBeInTheDocument();
  });

  it('says "Start another team" when the racer already has a team in an open race', async () => {
    mockLoggedIn([raceOne, raceTwo], [buildTeam({ race: raceOne })]);
    renderApp('/');

    const withTeam = await tileFor('Race One');
    expect(
      await within(withTeam).findByRole('link', { name: t('races.startAnother') }),
    ).toBeInTheDocument();

    const without = await tileFor('Race Two');
    expect(within(without).getByRole('link', { name: t('races.start') })).toBeInTheDocument();
    expect(within(without).queryByRole('link', { name: t('races.startAnother') })).toBeNull();
  });

  it('still shows a team in a closed race, with no start button there', async () => {
    const closed = buildRace({
      id: 3,
      name: 'Race Closed',
      open_for_registration: false,
      registration_status: 'closed',
    });
    mockLoggedIn([closed], [buildTeam({ id: 11, name: 'Late Carts', race: closed })]);
    renderApp('/');

    const tile = await tileFor('Race Closed');
    expect(await within(tile).findByRole('link', { name: /Late Carts/ })).toBeInTheDocument();
    expect(within(tile).queryByRole('link', { name: /Start/ })).toBeNull();
  });

  it('shows no teams list and does not ask for teams when logged out', async () => {
    let teamsRequested = false;
    server.use(
      http.get('/api/v1/me', () =>
        HttpResponse.json({ error: 'Not logged in', errors: {} }, { status: 401 }),
      ),
      http.get('/api/v1/races', () => HttpResponse.json({ races: [raceOne] })),
      http.get('/api/v1/teams', () => {
        teamsRequested = true;
        return HttpResponse.json({ teams: [] });
      }),
    );
    renderApp('/');

    const tile = await tileFor('Race One');
    expect(within(tile).getByRole('link', { name: t('races.start') })).toBeInTheDocument();
    expect(screen.queryByText(t('races.yourTeams'))).toBeNull();
    await waitFor(() => expect(teamsRequested).toBe(false));
  });

  it('still renders the races when the teams request fails', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user })),
      http.get('/api/v1/races', () => HttpResponse.json({ races: [raceOne, raceTwo] })),
      http.get('/api/v1/teams', () =>
        HttpResponse.json({ error: 'server_error', errors: {} }, { status: 500 }),
      ),
    );
    renderApp('/');

    expect(await tileFor('Race One')).toBeInTheDocument();
    expect(await tileFor('Race Two')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(t('races.yourTeams'))).toBeNull();
  });
});
