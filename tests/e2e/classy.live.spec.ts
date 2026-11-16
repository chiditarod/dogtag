/**
 * Live Classy check. Credentials come only from target.classy, which is null
 * (and the test skips) unless CLASSY_CLIENT_ID, CLASSY_CLIENT_SECRET and
 * E2E_CLASSY_CAMPAIGN_ID are set:
 *
 *   E2E_TARGET=staging npx playwright test --project=live -g Classy
 */
import { test, expect } from '@playwright/test';
import { runId, target } from './run';
import { findFundraisingTeamsByName } from './classy';

test.describe('Classy', () => {
  test.skip(!target.classy, 'Classy credentials or campaign id are not set');

  test('findFundraisingTeamsByName resolves to [] for an unknown team', async () => {
    const name = `No Such Team ${runId()}`;
    await expect(findFundraisingTeamsByName(target.classy!.campaignId, name)).resolves.toEqual([]);
  });
});
