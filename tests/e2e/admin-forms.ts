/**
 * Staff UI helpers for the e2e race lifecycle. They drive the SPA staff pages
 * under /register/staff (race form, fee pages) as the logged-in staff user, who
 * is an operator, never an admin. Nothing here may load a legacy HAML page;
 * specs call forbidLegacyPages to enforce that.
 *
 * Fields are located by their visible labels. Dates are `datetime-local` inputs
 * holding the wall-clock time in the race's zone (wallClockInput), whatever the
 * runner's TZ is. `tests/` does not import `frontend/src`, so the labels are
 * written out here and must follow the SPA's copy (`frontend/src/locales/en.ts`).
 *
 * The race and fee forms ask "Discard changes?" when left with unsaved edits,
 * so the helpers never navigate away from a form they have not saved; a
 * successful save navigates without asking.
 */
import { expect, type Page } from '@playwright/test';
import type { Target } from './target';
/** Same path as STAFF_STATE in playwright.config.ts. */
export const STAFF_STATE = 'playwright/.auth/staff.json';

export const E2E_RACE_PREFIX = 'Race E2E ';
export const RETIRED_SUFFIX = ' [retired]';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** An open E2E race younger than this may belong to a run still in progress. */
export const SWEEP_MIN_AGE_MS = 2 * HOUR;

/**
 * `Race E2E <runId> <yyyy-mm-ddThh:mm>Z`. The UTC start time lets a sweep tell a
 * leftover race from one a concurrent run is still using.
 */
export function e2eRaceName(runId: string, createdAt: Date): string {
  return `${E2E_RACE_PREFIX}${runId} ${createdAt.toISOString().slice(0, 16)}Z`;
}

/**
 * Whether a sweep may retire an open race: an E2E race from this run (an
 * earlier attempt of a retried test) or one created at least SWEEP_MIN_AGE_MS
 * ago. An E2E name without a readable time counts as old.
 */
export function isSweepable(name: string, runId: string, now: number): boolean {
  if (!name.startsWith(E2E_RACE_PREFIX) || name.includes(RETIRED_SUFFIX.trim())) return false;
  if (name.startsWith(`${E2E_RACE_PREFIX}${runId} `)) return true;
  const stamp = name.match(/ (\d{4}-\d{2}-\d{2}T\d{2}:\d{2})Z$/)?.[1];
  const createdAt = stamp ? Date.parse(`${stamp}:00Z`) : NaN;
  return Number.isNaN(createdAt) || now - createdAt >= SWEEP_MIN_AGE_MS;
}

export interface RaceInput {
  name: string;
  timeZone: string;
  registrationOpen: Date;
  registrationClose: Date;
  finalEditsClose: Date;
  raceDatetime: Date;
  maxTeams: number;
  peoplePerTeam: number;
  experienceLabels: string[];
  jsonform: string;
  classyCampaignId?: number;
  classyDefaultGoal?: number;
}

export type RequirementTypeLabel = 'Card payment' | 'Test payment (no card)';

/** The fee form's Type option label for a requirement class. */
export function requirementTypeLabel(type: Target['requirementType']): RequirementTypeLabel {
  return type === 'MockPaymentRequirement' ? 'Test payment (no card)' : 'Card payment';
}

