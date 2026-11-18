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
  it('is not offered to someone who is logged out', async () => {
    server.use(
      http.get('/api/v1/me', () =>
        HttpResponse.json({ error: 'not_authenticated', errors: {} }, { status: 401 }),
      ),
    );
    renderApp('/');

    expect(await screen.findByRole('link', { name: t('layout.login') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('feedback.open') })).not.toBeInTheDocument();
  });

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

  it('moves focus to Close once the message is sent', async () => {
    server.use(http.post('/api/v1/feedback', () => HttpResponse.json({}, { status: 201 })));
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: t('feedback.open') }));
    await userEvent.type(screen.getByLabelText(t('feedback.message')), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: t('feedback.send') }));

    const close = await screen.findByRole('button', { name: t('feedback.close') });
    expect(close).toHaveFocus();
  });

  it('says so when too many reports were sent, and keeps the message', async () => {
    server.use(
      http.post('/api/v1/feedback', () =>
        HttpResponse.json({ error: 'rate_limited', errors: {} }, { status: 429 }),
      ),
    );
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: t('feedback.open') }));
    await userEvent.type(screen.getByLabelText(t('feedback.message')), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: t('feedback.send') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('feedback.rateLimited'));
    expect(screen.queryByText(t('common.genericError'))).not.toBeInTheDocument();
    expect(screen.getByLabelText(t('feedback.message'))).toHaveValue('Hello');
  });

  it('closes at once when nothing was typed', async () => {
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: t('feedback.open') }));
    await userEvent.click(screen.getByRole('button', { name: t('feedback.cancel') }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before discarding a typed message, on Cancel and on Escape', async () => {
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: t('feedback.open') }));
    await userEvent.type(screen.getByLabelText(t('feedback.message')), 'A long story');

    await userEvent.click(screen.getByRole('button', { name: t('feedback.cancel') }));
    expect(screen.getByText(t('feedback.discardPrompt'))).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t('feedback.keepWriting') }));
    expect(screen.queryByText(t('feedback.discardPrompt'))).not.toBeInTheDocument();
    expect(screen.getByLabelText(t('feedback.message'))).toHaveValue('A long story');

    await userEvent.keyboard('{Escape}');
    expect(screen.getByText(t('feedback.discardPrompt'))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t('feedback.discard') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
