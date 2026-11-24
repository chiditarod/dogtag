import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
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
});
