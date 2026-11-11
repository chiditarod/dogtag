import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { t } from '@/locales/en';
import { buildChecklist, buildRace, buildTeam, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

function mockTeams(teams: ReturnType<typeof buildTeam>[]) {
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
    http.get('/api/v1/teams', () => HttpResponse.json({ teams })),
  );
}

describe('MyTeams', () => {
  it('lists teams with race name, remaining count and a link', async () => {
    mockTeams([
      buildTeam({ id: 9 }),
      buildTeam({
        id: 10,
        name: 'Done Team',
        race: buildRace({ id: 2, name: 'CHIditarod 2026' }),
        checklist: buildChecklist({ finalized: true, remaining: 0, team_number: 42 }),
      }),
    ]);
    renderApp('/teams');
    const first = (await screen.findByText('Cart Pushers')).closest('li')!;
    expect(within(first).getByText('CHIditarod 2027')).toBeInTheDocument();
    expect(within(first).getByText('2 things left')).toBeInTheDocument();
    expect(within(first).getByRole('link')).toHaveAttribute('href', '/register/teams/9');
    const second = screen.getByText('Done Team').closest('li')!;
    expect(within(second).getByText("You're in! Team #42")).toBeInTheDocument();
  });

  it('uses the singular for one thing left', async () => {
    mockTeams([buildTeam({ checklist: buildChecklist({ remaining: 1 }) })]);
    renderApp('/teams');
    expect(await screen.findByText('1 thing left')).toBeInTheDocument();
  });

  it('shows an empty state linking to the race list', async () => {
    mockTeams([]);
    renderApp('/teams');
    expect(await screen.findByText(t('teams.empty'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('teams.emptyLink') })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('shows an error with retry', async () => {
    let calls = 0;
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user })),
      http.get('/api/v1/teams', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: 'server_error', errors: {} }, { status: 500 })
          : HttpResponse.json({ teams: [buildTeam()] });
      }),
    );
    renderApp('/teams');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t('common.retry') }));
    expect(await screen.findByText('Cart Pushers')).toBeInTheDocument();
  });
});
