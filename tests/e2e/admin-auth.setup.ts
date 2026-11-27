/**
 * Logs in once as the staff user (an operator, never an admin) and saves the
 * session for the race-setup and race-teardown projects. The credentials go in
 * through fillSecret, so no step title (and so no HTML report) carries them, and
 * the admin-auth project records no trace, video or screenshot. race-teardown
 * deletes the saved session.
 */
import { expect, test as setup } from '@playwright/test';
import { target } from './run';
import { forbidLegacyPages, loggedInRoles, STAFF_STATE } from './admin-forms';
import { fillSecret } from './fill-secret';

setup('log in as the operator', async ({ page }) => {
  forbidLegacyPages(page);
  await page.goto('/register/login');
  await fillSecret(page.getByLabel('Email', { exact: true }), target.staff.email);
  await fillSecret(page.getByLabel('Password', { exact: true }), target.staff.password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  // The user menu (with Log out) appears once the session is set.
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible();

  // The suite must never run with admin rights.
  const roles = await loggedInRoles(page);
  expect(roles, 'staff login roles').toContain('operator');
  expect(roles, 'staff login roles').not.toContain('admin');

  await page.context().storageState({ path: STAFF_STATE });
});
