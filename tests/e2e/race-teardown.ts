/**
 * Teardown for the race-setup project: retires this run's race (dates moved
 * into the past, " [retired]" appended) and then deletes the saved staff
 * session, even when retiring fails.
 */
import { test as teardown } from '@playwright/test';
import { rmSync } from 'fs';
import { readRaceState } from './run';
import { retireRace, STAFF_STATE } from './admin-forms';

teardown('retire the race and forget the staff session', async ({ page }) => {
  try {
    const { raceId, raceName } = readRaceState();
    await retireRace(page, raceId);
    console.log(`race-teardown: retired race ${raceId} (${raceName})`);
  } finally {
    rmSync(STAFF_STATE, { force: true });
  }
});
