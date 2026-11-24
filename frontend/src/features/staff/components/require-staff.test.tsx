import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

const asUser = (roles: string[]) =>
  server.use(http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles } })));

describe('staff routes', () => {
  it('racer sees not allowed at /staff/payments', async () => {
    asUser([]);
    renderApp('/staff/payments');
    expect(await screen.findByRole('heading', { name: t('staff.notAllowed.heading') })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: t('staff.nav') })).not.toBeInTheDocument();
  });

  it('refunder sees the staff nav and Payments heading', async () => {
    asUser(['refunder']);
    renderApp('/staff/payments');
    expect(await screen.findByRole('heading', { name: t('staff.payments.heading') })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: t('staff.nav') });
    expect(nav).toHaveTextContent(t('staff.nav.payments'));
    expect(screen.getByRole('link', { name: t('staff.nav.legacy') })).toHaveAttribute('href', '/users');
  });

  it('logged out is sent to login with the return path', async () => {
    server.use(
      http.get('/api/v1/me', () =>
        HttpResponse.json({ error: 'not_authenticated', errors: {} }, { status: 401 }),
      ),
    );
    const { router } = renderApp('/staff/payments');
    expect(await screen.findByRole('heading', { name: t('login.heading') })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register/login');
    expect(router.state.location.search).toContain(encodeURIComponent('/staff/payments'));
  });

  it('staff see Page not found inside the staff shell for an unknown staff path', async () => {
    asUser(['operator']);
    renderApp('/staff/nope');
    expect(await screen.findByRole('heading', { name: t('notFound.heading') })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: t('staff.nav') })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('max-w-6xl');
  });

  it('racer sees not allowed at an unknown staff path', async () => {
    asUser([]);
    renderApp('/staff/nope');
    expect(await screen.findByRole('heading', { name: t('staff.notAllowed.heading') })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: t('notFound.heading') })).not.toBeInTheDocument();
  });

  it('/staff redirects to /staff/payments', async () => {
    asUser(['admin']);
    const { router } = renderApp('/staff');
    expect(await screen.findByRole('heading', { name: t('staff.payments.heading') })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register/staff/payments');
  });
});
