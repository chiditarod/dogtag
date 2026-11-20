import { test, expect, type Locator, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/**
 * Race list: open races first, then waitlist, registration-over and not-yet-open races
 * (the seeded race dates run in the opposite order), and a logged-in captain sees their
 * own teams on the tiles for the races they have joined.
 */

interface Credentials {
  short_id: string;
  captain_email: string;
  captain_password: string;
  race_names: { open: string; waitlist: string; closed: string; not_yet_open: string };
  open_team_name: string;
  closed_team_name: string;
}

let seeded: Seed<Credentials>;

function tile(page: Page, raceName: string): Locator {
  return page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 2, name: raceName, exact: true }) });
}

test.describe('SPA race list', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('race_list_order');
  });
  test.afterAll(() => seeded.dispose());

  test('lists open races first, then waitlist, registration-over and not-yet-open races', async ({ page }) => {
    const c = seeded.credentials;
    const names = c.race_names;

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Choose your race' })).toBeVisible();

    // Other specs' races can share the page, so only look at this run's four.
    const headings = page.getByRole('heading', { level: 2 }).filter({ hasText: c.short_id });
    await expect(headings).toHaveCount(4);
    expect(await headings.allTextContents()).toEqual([
      names.open,
      names.waitlist,
      names.closed,
      names.not_yet_open,
    ]);

    await test.step('Badges and start links match each status', async () => {
      const open = tile(page, names.open);
      await expect(open.getByText('Open', { exact: true })).toBeVisible();
      await expect(open.getByRole('link', { name: 'Start a team' })).toBeVisible();

      const waitlist = tile(page, names.waitlist);
      await expect(waitlist.getByText('Waitlist', { exact: true })).toBeVisible();
      await expect(waitlist.getByRole('link', { name: 'Start a team' })).toBeVisible();

      const closed = tile(page, names.closed);
      await expect(closed.getByText('Closed', { exact: true })).toBeVisible();
      await expect(closed.getByText(/^Opens /)).toHaveCount(0);
      await expect(closed.getByRole('link', { name: /Start/ })).toHaveCount(0);

      const notYetOpen = tile(page, names.not_yet_open);
      await expect(notYetOpen.getByText('Closed', { exact: true })).toBeVisible();
      await expect(notYetOpen.getByText(/^Opens /)).toBeVisible();
      await expect(notYetOpen.getByRole('link', { name: /Start/ })).toHaveCount(0);
    });

    await test.step('A logged-out visitor sees no teams list', async () => {
      await expect(page.getByText('Your teams')).toHaveCount(0);
    });
  });

  test("shows a logged-in captain's teams on their race tiles", async ({ page }) => {
    const c = seeded.credentials;
    const names = c.race_names;

    await test.step('Log in', async () => {
      await page.goto('/register/login');
      await page.getByLabel('Email', { exact: true }).fill(c.captain_email);
      await page.getByLabel('Password', { exact: true }).fill(c.captain_password);
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page.getByRole('heading', { name: 'My teams' })).toBeVisible();
    });

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Choose your race' })).toBeVisible();

    await test.step('The open race shows the team, its chip and "Start another team"', async () => {
      const open = tile(page, names.open);
      await expect(open.getByText('Your teams')).toBeVisible();
      await expect(open.getByRole('link', { name: new RegExp(c.open_team_name) })).toBeVisible();
      await expect(open.getByText(/things? left/)).toBeVisible();
      await expect(open.getByRole('link', { name: 'Start another team' })).toBeVisible();
    });

    await test.step('The closed race still shows the team, with no start link', async () => {
      const closed = tile(page, names.closed);
      await expect(closed.getByRole('link', { name: new RegExp(c.closed_team_name) })).toBeVisible();
      await expect(closed.getByRole('link', { name: /Start/ })).toHaveCount(0);
    });

    await test.step('Races without a team of theirs show none', async () => {
      await expect(tile(page, names.waitlist).getByText('Your teams')).toHaveCount(0);
      await expect(tile(page, names.not_yet_open).getByText('Your teams')).toHaveCount(0);
      await expect(tile(page, names.waitlist).getByRole('link', { name: 'Start a team' })).toBeVisible();
    });

    await test.step('The team link opens the team page', async () => {
      await tile(page, names.open).getByRole('link', { name: new RegExp(c.open_team_name) }).click();
      await expect(page).toHaveURL(/\/register\/teams\/\d+$/);
    });
  });
});
