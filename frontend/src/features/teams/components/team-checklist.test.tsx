import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '@/lib/api-client';
import { buildChecklist, buildTeam, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { Checklist, Team } from '@/types/api';

beforeEach(() => {
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
    http.get('/api/v1/teams/9/past_racers', () => HttpResponse.json({ past_racers: [] })),
    http.get('/api/v1/teams/9/questions', () => HttpResponse.json({ jsonform: null, answers: {} })),
  );
});
afterEach(() => {
  clearCsrfToken();
  vi.useRealTimers();
});

function serveTeam(checklist: Partial<Checklist> = {}, overrides: Partial<Team> = {}) {
  const team = buildTeam({ ...overrides, checklist: buildChecklist(checklist) });
  server.use(http.get('/api/v1/teams/9', () => HttpResponse.json({ team })));
  return team;
}

describe('TeamChecklist header', () => {
  it('shows race, dates, remaining count and four progress segments', async () => {
    serveTeam({ remaining: 2 });
    renderApp('/teams/9');
    expect(await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' })).toBeInTheDocument();
    expect(screen.getByText('CHIditarod 2027')).toBeInTheDocument();
    expect(screen.getByText(/Sat, Mar 6, 2027/)).toBeInTheDocument();
    expect(screen.getByText('Registration closes Sat, Feb 20, 2027')).toBeInTheDocument();
    expect(screen.getByText('2 things left')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4');
  });

  it('uses singular copy for one thing left', async () => {
    serveTeam({ remaining: 1 });
    renderApp('/teams/9');
    expect(await screen.findByText('1 thing left')).toBeInTheDocument();
  });

  it('says nothing is due yet (with the date) when the fee has not opened and nothing remains', async () => {
    serveTeam({
      remaining: 0,
      fee: {
        done: true,
        amount_due_cents: null,
        paid_cents: 0,
        next_tier: { price_cents: 15000, begins_at: '2026-12-01T06:00:00.000Z' },
        requirement_id: null,
        items: [
          {
            requirement_id: 3,
            name: 'Registration fee',
            done: false,
            amount_due_cents: null,
            paid_cents: 0,
            next_tier: { price_cents: 15000, begins_at: '2026-12-01T06:00:00.000Z' },
          },
        ],
      },
    });
    renderApp('/teams/9');
    expect(
      await screen.findByText('Nothing to do yet — the registration fee opens Tue, Dec 1, 2026'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/things left/)).toBeNull();
  });

  it("says we're finalizing when nothing remains but the team is not finalized", async () => {
    serveTeam({ remaining: 0 });
    renderApp('/teams/9');
    expect(await screen.findByText("Almost there! We're finalizing your team.")).toBeInTheDocument();
    expect(screen.queryByText(/things left/)).toBeNull();
  });

  it("says You're in! when finalized", async () => {
    serveTeam({ finalized: true, remaining: 0, team_number: 12, classy_fundraising_url: 'https://classy.example/t/12' });
    renderApp('/teams/9');
    const header = await screen.findByRole('region', { name: 'Team summary' });
    expect(within(header).getByText("You're in!")).toBeInTheDocument();
    expect(screen.queryByText(/things left/)).toBeNull();
  });

  it('counts completed steps in the progress bar (questions skipped count as done)', async () => {
    serveTeam({
      racers: { filled: 5, total: 5, done: true },
      questions: { required: false, done: true },
      fee: buildChecklist().fee,
    });
    renderApp('/teams/9');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  });
});

describe('TeamChecklist cards', () => {
  it('renders racers, fee and locked final card; hides questions when not required', async () => {
    serveTeam({ racers: { filled: 2, total: 5, done: false } });
    renderApp('/teams/9');
    await screen.findByRole('heading', { level: 1 });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Racers', 'Registration fee', "You're in!"]);
    expect(screen.getByText('2 of 5')).toBeInTheDocument();
    expect(screen.getByText('$150', { selector: 'span' })).toBeInTheDocument(); // the pill
    expect(screen.getByText(/Finish the steps above/)).toBeInTheDocument();
  });

  it('shows the questions card with To do / Done pills when required', async () => {
    serveTeam({ questions: { required: true, done: false } });
    const { unmount } = renderApp('/teams/9');
    const card = (await screen.findByRole('heading', { level: 2, name: 'Team questions' })).closest('[role="group"]') as HTMLElement;
    expect(within(card).getByText('To do')).toBeInTheDocument();
    unmount();

    serveTeam({ questions: { required: true, done: true } });
    renderApp('/teams/9');
    const done = (await screen.findByRole('heading', { level: 2, name: 'Team questions' })).closest('[role="group"]') as HTMLElement;
    expect(within(done).getByText('Done')).toBeInTheDocument();
  });

  it('shows Paid once the fee is done', async () => {
    serveTeam({ fee: { done: true, amount_due_cents: null, paid_cents: 15000, next_tier: null, requirement_id: null, items: [] } });
    renderApp('/teams/9');
    const card = (await screen.findByRole('heading', { level: 2, name: 'Registration fee' })).closest('[role="group"]') as HTMLElement;
    expect(within(card).getByText('Paid')).toBeInTheDocument();
  });

  it('shows Paid (not Opens) once every open requirement is paid and another opens later', async () => {
    const opens = { price_cents: 13000, begins_at: '2026-12-01T06:00:00.000Z' };
    serveTeam({
      remaining: 0,
      fee: {
        done: true,
        amount_due_cents: null,
        paid_cents: 8800,
        next_tier: opens,
        requirement_id: null,
        items: [
          { requirement_id: 3, name: 'Cart Deposit', done: true, amount_due_cents: null, paid_cents: 8800, next_tier: null },
          { requirement_id: 4, name: 'Race Registration', done: false, amount_due_cents: null, paid_cents: 0, next_tier: opens },
        ],
      },
    });
    renderApp('/teams/9');
    const card = (await screen.findByRole('heading', { level: 2, name: 'Registration fee' })).closest('[role="group"]') as HTMLElement;
    expect(within(card).getByText('Paid')).toBeInTheDocument();
    expect(within(card).queryByText(/^Opens/)).toBeNull();
    expect(screen.queryByText(/Nothing to do yet/)).toBeNull();
  });

  it('shows Opens <date> (not Done) before any tier is active', async () => {
    serveTeam({
      fee: {
        done: true,
        amount_due_cents: null,
        paid_cents: 0,
        next_tier: { price_cents: 15000, begins_at: '2026-12-01T06:00:00.000Z' },
        requirement_id: null,
        items: [
          {
            requirement_id: 3,
            name: 'Registration fee',
            done: false,
            amount_due_cents: null,
            paid_cents: 0,
            next_tier: { price_cents: 15000, begins_at: '2026-12-01T06:00:00.000Z' },
          },
        ],
      },
    });
    renderApp('/teams/9');
    const card = (await screen.findByRole('heading', { level: 2, name: 'Registration fee' })).closest('[role="group"]') as HTMLElement;
    expect(within(card).getByText('Opens Tue, Dec 1, 2026')).toBeInTheDocument();
    expect(within(card).queryByText('Paid')).toBeNull();
    expect(within(card).queryByText('Done')).toBeNull();
  });
});

describe('card pills', () => {
  it('give screen readers a to do / done suffix and card 4 reads Locked', async () => {
    serveTeam({ racers: { filled: 2, total: 5, done: false } });
    renderApp('/teams/9');
    const racers = (await screen.findByRole('heading', { level: 2, name: 'Racers' })).closest(
      '[role="group"]',
    ) as HTMLElement;
    expect(racers).toHaveTextContent('2 of 5, to do');
    const final = screen.getByRole('heading', { level: 2, name: "You're in!" }).closest(
      '[role="group"]',
    ) as HTMLElement;
    expect(within(final).getByText('Locked')).toBeInTheDocument();
    expect(final).toHaveTextContent('Locked, to do');
  });
});

describe('YoureInCard', () => {
  it('shows the team number and the fundraising link when finalized', async () => {
    serveTeam({ finalized: true, remaining: 0, team_number: 12, classy_fundraising_url: 'https://classy.example/t/12' });
    renderApp('/teams/9');
    expect(await screen.findByText('Team #12')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Open your fundraising page' });
    expect(link).toHaveAttribute('href', 'https://classy.example/t/12');
    expect(screen.queryByText(/Finish the steps above/)).toBeNull();
  });

  it('shows only the team number, without polling, when the race has no Classy campaign', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let requests = 0;
    server.use(
      http.get('/api/v1/teams/9', () => {
        requests += 1;
        return HttpResponse.json({
          team: buildTeam({
            checklist: buildChecklist({ finalized: true, remaining: 0, team_number: 12, classy_expected: false }),
          }),
        });
      }),
    );
    renderApp('/teams/9');
    expect(await screen.findByText('Team #12')).toBeInTheDocument();
    expect(screen.queryByText('Your fundraising page is being set up…')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open your fundraising page' })).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(requests).toBe(1);
  });

  it('polls every 10s while the URL is missing and stops when it arrives', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let requests = 0;
    server.use(
      http.get('/api/v1/teams/9', () => {
        requests += 1;
        const url = requests >= 3 ? 'https://classy.example/t/12' : null;
        return HttpResponse.json({
          team: buildTeam({
            checklist: buildChecklist({ finalized: true, remaining: 0, team_number: 12, classy_fundraising_url: url }),
          }),
        });
      }),
    );
    renderApp('/teams/9');
    expect(await screen.findByText('Your fundraising page is being set up…')).toBeInTheDocument();
    expect(requests).toBe(1);

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    await waitFor(() => expect(requests).toBe(2));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(await screen.findByRole('link', { name: 'Open your fundraising page' })).toBeInTheDocument();
    expect(requests).toBe(3);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(requests).toBe(3);
  });

  it('gives up polling after 30 attempts (5 minutes)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let requests = 0;
    server.use(
      http.get('/api/v1/teams/9', () => {
        requests += 1;
        return HttpResponse.json({
          team: buildTeam({ checklist: buildChecklist({ finalized: true, remaining: 0, team_number: 12 }) }),
        });
      }),
    );
    renderApp('/teams/9');
    await screen.findByText('Your fundraising page is being set up…');
    for (let i = 0; i < 35; i += 1) {
      await act(() => vi.advanceTimersByTimeAsync(10_000));
      // Let the mocked response land so the next interval is scheduled.
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    }
    expect(requests).toBe(31);
  });
});

describe('EditTeamBasics', () => {
  async function openForm() {
    await userEvent.click(await screen.findByRole('button', { name: 'Edit team details' }));
    return screen.findByLabelText('Team name');
  }

  it('prefills, PATCHes, updates the header from the response and collapses', async () => {
    serveTeam();
    let body: unknown;
    server.use(
      http.patch('/api/v1/teams/9', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          team: buildTeam({ name: 'Cart Pullers', description: 'New', experience: 2 }),
        });
      }),
    );
    renderApp('/teams/9');
    const name = await openForm();
    expect(name).toHaveValue('Cart Pushers');
    expect(screen.getByLabelText('Team years racing')).toHaveValue('1');
    await userEvent.clear(name);
    await userEvent.type(name, 'Cart Pullers');
    await userEvent.clear(screen.getByLabelText('Description'));
    await userEvent.type(screen.getByLabelText('Description'), 'New');
    await userEvent.selectOptions(screen.getByLabelText('Team years racing'), 'Twice');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Cart Pullers' })).toBeInTheDocument();
    expect(body).toEqual({ team: { name: 'Cart Pullers', description: 'New', experience: 2 } });
    await waitFor(() => expect(screen.queryByLabelText('Team name')).toBeNull());
  });

  it('focuses the name field on open and returns focus to the toggle on cancel', async () => {
    serveTeam();
    renderApp('/teams/9');
    const toggle = await screen.findByRole('button', { name: 'Edit team details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(await screen.findByLabelText('Team name')).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', screen.getByLabelText('Team name').closest('form')!.id);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Team name')).toBeNull();
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('returns focus to the toggle after a successful save', async () => {
    serveTeam();
    server.use(
      http.patch('/api/v1/teams/9', () => HttpResponse.json({ team: buildTeam({ name: 'Cart Pullers' }) })),
    );
    renderApp('/teams/9');
    await openForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByLabelText('Team name')).toBeNull());
    expect(screen.getByRole('button', { name: 'Edit team details' })).toHaveFocus();
  });

  it('shows 422 field errors inline and stays open', async () => {
    serveTeam();
    server.use(
      http.patch('/api/v1/teams/9', () =>
        HttpResponse.json({ error: 'invalid', errors: { name: ['has already been taken'] } }, { status: 422 }),
      ),
    );
    renderApp('/teams/9');
    const name = await openForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('has already been taken')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a page-level banner and refetches the team on a 403 mutation', async () => {
    let gets = 0;
    const team = buildTeam();
    server.use(
      http.get('/api/v1/teams/9', () => {
        gets += 1;
        return HttpResponse.json({ team });
      }),
      http.patch('/api/v1/teams/9', () =>
        HttpResponse.json({ error: 'Registration is closed', errors: {} }, { status: 403 }),
      ),
    );
    renderApp('/teams/9');
    await openForm();
    expect(gets).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Registration is closed');
    await waitFor(() => expect(gets).toBe(2));
  });
});

describe('page banner', () => {
  it('clears after a later successful mutation', async () => {
    serveTeam();
    let calls = 0;
    server.use(
      http.patch('/api/v1/teams/9', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: 'Registration is closed', errors: {} }, { status: 403 })
          : HttpResponse.json({ team: buildTeam() });
      }),
    );
    renderApp('/teams/9');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit team details' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Registration is closed');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

describe('team load failures', () => {
  it.each([403, 404])('shows a friendly not-found message with a link to /teams on %i', async (status) => {
    server.use(
      http.get('/api/v1/teams/9', () => HttpResponse.json({ error: 'nope', errors: {} }, { status })),
    );
    renderApp('/teams/9');
    expect(await screen.findByText("We couldn't find that team")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to my teams' })).toHaveAttribute('href', '/register/teams');
  });

  it('shows an error with retry on server errors', async () => {
    server.use(http.get('/api/v1/teams/9', () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderApp('/teams/9');
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
