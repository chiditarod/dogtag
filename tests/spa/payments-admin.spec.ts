import { test, expect, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: the staff Payments page in Browse mode (read-only lookup with filters). */

interface Credentials {
  refunder_email: string;
  password: string;
  race_id: number;
  race_name: string;
  owner_emails: string[];
}

let seeded: Seed<Credentials>;

async function login(page: Page, email: string, password: string) {
  await page.goto('/register/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('link', { name: 'My teams' })).toBeVisible();
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

    await page.getByRole('radio', { name: 'Paid' }).check({ force: true });
    await expect(page.getByRole('row').filter({ hasText: 'Test Team Payments' })).toHaveCount(6);
    await page.getByRole('radio', { name: 'Refunded' }).check({ force: true });
    await expect(page.getByRole('row').filter({ hasText: 'Test Team Payments' })).toHaveCount(1);
    await expect(page.getByText(/^Refunded [A-Z][a-z]{2} \d+$/)).toBeVisible();
    await page.getByRole('radio', { name: 'All', exact: true }).check({ force: true });

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
    await dialog.getByRole('radio', { name: 'Refunded' }).check({ force: true });
    await expect(dialog.getByRole('button', { name: 'Show 1 payment' })).toBeVisible();
    const button = await dialog.getByRole('button', { name: /^Show/ }).boundingBox();
    expect(button!.x + button!.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await dialog.getByRole('button', { name: /^Show/ }).click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
});
