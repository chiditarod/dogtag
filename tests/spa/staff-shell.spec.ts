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

  test('a racer sees Not allowed and no staff nav', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.racer_email, c.password);
    await expect(page.getByRole('link', { name: 'Staff', exact: true })).toHaveCount(0);
    await page.goto('/register/staff/payments');
    await expect(page.getByRole('heading', { name: 'Not allowed' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Staff' })).toHaveCount(0);
  });

  test('the staff page does not scroll sideways at 320px', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 320, height: 700 });
    await login(page, c.refunder_email, c.password);
    await page.goto('/register/staff/payments');
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(320);
  });
});
