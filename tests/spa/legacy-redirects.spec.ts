import { test, expect, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/**
 * SPA end-to-end: old racer URLs land on the SPA, and the legacy staff pages
 * that are kept (the Users index, with its navbar) point back at it.
 *
 * Seeded credentials (`test_seeds:legacy_redirects`, all @example.com):
 *   captain_email / captain_password  the owner of the team (racers cannot sign in to staff pages)
 *   team_id, team_name, race_id       the owner's team in an open race
 *   reset_token                       a second user's fresh password reset token
 *   admin_email / admin_password      an admin, for the kept legacy Users page
 *   short                             the first 8 characters of the unique id (in the team and race names)
 */

interface Credentials {
  captain_email: string;
  captain_password: string;
  team_id: number;
  team_name: string;
  race_id: number;
  race_name: string;
  reset_token: string;
  admin_email: string;
  admin_password: string;
  short: string;
}

let seeded: Seed<Credentials>;

async function login(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test.describe('Legacy racer URLs', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('legacy_redirects');
  });
  test.afterAll(() => seeded.dispose());
  test.use({ viewport: { width: 320, height: 700 } });

  test('the old home page lands on the race list', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/register\/?$/);
    await expect(page.getByRole('heading', { name: 'Choose your race' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

    await page.goto('/races');
    await expect(page).toHaveURL(/\/register\/?$/);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/register\/login$/);
  });

  test('an old team link asks for a login, then opens the team in the SPA', async ({ page }) => {
    const c = seeded.credentials;
    await page.goto(`/teams/${c.team_id}`);
    await expect(page).toHaveURL(/\/register\/login\?next=/);

    await login(page, c.captain_email, c.captain_password);
    await expect(page).toHaveURL(new RegExp(`/register/teams/${c.team_id}$`));
    await expect(page.getByRole('heading', { name: c.team_name })).toBeVisible();

    // The old nested racer pages end on the team page too.
    await page.goto(`/teams/${c.team_id}/people/new`);
    await expect(page).toHaveURL(new RegExp(`/register/teams/${c.team_id}$`));
    await expect(page.getByRole('heading', { name: c.team_name })).toBeVisible();
  });

  test('an old password reset link opens the SPA reset page', async ({ page }) => {
    const c = seeded.credentials;
    await page.goto(`/password_resets/${c.reset_token}/edit`);
    await expect(page).toHaveURL(new RegExp(`/register/reset-password/${c.reset_token}$`));
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  });

  test('old account and registrations links open their SPA pages when logged in', async ({ page }) => {
    const c = seeded.credentials;
    await page.goto('/register/login');
    await login(page, c.captain_email, c.captain_password);
    await expect(page.getByRole('link', { name: 'My teams' })).toBeVisible();

    await page.goto('/account');
    await expect(page).toHaveURL(/\/register\/account$/);

    await page.goto(`/races/${c.race_id}/registrations`);
    await expect(page).toHaveURL(new RegExp(`/register/races/${c.race_id}/registrations$`));
    await expect(page.getByRole('heading', { name: "Who's registered" })).toBeVisible();
  });
});

test.describe('Kept legacy staff pages', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('legacy_redirects');
  });
  test.afterAll(() => seeded.dispose());
  test.use({ viewport: { width: 1280, height: 800 } });

  /** Signs in through the SPA, then opens the legacy Users page the old Staff links reach. */
  async function openLegacyUsers(page: Page) {
    const c = seeded.credentials;
    await page.goto('/register/login');
    await login(page, c.admin_email, c.admin_password);
    await expect(page.getByRole('link', { name: 'My teams' }).or(page.getByRole('navigation', { name: 'Staff' }))).toBeVisible();
    await page.goto('/users');
    await expect(page).toHaveURL(/\/users$/);
    await expect(page.locator('.navbar')).toBeVisible();
  }

  test('the search on the Users page links the SPA user and team pages', async ({ page }) => {
    const c = seeded.credentials;
    await openLegacyUsers(page);

    // The legacy search form is a plain GET, so the SPA URL carries its field values as a query string.
    await test.step('Picking a user opens the SPA staff user page', async () => {
      await page.locator('.select2-container').first().click();
      await page.locator('.select2-search__field').pressSequentially(c.captain_email);
      await page.getByRole('treeitem', { name: new RegExp(c.captain_email) }).click();
      await expect(page).toHaveURL(/\/register\/staff\/users\/\d+(\?|$)/);
      await expect(page.getByText(c.captain_email).first()).toBeVisible();
    });

    await test.step('Picking a team opens the SPA team page', async () => {
      await page.goto('/users');
      await page.locator('.select2-container').nth(1).click();
      await page.locator('.select2-search__field').pressSequentially(c.short);
      await page.getByRole('treeitem', { name: new RegExp(c.team_name) }).click();
      await expect(page).toHaveURL(new RegExp(`/register/teams/${c.team_id}(\\?|$)`));
      await expect(page.getByRole('heading', { name: c.team_name })).toBeVisible();
    });
  });

  test('the legacy navbar links the SPA and logout lands on the race list', async ({ page }) => {
    await openLegacyUsers(page);

    const navbar = page.locator('.navbar');
    await expect(navbar.getByRole('link', { name: 'Races' }).first()).toHaveAttribute('href', '/register');
    await expect(navbar.locator('a[href="/register/staff/races"]')).toHaveCount(1);

    page.once('dialog', (dialog) => dialog.accept());
    await navbar.locator('a.dropdown-toggle:has(.fa-user)').click();
    await navbar.getByRole('link', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/register\/?$/);
    await expect(page.getByRole('heading', { name: 'Choose your race' })).toBeVisible();
  });
});
