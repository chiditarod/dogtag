import { screen, waitFor, within } from '@testing-library/react';
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
  twitter: '@dee',
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

/** Past racers load after the team; wait for the first chip row. */
async function openRosterWithChips() {
  const roster = await openRoster();
  await screen.findAllByRole('group', { name: 'Past racers' });
  return roster;
}

describe('RosterCard slots', () => {
  it('renders one slot per people_per_team, filled slots first', async () => {
    serve({ people: [buildPerson(), buildPerson({ id: 2, first_name: 'Bo', email: 'bo@example.com' })] });
    renderApp('/teams/9');
    const roster = await openRoster();
    expect(slots()).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: '+ Add someone new' })).toHaveLength(3);
    expect(within(roster).getAllByRole('button', { name: /^Edit / })).toHaveLength(2);
    expect(slots()[0]).toHaveTextContent('Ada L');
    expect(slots()[1]).toHaveTextContent('Bo L');
  });

  it('respects a different people_per_team', async () => {
    serve({ race: { people_per_team: 3 } });
    renderApp('/teams/9');
    await openRoster();
    expect(slots()).toHaveLength(3);
  });

  it('shows initials, name, captain marker, contact details and the years label', async () => {
    serve({
      people: [
        buildPerson({ twitter: '@ada' }),
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

describe('past-racer chips', () => {
  it('renders no chip row when there are no past racers', async () => {
    serve({ past: [] });
    const { queryClient } = renderApp('/teams/9');
    await openRoster();
    await waitFor(() =>
      expect(queryClient.getQueryState(['past-racers', '9'])?.status).toBe('success'),
    );
    expect(screen.queryByRole('group', { name: 'Past racers' })).toBeNull();
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it('shows up to 3 chips (most recent first) per empty slot plus "+N more"', async () => {
    serve({ past: [racer(1), racer(2), racer(3), racer(4), racer(5)] });
    renderApp('/teams/9');
    await openRosterWithChips();
    const rows = screen.getAllByRole('group', { name: 'Past racers' });
    expect(rows).toHaveLength(5);
    const chips = within(rows[0]).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual([
      'Racer1 Num1 · 2024',
      'Racer2 Num2 · 2023',
      'Racer3 Num3 · 2022',
      '+2 more',
    ]);
  });

  it('shows no "+N more" with 3 or fewer past racers', async () => {
    serve({ past: [dee, racer(2)] });
    renderApp('/teams/9');
    await openRosterWithChips();
    expect(screen.queryByRole('button', { name: /more$/ })).toBeNull();
    expect(within(screen.getAllByRole('group', { name: 'Past racers' })[0]).getAllByRole('button')).toHaveLength(2);
  });

  it('hides chips for people already on the team', async () => {
    serve({ people: [buildPerson({ email: 'DEE@example.com' })], past: [dee, racer(2)] });
    renderApp('/teams/9');
    await openRosterWithChips();
    expect(screen.queryByRole('button', { name: /Dee Lamb/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Racer2 Num2/ })).toHaveLength(4);
  });

  it('pre-fills the form from a chip (experience + 1) and posts nothing until Save', async () => {
    const created = buildPerson({ id: 7, first_name: 'Dee', last_name: 'Lamb', email: 'dee@example.com', phone: '312-555-0144', zipcode: '60614', experience: 2, twitter: '@dee' });
    serve({ people: [buildPerson()], past: [dee] });
    server.use(
      http.post('/api/v1/teams/9/people', async ({ request }) => {
        await record(request);
        return HttpResponse.json(
          { person: created, checklist: buildChecklist({ racers: { filled: 2, total: 5, done: false } }) },
          { status: 201 },
        );
      }),
    );
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithChips();
    await u.click(screen.getAllByRole('button', { name: 'Dee Lamb · 2025' })[0]);

    expect(screen.getByLabelText('First name')).toHaveValue('Dee');
    expect(screen.getByLabelText('Last name')).toHaveValue('Lamb');
    expect(screen.getByLabelText('Email')).toHaveValue('dee@example.com');
    expect(screen.getByLabelText('Phone')).toHaveValue('(312) 555-0144');
    expect(screen.getByLabelText('ZIP code')).toHaveValue('60614');
    expect(screen.getByLabelText('Years racing')).toHaveDisplayValue('Twice');
    expect(screen.getByLabelText(/Twitter/)).toHaveValue('@dee');
    expect(requests).toEqual([]);

    await u.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].body).toEqual({
      person: {
        first_name: 'Dee',
        last_name: 'Lamb',
        email: 'dee@example.com',
        phone: '312-555-0144',
        zipcode: '60614',
        experience: 2,
        twitter: '@dee',
      },
    });
    // The new person fills slot 2 and the checklist pill updates.
    await waitFor(() => expect(within(slots()[1]).getByText('Dee Lamb')).toBeInTheDocument());
    expect(screen.queryByLabelText('First name')).toBeNull();
    expect(screen.queryByRole('button', { name: /Dee Lamb · 2025/ })).toBeNull();
    expect(screen.getByText('2 of 5')).toBeInTheDocument();
  });

  it('caps the pre-filled experience at the last label', async () => {
    serve({ past: [{ ...dee, experience: 2 }] });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithChips();
    await u.click(screen.getAllByRole('button', { name: 'Dee Lamb · 2025' })[0]);
    expect(screen.getByLabelText('Years racing')).toHaveDisplayValue('Twice');
  });
});

describe('PastRacerList', () => {
  const many = [racer(1), racer(2), racer(3), { ...dee }, racer(5)];

  it('opens from "+N more", filters by name/email, closes on Escape and returns focus', async () => {
    serve({ past: many });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithChips();
    const more = screen.getAllByRole('button', { name: '+2 more' })[0];
    await u.click(more);

    const dialog = await screen.findByRole('dialog', { name: 'Past racers' });
    expect(within(dialog).getByRole('searchbox', { name: 'Search past racers' })).toHaveFocus();
    expect(within(dialog).getAllByRole('button', { name: /· \d{4}/ })).toHaveLength(5);

    await u.type(within(dialog).getByRole('searchbox'), 'dee@');
    expect(within(dialog).getAllByRole('button', { name: /· \d{4}/ })).toHaveLength(1);
    await u.clear(within(dialog).getByRole('searchbox'));
    await u.type(within(dialog).getByRole('searchbox'), 'num5');
    expect(within(dialog).getByRole('button', { name: /Racer5 Num5/ })).toBeInTheDocument();
    await u.clear(within(dialog).getByRole('searchbox'));
    await u.type(within(dialog).getByRole('searchbox'), 'zzz');
    expect(within(dialog).getByText('No past racers match.')).toBeInTheDocument();

    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(more).toHaveFocus();
  });

  it('traps Tab focus inside the dialog', async () => {
    serve({ past: many });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithChips();
    await u.click(screen.getAllByRole('button', { name: '+2 more' })[0]);
    const dialog = await screen.findByRole('dialog');
    await u.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < 9; i += 1) await u.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('picking a racer closes the list and opens the pre-filled form', async () => {
    serve({ past: many });
    const u = userEvent.setup();
    renderApp('/teams/9');
    await openRosterWithChips();
    await u.click(screen.getAllByRole('button', { name: '+2 more' })[0]);
    const dialog = await screen.findByRole('dialog');
    await u.click(within(dialog).getByRole('button', { name: /Racer5 Num5/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('First name')).toHaveValue('Racer5');
    expect(screen.getByLabelText('First name')).toHaveFocus();
    expect(requests).toEqual([]);
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
    await u.click(screen.getAllByRole('button', { name: '+ Add someone new' })[0]);
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
        twitter: '',
      },
    });
  });

  async function fillAndSave(u: ReturnType<typeof userEvent.setup>) {
    await u.click(screen.getAllByRole('button', { name: '+ Add someone new' })[0]);
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
    await u.click(screen.getAllByRole('button', { name: '+ Add someone new' })[0]);
    await u.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('First name')).toBeNull();
    expect(requests).toEqual([]);
    expect(screen.getAllByRole('button', { name: '+ Add someone new' })).toHaveLength(5);
  });
});

describe('editing and removing', () => {
  const people = [
    buildPerson(),
    buildPerson({ id: 2, first_name: 'Bo', last_name: 'Z', email: 'bo@example.com', twitter: null }),
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
    expect(slots()).toHaveLength(5);
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
  it('hides add, chips and remove but still allows Edit', async () => {
    serve({
      people: [buildPerson(), buildPerson({ id: 2, first_name: 'Bo', email: 'bo@example.com' })],
      past: [dee, racer(2)],
      race: { open_for_registration: false },
    });
    renderApp('/teams/9');
    const roster = await openRoster();
    expect(slots()).toHaveLength(5);
    expect(screen.queryByRole('button', { name: '+ Add someone new' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Past racers' })).toBeNull();
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
