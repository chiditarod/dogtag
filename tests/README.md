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

Specs (each seeds its own data with a `test_seeds:*` task and unique emails; the rows are removed by `test_seeds:cleanup` at the next global setup, not by the spec itself):

- The full sign-up to "You're in!" flow (welcome email, team, racers, questions, both fees, confirmation email) is `tests/e2e/registration.spec.ts`, run with `npm run e2e` (it uses the race the `race-setup` project creates, not a seed).
- **`past-racers.spec.ts`** (`test_seeds:past_racers`): a captain with a 2025 team picks a past racer in the crew picker, confirms the seven details, and the slot is filled.
- **`buddy-picker.spec.ts`** (`test_seeds:buddy_picker`): the Questions card opens with the same-route Yes/No question unanswered (Save says "Choose Yes or No"); both info tips open by tap and keyboard; Yes reveals the race's other teams in case-insensitive alphabetical order with `Other…` last, No hides them and Yes brings the draft picks back; the captain ticks two teams plus `Other…` with free text, saves, and finds them selected after a reload; unticking `Other…` and saving clears the text; saving No clears every pick (checked through the questions API).
- **`guided-tour.spec.ts`** (`test_seeds:past_racers`): the team page opens the guided tour by itself, `Next` walks the three stops (that race has no questions and no fee), `Done` ends it for good (it stays closed after a reload), and `Take the tour` replays it. It clears the `dogtag:tour:off` switch that `playwright.config.ts` sets for every other spec.
- **`password-reset.spec.ts`** (`test_seeds:password_reset`): request a reset in the SPA, follow the emailed link to the legacy reset page, log in through the SPA.
- **`race-list-order.spec.ts`** (`test_seeds:race_list_order`): the race list shows open races first, then waitlist, registration-over and not-yet-open races (the seeded race dates run in the opposite order) with the right badges and start links; a logged-in captain also sees their teams (status chip, `Start another team`) on the tiles of the races they joined, and none on the others.
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

### Running against staging

The registration flow (`tests/e2e/`) can run against `https://dogtag-staging.herokuapp.com`. It creates its own race (`Race E2E <runId> <UTC start>Z`) through the admin UI, registers a team with a real Stripe test-card payment, optionally checks the emails over IMAP and the Classy fundraising team, and retires the race afterwards. Put the settings in `.env.e2e` (gitignored; never commit it or put it in CI):

| Key | Purpose |
|---|---|
| `E2E_EMAIL_BASE` | Test mailbox (`user@domain`). Racers are plus-addressed: `<user>+<runId>@<domain>` |
| `E2E_IMAP_PASSWORD` | Mailbox password; needed only with `E2E_CHECK_EMAIL=1` |
| `E2E_OPERATOR_EMAIL`, `E2E_OPERATOR_PASSWORD` | Staging **operator** login used to create the race. Never an admin |
| `CLASSY_CLIENT_ID`, `CLASSY_CLIENT_SECRET`, `E2E_CLASSY_CAMPAIGN_ID` | Classy check; used only with `E2E_CHECK_CLASSY=1`, which then requires all three. The campaign must be on the allowlist in `target.ts` (867400) |

The suite never logs in as an admin, so admin credentials do not belong in `.env.e2e`. `bin/rails staging:seed` (run on the staging dyno, not by the suite) reads its own `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and `SEED_PASSWORD` (optional `SEED_EMAIL_BASE`, `SEED_CLASSY_CAMPAIGN_ID`); pass those to that command, not to Playwright.

```bash
npm run e2e                  # local: mock payments, Mailpit (unit + registration projects)
npm run e2e:stripe           # local: real Stripe test-card payment
E2E_CHECK_EMAIL=1 npm run e2e:staging   # staging: Stripe test card, IMAP email check when E2E_CHECK_EMAIL=1
E2E_CHECK_CLASSY=1 npm run e2e          # any target: also check (then delete) the Classy fundraising team
E2E_TARGET=staging npx playwright test --project=live   # live IMAP and Classy specs
```

The Classy check runs only with `E2E_CHECK_CLASSY=1`, on either target; having the credentials is not enough. It gives the race the Classy campaign, so the server under test creates a real Classy member for the racer and a real fundraising team (the suite deletes the team; the member stays). Locally, the Rails server then gets the Classy credentials from `.env.e2e`; without the flag the local race has no campaign, so the Classy keys in `.env` do nothing. A Rails server already running on the test port is reused as is, so stop it first.

What the guard refuses (`tests/e2e/target.ts`; the lists are hard-coded and no environment variable extends them):

- Any host that is not `localhost`, `127.0.0.1` or `dogtag-staging.herokuapp.com`, and always `dogtag.chiditarod.org`, `dogtag.herokuapp.com` and `*.chiditarod.org`. The `BASE_URL` host is parsed with `URL` (case, trailing dot, userinfo and ports are handled) and must belong to the chosen `E2E_TARGET`; staging must be https.
- Paying when the race's Stripe publishable key does not start with `pk_test_` (this includes mock mode).
- A Classy campaign other than the allowlisted one; only teams named `Test Team E2E *` are ever deleted.
- A missing required variable (the error names the variable, never its value).

The race is retired, not deleted: its dates move into the past and ` [retired]` is appended to its name. A run that was interrupted leaves an open `Race E2E *` race. The next run retires it first once it is two hours old (the UTC start time is in the name), so two runs at the same time leave each other's races alone. On staging, the registration project (like race setup and teardown) keeps no trace or video, because they would hold the test mailbox address and the racer's password; a failure screenshot can still show the address and stays in the local, gitignored `test-results/`. Teardown also deletes `playwright/.auth/staff.json`. The suite never calls Heroku (no CLI, API or `heroku run`). The legacy specs and the seed-based `tests/spa` specs are local only (the `local-suite` project is omitted on staging), because they need `test_seeds:*` Rails tasks.

### Seed tasks and deployed environments

`test_seeds:*` tasks (including `cleanup`, which deletes by name/email pattern) abort when `RAILS_ENV=production` unless `ALLOW_TEST_SEEDS_IN_PRODUCTION=true` is set. Never run them against production, and the e2e suite never runs them against staging.

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

# Staging: the registration suite retires its own race, no cleanup needed
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
