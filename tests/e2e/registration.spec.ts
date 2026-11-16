/**
 * Test B: a new captain registers a team in this run's race (created by the
 * race-setup project) through the SPA, from sign-up to "You're in!".
 *
 *   npm run e2e                     # local, mock payments
 *   E2E_CHECK_EMAIL=1 npm run e2e   # also assert the welcome and confirmation emails
 *   npm run e2e:stripe              # local, Stripe Checkout with test keys
 *
 * Payments only ever happen against a race whose Stripe publishable key is a
 * test key (assertTestKey), in mock mode too.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { deleteFundraisingTeam, findFundraisingTeamsByName } from './classy';
import { clearInbox, waitForEmail } from './inbox';
import { assertTestKey, payFee } from './payments';
import { readRaceState, runId, target } from './run';

interface JsonformProperty {
  title?: string;
  enum?: string[];
  pattern?: string;
}

const jsonform = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'jsonform.json'), 'utf8')) as {
  schema: { properties: Record<string, JsonformProperty> };
};

/** Schema-valid answers for every chiditarod_21 question (required ones match lib/staging_seed.rb). */
const ANSWERS: Record<string, string> = {
  instagram: '@e2e_test',
  'racer-type': 'Racer',
  'private-comments': 'Automated end-to-end test team.',
  buddies: 'Nobody',
  'theme-chosen': 'Yes',
  'racing-for-time': 'No',
  'explain-theme': 'Supermarket sweep, but for charity.',
  'primary-inspiration': 'Food driving',
  'secondary-inspiration': 'Making a difference',
  'agree-to-core-philosophy': 'Yes',
  'agree-to-rules': 'Yes',
  'agree-to-sabotage': 'Yes',
  'agree-to-cart-deposit': 'Yes',
  'agree-to-cart-food-poundage': 'Yes',
  'agree-not-a-donation': 'Yes',
  'agree-to-orientation': 'Yes',
  'flame-effects': 'No',
  fundraising: 'Probably',
  'cart-parking': 'Short Term',
  'referred-by': 'The e2e suite',
  collaborating: 'No',
  'raced-in-past': 'Yes',
};

/** The accessible name of a JSONForm title, which may carry HTML links. */
const plainTitle = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function currentRace(request: APIRequestContext, raceName: string) {
  const response = await request.get('/api/v1/races');
  expect(response.status()).toBe(200);
  const race = (await response.json()).races.find((r: { name: string }) => r.name === raceName);
  expect(race, `race "${raceName}" in /api/v1/races`).toBeTruthy();
  return race;
}

// A fresh visitor: no operator session from the race-setup project.
test.use({ storageState: { cookies: [], origins: [] } });

test.afterAll(async () => {
  // The IMAP mailbox is shared; leave nothing from this run behind.
  if (target.inbox === 'imap') await clearInbox();
});

