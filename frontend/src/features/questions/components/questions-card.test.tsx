import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '@/features/questions/__fixtures__/chiditarod_21.json';
import { clearCsrfToken } from '@/lib/api-client';
import { buildChecklist, buildRace, buildTeam, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { Checklist, Race } from '@/types/api';

const valid: Record<string, string> = {
  'racer-type': 'Racer',
  'raced-in-past': 'No',
  'theme-chosen': 'Yes',
  'explain-theme': 'TBD',
  'primary-inspiration': 'Winning',
  'secondary-inspiration': 'Pleasure',
  'racing-for-time': 'No',
  collaborating: 'No',
  'agree-to-core-philosophy': 'Yes',
  'agree-to-rules': 'Yes',
  'agree-to-sabotage': 'Yes',
  'agree-to-cart-deposit': 'Yes',
  'agree-to-cart-food-poundage': 'Yes',
  'agree-not-a-donation': 'Yes',
  'agree-to-orientation': 'Yes',
  'flame-effects': 'No',
  fundraising: 'Probably',
  'cart-parking': 'Short Term',
};

let puts: unknown[];
let putResponse: () => Response;

function serve({
  answers = {},
  checklist = {},
  race = {},
  jsonform = fixture,
  buddyOptions = [],
  buddyTeamIds = [],
  otherBuddies = null,
  collaborating = null,
}: {
  answers?: Record<string, string>;
  checklist?: Partial<Checklist>;
  race?: Partial<Race>;
  jsonform?: unknown;
  buddyOptions?: Array<{ id: number; name: string; finalized: boolean }>;
  buddyTeamIds?: number[];
  otherBuddies?: string | null;
  collaborating?: boolean | null;
} = {}) {
  const team = buildTeam({
    race: buildRace(race),
    checklist: buildChecklist({ questions: { required: true, done: false }, ...checklist }),
  });
  server.use(
    http.get('/api/v1/teams/9', () => HttpResponse.json({ team })),
    http.get('/api/v1/teams/9/questions', () =>
      HttpResponse.json({
        jsonform,
        answers,
        collaborating,
        buddy_team_ids: buddyTeamIds,
        other_buddies: otherBuddies,
      }),
    ),
    http.get('/api/v1/teams/9/buddy_options', () => HttpResponse.json({ teams: buddyOptions })),
    http.put('/api/v1/teams/9/questions', async ({ request }) => {
      puts.push(await request.json());
      return putResponse();
    }),
  );
}

beforeEach(() => {
  puts = [];
  putResponse = () =>
    HttpResponse.json({
      answers: valid,
      collaborating: false,
      buddy_team_ids: [],
      other_buddies: null,
      checklist: buildChecklist({ questions: { required: true, done: true } }),
    });
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
    http.get('/api/v1/teams/9/past_racers', () => HttpResponse.json({ past_racers: [] })),
  );
});
afterEach(() => clearCsrfToken());

const card = async () => within(await screen.findByRole('group', { name: /Team questions/ }));

const sameRoute = /same route as another person or team/;

async function fillAll(c: ReturnType<typeof within>, skip: string[] = []) {
  const user = userEvent.setup();
  const pick = async (name: RegExp, value: string) => {
    const group = c.getByRole('radiogroup', { name });
    await user.click(within(group).getByRole('radio', { name: value }));
  };
  await pick(sameRoute, 'No');
  await pick(/What type of team/, 'Racer');
  await pick(/Have any of your team members raced/, 'No');
  await pick(/Do you have a theme chosen/, 'Yes');
  await user.type(c.getByRole('textbox', { name: /Your theme/ }), 'TBD');
  await user.selectOptions(c.getByRole('combobox', { name: /primary inspiration/ }), 'Winning');
  await user.selectOptions(c.getByRole('combobox', { name: /secondary inspiration/ }), 'Pleasure');
  await pick(/primarily racing for time/, 'No');
  await pick(/collaborating with any other teams/, 'No');
  for (const box of c.getAllByRole('checkbox')) {
    const name = (box as HTMLInputElement).name;
    if (name && !skip.includes(name)) await user.click(box);
  }
  await pick(/Fire Effects/, 'No');
  await user.selectOptions(c.getByRole('combobox', { name: /Fundraising/ }), 'Probably');
  await pick(/Overnight Cart Parking/, 'Short Term');
}

