/**
 * Live Classy check. Credentials come only from target.classy, which is null
 * (and the test skips) unless E2E_CHECK_CLASSY=1, with CLASSY_CLIENT_ID,
 * CLASSY_CLIENT_SECRET and E2E_CLASSY_CAMPAIGN_ID set:
 *
 *   E2E_CHECK_CLASSY=1 E2E_TARGET=staging npx playwright test --project=live -g Classy
 */
import { test, expect } from '@playwright/test';
import { runId, target } from './run';
import { findFundraisingTeamsByName } from './classy';

test.describe('Classy', () => {
  test.skip(!target.classy, 'E2E_CHECK_CLASSY=1 is not set');

  test('findFundraisingTeamsByName resolves to [] for an unknown team', async () => {
    const name = `No Such Team ${runId()}`;
    await expect(findFundraisingTeamsByName(target.classy!.campaignId, name)).resolves.toEqual([]);
  });
});
