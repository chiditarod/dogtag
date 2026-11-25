/**
 * Test C: staff refund real payments through the SPA Payments page, one alone
 * and then a batch of two, in this run's race (created by the race-setup project).
 *
 *   E2E_CHECK_EMAIL=1 npm run e2e:staging    # Stripe test card on staging, IMAP check of the refund emails
 *   npx playwright test --project=refunds    # local, mock payments (a mock charge refunds outside production)
 *
 * One captain starts two teams, each with a full roster (a fee cannot be paid
 * before that): "Solo" pays the cart deposit, "Pair" pays the deposit and the
 * race registration fee, so three payments exist. Solo's is refunded alone;
 * Pair's two are refunded as a batch. Nothing finalizes (no questions are
 * answered, no captain is chosen), so there is no Classy team to clean up.
 *
 * The operator (never an admin) comes in through the saved admin-auth session
 * in a second browser context. The charge is not read back from Stripe: the
 * suite holds no Stripe secret key, so "refunded" is what the app reports.
 */
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'crypto';
import { STAFF_STATE } from './admin-forms';
import { clearInbox, countEmails, waitForEmail } from './inbox';
import { assertTestKey, payFee } from './payments';
import { readRaceState, runId, target } from './run';
import { addRacers, signUp, startTeam } from './team-steps';

/** Two Stripe Checkout payments at up to 90 s each, three fee rows, 10 racers, plus the refunds and emails. */
const STAGING_TIMEOUT = 15 * 60_000;
const LOCAL_TIMEOUT = 4 * 60_000;

/** Subject fragment of the refund email: "<race>: Refund for <team>". */
const REFUND_SUBJECT = 'Refund for';

async function currentRace(request: APIRequestContext, raceName: string) {
  const response = await request.get('/api/v1/races');
  expect(response.status()).toBe(200);
  const race = (await response.json()).races.find((r: { name: string }) => r.name === raceName);
  expect(race, `race "${raceName}" in /api/v1/races`).toBeTruthy();
  return race;
}

/** Fee list rows of the open team page. */
const feeRow = (page: Page, name: string): Locator =>
  page.getByRole('group', { name: 'Registration fee' }).getByRole('listitem').filter({ hasText: name });

/** The payment rows of one team on the staff page. */
const paymentRows = (page: Page, teamName: string): Locator =>
  page.getByRole('row').filter({ hasText: teamName });

/**
 * Entering Refund mode sets the status filter to Paid and leaving it keeps that, so refunded rows are
 * hidden until All is chosen. The radios are sr-only and controlled by the URL: click the visible label.
 */
async function chooseStatus(page: Page, label: 'All' | 'Paid' | 'Refunded') {
  const group = page.getByRole('group', { name: 'Status' });
  await group.getByText(label, { exact: true }).click();
  await expect(group.getByRole('radio', { name: label, exact: true })).toBeChecked();
}

// The racer is a fresh visitor with the guided tour switched off (it would cover the team page).
test.use({
  storageState: {
    cookies: [],
    origins: [{ origin: new URL(target.baseURL).origin, localStorage: [{ name: 'dogtag:tour:off', value: '1' }] }],
  },
});

