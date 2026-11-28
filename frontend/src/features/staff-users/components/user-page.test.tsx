import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { t } from '@/locales/en';
import { user as me } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { StaffUser } from '../api/types';
import { emptyUsers, staffUser } from '../test-fixtures';

const here = (router: { state: { location: { pathname: string; search: string } } }) => router.state.location.pathname;

function serve(initial: StaffUser, viewerRoles = ['admin']) {
  let current = initial;
  let deleted = false;
  const requests: { method: string; body: unknown }[] = [];
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...me, roles: viewerRoles } })),
    http.get('/api/v1/staff/users', () => HttpResponse.json(emptyUsers)),
    http.get(`/api/v1/staff/users/${initial.id}`, () =>
      deleted ? HttpResponse.json({ error: 'Not found', errors: {} }, { status: 404 }) : HttpResponse.json({ user: current }),
    ),
    http.patch(`/api/v1/staff/users/${initial.id}`, async ({ request }) => {
      const body = (await request.json()) as { user: Partial<StaffUser> };
      requests.push({ method: 'PATCH', body });
      current = { ...current, ...body.user };
      return HttpResponse.json({ user: current });
    }),
    http.delete(`/api/v1/staff/users/${initial.id}`, () => {
      requests.push({ method: 'DELETE', body: null });
      deleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return requests;
}

async function open(initial: StaffUser, viewerRoles?: string[]) {
  const requests = serve(initial, viewerRoles);
  const rendered = renderApp(`/staff/users/${initial.id}`);
  await screen.findByRole('heading', { name: 'Ada Racer', level: 1 });
  return { ...rendered, requests };
}

const phone = () => screen.getByRole('textbox', { name: 'Phone' });
const back = () => screen.getByRole('link', { name: '‹ Users' });
const dialog = () => screen.queryByRole('dialog', { name: t('staff.discard.title') });

describe('staff user page', () => {
  it('shows the header with the back link, email and account month', async () => {
    await open(staffUser());
    expect(back()).toHaveAttribute('href', '/register/staff/users');
    expect(screen.getByText('ada@example.com · account since Dec 2023')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'First name' })).toHaveValue('Ada');
    expect(screen.getByText(/Admins only; operators and refunders see these as text/)).toBeInTheDocument();
  });

  it('shows an operator the details as text, with role tags and no Roles card or Delete', async () => {
    await open(staffUser({ can_edit: false, can_destroy: false, roles: ['operator'] }), ['operator']);
    expect(screen.queryByRole('textbox', { name: 'First name' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save details' })).not.toBeInTheDocument();
    expect(screen.getByText('(312) 555-0142')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Roles' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete user' })).not.toBeInTheDocument();
    expect(screen.getByText('Operator')).toBeInTheDocument();
  });

  it('lists the teams with status, a legacy team link and an Emails link, or says there are none', async () => {
    const race = { id: 9, name: 'CHIditarod 2027', year: 2027 };
    const { unmount } = await open(
      staffUser({
        teams: [
          { id: 4, name: 'Doge Sled', race, assigned_team_number: 7, finalized: true, percent_complete: 100 },
          { id: 5, name: 'Late Entry', race, assigned_team_number: null, finalized: true, percent_complete: 100 },
          { id: 6, name: "Ada's Second Try", race, assigned_team_number: null, finalized: false, percent_complete: 60 },
        ],
      }),
    );
    expect(screen.getByRole('link', { name: 'Doge Sled' })).toHaveAttribute('href', '/teams/4');
    expect(screen.getByText('Registered #7')).toBeInTheDocument();
    expect(screen.getByText('Registered')).toBeInTheDocument();
    expect(screen.getByText('60% done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Emails for Doge Sled' })).toHaveAttribute('href', '/register/staff/emails?team_id=4');
    unmount();

    await open(staffUser({ teams: [] }));
    expect(screen.getByText('No teams.')).toBeInTheDocument();
  });

  it('links to payments matching the email, and to the account\'s emails by id for the Emails page roles', async () => {
    const { unmount } = await open(staffUser({ id: 12 }));
    expect(screen.getByRole('link', { name: 'Payments matching this email' })).toHaveAttribute(
      'href',
      '/register/staff/payments?race_id=all&q=ada%40example.com',
    );
    expect(screen.getByRole('link', { name: 'Emails for this user' })).toHaveAttribute(
      'href',
      '/register/staff/emails?user_id=12',
    );
    unmount();

    const operator = await open(staffUser({ can_edit: false, can_destroy: false }), ['operator']);
    expect(screen.getByRole('link', { name: 'Emails for this user' })).toBeInTheDocument();
    operator.unmount();

    await open(staffUser({ can_edit: false, can_destroy: false }), ['refunder']);
    expect(screen.getByRole('link', { name: 'Payments matching this email' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Emails for this user' })).not.toBeInTheDocument();
  });

  it('hides the per-team Emails link from a refunder, who cannot open the emails page', async () => {
    const race = { id: 9, name: 'CHIditarod 2027', year: 2027 };
    await open(
      staffUser({
        can_edit: false,
        can_destroy: false,
        teams: [{ id: 4, name: 'Doge Sled', race, assigned_team_number: 7, finalized: true, percent_complete: 100 }],
      }),
      ['refunder'],
    );
    expect(screen.getByRole('link', { name: 'Doge Sled' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Emails for Doge Sled' })).not.toBeInTheDocument();
  });

  it('shows a 404 as page not found', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...me, roles: ['admin'] } })),
      http.get('/api/v1/staff/users/99', () => HttpResponse.json({ error: 'Not found', errors: {} }, { status: 404 })),
    );
    renderApp('/staff/users/99');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('staff user page details', () => {
  it('saves only what changed, says Saved. and shows a 422 under its field', async () => {
    const { requests } = await open(staffUser());
    await userEvent.clear(phone());
    await userEvent.type(phone(), '773-555-0100');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(requests).toEqual([{ method: 'PATCH', body: { user: { phone: '773-555-0100' } } }]);

    server.use(
      http.patch('/api/v1/staff/users/1', () =>
        HttpResponse.json({ error: 'Invalid', errors: { email: ['has already been taken'] } }, { status: 422 }),
      ),
    );
    const email = screen.getByRole('textbox', { name: 'Email' });
    await userEvent.clear(email);
    await userEvent.type(email, 'sam@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('has already been taken')).toBeInTheDocument();
    expect(email).toHaveAccessibleDescription('has already been taken');
  });

  /** Counts `GET /me` from now on, answering with the viewer at `id`. */
  function countMe(id: number) {
    const calls = { n: 0 };
    server.use(
      http.get('/api/v1/me', () => {
        calls.n += 1;
        return HttpResponse.json({ user: { ...me, id, roles: ['admin'] } });
      }),
    );
    return calls;
  }

  it('refetches the header user (me) after an admin saves their own details', async () => {
    const { requests } = await open(staffUser({ id: me.id, is_self: true }));
    const meCalls = countMe(me.id);
    await userEvent.clear(phone());
    await userEvent.type(phone(), '773-555-0100');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    await waitFor(() => expect(meCalls.n).toBeGreaterThan(0));
  });

  it('leaves me alone after saving someone else', async () => {
    await open(staffUser({ id: 12 }));
    const meCalls = countMe(me.id);
    await userEvent.clear(phone());
    await userEvent.type(phone(), '773-555-0100');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(meCalls.n).toBe(0);
  });

  it('shows a user with null names by email, with blank name fields and no "null"', async () => {
    const nameless = staffUser({ id: 12, first_name: null, last_name: null });
    serve(nameless);
    const { unmount } = renderApp('/staff/users/12');
    expect(await screen.findByRole('heading', { name: 'ada@example.com', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'First name' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Last name' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save details' })).toBeDisabled();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
    unmount();

    serve({ ...nameless, can_edit: false, can_destroy: false, first_name: 'Ada', last_name: null });
    renderApp('/staff/users/12');
    expect(await screen.findByRole('heading', { name: 'Ada', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });
});

describe('staff user page delete', () => {
  it('disables Delete and gives the reason when the user owns teams', async () => {
    await open(staffUser({ delete_blocker: 'Owns 2 teams. Delete or move them first.' }));
    expect(screen.getByRole('button', { name: 'Delete user' })).toBeDisabled();
    expect(screen.getByText('Owns 2 teams. Delete or move them first.')).toBeInTheDocument();
  });

  it('confirms, deletes and lands on the list with no discard dialog, even with an edited field', async () => {
    const { router, requests } = await open(staffUser());
    await userEvent.type(phone(), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Delete user' }));
    const confirm = await screen.findByRole('dialog', { name: "Delete Ada Racer? This can't be undone." });
    expect(requests).toEqual([]);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete user' }));

    await waitFor(() => expect(here(router)).toBe('/register/staff/users'));
    expect(requests).toEqual([{ method: 'DELETE', body: null }]);
    expect(dialog()).not.toBeInTheDocument();
    // The deleted user is not refetched (a 404 would strand the page on "Page not found").
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument();
  });

  it('lands on the list after deleting a bare user with nothing edited', async () => {
    const { router } = await open(staffUser());
    await userEvent.click(screen.getByRole('button', { name: 'Delete user' }));
    const confirm = await screen.findByRole('dialog', { name: "Delete Ada Racer? This can't be undone." });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete user' }));
    await waitFor(() => expect(here(router)).toBe('/register/staff/users'));
    expect(dialog()).not.toBeInTheDocument();
  });

  it("keeps the user and shows the server's reason on a 422", async () => {
    const { router } = await open(staffUser());
    server.use(
      http.delete('/api/v1/staff/users/1', () =>
        HttpResponse.json({ error: 'Owns 1 team.', errors: {}, code: 'user_not_deletable' }, { status: 422 }),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete user' }));
    const confirm = await screen.findByRole('dialog', { name: "Delete Ada Racer? This can't be undone." });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete user' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('Owns 1 team.');
    expect(here(router)).toBe('/register/staff/users/1');
  });
});

describe('staff user page delete refusal', () => {
  it('refetches the user after a refused delete so the button shows the new reason', async () => {
    let blocker: string | null = null;
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...me, roles: ['admin'] } })),
      http.get('/api/v1/staff/users', () => HttpResponse.json(emptyUsers)),
      http.get('/api/v1/staff/users/1', () => HttpResponse.json({ user: staffUser({ delete_blocker: blocker }) })),
      http.delete('/api/v1/staff/users/1', () => {
        blocker = 'Made refunds, which are kept as a record.';
        return HttpResponse.json({ error: blocker, errors: {}, code: 'user_not_deletable' }, { status: 422 });
      }),
    );
    renderApp('/staff/users/1');
    await screen.findByRole('heading', { name: 'Ada Racer', level: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'Delete user' }));
    const confirm = await screen.findByRole('dialog', { name: "Delete Ada Racer? This can't be undone." });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete user' }));
    await within(confirm).findByRole('alert');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Made refunds, which are kept as a record.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete user' })).toBeDisabled();
  });
});

describe('staff user page leave guard', () => {
  it('asks before the back link drops an unsaved edit; Keep editing stays with the edit', async () => {
    const { router } = await open(staffUser());
    await userEvent.type(phone(), '9');
    await userEvent.click(back());

    const asked = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(within(asked).getByText("Your changes to this user haven't been saved.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(dialog()).not.toBeInTheDocument();
    expect(here(router)).toBe('/register/staff/users/1');
    expect(phone()).toHaveValue('(312) 555-01429');
  });

  it('leaves on Discard changes', async () => {
    const { router } = await open(staffUser());
    await userEvent.type(phone(), '9');
    await userEvent.click(back());
    await userEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(here(router)).toBe('/register/staff/users'));
  });

  it('does not ask after the details were saved', async () => {
    const { router } = await open(staffUser());
    await userEvent.type(phone(), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await screen.findByText('Saved.');
    await userEvent.click(back());
    await waitFor(() => expect(here(router)).toBe('/register/staff/users'));
    expect(dialog()).not.toBeInTheDocument();
  });

  it('does not treat stored surrounding whitespace as an edit', async () => {
    const { router } = await open(staffUser({ first_name: 'Ada ', phone: ' (312) 555-0142' }));
    await userEvent.click(back());
    await waitFor(() => expect(here(router)).toBe('/register/staff/users'));
    expect(dialog()).not.toBeInTheDocument();
  });

  it('asks about a ticked role too', async () => {
    const { router } = await open(staffUser());
    await userEvent.click(screen.getByRole('checkbox', { name: 'Operator' }));
    await userEvent.click(back());
    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    expect(here(router)).toBe('/register/staff/users/1');
  });
});
