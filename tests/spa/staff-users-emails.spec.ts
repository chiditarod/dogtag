import { test, expect, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/**
 * SPA end-to-end: the staff Users and Emails sent pages and who may use them.
 *
 * Seeded credentials (`test_seeds:staff_users_emails`, all @example.com, one shared password):
 *   refunder_email  a refunder: Users and Payments only, details read-only
 *   operator_email  an operator: also Emails, still read-only on users
 *   admin_email     an admin: edits details and roles, deletes users
 *   ada_email       Ada, a racer who owns the team Doge Sled and has one payment, three team emails and an
 *                   email-changed notice to her old address (not logged in as); a lookalike `no<ada_email>` got one email
 *   zed_email       Zed, a racer with no team or payment; promoted, logged in as, then deleted
 */

interface Credentials {
  admin_email: string;
  operator_email: string;
  refunder_email: string;
  ada_email: string;
  zed_email: string;
  password: string;
  short: string;
  team_id: number;
  team_name: string;
}

let seeded: Seed<Credentials>;

async function login(page: Page, email: string, password: string) {
  await page.goto('/register/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('link', { name: 'My teams' })).toBeVisible();
}

const staffNav = (page: Page) => page.getByRole('navigation', { name: 'Staff' });
const userRows = (page: Page) => page.locator('[data-user-id]');
const emailRows = (page: Page) => page.locator('[data-email-id]');
const userSearch = (page: Page) => page.getByRole('searchbox', { name: 'Search name, email or team' });

/** Search the Users list for text and open the one matching user. */
async function openUser(page: Page, search: string, name: string) {
  await page.goto('/register/staff/users');
  await userSearch(page).fill(search);
  await expect(userRows(page)).toHaveCount(1);
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test.describe('SPA staff users and emails', () => {
  test.use({ viewport: { width: 1024, height: 800 } });
  // The admin steps build on each other (Zed is promoted, then deleted).
  test.describe.configure({ mode: 'serial' });

  const adaName = () => `Ada${seeded.credentials.short} Racer`;
  const zedName = () => `Zed${seeded.credentials.short} Deletable`;

  test.beforeAll(() => {
    seeded = seed<Credentials>('staff_users_emails');
  });
  test.afterAll(() => seeded.dispose());

  test('a refunder sees Users and Payments, finds Ada, reads her page, and is kept out of Emails', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.refunder_email, c.password);
    await page.goto('/register/staff/users');
    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
    await expect(staffNav(page).getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(staffNav(page).getByRole('link', { name: 'Payments' })).toBeVisible();
    await expect(staffNav(page).getByRole('link', { name: 'Races' })).toHaveCount(0);
    await expect(staffNav(page).getByRole('link', { name: 'Emails' })).toHaveCount(0);

    await userSearch(page).fill(`Ada${c.short} Doge`);
    await expect(userRows(page)).toHaveCount(1);
    await expect(userRows(page).first()).toContainText(adaName());
    await page.getByRole('link', { name: adaName(), exact: true }).click();

    await expect(page.getByRole('heading', { name: adaName(), exact: true })).toBeVisible();
    const details = page.getByRole('region', { name: 'Details' });
    await expect(details).toContainText(c.ada_email);
    await expect(details.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save details' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Roles' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete user' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Emails for this user' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Payments matching this email' })).toBeVisible();

    await page.goto('/register/staff/emails');
    await expect(page.getByRole('heading', { name: 'Not allowed' })).toBeVisible();
  });

  test('an operator follows Ada to her emails, filters them by team and status, and keeps Failed when the chip goes', async ({
    page,
  }) => {
    const c = seeded.credentials;
    await login(page, c.operator_email, c.password);
    await openUser(page, c.ada_email, adaName());
    await expect(page.getByRole('region', { name: 'Roles' })).toHaveCount(0);

    // The account's own emails: the old-address notice is in, the lookalike address is not.
    await page.getByRole('link', { name: 'Emails for this user' }).click();
    await expect(page.getByRole('heading', { name: 'Emails sent' })).toBeVisible();
    await expect(page).toHaveURL(/\/register\/staff\/emails\?user_id=\d+$/);
    await expect(page.getByRole('button', { name: `Remove filter User: ${c.ada_email}` })).toBeVisible();
    await expect(emailRows(page)).toHaveCount(4);
    await expect(emailRows(page).filter({ hasText: 'staff-users-ada-old-' })).toHaveCount(1);
    await expect(emailRows(page).filter({ hasText: `no${c.ada_email}` })).toHaveCount(0);

    await page.goBack();
    await page.getByRole('link', { name: `Emails for ${c.team_name}` }).click();
    await expect(page).toHaveURL(new RegExp(`/register/staff/emails\\?team_id=${c.team_id}`));
    await expect(page.getByRole('button', { name: `Remove filter Team: ${c.team_name}` })).toBeVisible();
    await expect(emailRows(page)).toHaveCount(3);

    await page.getByLabel('Status', { exact: true }).selectOption('failed');
    await expect(emailRows(page)).toHaveCount(1);
    await expect(emailRows(page).first()).toContainText('Net::SMTPAuthenticationError: 535 Incorrect authentication data');

    await page.getByRole('button', { name: `Remove filter Team: ${c.team_name}` }).click();
    await expect(page.getByRole('button', { name: `Remove filter Team: ${c.team_name}` })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove filter Status: Failed' })).toBeVisible();
    await expect(page.getByLabel('Status', { exact: true })).toHaveValue('failed');
    await expect(page).not.toHaveURL(/team_id=/);
  });

  test('an admin edits Ada, cannot delete her, cannot drop their own Admin, promotes Zed and deletes him', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.admin_email, c.password);

    // Ada: change the phone, and the reload shows it.
    await openUser(page, c.ada_email, adaName());
    await page.getByLabel('Phone', { exact: true }).fill('312-555-0147');
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Phone', { exact: true })).toHaveValue('312-555-0147');

    // She owns a team, so Delete is disabled and says why.
    await expect(page.getByRole('button', { name: 'Delete user' })).toBeDisabled();
    await expect(page.getByText('Owns 1 team')).toBeVisible();

    // On their own page the Admin box is locked on.
    await openUser(page, c.admin_email, `Admin Users`);
    const rolesCard = page.getByRole('region', { name: 'Roles' });
    await expect(rolesCard.getByRole('checkbox', { name: 'Admin' })).toBeDisabled();
    await expect(rolesCard.getByRole('checkbox', { name: 'Admin' })).toBeChecked();
    await expect(page.getByText("You can't remove your own Admin role.")).toBeVisible();

    // Zed signed himself up as a plain racer; the admin promotes him afterwards.
    await openUser(page, c.zed_email, zedName());
    await page.getByRole('region', { name: 'Roles' }).getByRole('checkbox', { name: 'Operator' }).check();
    await page.getByRole('button', { name: 'Save roles' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' }).first()).toBeVisible();

    await page.goto('/register/staff/users');
    await userSearch(page).fill(c.zed_email);
    await expect(userRows(page)).toHaveCount(1);
    await expect(userRows(page).first()).toContainText('Operator');

    // Zed logs in with his new role and gets the staff nav.
    await page.context().clearCookies();
    await login(page, c.zed_email, c.password);
    await page.goto('/register/staff/users');
    await expect(staffNav(page).getByRole('link', { name: 'Races' })).toBeVisible();
    await expect(staffNav(page).getByRole('link', { name: 'Emails' })).toBeVisible();

    // The admin deletes him: back on the Users list, not on a missing page, and Zed is gone.
    await page.context().clearCookies();
    await login(page, c.admin_email, c.password);
    await openUser(page, c.zed_email, zedName());
    await page.getByRole('button', { name: 'Delete user' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Delete ${zedName()}?`);
    await dialog.getByRole('button', { name: 'Delete user' }).click();

    await expect(page).toHaveURL(/\/register\/staff\/users$/);
    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found' })).toHaveCount(0);
    await userSearch(page).fill(c.zed_email);
    await expect(page.getByText('No users match this search.')).toBeVisible();
    await expect(userRows(page)).toHaveCount(0);
  });

  test('the users list, a user page and the emails page fit at 320px', async ({ page }) => {
    const c = seeded.credentials;
    await page.setViewportSize({ width: 320, height: 700 });
    await login(page, c.operator_email, c.password);
    const fits = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

    await page.goto('/register/staff/users');
    await userSearch(page).fill(`Ada${c.short}`);
    await expect(userRows(page)).toHaveCount(1);
    await fits();

    await page.getByRole('link', { name: adaName(), exact: true }).click();
    await expect(page.getByRole('heading', { name: adaName(), exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: `Emails for ${c.team_name}` })).toBeVisible();
    await fits();

    await page.goto(`/register/staff/emails?team_id=${c.team_id}`);
    await expect(emailRows(page)).toHaveCount(3);
    await fits();

    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.getByRole('dialog', { name: 'Filter emails' })).toBeVisible();
    await fits();
  });
});
