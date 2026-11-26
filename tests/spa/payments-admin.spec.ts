import { test, expect, type Locator, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';
import { countEmails, waitForEmail } from '../helpers/mailpit';

/** SPA end-to-end: the staff Payments page in Browse mode (read-only lookup with filters) and Refund mode. */

interface Credentials {
  refunder_email: string;
  password: string;
  race_id: number;
  race_name: string;
  owner_emails: string[];
  team_ids: number[];
}

let seeded: Seed<Credentials>;

async function login(page: Page, email: string, password: string) {
  await page.goto('/register/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('link', { name: 'My teams' })).toBeVisible();
}

/**
 * The status radios are sr-only and controlled by the URL, so `check({ force: true })` can land before React
 * re-renders and fail with "did not change its state". Click the visible label, as a person would.
 */
async function chooseStatus(page: Page, label: 'All' | 'Paid' | 'Refunded') {
  const group = page.getByRole('group', { name: 'Status' });
  await group.getByText(label, { exact: true }).click();
  await expect(group.getByRole('radio', { name: label, exact: true })).toBeChecked();
}

test.describe('SPA staff payments (Browse)', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('payments_admin');
  });
  test.afterAll(() => seeded.dispose());

  test('filters, progress, search and a shareable URL', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.refunder_email, c.password);
    await page.getByRole('link', { name: 'Staff', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();

    await page.getByLabel('Race').selectOption(String(c.race_id));
    await page.getByLabel('Payment type').selectOption({ label: 'Cart Deposit' });
    await expect(page.getByText('1 of 7 refunded · $50 of $350')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Test Team Payments' })).toHaveCount(7);

    await chooseStatus(page, 'Paid');
    await expect(page.getByRole('row').filter({ hasText: 'Test Team Payments' })).toHaveCount(6);
    await chooseStatus(page, 'Refunded');
    await expect(page.getByRole('row').filter({ hasText: 'Test Team Payments' })).toHaveCount(1);
    await expect(page.getByText(/^Refunded [A-Z][a-z]{2} \d+$/)).toBeVisible();
    await chooseStatus(page, 'All');

    await page.getByRole('searchbox').fill(c.owner_emails[2]);
    const rows = page.getByRole('row').filter({ hasText: 'Test Team Payments' });
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(c.owner_emails[2]);

    // Browse is read-only.
    await expect(page.getByRole('checkbox')).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('searchbox')).toHaveValue(c.owner_emails[2]);
    await expect(page.getByLabel('Race')).toHaveValue(String(c.race_id));
    await expect(rows).toHaveCount(1);
  });

  test('at 320px rows are cards and the Filters sheet opens without sideways scroll', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 320, height: 700 });
    await login(page, c.refunder_email, c.password);
    await page.goto(`/register/staff/payments?race_id=${c.race_id}`);
    await expect(page.getByText('Test Team Payments 1').first()).toBeVisible();
    // Cards: the column headers are hidden and each row is a block narrower than the viewport.
    await expect(page.getByRole('columnheader', { name: 'Team' })).toBeHidden();
    const box = await page.getByRole('row').filter({ hasText: 'Test Team Payments 1' }).first().boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);

    await page.getByRole('button', { name: 'Filters' }).click();
    const dialog = page.getByRole('dialog', { name: 'Filter payments' });
    await expect(dialog).toBeVisible();
    await dialog.getByText('Refunded', { exact: true }).click();
    await expect(dialog.getByRole('radio', { name: 'Refunded' })).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Show 1 payment' })).toBeVisible();
    const button = await dialog.getByRole('button', { name: /^Show/ }).boundingBox();
    expect(button!.x + button!.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await dialog.getByRole('button', { name: /^Show/ }).click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });

  for (const width of [640, 768, 1024]) {
    test(`at ${width}px the inline filters fit and the search box stays usable`, async ({ page }) => {
      const c = seeded.credentials;
      await page.setViewportSize({ width, height: 800 });
      await login(page, c.refunder_email, c.password);
      await page.goto(`/register/staff/payments?race_id=${c.race_id}`);
      await expect(page.getByText('Test Team Payments 1').first()).toBeVisible();
      await expect(page.getByLabel('Race')).toBeVisible();
      await expect(page.getByRole('group', { name: 'Status' })).toBeVisible();
      const search = await page.getByRole('searchbox').boundingBox();
      expect(search!.width).toBeGreaterThanOrEqual(150);
      expect(search!.x + search!.width).toBeLessThanOrEqual(width);
      const status = await page.getByRole('group', { name: 'Status' }).boundingBox();
      expect(status!.x + status!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});

async function insideViewport(locator: Locator, width: number) {
  const box = await locator.boundingBox();
  expect(box, 'element has a box').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
}

const noSidewaysScroll = async (page: Page, width = 320) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

/** Index (1-based) of the seeded team, from "Test Team Payments 3 abcd1234". */
const teamNumber = (name: string) => Number(/Test Team \w+ (\d+) /.exec(name)![1]);

const refundSubject = 'Refund for';

test.describe('SPA staff payments (Refund mode, batch of 5)', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('payments_admin');
  });
  test.afterAll(() => seeded.dispose());

  test('selects 5, confirms by typing, refunds, emails once and shows Refunded to the racer', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.refunder_email, c.password);
    await page.goto(`/register/staff/payments?race_id=${c.race_id}`);
    await page.getByLabel('Payment type').selectOption({ label: 'Cart Deposit' });
    await expect(page.getByText('1 of 7 refunded · $50 of $350')).toBeVisible();

    await page.getByRole('button', { name: 'Refund payments' }).click();
    await expect(page.getByRole('heading', { name: 'Payments · Refund mode' })).toBeVisible();
    await expect(page.getByText('Tick up to 5 paid payments. Refunds cannot be undone.')).toBeVisible();
    // Status is locked to Paid: the refunded row is not listed.
    await expect(page.getByRole('radio', { name: 'Paid' })).toBeDisabled();
    await expect(page.getByRole('row').filter({ hasText: 'Test Team Payments' })).toHaveCount(6);

    await page.getByRole('button', { name: 'Select next 5' }).click();
    await expect(page.getByText('5 of 5 selected · $250')).toBeVisible();
    // At the cap the last paid row is disabled.
    const disabledBoxes = page.getByRole('checkbox').and(page.locator(':disabled'));
    await expect(disabledBoxes).toHaveCount(1);

    await page.getByRole('button', { name: 'Review and refund 5…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Refund 5 payments?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('This cannot be undone. The money goes back to each card.')).toBeVisible();
    await expect(dialog.getByText('Total: $250')).toBeVisible();
    const listed = await dialog.getByRole('list', { name: 'Payments to refund' }).getByRole('listitem').allInnerTexts();
    expect(listed).toHaveLength(5);
    const refundedTeams = listed.map((text) => /Test Team Payments \d+ \w+/.exec(text)![0]);

    const confirm = dialog.getByRole('button', { name: 'Refund 5 payments' });
    const typed = dialog.getByLabel('Type REFUND 5 to confirm');
    await expect(confirm).toBeDisabled();
    await typed.fill('REFUND 4');
    await expect(confirm).toBeDisabled();
    await typed.fill('REFUND 5');
    // Nothing is preselected: the typed phrase is not enough until staff choose what happens to the teams.
    await expect(confirm).toBeDisabled();
    await dialog.getByText('Refund only', { exact: true }).click();
    await confirm.click();

    const results = page.getByRole('dialog', { name: 'Refunds finished' });
    await expect(results).toBeVisible();
    await expect(results.getByRole('listitem').filter({ hasText: /^.*Refunded$/m })).toHaveCount(5);
    await results.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();

    await expect(page.getByText('6 of 7 refunded · $300 of $350')).toBeVisible();
    await page.getByRole('radio', { name: 'Paid' }).check({ force: true });
    await expect(page.getByRole('row').filter({ hasText: 'Test Team Payments' })).toHaveCount(1);

    const owner = c.owner_emails[teamNumber(refundedTeams[0]) - 1];
    const email = await waitForEmail({ to: owner, subjectIncludes: refundSubject });
    expect(email.text).toContain(refundedTeams[0]);
    await page.reload();
    expect(await countEmails({ to: owner, subjectIncludes: refundSubject })).toBe(1);
    for (const team of refundedTeams) {
      const to = c.owner_emails[teamNumber(team) - 1];
      expect(await countEmails({ to, subjectIncludes: refundSubject })).toBe(1);
    }

    // The racer sees Refunded on the fee card.
    await page.context().clearCookies();
    await login(page, owner, c.password);
    await page.goto(`/register/teams/${c.team_ids[teamNumber(refundedTeams[0]) - 1]}`);
    await expect(page.getByText('Refunded', { exact: true })).toBeVisible();
  });
});

