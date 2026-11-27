import { test, expect } from '@playwright/test';
import { clearInbox, waitForEmail } from '../helpers/mailpit';
import { seed, type Seed } from '../helpers/seed';
import { APP_HOST } from '../helpers/server-env';

/**
 * SPA end-to-end: request a reset from the SPA, follow the emailed link to the
 * SPA reset page, then log in through the SPA with the new password.
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

    let link: string;
    await test.step('Follow the emailed link and set a new password in the SPA', async () => {
      const email = await waitForEmail({ to: c.user_email, subjectIncludes: 'Password Reset' });
      const found = email.links.find((url) => /\/register\/reset-password\/[^/]+$/.test(url));
      expect(found).toBeTruthy();
      expect(found).toContain(APP_HOST);
      link = found!;

      await page.goto(link);
      await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
      await page.getByLabel('New password', { exact: true }).fill(c.new_password);
      await page.getByLabel('Confirm new password').fill(c.new_password);
      await page.getByRole('button', { name: 'Save new password' }).click();
      await expect(page.getByRole('heading', { name: 'My teams' })).toBeVisible();
      await expect(page.getByRole('status')).toContainText("Your password is changed and you're logged in.");
    });

    await test.step('The same link has expired once used', async () => {
      await page.goto(link);
      await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
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
