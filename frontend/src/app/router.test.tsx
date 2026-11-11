import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { routes, BASENAME } from '@/app/router';
import { AppProvider } from '@/app/provider';
import { t } from '@/locales/en';
import { buildRace, buildTeam } from '@/test/fixtures';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, {
    basename: BASENAME,
    initialEntries: [path],
  });
  return render(
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>,
  );
}

const user = { id: 1, first_name: 'Ada', last_name: 'L', email: 'a@example.com', phone: null };

describe('router', () => {
  beforeEach(() => {
    // Logged in, so guarded routes render.
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user })),
      http.get('/api/v1/races', () => HttpResponse.json({ races: [] })),
      http.get('/api/v1/races/1', () => HttpResponse.json({ race: buildRace() })),
      http.get('/api/v1/teams', () => HttpResponse.json({ teams: [] })),
      http.get('/api/v1/teams/5', () => HttpResponse.json({ team: buildTeam({ id: 5 }) })),
    );
  });

  it('shows the race list heading at /register/', () => {
    renderAt('/register/');
    expect(
      screen.getByRole('heading', { name: t('races.heading') }),
    ).toBeInTheDocument();
  });

  it('renders the shared layout with the logo', () => {
    renderAt('/register/');
    expect(screen.getByAltText(t('layout.logoAlt'))).toBeInTheDocument();
  });

  it.each([
    ['/register/login', 'login.heading'],
    ['/register/signup', 'signup.heading'],
    ['/register/forgot-password', 'forgotPassword.heading'],
    ['/register/races/1/teams/new', 'teams.newHeading'],
    ['/register/teams', 'teams.listHeading'],
  ] as const)('routes %s', async (path, key) => {
    renderAt(path);
    expect(
      await screen.findByRole('heading', { name: t(key) }),
    ).toBeInTheDocument();
  });

  it('routes /register/teams/5 to the team checklist', async () => {
    renderAt('/register/teams/5');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' }),
    ).toBeInTheDocument();
  });

  it('shows not found for unknown paths', () => {
    renderAt('/register/nope/nothing');
    expect(
      screen.getByRole('heading', { name: t('notFound.heading') }),
    ).toBeInTheDocument();
  });
});
