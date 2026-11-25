/**
 * SPA steps shared by the e2e specs that register teams through the UI
 * (registration.spec.ts, refunds.spec.ts): sign up, start a team, add racers.
 */
import { expect, type Page } from '@playwright/test';
import { fillSecret } from './fill-secret';

/** Signs the captain up and waits for the race list. The email is a private mailbox on staging, so it goes in with fillSecret. */
export async function signUp(page: Page, { id, email, password }: { id: string; email: string; password: string }) {
  await page.goto('/register/signup');
  await page.getByLabel('First name').fill('Captain');
  await page.getByLabel('Last name').fill(`E2E ${id}`);
  await fillSecret(page.getByLabel('Email', { exact: true }), email);
  await page.getByLabel('Phone').pressSequentially('3125550100');
  await fillSecret(page.getByLabel('Password', { exact: true }), password);
  await fillSecret(page.getByLabel('Confirm password'), password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your race' })).toBeVisible();
}

/** From the race list: starts a team in the race ("Start a team", or "Start another team" for a captain who has one). Returns the team id. */
export async function startTeam(page: Page, raceName: string, teamName: string): Promise<number> {
  await page.goto('/register');
  const raceCard = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: raceName }) });
  await raceCard.getByRole('link', { name: /^Start (a|another) team$/ }).click();

  await expect(page.getByRole('heading', { name: 'Create your team' })).toBeVisible();
  await page.getByLabel('Team name').fill(teamName);
  await page.getByLabel('Description').fill('Pushing carts for charity');
  await page.getByLabel('Team years racing', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Create team' }).click();
  await expect(page).toHaveURL(/\/register\/teams\/\d+$/);
  return Number(/\/teams\/(\d+)$/.exec(page.url())![1]);
}

/** Fills the five-person roster on the team page. `label` makes the names (and emails) unique across teams. */
export async function addRacers(page: Page, { id, label }: { id: string; label: string }) {
  const racers = page.getByRole('group', { name: 'Racers' });
  for (let i = 1; i <= 5; i += 1) {
    await racers.getByRole('button', { name: '+ Add someone new' }).first().click();
    const form = page.getByRole('form', { name: 'Add a racer' });
    await form.getByLabel('First name').fill(`${label}${i}`);
    await form.getByLabel('Last name').fill('Pusher');
    await form.getByLabel('Email', { exact: true }).fill(`${label.toLowerCase()}${i}-${id}@example.com`);
    await form.getByLabel('Phone').pressSequentially('3125550144');
    await form.getByLabel('Years racing', { exact: true }).fill('2');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(racers.getByText(`${label}${i} Pusher`, { exact: true })).toBeVisible();
  }
  await expect(racers.getByText('5 of 5')).toBeVisible();
}
