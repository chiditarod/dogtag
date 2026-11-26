import { test, expect, type Locator, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: Who's registered, as a racer, an operator and a refunder. */

interface Credentials {
  racer_email: string;
  operator_email: string;
  refunder_email: string;
  password: string;
  open_race_id: number;
  open_race_name: string;
  full_race_id: number;
  mine_name: string;
  other_name: string;
  draft_name: string;
  paid_name: string;
  first_wait_name: string;
  second_wait_name: string;
  registered_owner_emails: string[];
  registering_owner_emails: string[];
}

let seeded: Seed<Credentials>;

async function login(page: Page, email: string, password: string) {
  await page.goto('/register/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('link', { name: 'My teams' })).toBeVisible();
}

const registeredTab = (page: Page, n: number) => page.getByRole('tab', { name: `Registered (${n})` });
const registeringTab = (page: Page, n: number) => page.getByRole('tab', { name: `Still registering (${n})` });
const teamRow = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

async function insideViewport(locator: Locator, width: number) {
  const box = await locator.boundingBox();
  expect(box, 'element has a box').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
}

const noSidewaysScroll = async (page: Page, width = 320) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

test.describe("SPA who's registered (racer, deleting)", () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('who_registered');
  });
  test.afterAll(() => seeded.dispose());

  test("a racer opens Who's registered from the race tile, sees only public columns, searches, filters and deletes their own unfinished team", async ({
    page,
  }) => {
    const c = seeded.credentials;
    await login(page, c.racer_email, c.password);

    await page.goto('/register');
    const tile = page.getByRole('listitem').filter({ hasText: c.open_race_name });
    await tile.getByRole('link', { name: "See who's registered" }).click();
    await expect(page).toHaveURL(new RegExp(`/register/races/${c.open_race_id}/registrations`));
    await expect(page.getByRole('heading', { name: "Who's registered" })).toBeVisible();

    // Public columns only: no staff columns and no mail links.
    await expect(registeredTab(page, 2)).toBeVisible();
    await expect(registeringTab(page, 2)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Team', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Racer type' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Payments' })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'New team' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Email/ })).toHaveCount(0);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);

    // Your own team is a link with a pill; someone else's is plain text.
    const mine = teamRow(page, c.mine_name);
    await expect(mine.getByRole('link', { name: c.mine_name })).toBeVisible();
    await expect(mine.getByText('Your team')).toBeVisible();
    const other = teamRow(page, c.other_name);
    await expect(other).toBeVisible();
    await expect(other.getByRole('link')).toHaveCount(0);
    await expect(other.getByText('Your team')).toHaveCount(0);

    // Search and the field select change the tab counts.
    await page.getByRole('searchbox', { name: 'Search team names' }).fill('Other');
    await expect(registeredTab(page, 1)).toBeVisible();
    await expect(registeringTab(page, 0)).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search team names' }).fill('');
    await expect(registeredTab(page, 2)).toBeVisible();

    await page.getByLabel('Racer type').selectOption('Art Cart');
    await expect(registeredTab(page, 1)).toBeVisible();
    await expect(registeringTab(page, 1)).toBeVisible();
    await expect(page).toHaveURL(/f_racer-type=Art(\+|%20)Cart/);
    await page.getByLabel('Racer type').selectOption('');
    await expect(registeredTab(page, 2)).toBeVisible();
    await expect(registeringTab(page, 2)).toBeVisible();

    // Delete the racer's own unfinished team; the paid one has no Delete button.
    await registeringTab(page, 2).click();
    await expect(teamRow(page, c.paid_name)).toBeVisible();
    await expect(page.getByRole('button', { name: `Delete ${c.paid_name}` })).toHaveCount(0);
    await page.getByRole('button', { name: `Delete ${c.draft_name}` }).click();
    const dialog = page.getByRole('dialog', { name: `Delete ${c.draft_name}?` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete team' }).click();
    await expect(dialog).toBeHidden();
    await expect(teamRow(page, c.draft_name)).toHaveCount(0);
    await expect(registeringTab(page, 1)).toBeVisible();
    await expect(teamRow(page, c.paid_name)).toBeVisible();
  });
});

test.describe("SPA who's registered (read-only views)", () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('who_registered');
  });
  test.afterAll(() => seeded.dispose());

  test('a full race shows the Waitlist tab with positions', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.racer_email, c.password);
    await page.goto(`/register/races/${c.full_race_id}/registrations`);

    await expect(registeredTab(page, 1)).toBeVisible();
    await page.getByRole('tab', { name: 'Waitlist (2)' }).click();
    await expect(page.getByRole('tab', { name: /^Still registering/ })).toHaveCount(0);
    const rows = page.getByRole('row').filter({ hasText: 'Test Team Who Wait' });
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(c.first_wait_name);
    await expect(rows.nth(0)).toContainText('#1');
    await expect(rows.nth(1)).toContainText(c.second_wait_name);
    await expect(rows.nth(1)).toContainText('#2');
    await expect(rows.nth(1).getByText('Your team')).toBeVisible();
  });

  test('an operator sees team numbers, payments and bcc links for the current tab', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 1024, height: 800 });
    await login(page, c.operator_email, c.password);
    await page.goto(`/register/races/${c.open_race_id}/registrations`);

    await expect(registeredTab(page, 2)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '#', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Payments' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'New team' })).toBeVisible();
    const numbers = page.getByRole('row').filter({ hasText: 'Test Team Who' });
    await expect(numbers.nth(0)).toContainText(c.mine_name);
    await expect(numbers.nth(0).getByRole('cell').first()).toHaveText(/7$/);
    await expect(numbers.nth(1)).toContainText(c.other_name);
    await expect(numbers.nth(1).getByRole('cell').first()).toHaveText(/12$/);
    // Someone else's team opens on the legacy admin page, not the owner's SPA team page.
    await expect(numbers.nth(1).getByRole('link', { name: c.other_name })).toHaveAttribute(
      'href',
      /^\/teams\/\d+$/,
    );

    const owners = page.getByRole('link', { name: 'Email team owners (bcc)' });
    await expect(page.getByRole('link', { name: 'Email all racers (bcc)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy racer emails' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy owner emails' })).toBeVisible();
    const registeredHref = (await owners.getAttribute('href'))!;
    expect(registeredHref).toMatch(/^mailto:/);
    for (const email of c.registered_owner_emails) expect(registeredHref).toContain(encodeURIComponent(email));
    expect(registeredHref).not.toContain(encodeURIComponent(c.registering_owner_emails[1]));

    await registeringTab(page, 2).click();
    await expect(teamRow(page, c.paid_name)).toBeVisible();
    await expect(teamRow(page, c.paid_name)).toContainText('1 of 1 paid');
    await expect(teamRow(page, c.paid_name)).toContainText('New team');
    const registeringHref = (await owners.getAttribute('href'))!;
    for (const email of c.registering_owner_emails) expect(registeringHref).toContain(encodeURIComponent(email));
    expect(registeringHref).not.toContain(encodeURIComponent(c.registered_owner_emails[1]));
  });

  test('at 320px the operator mail links and copy buttons wrap inside the page', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 320, height: 700 });
    await login(page, c.operator_email, c.password);
    await page.goto(`/register/races/${c.open_race_id}/registrations`);

    await expect(registeredTab(page, 2)).toBeVisible();
    for (const name of ['Copy racer emails', 'Copy owner emails']) {
      await insideViewport(page.getByRole('button', { name }), 320);
    }
    for (const name of ['Email all racers (bcc)', 'Email team owners (bcc)']) {
      await insideViewport(page.getByRole('link', { name }), 320);
    }
    await noSidewaysScroll(page);
  });

  test('at 1024px each staff row keeps one cell per column, with Delete in the last column', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 1024, height: 800 });
    await login(page, c.operator_email, c.password);
    await page.goto(`/register/races/${c.open_race_id}/registrations`);
    await registeringTab(page, 2).click();

    // The draft has no New team tag and is deletable; the paid team has the tag and no Delete button.
    const draft = teamRow(page, c.draft_name);
    const paid = teamRow(page, c.paid_name);
    await expect(draft.getByRole('button', { name: `Delete ${c.draft_name}` })).toBeVisible();
    await expect(draft).not.toContainText('New team');
    await expect(paid).toContainText('New team');
    await expect(paid.getByRole('button', { name: /^Delete/ })).toHaveCount(0);

    const headers = await page.getByRole('columnheader').evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        return { x: box.x, right: box.right, width: box.width };
      }),
    );
    expect(headers.length).toBeGreaterThanOrEqual(7);
    expect(headers.every((header) => header.width > 0)).toBe(true);

    for (const row of [draft, paid]) {
      const cells = await row.getByRole('cell').evaluateAll((els) =>
        els.map((el) => {
          const box = el.getBoundingClientRect();
          return { x: box.x, right: box.right, width: box.width };
        }),
      );
      expect(cells).toHaveLength(headers.length);
      cells.forEach((cell, index) => {
        expect(cell.width, `cell ${index} is laid out`).toBeGreaterThan(0);
        expect(Math.abs(cell.x - headers[index].x), `cell ${index} lines up with its header`).toBeLessThanOrEqual(1);
      });
    }

    const last = headers[headers.length - 1];
    const button = await draft.getByRole('button', { name: `Delete ${c.draft_name}` }).boundingBox();
    expect(button!.x).toBeGreaterThanOrEqual(last.x - 1);
    expect(button!.x + button!.width).toBeLessThanOrEqual(last.right + 1);
    await noSidewaysScroll(page, 1024);
  });

  test('a refunder sees staff columns but no email links', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 1024, height: 800 });
    await login(page, c.refunder_email, c.password);
    await page.goto(`/register/races/${c.open_race_id}/registrations`);

    await expect(registeredTab(page, 2)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Payments' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'New team' })).toBeVisible();
    await expect(teamRow(page, c.mine_name).getByRole('cell').first()).toHaveText(/7$/);
    await expect(page.getByRole('link', { name: /^Email/ })).toHaveCount(0);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  });

  test('at 320px rows are cards, Filters (n) opens a sheet, and nothing scrolls sideways', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 320, height: 700 });
    await login(page, c.racer_email, c.password);
    await page.goto(`/register/races/${c.open_race_id}/registrations`);

    await expect(registeredTab(page, 2)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Team', exact: true })).toBeHidden();
    await insideViewport(teamRow(page, c.mine_name), 320);
    await insideViewport(teamRow(page, c.other_name), 320);
    await noSidewaysScroll(page);

    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Filter teams' });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel('Racer type').selectOption('Art Cart');
    await insideViewport(sheet.getByLabel('Racer type'), 320);
    await insideViewport(sheet.getByRole('button', { name: 'Done' }), 320);
    await noSidewaysScroll(page);
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet).toBeHidden();

    await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible();
    await expect(registeredTab(page, 1)).toBeVisible();
    await expect(registeringTab(page, 1)).toBeVisible();
    await insideViewport(page.getByRole('button', { name: 'Filters (1)' }), 320);
    await insideViewport(teamRow(page, c.other_name), 320);
    await noSidewaysScroll(page);

    await registeringTab(page, 1).click();
    await insideViewport(teamRow(page, c.paid_name), 320);
    await noSidewaysScroll(page);
  });
});