/** `at` as wall-clock parts in `timeZone`. */
export function wallClock(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
    second: part('second'),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `at` as the `YYYY-MM-DDTHH:mm` a `datetime-local` input takes: the wall clock in `timeZone`. */
export function wallClockInput(at: Date, timeZone: string): string {
  const w = wallClock(at, timeZone);
  return `${String(w.year).padStart(4, '0')}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

const SPA_PATH = /^\/register(\/|$)/;

/**
 * Fails the test when the page's main frame loads anything outside the SPA
 * (`/register...`; `about:blank` is allowed), e.g. a legacy HAML page. The
 * failure names the URL. API calls through `page.request` are not navigations
 * and stay allowed. Call it first in a test, before any `goto`.
 */
export function forbidLegacyPages(page: Page): void {
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    const url = frame.url();
    if (url === 'about:blank') return;
    expect.soft(new URL(url).pathname, `legacy page loaded: ${url}`).toMatch(SPA_PATH);
  });
}

/** Navigates and fails fast on an error page (e.g. the operator is forbidden). */
async function visit(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  const status = response?.status() ?? 0;
  if (status >= 400) throw new Error(`GET ${path} returned ${status}`);
}

/** The field and banner errors a form shows, for the message of a failed save. */
async function formErrors(page: Page): Promise<string> {
  const texts = await page
    .locator('[role="alert"], ul[id$="-error"] li')
    .evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()).filter(Boolean));
  return texts.join('; ') || '(no error text shown)';
}

/**
 * Waits for the save to leave the form (URL matching `done`). Throws with the
 * page's error text when the form instead shows errors and stays put.
 */
async function savedTo(page: Page, done: RegExp, what: string): Promise<RegExpMatchArray> {
  const problem = page.locator('[role="alert"], [aria-invalid="true"]');
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const path = new URL(page.url()).pathname;
    const match = path.match(done);
    if (match) return match;
    // A save that fails client-side or server-side stays on the form and shows its errors.
    if ((await problem.count()) > 0) {
      const settled = new URL(page.url()).pathname;
      if (!done.test(settled)) throw new Error(`${what} failed on ${settled}: ${await formErrors(page)}`);
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`${what}: still on ${new URL(page.url()).pathname} after 30 s`);
}

/** The race form's date labels, in form order (the SPA's DATE_LABELS). */
const DATE_LABELS = {
  registrationOpen: 'Registration opens',
  registrationClose: 'Registration closes',
  finalEditsClose: 'Final edits close',
  raceDatetime: 'Race day',
} as const;

async function fillRaceDates(
  page: Page,
  dates: Pick<RaceInput, 'registrationOpen' | 'registrationClose' | 'finalEditsClose' | 'raceDatetime'>,
  timeZone: string,
) {
  for (const [key, label] of Object.entries(DATE_LABELS) as [keyof typeof DATE_LABELS, string][]) {
    await page.getByLabel(label, { exact: true }).fill(wallClockInput(dates[key], timeZone));
  }
}

const RACE_OVERVIEW = /^\/register\/staff\/races\/(\d+)$/;

/** Creates a race through /register/staff/races/new and returns its id (from the overview URL). */
export async function createRace(page: Page, input: RaceInput): Promise<{ id: number }> {
  await visit(page, '/register/staff/races/new');
  await expect(page.getByRole('heading', { name: 'New race', exact: true })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill(input.name);
  // Pick the zone first: the dates are read in the zone selected when they are entered.
  await page.getByLabel('Time zone', { exact: true }).selectOption(input.timeZone);
  await fillRaceDates(page, input, input.timeZone);
  await page.getByLabel('Max teams', { exact: true }).fill(String(input.maxTeams));
  await page.getByLabel('Racers per team', { exact: true }).fill(String(input.peoplePerTeam));
  await page.getByLabel('Questions JSON', { exact: true }).fill(input.jsonform);
  await page.getByLabel('Team experience choices', { exact: true }).fill(input.experienceLabels.join('\n'));
  if (input.classyCampaignId !== undefined) {
    await page.getByLabel('Campaign ID', { exact: true }).fill(String(input.classyCampaignId));
  }
  if (input.classyDefaultGoal !== undefined) {
    await page.getByLabel('Default team goal ($)', { exact: true }).fill(String(input.classyDefaultGoal));
  }
  await page.getByRole('button', { name: 'Create race', exact: true }).click();

  const match = await savedTo(page, RACE_OVERVIEW, `Creating race ${input.name}`);
  return { id: Number(match[1]) };
}

/** Adds a fee with its first price through /register/staff/races/:raceId/requirements/new and returns its id. */
export async function addFee(
  page: Page,
  raceId: number,
  fee: { name: string; typeLabel: RequirementTypeLabel; priceDollars: number; beginAt: Date },
  timeZone: string,
): Promise<{ id: number }> {
  await visit(page, `/register/staff/races/${raceId}/requirements/new`);
  await expect(page.getByRole('heading', { name: 'Add a fee', exact: true })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill(fee.name);
  await page.getByLabel('Type', { exact: true }).selectOption({ label: fee.typeLabel });
  await page.getByLabel('First price', { exact: true }).fill(String(fee.priceDollars));
  await page.getByLabel('Starts', { exact: true }).fill(wallClockInput(fee.beginAt, timeZone));
  await page.getByRole('button', { name: 'Add fee', exact: true }).click();

  const match = await savedTo(
    page,
    new RegExp(`^/register/staff/races/${raceId}/requirements/(\\d+)$`),
    `Adding fee ${fee.name}`,
  );
  const id = Number(match[1]);
  if (id === 0 || Number.isNaN(id)) throw new Error(`Fee ${fee.name} was saved but its page did not load`);
  return { id };
}

/** Adds a price on the fee page (`/register/staff/races/:raceId/requirements/:feeId`); `beginAt` is entered in the race's zone. */
export async function addPrice(
  page: Page,
  raceId: number,
  feeId: number,
  price: { priceDollars: number; beginAt: Date },
  timeZone: string,
): Promise<void> {
  const path = `/register/staff/races/${raceId}/requirements/${feeId}`;
  if (new URL(page.url()).pathname !== path) await visit(page, path);
  await page.getByRole('button', { name: '+ Add a price', exact: true }).click();
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add price', exact: true }) });
  await form.getByLabel('Price', { exact: true }).fill(String(price.priceDollars));
  await form.getByLabel('Starts', { exact: true }).fill(wallClockInput(price.beginAt, timeZone));
  await form.getByRole('button', { name: 'Add price', exact: true }).click();
  // The form closes and the new price is a row of the table.
  const table = page.getByRole('table', { name: 'Prices by date' });
  await expect(form).toHaveCount(0);
  await expect(table.getByRole('cell', { name: `$${price.priceDollars}`, exact: true }).first()).toBeVisible();
}

/**
 * Moves every window and the race date into the past (open -4 d, close -3 d,
 * final edits -2 d, race -1 d) and appends " [retired]" to the name, so the
 * race leaves /api/v1/races and the current races on the staff list.
 */
export async function retireRace(page: Page, raceId: number): Promise<void> {
  await visit(page, `/register/staff/races/${raceId}/edit`);
  const name = page.getByLabel('Name', { exact: true });
  // The form mounts once the race has loaded.
  await expect(name).not.toHaveValue('');
  const current = await name.inputValue();
  if (!current.startsWith(E2E_RACE_PREFIX)) {
    throw new Error(`Refusing to retire race ${raceId}: its name does not start with "${E2E_RACE_PREFIX}"`);
  }
  if (!current.endsWith(RETIRED_SUFFIX)) await name.fill(`${current}${RETIRED_SUFFIX}`);
  const timeZone = await page.getByLabel('Time zone', { exact: true }).inputValue();
  const now = Date.now();
  await fillRaceDates(
    page,
    {
      registrationOpen: new Date(now - 4 * DAY),
      registrationClose: new Date(now - 3 * DAY),
      finalEditsClose: new Date(now - 2 * DAY),
      raceDatetime: new Date(now - DAY),
    },
    timeZone,
  );
  await page.getByRole('button', { name: 'Save race', exact: true }).click();
  await savedTo(page, new RegExp(`^/register/staff/races/${raceId}$`), `Retiring race ${raceId}`);
}

/** The not-retired `Race E2E *` races, from the staff race list API (the session cookie rides on `page.request`). */
async function currentE2ERaces(page: Page): Promise<{ id: number; name: string }[]> {
  const response = await page.request.get('/api/v1/staff/races');
  expect(response.status(), 'GET /api/v1/staff/races (is the staff user logged in as an operator?)').toBe(200);
  const { races } = (await response.json()) as { races: { id: number; name: string }[] };
  return races
    .filter(({ name }) => name.startsWith(E2E_RACE_PREFIX) && !name.includes('[retired]'))
    .map(({ id, name }) => ({ id, name }));
}

/** Ids of the not-retired `Race E2E *` races. */
export async function currentE2ERaceIds(page: Page): Promise<number[]> {
  return (await currentE2ERaces(page)).map(({ id }) => id);
}

/**
 * Retires the open E2E races that isSweepable allows (this run's, and other
 * runs' older than SWEEP_MIN_AGE_MS) and returns their ids. A concurrent run's
 * fresh race is left alone.
 */
export async function sweepLeftoverRaces(page: Page, runId: string): Promise<number[]> {
  const now = Date.now();
  const ids = (await currentE2ERaces(page)).filter(({ name }) => isSweepable(name, runId, now)).map(({ id }) => id);
  for (const id of ids) await retireRace(page, id);
  return ids;
}

/** Role names (lowercase, e.g. "operator") of the logged-in user, from `GET /api/v1/me`. */
export async function loggedInRoles(page: Page): Promise<string[]> {
  const response = await page.request.get('/api/v1/me');
  expect(response.status(), 'GET /api/v1/me (is the staff user logged in?)').toBe(200);
  const { user } = await response.json();
  return (user.roles as string[]).map((role) => role.toLowerCase());
}
