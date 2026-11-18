import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setTeamChecklist } from '@/features/teams/api/use-team';
import { clearCsrfToken } from '@/lib/api-client';
import { buildChecklist, buildTeam, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { Checklist } from '@/types/api';

let posts = 0;
let status = 200;

beforeEach(() => {
  posts = 0;
  status = 200;
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
    http.get('/api/v1/teams/9/past_racers', () => HttpResponse.json({ past_racers: [] })),
    http.get('/api/v1/teams/9/questions', () => HttpResponse.json({ jsonform: null, answers: {} })),
    http.post('/api/v1/teams/9/confirmation', () => {
      posts += 1;
      if (status !== 200) return HttpResponse.json({ error: 'boom', errors: {} }, { status });
      return HttpResponse.json({
        checklist: buildChecklist({ finalized: true, show_confirmation: false }),
      });
    }),
  );
});
afterEach(() => clearCsrfToken());

function serve(checklist: Partial<Checklist> = {}) {
  const team = buildTeam({
    checklist: buildChecklist({
      finalized: true,
      team_number: 42,
      confirmation_html: '<p>See you at the start line.</p>',
      show_confirmation: true,
      ...checklist,
    }),
  });
  server.use(http.get('/api/v1/teams/9', () => HttpResponse.json({ team })));
  return team;
}

const NAME = "You're fully registered!";

describe('CompletionDialog', () => {
  it('opens on load with team, text, help link and edit-until line', async () => {
    serve();
    renderApp('/teams/9');
    const dialog = await screen.findByRole('dialog', { name: NAME });
    expect(dialog).toHaveTextContent('Team #42 · Cart Pushers');
    expect(dialog).toHaveTextContent('See you at the start line.');
    expect(dialog).toHaveTextContent('You can edit your team until Fri, Feb 19, 2027.');
    expect(dialog).toHaveTextContent('Problems? Email dogtag@chiditarod.org');
    expect(screen.getByRole('link', { name: 'dogtag@chiditarod.org' })).toHaveAttribute(
      'href',
      'mailto:dogtag@chiditarod.org',
    );
  });

  it('does not open when show_confirmation is false', async () => {
    serve({ show_confirmation: false });
    renderApp('/teams/9');
    await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens when a checklist with show_confirmation is written into the cache', async () => {
    const team = serve({ show_confirmation: false });
    const { queryClient } = renderApp('/teams/9');
    await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' });
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      setTeamChecklist(queryClient, 9, { ...team.checklist, show_confirmation: true });
    });
    expect(await screen.findByRole('dialog', { name: NAME })).toBeInTheDocument();
  });

  it('Got it posts once and closes', async () => {
    serve();
    renderApp('/teams/9');
    await screen.findByRole('dialog', { name: NAME });
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(posts).toBe(1));
  });

  it('Escape posts once and closes', async () => {
    serve();
    renderApp('/teams/9');
    await screen.findByRole('dialog', { name: NAME });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(posts).toBe(1));
  });

  it('closes without an error banner when the POST fails', async () => {
    status = 500;
    serve();
    renderApp('/teams/9');
    await screen.findByRole('dialog', { name: NAME });
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(posts).toBe(1));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('boom')).toBeNull();
  });

  it('shows the fundraising line only with classy_expected', async () => {
    serve({ classy_expected: true });
    const first = renderApp('/teams/9');
    const dialog = await screen.findByRole('dialog', { name: NAME });
    expect(dialog).toHaveTextContent('Your fundraising page is being set up');
    first.unmount();
    serve({ classy_expected: false });
    renderApp('/teams/9');
    const second = await screen.findByRole('dialog', { name: NAME });
    expect(second).not.toHaveTextContent('fundraising');
  });

  it('does not render the tour while the dialog is open', async () => {
    serve();
    renderApp('/teams/9');
    await screen.findByRole('dialog', { name: NAME });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: /take the tour/i }));
    expect(await screen.findByRole('dialog')).not.toHaveAccessibleName(NAME);
  });
});
