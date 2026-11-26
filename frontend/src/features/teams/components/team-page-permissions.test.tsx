import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fixture from '@/features/questions/__fixtures__/chiditarod_21.json';
import type { StaffTeamCan } from '@/features/staff-teams/types';
import { noCan, staffTeamBody } from '@/features/staff-teams/test-fixtures';
import { TOUR_OFF_KEY } from '@/features/tour/storage';
import { clearCsrfToken } from '@/lib/api-client';
import { t } from '@/locales/en';
import { buildChecklist, buildPerson, buildRace, buildTeam, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

const allCan: StaffTeamCan = {
  update_team: true,
  set_captain: true,
  add_racers: true,
  edit_racers: true,
  remove_racers: true,
  edit_questions: true,
  delete_team: true,
  take_payment: true,
  set_new_team: true,
  view_emails: true,
  view_payments: true,
};

const answers = {
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

interface Setup {
  /** Roles of the signed-in user; empty means a racer. */
  roles?: string[];
  meId?: number;
  can?: Partial<StaffTeamCan> | 'pending' | 'error';
  closed?: boolean;
  ownerId?: number;
}

let pastRacerRequests: number;
let questionPuts: unknown[];

function serve({ roles = [], meId = 1, can = {}, closed = false, ownerId = 7 }: Setup = {}) {
  const race = buildRace(
    closed
      ? { open_for_registration: false, registration_status: 'closed', jsonform: null }
      : { jsonform: null },
  );
  const team = buildTeam({
    race,
    people: [
      buildPerson({ id: 2, first_name: 'Bo', last_name: 'Racer', email: 'bo@example.com' }),
      buildPerson({ id: 3, first_name: 'Cy', last_name: 'Racer', email: 'cy@example.com' }),
    ],
    captain_id: 2,
    checklist: buildChecklist({
      racers: { filled: 2, total: 5, captain: true, done: false },
      questions: { required: true, done: true },
    }),
  });
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, id: meId, roles } })),
    http.get('/api/v1/teams/9', () => HttpResponse.json({ team })),
    http.get('/api/v1/teams/9/past_racers', () => {
      pastRacerRequests += 1;
      return HttpResponse.json({ past_racers: [] });
    }),
    http.get('/api/v1/teams/9/questions', () =>
      HttpResponse.json({
        jsonform: fixture,
        answers,
        collaborating: false,
        buddy_team_ids: [],
        other_buddies: null,
      }),
    ),
    http.get('/api/v1/teams/9/buddy_options', () => HttpResponse.json({ teams: [] })),
    http.put('/api/v1/teams/9/questions', async ({ request }) => {
      questionPuts.push(await request.json());
      return HttpResponse.json({
        answers,
        collaborating: false,
        buddy_team_ids: [],
        other_buddies: null,
        checklist: team.checklist,
      });
    }),
    http.get('/api/v1/staff/teams/9', async () => {
      if (can === 'pending') await delay('infinite');
      if (can === 'error') {
        return HttpResponse.json({ error: 'boom', errors: {} }, { status: 500 });
      }
      return HttpResponse.json(
        staffTeamBody(typeof can === 'string' ? {} : can, {
          account_holder: {
            id: ownerId,
            first_name: 'Owner',
            last_name: 'Person',
            email: 'owner@example.com',
            phone: null,
          },
        }),
      );
    }),
  );
  renderApp('/teams/9');
}

beforeEach(() => {
  pastRacerRequests = 0;
  questionPuts = [];
  server.use(http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })));
});
afterEach(() => clearCsrfToken());

const page = async () => {
  await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' });
  return screen;
};

const button = (name: string | RegExp) => screen.queryByRole('button', { name });

const racerEdits = () => screen.queryAllByRole('button', { name: /^Edit (Bo|Cy)/ });
const removes = () => screen.queryAllByRole('button', { name: /^Remove / });
const captains = () => screen.queryAllByRole('button', { name: /^Make .* captain$/ });

/** The page and its questions card (the last thing to load) are on screen. */
async function settled() {
  await page();
  await screen.findByText(/questions answered/);
}