test('B: a new captain registers a team through "You\'re in!"', async ({ page, request }) => {
  const id = runId();
  const { raceName } = readRaceState();
  const email = target.racerEmail(id);
  const teamName = `Test Team E2E ${id}`;
  const password = `E2e-${id}-pass`;
  const fee = page.getByRole('group', { name: 'Registration fee' });

  await test.step('The race takes test payments only', async () => {
    assertTestKey((await currentRace(request, raceName)).stripe_publishable_key);
  });

  if (target.checkEmail) await test.step('Clear the inbox', () => clearInbox());

  await test.step('Sign up', async () => {
    await page.goto('/register/signup');
    await page.getByLabel('First name').fill('Captain');
    await page.getByLabel('Last name').fill(`E2E ${id}`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Phone').pressSequentially('3125550100');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Choose your race' })).toBeVisible();

    if (target.checkEmail) {
      const welcome = await waitForEmail({ to: email, subjectIncludes: 'Welcome to dogTag' });
      const host = new URL(target.baseURL).host;
      expect(welcome.links.some((link) => link.includes(host))).toBe(true);
    }
  });

  await test.step('Start a team in the race', async () => {
    const raceCard = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: raceName }) });
    await raceCard.getByRole('link', { name: 'Start a team' }).click();

    await expect(page.getByRole('heading', { name: 'Create your team' })).toBeVisible();
    await page.getByLabel('Team name').fill(teamName);
    await page.getByLabel('Description').fill('Pushing carts for charity');
    await page.getByLabel('Team years racing', { exact: true }).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Create team' }).click();
    await expect(page).toHaveURL(/\/register\/teams\/\d+$/);
  });

  await test.step('Add 5 racers', async () => {
    const racers = page.getByRole('group', { name: 'Racers' });
    for (let i = 1; i <= 5; i += 1) {
      await racers.getByRole('button', { name: '+ Add someone new' }).first().click();
      const form = page.getByRole('form', { name: 'Add a racer' });
      await form.getByLabel('First name').fill(`Racer${i}`);
      await form.getByLabel('Last name').fill('Pusher');
      await form.getByLabel('Email', { exact: true }).fill(`racer${i}-${id}@example.com`);
      await form.getByLabel('Phone').pressSequentially('3125550144');
      await form.getByLabel('ZIP code').fill('60601');
      await form.getByLabel('Years racing', { exact: true }).selectOption({ index: 2 });
      await form.getByRole('button', { name: 'Save' }).click();
      await expect(racers.getByText(`Racer${i} Pusher`, { exact: true })).toBeVisible();
    }
    await expect(racers.getByText('5 of 5')).toBeVisible();
  });

  await test.step('Answer every team question', async () => {
    const questions = page.getByRole('group', { name: 'Team questions' });
    const properties = Object.entries(jsonform.schema.properties);
    for (const [key, property] of properties) {
      const value = ANSWERS[key];
      expect(value, `an answer for question "${key}"`).toBeDefined();
      const title = plainTitle(property.title ?? key);
      // Mirrors the SPA renderer: agree-* → checkbox, ≤3 options → radios, more → select, else a text box.
      if (key.startsWith('agree-') && property.pattern === '^Yes$') {
        await questions.getByRole('checkbox', { name: title, exact: true }).check();
      } else if (property.enum && property.enum.length <= 3) {
        await questions
          .getByRole('radiogroup', { name: title, exact: true })
          .getByRole('radio', { name: value, exact: true })
          .check();
      } else if (property.enum) {
        await questions.getByLabel(title, { exact: true }).selectOption(value);
      } else {
        await questions.getByLabel(title, { exact: true }).fill(value);
      }
    }
    await questions.getByRole('button', { name: 'Save' }).click();
    const total = properties.length;
    await expect(questions.getByText(`${total} of ${total} questions answered`)).toBeVisible();
  });

  await test.step('Pay both fees and get a team number', async () => {
    // Re-checked right before the first payment click.
    assertTestKey((await currentRace(request, raceName)).stripe_publishable_key);

    const deposit = fee.getByRole('listitem').filter({ hasText: 'Cart Deposit' });
    const registration = fee.getByRole('listitem').filter({ hasText: 'Race Registration' });
    const teamNumber = page.getByRole('group', { name: "You're in!" }).getByText(/^Team #\d+$/);

    await payFee(page, deposit, '$88', target.payments);
    await expect(page.getByText(/^Team #\d+$/)).toHaveCount(0);

    await payFee(page, registration, '$130', target.payments);
    await expect(fee.getByText('Paid $218 total')).toBeVisible();
    await expect(teamNumber).toBeVisible();
  });

  if (target.checkEmail) {
    await test.step('Receive the confirmation email', async () => {
      const confirmation = await waitForEmail({ to: email, subjectIncludes: 'Registration Confirmed for' });
      expect(confirmation.subject).toContain(raceName);
    });
  }

  const classy = target.classy;
  if (classy) {
    await test.step('The Classy fundraising team exists, then remove it', async () => {
      await expect
        .poll(() => findFundraisingTeamsByName(classy.campaignId, teamName), { timeout: 120_000 })
        .toHaveLength(1);
      const [team] = await findFundraisingTeamsByName(classy.campaignId, teamName);
      const result = await deleteFundraisingTeam(team, classy.campaignId);
      if (result === 'unsupported') {
        test.info().annotations.push({
          type: 'classy-cleanup',
          description: `Classy refused to delete fundraising team ${team.id}; remove it by hand`,
        });
      }
    });
  }
});
