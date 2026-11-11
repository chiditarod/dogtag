import { test, expect } from '@playwright/test';
import { clearInbox, waitForEmail } from '../helpers/mailpit';
import { seed, type Seed } from '../helpers/seed';
import { APP_HOST } from '../helpers/server-env';

/**
 * SPA end-to-end: sign up, create a team, add racers, answer the race
 * questions, mock-pay, and receive the welcome and confirmation emails.
 */

interface Credentials {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  race_name: string;
  people_per_team: number;
}

let seeded: Seed<Credentials>;

test.describe('SPA registration: sign up through finalization', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('spa_registration');
  });
  test.afterAll(() => seeded.dispose());
  test.beforeEach(() => clearInbox());

  test('a new user signs up, completes the checklist and is confirmed by email', async ({ page }) => {
    const c = seeded.credentials;

    await test.step('Sign up and receive the welcome email', async () => {
      await page.goto('/register/signup');
      await page.getByLabel('First name').fill(c.first_name);
      await page.getByLabel('Last name').fill(c.last_name);
      await page.getByLabel('Email', { exact: true }).fill(c.email);
      await page.getByLabel('Phone').pressSequentially(c.phone);
      await page.getByLabel('Password', { exact: true }).fill(c.password);
      await page.getByLabel('Confirm password').fill(c.password);
      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page.getByRole('heading', { name: 'Choose your race' })).toBeVisible();

      const welcome = await waitForEmail({ to: c.email, subjectIncludes: 'Welcome to dogTag' });
      expect(welcome.links.length).toBeGreaterThan(0);
      expect(welcome.links.some((link) => link.includes(APP_HOST))).toBe(true);
    });

    await test.step('Start a team in the seeded race', async () => {
      const raceCard = page.getByRole('listitem').filter({
        has: page.getByRole('heading', { name: c.race_name }),
      });
      await raceCard.getByRole('link', { name: 'Start a team' }).click();

      await expect(page.getByRole('heading', { name: 'Create your team' })).toBeVisible();
      await page.getByLabel('Team name').fill(`Test Team E2E ${seeded.uniqueId.slice(0, 8)}`);
      await page.getByLabel('Description').fill('Pushing carts for charity');
      await page.getByLabel('Team years racing', { exact: true }).selectOption({ index: 1 });
      await page.getByRole('button', { name: 'Create team' }).click();

      await expect(page).toHaveURL(/\/register\/teams\/\d+$/);
    });

    const racers = page.getByRole('group', { name: 'Racers' });
    await test.step('Add the racers', async () => {
      for (let i = 1; i <= c.people_per_team; i += 1) {
        await racers.getByRole('button', { name: '+ Add someone new' }).first().click();
        const form = page.getByRole('form', { name: 'Add a racer' });
        await form.getByLabel('First name').fill(`Racer${i}`);
        await form.getByLabel('Last name').fill('Pusher');
        await form.getByLabel('Email', { exact: true }).fill(`racer${i}-${seeded.uniqueId}@example.com`);
        await form.getByLabel('Phone').pressSequentially('3125550144');
        await form.getByLabel('ZIP code').fill('60601');
        await form.getByLabel('Years racing', { exact: true }).selectOption({ index: 2 });
        await form.getByRole('button', { name: 'Save' }).click();
        await expect(racers.getByText(`Racer${i} Pusher`, { exact: true })).toBeVisible();
      }
      await expect(racers.getByText(`${c.people_per_team} of ${c.people_per_team}`)).toBeVisible();
      await expect(racers.getByText('(312) 555-0144').first()).toBeVisible();
    });

    await test.step('Answer the team questions', async () => {
      const questions = page.getByRole('group', { name: 'Team questions' });
      await questions.getByRole('radio', { name: 'Racer', exact: true }).check();
      await questions.getByLabel('Your theme').fill('Carts of a thousand colors');
      await questions.getByLabel('I will follow the race rules').check();
      await questions.getByLabel('Fundraising plans').selectOption('Probably');
      await questions.getByRole('button', { name: 'Save' }).click();
      await expect(questions.getByText('4 of 4 questions answered')).toBeVisible();
    });

    await test.step('Mock pay and get confirmed', async () => {
      const fee = page.getByRole('group', { name: 'Registration fee' });
      await fee.getByRole('button', { name: 'Mock pay' }).click();

      const done = page.getByRole('group', { name: "You're in!" });
      await expect(done.getByText(/^Team #\d+$/)).toBeVisible();

      const confirmation = await waitForEmail({
        to: c.email,
        subjectIncludes: 'Registration Confirmed for',
      });
      expect(confirmation.subject).toContain(c.race_name);
    });
  });
});
