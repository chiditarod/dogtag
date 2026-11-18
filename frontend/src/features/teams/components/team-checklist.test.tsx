import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOUR_OFF_KEY, tourSeenKey } from '@/features/tour/storage';
import { clearCsrfToken } from '@/lib/api-client';
import { buildChecklist, buildRace, buildTeam, user } from '@/test/fixtures';
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
  it('shows race, dates, remaining count and a four-star progress bar', async () => {
    serveTeam({ remaining: 2 });
    renderApp('/teams/9');
    expect(await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' })).toBeInTheDocument();
    expect(screen.getByText('CHIditarod 2027')).toBeInTheDocument();
    expect(screen.getByText(/Sat, Mar 6, 2027/)).toBeInTheDocument();
    expect(screen.getByText('Registration closes Fri, Feb 19, 2027')).toBeInTheDocument();
    expect(screen.getByText('2 things left')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4');
    expect(screen.getByRole('progressbar').querySelectorAll('svg')).toHaveLength(4);
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

  it('counts the team star plus completed steps in the progress bar (questions skipped count as done)', async () => {
    serveTeam({
      racers: { filled: 5, total: 5, done: true },
      questions: { required: false, done: true },
      fee: buildChecklist().fee,
    });
    renderApp('/teams/9');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  });

  it('shows one of four stars on a fresh team', async () => {
    serveTeam({ questions: { required: true, done: false } });
    renderApp('/teams/9');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });
});

describe('card stars', () => {
  function starOf(heading: HTMLElement) {
    return heading.closest('[role="group"]')!.querySelector('svg[data-filled]')!;
  }

  it('are outlined while to do and solid when done', async () => {
    serveTeam({
      racers: { filled: 5, total: 5, done: true },
      questions: { required: true, done: false },
    });
    renderApp('/teams/9');
    const racers = await screen.findByRole('heading', { level: 2, name: 'Racers' });
    expect(starOf(racers)).toHaveAttribute('data-filled', 'true');
    expect(starOf(screen.getByRole('heading', { level: 2, name: 'Team questions' }))).toHaveAttribute('data-filled', 'false');
    expect(starOf(screen.getByRole('heading', { level: 2, name: 'Registration fee' }))).toHaveAttribute('data-filled', 'false');
    expect(starOf(screen.getByRole('heading', { level: 2, name: "You're in!" }))).toHaveAttribute('data-filled', 'false');
  });

  it('keeps a regressed card to do while the finalized flag stays full', async () => {
    serveTeam({ finalized: true, remaining: 0, team_number: 12, questions: { required: true, done: false } });
    renderApp('/teams/9');
    const q = await screen.findByRole('heading', { level: 2, name: 'Team questions' });
    expect(starOf(q)).toHaveAttribute('data-filled', 'false');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  });

  it('fills the last star once the team is finalized', async () => {
    serveTeam({ finalized: true, remaining: 0, team_number: 12, classy_fundraising_url: 'https://classy.example/t/12' });
    renderApp('/teams/9');
    const final = await screen.findByRole('heading', { level: 2, name: "You're in!" });
    expect(starOf(final)).toHaveAttribute('data-filled', 'true');
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
  it('give screen readers a to do / done suffix; the locked final step has no pill', async () => {
    serveTeam({ racers: { filled: 2, total: 5, done: false } });
    renderApp('/teams/9');
    const racers = (await screen.findByRole('heading', { level: 2, name: 'Racers' })).closest(
      '[role="group"]',
    ) as HTMLElement;
    expect(racers).toHaveTextContent('2 of 5, to do');
    const final = screen.getByRole('heading', { level: 2, name: "You're in!" }).closest(
      '[role="group"]',
    ) as HTMLElement;
    expect(within(final).queryByText('Locked')).toBeNull();
    expect(within(final).getByText('Finish the steps above to lock in your spot.')).toBeInTheDocument();
  });
});

describe("What's left", () => {
  it('links to each unfinished step', async () => {
    serveTeam({ racers: { filled: 2, total: 5, done: false } });
    renderApp('/teams/9');
    const list = await screen.findByRole('list', { name: "What's left" });
    const racers = within(list).getByRole('link', { name: 'Add 3 racers' });
    expect(racers.getAttribute('href')).toMatch(/#step-racers$/);
    const fee = within(list).getByRole('link', { name: 'Pay the registration fee' });
    expect(fee.getAttribute('href')).toMatch(/#step-fee$/);
    expect(within(list).queryByRole('link', { name: 'Answer the team questions' })).toBeNull();
    expect(document.getElementById('step-racers')).toBe(
      screen.getByRole('heading', { level: 2, name: 'Racers' }).closest('section'),
    );
  });

  it('uses the singular for one open spot and lists unanswered questions', async () => {
    serveTeam({
      racers: { filled: 4, total: 5, done: false },
      questions: { required: true, done: false },
    });
    renderApp('/teams/9');
    const list = await screen.findByRole('list', { name: "What's left" });
    expect(within(list).getByRole('link', { name: 'Add 1 racer' })).toBeInTheDocument();
    const questions = within(list).getByRole('link', { name: 'Answer the team questions' });
    expect(questions.getAttribute('href')).toMatch(/#step-questions$/);
  });

  it('leaves out the fee while it opens later', async () => {
    const opens = { price_cents: 15000, begins_at: '2026-12-01T06:00:00.000Z' };
    serveTeam({
      racers: { filled: 2, total: 5, done: false },
      fee: {
        done: true,
        amount_due_cents: null,
        paid_cents: 0,
        next_tier: opens,
        requirement_id: null,
        items: [],
      },
    });
    renderApp('/teams/9');
    const list = await screen.findByRole('list', { name: "What's left" });
    expect(within(list).getByRole('link', { name: 'Add 3 racers' })).toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: 'Pay the registration fee' })).toBeNull();
  });

  it('is absent once the team is finalized', async () => {
    serveTeam({ finalized: true, remaining: 0, team_number: 12, classy_fundraising_url: 'https://classy.example/t/12' });
    renderApp('/teams/9');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('list', { name: "What's left" })).toBeNull();
  });

  it('keeps the four step groups named as before', async () => {
    serveTeam({ questions: { required: true, done: false } });
    renderApp('/teams/9');
    await screen.findByRole('heading', { level: 1 });
    for (const name of ['Racers', 'Team questions', 'Registration fee', "You're in!"]) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument();
    }
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

describe('guided tour', () => {
  const flagTitle = 'Four stars to the start line';

  function tourOn() {
    localStorage.removeItem(TOUR_OFF_KEY);
  }

  it('starts by itself on a first visit and writes the seen key when ended', async () => {
    tourOn();
    serveTeam({ questions: { required: true, done: false } });
    renderApp('/teams/9');
    const dialog = await screen.findByRole('dialog', { name: flagTitle });
    expect(within(dialog).getByText('1 of 5')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'End tour' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(tourSeenKey(user.id))).toBe('1');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Take the tour' })).toHaveFocus(),
    );
  });

  it('does not start when it has been seen, and Take the tour opens it at stop 1', async () => {
    tourOn();
    localStorage.setItem(tourSeenKey(user.id), '1');
    serveTeam();
    renderApp('/teams/9');
    const replay = await screen.findByRole('button', { name: 'Take the tour' });
    await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' });
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(replay);
    expect(await screen.findByRole('dialog', { name: flagTitle })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('1 of 4')).toBeInTheDocument();
  });

  it('does not start when tours are switched off, but Take the tour still works', async () => {
    serveTeam();
    renderApp('/teams/9');
    await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' });
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(await screen.findByRole('dialog', { name: flagTitle })).toBeInTheDocument();
  });

  it('does not start on a finalized team, and can still be replayed', async () => {
    tourOn();
    serveTeam({ finalized: true, remaining: 0, team_number: 12 });
    renderApp('/teams/9');
    await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' });
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(await screen.findByRole('dialog', { name: flagTitle })).toBeInTheDocument();
  });

  it('keeps its stop when the team refetches, and does not reopen after it ends', async () => {
    tourOn();
    let gets = 0;
    const team = buildTeam();
    server.use(
      http.get('/api/v1/teams/9', () => {
        gets += 1;
        return HttpResponse.json({ team });
      }),
    );
    const { queryClient } = renderApp('/teams/9');
    await screen.findByRole('dialog', { name: flagTitle });
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Add your racers' })).toBeInTheDocument();

    await act(() => queryClient.invalidateQueries({ queryKey: ['team', '9'] }));
    expect(gets).toBe(2);
    expect(screen.getByRole('dialog', { name: 'Add your racers' })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('2 of 4')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'End tour' }));
    await act(() => queryClient.invalidateQueries({ queryKey: ['team', '9'] }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not start on a closed race, and can still be replayed', async () => {
    tourOn();
    serveTeam({}, { race: buildRace({ open_for_registration: false }) });
    renderApp('/teams/9');
    await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(tourSeenKey(user.id))).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(await screen.findByRole('dialog', { name: flagTitle })).toBeInTheDocument();
  });

  it('lands at the top of the page with Take the tour focused when it ends', async () => {
    tourOn();
    vi.stubGlobal('scrollY', 400);
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    try {
      serveTeam();
      renderApp('/teams/9');
      await screen.findByRole('dialog', { name: flagTitle });
      const replay = screen.getByRole('button', { name: 'Take the tour' });
      const focus = vi.spyOn(replay, 'focus');

      await userEvent.click(screen.getByRole('button', { name: 'End tour' }));
      await waitFor(() => expect(replay).toHaveFocus());
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
      expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('works by hand, and never starts by itself, when localStorage is blocked', async () => {
    tourOn();
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    try {
      serveTeam();
      renderApp('/teams/9');
      await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' });
      expect(screen.queryByRole('dialog')).toBeNull();

      await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }));
      expect(await screen.findByRole('dialog', { name: flagTitle })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'End tour' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('heading', { level: 1, name: 'Cart Pushers' })).toBeInTheDocument();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('counts three stops when the race has neither questions nor a fee', async () => {
    tourOn();
    const fee = buildChecklist().fee;
    serveTeam({
      questions: { required: false, done: true },
      fee: { ...fee, done: true, amount_due_cents: null, requirement_id: null, items: [] },
    });
    renderApp('/teams/9');
    const dialog = await screen.findByRole('dialog', { name: flagTitle });
    expect(within(dialog).getByText('1 of 3')).toBeInTheDocument();
  });

  it('counts four stops when the race has no questions', async () => {
    tourOn();
    serveTeam({ questions: { required: false, done: true } });
    renderApp('/teams/9');
    const dialog = await screen.findByRole('dialog', { name: flagTitle });
    expect(within(dialog).getByText('1 of 4')).toBeInTheDocument();
  });

  it('leaves the group names and pills as they were', async () => {
    tourOn();
    serveTeam({
      racers: { filled: 2, total: 5, done: false },
      questions: { required: true, done: false },
    });
    renderApp('/teams/9');
    await screen.findByRole('dialog', { name: flagTitle });
    for (const name of ['Racers', 'Team questions', 'Registration fee', "You're in!"]) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('2 of 5')).toBeInTheDocument();
  });
});
