/**
 * Admin UI helpers for the e2e race lifecycle. They drive the legacy HAML admin
 * forms (Bootstrap 3) as the logged-in staff user, who is an operator, never an
 * admin.
 *
 * Most admin form labels use `label_tag :name`, which is not tied to the
 * `race_name` field, so fields are located by their Rails ids. Datetimes are
 * Rails `datetime_select` dropdowns (`<prefix>_1i`..`_5i`, `_6i` for seconds)
 * and are filled with wall-clock time in the race's zone, whatever the runner's
 * TZ is.
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

export type RequirementTypeLabel = 'Payment' | 'Mock payment';

/** The requirement form's Type option label for a requirement class. */
export function requirementTypeLabel(type: Target['requirementType']): RequirementTypeLabel {
  return type === 'MockPaymentRequirement' ? 'Mock payment' : 'Payment';
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

/**
 * Fills a Rails datetime_select. Option values: year "2026", month "1".."12",
 * day "1".."31", hour/minute/second zero-padded.
 */
export async function fillDateTimeSelect(page: Page, prefix: string, at: Date, timeZone: string): Promise<void> {
  const w = wallClock(at, timeZone);
  const values = [String(w.year), String(w.month), String(w.day), pad(w.hour), pad(w.minute)];
  for (const [i, value] of values.entries()) {
    await page.locator(`#${prefix}_${i + 1}i`).selectOption(value);
  }
  const seconds = page.locator(`#${prefix}_6i`);
  if ((await seconds.count()) > 0) await seconds.selectOption(pad(w.second));
}

/**
 * Clicks Save and waits for the flash. Throws with the page's error flash when
 * the save failed (validation errors re-render the form with an alert).
 */
async function saveExpecting(page: Page, success: string): Promise<void> {
  await expect(page.locator('.alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const alert = page.locator('.alert').first();
  await expect(alert).toBeVisible();
  const text = (await alert.innerText()).trim();
  if (!text.includes(success)) throw new Error(`Save failed on ${new URL(page.url()).pathname}: ${text}`);
}

/** Navigates and fails fast on an error page (e.g. the operator is forbidden). */
async function visit(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  const status = response?.status() ?? 0;
  if (status >= 400) throw new Error(`GET ${path} returned ${status}`);
}

async function fillRaceDates(page: Page, dates: Pick<RaceInput, 'registrationOpen' | 'registrationClose' | 'finalEditsClose' | 'raceDatetime'>, timeZone: string) {
  await fillDateTimeSelect(page, 'race_registration_open', dates.registrationOpen, timeZone);
  await fillDateTimeSelect(page, 'race_registration_close', dates.registrationClose, timeZone);
  await fillDateTimeSelect(page, 'race_final_edits_close', dates.finalEditsClose, timeZone);
  await fillDateTimeSelect(page, 'race_race_datetime', dates.raceDatetime, timeZone);
}

/** Creates a race through /races/new and returns its id (from the races index link). */
export async function createRace(page: Page, input: RaceInput): Promise<{ id: number }> {
  await visit(page, '/races/new');
  await page.locator('#race_name').fill(input.name);
  // Pick the zone first: the dates are read in the zone submitted with the form.
  await page.getByLabel('Time zone').selectOption(input.timeZone);
  await fillRaceDates(page, input, input.timeZone);
  await page.locator('#race_max_teams').fill(String(input.maxTeams));
  await page.locator('#race_people_per_team').fill(String(input.peoplePerTeam));
  await page.locator('#race_jsonform').fill(input.jsonform);
  await page.locator('#race_experience_labels_text').fill(input.experienceLabels.join('\n'));
  if (input.classyCampaignId !== undefined) {
    await page.locator('#race_classy_campaign_id').fill(String(input.classyCampaignId));
  }
  if (input.classyDefaultGoal !== undefined) {
    await page.locator('#race_classy_default_goal').fill(String(input.classyDefaultGoal));
  }
  await saveExpecting(page, 'Successfully created.');

  // Create redirects to /races, which links each race by name (names are unique).
  const href = await page.getByRole('link', { name: input.name, exact: true }).getAttribute('href');
  const id = Number(href?.match(/\/races\/(\d+)$/)?.[1]);
  if (!id) throw new Error(`Could not find the id of race ${input.name} on /races`);
  return { id };
}

/** Adds a requirement through /races/:id/requirements/new and returns its id. */
export async function addRequirement(
  page: Page,
  raceId: number,
  r: { name: string; typeLabel: RequirementTypeLabel },
): Promise<{ id: number }> {
  await visit(page, `/races/${raceId}/requirements/new`);
  await page.locator('#requirement_name').fill(r.name);
  await page.locator('#requirement_type').selectOption({ label: r.typeLabel });
  await saveExpecting(page, 'Successfully created.');

  // Create redirects to the requirement's edit page.
  const id = Number(new URL(page.url()).pathname.match(/\/requirements\/(\d+)\/edit$/)?.[1]);
  if (!id) throw new Error(`Requirement ${r.name} was saved but its edit page did not load`);
  return { id };
}

/** Adds a price tier through /tiers/new; `beginAt` is entered in the race's zone. */
export async function addTier(
  page: Page,
  requirementId: number,
  t: { priceCents: number; beginAt: Date },
  timeZone: string,
): Promise<void> {
  await visit(page, `/tiers/new?requirement_id=${requirementId}`);
  await page.locator('#tier_price').fill(String(t.priceCents));
  await fillDateTimeSelect(page, 'tier_begin_at', t.beginAt, timeZone);
  await saveExpecting(page, 'Successfully created.');
  await expect(page).toHaveURL(new RegExp(`/requirements/${requirementId}/edit$`));
}

/**
 * Moves every window and the race date into the past (open -4 d, close -3 d,
 * final edits -2 d, race -1 d) and appends " [retired]" to the name, so the
 * race leaves /api/v1/races and the current list on /races.
 */
export async function retireRace(page: Page, raceId: number): Promise<void> {
  await visit(page, `/races/${raceId}/edit`);
  const name = page.locator('#race_name');
  const current = await name.inputValue();
  if (!current.startsWith(E2E_RACE_PREFIX)) {
    throw new Error(`Refusing to retire race ${raceId}: its name does not start with "${E2E_RACE_PREFIX}"`);
  }
  if (!current.endsWith(RETIRED_SUFFIX)) await name.fill(`${current}${RETIRED_SUFFIX}`);
  const timeZone = await page.getByLabel('Time zone').inputValue();
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
  await saveExpecting(page, 'Successfully updated.');
}

/** The not-retired `Race E2E *` races listed under current races on /races. */
async function currentE2ERaces(page: Page): Promise<{ id: number; name: string }[]> {
  await visit(page, '/races');
  // The current races' .row.well directly follows the page header; past races
  // come after the "Past races" heading. With no current races there is no
  // adjacent .row.well, so nothing matches.
  const links = await page
    .locator('.page-header + .row.well h2 a')
    .evaluateAll((anchors) => anchors.map((a) => ({ name: (a.textContent ?? '').trim(), href: a.getAttribute('href') ?? '' })));
  return links
    .filter(({ name }) => name.startsWith(E2E_RACE_PREFIX) && !name.includes('[retired]'))
    .map(({ name, href }) => ({ name, id: Number(href.match(/\/races\/(\d+)$/)?.[1]) }))
    .filter(({ id }) => id > 0);
}

/** Ids of the not-retired `Race E2E *` races listed under current races on /races. */
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

/** Role names (e.g. "Operator") of the logged-in user, read from their profile page. */
export async function loggedInRoles(page: Page): Promise<string[]> {
  const response = await page.request.get('/api/v1/me');
  expect(response.status(), 'GET /api/v1/me (is the staff user logged in?)').toBe(200);
  const { user } = await response.json();
  await visit(page, `/users/${user.id}`);
  const heading = page.locator('h3', { has: page.locator('small', { hasText: /roles/i }) });
  if ((await heading.count()) === 0) return [];
  const text = (await heading.innerText()).replace(/^\s*roles\s*/i, '');
  return text.split(',').map((role) => role.trim()).filter(Boolean);
}
