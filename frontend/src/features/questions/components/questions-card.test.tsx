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
}: {
  answers?: Record<string, string>;
  checklist?: Partial<Checklist>;
  race?: Partial<Race>;
  jsonform?: unknown;
} = {}) {
  const team = buildTeam({
    race: buildRace(race),
    checklist: buildChecklist({ questions: { required: true, done: false }, ...checklist }),
  });
  server.use(
    http.get('/api/v1/teams/9', () => HttpResponse.json({ team })),
    http.get('/api/v1/teams/9/questions', () => HttpResponse.json({ jsonform, answers })),
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

async function fillAll(c: ReturnType<typeof within>, skip: string[] = []) {
  const user = userEvent.setup();
  const pick = async (name: RegExp, value: string) => {
    const group = c.getByRole('radiogroup', { name });
    await user.click(within(group).getByRole('radio', { name: value }));
  };
  await pick(/What type of team/, 'Racer');
  await pick(/Have any of your team members raced/, 'No');
  await pick(/Do you have a theme chosen/, 'Yes');
  await user.type(c.getByRole('textbox', { name: /Your theme/ }), 'TBD');
  await user.selectOptions(c.getByRole('combobox', { name: /primary inspiration/ }), 'Winning');
  await user.selectOptions(c.getByRole('combobox', { name: /secondary inspiration/ }), 'Pleasure');
  await pick(/primarily racing for time/, 'No');
  await pick(/collaborating with any other teams/, 'No');
  for (const box of c.getAllByRole('checkbox')) {
    if (!skip.some((s) => (box as HTMLInputElement).name === s)) await user.click(box);
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
    expect(puts[0]).toEqual({ answers: valid });
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
    expect(within(c.getByRole('radiogroup', { name: /What type of team/ })).getAllByRole('radio')[0]).toHaveFocus();
  });

  it('still saves (server validates) when the schema has a pattern ajv cannot compile', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const schema = structuredClone(fixture.schema) as Record<string, unknown> & {
      properties: Record<string, Record<string, unknown>>;
    };
    schema.properties.instagram.pattern = '\\A[a-z]+\\z';
    serve({ jsonform: { ...fixture, schema } });
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
    });
    renderApp('/teams/9');
    const c = await card();
    await userEvent.click(await c.findByRole('button', { name: 'Edit answers' }));
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ answers: { ...valid, buddies: 'Dee' } });
  });

  it('maps 422 messages to their question keys and shows the rest as form-level errors', async () => {
    serve({ answers: valid, checklist: { questions: { required: true, done: true } } });
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
    serve({ answers: valid, checklist: { questions: { required: true, done: true } } });
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
});
