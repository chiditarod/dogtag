import { test, expect, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/** SPA end-to-end: a captain picks the teams they want to race with in the Questions card. */

interface Credentials {
  captain_email: string;
  captain_password: string;
  team_id: number;
  team_name: string;
  race_name: string;
  teams: { name: string; finalized: boolean }[];
}

const OTHER_TEXT = 'The Wandering Sprockets';

let seeded: Seed<Credentials>;

test.describe('SPA questions: team picker', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('buddy_picker');
  });
  test.afterAll(() => seeded.dispose());

  async function openQuestions(page: Page, c: Credentials) {
    await page.goto('/register/login');
    await page.getByLabel('Email', { exact: true }).fill(c.captain_email);
    await page.getByLabel('Password', { exact: true }).fill(c.captain_password);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByRole('heading', { name: 'My teams' })).toBeVisible();
    await page.getByRole('link', { name: `View team: ${c.team_name}` }).click();
    await expect(page).toHaveURL(new RegExp(`/register/teams/${c.team_id}$`));
    await expect(page.getByText(/\d+ of \d+ questions answered/)).toBeVisible();
  }

  async function editAnswers(page: Page) {
    await page.getByRole('button', { name: 'Edit answers' }).click();
    return page.getByRole('group', { name: 'Teams you want to race with' });
  }

  test('picking teams and naming others saves and survives a reload', async ({ page }) => {
    const c = seeded.credentials;
    // The seed lists teams in creation order; the picker must not.
    const apple = c.teams.find((team) => !team.finalized)!;
    const banana = c.teams.find((team) => team.finalized)!;
    expect([apple.name, banana.name]).toEqual(['apple cart', 'Banana Crew']);
    const appleBox = { name: `${apple.name}, Still registering` };
    const bananaBox = { name: `${banana.name}, Fully registered` };
    let picker = page.getByRole('group', { name: 'Teams you want to race with' });

    await test.step('Log in and open the team', async () => {
      await openQuestions(page, c);
    });

    await test.step('The picker lists the other teams alphabetically, ignoring case, with Other… last', async () => {
      picker = await editAnswers(page);
      await expect(picker.getByRole('checkbox')).toHaveCount(3);
      const boxes = picker.getByRole('checkbox');
      await expect(boxes.nth(0)).toHaveAccessibleName(`${apple.name}, Still registering`);
      await expect(boxes.nth(1)).toHaveAccessibleName(`${banana.name}, Fully registered`);
      await expect(boxes.nth(2)).toHaveAccessibleName('Other…');
      await expect(picker.getByRole('checkbox', { name: c.team_name })).toHaveCount(0);
    });

    await test.step('Tick both teams and Other…, then name the others', async () => {
      await picker.getByRole('checkbox', appleBox).check();
      await picker.getByRole('checkbox', bananaBox).check();
      await picker.getByRole('checkbox', { name: 'Other…' }).check();
      await picker.getByLabel('Which other teams or people?').fill(OTHER_TEXT);
    });

    await test.step('Save the answers', async () => {
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByText(/\d+ of \d+ questions answered/)).toBeVisible();
      await expect(picker).toHaveCount(0);
    });

    await test.step('After a reload the picks are still selected', async () => {
      await page.reload();
      picker = await editAnswers(page);
      await expect(picker.getByRole('checkbox', appleBox)).toBeChecked();
      await expect(picker.getByRole('checkbox', bananaBox)).toBeChecked();
      await expect(picker.getByRole('checkbox', { name: 'Other…' })).toBeChecked();
      await expect(picker.getByLabel('Which other teams or people?')).toHaveValue(OTHER_TEXT);
    });
  });

  test('unticking Other… and saving clears the free text', async ({ page }) => {
    const c = seeded.credentials;
    let picker = page.getByRole('group', { name: 'Teams you want to race with' });

    await openQuestions(page, c);

    await test.step('Name some others and save', async () => {
      picker = await editAnswers(page);
      await picker.getByRole('checkbox', { name: 'Other…' }).check();
      await picker.getByLabel('Which other teams or people?').fill(OTHER_TEXT);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(picker).toHaveCount(0);
    });

    await test.step('Untick Other… and save', async () => {
      await page.reload();
      picker = await editAnswers(page);
      await expect(picker.getByLabel('Which other teams or people?')).toHaveValue(OTHER_TEXT);
      await picker.getByRole('checkbox', { name: 'Other…' }).uncheck();
      await expect(picker.getByLabel('Which other teams or people?')).toHaveCount(0);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(picker).toHaveCount(0);
    });

    await test.step('After a reload Other… is unselected', async () => {
      await page.reload();
      picker = await editAnswers(page);
      await expect(picker.getByRole('checkbox', { name: 'Other…' })).not.toBeChecked();
      await expect(picker.getByLabel('Which other teams or people?')).toHaveCount(0);
    });
  });
});
