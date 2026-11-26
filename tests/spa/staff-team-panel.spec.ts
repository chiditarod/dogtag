import { test, expect, type Page } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/**
 * SPA end-to-end: the staff view of the team page (the Staff card, staff Pay, read-only roles).
 *
 * Seeded credentials (`test_seeds:staff_team_panel`, all @example.com, one shared password):
 *   operator_email  an operator: edits a closed team, sets New team, pays past a gap
 *   refunder_email  a refunder: sees the Staff card and the Payments link, changes nothing
 *   owner_email     the account holder of both teams
 * The closed race (registration over, inside the final-edits window) has `closed_team_*`: 3 of 5 racers,
 * a paid Cart Deposit, an unpaid Registration at $120 and two sent emails. The open race has
 * `open_team_*`: 2 of 3 racers and a $50 mock fee.
 */

interface Credentials {
  operator_email: string;
  refunder_email: string;
  owner_email: string;
  owner_id: number;
  owner_name: string;
  password: string;
  short: string;
  closed_race_id: number;
  closed_race_name: string;
  closed_team_id: number;
  closed_team_name: string;
  buddy_team_name: string;
  captain_name: string;
  captain_email: string;
  open_race_id: number;
  open_race_name: string;
  open_team_id: number;
  open_team_name: string;
  theme_answer: string;
}

let seeded: Seed<Credentials>;

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto('/register/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('link', { name: 'My teams' })).toBeVisible();
}

const staffCard = (page: Page) => page.getByRole('region', { name: 'Staff', exact: true });
const racersGroup = (page: Page) => page.getByRole('group', { name: 'Racers' });
const emailRows = (page: Page) => page.locator('[data-email-id]');
const paymentRows = (page: Page) => page.locator('[data-payment-id]');

