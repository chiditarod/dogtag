import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '@/lib/api-client';
import { t } from '@/locales/en';
import { buildRace, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

beforeEach(() => {
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
    http.get('/api/v1/races', () => HttpResponse.json({ races: [buildRace()] })),
  );
});
afterEach(() => clearCsrfToken());

describe('FeedbackLink', () => {
  it('sends the message with the page and browser', async () => {
    let body: unknown;
    server.use(
      http.post('/api/v1/feedback', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: t('feedback.open') }));
    await userEvent.type(screen.getByLabelText(t('feedback.message')), 'The fee button is stuck');
    await userEvent.click(screen.getByRole('button', { name: t('feedback.send') }));

    expect(await screen.findByText(t('feedback.thanks'))).toBeInTheDocument();
    expect(body).toMatchObject({
      message: 'The fee button is stuck',
      context: { path: expect.any(String), user_agent: expect.any(String) },
    });
  });

  it('shows an error and keeps the message when sending fails', async () => {
    server.use(
      http.post('/api/v1/feedback', () =>
        HttpResponse.json({ error: 'server_error', errors: {} }, { status: 500 }),
      ),
    );
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: t('feedback.open') }));
    await userEvent.type(screen.getByLabelText(t('feedback.message')), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: t('feedback.send') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('common.genericError'));
    expect(screen.getByLabelText(t('feedback.message'))).toHaveValue('Hello');
  });
});
