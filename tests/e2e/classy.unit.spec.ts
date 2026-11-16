/**
 * Guard for the Classy delete helper. Runs in the unit project with no
 * credentials: the guard must throw before any network request, so fetch is
 * replaced with a function that fails the test if it is ever called.
 */
import { test, expect } from '@playwright/test';
import { deleteFundraisingTeam } from './classy';

test.describe('Classy delete guard', () => {
  const realFetch = globalThis.fetch;
  let calls = 0;

  test.beforeEach(() => {
    calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      throw new Error('network call attempted');
    }) as typeof fetch;
  });

  test.afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('deleteFundraisingTeam refuses non-e2e teams and other campaigns', async () => {
    await expect(deleteFundraisingTeam({ id: 1, name: 'Real Team' }, 867400)).rejects.toThrow(/Test Team E2E/);
    await expect(deleteFundraisingTeam({ id: 1, name: 'Test Team E2E x' }, 123)).rejects.toThrow(/campaign/);
    expect(calls).toBe(0);
  });
});
