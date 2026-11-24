import { test, expect, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: the staff shell is for staff roles only; racers see "Not allowed". */

interface Credentials {
  racer_email: string;
  refunder_email: string;
  password: string;
}

let seeded: Seed<Credentials>;

async function login(page: Page, email: string, password: string) {
  await page.goto('/register/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('link', { name: 'My teams' })).toBeVisible();
}

test.describe('SPA staff shell', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('staff_shell');
  });
  test.afterAll(() => seeded.dispose());

  test('a refunder reaches Payments from the Staff link', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.refunder_email, c.password);
    await page.getByRole('link', { name: 'Staff', exact: true }).click();
    await expect(page).toHaveURL(/\/register\/staff\/payments$/);
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Staff' })).toBeVisible();
  });

  test('a logged-out visit to Payments logs in and lands back on it', async ({ page }) => {
    const c = seeded.credentials;
    await page.goto('/register/staff/payments');
    await expect(page).toHaveURL(/\/register\/login\?next=/);
    expect(new URL(page.url()).searchParams.get('next')).toBe('/staff/payments');
    await page.getByLabel('Email', { exact: true }).fill(c.refunder_email);
    await page.getByLabel('Password', { exact: true }).fill(c.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/register\/staff\/payments$/);
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Staff' })).toBeVisible();
  });

  test('a racer sees Not allowed and no staff nav', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.racer_email, c.password);
    await expect(page.getByRole('link', { name: 'Staff', exact: true })).toHaveCount(0);
    await page.goto('/register/staff/payments');
    await expect(page.getByRole('heading', { name: 'Not allowed' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Staff' })).toHaveCount(0);
  });

  // The seeded refunder has a 16-character first name, the worst case for the header row.
  async function expectHeaderFits(page: Page) {
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(320);
    const logo = await page.getByAltText('dogtag, CHIditarod registration').boundingBox();
    expect(logo?.width ?? 0).toBeGreaterThanOrEqual(100);
    const items = page.getByRole('navigation', { name: 'Account' }).locator('a, button, span');
    for (const item of await items.all()) {
      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    }
  }

  test('the staff page and a racer page with the Staff link fit at 320px', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 320, height: 700 });
    await login(page, c.refunder_email, c.password);

    await page.goto('/register/staff/payments');
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Staff', exact: true })).toHaveCount(0);
    await expectHeaderFits(page);

    await page.goto('/register');
    await expect(page.getByRole('link', { name: 'Staff', exact: true })).toBeVisible();
    await expectHeaderFits(page);
  });
});
