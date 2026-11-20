import { test, expect } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: the account holder is not a racer, so they choose which racer is the team captain. */

interface Credentials {
  captain_email: string;
  captain_password: string;
  team_id: number;
  team_name: string;
  racers: { id: number; name: string }[];
}

let seeded: Seed<Credentials>;

test.describe('SPA racers: team captain', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('team_captain');
  });
  test.afterAll(() => seeded.dispose());

  test('choosing and moving the captain survives a reload', async ({ page }) => {
    const c = seeded.credentials;
    const [ada, bo] = c.racers;
    const racers = page.getByRole('group', { name: 'Racers' });
    const star = page.getByTestId('captain-star');

    await test.step('Log in and open the team', async () => {
      await page.goto('/register/login');
      await page.getByLabel('Email', { exact: true }).fill(c.captain_email);
      await page.getByLabel('Password', { exact: true }).fill(c.captain_password);
      await page.getByRole('button', { name: 'Log in' }).click();
      await page.getByRole('link', { name: `View team: ${c.team_name}` }).click();
      await expect(page).toHaveURL(new RegExp(`/register/teams/${c.team_id}$`));
    });

    await test.step('With no captain, the hint shows and every racer offers Make captain', async () => {
      await expect(racers.getByText(ada.name, { exact: true })).toBeVisible();
      await expect(page.getByTestId('choose-captain')).toHaveText('Choose one racer as your team captain.');
      await expect(star).toHaveCount(0);
      await expect(racers.getByRole('button', { name: `Make ${ada.name} captain` })).toBeVisible();
      await expect(racers.getByRole('button', { name: `Make ${bo.name} captain` })).toBeVisible();
    });

    await test.step('One tap makes Ada captain: star and highlight, hint gone', async () => {
      await racers.getByRole('button', { name: `Make ${ada.name} captain` }).click();
      await expect(star).toHaveCount(1);
      await expect(page.locator('[data-captain="true"]')).toContainText(ada.name);
      await expect(page.getByTestId('choose-captain')).toHaveCount(0);
      await expect(racers.getByRole('button', { name: `Make ${ada.name} captain` })).toHaveCount(0);
    });

    await test.step('One tap moves the star to Bo, with no confirmation dialog', async () => {
      await racers.getByRole('button', { name: `Make ${bo.name} captain` }).click();
      await expect(star).toHaveCount(1);
      await expect(page.locator('[data-captain="true"]')).toContainText(bo.name);
      await expect(racers.getByRole('button', { name: `Make ${ada.name} captain` })).toBeVisible();
    });

    await test.step('The choice is saved: Bo is still captain after a reload', async () => {
      await page.reload();
      await expect(racers.getByText(bo.name, { exact: true })).toBeVisible();
      await expect(star).toHaveCount(1);
      await expect(page.locator('[data-captain="true"]')).toContainText(bo.name);
      await expect(page.getByTestId('choose-captain')).toHaveCount(0);
    });
  });
});
