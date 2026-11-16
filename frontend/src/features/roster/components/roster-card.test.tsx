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
  zipcode: '60614',
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
}

let requests: Array<{ method: string; url: string; body: unknown }>;

function serve({ people = [], past = [], race = {}, checklist = {} }: Setup = {}) {
  const team: Team = buildTeam({
    people,
    race: buildRace(race),
    checklist: buildChecklist({
      racers: { filled: people.length, total: 5, done: false },
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
  await screen.findByRole('button', { name: `Pick from past teams (${count})` });
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
    });
    renderApp('/teams/9');
    await openRoster();
    const [first, second] = slots();
    expect(within(first).getByText('AL')).toBeInTheDocument();
    expect(within(first).getByText('Ada L')).toBeInTheDocument();
    expect(within(first).getByText('Captain')).toBeInTheDocument();
    expect(within(first).getByText(/ada@example\.com/)).toBeInTheDocument();
    expect(within(first).getByText(/\(312\) 555-0100/)).toBeInTheDocument();
    expect(within(first).getByText(/60601/)).toBeInTheDocument();
    expect(within(first).getByText(/@ada/)).toBeInTheDocument();
    expect(within(first).getByText('Raced once before')).toBeInTheDocument();
    expect(within(second).queryByText('Captain')).toBeNull();
    expect(within(second).getByText('Twice')).toBeInTheDocument();
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
    expect(within(first).getByText('60601')).toHaveClass('whitespace-nowrap');
    expect(within(first).getByText('ZIP')).toBeInTheDocument();
    expect(within(first).getByText('@ada')).toHaveClass('whitespace-nowrap');
    expect(within(second).getByText('bo@example.com')).toBeInTheDocument();
    expect(within(second).queryByText(/^@/)).toBeNull();
  });

  it('marks the first person matching the signed-in email (case-insensitive) as captain', async () => {
    serve({
      people: [
        buildPerson({ id: 2, first_name: 'Bo', email: 'bo@example.com' }),
        buildPerson({ id: 3, first_name: 'Ada', email: 'Ada@Example.com' }),
      ],
    });
    renderApp('/teams/9');
    await openRoster();
    expect(within(slots()[0]).queryByText('Captain')).toBeNull();
    expect(within(slots()[1]).getByText('Captain')).toBeInTheDocument();
  });
});

const eight = [dee, racer(2), racer(3), racer(4), racer(5), racer(6), racer(7), racer(8)];

const bo = () => buildPerson({ id: 2, first_name: 'Bo', last_name: 'Z', email: 'bo@example.com' });

describe('the actions under the list', () => {
  it('offers one picker button, one add button and the open-spots count', async () => {
    serve({ people: [buildPerson(), bo()], past: eight });
    renderApp('/teams/9');
    await openRosterWithPicker(8);
    expect(screen.getAllByRole('button', { name: /^Pick from past teams/ })).toHaveLength(1);
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
    expect(screen.queryByRole('button', { name: /^Pick from past teams/ })).toBeNull();
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
    expect(screen.queryByRole('button', { name: /^Pick from past teams/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add someone new' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add yourself' })).toBeNull();
  });
});