test.describe('SPA staff payments (Refund mode, single refund at 320px)', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('payments_admin');
  });
  test.afterAll(() => seeded.dispose());

  test('refunds one payment with the singular wording', async ({ page }) => {
    const c = seeded.credentials;
    const short = c.race_name.split(' ').at(-1);
    const team = `Test Team Payments 3 ${short}`;
    const owner = c.owner_emails[2];
    await page.setViewportSize({ width: 320, height: 700 });
    await login(page, c.refunder_email, c.password);
    await page.goto(`/register/staff/payments?race_id=${c.race_id}`);

    await page.getByRole('button', { name: 'Refund payments' }).click();
    await page.getByRole('checkbox', { name: `Select ${team}` }).check();
    await expect(page.getByText('1 of 5 selected · $50')).toBeVisible();
    const review = page.getByRole('button', { name: 'Review and refund 1…' });
    await insideViewport(review, 320);
    await insideViewport(page.getByText('1 of 5 selected · $50'), 320);
    await noSidewaysScroll(page);
    await review.click();

    const dialog = page.getByRole('dialog', { name: 'Refund 1 payment?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(team)).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Refund 1 payment' });
    await insideViewport(confirm, 320);
    await insideViewport(dialog.getByRole('button', { name: 'Cancel' }), 320);
    await insideViewport(dialog.getByLabel('Type REFUND 1 to confirm'), 320);
    await noSidewaysScroll(page);
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel('Type REFUND 1 to confirm').fill('refund 1');
    await dialog.getByText('Refund only', { exact: true }).click();
    await confirm.click();

    const results = page.getByRole('dialog', { name: 'Refunds finished' });
    await expect(results.getByText('Refunded', { exact: true })).toHaveCount(1);
    await insideViewport(results.getByRole('button', { name: 'Done' }), 320);
    await results.getByRole('button', { name: 'Done' }).click();

    await waitForEmail({ to: owner, subjectIncludes: refundSubject });
    expect(await countEmails({ to: owner, subjectIncludes: refundSubject })).toBe(1);

    // Legacy team page, as the refunder: the payment shows as refunded.
    await page.goto(`/teams/${c.team_ids[2]}`);
    await page.locator('a[href="#requirements"]').first().click();
    await expect(page.locator('#requirements .label', { hasText: /refunded/i })).toBeVisible();

    await page.context().clearCookies();
    await login(page, owner, c.password);
    await page.goto(`/register/teams/${c.team_ids[2]}`);
    await expect(page.getByText('Refunded', { exact: true })).toBeVisible();
    await noSidewaysScroll(page);
  });
});

