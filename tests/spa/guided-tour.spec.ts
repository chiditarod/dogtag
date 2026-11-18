import { test, expect } from '@playwright/test';
import { clearInbox } from '../helpers/mailpit';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: the team page opens its guided tour on a first visit; it ends for good and can be replayed. */

interface Credentials {
  captain_email: string;
  captain_password: string;
  team_id: number;
  team_name: string;
}

let seeded: Seed<Credentials>;

// playwright.config.ts sets `dogtag:tour:off` for every test; this spec needs the tour to start by itself.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('SPA guided tour', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('past_racers');
  });
  test.afterAll(() => seeded.dispose());
  test.beforeEach(() => clearInbox());

  test('opens on the first visit, ends for good and can be replayed', async ({ page }) => {
    const c = seeded.credentials;
    // The past_racers race has no JSONForm and no fee, so there is no questions or fee stop: three stops, not five.
    const tour = (title: string) => page.getByRole('dialog', { name: title });

    await test.step('Log in and open the team: the tour starts by itself', async () => {
      await page.goto('/register/login');
      await page.getByLabel('Email', { exact: true }).fill(c.captain_email);
      await page.getByLabel('Password', { exact: true }).fill(c.captain_password);
      await page.getByRole('button', { name: 'Log in' }).click();

      await expect(page.getByRole('heading', { name: 'My teams' })).toBeVisible();
      await page.getByRole('link', { name: `View team: ${c.team_name}` }).click();
      await expect(page).toHaveURL(new RegExp(`/register/teams/${c.team_id}$`));

      await expect(tour('Four stars to the start line')).toBeVisible();
      await expect(tour('Four stars to the start line').getByText('1 of 3')).toBeVisible();
    });

    await test.step('Next walks the stops', async () => {
      await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click();
      await expect(tour('Add your racers')).toBeVisible();
      await expect(tour('Add your racers').getByText('2 of 3')).toBeVisible();

      await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click();
      await expect(tour("You're in")).toBeVisible();
      await expect(tour("You're in").getByText('3 of 3')).toBeVisible();
    });

    await test.step('Done closes it, and it stays closed after a reload', async () => {
      await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await page.reload();
      await expect(page.getByRole('heading', { name: c.team_name })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    await test.step('Take the tour replays it, and End tour closes it', async () => {
      await page.getByRole('button', { name: 'Take the tour' }).click();
      await expect(tour('Four stars to the start line')).toBeVisible();

      await page.getByRole('dialog').getByRole('button', { name: 'End tour' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  });
});
