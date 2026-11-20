import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '@/lib/api-client';
import { buildChecklist, buildPerson, buildRace, buildTeam, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { Checklist, Person, Race, Team } from '@/types/api';

const dee = {
  first_name: 'Dee',
  last_name: 'Lamb',
  email: 'dee@example.com',
  phone: '312-555-0144',
  experience: 1,
  instagram: '@dee',
  last_team_name: 'Cart Pushers',
  last_race_name: 'CHIditarod 2025',
  last_raced_year: 2025,
};

function racer(n: number, overrides = {}) {
  return {
    ...dee,
    first_name: `Racer${n}`,
    last_name: `Num${n}`,
    email: `racer${n}@example.com`,
    last_raced_year: 2025 - n,
    ...overrides,
  };
}

interface Setup {
  people?: Person[];
  past?: Array<typeof dee>;
  race?: Partial<Race>;
  checklist?: Partial<Checklist>;
  captainId?: number | null;
}

let requests: Array<{ method: string; url: string; body: unknown }>;

function serve({ people = [], past = [], race = {}, checklist = {}, captainId = null }: Setup = {}) {
  const team: Team = buildTeam({
    people,
    captain_id: captainId,
    race: buildRace(race),
    checklist: buildChecklist({
      racers: { filled: people.length, total: 5, captain: false, done: false },
      ...checklist,
    }),
  });
  server.use(
    http.get('/api/v1/teams/9', () => HttpResponse.json({ team })),
    http.get('/api/v1/teams/9/past_racers', () => HttpResponse.json({ past_racers: past })),
  );
  return team;
}

beforeEach(() => {
  requests = [];
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
  );
});
afterEach(() => clearCsrfToken());

async function record(request: Request) {
  const text = await request.text();
  requests.push({
    method: request.method,
    url: new URL(request.url).pathname,
    body: text ? JSON.parse(text) : undefined,
  });
}

const slots = () => within(screen.getByRole('list', { name: 'Racer slots' })).getAllByRole('listitem');

async function openRoster() {
  await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' });
  return screen.getByRole('group', { name: 'Racers' });
}

/** Past racers load after the team; wait for the picker button. */
async function openRosterWithPicker(count: number) {
  const roster = await openRoster();
  await screen.findByRole('button', { name: `Pick racers from past teams (${count})` });
  return roster;
}

describe('RosterCard slots', () => {
  it('lists the people, then one row for all the open spots', async () => {
    serve({ people: [buildPerson(), buildPerson({ id: 2, first_name: 'Bo', email: 'bo@example.com' })] });
    renderApp('/teams/9');
    const roster = await openRoster();
    expect(slots()).toHaveLength(3);
    expect(within(roster).getAllByRole('button', { name: /^Edit / })).toHaveLength(2);
    expect(slots()[0]).toHaveTextContent('Ada L');
    expect(slots()[1]).toHaveTextContent('Bo L');
    expect(slots()[2]).toHaveTextContent('3 spots to fill');
  });

  it('respects a different people_per_team and says 1 spot to fill', async () => {
    serve({ race: { people_per_team: 3 } });
    renderApp('/teams/9');
    await openRoster();
    expect(slots()).toHaveLength(1);
    expect(slots()[0]).toHaveTextContent('3 spots to fill');
  });

  it('shows initials, name, captain marker, contact details and the years label', async () => {
    serve({
      people: [
        buildPerson({ instagram: '@ada' }),
        buildPerson({ id: 2, first_name: 'Bo', last_name: 'Z', email: 'bo@example.com', experience: 2 }),
      ],
      captainId: 1,
    });
    renderApp('/teams/9');
    await openRoster();
    const [first, second] = slots();
    expect(within(first).getByText('AL')).toBeInTheDocument();
    expect(within(first).getByText('Ada L')).toBeInTheDocument();
    expect(within(first).getByText('Captain')).toBeInTheDocument();
    expect(within(first).getByText(/ada@example\.com/)).toBeInTheDocument();
    expect(within(first).getByText(/\(312\) 555-0100/)).toBeInTheDocument();
    expect(within(first).getByText(/@ada/)).toBeInTheDocument();
    expect(within(first).getByText('1 year racing')).toBeInTheDocument();
    expect(within(second).queryByText('Captain')).toBeNull();
    expect(within(second).getByText('2 years racing')).toBeInTheDocument();
  });

  it('lays contact details out as separate, non-wrapping items', async () => {
    serve({
      people: [
        buildPerson({ instagram: '@ada' }),
        buildPerson({ id: 2, first_name: 'Bo', last_name: 'Z', email: 'bo@example.com', instagram: null }),
      ],
    });
    renderApp('/teams/9');
    await openRoster();
    const [first, second] = slots();
    const email = within(first).getByText('ada@example.com');
    expect(email).toHaveAttribute('title', 'ada@example.com');
    expect(email).toHaveClass('truncate');
    expect(within(first).getByText('(312) 555-0100')).toHaveClass('whitespace-nowrap');
    expect(within(first).queryByText('ZIP')).toBeNull();
    expect(within(first).getByText('@ada')).toHaveClass('whitespace-nowrap');
    expect(within(second).getByText('bo@example.com')).toBeInTheDocument();
    expect(within(second).queryByText(/^@/)).toBeNull();
  });
});

