/**
 * Payment adapter for the registration spec: mock payments locally, or the
 * legacy Stripe Checkout (checkout.js) popup with a Stripe test card.
 *
 * Pure of run.ts so the unit project can import assertTestKey without
 * resolving a target. Never logs a full key: errors name only its prefix.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import type { PaymentMode } from './target';

const TEST_KEY_PREFIX = 'pk_test_';

/** Throws unless the race's Stripe publishable key is a test key. Call before any payment click. */
export function assertTestKey(key: string | undefined): void {
  if (key?.startsWith(TEST_KEY_PREFIX)) return;
  throw new Error(`Refusing to pay: publishable key is ${(key ?? '').slice(0, 8)}…, not ${TEST_KEY_PREFIX}`);
}

/** Fills the checkout.js popup with the Stripe success test card and submits it. */
async function payWithStripeCheckout(page: Page): Promise<void> {
  const frame = page.frameLocator('iframe[name^="stripe_checkout"]').first();
  const card = frame.getByPlaceholder('Card number');
  await expect(card).toBeVisible({ timeout: 30_000 });

  // checkout.js is opened with the captain's email; fill it only if it shows up empty.
  const email = frame.getByPlaceholder('Email');
  if ((await email.isVisible()) && (await email.inputValue()) === '') {
    const me = await page.request.get('/api/v1/me');
    expect(me.status()).toBe(200);
    await email.fill((await me.json()).user.email);
  }

  await card.fill('4242424242424242');
  await frame.getByPlaceholder('MM / YY').pressSequentially('12 / 34', { delay: 50 });
  await frame.getByPlaceholder('CVC').fill('123');
  await frame.getByRole('button', { name: /^Pay/ }).click();
}

/**
 * Pays one fee from its list item in the "Registration fee" group and waits
 * for it to show as paid. The caller must have run assertTestKey on the race.
 */
export async function payFee(page: Page, feeItem: Locator, amountLabel: string, mode: PaymentMode): Promise<void> {
  if (mode === 'mock') {
    await feeItem.getByRole('button', { name: 'Mock pay' }).click();
  } else {
    await feeItem.getByRole('button', { name: `Pay ${amountLabel}` }).click();
    await payWithStripeCheckout(page);
  }
  // Paying the last fee collapses the fee list into one "Paid $N total" line,
  // so the fee's own "Paid" row only shows while another fee is still due.
  const paid = feeItem.getByText(`Paid ${amountLabel}`);
  const allPaid = page.getByRole('group', { name: 'Registration fee' }).getByText(/^Paid \$[\d,.]+ total$/);
  await expect(paid.or(allPaid)).toBeVisible({ timeout: 60_000 });
}
