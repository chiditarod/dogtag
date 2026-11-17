/**
 * Test A: the operator creates this run's race through the admin UI and hands
 * its id to the registration project (writeRaceState). race-teardown retires it.
 *
 *   TZ=UTC npx playwright test --project=race-setup
 *
 * Tests in this file run in order on one worker. The sweep test comes first:
 * a sweep retires this run's own `Race E2E *` races (and other runs' older
 * than two hours), so running it after test A would retire this run's race too.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runId, target, writeRaceState } from './run';
import {
  addRequirement,
  addTier,
  createRace,
  currentE2ERaceIds,
  e2eRaceName,
  loggedInRoles,
  requirementTypeLabel,
  sweepLeftoverRaces,
  type RaceInput,
} from './admin-forms';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TIME_ZONE = 'America/Chicago';
const EXPERIENCE_LABELS = ['First year', 'Second year', 'Third year', 'Four or more years'];
const CLASSY_DEFAULT_GOAL = 500;

const jsonform = readFileSync(join(__dirname, 'fixtures', 'jsonform.json'), 'utf8');

/** The Global Constraints race values, relative to `now`. */
function raceInput(name: string, now: number): RaceInput {
  return {
    name,
    timeZone: TIME_ZONE,
    registrationOpen: new Date(now - DAY),
    registrationClose: new Date(now + 14 * DAY),
    // RaceValidator needs registration_close < final_edits_close.
    finalEditsClose: new Date(now + 14 * DAY + HOUR),
    raceDatetime: new Date(now + 30 * DAY),
    maxTeams: 50,
    peoplePerTeam: 5,
    experienceLabels: EXPERIENCE_LABELS,
    jsonform,
    ...(target.classy ? { classyCampaignId: target.classy.campaignId, classyDefaultGoal: CLASSY_DEFAULT_GOAL } : {}),
  };
}

async function apiRaces(request: APIRequestContext): Promise<any[]> {
  const response = await request.get('/api/v1/races');
  expect(response.status()).toBe(200);
  return (await response.json()).races;
}

test('sweepLeftoverRaces retires a leftover open E2E race', async ({ page, request }) => {
  test.skip(target.name === 'staging', 'Creates a decoy race; the sweep itself runs in test A on staging');

  // Named as if another run created it three hours ago.
  const decoyName = e2eRaceName(`sweep-${runId()}`, new Date(Date.now() - 3 * HOUR));
  const { id } = await createRace(page, raceInput(decoyName, Date.now()));
  expect(await currentE2ERaceIds(page)).toContain(id);

  expect(await sweepLeftoverRaces(page, runId())).toContain(id);

  expect(await currentE2ERaceIds(page)).not.toContain(id);
  const races = await apiRaces(request);
  expect(races.map((r) => r.id)).not.toContain(id);
  expect(races.map((r) => r.name)).not.toContain(decoyName);
});

test('A: the operator sets up the race through the admin UI', async ({ page, request }) => {
  const roles = await loggedInRoles(page);
  console.log(`race-setup: logged in with role(s) ${roles.join(', ')}`);
  expect(roles).toContain('Operator');
  expect(roles).not.toContain('Admin');

  // An interrupted earlier run may have left its race open (staging).
  const swept = await sweepLeftoverRaces(page, runId());
  if (swept.length > 0) console.log(`race-setup: retired leftover race(s) ${swept.join(', ')}`);

  const now = Date.now();
  const raceName = e2eRaceName(runId(), new Date(now));
  const input = raceInput(raceName, now);
  const { id: raceId } = await createRace(page, input);
  // Written now, not after the assertions, so race-teardown retires the race
  // even if a later step fails. The registration project only runs when this
  // test passes.
  writeRaceState({ raceId, raceName });

  const typeLabel = requirementTypeLabel(target.requirementType);
  const deposit = await addRequirement(page, raceId, { name: 'Cart Deposit', typeLabel });
  await addTier(page, deposit.id, { priceCents: 8800, beginAt: input.registrationOpen }, TIME_ZONE);
  const registration = await addRequirement(page, raceId, { name: 'Race Registration', typeLabel });
  await addTier(page, registration.id, { priceCents: 13000, beginAt: input.registrationOpen }, TIME_ZONE);
  await addTier(page, registration.id, { priceCents: 15000, beginAt: new Date(now + 7 * DAY) }, TIME_ZONE);

  const race = (await apiRaces(request)).find((r) => r.name === raceName);
  expect(race).toMatchObject({ id: raceId, open_for_registration: true, people_per_team: 5, time_zone: TIME_ZONE });
  expect(race.payment_requirements.map((p: any) => [p.name, p.type])).toEqual([
    ['Cart Deposit', target.requirementType],
    ['Race Registration', target.requirementType],
  ]);
  expect(race.payment_requirements.map((p: any) => p.current_price_cents)).toEqual([8800, 13000]);
  expect(race.payment_requirements[1].next_tier?.price_cents).toBe(15000);
  expect(race.jsonform).toBeTruthy();
  expect(race.experience_labels).toEqual(EXPERIENCE_LABELS);
  // The datetime selects were filled in race-zone wall-clock time, whatever the runner's TZ.
  expect(Math.abs(Date.parse(race.registration_open) - input.registrationOpen.getTime())).toBeLessThan(60_000);

  // The admin race page lists both requirements.
  await page.goto(`/races/${raceId}/edit`);
  await expect(page.getByRole('cell', { name: 'Cart Deposit', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Race Registration', exact: true })).toBeVisible();
});