describe('the crew picker from the roster', () => {
  const fillAll = async (u: ReturnType<typeof userEvent.setup>) => {
    for (const label of ['Name', 'Email', 'Phone', 'ZIP code', 'Years racing', 'Instagram']) {
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
            checklist: buildChecklist({ racers: { filled: 3, total: 5, done: false } }),
          },
          { status: 201 },
        );
      }),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(8);
    await u.click(screen.getByRole('button', { name: 'Pick from past teams (8)' }));
    expect(await screen.findByRole('dialog', { name: 'Pick from past teams' })).toBeInTheDocument();
    await u.click(screen.getByRole('checkbox', { name: /^Dee Lamb/ }));
    await u.click(screen.getByRole('button', { name: 'Review 1 racer' }));
    await fillAll(u);
    await u.click(screen.getByRole('button', { name: 'Add Dee to the team' }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Racer slots' })).getByText('Dee Lamb')).toBeInTheDocument();
    expect(screen.getByText('3 of 5')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Pick from past teams (7)' })).toBeInTheDocument();
  });

  it('closes itself and moves focus to the list when the last spot is filled', async () => {
    serve({ people: [buildPerson()], past: [dee], race: { people_per_team: 2 } });
    server.use(
      http.post('/api/v1/teams/9/people', () =>
        HttpResponse.json(
          {
            person: buildPerson({ id: 7, first_name: 'Dee', last_name: 'Lamb', email: 'dee@example.com' }),
            checklist: buildChecklist({ racers: { filled: 2, total: 2, done: true } }),
          },
          { status: 201 },
        ),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(1);
    await u.click(screen.getByRole('button', { name: 'Pick from past teams (1)' }));
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
            checklist: buildChecklist({ racers: { filled: 2, total: 5, done: false } }),
          },
          { status: 201 },
        ),
      ),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(1);
    await u.click(screen.getByRole('button', { name: 'Pick from past teams (1)' }));
    await u.click(await screen.findByRole('checkbox', { name: /^Dee Lamb/ }));
    await u.click(screen.getByRole('button', { name: 'Review 1 racer' }));
    await fillAll(u);
    await u.click(screen.getByRole('button', { name: 'Add Dee to the team' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: /^Pick from past teams/ })).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '+ Add someone new' })).toHaveFocus(),
    );
  });

  it('Escape closes the dialog and returns focus to the picker button', async () => {
    serve({ people: [buildPerson()], past: eight });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithPicker(8);
    const button = screen.getByRole('button', { name: 'Pick from past teams (8)' });
    await u.click(button);
    await screen.findByRole('dialog', { name: 'Pick from past teams' });
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
    expect(screen.getByLabelText('ZIP code')).toHaveValue('');
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
            checklist: buildChecklist({ racers: { filled: 2, total: 5, done: false } }),
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
    for (const label of ['Name', 'Email', 'Phone', 'ZIP code', 'Years racing', 'Instagram']) {
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
  const full = { racers: { filled: 5, total: 5, done: true } };

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
            checklist: buildChecklist({ racers: { filled: 5, total: 5, done: true } }),
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
    await u.type(screen.getByLabelText('ZIP code'), '60614');
    await u.selectOptions(screen.getByLabelText('Years racing'), '1');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Dee Lamb');
    expect(slots()).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Show racers' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Dee Lamb' })).toBeInTheDocument();
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
    expect(screen.getByLabelText('ZIP code')).toHaveFocus();
    await u.type(screen.getByLabelText('ZIP code'), '60614');
    await u.selectOptions(screen.getByLabelText('Years racing'), '0');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].body).toEqual({
      person: {
        first_name: 'Dee',
        last_name: 'Lamb',
        email: 'dee@example.com',
        phone: '312-555-0144',
        zipcode: '60614',
        experience: 0,
        instagram: '',
      },
    });
  });

  async function fillAndSave(u: ReturnType<typeof userEvent.setup>) {
    await u.click(screen.getByRole('button', { name: '+ Add someone new' }));
    await u.type(screen.getByLabelText('First name'), 'Dee');
    await u.type(screen.getByLabelText('Last name'), 'Lamb');
    await u.type(screen.getByLabelText('Email'), 'dee@example.com');
    await u.type(screen.getByLabelText('Phone'), '312555');
    await u.type(screen.getByLabelText('ZIP code'), '60614');
    await u.selectOptions(screen.getByLabelText('Years racing'), '1');
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
    await u.type(screen.getByLabelText('ZIP code'), '60614');
    await u.selectOptions(screen.getByLabelText('Years racing'), '1');
    await u.click(screen.getByRole('button', { name: 'Save' }));
  }

  it('moves focus to "+ Add someone new" after saving while a spot is still open', async () => {
    serve({ people: [buildPerson()] });
    server.use(
      http.post('/api/v1/teams/9/people', () =>
        HttpResponse.json(
          {
            person: buildPerson({ id: 7, first_name: 'Dee', last_name: 'Lamb', email: 'dee@example.com' }),
            checklist: buildChecklist({ racers: { filled: 2, total: 5, done: false } }),
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
            checklist: buildChecklist({ racers: { filled: 2, total: 2, done: true } }),
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
        return HttpResponse.json({ checklist: buildChecklist({ racers: { filled: 1, total: 5, done: false } }) });
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
        HttpResponse.json({ checklist: buildChecklist({ racers: { filled: 1, total: 5, done: false } }) }),
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
    expect(screen.queryByRole('button', { name: /^Pick from past teams/ })).toBeNull();
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
    await u.selectOptions(screen.getByLabelText('Years racing'), '2');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Registration is closed for this race.')).toBeInTheDocument();
  });
});
