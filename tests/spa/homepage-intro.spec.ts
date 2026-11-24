import { test, expect } from '@playwright/test';
import { seed, type Seed } from '../helpers/seed';

/**
 * The /register landing explains registration: a one-line summary and a toggle below lg,
 * the tagline and the open steps beside the race list from lg.
 */

interface Credentials {
  race_name: string;
}

let seeded: Seed<Credentials>;

const noSidewaysScroll = async (page: import('@playwright/test').Page, width: number) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

const tagline = "Chicago's annual urban shopping-cart race and mobile food drive.";
const toggleName = 'How registration and the waitlist work';

test.describe('SPA homepage intro', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('homepage_intro');
  });
  test.afterAll(() => seeded.dispose());

  test('at 320px the intro summarises, the toggle reveals the steps, and nothing scrolls sideways', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: seeded.credentials.race_name })).toBeVisible();

    await expect(page.getByText('add 3 racers', { exact: false })).toBeVisible();
    await expect(page.getByText(tagline)).toBeHidden();
    await expect(page.getByText('Add all 3 racers.')).toBeHidden();
    await noSidewaysScroll(page, 320);

    const toggle = page.getByRole('button', { name: toggleName });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Add all 3 racers.')).toBeVisible();
    await expect(page.getByText(/teams that haven't finished go on the waitlist/)).toBeVisible();
    await noSidewaysScroll(page, 320);
  });

  test('at 1280px the intro sits left of the race list with the steps open', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: seeded.credentials.race_name })).toBeVisible();

    await expect(page.getByText(tagline)).toBeVisible();
    await expect(page.getByRole('button', { name: toggleName })).toBeHidden();
    const step = page.getByText('Add all 3 racers.');
    await expect(step).toBeVisible();

    const intro = page.getByRole('region', { name: 'Register for CHIditarod' });
    const introBox = await intro.boundingBox();
    const listBox = await page.getByRole('heading', { name: 'Choose your race' }).boundingBox();
    expect(introBox).not.toBeNull();
    expect(listBox).not.toBeNull();
    expect(introBox!.x + introBox!.width).toBeLessThanOrEqual(listBox!.x);
    await noSidewaysScroll(page, 1280);
  });
});