function expectNoEditControls() {
  expect(button(t('team.delete'))).toBeNull();
  expect(button(/^Pick racers from past teams/)).toBeNull();
  expect(button(t('roster.addYourself'))).toBeNull();
  expect(button(t('roster.add'))).toBeNull();
  expect(captains()).toHaveLength(0);
  expect(removes()).toHaveLength(0);
  expect(racerEdits()).toHaveLength(0);
  expect(button(t('team.edit'))).toBeNull();
  expect(button(t('questions.edit'))).toBeNull();
}

describe('team page controls follow the permissions', () => {
  it('offers a racer nothing to change once registration is closed (unchanged)', async () => {
    serve({ closed: true });
    await settled();
    expect(button(t('team.delete'))).toBeNull();
    expect(button(t('roster.add'))).toBeNull();
    expect(captains()).toHaveLength(0);
    expect(removes()).toHaveLength(0);
    expect(screen.getByText(t('questions.closed'))).toBeInTheDocument();
    expect(screen.queryByText(t('staff.team.closedNote'))).toBeNull();
  });

  it('gives an operator every edit control on a closed race, and the closed note', async () => {
    serve({ roles: ['operator'], can: allCan, closed: true });
    await screen.findByRole('button', { name: t('team.delete') });
    expect(screen.getByRole('button', { name: t('roster.add') })).toBeInTheDocument();
    expect(captains().length).toBeGreaterThan(0);
    expect(removes().length).toBeGreaterThan(0);
    expect(racerEdits()).toHaveLength(2);
    expect(screen.getByRole('button', { name: t('team.edit') })).toBeInTheDocument();
    expect(screen.getByText(t('staff.team.closedNote'))).toBeInTheDocument();
    expect(screen.queryByText(t('staff.team.readOnlyNote'))).toBeNull();
    // The staff member does not own the team: no owner-only shortcuts.
    expect(button(/^Pick racers from past teams/)).toBeNull();
    expect(button(t('roster.addYourself'))).toBeNull();
    expect(pastRacerRequests).toBe(0);
  });

  it('lets staff edit the questions on a closed race through the normal PUT', async () => {
    serve({ roles: ['operator'], can: allCan, closed: true });
    const edit = await screen.findByRole('button', { name: t('questions.edit') });
    await userEvent.click(edit);
    const group = within(await screen.findByRole('group', { name: /Team questions/ }));
    await userEvent.click(await group.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(questionPuts).toHaveLength(1));
  });

  it('shows the owner of a team the past-racers picker and Add yourself when staff can add racers', async () => {
    serve({ roles: ['operator'], can: allCan, meId: 7 });
    await screen.findByRole('button', { name: t('roster.addYourself') });
    await waitFor(() => expect(pastRacerRequests).toBe(1));
  });

  it('gives a refunder (every flag off) nothing to change', async () => {
    serve({ roles: ['refunder'], can: noCan, closed: true });
    await settled();
    await waitFor(() => expect(screen.queryByText(t('staff.team.readOnlyNote'))).toBeNull());
    expectNoEditControls();
    expect(screen.queryByText(t('staff.team.closedNote'))).toBeNull();
  });

  it('shows no delete button to staff when delete_team is off', async () => {
    serve({ roles: ['operator'], can: { ...allCan, delete_team: false } });
    await screen.findByRole('button', { name: t('roster.add') });
    expect(button(t('team.delete'))).toBeNull();
  });

  it.each([
    ['not the account holder', 1],
    ['the account holder', 7],
  ])('shows no edit control while the staff request is pending (%s)', async (_label, meId) => {
    serve({ roles: ['admin'], can: 'pending', meId });
    await settled();
    // Give any stray query time to fire.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expectNoEditControls();
    expect(pastRacerRequests).toBe(0);
    expect(screen.queryByText(t('staff.team.readOnlyNote'))).toBeNull();
  });

  it.each([
    ['not the account holder', 1],
    ['the account holder', 7],
  ])('stays read-only with a note when the staff request fails (%s)', async (_label, meId) => {
    serve({ roles: ['admin'], can: 'error', meId });
    await settled();
    expect(await screen.findByText(t('staff.team.readOnlyNote'))).toBeInTheDocument();
    expectNoEditControls();
    expect(pastRacerRequests).toBe(0);
  });

  it('does not auto-start the tour for staff, but Take the tour still works', async () => {
    localStorage.removeItem(TOUR_OFF_KEY);
    serve({ roles: ['operator'], can: allCan });
    await screen.findByRole('button', { name: t('roster.add') });
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
