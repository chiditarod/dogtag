import { test, expect } from '@playwright/test';
import { clearInbox, waitForEmail } from '../helpers/mailpit';
import { seed, type Seed } from '../helpers/seed';

/**
 * SPA end-to-end: request a reset from the SPA, follow the emailed link to the
 * server-rendered reset page, then log in through the SPA with the new password.
 */

interface Credentials {
  user_email: string;
  old_password: string;
  new_password: string;
}

let seeded: Seed<Credentials>;

test.describe('SPA password reset', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('password_reset');
  });
  test.afterAll(() => seeded.dispose());
  test.beforeEach(() => clearInbox());

  test('reset link from email lets the user log in with a new password', async ({ page, context }) => {
    const c = seeded.credentials;

    await test.step('Request a reset in the SPA', async () => {
      await page.goto('/register/forgot-password');
      await page.getByLabel('Email', { exact: true }).fill(c.user_email);
      await page.getByRole('button', { name: 'Send reset link' }).click();
      await expect(page.getByRole('status')).toContainText("we've sent a reset link");
    });

    await test.step('Follow the emailed link and set a new password (legacy page)', async () => {
      const email = await waitForEmail({ to: c.user_email, subjectIncludes: 'Password Reset' });
      const link = email.links.find((url) => /\/password_resets\/[^/]+\/edit/.test(url));
      expect(link).toBeTruthy();
      expect(link).toContain('localhost:3099');

      await page.goto(link!);
      await expect(page.getByRole('heading', { name: /update.*password/i })).toBeVisible();
      await page.locator('input#password, input[name="password"]').first().fill(c.new_password);
      await page.locator('input#password_confirmation, input[name="password_confirmation"]').fill(c.new_password);
      await page.getByRole('button', { name: /update|submit|save|change/i }).click();
      await expect(page.getByText(/password.*updated|password.*changed|success/i)).toBeVisible({ timeout: 10000 });
    });

    await test.step('Log in through the SPA with the new password', async () => {
      // The reset signs the user in; start from a clean session to prove the credentials work.
      await context.clearCookies();
      await page.goto('/register/login');
      await page.getByLabel('Email', { exact: true }).fill(c.user_email);
      await page.getByLabel('Password', { exact: true }).fill(c.new_password);
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page.getByRole('heading', { name: 'My teams' })).toBeVisible();
    });
  });
});
