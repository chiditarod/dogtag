import { test, expect, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: edit the account with the current password, then log in with a changed password. */

interface Credentials {
  user_email: string;
  password: string;
  new_password: string;
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/register/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'My teams' })).toBeVisible();
}

test.describe('SPA account page', () => {
  let seeded: Seed<Credentials>;

  test.beforeEach(() => {
    seeded = seed<Credentials>('account');
  });
  test.afterEach(() => seeded.dispose());

  test('edit details and password with the current password', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.user_email, c.password);

    await test.step('Open the account page from the user menu', async () => {
      await page.getByRole('link', { name: 'Account', exact: true }).click();
      await expect(page).toHaveURL(/\/register\/account$/);
      await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
    });

    await test.step('Change the phone with the current password', async () => {
      await page.getByLabel('Phone').fill('3125550142');
      await page.getByLabel('Current password', { exact: true }).fill(c.password);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('status')).toHaveText('Saved.');
    });

    await test.step('A wrong current password is refused', async () => {
      await page.getByLabel('Phone').fill('3125550199');
      await page.getByLabel('Current password', { exact: true }).fill('not-my-password');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByText('is not correct')).toBeVisible();
      await expect(page.getByRole('status')).not.toHaveText('Saved.');
    });

    await test.step('Change the password', async () => {
      await page.getByLabel('New password', { exact: true }).fill(c.new_password);
      await page.getByLabel('Confirm new password').fill(c.new_password);
      await page.getByLabel('Current password', { exact: true }).fill(c.password);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('status')).toHaveText('Saved.');
    });

    await test.step('The session and CSRF token survive the password change', async () => {
      await page.getByLabel('Phone').fill('3125550142');
      await page.getByLabel('Current password', { exact: true }).fill(c.new_password);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('status')).toHaveText('Saved.');
    });

    await test.step('Log out and log in with the new password', async () => {
      await page.getByRole('button', { name: 'Log out' }).click();
      await login(page, c.user_email, c.new_password);
    });
  });

  test('the account page fits at 320px', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 320, height: 800 });
    await login(page, c.user_email, c.password);
    await page.goto('/register/account');
    await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(320);
  });
});
