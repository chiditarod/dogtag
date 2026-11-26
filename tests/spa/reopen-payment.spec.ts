import { test, expect, type Locator, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/**
 * SPA end-to-end: staff reopen a refunded payment so the team can pay again. Operators choose at refund time
 * ("Refund and reopen payment" or "Refund only") or later on a refunded row; refunders may only refund.
 */

interface Credentials {
  operator_email: string;
  refunder_email: string;
  password: string;
  race_id: number;
  race_name: string;
  short: string;
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

async function loginAs(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await login(page, email, password);
}

const teamName = (c: Credentials, n: number) => `Test Team Reopen ${n} ${c.short}`;
const paymentRow = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

async function insideViewport(locator: Locator, width: number) {
  const box = await locator.boundingBox();
  expect(box, 'element has a box').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
}

const noSidewaysScroll = async (page: Page, width = 320) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

/** Refund mode: tick one team, review, type the phrase and choose how the refund ends. Returns the results dialog. */
async function refundOne(page: Page, name: string, choice: 'Refund only' | 'Refund and reopen payment') {
  await page.getByRole('button', { name: 'Refund payments' }).click();
  await page.getByRole('checkbox', { name: `Select ${name}` }).check();
  await page.getByRole('button', { name: 'Review and refund 1…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Refund 1 payment?' });
  const confirm = dialog.getByRole('button', { name: /^Refund( and reopen)? 1 payment$/ });
  await dialog.getByLabel('Type REFUND 1 to confirm').fill('REFUND 1');
  // The typed phrase alone is not enough: nothing is preselected.
  await expect(dialog.getByRole('radio', { name: /^Refund only/ })).not.toBeChecked();
  await expect(dialog.getByRole('radio', { name: /^Refund and reopen payment/ })).not.toBeChecked();
  await expect(confirm).toBeDisabled();
  await dialog.getByText(choice, { exact: true }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  return page.getByRole('dialog', { name: 'Refunds finished' });
}

test.describe.configure({ mode: 'serial' });

test.describe('SPA staff: reopen a refunded payment', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('reopen_payment');
  });
  test.afterAll(() => seeded.dispose());

  test('Refund and reopen payment: the racer can pay again', async ({ page }) => {
    const c = seeded.credentials;
    const name = teamName(c, 1);
    await login(page, c.operator_email, c.password);
    await page.goto(`/register/staff/payments?race_id=${c.race_id}`);

    const results = await refundOne(page, name, 'Refund and reopen payment');
    await expect(results.locator('li[data-status="refunded"]')).toHaveCount(1);
    await expect(results.getByText('Refunded · Reopened')).toBeVisible();
    await results.getByRole('button', { name: 'Done' }).click();

    // Browse: the row is refunded and reopened, with who and when, and has no Reopen action of its own.
    await page.getByRole('group', { name: 'Status' }).getByText('All', { exact: true }).click();
    const row = paymentRow(page, name);
    await expect(row.getByText('Reopened', { exact: true })).toBeVisible();
    await expect(row).toContainText('by Opal Operator');
    await expect(row.getByRole('button', { name: /Reopen payment/ })).toHaveCount(0);

    // The racer sees Pay again and can pay.
    await loginAs(page, c.owner_emails[0], c.password);
    await page.goto(`/register/teams/${c.team_ids[0]}`);
    const fee = page.getByRole('group', { name: 'Registration fee' });
    await expect(fee.getByRole('button', { name: 'Mock pay' })).toBeVisible();
    await expect(fee.getByText('Cart Deposit: refunded')).toHaveCount(0);
    await fee.getByRole('button', { name: 'Mock pay' }).click();
    await expect(fee.getByRole('button', { name: 'Mock pay' })).toHaveCount(0);
    await expect(fee.getByText(/Paid \$50/)).toBeVisible();
  });

  test('Refund only keeps the fee refunded, and Reopen payment on the row reopens it later', async ({ page }) => {
    const c = seeded.credentials;
    const name = teamName(c, 2);
    await login(page, c.operator_email, c.password);
    await page.goto(`/register/staff/payments?race_id=${c.race_id}`);

    const results = await refundOne(page, name, 'Refund only');
    await expect(results.getByText('Refunded', { exact: true })).toBeVisible();
    await expect(results.getByText('Refunded · Reopened')).toHaveCount(0);
    await results.getByRole('button', { name: 'Done' }).click();

    // The racer still sees the fee as refunded, with no Pay button.
    await loginAs(page, c.owner_emails[1], c.password);
    await page.goto(`/register/teams/${c.team_ids[1]}`);
    const fee = page.getByRole('group', { name: 'Registration fee' });
    await expect(fee.getByText('Cart Deposit: refunded')).toBeVisible();
    await expect(fee.getByRole('button', { name: 'Mock pay' })).toHaveCount(0);

    // Later, the operator reopens it from the row.
    await loginAs(page, c.operator_email, c.password);
    await page.goto(`/register/staff/payments?race_id=${c.race_id}&status=refunded`);
    const row = paymentRow(page, name);
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: `Reopen payment for ${name}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Reopen this payment?' });
    await expect(dialog).toContainText('goes back to unfinalized');
    await dialog.getByRole('button', { name: 'Reopen payment' }).click();
    await expect(dialog).toBeHidden();
    await expect(row.getByText('Reopened', { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: /Reopen payment/ })).toHaveCount(0);

    await loginAs(page, c.owner_emails[1], c.password);
    await page.goto(`/register/teams/${c.team_ids[1]}`);
    await expect(fee.getByRole('button', { name: 'Mock pay' })).toBeVisible();
  });

  test('a refunder sees refunded payments but no Reopen payment action', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.refunder_email, c.password);
    await page.goto(`/register/staff/payments?race_id=${c.race_id}`);
    const row = paymentRow(page, teamName(c, 3));
    await expect(row).toContainText('Refunded');
    await expect(page.getByRole('button', { name: /Reopen payment/ })).toHaveCount(0);
  });

  test('at 320px the refund choice and the reopen dialog stay inside the viewport', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 320, height: 700 });
    await login(page, c.operator_email, c.password);
    await page.goto(`/register/staff/payments?race_id=${c.race_id}`);

    // The pre-refunded team: open the reopen dialog, check it fits, and leave it alone.
    const pre = paymentRow(page, teamName(c, 3));
    await insideViewport(pre.getByRole('button', { name: /^Reopen payment for/ }), 320);
    await pre.getByRole('button', { name: /^Reopen payment for/ }).click();
    const reopenDialog = page.getByRole('dialog', { name: 'Reopen this payment?' });
    await insideViewport(reopenDialog.getByRole('button', { name: 'Reopen payment' }), 320);
    await insideViewport(reopenDialog.getByRole('button', { name: 'Cancel' }), 320);
    await noSidewaysScroll(page);
    await reopenDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(reopenDialog).toBeHidden();

    // The refund dialog: both radios and the warning fit.
    await page.getByRole('button', { name: 'Refund payments' }).click();
    await page.getByRole('checkbox', { name: `Select ${teamName(c, 4)}` }).check();
    await page.getByRole('button', { name: 'Review and refund 1…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Refund 1 payment?' });
    await dialog.getByText('Refund and reopen payment', { exact: true }).click();
    await expect(dialog.getByText(/goes back to unfinalized/)).toBeVisible();
    for (const radio of ['Refund only', 'Refund and reopen payment']) {
      await insideViewport(dialog.getByRole('radio', { name: new RegExp(`^${radio}`) }), 320);
    }
    await insideViewport(dialog.getByText(/goes back to unfinalized/), 320);
    await insideViewport(dialog.getByRole('button', { name: /^Refund( and reopen)? 1 payment$/ }), 320);
    await insideViewport(dialog.getByRole('button', { name: 'Cancel' }), 320);
    await noSidewaysScroll(page);

    await dialog.getByLabel('Type REFUND 1 to confirm').fill('REFUND 1');
    await dialog.getByRole('button', { name: 'Refund and reopen 1 payment' }).click();
    const results = page.getByRole('dialog', { name: 'Refunds finished' });
    await expect(results.getByText('Refunded · Reopened')).toBeVisible();
    await insideViewport(results.getByText('Refunded · Reopened'), 320);
    await noSidewaysScroll(page);
    await results.getByRole('button', { name: 'Done' }).click();
  });
});
