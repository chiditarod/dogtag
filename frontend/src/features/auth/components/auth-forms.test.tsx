import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '@/lib/api-client';
import { t } from '@/locales/en';
import { server } from '@/test/server';
import { renderApp } from '@/test/render-app';

const user = { id: 1, first_name: 'Ada', last_name: 'L', email: 'ada@example.com', phone: '3125550100' };
const notAuthenticated = () =>
  HttpResponse.json({ error: 'not_authenticated', errors: {} }, { status: 401 });

beforeEach(() => {
  server.use(http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })));
});
afterEach(() => clearCsrfToken());

describe('LoginForm', () => {
  it('shows an incorrect-credentials message on a server 422', async () => {
    server.use(
      http.get('/api/v1/me', notAuthenticated),
      http.post('/api/v1/session', () =>
        HttpResponse.json({ error: 'login_failed', errors: {} }, { status: 422 }),
      ),
    );
    renderApp('/login');
    await userEvent.type(screen.getByLabelText(t('auth.email')), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(t('auth.password')), 'nope');
    await userEvent.click(screen.getByRole('button', { name: t('login.submit') }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('sends credentials, then lands on /teams', async () => {
    let body: unknown;
    server.use(
      http.get('/api/v1/me', notAuthenticated),
      http.post('/api/v1/session', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user });
      }),
    );
    const { router } = renderApp('/login');
    await userEvent.type(screen.getByLabelText(t('auth.email')), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(t('auth.password')), 'secret');
    await userEvent.click(screen.getByLabelText(t('auth.rememberMe')));
    await userEvent.click(screen.getByRole('button', { name: t('login.submit') }));
    expect(
      await screen.findByRole('heading', { name: t('teams.listHeading') }),
    ).toBeInTheDocument();
    expect(body).toEqual({ email: 'ada@example.com', password: 'secret', remember_me: true });
    expect(router.state.location.pathname).toBe('/register/teams');
  });
});

describe('SignupForm', () => {
  it('shows the server field error under Email', async () => {
    server.use(
      http.get('/api/v1/me', notAuthenticated),
      http.post('/api/v1/users', () =>
        HttpResponse.json(
          { error: 'invalid', errors: { email: ['has already been taken'] } },
          { status: 422 },
        ),
      ),
    );
    renderApp('/signup');
    await userEvent.type(screen.getByLabelText(t('signup.firstName')), 'Ada');
    await userEvent.type(screen.getByLabelText(t('signup.lastName')), 'L');
    await userEvent.type(screen.getByLabelText(t('auth.email')), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(t('signup.phone')), '3125550100');
    await userEvent.type(screen.getByLabelText(t('auth.password')), 'secret123');
    await userEvent.type(screen.getByLabelText(t('signup.passwordConfirmation')), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: t('signup.submit') }));

    const email = await screen.findByLabelText(t('auth.email'));
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    const describedBy = email.getAttribute('aria-describedby')!;
    expect(document.getElementById(describedBy)).toHaveTextContent('has already been taken');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('logs in and navigates home after success', async () => {
    let me = false;
    server.use(
      http.get('/api/v1/me', () => (me ? HttpResponse.json({ user }) : notAuthenticated())),
      http.get('/api/v1/races', () => HttpResponse.json({})),
      http.post('/api/v1/users', () => {
        me = true;
        return HttpResponse.json({ user }, { status: 201 });
      }),
    );
    const { router } = renderApp('/signup');
    for (const [label, value] of [
      [t('signup.firstName'), 'Ada'],
      [t('signup.lastName'), 'L'],
      [t('auth.email'), 'ada@example.com'],
      [t('signup.phone'), '3125550100'],
      [t('auth.password'), 'secret123'],
      [t('signup.passwordConfirmation'), 'secret123'],
    ]) {
      await userEvent.type(screen.getByLabelText(label), value);
    }
    await userEvent.click(screen.getByRole('button', { name: t('signup.submit') }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/register'));
    expect(await screen.findByText('Ada')).toBeInTheDocument();
  });
});

describe('ForgotPasswordForm', () => {
  it('shows the generic success message', async () => {
    server.use(
      http.get('/api/v1/me', notAuthenticated),
      http.post('/api/v1/password_resets', () => new HttpResponse(null, { status: 202 })),
    );
    renderApp('/forgot-password');
    await userEvent.type(screen.getByLabelText(t('auth.email')), 'who@example.com');
    await userEvent.click(screen.getByRole('button', { name: t('forgotPassword.submit') }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      "If an account exists for that email, we've sent a reset link.",
    );
  });
});

describe('RequireAuth', () => {
  it('redirects to /login?next=… and returns to the page after login', async () => {
    let me = false;
    server.use(
      http.get('/api/v1/me', () => (me ? HttpResponse.json({ user }) : notAuthenticated())),
      http.post('/api/v1/session', () => {
        me = true;
        return HttpResponse.json({ user });
      }),
    );
    const { router } = renderApp('/teams/5');
    await screen.findByRole('heading', { name: t('login.heading') });
    expect(router.state.location.pathname).toBe('/register/login');
    expect(router.state.location.search).toBe('?next=%2Fteams%2F5');

    await userEvent.type(screen.getByLabelText(t('auth.email')), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(t('auth.password')), 'secret');
    await userEvent.click(screen.getByRole('button', { name: t('login.submit') }));

    expect(
      await screen.findByRole('heading', { name: t('teams.checklistHeading') }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register/teams/5');
  });

  it('ignores an off-site next param', async () => {
    server.use(
      http.get('/api/v1/me', notAuthenticated),
      http.post('/api/v1/session', () => HttpResponse.json({ user })),
    );
    const { router } = renderApp('/login?next=%2F%2Fevil.example');
    await userEvent.type(screen.getByLabelText(t('auth.email')), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(t('auth.password')), 'secret');
    await userEvent.click(screen.getByRole('button', { name: t('login.submit') }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/register/teams'));
  });
});

describe('UserMenu', () => {
  it('shows Log in when logged out', async () => {
    server.use(http.get('/api/v1/me', notAuthenticated));
    renderApp('/forgot-password');
    expect(await screen.findByRole('link', { name: t('layout.login') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('layout.logout') })).not.toBeInTheDocument();
  });

  it('shows name, My teams and Log out when logged in; logout clears the cache and goes home', async () => {
    let me = true;
    server.use(
      http.get('/api/v1/me', () => (me ? HttpResponse.json({ user }) : notAuthenticated())),
      http.delete('/api/v1/session', () => {
        me = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router, queryClient } = renderApp('/forgot-password');
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('layout.myTeams') })).toBeInTheDocument();
    queryClient.setQueryData(['other'], 'cached');

    await userEvent.click(screen.getByRole('button', { name: t('layout.logout') }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/register'));
    expect(queryClient.getQueryData(['other'])).toBeUndefined();
    expect(await screen.findByRole('link', { name: t('layout.login') })).toBeInTheDocument();
    expect(screen.queryByText('Ada')).not.toBeInTheDocument();
  });
});
