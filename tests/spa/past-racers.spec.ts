import { test, expect } from '@playwright/test';
import { clearInbox } from '../helpers/mailpit';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: a returning captain fills a roster slot from a past racer chip. */

interface Credentials {
  captain_email: string;
  captain_password: string;
  team_id: number;
  team_name: string;
  past_racers: { first_name: string; last_name: string; email: string; phone: string; zipcode: string }[];
}

let seeded: Seed<Credentials>;

test.describe('SPA roster: past racers', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('past_racers');
  });
  test.afterAll(() => seeded.dispose());
  test.beforeEach(() => clearInbox());

  test('picking a past racer pre-fills the form and Save fills the slot', async ({ page }) => {
    const c = seeded.credentials;
    const [ada] = c.past_racers;

    await test.step('Log in and open the team', async () => {
      await page.goto('/register/login');
      await page.getByLabel('Email', { exact: true }).fill(c.captain_email);
      await page.getByLabel('Password', { exact: true }).fill(c.captain_password);
      await page.getByRole('button', { name: 'Log in' }).click();

      await expect(page.getByRole('heading', { name: 'My teams' })).toBeVisible();
      await page.getByRole('link', { name: `View team: ${c.team_name}` }).click();
      await expect(page).toHaveURL(new RegExp(`/register/teams/${c.team_id}$`));
    });

    const racers = page.getByRole('group', { name: 'Racers' });
    await test.step('See the chips for racers from the 2025 team', async () => {
      const chips = racers.getByRole('group', { name: 'Past racers' }).first();
      await expect(chips.getByRole('button', { name: 'Ada Racer · 2025' })).toBeVisible();
      await expect(chips.getByRole('button', { name: 'Grace Racer · 2025' })).toBeVisible();
      await expect(chips.getByRole('button', { name: 'Edsger Racer · 2025' })).toBeVisible();
    });

    await test.step('Pick a chip: the form is pre-filled', async () => {
      await racers.getByRole('button', { name: 'Ada Racer · 2025' }).first().click();

      const form = page.getByRole('form', { name: 'Add a racer' });
      await expect(form.getByLabel('First name')).toHaveValue(ada.first_name);
      await expect(form.getByLabel('Last name')).toHaveValue(ada.last_name);
      await expect(form.getByLabel('Email', { exact: true })).toHaveValue(ada.email);
      await expect(form.getByLabel('Phone')).toHaveValue('(312) 555-0100');
      await expect(form.getByLabel('ZIP code')).toHaveValue(ada.zipcode);
      await expect(form.getByLabel('Years racing', { exact: true })).not.toHaveValue('');

      await form.getByRole('button', { name: 'Save' }).click();
    });

    await test.step('The slot is filled and the chip is gone', async () => {
      await expect(racers.getByText('Ada Racer', { exact: true })).toBeVisible();
      await expect(racers.getByText(ada.email)).toBeVisible();
      await expect(racers.getByText('1 of 3')).toBeVisible();
      await expect(racers.getByRole('button', { name: 'Ada Racer · 2025' })).toHaveCount(0);
    });
  });
});
