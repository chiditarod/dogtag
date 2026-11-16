import { defineConfig, devices } from '@playwright/test';
import { TEST_PORT, serverEnv } from './tests/helpers/server-env';
import { e2eFileKeys, target } from './tests/e2e/run';
import { assertHostAllowed } from './tests/e2e/target';

// A bad target fails here, before any project or server starts.
assertHostAllowed(target.baseURL);

const staging = target.name === 'staging';
const STAFF_STATE = 'playwright/.auth/staff.json';

/** The local Rails server must not inherit staging secrets (Classy, IMAP, ...) that .env.e2e adds to process.env. */
function localServerEnv(): Record<string, string> {
  const env = serverEnv();
  for (const key of e2eFileKeys) delete env[key];
  return env;
}

// The test port (default 3099, override with TEST_PORT) and the Rails server
// environment (APP_HOST, SIDEKIQ_INLINE, REGISTRATION_UI, SMTP_*) live in
// tests/helpers/server-env.ts, shared with the specs.

/**
 * Playwright configuration for Dogtag integration tests
 *
 * Key behaviors:
 * - WebServer boots ONCE before all tests and stays running
 * - Tests run SEQUENTIALLY (one at a time, no parallelism)
 * - Each test file seeds its own data in beforeAll
 * - Global setup cleans stale test data before suite starts
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  /* Global setup runs once before all tests - cleans database */
  globalSetup: './tests/global-setup.ts',

  /* No parallel execution - tests run one at a time */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: staging ? 0 : process.env.CI ? 2 : 0,

  /* Single worker - ensures sequential execution */
  workers: 1,

  /* Longer timeout for tests that seed data (default 30s is too short) */
  timeout: 120 * 1000, // 2 minutes per test

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: target.baseURL,

    /* The team page opens its guided tour by itself, which would sit on top of
       every spec. This switches it off; tests/spa/guided-tour.spec.ts clears it. */
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(target.baseURL).origin,
          localStorage: [{ name: 'dogtag:tour:off', value: '1' }],
        },
      ],
    },

    /* Keep trace and video of failures only */
    trace: 'retain-on-failure',
    video: 'retain-on-failure',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Longer navigation timeout */
    navigationTimeout: 30 * 1000,
  },

  /* Projects. local-suite is the legacy and seed-based SPA specs; it is
     omitted on staging, where Rails commands are not available. */
  projects: [
    { name: 'unit', testMatch: /\.unit\.spec\.ts$/, use: { ...devices['Desktop Chrome'] } },
    {
      // Logs in as the operator once. No recordings: the login carries a password.
      name: 'admin-auth',
      testMatch: /admin-auth\.setup\.ts$/,
      use: { ...devices['Desktop Chrome'], trace: 'off', video: 'off', screenshot: 'off' },
    },
    {
      name: 'race-setup',
      testMatch: /race-setup\.spec\.ts$/,
      dependencies: ['admin-auth'],
      teardown: 'race-teardown',
      use: { ...devices['Desktop Chrome'], storageState: STAFF_STATE },
    },
    {
      name: 'race-teardown',
      testMatch: /race-teardown\.ts$/,
      use: { ...devices['Desktop Chrome'], storageState: STAFF_STATE },
    },
    {
      name: 'registration',
      // Anchored: an unanchored pattern would also match user-registration.spec.ts.
      testMatch: /(^|[\\/])registration\.spec\.ts$/,
      dependencies: ['race-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    // Each live spec skips itself when its env vars are not set.
    { name: 'live', testMatch: /\.live\.spec\.ts$/, use: { ...devices['Desktop Chrome'] } },
    ...(staging
      ? []
      : [
          {
            name: 'local-suite',
            testMatch: [/tests[\\/][^\\/]+\.spec\.ts$/, /tests[\\/]spa[\\/][^\\/]+\.spec\.ts$/],
            use: { ...devices['Desktop Chrome'] },
          },
        ]),
  ],

  /* Run your local dev server ONCE before all tests (never against staging) */
  webServer: target.startServer
    ? {
        command: `bundle exec rails server -u webrick -p ${TEST_PORT}`,
        url: `http://localhost:${TEST_PORT}`,
        env: localServerEnv(),
        reuseExistingServer: true, // Always reuse if server already running (it must have the env above)
        timeout: 120 * 1000, // 2 minutes for server startup
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,
});