describe('QuestionsCard', () => {
  it('expands to the form when questions are not done and saves a valid answer set', async () => {
    serve();
    renderApp('/teams/9');
    const c = await card();
    await c.findByRole('radiogroup', { name: /What type of team/ });
    await fillAll(c);
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ answers: valid, collaborating: false, buddy_team_ids: [], other_buddies: '' });
    expect(await screen.findByText('Done')).toBeInTheDocument();
    expect(await c.findByRole('button', { name: 'Edit answers' })).toBeInTheDocument();
    expect(c.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('does not PUT and focuses the first invalid field when validation fails', async () => {
    serve();
    renderApp('/teams/9');
    const c = await card();
    await c.findByRole('radiogroup', { name: /What type of team/ });
    await userEvent.type(c.getByRole('textbox', { name: /Got Instagram/ }), 'bad');
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    expect(puts).toHaveLength(0);
    expect(c.getAllByText('You must agree to continue').length).toBeGreaterThan(0);
    expect(c.getByRole('textbox', { name: /Got Instagram/ })).toHaveAttribute('aria-invalid', 'true');
    // The unanswered same-route question comes first, so it takes focus.
    expect(within(c.getByRole('radiogroup', { name: sameRoute })).getAllByRole('radio')[0]).toHaveFocus();
    expect(c.getByRole('radiogroup', { name: /What type of team/ })).toHaveAttribute('aria-invalid', 'true');
  });

  it('still saves (server validates) when the schema has a pattern ajv cannot compile', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const schema = structuredClone(fixture.schema) as Record<string, unknown> & {
      properties: Record<string, Record<string, unknown>>;
    };
    schema.properties.instagram.pattern = '\\A[a-z]+\\z';
    serve({ jsonform: { ...fixture, schema }, collaborating: false });
    renderApp('/teams/9');
    const c = await card();
    await c.findByRole('radiogroup', { name: /What type of team/ });
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaving an agreement unchecked blocks save with the agreement message', async () => {
    serve();
    renderApp('/teams/9');
    const c = await card();
    await c.findByRole('radiogroup', { name: /What type of team/ });
    await fillAll(c, ['agree-to-rules']);
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    expect(puts).toHaveLength(0);
    expect(c.getByRole('checkbox', { name: /race rules/ })).toHaveFocus();
    expect(c.getByRole('checkbox', { name: /race rules/ })).toHaveAccessibleDescription(/You must agree to continue/);
  });

  it('shows a summary with answered count and Edit answers when done, then edits and cancels', async () => {
    serve({ answers: valid, checklist: { questions: { required: true, done: true } } });
    renderApp('/teams/9');
    const c = await card();
    expect(await c.findByText('18 of 22 questions answered')).toBeInTheDocument();
    await userEvent.click(c.getByRole('button', { name: 'Edit answers' }));
    expect(await c.findByRole('radio', { name: 'Racer' })).toBeChecked();
    expect(c.getByRole('checkbox', { name: /race rules/ })).toBeChecked();
    await userEvent.click(c.getByRole('radio', { name: 'Art Cart' }));
    await userEvent.click(c.getByRole('button', { name: 'Cancel' }));
    const edit = c.getByRole('button', { name: 'Edit answers' });
    expect(edit).toHaveFocus();
    await userEvent.click(edit);
    expect(await c.findByRole('radio', { name: 'Racer' })).toBeChecked();
    expect(puts).toHaveLength(0);
  });

  it('sends only schema keys and omits empty optional values', async () => {
    serve({
      answers: { ...valid, instagram: '', 'not-in-schema': 'x', buddies: 'Dee' },
      checklist: { questions: { required: true, done: true } },
      collaborating: false,
    });
    renderApp('/teams/9');
    const c = await card();
    await userEvent.click(await c.findByRole('button', { name: 'Edit answers' }));
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      answers: { ...valid, buddies: 'Dee' },
      collaborating: false,
      buddy_team_ids: [],
      other_buddies: '',
    });
  });

  it('maps 422 messages to their question keys and shows the rest as form-level errors', async () => {
    serve({ answers: valid, checklist: { questions: { required: true, done: true } }, collaborating: false });
    putResponse = () =>
      HttpResponse.json(
        {
          error: 'invalid_answers',
          errors: {
            questions: [
              `The property '#/racer-type' value "Hover" did not match one of the following values: Racer, Art Cart in schema abc`,
              'Totally unrelated problem',
            ],
          },
        },
        { status: 422 },
      );
    renderApp('/teams/9');
    const c = await card();
    await userEvent.click(await c.findByRole('button', { name: 'Edit answers' }));
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    const group = await c.findByRole('radiogroup', { name: /What type of team/ });
    await waitFor(() => expect(group).toHaveAccessibleDescription(/did not match one of the following values/));
    expect(c.getByRole('alert')).toHaveTextContent('Totally unrelated problem');
    expect(c.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('403 on save shows the page banner', async () => {
    serve({ answers: valid, checklist: { questions: { required: true, done: true } }, collaborating: false });
    putResponse = () => HttpResponse.json({ error: 'Registration is closed.' }, { status: 403 });
    renderApp('/teams/9');
    const c = await card();
    await userEvent.click(await c.findByRole('button', { name: 'Edit answers' }));
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Registration is closed.')).toBeInTheDocument();
  });

  it('is a read-only summary when registration is closed', async () => {
    serve({
      answers: valid,
      race: { open_for_registration: false },
      checklist: { questions: { required: true, done: true } },
    });
    renderApp('/teams/9');
    const c = await card();
    expect(await c.findByText('18 of 22 questions answered')).toBeInTheDocument();
    expect(c.queryByRole('button', { name: 'Edit answers' })).not.toBeInTheDocument();
    expect(c.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('shows an error with retry when the questions fail to load', async () => {
    serve();
    server.use(http.get('/api/v1/teams/9/questions', () => HttpResponse.json({ error: 'x' }, { status: 500 })));
    renderApp('/teams/9');
    const c = await card();
    expect(await c.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  describe('team picker', () => {
    const teams = [
      { id: 11, name: 'Apple Cart', finalized: false },
      { id: 12, name: 'Zebra Crossing', finalized: true },
    ];
    const done = { questions: { required: true, done: true } };
    const yes = { answers: valid, checklist: done, buddyOptions: teams, collaborating: true };

    it('saves picked teams and other text with the answers', async () => {
      const user = userEvent.setup();
      serve(yes);
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      await user.click(await c.findByRole('checkbox', { name: 'Zebra Crossing, Fully registered' }));
      await user.click(c.getByRole('checkbox', { name: 'Other…' }));
      await user.type(c.getByRole('textbox', { name: 'Which other teams or people?' }), ' Dee Team ');
      await user.click(c.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(puts).toHaveLength(1));
      expect(puts[0]).toEqual({ answers: valid, collaborating: true, buddy_team_ids: [12], other_buddies: 'Dee Team' });
    });

    it('opens with saved picks and Other… selected when other_buddies exists', async () => {
      const user = userEvent.setup();
      serve({
        ...yes,
        buddyTeamIds: [11],
        otherBuddies: 'Dee Team',
      });
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      expect(await c.findByRole('checkbox', { name: 'Apple Cart, Still registering' })).toBeChecked();
      expect(c.getByRole('checkbox', { name: 'Zebra Crossing, Fully registered' })).not.toBeChecked();
      expect(c.getByRole('checkbox', { name: 'Other…' })).toBeChecked();
      expect(c.getByRole('textbox', { name: 'Which other teams or people?' })).toHaveValue('Dee Team');
    });

    it('clearing Other… sends an empty other_buddies', async () => {
      const user = userEvent.setup();
      serve({ ...yes, otherBuddies: 'Dee Team' });
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      await user.click(await c.findByRole('checkbox', { name: 'Other…' }));
      await user.click(c.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(puts).toHaveLength(1));
      expect(puts[0]).toEqual({ answers: valid, collaborating: true, buddy_team_ids: [], other_buddies: '' });
    });

    it('shows an invalid_buddies server error on the picker', async () => {
      const user = userEvent.setup();
      serve(yes);
      putResponse = () =>
        HttpResponse.json(
          { error: 'invalid_buddies', errors: { buddy_team_ids: ['includes a team that is not in this race'] } },
          { status: 422 },
        );
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      await user.click(await c.findByRole('checkbox', { name: /Zebra Crossing/ }));
      await user.click(c.getByRole('button', { name: 'Save' }));
      const group = await c.findByRole('group', { name: 'Teams you want to race alongside' });
      expect(await within(group).findByRole('alert')).toHaveTextContent('includes a team that is not in this race');
      expect(c.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('drops a saved pick that is no longer in the options and saves', async () => {
      const user = userEvent.setup();
      serve({ ...yes, buddyTeamIds: [11, 99] });
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      expect(await c.findByRole('checkbox', { name: /Apple Cart/ })).toBeChecked();
      await user.click(c.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(puts).toHaveLength(1));
      expect(puts[0]).toEqual({ answers: valid, collaborating: true, buddy_team_ids: [11], other_buddies: '' });
      expect(await c.findByRole('button', { name: 'Edit answers' })).toBeInTheDocument();
    });

    it('refetches the questions and the team list after an invalid_buddies error', async () => {
      const user = userEvent.setup();
      serve(yes);
      let questionGets = 0;
      let optionGets = 0;
      server.use(
        http.get('/api/v1/teams/9/questions', () => {
          questionGets += 1;
          return HttpResponse.json({
            jsonform: fixture,
            answers: valid,
            collaborating: true,
            buddy_team_ids: [],
            other_buddies: null,
          });
        }),
        http.get('/api/v1/teams/9/buddy_options', () => {
          optionGets += 1;
          return HttpResponse.json({ teams });
        }),
      );
      putResponse = () =>
        HttpResponse.json(
          { error: 'invalid_buddies', errors: { buddy_team_ids: ['includes a team that is not in this race'] } },
          { status: 422 },
        );
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      await user.click(await c.findByRole('checkbox', { name: /Zebra Crossing/ }));
      const questionsBefore = questionGets;
      const optionsBefore = optionGets;
      await user.click(c.getByRole('button', { name: 'Save' }));
      const group = await c.findByRole('group', { name: 'Teams you want to race alongside' });
      expect(await within(group).findByRole('alert')).toHaveTextContent('includes a team that is not in this race');
      await waitFor(() => expect(questionGets).toBeGreaterThan(questionsBefore));
      await waitFor(() => expect(optionGets).toBeGreaterThan(optionsBefore));
    });

    it('keeps the picker when a background refetch of the team list fails', async () => {
      const user = userEvent.setup();
      serve(yes);
      let optionGets = 0;
      server.use(
        http.get('/api/v1/teams/9/buddy_options', () => {
          optionGets += 1;
          return optionGets === 1
            ? HttpResponse.json({ teams })
            : HttpResponse.json({ error: 'x' }, { status: 500 });
        }),
      );
      putResponse = () =>
        HttpResponse.json(
          { error: 'invalid_buddies', errors: { buddy_team_ids: ['includes a team that is not in this race'] } },
          { status: 422 },
        );
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      await user.click(await c.findByRole('checkbox', { name: /Zebra Crossing/ }));
      await user.click(c.getByRole('button', { name: 'Save' }));
      // The 422 invalidates the options; that refetch fails (500, after retries) but the picker stays.
      await waitFor(() => expect(optionGets).toBeGreaterThan(1));
      const group = await c.findByRole('group', { name: 'Teams you want to race alongside' });
      expect(within(group).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
      expect(c.getByRole('checkbox', { name: /Apple Cart/ })).toBeInTheDocument();
    });

    it('a picker change alone saves when all other answers are unchanged', async () => {
      const user = userEvent.setup();
      serve({ ...yes, buddyTeamIds: [11] });
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      await user.click(await c.findByRole('checkbox', { name: /Zebra Crossing/ }));
      await user.click(c.getByRole('checkbox', { name: /Apple Cart/ }));
      await user.click(c.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(puts).toHaveLength(1));
      expect(puts[0]).toEqual({ answers: valid, collaborating: true, buddy_team_ids: [12], other_buddies: '' });
    });

    it('keeps the questions usable and offers a retry when the team list fails to load', async () => {
      const user = userEvent.setup();
      serve(yes);
      server.use(http.get('/api/v1/teams/9/buddy_options', () => HttpResponse.json({ error: 'x' }, { status: 500 })));
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      const group = await c.findByRole('group', { name: 'Teams you want to race alongside' });
      expect(await within(group).findByRole('button', { name: 'Try again' })).toBeInTheDocument();
      expect(c.getByRole('radio', { name: 'Racer' })).toBeChecked();
      await user.click(c.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(puts).toHaveLength(1));
    });
  });

  describe('same-route question', () => {
    const teams = [
      { id: 11, name: 'Apple Cart', finalized: false },
      { id: 12, name: 'Zebra Crossing', finalized: true },
    ];
    const done = { questions: { required: true, done: true } };
    const picker = { name: 'Teams you want to race alongside' };

    it('comes first in the card, unanswered for a team that never answered it', async () => {
      serve({ answers: valid, checklist: done, buddyOptions: teams });
      renderApp('/teams/9');
      const c = await card();
      await userEvent.click(await c.findByRole('button', { name: 'Edit answers' }));
      const question = await c.findByRole('radiogroup', { name: sameRoute });
      expect(c.getAllByRole('radiogroup')[0]).toBe(question);
      expect(within(question).getByRole('radio', { name: 'Yes' })).not.toBeChecked();
      expect(within(question).getByRole('radio', { name: 'No' })).not.toBeChecked();
      expect(c.queryByRole('group', picker)).not.toBeInTheDocument();
    });

    it('blocks save with Choose Yes or No and focuses the question while unanswered', async () => {
      const user = userEvent.setup();
      serve({ answers: valid, checklist: done, buddyOptions: teams });
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      await user.click(c.getByRole('button', { name: 'Save' }));
      const question = c.getByRole('radiogroup', { name: sameRoute });
      await waitFor(() => expect(question).toHaveAccessibleDescription('Choose Yes or No'));
      expect(within(question).getByRole('radio', { name: 'Yes' })).toHaveFocus();
      expect(puts).toHaveLength(0);
      await user.click(within(question).getByRole('radio', { name: 'No' }));
      expect(question).not.toHaveAccessibleDescription('Choose Yes or No');
      await user.click(c.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(puts).toHaveLength(1));
      expect(puts[0]).toEqual({ answers: valid, collaborating: false, buddy_team_ids: [], other_buddies: '' });
    });

    it('Yes reveals the picker, No hides it, and the draft keeps picks while toggling', async () => {
      const user = userEvent.setup();
      serve({ answers: valid, checklist: done, buddyOptions: teams, collaborating: false });
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      const question = c.getByRole('radiogroup', { name: sameRoute });
      expect(within(question).getByRole('radio', { name: 'No' })).toBeChecked();
      expect(c.queryByRole('group', picker)).not.toBeInTheDocument();

      await user.click(within(question).getByRole('radio', { name: 'Yes' }));
      await user.click(await c.findByRole('checkbox', { name: /Zebra Crossing/ }));
      await user.click(within(question).getByRole('radio', { name: 'No' }));
      expect(c.queryByRole('group', picker)).not.toBeInTheDocument();
      await user.click(within(question).getByRole('radio', { name: 'Yes' }));
      expect(c.getByRole('checkbox', { name: /Zebra Crossing/ })).toBeChecked();

      await user.click(c.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(puts).toHaveLength(1));
      expect(puts[0]).toEqual({ answers: valid, collaborating: true, buddy_team_ids: [12], other_buddies: '' });
    });

    it('saving No sends no picks even when picks were saved before', async () => {
      const user = userEvent.setup();
      serve({
        answers: valid,
        checklist: done,
        buddyOptions: teams,
        collaborating: true,
        buddyTeamIds: [11],
        otherBuddies: 'Dee Team',
      });
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      expect(await c.findByRole('checkbox', { name: /Apple Cart/ })).toBeChecked();
      await user.click(within(c.getByRole('radiogroup', { name: sameRoute })).getByRole('radio', { name: 'No' }));
      await user.click(c.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(puts).toHaveLength(1));
      expect(puts[0]).toEqual({ answers: valid, collaborating: false, buddy_team_ids: [], other_buddies: '' });
    });

    it('opens both info tips by click and by keyboard', async () => {
      const user = userEvent.setup();
      serve({ answers: valid, checklist: done, buddyOptions: teams, collaborating: true });
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));

      await user.click(c.getByRole('button', { name: 'About racing on the same route' }));
      expect(await screen.findByText(/ensemble of more than one cart/)).toBeInTheDocument();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByText(/ensemble of more than one cart/)).not.toBeInTheDocument());

      const tip = await c.findByRole('button', { name: 'About picking teams' });
      tip.focus();
      await user.keyboard('{Enter}');
      expect(await screen.findByText(/Names only; teams are told nothing/)).toBeInTheDocument();
      // The tip button stays out of the picker group's name.
      expect(c.getByRole('group', picker)).toBeInTheDocument();
    });

    it('shows an invalid_buddies error about the answer on the question', async () => {
      const user = userEvent.setup();
      serve({ answers: valid, checklist: done, buddyOptions: teams, collaborating: true });
      putResponse = () =>
        HttpResponse.json(
          {
            error: 'invalid_buddies',
            errors: { collaborating: ['Answer Yes to the same-route question before picking teams.'] },
          },
          { status: 422 },
        );
      renderApp('/teams/9');
      const c = await card();
      await user.click(await c.findByRole('button', { name: 'Edit answers' }));
      await user.click(await c.findByRole('checkbox', { name: /Zebra Crossing/ }));
      await user.click(c.getByRole('button', { name: 'Save' }));
      const question = c.getByRole('radiogroup', { name: sameRoute });
      await waitFor(() => expect(question).toHaveAccessibleDescription(/Answer Yes to the same-route question/));
      expect(within(c.getByRole('group', picker)).queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