test('C: staff refund one payment, then a batch of two', async ({ page, browser, request }) => {
  test.setTimeout(target.name === 'staging' ? STAGING_TIMEOUT : LOCAL_TIMEOUT);
  const retry = test.info().retry;
  const id = `${retry > 0 ? `${runId()}-r${retry}` : runId()}-refund`;
  const { raceId, raceName } = readRaceState();
  const email = target.racerEmail(id);
  const password = `E2e-${randomUUID()}`;
  const solo = `Test Team E2E ${id} Solo`;
  const pair = `Test Team E2E ${id} Pair`;
  let soloId = 0;
  let pairId = 0;

  const publishableKey = async () => (await currentRace(request, raceName)).stripe_publishable_key;
  await test.step('The race takes test payments only', async () => assertTestKey(await publishableKey()));

  if (target.checkEmail) await test.step('Clear the inbox', () => clearInbox(email));

  await test.step('A captain signs up', () => signUp(page, { id, email, password }));

  await test.step('Solo pays the cart deposit', async () => {
    soloId = await startTeam(page, raceName, solo);
    await addRacers(page, { id, label: 'Solo' });
    await payFee(page, feeRow(page, 'Cart Deposit'), '$88', target.payments, await publishableKey());
    await expect(feeRow(page, 'Race Registration')).not.toContainText('Paid');
  });

  await test.step('Pair pays the deposit and the registration fee', async () => {
    pairId = await startTeam(page, raceName, pair);
    await addRacers(page, { id, label: 'Pair' });
    await payFee(page, feeRow(page, 'Cart Deposit'), '$88', target.payments, await publishableKey());
    await payFee(page, feeRow(page, 'Race Registration'), '$130', target.payments, await publishableKey());
    await expect(page.getByRole('group', { name: 'Registration fee' }).getByText('Paid $218 total')).toBeVisible();
  });

  // The staff session (an operator) was saved by the admin-auth project; no trace or video on staging.
  const staffContext = await browser.newContext({ storageState: STAFF_STATE, baseURL: target.baseURL });
  try {
    const staff = await staffContext.newPage();
    const results = staff.getByRole('dialog', { name: 'Refunds finished' });
    const progress = (done: number, amount: number) =>
      staff.getByText(`${done} of 3 refunded · $${amount} of $306`, { exact: true });

    await test.step('The Payments page lists all three payments as paid', async () => {
      // The race may hold other payments (the registration spec pays into the same race on staging), so
      // search by this run's team names: the list and the progress line then count only ours.
      await staff.goto(`/register/staff/payments?race_id=${raceId}&q=${encodeURIComponent(`Test Team E2E ${id}`)}`);
      await expect(staff.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
      await expect(progress(0, 0)).toBeVisible();
      await expect(paymentRows(staff, solo)).toHaveCount(1);
      await expect(paymentRows(staff, pair)).toHaveCount(2);
    });

    await test.step('Refund one payment', async () => {
      await staff.getByRole('button', { name: 'Refund payments' }).click();
      await expect(staff.getByRole('heading', { name: 'Payments · Refund mode' })).toBeVisible();
      await staff.getByRole('checkbox', { name: `Select ${solo}` }).check();
      await expect(staff.getByText('1 of 5 selected · $88', { exact: true })).toBeVisible();
      await staff.getByRole('button', { name: 'Review and refund 1…' }).click();

      const dialog = staff.getByRole('dialog', { name: 'Refund 1 payment?' });
      await expect(dialog.getByText('Total: $88')).toBeVisible();
      await expect(dialog.getByRole('list', { name: 'Payments to refund' }).getByRole('listitem')).toHaveCount(1);
      const confirm = dialog.getByRole('button', { name: 'Refund 1 payment' });
      await expect(confirm).toBeDisabled();
      await dialog.getByLabel('Type REFUND 1 to confirm').fill('REFUND 1');
      await confirm.click();

      await expect(results).toBeVisible();
      const item = results.locator('li[data-status="refunded"]');
      await expect(item).toHaveCount(1);
      await expect(item).toContainText(solo);
      await expect(results.locator('li[data-status="failed"]')).toHaveCount(0);
      await results.getByRole('button', { name: 'Done' }).click();

      // Back in Browse: the progress line counts it and the row says Refunded.
      await expect(staff.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
      await expect(progress(1, 88)).toBeVisible();
      await chooseStatus(staff, 'All');
      await expect(paymentRows(staff, solo)).toContainText(/Refunded/);
      await expect(paymentRows(staff, pair).filter({ hasText: /Refunded/ })).toHaveCount(0);
    });

    await test.step('The refunded payment cannot be picked again', async () => {
      await staff.getByRole('button', { name: 'Refund payments' }).click();
      // Refund mode lists paid payments only, so the refunded one has no tick box at all.
      await expect(staff.getByRole('checkbox', { name: `Select ${pair}` })).toHaveCount(2);
      await expect(staff.getByRole('checkbox', { name: `Select ${solo}` })).toHaveCount(0);
      await expect(paymentRows(staff, solo)).toHaveCount(0);
    });

    await test.step('Refund the other two as a batch', async () => {
      const pairBoxes = staff.getByRole('checkbox', { name: `Select ${pair}` });
      await pairBoxes.nth(0).check();
      await pairBoxes.nth(1).check();
      await expect(staff.getByText('2 of 5 selected · $218', { exact: true })).toBeVisible();
      await staff.getByRole('button', { name: 'Review and refund 2…' }).click();

      const dialog = staff.getByRole('dialog', { name: 'Refund 2 payments?' });
      await expect(dialog.getByText('Total: $218')).toBeVisible();
      const listed = dialog.getByRole('list', { name: 'Payments to refund' }).getByRole('listitem');
      await expect(listed).toHaveCount(2);
      await expect(listed.filter({ hasText: pair })).toHaveCount(2);
      const confirm = dialog.getByRole('button', { name: 'Refund 2 payments' });
      await dialog.getByLabel('Type REFUND 2 to confirm').fill('REFUND 1');
      await expect(confirm).toBeDisabled();
      await dialog.getByLabel('Type REFUND 2 to confirm').fill('REFUND 2');
      await confirm.click();

      // The page polls until the job is over, so the dialog only reads "finished" once both are done.
      await expect(results).toBeVisible({ timeout: 90_000 });
      await expect(results.locator('li[data-status="refunded"]')).toHaveCount(2);
      await expect(results.locator('li[data-status="failed"]')).toHaveCount(0);
      await expect(results.getByRole('button', { name: /^Retry/ })).toHaveCount(0);
      await results.getByRole('button', { name: 'Done' }).click();

      await expect(progress(3, 306)).toBeVisible();
      await chooseStatus(staff, 'All');
      await expect(paymentRows(staff, pair).filter({ hasText: /Refunded/ })).toHaveCount(2);
    });
  } finally {
    await staffContext.close();
  }

  // The racer's own view, in the racer's session.
  await test.step('Solo sees a Refunded badge on the deposit', async () => {
    await page.goto(`/register/teams/${soloId}`);
    await expect(feeRow(page, 'Cart Deposit').getByText('Refunded', { exact: true })).toBeVisible();
    await expect(feeRow(page, 'Race Registration').getByText('Refunded', { exact: true })).toHaveCount(0);
  });

  await test.step('Pair shows both fees as refunded', async () => {
    await page.goto(`/register/teams/${pairId}`);
    const fee = page.getByRole('group', { name: 'Registration fee' });
    // A refund does not change the paid total; each refunded fee gets a line.
    await expect(fee.getByText('Paid $218 total')).toBeVisible();
    await expect(fee.getByText('Cart Deposit: refunded')).toBeVisible();
    await expect(fee.getByText('Race Registration: refunded')).toBeVisible();
  });

  if (target.checkEmail) {
    await test.step('Each refund was emailed once', async () => {
      const soloMail = await waitForEmail({ to: email, subjectIncludes: `${REFUND_SUBJECT} ${solo}` });
      expect(soloMail.subject).toContain(raceName);
      expect(soloMail.text).toContain('$88');
      await expect
        .poll(() => countEmails({ to: email, subjectIncludes: `${REFUND_SUBJECT} ${pair}` }), { timeout: 90_000 })
        .toBe(2);
      // Give a duplicate time to land, then check nothing extra was sent.
      await page.waitForTimeout(5_000);
      expect(await countEmails({ to: email, subjectIncludes: `${REFUND_SUBJECT} ${solo}` })).toBe(1);
      expect(await countEmails({ to: email, subjectIncludes: `${REFUND_SUBJECT} ${pair}` })).toBe(2);
    });
  }
});

test.afterAll(async () => {
  // The IMAP mailbox is shared; leave nothing from this run behind.
  if (target.inbox === 'imap' && target.imap) await clearInbox(target.racerEmail(`${runId()}-refund`));
});
