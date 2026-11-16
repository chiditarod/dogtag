/**
 * Logs in once as the staff user (an operator, never an admin) and saves the
 * session for the race-setup and race-teardown projects. The admin-auth
 * project records no trace, video or screenshot: this page carries a password.
 * race-teardown deletes the saved session.
 */
import { expect, test as setup } from '@playwright/test';
import { target } from './run';
import { loggedInRoles, STAFF_STATE } from './admin-forms';

setup('log in as the operator', async ({ page }) => {
  await page.goto('/user_session/new');
  await page.getByLabel('Email').fill(target.staff.email);
  await page.getByLabel('Password').fill(target.staff.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText(/login successful/i)).toBeVisible();

  // The suite must never run with admin rights.
  const roles = await loggedInRoles(page);
  expect(roles, 'staff login roles').toContain('Operator');
  expect(roles, 'staff login roles').not.toContain('Admin');

  await page.context().storageState({ path: STAFF_STATE });
});