test.describe('SPA staff payments (Refund mode, partial failure at 320px)', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('payments_partial_failure');
  });
  test.afterAll(() => seeded.dispose());

  test('one of three fails, Retry 1 failed finishes it, each team is emailed once', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 320, height: 700 });
    await login(page, c.refunder_email, c.password);
    await page.goto(`/register/staff/payments?race_id=${c.race_id}`);
    await page.getByRole('button', { name: 'Refund payments' }).click();
    await page.getByRole('button', { name: 'Select next 3' }).click();
    await expect(page.getByText('3 of 5 selected · $150')).toBeVisible();
    await page.getByRole('button', { name: 'Review and refund 3…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Refund 3 payments?' });
    await dialog.getByLabel('Type REFUND 3 to confirm').fill('REFUND 3');
    await dialog.getByText('Refund only', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Refund 3 payments' }).click();

    const results = page.getByRole('dialog', { name: 'Refunds finished' });
    await expect(results).toBeVisible();
    await expect(results.locator('li[data-status="refunded"]')).toHaveCount(2);
    const failed = results.locator('li[data-status="failed"]');
    await expect(failed).toHaveCount(1);
    await expect(failed).toContainText('Failed: Stripe could not refund this payment');
    const retry = results.getByRole('button', { name: 'Retry 1 failed' });
    await expect(retry).toBeVisible();
    await insideViewport(failed, 320);
    await insideViewport(retry, 320);
    await insideViewport(results.getByRole('button', { name: 'Done' }), 320);
    await noSidewaysScroll(page);

    // Behind the dialog: the progress line counts only the 2, and the Paid view still lists the failed one.
    await expect(page.getByText('2 of 3 refunded · $100 of $150')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Test Team Failures' })).toHaveCount(1);
    // Emails so far: the two refunded teams, once each; nothing for the failed one.
    await waitForEmail({ to: c.owner_emails[0], subjectIncludes: refundSubject });
    await waitForEmail({ to: c.owner_emails[2], subjectIncludes: refundSubject });
    expect(await countEmails({ to: c.owner_emails[1], subjectIncludes: refundSubject })).toBe(0);

    // Reload mid-results: the batch id is in the URL, so the results (and Retry) come back.
    await page.reload();
    await expect(page).toHaveURL(/batch=\d+/);
    await expect(results).toBeVisible();
    await expect(results.locator('li[data-status="refunded"]')).toHaveCount(2);
    await expect(results.locator('li[data-status="failed"]')).toHaveCount(1);
    await expect(retry).toBeVisible();
    await insideViewport(retry, 320);
    await noSidewaysScroll(page);

    await retry.click();
    await expect(results.locator('li[data-status="refunded"]')).toHaveCount(3);
    await expect(results.locator('li[data-status="failed"]')).toHaveCount(0);
    await expect(results.getByRole('button', { name: /^Retry/ })).toHaveCount(0);
    await noSidewaysScroll(page);
    await results.getByRole('button', { name: 'Done' }).click();

    await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/batch=/);
    await expect(page.getByText('3 of 3 refunded · $150 of $150')).toBeVisible();

    await waitForEmail({ to: c.owner_emails[1], subjectIncludes: refundSubject });
    for (const to of c.owner_emails) {
      expect(await countEmails({ to, subjectIncludes: refundSubject })).toBe(1);
    }
  });
});
