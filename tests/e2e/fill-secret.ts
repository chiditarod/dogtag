/**
 * Types a value into an input without echoing it into the Playwright report.
 *
 * Playwright titles every fill step `Fill "<value>"`, and the HTML reporter
 * keeps step titles for passed tests too, so `locator.fill(secret)` writes the
 * secret into playwright-report/. This sets the value inside the page instead
 * (that step is titled just "Evaluate"). It goes through the native value
 * setter and dispatches input and change, so React-controlled inputs (the SPA)
 * see the change as well as plain Rails forms.
 *
 * Use it for passwords, operator logins and private mailbox addresses.
 */
import { expect, type Locator } from '@playwright/test';

export async function fillSecret(locator: Locator, value: string): Promise<void> {
  await locator.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    input.focus();
    if (setter) setter.call(input, v);
    else input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  // Compares in the page and reports only pass/fail, never the value.
  const matches = await locator.evaluate((el, v) => (el as HTMLInputElement).value === v, value);
  expect(matches, 'secret field holds the value').toBe(true);
}
