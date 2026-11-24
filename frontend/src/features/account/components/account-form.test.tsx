import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '@/lib/api-client';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

const me = { ...user, first_name: 'Ada', last_name: 'Racer', phone: '312-555-0100' };

beforeEach(() => {
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user: me })),
  );
});
afterEach(() => clearCsrfToken());

async function renderAccount() {
  const utils = renderApp('/account');
  await screen.findByRole('heading', { name: t('account.heading') });
  return utils;
}

describe('AccountForm', () => {
  it('prefills the form from me', async () => {
    await renderAccount();
    expect(await screen.findByLabelText(t('signup.firstName'))).toHaveValue('Ada');
    expect(screen.getByLabelText(t('signup.lastName'))).toHaveValue('Racer');
    expect(screen.getByLabelText(t('auth.email'))).toHaveValue('ada@example.com');
    expect(screen.getByLabelText(t('signup.phone'))).toHaveValue('(312) 555-0100');
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('sends the current password and shows Saved', async () => {
    let body: unknown;
    server.use(
      http.patch('/api/v1/me', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user: { ...me, phone: '312-555-0142' } });
      }),
    );
    await renderAccount();
    const phone = await screen.findByLabelText(t('signup.phone'));
    await userEvent.clear(phone);
    await userEvent.type(phone, '3125550142');
    await userEvent.type(screen.getByLabelText(t('account.currentPassword')), 'hunter22');
    await userEvent.click(screen.getByRole('button', { name: t('account.save') }));

    expect(await screen.findByRole('status')).toHaveTextContent(t('account.saved'));
    expect(body).toEqual({
      user: {
        first_name: 'Ada',
        last_name: 'Racer',
        email: 'ada@example.com',
        phone: '312-555-0142',
        password: '',
        password_confirmation: '',
      },
      current_password: 'hunter22',
    });
    expect(screen.getByLabelText(t('signup.phone'))).toHaveValue('(312) 555-0142');
  });

  it('shows the server error under Current password', async () => {
    server.use(
      http.patch('/api/v1/me', () =>
        HttpResponse.json(
          { error: 'invalid', errors: { current_password: ['is not correct'] } },
          { status: 422 },
        ),
      ),
    );
    await renderAccount();
    const current = await screen.findByLabelText(t('account.currentPassword'));
    await userEvent.type(current, 'wrong');
    await userEvent.click(screen.getByRole('button', { name: t('account.save') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('account.checkFields'));
    const described = (current.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    expect(described).toContain('is not correct');
    expect(current).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears the password fields after a save', async () => {
    server.use(http.patch('/api/v1/me', () => HttpResponse.json({ user: me })));
    await renderAccount();
    await userEvent.type(await screen.findByLabelText(t('account.newPassword')), 'newsecret1');
    await userEvent.type(screen.getByLabelText(t('account.confirmPassword')), 'newsecret1');
    await userEvent.type(screen.getByLabelText(t('account.currentPassword')), 'hunter22');
    await userEvent.click(screen.getByRole('button', { name: t('account.save') }));

    await screen.findByText(t('account.saved'));
    await waitFor(() =>
      expect(screen.getByLabelText(t('account.newPassword'))).toHaveValue(''),
    );
    expect(screen.getByLabelText(t('account.confirmPassword'))).toHaveValue('');
    expect(screen.getByLabelText(t('account.currentPassword'))).toHaveValue('');
  });

  it('links Forgot it? to /forgot-password', async () => {
    await renderAccount();
    expect(await screen.findByRole('link', { name: t('account.forgot') })).toHaveAttribute(
      'href',
      '/register/forgot-password',
    );
  });
});
