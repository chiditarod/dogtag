import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '@/lib/api-client';
import { t } from '@/locales/en';
import { buildRace, buildTeam, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

let deletes: number;

function serve(team = buildTeam(), deleteStatus = 204) {
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/teams/9', () => HttpResponse.json({ team })),
    http.get('/api/v1/teams', () => HttpResponse.json({ teams: [] })),
    http.get('/api/v1/teams/9/past_racers', () => HttpResponse.json({ past_racers: [] })),
    http.delete('/api/v1/teams/9', () => {
      deletes += 1;
      return deleteStatus === 204
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json({ error: 'no', errors: {} }, { status: deleteStatus });
    }),
  );
}

beforeEach(() => {
  deletes = 0;
});
afterEach(() => clearCsrfToken());

describe('DeleteTeam', () => {
  it('confirms, deletes the team and returns to the team list', async () => {
    serve();
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await screen.findByRole('button', { name: t('team.delete') }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Delete Cart Pushers?');
    expect(deletes).toBe(0);

    await click.click(screen.getByRole('button', { name: t('team.deleteConfirm') }));

    await waitFor(() => expect(deletes).toBe(1));
    expect(await screen.findByText(t('teams.empty'))).toBeInTheDocument();
  });

  it('does nothing when cancelled', async () => {
    serve();
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await screen.findByRole('button', { name: t('team.delete') }));
    await click.click(screen.getByRole('button', { name: t('common.cancel') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deletes).toBe(0);
  });

  it('says so when the server refuses', async () => {
    serve(buildTeam(), 403);
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await screen.findByRole('button', { name: t('team.delete') }));
    await click.click(screen.getByRole('button', { name: t('team.deleteConfirm') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t('team.deleteRefused'));
  });

  it('is not offered for a team that cannot be deleted or after registration closes', async () => {
    serve(buildTeam({ deletable: false }));
    renderApp('/teams/9');
    await screen.findByRole('heading', { name: 'Cart Pushers' });
    expect(screen.queryByRole('button', { name: t('team.delete') })).not.toBeInTheDocument();
  });

  it('is hidden once registration is closed', async () => {
    serve(buildTeam({ race: buildRace({ open_for_registration: false }) }));
    renderApp('/teams/9');
    await screen.findByRole('heading', { name: 'Cart Pushers' });
    expect(screen.queryByRole('button', { name: t('team.delete') })).not.toBeInTheDocument();
  });
});
