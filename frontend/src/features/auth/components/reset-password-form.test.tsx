import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '@/lib/api-client';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

const notAuthenticated = () =>
  HttpResponse.json({ error: 'not_authenticated', errors: {} }, { status: 401 });
const notFound = () => HttpResponse.json({ error: 'not_found', errors: {} }, { status: 404 });

beforeEach(() => {
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', notAuthenticated),
    http.get('/api/v1/teams', () => HttpResponse.json({ teams: [] })),
    http.get('/api/v1/races', () => HttpResponse.json({ races: [] })),
  );
});
afterEach(() => clearCsrfToken());

async function fillAndSubmit(password: string, confirmation: string) {
  await userEvent.type(await screen.findByLabelText(t('resetPassword.newPassword')), password);
  await userEvent.type(screen.getByLabelText(t('resetPassword.confirm')), confirmation);
  await userEvent.click(screen.getByRole('button', { name: t('resetPassword.submit') }));
}

const validToken = () =>
  http.get('/api/v1/password_resets/tok123', () => HttpResponse.json({ email: 'ada@example.com' }));

describe('ResetPasswordForm', () => {
  it('shows the account email from the token', async () => {
    server.use(validToken());
    renderApp('/reset-password/tok123');
    expect(
      await screen.findByRole('heading', { name: t('resetPassword.heading') }),
    ).toBeInTheDocument();
    expect(screen.getByText('For ada@example.com')).toBeInTheDocument();
    expect(screen.getByText(t('resetPassword.help'))).toBeInTheDocument();
  });

  it('shows the expired state on a 404 before any typing', async () => {
    server.use(http.get('/api/v1/password_resets/tok123', notFound));
    renderApp('/reset-password/tok123');
    expect(
      await screen.findByRole('heading', { name: t('resetPassword.expiredHeading') }),
    ).toBeInTheDocument();
    expect(screen.getByText(t('resetPassword.expiredBody'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('resetPassword.newLink') })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/forgot-password$/),
    );
    expect(screen.queryByLabelText(t('resetPassword.newPassword'))).not.toBeInTheDocument();
  });

  it('flags mismatched passwords without calling the server', async () => {
    let puts = 0;
    server.use(
      validToken(),
      http.put('/api/v1/password_resets/tok123', () => {
        puts += 1;
        return HttpResponse.json({ user });
      }),
    );
    renderApp('/reset-password/tok123');
    await fillAndSubmit('hunter2222', 'hunter3333');
    expect(await screen.findByText(t('resetPassword.mismatch'))).toBeInTheDocument();
    expect(screen.getByLabelText(t('resetPassword.confirm'))).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(puts).toBe(0);
  });

  it('saves, logs in and lands on My teams with a notice', async () => {
    let body: unknown;
    server.use(
      validToken(),
      http.put('/api/v1/password_resets/tok123', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user });
      }),
    );
    const { router, queryClient } = renderApp('/reset-password/tok123');
    queryClient.setQueryData(['teams', 'someone-else'], { teams: [{ id: 99 }] });
    await fillAndSubmit('hunter2222', 'hunter2222');
    expect(
      await screen.findByRole('heading', { name: t('teams.listHeading') }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register/teams');
    const notice = await screen.findByText(t('teams.passwordChanged'));
    expect(notice).toHaveAttribute('role', 'status');
    expect(body).toEqual({ password: 'hunter2222', password_confirmation: 'hunter2222' });
    // The previous session's cache is gone, and a reload would not show the notice again.
    expect(queryClient.getQueryData(['teams', 'someone-else'])).toBeUndefined();
    await waitFor(() => expect(router.state.location.state).toBeNull());
    expect(screen.getByText(t('teams.passwordChanged'))).toBeInTheDocument();
  });

  it('shows server field errors', async () => {
    server.use(
      validToken(),
      http.put('/api/v1/password_resets/tok123', () =>
        HttpResponse.json(
          { error: 'invalid', errors: { password: ['is too short (minimum is 8 characters)'] } },
          { status: 422 },
        ),
      ),
    );
    renderApp('/reset-password/tok123');
    await fillAndSubmit('short', 'short');
    expect(await screen.findByText('is too short (minimum is 8 characters)')).toBeInTheDocument();
    expect(screen.getByLabelText(t('resetPassword.newPassword'))).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows a non-field error from the server', async () => {
    server.use(
      validToken(),
      http.put('/api/v1/password_resets/tok123', () =>
        HttpResponse.json(
          { error: 'invalid', errors: { base: ['We could not log you in.'] } },
          { status: 422 },
        ),
      ),
    );
    renderApp('/reset-password/tok123');
    await fillAndSubmit('hunter2222', 'hunter2222');
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not log you in.');
  });

  it('shows the expired state if the PUT 404s', async () => {
    server.use(validToken(), http.put('/api/v1/password_resets/tok123', notFound));
    renderApp('/reset-password/tok123');
    await fillAndSubmit('hunter2222', 'hunter2222');
    expect(
      await screen.findByRole('heading', { name: t('resetPassword.expiredHeading') }),
    ).toBeInTheDocument();
  });
});
