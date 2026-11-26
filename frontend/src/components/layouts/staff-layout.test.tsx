import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

describe('StaffLayout', () => {
  it('shows the logo, user menu and a wide container', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['operator'] } })),
    );
    renderApp('/staff/payments');
    await screen.findByRole('heading', { name: t('staff.payments.heading') });
    expect(screen.getByAltText(t('layout.logoAlt'))).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('max-w-6xl');
    expect(screen.getByRole('button', { name: t('layout.logout') })).toBeInTheDocument();
  });

  it('leaves the Staff link out of the user menu (the staff nav replaces it)', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['refunder'] } })),
    );
    renderApp('/staff/payments');
    await screen.findByRole('heading', { name: t('staff.payments.heading') });
    const userMenu = screen.getByRole('navigation', { name: t('layout.userMenu') });
    expect(within(userMenu).getByRole('link', { name: t('layout.myTeams') })).toBeInTheDocument();
    expect(within(userMenu).queryByRole('link', { name: t('layout.staff') })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t('layout.staff') })).not.toBeInTheDocument();
  });

  it('shows Races and Payments to an operator', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['operator'] } })),
    );
    renderApp('/staff/payments');
    await screen.findByRole('heading', { name: t('staff.payments.heading') });
    const nav = screen.getByRole('navigation', { name: t('staff.nav') });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual([
      t('staff.nav.races'),
      t('staff.nav.payments'),
      t('staff.nav.legacy'),
    ]);
    expect(within(nav).getByRole('link', { name: t('staff.nav.races') })).toHaveAttribute(
      'href',
      '/register/staff/races',
    );
  });

  it('hides Races from a refunder', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['refunder'] } })),
    );
    renderApp('/staff/payments');
    await screen.findByRole('heading', { name: t('staff.payments.heading') });
    const nav = screen.getByRole('navigation', { name: t('staff.nav') });
    expect(within(nav).queryByRole('link', { name: t('staff.nav.races') })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: t('staff.nav.payments') })).toBeInTheDocument();
  });

  it('sends a refunder from /staff to Payments', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['refunder'] } })),
    );
    renderApp('/staff');
    expect(await screen.findByRole('heading', { name: t('staff.payments.heading') })).toBeInTheDocument();
  });

  it('sends an operator from /staff to the first nav item (Races)', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['operator'] } })),
    );
    const { router } = renderApp('/staff');
    await screen.findByRole('navigation', { name: t('staff.nav') });
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/register/staff/races'));
  });
});