const eight = [dee, racer(2), racer(3), racer(4), racer(5), racer(6), racer(7), racer(8)];

const bo = () => buildPerson({ id: 2, first_name: 'Bo', last_name: 'Z', email: 'bo@example.com' });

describe('team captain', () => {
  const ada = () => buildPerson({ id: 1 });
  const captainRow = () => slots()[0];

  it('marks the captain from team.captain_id with a star, the badge and a highlight, not from the viewer email', async () => {
    serve({ people: [ada(), bo()], captainId: 2 });
    renderApp('/teams/9');
    await openRoster();
    expect(within(slots()[0]).queryByTestId('captain-star')).toBeNull();
    expect(within(slots()[0]).queryByText('Captain')).toBeNull();
    const row = slots()[1];
    expect(within(row).getByTestId('captain-star')).toBeInTheDocument();
    expect(within(row).getByText('Captain')).toBeInTheDocument();
    expect(row.querySelector('[data-captain="true"]')).toHaveClass('bg-flag/30');
    expect(screen.getAllByTestId('captain-star')).toHaveLength(1);
  });

  it('gives every other row a Make captain button, and the captain none', async () => {
    serve({ people: [ada(), bo()], captainId: 1 });
    renderApp('/teams/9');
    await openRoster();
    expect(within(slots()[0]).queryByRole('button', { name: /^Make / })).toBeNull();
    expect(within(slots()[1]).getByRole('button', { name: 'Make Bo Z captain' })).toHaveTextContent(
      'Make captain',
    );
  });

  it('moves the star at once, PUTs the person id, and keeps the server team', async () => {
    const team = serve({ people: [ada(), bo()], captainId: 1 });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.put('/api/v1/teams/9/captain', async ({ request }) => {
        await record(request);
        await gate;
        return HttpResponse.json({ team: { ...team, captain_id: 2 } });
      }),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: 'Make Bo Z captain' }));
    // Optimistic: the star is already on Bo's row while the request is held.
    await waitFor(() => expect(within(slots()[1]).getByTestId('captain-star')).toBeInTheDocument());
    expect(within(captainRow()).queryByTestId('captain-star')).toBeNull();
    // In flight: the remaining Make captain buttons are disabled.
    expect(screen.getByRole('button', { name: 'Make Ada L captain' })).toBeDisabled();
    release();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Make Ada L captain' })).toBeEnabled());
    expect(requests).toEqual([{ method: 'PUT', url: '/api/v1/teams/9/captain', body: { person_id: 2 } }]);
    expect(within(slots()[1]).getByTestId('captain-star')).toBeInTheDocument();
  });

  it('rolls the star back and shows the error when the request fails', async () => {
    serve({ people: [ada(), bo()], captainId: 1 });
    server.use(
      http.put('/api/v1/teams/9/captain', () =>
        HttpResponse.json(
          { error: 'Invalid', errors: { person_id: ['is not on this team'] } },
          { status: 422 },
        ),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: 'Make Bo Z captain' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('is not on this team');
    expect(within(captainRow()).getByTestId('captain-star')).toBeInTheDocument();
    expect(within(slots()[1]).queryByTestId('captain-star')).toBeNull();
    expect(screen.getByRole('button', { name: 'Make Bo Z captain' })).toBeEnabled();
  });

  it('shows a 403 (registration closed since the page loaded) in the page banner and rolls back', async () => {
    serve({ people: [ada(), bo()], captainId: 1 });
    server.use(
      http.put('/api/v1/teams/9/captain', () =>
        HttpResponse.json({ error: 'Registration is closed.', errors: {} }, { status: 403 }),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: 'Make Bo Z captain' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Registration is closed.');
    expect(within(captainRow()).getByTestId('captain-star')).toBeInTheDocument();
  });

  it('offers no Make captain once registration has closed, while Edit stays', async () => {
    serve({ people: [ada(), bo()], captainId: 1, race: { open_for_registration: false } });
    renderApp('/teams/9');
    await openRoster();
    expect(screen.getByRole('button', { name: 'Edit Bo Z' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Make / })).toBeNull();
  });

  it('stars you, with no hint, when adding yourself makes you captain', async () => {
    server.use(
      http.post('/api/v1/teams/9/people', () =>
        HttpResponse.json(
          {
            person: ada(),
            checklist: buildChecklist({ racers: { filled: 2, total: 5, captain: true, done: false } }),
            captain_id: 1,
          },
          { status: 201 },
        ),
      ),
    );
    serve({ people: [bo()] });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    expect(screen.getByText('Choose one racer as your team captain.')).toBeInTheDocument();
    await u.click(await screen.findByRole('button', { name: 'Add yourself' }));
    await u.type(screen.getByLabelText('Years racing'), '2');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(slots()[1]).getByTestId('captain-star')).toBeInTheDocument());
    expect(within(slots()[1]).queryByRole('button', { name: /^Make / })).toBeNull();
    expect(screen.queryByText('Choose one racer as your team captain.')).toBeNull();
  });

  it('asks for a new captain after the captain is removed', async () => {
    serve({ people: [ada(), bo()], captainId: 2 });
    server.use(
      http.delete('/api/v1/teams/9/people/2', () =>
        HttpResponse.json({
          checklist: buildChecklist({ racers: { filled: 1, total: 5, captain: false, done: false } }),
          captain_id: null,
        }),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    expect(screen.queryByText('Choose one racer as your team captain.')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Remove Bo Z' }));
    await u.click(screen.getByRole('button', { name: 'Yes, remove' }));
    expect(await screen.findByText('Choose one racer as your team captain.')).toBeInTheDocument();
    expect(screen.queryByTestId('captain-star')).toBeNull();
  });

  it('hides Remove on a team that is complete except for its captain', async () => {
    const five = ['Ada', 'Bo', 'Cy', 'Di', 'Ed'].map((name, index) =>
      buildPerson({ id: index + 1, first_name: name, last_name: 'Z', email: `${name.toLowerCase()}@example.com` }),
    );
    const paid = buildChecklist().fee;
    serve({
      people: five,
      checklist: {
        racers: { filled: 5, total: 5, captain: false, done: false },
        fee: { ...paid, done: true, amount_due_cents: null, requirement_id: null, items: [] },
      },
    });
    renderApp('/teams/9');
    await openRoster();
    expect(screen.getByRole('button', { name: 'Make Bo Z captain' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('asks the racers to choose a captain while the roster has people and no captain', async () => {
    serve({ people: [ada()], captainId: null });
    renderApp('/teams/9');
    await openRoster();
    expect(screen.getByText('Choose one racer as your team captain.')).toBeInTheDocument();
    expect(screen.queryByTestId('captain-star')).toBeNull();
  });

  it('has no hint for an empty roster or once a captain is chosen', async () => {
    serve({ people: [] });
    const { queryClient } = renderApp('/teams/9');
    await openRoster();
    expect(screen.queryByText('Choose one racer as your team captain.')).toBeNull();

    serve({ people: [ada()], captainId: 1 });
    await act(() => queryClient.invalidateQueries({ queryKey: ['team', '9'] }));
    await screen.findByText('Ada L');
    expect(screen.queryByText('Choose one racer as your team captain.')).toBeNull();
  });

  it('keeps naming the captain, with a star, in the collapsed finalized card', async () => {
    const five = ['Ada', 'Bo', 'Cy', 'Di', 'Ed'].map((name, index) =>
      buildPerson({ id: index + 1, first_name: name, last_name: 'Z', email: `${name.toLowerCase()}@example.com` }),
    );
    serve({
      people: five,
      captainId: 3,
      checklist: { finalized: true, racers: { filled: 5, total: 5, captain: true, done: true } },
    });
    renderApp('/teams/9');
    const roster = await openRoster();
    const summary = within(roster).getByTestId('captain-summary');
    expect(summary).toHaveTextContent('Captain: Cy Z');
    expect(summary.querySelector('svg')).not.toBeNull();
    expect(within(roster).getByRole('button', { name: 'Show racers' })).toBeInTheDocument();
  });

  it('collapses a finalized full team that never had a captain, with no summary line', async () => {
    const five = ['Ada', 'Bo', 'Cy', 'Di', 'Ed'].map((name, index) =>
      buildPerson({ id: index + 1, first_name: name, last_name: 'Z', email: `${name.toLowerCase()}@example.com` }),
    );
    serve({
      people: five,
      checklist: { finalized: true, racers: { filled: 5, total: 5, captain: false, done: false } },
    });
    renderApp('/teams/9');
    const roster = await openRoster();
    expect(within(roster).getByRole('button', { name: 'Show racers' })).toBeInTheDocument();
    expect(within(roster).queryByTestId('captain-summary')).toBeNull();
  });

  it('offers Add yourself when the captain is someone else and you are not on the roster', async () => {
    serve({ people: [bo()], captainId: 2 });
    renderApp('/teams/9');
    await openRoster();
    expect(await screen.findByRole('button', { name: 'Add yourself' })).toBeInTheDocument();
  });

  it('hides Add yourself once your email is on the roster, even if you are not the captain', async () => {
    serve({ people: [ada(), bo()], captainId: 2 });
    renderApp('/teams/9');
    await openRoster();
    expect(screen.getByRole('button', { name: '+ Add someone new' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add yourself' })).toBeNull();
  });
});

describe('the actions under the list', () => {
  it('offers one picker button, one add button and the open-spots count', async () => {
    serve({ people: [buildPerson(), bo()], past: eight });
    renderApp('/teams/9');
    await openRosterWithPicker(8);
    expect(screen.getAllByRole('button', { name: /^Pick racers from past teams/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '+ Add someone new' })).toHaveLength(1);
    expect(screen.getByText('3 spots to fill')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Past racers' })).toBeNull();
    expect(screen.queryByText(/more$/)).toBeNull();
    expect(slots()).toHaveLength(3);
  });

  it('hides the picker button when there are no past racers', async () => {
    serve({ people: [buildPerson()], past: [] });
    const { queryClient } = renderApp('/teams/9');
    await openRoster();
    await waitFor(() =>
      expect(queryClient.getQueryState(['past-racers', '9'])?.status).toBe('success'),
    );
    expect(screen.queryByRole('button', { name: /^Pick racers from past teams/ })).toBeNull();
    expect(screen.getByRole('button', { name: '+ Add someone new' })).toBeInTheDocument();
  });

  it('does not count people already on the team', async () => {
    serve({ people: [buildPerson({ email: 'DEE@example.com' })], past: [dee, racer(2)] });
    renderApp('/teams/9');
    await openRosterWithPicker(1);
  });

  it('offers nothing and reads "3 open spots" once registration is closed', async () => {
    serve({
      people: [buildPerson(), bo()],
      past: eight,
      race: { open_for_registration: false },
    });
    renderApp('/teams/9');
    await openRoster();
    expect(slots()[2]).toHaveTextContent('3 open spots');
    expect(screen.queryByRole('button', { name: /^Pick racers from past teams/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add someone new' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add yourself' })).toBeNull();
  });
});

describe('the crew picker from the roster', () => {
  const fillAll = async (u: ReturnType<typeof userEvent.setup>) => {
    for (const label of ['Name', 'Email', 'Phone', 'Years racing', 'Instagram', 'TikTok']) {
      await u.click(screen.getByRole('checkbox', { name: new RegExp(`^${label}: `) }));
    }
  };

  it('adds a picked racer, updates the pill and the count, and Escape returns focus', async () => {
    serve({ people: [buildPerson(), bo()], past: eight });
    server.use(
      http.post('/api/v1/teams/9/people', async ({ request }) => {
        await record(request);
        return HttpResponse.json(
          {
            person: buildPerson({ id: 7, first_name: 'Dee', last_name: 'Lamb', email: 'dee@example.com' }),
            checklist: buildChecklist({ racers: { filled: 3, total: 5, captain: false, done: false } }),
          },
          { status: 201 },
        );
      }),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(8);
    await u.click(screen.getByRole('button', { name: 'Pick racers from past teams (8)' }));
    expect(await screen.findByRole('dialog', { name: 'Pick racers from past teams' })).toBeInTheDocument();
    await u.click(screen.getByRole('checkbox', { name: /^Dee Lamb/ }));
    await u.click(screen.getByRole('button', { name: 'Review 1 racer' }));
    await fillAll(u);
    await u.click(screen.getByRole('button', { name: 'Add Dee to the team' }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Racer slots' })).getByText('Dee Lamb')).toBeInTheDocument();
    expect(screen.getByText('3 of 5')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Pick racers from past teams (7)' })).toBeInTheDocument();
  });

  it('closes itself and moves focus to the list when the last spot is filled', async () => {
    serve({ people: [buildPerson()], past: [dee], race: { people_per_team: 2 } });
    server.use(
      http.post('/api/v1/teams/9/people', () =>
        HttpResponse.json(
          {
            person: buildPerson({ id: 7, first_name: 'Dee', last_name: 'Lamb', email: 'dee@example.com' }),
            checklist: buildChecklist({ racers: { filled: 2, total: 2, captain: true, done: true } }),
          },
          { status: 201 },
        ),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(1);
    await u.click(screen.getByRole('button', { name: 'Pick racers from past teams (1)' }));
    await u.click(await screen.findByRole('checkbox', { name: /^Dee Lamb/ }));
    await u.click(screen.getByRole('button', { name: 'Review 1 racer' }));
    await fillAll(u);
    await u.click(screen.getByRole('button', { name: 'Add Dee to the team' }));
    await screen.findByText('Dee Lamb');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Racer slots' })).toHaveFocus(),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Dee Lamb added');
  });

  it('moves focus to "+ Add someone new" when the last past racer is picked and spots remain', async () => {
    serve({ people: [buildPerson()], past: [dee] });
    server.use(
      http.post('/api/v1/teams/9/people', () =>
        HttpResponse.json(
          {
            person: buildPerson({ id: 7, first_name: 'Dee', last_name: 'Lamb', email: 'dee@example.com' }),
            checklist: buildChecklist({ racers: { filled: 2, total: 5, captain: false, done: false } }),
          },
          { status: 201 },
        ),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(1);
    await u.click(screen.getByRole('button', { name: 'Pick racers from past teams (1)' }));
    await u.click(await screen.findByRole('checkbox', { name: /^Dee Lamb/ }));
    await u.click(screen.getByRole('button', { name: 'Review 1 racer' }));
    await fillAll(u);
    await u.click(screen.getByRole('button', { name: 'Add Dee to the team' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: /^Pick racers from past teams/ })).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '+ Add someone new' })).toHaveFocus(),
    );
  });

  it('does not offer a racer again after their email was changed in review', async () => {
    serve({ people: [buildPerson(), bo()], past: eight });
    server.use(
      http.post('/api/v1/teams/9/people', async ({ request }) => {
        await record(request);
        return HttpResponse.json(
          {
            person: buildPerson({ id: 7, first_name: 'Dee', last_name: 'Lamb', email: 'dee.new@example.com' }),
            checklist: buildChecklist({ racers: { filled: 3, total: 5, captain: false, done: false } }),
          },
          { status: 201 },
        );
      }),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(8);
    await u.click(screen.getByRole('button', { name: 'Pick racers from past teams (8)' }));
    await u.click(await screen.findByRole('checkbox', { name: /^Dee Lamb/ }));
    await u.click(screen.getByRole('button', { name: 'Review 1 racer' }));
    await u.click(screen.getByRole('button', { name: 'Change email' }));
    const email = screen.getByRole('textbox', { name: 'Email' });
    await u.clear(email);
    await u.type(email, 'dee.new@example.com');
    await u.click(screen.getByRole('button', { name: 'Done' }));
    await fillAll(u);
    // fillAll ticked Email off again; tick it back on.
    await u.click(screen.getByRole('checkbox', { name: /^Email: / }));
    await u.click(screen.getByRole('button', { name: 'Add Dee to the team' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requests[0].body).toMatchObject({ person: { email: 'dee.new@example.com' } });
    expect(await screen.findByRole('button', { name: 'Pick racers from past teams (7)' })).toBeInTheDocument();
  });

  it('Escape closes the dialog and returns focus to the picker button', async () => {
    serve({ people: [buildPerson()], past: eight });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(8);
    const button = screen.getByRole('button', { name: 'Pick racers from past teams (8)' });
    await u.click(button);
    await screen.findByRole('dialog', { name: 'Pick racers from past teams' });
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
    expect(requests).toEqual([]);
  });
});

describe('Add yourself', () => {
  it('opens the form filled from the account when you were never a past racer', async () => {
    server.use(
      http.get('/api/v1/me', () =>
        HttpResponse.json({ user: { ...user, first_name: 'Mo', last_name: 'Ng', email: 'mo@example.com', phone: '312-555-0199' } }),
      ),
    );
    serve({ people: [buildPerson()], past: eight });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(8);
    await u.click(await screen.findByRole('button', { name: 'Add yourself' }));
    expect(screen.getByRole('form', { name: 'Add a racer' })).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveValue('Mo');
    expect(screen.getByLabelText('Last name')).toHaveValue('Ng');
    expect(screen.getByLabelText('Email')).toHaveValue('mo@example.com');
    expect(screen.getByLabelText('Phone')).toHaveValue('(312) 555-0199');
    expect(screen.queryByRole('button', { name: 'Add yourself' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add someone new' })).toBeNull();
  });

  it('opens the review for your own past-racer record', async () => {
    server.use(
      http.get('/api/v1/me', () =>
        HttpResponse.json({ user: { ...user, first_name: 'Dee', last_name: 'Lamb', email: 'Dee@Example.com' } }),
      ),
    );
    serve({ people: [buildPerson({ email: 'someone@example.com' })], past: eight });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(8);
    await u.click(await screen.findByRole('button', { name: 'Add yourself' }));
    expect(await screen.findByRole('heading', { name: 'Review Dee Lamb' })).toBeInTheDocument();
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
  });

  it('puts focus on "+ Add someone new" once your review is saved and the button is gone', async () => {
    server.use(
      http.get('/api/v1/me', () =>
        HttpResponse.json({ user: { ...user, first_name: 'Dee', last_name: 'Lamb', email: 'dee@example.com' } }),
      ),
      http.post('/api/v1/teams/9/people', () =>
        HttpResponse.json(
          {
            person: buildPerson({ id: 7, first_name: 'Dee', last_name: 'Lamb', email: 'dee@example.com' }),
            checklist: buildChecklist({ racers: { filled: 2, total: 5, captain: false, done: false } }),
          },
          { status: 201 },
        ),
      ),
    );
    serve({ people: [buildPerson({ email: 'someone@example.com' })], past: eight });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(8);
    await u.click(await screen.findByRole('button', { name: 'Add yourself' }));
    await screen.findByRole('heading', { name: 'Review Dee Lamb' });
    for (const label of ['Name', 'Email', 'Phone', 'Years racing', 'Instagram', 'TikTok']) {
      await u.click(screen.getByRole('checkbox', { name: new RegExp(`^${label}: `) }));
    }
    await u.click(screen.getByRole('button', { name: 'Add Dee to the team' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Add yourself' })).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '+ Add someone new' })).toHaveFocus(),
    );
  });

  it('is hidden when someone on the team has your email', async () => {
    serve({ people: [buildPerson({ email: 'ADA@example.com' })], past: eight });
    renderApp('/teams/9');
    await openRosterWithPicker(8);
    expect(screen.queryByRole('button', { name: 'Add yourself' })).toBeNull();
  });
});

describe('collapsed when full on load', () => {
  const five = ['Ada', 'Bo', 'Cy', 'Di', 'Ed'].map((name, index) =>
    buildPerson({ id: index + 1, first_name: name, last_name: 'Z', email: `${name.toLowerCase()}@example.com` }),
  );
  const full = { racers: { filled: 5, total: 5, captain: true, done: true } };

  it('shows the first names and a Show racers button, then the rows', async () => {
    serve({ people: five, checklist: full });
    const u = userEvent.setup();
    renderApp('/teams/9');
    const roster = await openRoster();
    expect(within(roster).getByText('Ada, Bo, Cy, Di, Ed')).toBeInTheDocument();
    expect(within(roster).queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Racer slots' })).toBeNull();
    await u.click(within(roster).getByRole('button', { name: 'Show racers' }));
    expect(slots()).toHaveLength(5);
    expect(within(roster).getAllByRole('button', { name: /^Edit / })).toHaveLength(5);
    expect(within(roster).queryByRole('button', { name: 'Show racers' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Racer slots' })).toHaveFocus();
  });

  it('shows the rows again when a spot opens later', async () => {
    serve({ people: five, checklist: full });
    const { queryClient } = renderApp('/teams/9');
    const roster = await openRoster();
    expect(within(roster).getByRole('button', { name: 'Show racers' })).toBeInTheDocument();

    serve({ people: five.slice(0, 4) });
    await act(() => queryClient.invalidateQueries({ queryKey: ['team', '9'] }));
    expect(await screen.findByText('1 spot to fill')).toBeInTheDocument();
    expect(slots()).toHaveLength(5);
    expect(within(roster).queryByRole('button', { name: 'Show racers' })).toBeNull();
  });

  it('keeps the rows visible when the team fills up during the visit', async () => {
    serve({ people: five.slice(0, 4) });
    server.use(
      http.post('/api/v1/teams/9/people', () =>
        HttpResponse.json(
          {
            person: buildPerson({ id: 9, first_name: 'Dee', last_name: 'Lamb', email: 'dee@example.com' }),
            checklist: buildChecklist({ racers: { filled: 5, total: 5, captain: true, done: true } }),
          },
          { status: 201 },
        ),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: '+ Add someone new' }));
    await u.type(screen.getByLabelText('First name'), 'Dee');
    await u.type(screen.getByLabelText('Last name'), 'Lamb');
    await u.type(screen.getByLabelText('Email'), 'dee@example.com');
    await u.type(screen.getByLabelText('Phone'), '3125550144');
    await u.type(screen.getByLabelText('Years racing'), '1');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Dee Lamb');
    expect(slots()).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Show racers' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Dee Lamb' })).toBeInTheDocument();
  });
});

describe('collapsing when the team finishes', () => {
  const five = ['Ada', 'Bo', 'Cy', 'Di', 'Ed'].map((name, index) =>
    buildPerson({ id: index + 1, first_name: name, last_name: 'Z', email: `${name.toLowerCase()}@example.com` }),
  );
  const full = { racers: { filled: 5, total: 5, captain: true, done: true } };

  it('collapses when the team becomes finalized during the visit', async () => {
    serve({ people: five, checklist: full });
    const u = userEvent.setup();
    const { queryClient } = renderApp('/teams/9');
    const roster = await openRoster();
    await u.click(within(roster).getByRole('button', { name: 'Show racers' }));
    expect(slots()).toHaveLength(5);

    serve({
      people: five,
      checklist: { ...full, finalized: true, remaining: 0, team_number: 4, classy_fundraising_url: 'https://x.example' },
    });
    await act(() => queryClient.invalidateQueries({ queryKey: ['team', '9'] }));
    expect(await within(roster).findByText('Ada, Bo, Cy, Di, Ed')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Racer slots' })).toBeNull();
  });

  it('toggles with aria-expanded, a hidden chevron and Hide racers', async () => {
    serve({ people: five, checklist: full });
    const u = userEvent.setup();
    renderApp('/teams/9');
    const roster = await openRoster();
    const show = within(roster).getByRole('button', { name: 'Show racers' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    expect(show.querySelector('svg[aria-hidden="true"]')).not.toBeNull();

    await u.click(show);
    const hide = within(roster).getByRole('button', { name: 'Hide racers' });
    expect(hide).toHaveAttribute('aria-expanded', 'true');
    expect(hide.querySelector('svg[aria-hidden="true"]')).not.toBeNull();

    await u.click(hide);
    expect(screen.queryByRole('list', { name: 'Racer slots' })).toBeNull();
    expect(within(roster).getByRole('button', { name: 'Show racers' })).toHaveFocus();
  });

  it('offers no Hide racers while a spot is open', async () => {
    serve({ people: five.slice(0, 4) });
    renderApp('/teams/9');
    await openRoster();
    expect(screen.queryByRole('button', { name: 'Hide racers' })).toBeNull();
  });
});

describe('adding someone new', () => {
  it('posts phone as ddd-ddd-dddd when the user typed digits', async () => {
    serve();
    server.use(
      http.post('/api/v1/teams/9/people', async ({ request }) => {
        await record(request);
        return HttpResponse.json({ person: buildPerson({ id: 8 }), checklist: buildChecklist() }, { status: 201 });
      }),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: '+ Add someone new' }));
    expect(screen.getByLabelText('First name')).toHaveFocus();
    await u.type(screen.getByLabelText('First name'), 'Dee');
    await u.type(screen.getByLabelText('Last name'), 'Lamb');
    await u.type(screen.getByLabelText('Email'), 'Dee@Example.com');
    await u.type(screen.getByLabelText('Phone'), '3125550144');
    expect(screen.getByLabelText('Years racing')).toHaveFocus();
    await u.type(screen.getByLabelText('Years racing'), '0');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].body).toEqual({
      person: {
        first_name: 'Dee',
        last_name: 'Lamb',
        email: 'dee@example.com',
        phone: '312-555-0144',
        experience: 0,
        instagram: '',
        tiktok: '',
      },
    });
  });

  async function fillAndSave(u: ReturnType<typeof userEvent.setup>) {
    await u.click(screen.getByRole('button', { name: '+ Add someone new' }));
    await u.type(screen.getByLabelText('First name'), 'Dee');
    await u.type(screen.getByLabelText('Last name'), 'Lamb');
    await u.type(screen.getByLabelText('Email'), 'dee@example.com');
    await u.type(screen.getByLabelText('Phone'), '312555');
    await u.type(screen.getByLabelText('Years racing'), '1');
    await u.click(screen.getByRole('button', { name: 'Save' }));
  }

  it('shows a server 422 phone error under Phone and keeps the form open', async () => {
    serve();
    server.use(
      http.post('/api/v1/teams/9/people', () =>
        HttpResponse.json(
          { error: 'invalid', errors: { phone: ['should be in the form 555-867-5309'] } },
          { status: 422 },
        ),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await fillAndSave(u);
    const phone = await screen.findByLabelText('Phone');
    await waitFor(() =>
      expect(phone).toHaveAccessibleDescription('should be in the form 555-867-5309'),
    );
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('First name')).toHaveValue('Dee');
  });

  it('shows maximum/generic errors as a form-level alert', async () => {
    serve();
    server.use(
      http.post('/api/v1/teams/9/people', () =>
        HttpResponse.json(
          { error: 'invalid', errors: { maximum: ['people already added to this team'] } },
          { status: 422 },
        ),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await fillAndSave(u);
    expect(await screen.findByRole('alert')).toHaveTextContent('people already added to this team');
  });

  it('Cancel closes the form without posting and restores the add button', async () => {
    serve();
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: '+ Add someone new' }));
    await u.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('First name')).toBeNull();
    expect(requests).toEqual([]);
    const add = screen.getByRole('button', { name: '+ Add someone new' });
    expect(add).toBeInTheDocument();
    expect(add).toHaveFocus();
  });

  async function addPerson(u: ReturnType<typeof userEvent.setup>) {
    await u.click(screen.getByRole('button', { name: '+ Add someone new' }));
    await u.type(screen.getByLabelText('First name'), 'Dee');
    await u.type(screen.getByLabelText('Last name'), 'Lamb');
    await u.type(screen.getByLabelText('Email'), 'dee@example.com');
    await u.type(screen.getByLabelText('Phone'), '3125550144');
    await u.type(screen.getByLabelText('Years racing'), '1');
    await u.click(screen.getByRole('button', { name: 'Save' }));
  }

  it('moves focus to "+ Add someone new" after saving while a spot is still open', async () => {
    serve({ people: [buildPerson()] });
    server.use(
      http.post('/api/v1/teams/9/people', () =>
        HttpResponse.json(
          {
            person: buildPerson({ id: 7, first_name: 'Dee', last_name: 'Lamb', email: 'dee@example.com' }),
            checklist: buildChecklist({ racers: { filled: 2, total: 5, captain: false, done: false } }),
          },
          { status: 201 },
        ),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await addPerson(u);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '+ Add someone new' })).toHaveFocus(),
    );
  });

  it('moves focus to the new person\'s Edit button after saving the last open spot', async () => {
    serve({ people: [buildPerson()], race: { people_per_team: 2 } });
    server.use(
      http.post('/api/v1/teams/9/people', () =>
        HttpResponse.json(
          {
            person: buildPerson({ id: 7, first_name: 'Dee', last_name: 'Lamb', email: 'dee@example.com' }),
            checklist: buildChecklist({ racers: { filled: 2, total: 2, captain: true, done: true } }),
          },
          { status: 201 },
        ),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await addPerson(u);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit Dee Lamb' })).toHaveFocus(),
    );
  });
});

describe('editing and removing', () => {
  const people = [
    buildPerson(),
    buildPerson({ id: 2, first_name: 'Bo', last_name: 'Z', email: 'bo@example.com', instagram: null }),
  ];

  it('Edit opens a pre-filled form and PATCHes on Save', async () => {
    serve({ people });
    server.use(
      http.patch('/api/v1/teams/9/people/2', async ({ request }) => {
        await record(request);
        return HttpResponse.json({
          person: buildPerson({ id: 2, first_name: 'Bobby', last_name: 'Z', email: 'bo@example.com', experience: 1 }),
          checklist: buildChecklist(),
        });
      }),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    const edit = screen.getByRole('button', { name: 'Edit Bo Z' });
    await u.click(edit);
    expect(screen.getByLabelText('First name')).toHaveValue('Bo');
    expect(screen.getByLabelText('Phone')).toHaveValue('(312) 555-0100');
    await u.clear(screen.getByLabelText('First name'));
    await u.type(screen.getByLabelText('First name'), 'Bobby');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].method).toBe('PATCH');
    expect(requests[0].body).toMatchObject({
      person: { first_name: 'Bobby', last_name: 'Z', phone: '312-555-0100', experience: 1 },
    });
    expect(await screen.findByText('Bobby Z')).toBeInTheDocument();
    expect(screen.queryByLabelText('First name')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Bobby Z' })).toHaveFocus());
  });

  it('shows no email error when a racer is edited without changing their email', async () => {
    serve({ people });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: 'Edit Bo Z' }));
    await u.click(screen.getByLabelText('Email'));
    await u.tab();
    expect(screen.getByLabelText('Email')).not.toBeInvalid();
    expect(screen.queryByText('Is already on this team')).toBeNull();

    // Changing it to another racer's email is still caught.
    await u.clear(screen.getByLabelText('Email'));
    await u.type(screen.getByLabelText('Email'), 'ada@example.com');
    await u.tab();
    expect(screen.getByText('Is already on this team')).toBeInTheDocument();
  });

  it('flags a roster duplicate when tabbing out of the email on a new racer', async () => {
    serve({ people });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: '+ Add someone new' }));
    await u.type(screen.getByLabelText('Email'), 'BO@example.com');
    await u.tab();
    expect(screen.getByText('Is already on this team')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInvalid();
  });

  it('Edit then Cancel restores focus to Edit and does not save', async () => {
    serve({ people });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: 'Edit Bo Z' }));
    await u.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Edit Bo Z' })).toHaveFocus();
    expect(requests).toEqual([]);
  });

  it('Remove asks for confirmation inside the slot and only then DELETEs', async () => {
    serve({ people });
    server.use(
      http.delete('/api/v1/teams/9/people/2', async ({ request }) => {
        await record(request);
        return HttpResponse.json({ checklist: buildChecklist({ racers: { filled: 1, total: 5, captain: false, done: false } }) });
      }),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: 'Remove Bo Z' }));
    expect(requests).toEqual([]);
    expect(within(slots()[1]).getByText('Remove Bo from this team?')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByText('Remove Bo from this team?')).toBeNull();
    expect(requests).toEqual([]);

    await u.click(screen.getByRole('button', { name: 'Remove Bo Z' }));
    await u.click(screen.getByRole('button', { name: 'Yes, remove' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].method).toBe('DELETE');
    await waitFor(() => expect(screen.queryByText('Bo Z')).toBeNull());
    expect(screen.getByText('1 of 5')).toBeInTheDocument();
    expect(slots()).toHaveLength(2);
    expect(slots()[1]).toHaveTextContent('4 spots to fill');
  });

  it('reloads the past racers after a removal, so the person can be picked again', async () => {
    serve({ people, past: [dee] });
    let pastLoads = 0;
    server.use(
      http.get('/api/v1/teams/9/past_racers', () => {
        pastLoads += 1;
        return HttpResponse.json({ past_racers: [dee] });
      }),
      http.delete('/api/v1/teams/9/people/2', () =>
        HttpResponse.json({ checklist: buildChecklist({ racers: { filled: 1, total: 5, captain: false, done: false } }) }),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(1);
    expect(pastLoads).toBe(1);
    await u.click(screen.getByRole('button', { name: 'Remove Bo Z' }));
    await u.click(screen.getByRole('button', { name: 'Yes, remove' }));
    await waitFor(() => expect(screen.queryByText('Bo Z')).toBeNull());
    await waitFor(() => expect(pastLoads).toBe(2));
  });

  it('shows the server message when removal is refused (team complete)', async () => {
    serve({ people });
    server.use(
      http.delete('/api/v1/teams/9/people/2', () =>
        HttpResponse.json({ error: 'Your team is complete and cannot lose a racer.' }, { status: 422 }),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: 'Remove Bo Z' }));
    await u.click(screen.getByRole('button', { name: 'Yes, remove' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your team is complete and cannot lose a racer.');
    expect(screen.getByText('Bo Z')).toBeInTheDocument();
  });

  it('hides Remove once the team is finalized', async () => {
    serve({
      people,
      checklist: { finalized: true, remaining: 0, team_number: 4, classy_fundraising_url: 'https://x.example' },
    });
    renderApp('/teams/9');
    await openRoster();
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Bo Z' })).toBeInTheDocument();
  });
});

describe('registration closed', () => {
  it('hides the actions and remove but still allows Edit', async () => {
    serve({
      people: [buildPerson(), buildPerson({ id: 2, first_name: 'Bo', email: 'bo@example.com' })],
      past: [dee, racer(2)],
      race: { open_for_registration: false },
    });
    renderApp('/teams/9');
    const roster = await openRoster();
    expect(slots()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: '+ Add someone new' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Pick racers from past teams/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
    expect(within(roster).getAllByRole('button', { name: /^Edit / })).toHaveLength(2);
  });

  it('surfaces a server 403 on Edit through the page banner', async () => {
    serve({ people: [buildPerson()], race: { open_for_registration: false } });
    server.use(
      http.patch('/api/v1/teams/9/people/1', () =>
        HttpResponse.json({ error: 'Registration is closed for this race.' }, { status: 403 }),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRoster();
    await u.click(screen.getByRole('button', { name: 'Edit Ada L' }));
    await u.type(screen.getByLabelText('Years racing'), '2');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Registration is closed for this race.')).toBeInTheDocument();
  });
});
