# Dogtag Integration Tests with Playwright

This directory contains end-to-end integration tests for the Dogtag application using Playwright.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Playwright Browsers

```bash
npx playwright install
```

## SPA end-to-end suite (`tests/spa/`)

These specs drive the React registration app at `/register` and check the emails Rails sends.

Prerequisites:

```bash
docker compose up -d db redis mailpit   # Postgres, Redis, and the Mailpit SMTP sink
```

- Mailpit receives mail on SMTP `localhost:1025`; browse the inbox at http://localhost:8025. Specs read it over its HTTP API via `tests/helpers/mailpit.ts` (`clearInbox`, `waitForEmail`, `countEmails`).
- `playwright.config.ts` boots Rails (development environment, port 3099) with `APP_HOST=localhost:3099`, `SIDEKIQ_INLINE=true` (jobs run in-process, no Sidekiq worker needed), `REGISTRATION_UI=spa` and `SMTP_HOST=localhost SMTP_PORT=1025`. `VITE_DEV_SERVER` is intentionally unset so Rails serves the built SPA. An already-running server on the port is reused, so stop any dev server started without these variables.
- `tests/global-setup.ts` builds the SPA (`npm --prefix frontend ci` if `frontend/node_modules` is missing, then `npm --prefix frontend run build`). Set `SPA_BUILD=skip` to reuse the existing `public/register` build.

```bash
npx playwright test tests/spa                 # just the SPA suite
SPA_BUILD=skip npx playwright test tests/spa  # skip the frontend build
```

Specs (each seeds its own data with a `test_seeds:*` task and unique emails, and sweeps it with `test_seeds:cleanup`):

- **`full-registration.spec.ts`** (`test_seeds:spa_registration`): sign up, welcome email, create a team, add racers, answer questions, mock pay, "You're in!", confirmation email.
- **`past-racers.spec.ts`** (`test_seeds:past_racers`): a captain with a 2025 team picks a past racer chip, the form pre-fills, Save fills the slot.
- **`password-reset.spec.ts`** (`test_seeds:password_reset`): request a reset in the SPA, follow the emailed link to the legacy reset page, log in through the SPA.
- **`reminder.spec.ts`** (`test_seeds:reminder`): a race closing in 23 hours; `Workers::RegistrationReminders` sends one reminder and is idempotent.

## Running Tests

### Local Development

1. **Seed the test database:**

```bash
bundle exec rails test_seeds:basic
```

This creates:
- Admin user: `test+admin@example.com` / `password123`
- Captain user: `test+captain@example.com` / `password123`
- Fifth user: `test+fifth@example.com` / `password123`
- An open race
- A team with 4/5 people

2. **Run tests:**

```bash
# Run all tests (headless)
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Run tests in debug mode
npm run test:debug

# Run tests with UI mode (interactive)
npm run test:ui
```

### Against Staging or Production

Set the `BASE_URL` environment variable:

```bash
# Against staging
BASE_URL=https://dogtag-staging.herokuapp.com npm test

# Against production (be careful!)
BASE_URL=https://dogtag.herokuapp.com npm test
```

**Note:** Before running tests against deployed environments, seed the test data:

```bash
# Staging
heroku run rails test_seeds:basic -r staging

# Production (use with caution!)
heroku run rails test_seeds:basic -r heroku
```

## Test Structure

### Current Tests

- **`spa/*.spec.ts`**: SPA registration, past racers, password reset and reminder emails (see above).
- **`user-joins-team.spec.ts`**: Tests the happy path where a 5th user joins a team with 4 members, triggering team finalization.

### Writing New Tests

1. Create a new `.spec.ts` file in the `tests/` directory
2. Import Playwright test utilities:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Write your test using `test.describe` and `test` blocks
4. Use `test.step` for clear test organization

Example:
```typescript
test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await test.step('Step 1', async () => {
      await page.goto('/');
      // assertions
    });
  });
});
```

## Cleanup

After running tests, clean up test data:

```bash
# Local
bundle exec rails test_seeds:cleanup

# Staging
heroku run rails test_seeds:cleanup -r staging
```

## Debugging

### View Test Report

After running tests, view the HTML report:

```bash
npx playwright show-report
```

### Screenshots

Failed tests automatically capture screenshots in `test-results/`

### Traces

View trace files for failed tests:

```bash
npx playwright show-trace test-results/path-to-trace.zip
```

## CI/CD Integration

To run tests in CI:

```bash
# Install dependencies
npm ci
npx playwright install --with-deps

# Services: Postgres, Redis, and Mailpit (SMTP on 1025, API on 8025)
# Build the SPA (or let tests/global-setup.ts do it): npm --prefix frontend ci && npm --prefix frontend run build

# Seed test data
bundle exec rails test_seeds:basic

# Run tests
npm test

# Cleanup
bundle exec rails test_seeds:cleanup
```

## Configuration

Edit `playwright.config.ts` to:
- Change test timeout
- Add more browsers (Firefox, Safari)
- Modify retry logic
- Configure reporters
- Set base URL
- Change the environment the Rails server boots with (`serverEnv`)

## Common Issues

### Port Already in Use

If port 3000 is already in use, Playwright will reuse the existing server.

### Test Data Conflicts

Always run `test_seeds:cleanup` between test runs to avoid data conflicts.

### Flaky Tests

Use Playwright's auto-waiting features. Avoid manual waits:

```typescript
// ❌ Bad
await page.waitForTimeout(1000);

// ✅ Good
await expect(page.getByText('Success')).toBeVisible();
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Test Selectors](https://playwright.dev/docs/locators)
