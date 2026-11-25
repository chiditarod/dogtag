import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

const asUser = (roles: string[]) =>
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles } })),
    http.get('/api/v1/races', () => HttpResponse.json({ races: [] })),
    http.get('/api/v1/teams', () => HttpResponse.json({ teams: [] })),
  );

describe('UserMenu', () => {
  it('shows Staff only to staff', async () => {
    asUser([]);
    const first = renderApp('/');
    await screen.findByText(user.first_name);
    expect(screen.queryByRole('link', { name: t('layout.staff') })).not.toBeInTheDocument();
    first.unmount();

    asUser(['refunder']);
    renderApp('/');
    expect(await screen.findByRole('link', { name: t('layout.staff') })).toHaveAttribute(
      'href',
      '/register/staff/payments',
    );
  });

  it('shows an Account link for logged-in users', async () => {
    asUser([]);
    renderApp('/');
    expect(await screen.findByRole('link', { name: t('layout.account') })).toHaveAttribute(
      'href',
      '/register/account',
    );
  });
});