async function openTeam(page: Page, id: number, name: string) {
  await page.goto(`/register/teams/${id}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test.describe('SPA staff team view', () => {
  test.use({ viewport: { width: 1024, height: 900 } });
  // The steps share one seed: the operator pays the open team, then edits the closed one.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    seeded = seed<Credentials>('staff_team_panel');
  });
  test.afterAll(() => seeded.dispose());

  test('an owner with an unfinished roster is told the roster comes first, with no Pay and no Staff card', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.owner_email, c.password);
    await openTeam(page, c.open_team_id, c.open_team_name);

    await expect(page.getByText('Your team needs all of its racers before payment unlocks.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Pay|Mock pay)/ })).toHaveCount(0);
    await expect(staffCard(page)).toHaveCount(0);
  });

  test('an operator pays the open team past the short roster and the owner sees it paid', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.operator_email, c.password);
    await openTeam(page, c.open_team_id, c.open_team_name);

    await expect(page.getByText("The roster isn't full (2 of 3).", { exact: false })).toBeVisible();
    const pay = page.getByRole('button', { name: 'Pay $50 as staff' });
    await expect(pay).toBeVisible();
    // Outlined (the secondary button), not the solid primary one.
    await expect(pay).toHaveClass(/border-flag/);
    await pay.click();
    await expect(page.getByText('Paid $50').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /as staff/ })).toHaveCount(0);

    // The owner reloads: the fee is paid, the roster still short, so the team is not registered yet.
    await login(page, c.owner_email, c.password);
    await openTeam(page, c.open_team_id, c.open_team_name);
    await expect(page.getByText('Paid $50 total')).toBeVisible();
    await expect(page.getByText('Fully registered')).toHaveCount(0);
    await expect(page.getByText('1 spot to fill')).toBeVisible();
  });

  test('an operator reads and edits the closed team from its Staff card', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.operator_email, c.password);
    await openTeam(page, c.closed_team_id, c.closed_team_name);
    const card = staffCard(page);

    await test.step('The closed note and the card contents', async () => {
      await expect(
        page.getByText('Registration is closed. The racers can no longer change this team; you can, as staff.'),
      ).toBeVisible();
      await expect(card).toContainText('not yet (given at finalization)');
      await expect(card.getByText('Collaborating', { exact: true })).toBeVisible();
      await expect(card.getByRole('definition').filter({ hasText: /^Yes$/ })).toHaveCount(1);
      await expect(card).toContainText(c.buddy_team_name);
      await expect(card).toContainText('Pals at the docks');
      await expect(card).toContainText(c.captain_name);
      await expect(card.getByRole('link', { name: c.captain_email })).toBeVisible();
      await expect(card.getByRole('link', { name: c.owner_name })).toBeVisible();
    });

    await test.step('Emails (2) opens the sent emails for this team', async () => {
      await card.getByRole('link', { name: 'Emails (2)' }).click();
      await expect(page).toHaveURL(new RegExp(`/register/staff/emails\\?team_id=${c.closed_team_id}`));
      await expect(page.getByRole('button', { name: `Remove filter Team: ${c.closed_team_name}` })).toBeVisible();
      await expect(emailRows(page)).toHaveCount(2);
      await page.goBack();
      await expect(card).toBeVisible();
    });

    await test.step('New team saves and survives a reload', async () => {
      const select = card.getByLabel('New team', { exact: true });
      await select.selectOption('yes');
      await expect(card.getByText('Saved', { exact: true })).toBeVisible();
      await page.reload();
      await expect(staffCard(page).getByLabel('New team', { exact: true })).toHaveValue('yes');
    });

    await test.step('Staff add a fourth racer', async () => {
      await expect(racersGroup(page).getByText('Ada Captain', { exact: true })).toBeVisible();
      await racersGroup(page).getByRole('button', { name: '+ Add someone new' }).click();
      await page.getByLabel('First name').fill('Di');
      await page.getByLabel('Last name').fill('Fourth');
      await page.getByLabel('Email', { exact: true }).fill(`staff-panel-fourth-${seeded.uniqueId}@example.com`);
      await page.getByLabel('Phone').fill('3125550144');
      await page.getByLabel('Years racing', { exact: true }).fill('2');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(racersGroup(page).getByText('Di Fourth', { exact: true })).toBeVisible();
    });

    await test.step('Staff change an answer after close and it is saved', async () => {
      await page.getByRole('button', { name: 'Edit answers' }).click();
      const theme = page.getByLabel("Your theme, what's it all about?");
      await expect(theme).toHaveValue(c.theme_answer);
      await theme.fill('Staff corrected this');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByText(/\d+ of \d+ questions answered/)).toBeVisible();

      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: c.closed_team_name })).toBeVisible();
      await page.getByRole('button', { name: 'Edit answers' }).click();
      await expect(page.getByLabel("Your theme, what's it all about?")).toHaveValue('Staff corrected this');
    });

    await test.step('The fee card warns the race is closed, and Refund on Payments opens this payment', async () => {
      await expect(
        page.getByText("Registration is closed, so racers can't pay; staff can take payment anyway."),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pay $120 as staff' })).toBeVisible();
      await page.getByRole('link', { name: 'Refund on Payments' }).click();
      await expect(page).toHaveURL(new RegExp(`/register/staff/payments\\?team_id=${c.closed_team_id}`));
      await expect(page.getByRole('button', { name: `Remove filter Team: ${c.closed_team_name}` })).toBeVisible();
      await expect(paymentRows(page)).toHaveCount(1);
    });
  });

  test('the owner of the closed team can still edit racers but nothing else', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.owner_email, c.password);
    await openTeam(page, c.closed_team_id, c.closed_team_name);

    await expect(staffCard(page)).toHaveCount(0);
    await expect(racersGroup(page).getByRole('button', { name: 'Edit Ada Captain' })).toBeVisible();
    await expect(racersGroup(page).getByRole('button', { name: '+ Add someone new' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Make .* captain$/ })).toHaveCount(0);
    // The owner's `Edit team details` button is not asserted: racers keep today's rules (`editTeam` is always true), so it shows after close and the server refuses the save.
    await expect(page.getByText('Registration is closed, so answers can no longer be changed.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit answers' })).toHaveCount(0);
  });

  test('a refunder sees the Staff card read-only and follows its Payments link to this team only', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.refunder_email, c.password);
    await openTeam(page, c.closed_team_id, c.closed_team_name);
    const card = staffCard(page);

    await expect(card).toContainText(c.captain_name);
    await expect(card.getByRole('combobox')).toHaveCount(0);
    await expect(card.getByRole('link', { name: /^Emails/ })).toHaveCount(0);
    await expect(card.getByRole('link', { name: 'Payments' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Pay|Mock pay)/ })).toHaveCount(0);
    await expect(racersGroup(page).getByRole('button', { name: '+ Add someone new' })).toHaveCount(0);
    await expect(racersGroup(page).getByRole('button', { name: /^(Edit|Remove|Make)/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit answers' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit team details' })).toHaveCount(0);

    // A refunder cannot pay, so a closed team that is not paid up shows no payment lines: the card link is the way in.
    await expect(page.getByText('Registration is closed.', { exact: true })).toBeVisible();
    await card.getByRole('link', { name: 'Payments' }).click();
    await expect(page).toHaveURL(new RegExp(`/register/staff/payments\\?team_id=${c.closed_team_id}`));
    const chip = page.getByRole('button', { name: `Remove filter Team: ${c.closed_team_name}` });
    await expect(chip).toBeVisible();
    await expect(paymentRows(page)).toHaveCount(1);
    await expect(paymentRows(page).first()).toContainText(c.closed_team_name);

    await chip.click();
    await expect(chip).toHaveCount(0);
    await expect(paymentRows(page).filter({ hasText: c.closed_team_name })).toHaveCount(0);
  });

  test.describe('at 320px', () => {
    test.use({ viewport: { width: 320, height: 700 } });

    test('the operator’s Staff details start collapsed and open on tap without sideways scroll', async ({ page }) => {
      const c = seeded.credentials;
      await login(page, c.operator_email, c.password);
      await openTeam(page, c.closed_team_id, c.closed_team_name);

      const toggle = page.getByRole('button', { name: /Staff details/ });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(staffCard(page)).toContainText(`Captain ${c.captain_name}`);
      await expect(staffCard(page).getByText('Team number')).toBeHidden();

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(staffCard(page).getByText('Team number')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    });
  });

  test('staff team links from Who’s registered and the user page open the SPA team page', async ({ page }) => {
    const c = seeded.credentials;
    await login(page, c.operator_email, c.password);

    await page.goto('/register');
    const tile = page.getByRole('listitem').filter({ hasText: c.closed_race_name });
    await tile.getByRole('link', { name: "See who's registered" }).click();
    await expect(page).toHaveURL(new RegExp(`/register/races/${c.closed_race_id}/registrations`));
    await page.getByRole('tab', { name: /^Still registering/ }).click();
    await page.getByRole('link', { name: c.closed_team_name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/register/teams/${c.closed_team_id}$`));
    await expect(staffCard(page)).toBeVisible();

    await page.goto(`/register/staff/users/${c.owner_id}`);
    const teamLink = page.getByRole('link', { name: c.closed_team_name, exact: true });
    await expect(teamLink).toHaveAttribute('href', `/register/teams/${c.closed_team_id}`);
    await teamLink.click();
    await expect(page).toHaveURL(new RegExp(`/register/teams/${c.closed_team_id}$`));
    await expect(staffCard(page)).toBeVisible();
  });
});
