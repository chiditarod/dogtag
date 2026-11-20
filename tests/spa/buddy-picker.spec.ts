import { test, expect, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/**
 * SPA end-to-end: the Questions card opens with "same route as another team?";
 * Yes reveals the team picker, No hides it and saving No clears the picks.
 * The tests share one seeded team and run in order.
 */

interface Credentials {
  captain_email: string;
  captain_password: string;
  team_id: number;
  team_name: string;
  race_name: string;
  teams: { name: string; finalized: boolean }[];
}

const OTHER_TEXT = 'The Wandering Sprockets';
const SAME_ROUTE = /same route as another person or team/;
const PICKER = { name: 'Teams you want to race alongside' };

let seeded: Seed<Credentials>;

test.describe('SPA questions: same-route question and team picker', () => {
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

  /** Opens the form and returns the same-route radio group. */
  async function editAnswers(page: Page) {
    await page.getByRole('button', { name: 'Edit answers' }).click();
    return page.getByRole('radiogroup', { name: SAME_ROUTE });
  }

  async function save(page: Page) {
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/\d+ of \d+ questions answered/)).toBeVisible();
  }

  async function savedQuestions(page: Page, c: Credentials) {
    const response = await page.request.get(`/api/v1/teams/${c.team_id}/questions`);
    expect(response.ok()).toBe(true);
    return (await response.json()) as {
      collaborating: boolean | null;
      buddy_team_ids: number[];
      other_buddies: string | null;
    };
  }

  test('Yes reveals the picker; picks save and survive a reload', async ({ page }) => {
    const c = seeded.credentials;
    // The seed lists teams in creation order; the picker must not.
    const apple = c.teams.find((team) => !team.finalized)!;
    const banana = c.teams.find((team) => team.finalized)!;
    expect([apple.name, banana.name]).toEqual(['apple cart', 'Banana Crew']);
    const appleBox = { name: `${apple.name}, Still registering` };
    const bananaBox = { name: `${banana.name}, Fully registered` };
    const picker = page.getByRole('group', PICKER);
    let question = page.getByRole('radiogroup', { name: SAME_ROUTE });

    await test.step('Log in and open the team', async () => {
      await openQuestions(page, c);
    });

    await test.step('The question starts unanswered and the picker is hidden', async () => {
      question = await editAnswers(page);
      await expect(question.getByRole('radio', { name: 'Yes' })).not.toBeChecked();
      await expect(question.getByRole('radio', { name: 'No' })).not.toBeChecked();
      await expect(picker).toHaveCount(0);
    });

    await test.step('Save is blocked until Yes or No is chosen', async () => {
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByText('Choose Yes or No')).toBeVisible();
      await expect(question.getByRole('radio', { name: 'Yes' })).toBeFocused();
    });

    await test.step('The question info tip opens on tap', async () => {
      await page.getByRole('button', { name: 'About racing on the same route' }).click();
      await expect(page.getByText(/ensemble of more than one cart/)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByText(/ensemble of more than one cart/)).toHaveCount(0);
    });

    await test.step('Yes reveals the picker, alphabetical ignoring case, with Other… last', async () => {
      await question.getByRole('radio', { name: 'Yes' }).check();
      await expect(page.getByText('Choose Yes or No')).toHaveCount(0);
      const boxes = picker.getByRole('checkbox');
      await expect(boxes).toHaveCount(3);
      await expect(boxes.nth(0)).toHaveAccessibleName(appleBox.name);
      await expect(boxes.nth(1)).toHaveAccessibleName(bananaBox.name);
      await expect(boxes.nth(2)).toHaveAccessibleName('Other…');
      await expect(picker.getByRole('checkbox', { name: c.team_name })).toHaveCount(0);
    });

    await test.step('The picker info tip opens from the keyboard', async () => {
      await page.getByRole('button', { name: 'About picking teams' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByText(/Names only; teams are told nothing/)).toBeVisible();
      await page.keyboard.press('Escape');
    });

    await test.step('Tick both teams and Other…, then name the others', async () => {
      await picker.getByRole('checkbox', appleBox).check();
      await picker.getByRole('checkbox', bananaBox).check();
      await picker.getByRole('checkbox', { name: 'Other…' }).check();
      await picker.getByLabel('Which other teams or people?').fill(OTHER_TEXT);
    });

    await test.step('No hides the picker and Yes brings the picks back', async () => {
      await question.getByRole('radio', { name: 'No' }).check();
      await expect(picker).toHaveCount(0);
      await question.getByRole('radio', { name: 'Yes' }).check();
      await expect(picker.getByRole('checkbox', appleBox)).toBeChecked();
      await expect(picker.getByLabel('Which other teams or people?')).toHaveValue(OTHER_TEXT);
    });

    await test.step('Save the answers', async () => {
      await save(page);
      await expect(picker).toHaveCount(0);
    });

    await test.step('After a reload Yes and the picks are still selected', async () => {
      await page.reload();
      question = await editAnswers(page);
      await expect(question.getByRole('radio', { name: 'Yes' })).toBeChecked();
      await expect(picker.getByRole('checkbox', appleBox)).toBeChecked();
      await expect(picker.getByRole('checkbox', bananaBox)).toBeChecked();
      await expect(picker.getByRole('checkbox', { name: 'Other…' })).toBeChecked();
      await expect(picker.getByLabel('Which other teams or people?')).toHaveValue(OTHER_TEXT);
    });
  });

  test('unticking Other… and saving clears the free text', async ({ page }) => {
    const c = seeded.credentials;
    const picker = page.getByRole('group', PICKER);

    await openQuestions(page, c);

    await test.step('Name some others and save', async () => {
      const question = await editAnswers(page);
      await question.getByRole('radio', { name: 'Yes' }).check();
      await picker.getByRole('checkbox', { name: 'Other…' }).check();
      await picker.getByLabel('Which other teams or people?').fill(OTHER_TEXT);
      await save(page);
    });

    await test.step('Untick Other… and save', async () => {
      await page.reload();
      await editAnswers(page);
      await expect(picker.getByLabel('Which other teams or people?')).toHaveValue(OTHER_TEXT);
      await picker.getByRole('checkbox', { name: 'Other…' }).uncheck();
      await expect(picker.getByLabel('Which other teams or people?')).toHaveCount(0);
      await save(page);
    });

    await test.step('After a reload Other… is unselected', async () => {
      await page.reload();
      await editAnswers(page);
      await expect(picker.getByRole('checkbox', { name: 'Other…' })).not.toBeChecked();
      await expect(picker.getByLabel('Which other teams or people?')).toHaveCount(0);
    });
  });

  test('saving No clears the picks', async ({ page }) => {
    const c = seeded.credentials;
    const picker = page.getByRole('group', PICKER);

    await openQuestions(page, c);

    await test.step('Pick a team and name others under Yes', async () => {
      const question = await editAnswers(page);
      await question.getByRole('radio', { name: 'Yes' }).check();
      await picker.getByRole('checkbox', { name: /apple cart/ }).check();
      await picker.getByRole('checkbox', { name: 'Other…' }).check();
      await picker.getByLabel('Which other teams or people?').fill(OTHER_TEXT);
      await save(page);
      const saved = await savedQuestions(page, c);
      expect(saved.collaborating).toBe(true);
      expect(saved.buddy_team_ids.length).toBeGreaterThan(0);
      expect(saved.other_buddies).toBe(OTHER_TEXT);
    });

    await test.step('Answer No and save', async () => {
      const question = await editAnswers(page);
      await question.getByRole('radio', { name: 'No' }).check();
      await expect(picker).toHaveCount(0);
      await save(page);
      expect(await savedQuestions(page, c)).toMatchObject({
        collaborating: false,
        buddy_team_ids: [],
        other_buddies: null,
      });
    });

    await test.step('After a reload No is chosen and Yes shows no picks', async () => {
      await page.reload();
      const question = await editAnswers(page);
      await expect(question.getByRole('radio', { name: 'No' })).toBeChecked();
      await expect(picker).toHaveCount(0);
      await question.getByRole('radio', { name: 'Yes' }).check();
      await expect(picker.getByRole('checkbox', { name: /apple cart/ })).not.toBeChecked();
      await expect(picker.getByRole('checkbox', { name: 'Other…' })).not.toBeChecked();
    });
  });
});
