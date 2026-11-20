import { test, expect, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: a form field with `showWhen` appears only while its controlling answer matches. */

interface Credentials {
  captain_email: string;
  captain_password: string;
  team_id: number;
  team_name: string;
  race_name: string;
}

const DETAILS = 'Details about your fire effects';
const TYPED = 'propane poi and a flaming cart';

let seeded: Seed<Credentials>;

test.describe('SPA questions: showWhen', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('show_when');
  });
  test.afterAll(() => seeded.dispose());

  async function openTeam(page: Page, c: Credentials) {
    await page.goto('/register/login');
    await page.getByLabel('Email', { exact: true }).fill(c.captain_email);
    await page.getByLabel('Password', { exact: true }).fill(c.captain_password);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByRole('heading', { name: 'My teams' })).toBeVisible();
    await page.getByRole('link', { name: `View team: ${c.team_name}` }).click();
    await expect(page).toHaveURL(new RegExp(`/register/teams/${c.team_id}$`));
    await expect(page.getByText(/\d+ of \d+ questions answered/)).toBeVisible();
  }

  const fireEffects = (page: Page) => page.getByRole('radiogroup', { name: /Fire Effects/ });
  const details = (page: Page) => page.getByRole('textbox', { name: DETAILS });

  test('the field follows the controlling answer and a hidden answer is not saved', async ({ page }) => {
    const c = seeded.credentials;

    await test.step('Log in, open the team and start editing', async () => {
      await openTeam(page, c);
      await page.getByRole('button', { name: 'Edit answers' }).click();
    });

    await test.step('With fire effects answered No the details field is hidden', async () => {
      await expect(fireEffects(page).getByRole('radio', { name: 'No' })).toBeChecked();
      await expect(details(page)).toHaveCount(0);
    });

    await test.step('Choosing Yes shows it, and what is typed survives hiding and re-showing', async () => {
      await fireEffects(page).getByRole('radio', { name: 'Yes' }).click();
      await expect(details(page)).toBeVisible();
      await details(page).fill(TYPED);

      await fireEffects(page).getByRole('radio', { name: 'No' }).click();
      await expect(details(page)).toHaveCount(0);
      await fireEffects(page).getByRole('radio', { name: 'Yes' }).click();
      await expect(details(page)).toHaveValue(TYPED);
    });

    await test.step('Saving as No drops the hidden answer', async () => {
      await fireEffects(page).getByRole('radio', { name: 'No' }).click();
      await expect(details(page)).toHaveCount(0);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByRole('button', { name: 'Edit answers' })).toBeVisible();
    });

    await test.step('After a reload, choosing Yes shows an empty field', async () => {
      await page.reload();
      await page.getByRole('button', { name: 'Edit answers' }).click();
      await fireEffects(page).getByRole('radio', { name: 'Yes' }).click();
      await expect(details(page)).toBeVisible();
      await expect(details(page)).toHaveValue('');
    });
  });
});
