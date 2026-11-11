import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { routes, BASENAME } from '@/app/router';
import { AppProvider } from '@/app/provider';
import { t } from '@/locales/en';

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
    server.use(http.get('/api/v1/me', () => HttpResponse.json({ user })));
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
    ['/register/teams/5', 'teams.checklistHeading'],
  ] as const)('routes %s', async (path, key) => {
    renderAt(path);
    expect(
      await screen.findByRole('heading', { name: t(key) }),
    ).toBeInTheDocument();
  });

  it('shows not found for unknown paths', () => {
    renderAt('/register/nope/nothing');
    expect(
      screen.getByRole('heading', { name: t('notFound.heading') }),
    ).toBeInTheDocument();
  });
});
