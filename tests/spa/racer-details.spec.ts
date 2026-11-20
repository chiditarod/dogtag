import { test, expect } from '@playwright/test';
import { clearInbox } from '../helpers/mailpit';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: typed years racing, the email check on blur and the picker label. */

interface Credentials {
  captain_email: string;
  captain_password: string;
  team_id: number;
  team_name: string;
  roster_email: string;
  new_email: string;
  veteran_email: string;
}

let seeded: Seed<Credentials>;

test.describe('SPA roster: racer details', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('racer_details');
  });
  test.afterAll(() => seeded.dispose());
  test.beforeEach(() => clearInbox());

  test('years are typed, the email is checked on blur and the picker offers one more year', async ({ page }) => {
    const c = seeded.credentials;

    await test.step('Log in and open the team', async () => {
      await page.goto('/register/login');
      await page.getByLabel('Email', { exact: true }).fill(c.captain_email);
      await page.getByLabel('Password', { exact: true }).fill(c.captain_password);
      await page.getByRole('button', { name: 'Log in' }).click();
      await page.getByRole('link', { name: `View team: ${c.team_name}` }).click();
      await expect(page).toHaveURL(new RegExp(`/register/teams/${c.team_id}$`));
    });

    const racers = page.getByRole('group', { name: 'Racers' });
    const email = page.getByLabel('Email', { exact: true });
    const years = page.getByLabel('Years racing', { exact: true });

    await test.step('Tabbing out of the email flags a malformed address and a roster duplicate', async () => {
      await racers.getByRole('button', { name: '+ Add someone new' }).click();

      await email.fill('ada@example');
      await email.press('Tab');
      await expect(page.getByText('Enter a valid email address')).toBeVisible();
      await expect(email).toHaveAttribute('aria-invalid', 'true');

      await email.fill(c.roster_email.toUpperCase());
      await email.press('Tab');
      await expect(page.getByText('Is already on this team')).toBeVisible();

      await email.fill(c.new_email);
      await expect(page.getByText('Is already on this team')).toHaveCount(0);
    });

    await test.step('Years racing rejects blank, text and 100, and saves 12', async () => {
      await page.getByLabel('First name').fill('Cy');
      await page.getByLabel('Last name').fill('Typed');
      await page.getByLabel('Phone').fill('3125550144');
      await expect(years).toBeFocused();
      await expect(years).toHaveAttribute('inputmode', 'numeric');

      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Enter how many years they have raced')).toBeVisible();

      await years.fill('abc');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Enter how many years they have raced')).toBeVisible();

      await years.fill('100');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('must be less than or equal to 99')).toBeVisible();

      await years.fill('12');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(racers.getByText('Cy Typed', { exact: true })).toBeVisible();
      await expect(racers.getByText('12 years racing')).toBeVisible();
    });

    await test.step('Editing a racer without changing their email shows no email error', async () => {
      await racers.getByRole('button', { name: 'Edit Bo Roster' }).click();
      await email.focus();
      await email.press('Tab');
      await expect(email).not.toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByText('Is already on this team')).toHaveCount(0);
      await page.getByRole('button', { name: 'Cancel' }).click();
    });

    await test.step('The picker says "racers" and offers a racer last at 7 as 8', async () => {
      await racers.getByRole('button', { name: 'Pick racers from past teams (1)' }).click();
      await expect(page.getByRole('dialog', { name: 'Pick racers from past teams' })).toBeVisible();
      // Step 2 renames the dialog `Review {name}`, so locate it without a name.
      const dialog = page.getByRole('dialog');

      await dialog.getByRole('checkbox', { name: 'Ada Veteran' }).click();
      await dialog.getByRole('button', { name: 'Review 1 racer' }).click();
      await expect(dialog.getByRole('checkbox', { name: 'Years racing: 8 years racing' })).toBeVisible();
      await expect(dialog.getByText('was 7 last time')).toBeVisible();
    });
  });
});
