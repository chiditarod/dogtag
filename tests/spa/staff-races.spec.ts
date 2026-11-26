import { test, expect, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: staff race setup (list, overview, create, edit, export, delete) and who may see it. */

interface Credentials {
  operator_email: string;
  admin_email: string;
  refunder_email: string;
  password: string;
  busy_name: string;
  busy_id: number;
  empty_name: string;
  new_name: string;
}

let seeded: Seed<Credentials>;

async function login(page: Page, email: string, password: string) {
  await page.goto('/register/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('link', { name: 'My teams' })).toBeVisible();
}

const staffNav = (page: Page) => page.getByRole('navigation', { name: 'Staff' });
const row = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

// Far enough ahead to stay in the future, and every date before the March DST change so the zone is CST/EST.
const OPEN = '2030-01-07T12:00';
const CLOSE_AT_MIDNIGHT = '2030-02-15T00:00';
const FINAL_EDITS = '2030-02-25T00:00';
const RACE_DAY = '2030-03-02T10:00';

test.describe('SPA staff races', () => {
  // The create, edit and export steps build on the race the first of them makes.
  test.describe.configure({ mode: 'serial' });

  let newRaceUrl = '';

  test.beforeAll(() => {
    seeded = seed<Credentials>('staff_races');
  });
  test.afterAll(() => seeded.dispose());

  test('a refunder has no Races link in the staff nav', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.refunder_email, c.password);
    await page.goto('/register/staff/payments');
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
    await expect(staffNav(page).getByRole('link', { name: 'Payments' })).toBeVisible();
    await expect(staffNav(page).getByRole('link', { name: 'Races' })).toHaveCount(0);
  });

  test('a refunder who types the Races URL sees Not allowed', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.refunder_email, c.password);
    await page.goto('/register/staff/races');
    await expect(page.getByRole('heading', { name: 'Not allowed' })).toBeVisible();
  });

  test('an operator sees both races listed, and the one with no fee flagged', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.operator_email, c.password);
    await page.goto('/register/staff/races');
    await expect(staffNav(page).getByRole('link', { name: 'Races' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Races', exact: true })).toBeVisible();

    await expect(row(page, c.busy_name)).toBeVisible();
    await expect(row(page, c.busy_name)).toContainText('1 of 50 registered');
    await expect(row(page, c.busy_name)).not.toContainText('No fee set up');
    await expect(row(page, c.empty_name)).toBeVisible();
    await expect(row(page, c.empty_name)).toContainText('No fee set up');
  });

  test('an operator creates a race: midnight close, order error, JSON error, filter question', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.operator_email, c.password);
    await page.goto('/register/staff/races');
    await page.getByRole('link', { name: 'New race' }).click();
    await expect(page.getByRole('heading', { name: 'New race' })).toBeVisible();
    await expect(page.getByLabel('Time zone')).toHaveValue('America/Chicago');

    await page.getByLabel('Name', { exact: true }).fill(c.new_name);
    await page.getByLabel('Max teams').fill('20');

    // A deadline at local midnight is shown to racers as 11:59 PM the day before.
    await page.getByLabel('Registration opens').fill(OPEN);
    await page.getByLabel('Registration closes').fill(CLOSE_AT_MIDNIGHT);
    await expect(
      page.getByText('Racers see: closes Thu, Feb 14, 2030, 11:59 PM CST'),
    ).toBeVisible();
    await expect(page.getByText('Midnight Feb 15 = racers see "Thu, Feb 14, 2030".')).toBeVisible();

    // Final edits after race day is refused, and the message names the later date.
    await page.getByLabel('Race day').fill(RACE_DAY);
    await page.getByLabel('Final edits close').fill('2030-03-03T00:00');
    await page.getByLabel('Final edits close').blur();
    await expect(page.getByText(/Must be before Race day \(Sat, Mar 2, 10:00 AM\)/)).toBeVisible();
    await page.getByLabel('Final edits close').fill(FINAL_EDITS);
    await expect(page.getByText(/Must be before Race day/)).toHaveCount(0);

    // Broken JSON shows where it broke; fixing it brings the filter choices.
    const questions = page.getByLabel('Questions JSON');
    await questions.fill('{"schema": {"type": "object",}');
    await expect(page.getByText(/Line \d+, column \d+/)).toBeVisible();
    await questions.fill(
      JSON.stringify({
        schema: { type: 'object', properties: { q1: { type: 'string', title: 'Favorite color' } } },
        form: [{ key: 'q1' }],
      }),
    );
    await expect(page.getByText(/Line \d+, column \d+/)).toHaveCount(0);
    const filters = page.getByRole('group', { name: "Show on Who's registered" });
    await filters.getByRole('checkbox', { name: 'Favorite color' }).check();

    await page.getByRole('button', { name: 'Create race' }).click();
    await expect(page).toHaveURL(/\/register\/staff\/races\/\d+$/);
    newRaceUrl = page.url();

    await expect(page.getByRole('heading', { name: c.new_name })).toBeVisible();
    const dates = region(page, 'Dates');
    await expect(dates).toContainText('Mon, Jan 7, 2030');
    await expect(dates).toContainText('Thu, Feb 14, 2030');
    await expect(dates).toContainText('Sun, Feb 24, 2030');
    await expect(dates).toContainText('Sat, Mar 2, 2030');
    await expect(region(page, 'Teams and questions')).toContainText('q1');
  });

  test('an operator moves the race to Eastern time and the wall clock stays', async ({ page }) => {
    const c = seeded.credentials;
    expect(newRaceUrl).not.toBe('');
    await login(page, c.operator_email, c.password);
    await page.goto(newRaceUrl);
    await page.getByRole('link', { name: 'Edit race' }).click();
    await expect(page.getByRole('heading', { name: 'Edit race' })).toBeVisible();
    await expect(page.getByLabel('Registration closes')).toHaveValue(CLOSE_AT_MIDNIGHT);

    // Leaving with changes asks first; Keep editing stays on the form.
    await page.getByLabel('Name', { exact: true }).fill(`${c.new_name} (edited)`);
    await page.getByRole('link', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(`${c.new_name} (edited)`);
    await page.getByLabel('Name', { exact: true }).fill(c.new_name);

    await page.getByLabel('Time zone').selectOption('America/New_York');
    await expect(page.getByRole('note')).toContainText('America/Chicago to America/New_York');
    await page.getByRole('button', { name: 'Save race' }).click();
    await expect(page).toHaveURL(newRaceUrl);
    await expect(page.getByText(/America\/New_York/)).toBeVisible();

    await page.getByRole('link', { name: 'Edit race' }).click();
    await expect(page.getByLabel('Time zone')).toHaveValue('America/New_York');
    await expect(page.getByLabel('Registration opens')).toHaveValue(OPEN);
    await expect(page.getByLabel('Registration closes')).toHaveValue(CLOSE_AT_MIDNIGHT);
    await expect(page.getByLabel('Final edits close')).toHaveValue(FINAL_EDITS);
    await expect(page.getByLabel('Race day')).toHaveValue(RACE_DAY);
    await expect(page.getByText('EST', { exact: true })).toHaveCount(4);
    await expect(page.getByText('CST', { exact: true })).toHaveCount(0);
  });

  test('an operator downloads the All teams export, and cannot delete', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.operator_email, c.password);
    await page.goto(`/register/staff/races/${c.busy_id}`);
    await expect(page.getByRole('heading', { name: c.busy_name })).toBeVisible();
    await expect(region(page, 'Money collected')).toContainText('$50');
    await expect(region(page, 'Teams')).toContainText('1 of 50 finalized');
    await expect(page.getByRole('button', { name: 'Delete race' })).toHaveCount(0);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      region(page, 'Export (CSV)').getByRole('link', { name: 'All teams' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const firstLine = Buffer.concat(chunks).toString('utf-8').split('\n')[0];
    expect(firstLine).toContain('name');
  });

  test('an admin cannot delete a race with teams, and deletes the empty one', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.admin_email, c.password);
    await page.goto(`/register/staff/races/${c.busy_id}`);
    await expect(page.getByRole('heading', { name: c.busy_name })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete race' })).toBeDisabled();
    await expect(page.getByText("This race has teams, so it can't be deleted.")).toBeVisible();

    await page.goto('/register/staff/races');
    await row(page, c.empty_name).getByRole('link', { name: c.empty_name }).click();
    await expect(page.getByRole('heading', { name: c.empty_name })).toBeVisible();
    await page.getByRole('button', { name: 'Delete race' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Delete ${c.empty_name}?`);
    await dialog.getByRole('button', { name: 'Delete race' }).click();

    await expect(page).toHaveURL(/\/register\/staff\/races$/);
    await expect(row(page, c.busy_name)).toBeVisible();
    await expect(row(page, c.empty_name)).toHaveCount(0);
  });

  test('the list, overview and form fit at 320px', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 320, height: 700 });
    await login(page, c.operator_email, c.password);
    const fits = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

    await page.goto('/register/staff/races');
    await expect(page.getByRole('link', { name: c.busy_name })).toBeVisible();
    await fits();

    await page.goto(`/register/staff/races/${c.busy_id}`);
    await expect(page.getByRole('heading', { name: c.busy_name })).toBeVisible();
    await fits();

    await page.goto(`/register/staff/races/${c.busy_id}/edit`);
    await expect(page.getByRole('heading', { name: 'Edit race' })).toBeVisible();
    await expect(page.getByLabel('Registration closes')).toBeVisible();
    await fits();

    await page.goto('/register/staff/races/new');
    await expect(page.getByRole('heading', { name: 'New race' })).toBeVisible();
    await fits();
  });
});
