/**
 * Test A: the operator creates this run's race through the SPA staff pages and hands
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
  addFee,
  addPrice,
  createRace,
  currentE2ERaceIds,
  e2eRaceName,
  forbidLegacyPages,
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
  forbidLegacyPages(page);
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

test('A: the operator sets up the race through the SPA staff pages', async ({ page, request }) => {
  forbidLegacyPages(page);
  const roles = await loggedInRoles(page);
  console.log(`race-setup: logged in with role(s) ${roles.join(', ')}`);
  expect(roles).toContain('operator');
  expect(roles).not.toContain('admin');

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
  await addFee(page, raceId, { name: 'Cart Deposit', typeLabel, priceDollars: 88, beginAt: input.registrationOpen }, TIME_ZONE);
  const registration = await addFee(
    page,
    raceId,
    { name: 'Race Registration', typeLabel, priceDollars: 130, beginAt: input.registrationOpen },
    TIME_ZONE,
  );
  await addPrice(page, raceId, registration.id, { priceDollars: 150, beginAt: new Date(now + 7 * DAY) }, TIME_ZONE);

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
  // The datetime inputs were filled in race-zone wall-clock time, whatever the runner's TZ.
  expect(Math.abs(Date.parse(race.registration_open) - input.registrationOpen.getTime())).toBeLessThan(60_000);

  // The staff race page lists both fees.
  await page.goto(`/register/staff/races/${raceId}`);
  const fees = page.getByRole('region', { name: 'Fees', exact: true });
  await expect(fees.getByText('Cart Deposit', { exact: true })).toBeVisible();
  await expect(fees.getByText('Race Registration', { exact: true })).toBeVisible();
});
