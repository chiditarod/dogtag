import { test, expect } from '@playwright/test';
import { clearInbox } from '../helpers/mailpit';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: a returning captain picks a past racer, confirms each detail and fills a roster slot. */

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

  test('picking a past racer, confirming the seven details and adding fills the slot', async ({ page }) => {
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
    const dialog = page.getByRole('dialog');

    await test.step('Open the picker: racers from the 2025 team are listed', async () => {
      await expect(racers.getByText('3 spots to fill')).toBeVisible();
      await racers.getByRole('button', { name: 'Pick from past teams (3)' }).click();

      await expect(page.getByRole('dialog', { name: 'Pick from past teams' })).toBeVisible();
      await expect(dialog.getByRole('checkbox', { name: 'Ada Racer' })).toBeVisible();
      await expect(dialog.getByRole('checkbox', { name: 'Grace Racer' })).toBeVisible();
      await expect(dialog.getByRole('checkbox', { name: 'Edsger Racer' })).toBeVisible();
    });

    await test.step('Pick Ada and review her', async () => {
      await dialog.getByRole('checkbox', { name: 'Ada Racer' }).click();
      await dialog.getByRole('button', { name: 'Review 1 racer' }).click();

      await expect(dialog.getByRole('heading', { name: 'Review Ada Racer' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Add Ada to the team' })).toBeDisabled();
    });

    await test.step('Confirm all seven details, then add her', async () => {
      const lines = [
        `Name: ${ada.first_name} ${ada.last_name}`,
        `Email: ${ada.email}`,
        'Phone: (312) 555-0100',
        `ZIP code: ${ada.zipcode}`,
        /^Years racing: ./,
        'Instagram: None',
        'TikTok: None',
      ];
      for (const name of lines) {
        await dialog.getByRole('checkbox', { name }).click();
      }
      await dialog.getByRole('button', { name: 'Add Ada to the team' }).click();
    });

    await test.step('The dialog closes, the slot is filled and Ada is no longer offered', async () => {
      await expect(dialog).toHaveCount(0);
      await expect(racers.getByText('Ada Racer', { exact: true })).toBeVisible();
      await expect(racers.getByText(ada.email)).toBeVisible();
      await expect(racers.getByText('1 of 3')).toBeVisible();
      await expect(racers.getByRole('button', { name: 'Pick from past teams (2)' })).toBeVisible();
    });
  });
});
