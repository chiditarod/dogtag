# E2E Registration (local + staging) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a target-aware Playwright suite with three parts:
- An admin creates a race through the admin UI.
- A new racer registers through `/register`, fills 5 roster slots, answers the
  JSONForm, pays 2 fees and reaches "You're in!".
- Optional email and Classy checks.

It runs locally with mock payments and Mailpit, and against staging with Stripe
test mode and IMAP. A guard keeps it away from production.

**Architecture:**
- `tests/e2e/target.ts` resolves `E2E_TARGET` into one `Target` object and
  enforces a host denylist and allowlist when `playwright.config.ts` loads.
- Playwright projects are chained: `admin-auth` → `race-setup` (with a
  `race-teardown`) → `registration`.
- Side services sit behind small adapters, so the test bodies are identical on
  both targets:
  - payment: mock or Stripe `checkout.js`;
  - inbox: Mailpit or IMAP;
  - Classy: called directly over HTTP.
- The existing legacy and seed-based SPA specs keep running unchanged as the
  `local-suite` project.

**Tech Stack:**
- Playwright `@playwright/test` (existing).
- TypeScript test helpers, plus `dotenv` (existing).
- New root devDependencies `imapflow` and `mailparser`, called out in the PR.
- Rails 8 / RSpec for two small app changes.

**Spec:** `docs/superpowers/specs/2026-11-16-e2e-registration-local-and-staging-design.md`

## Global Constraints

- **Security amendments (owner-approved 2026-11-16):**
  - **Staff login is an operator, not an admin.** The tests never use an admin
    account. If an admin-UI step is forbidden for operators, stop and report it;
    do not fall back to admin.
  - **Classy campaign allowlist:** `ALLOWED_CLASSY_CAMPAIGNS = [867400]`,
    hard-coded in `target.ts`. Any other `E2E_CLASSY_CAMPAIGN_ID` is an error.
    Deleting a Classy team requires its name to start with `Test Team E2E ` and
    its campaign to be on the allowlist.
  - **Recording hygiene:**
    - The `admin-auth` project runs with `trace: 'off'`, `video: 'off'` and
      `screenshot: 'off'`.
    - Classy and IMAP calls use Node (`fetch` and `imapflow`), never
      Playwright's `request` fixture, so they never land in traces.
    - `race-teardown` deletes `playwright/.auth/staff.json` after retiring the
      race.
    - Staging secrets never go into CI.
  - **Supply chain:** new devDependencies are added with `--save-exact`, and
    `package-lock.json` is committed.
- **Allowed and denied hosts:**
  - Allowlist, hard-coded: `localhost`, `127.0.0.1`,
    `dogtag-staging.herokuapp.com`.
  - Denylist, checked first: `dogtag.chiditarod.org`, `dogtag.herokuapp.com`,
    `*.chiditarod.org`.
  - No environment variable can extend either list.
- **No Heroku as a test dependency:** no `heroku` CLI, no Heroku API and no
  `heroku run` anywhere in `tests/`.
- **Payments:**
  - Never pay unless the target race's `stripe_publishable_key` starts with
    `pk_test_`. This holds in mock mode too.
  - Staging: `payments = 'stripe'` only, `retries: 0`, `workers: 1`.
- **Secrets:** load `.env.e2e` with `dotenv`, which strips the quotes around the
  password. Never log secret values. A missing required var fails fast and names
  the variable.
- **Staging racer email:** `<user>+<runId>@<domain>`, built from
  `E2E_EMAIL_BASE`. Local racer email: `e2e+<runId>@example.com`.
- **Test data names:**
  - Race: `Race E2E <runId>`. The `Race ` prefix keeps local `test_seeds:cleanup`
    matching it.
  - Retired race: `Race E2E <runId> [retired]`.
  - Team: `Test Team E2E <runId>`.
- **Race values:**
  - Time zone `America/Chicago`, 5 people per team, max teams 50.
  - Registration opened 1 day ago and closes in 14 days. Final edits close in 14
    days and 1 hour (`RaceValidator` rejects final edits closing at registration
    close). The race is in 30 days.
- **Fees:**
  - "Cart Deposit": one tier at $88 (8800 cents) that begins at registration
    open.
  - "Race Registration": $130 (13000) beginning at registration open, then $150
    (15000) beginning in 7 days.
- **JSONForm fixture:** `tests/e2e/fixtures/jsonform.json`, a copy of
  `frontend/src/features/questions/__fixtures__/chiditarod_21.json`.
- **Legacy flow:**
  - The legacy specs and the legacy HAML flow keep working.
  - `tests/*.spec.ts` and the seed-based `tests/spa/{past-racers,password-reset,reminder}.spec.ts`
    are unchanged and still run in `npm test` and CI.
- **Rails conventions (CLAUDE.md):**
  - `params.expect`, double quotes, and specs that assert on status plus data.
  - Ask before touching Gemfile, `config/initializers`, `config/environments`,
    `config/application.rb` or `spec/spec_helper.rb`. This plan needs none of
    them.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  The PR body ends with the Claude Code line. The PR goes to `chiditarod/dogtag`
  from branch `test/e2e-staging` (rebase onto `test/e2e-staging-design`, which
  holds the spec).

## Review Focus

1. **Host tricks in `BASE_URL`:** upper case, a trailing dot, a port, userinfo
   (`https://dogtag-staging.herokuapp.com@dogtag.chiditarod.org/`) or a non-https
   staging URL. Expected: the hostname is parsed with `URL`, lower-cased and has
   its trailing dot stripped. Any denylisted host is refused. Pinned in Task 3.
2. **A live publishable key on the target race:** `payFee` throws before any
   click, naming the key prefix. Pinned in Task 8 (`assertTestKey`).
3. **An interrupted staging run leaves an open `Race E2E *` race:** the next run
   sweeps it before creating its own. Pinned in Task 7 (sweep test).
4. **IMAP mailbox shared with other mail:** `clearInbox` deletes only messages to
   this run's address. Mail that landed in Junk/Spam fails with that folder's
   name. Pinned in Task 5.
5. **Runner clock zone differs from the race zone** (CI is UTC; DST): the
   datetime selects are filled in `America/Chicago` wall-clock time. The API's
   `registration_open` equals the intended instant within 60 s. Pinned in Task 7.

---

## File structure

- **Create:**
  - `tests/e2e/target.ts`: the `Target` type, `resolveTarget` and
    `assertHostAllowed`.
  - `tests/e2e/target.unit.spec.ts`
  - `tests/e2e/run.ts`: the run id and the race state file.
  - `tests/e2e/inbox.ts`: one interface over the Mailpit and IMAP backends.
  - `tests/e2e/imap.ts`
  - `tests/e2e/inbox.unit.spec.ts`
  - `tests/e2e/imap.live.spec.ts`
  - `tests/e2e/fixtures/welcome.eml`
  - `tests/e2e/classy.ts`, `tests/e2e/classy.live.spec.ts`
  - `tests/e2e/admin-forms.ts`
  - `tests/e2e/admin-auth.setup.ts`
  - `tests/e2e/race-setup.spec.ts`, `tests/e2e/race-teardown.ts`
  - `tests/e2e/payments.ts`
  - `tests/e2e/registration.spec.ts`
  - `tests/e2e/fixtures/jsonform.json`
  - `tests/helpers/links.ts`: `extractLinks`, moved out of `mailpit.ts`.
- **Modify:**
  - `app/models/requirement.rb`, `spec/models/requirement_spec.rb`,
    `spec/controllers/requirements_controller_spec.rb`
  - `app/views/user_sessions/_form.html.haml`
  - `playwright.config.ts`, `tests/global-setup.ts`, `tests/helpers/mailpit.ts`
    (import `extractLinks`)
  - `package.json` (scripts and devDependencies), `.circleci/config.yml`,
    `tests/README.md`, `CLAUDE.md`
- **Delete:** `tests/spa/full-registration.spec.ts`, superseded by
  `registration.spec.ts`.

---

### Task 1: Mock payment requirement type outside production

**Files:**
- Modify: `app/models/requirement.rb:26-31`
- Test: `spec/models/requirement_spec.rb:24-28`,
  `spec/controllers/requirements_controller_spec.rb`

**Interfaces:**
- Produces: `Requirement.allowed_types` returns
  `[["Payment","PaymentRequirement"]]` in production, plus
  `["Mock payment","MockPaymentRequirement"]` otherwise. The admin requirement
  form's Type select shows "Mock payment" locally. Task 7 selects it by that
  label.

- [ ] **Step 1: Write the failing tests.** Replace the existing `#allowed_types`
  example. Add the controller example next to the existing `create` examples
  (admin login helper as in that file).

```ruby
describe ".allowed_types" do
  it "offers only real payments in production" do
    allow(Rails.env).to receive(:production?).and_return(true)
    expect(Requirement.allowed_types).to eq([["Payment", "PaymentRequirement"]])
  end

  it "also offers mock payments outside production" do
    expect(Requirement.allowed_types).to include(["Mock payment", "MockPaymentRequirement"])
  end
end
```

```ruby
it "creates a MockPaymentRequirement when an admin picks the mock type" do
  expect {
    post :create, params: { race_id: race.id, requirement: { name: "Cart Deposit", type: "MockPaymentRequirement" } }
  }.to change(MockPaymentRequirement, :count).by(1)
  expect(response).to have_http_status(:redirect)
end
```

Also add, in `spec/models/requirement_spec.rb`, the server-side check (security
fix 5). Today `permit(:name, :type)` plus STI accepts any subclass:

```ruby
it "rejects a mock requirement in production" do
  allow(Rails.env).to receive(:production?).and_return(true)
  requirement = Requirement.new(name: "Fee", type: "MockPaymentRequirement", race: FactoryBot.create(:race))
  expect(requirement).not_to be_valid
  expect(requirement.errors[:type]).to be_present
end
```

- [ ] **Step 2: Run** `bundle exec rspec spec/models/requirement_spec.rb spec/controllers/requirements_controller_spec.rb`.
  Expected: the new examples FAIL.
- [ ] **Step 3: Implement.**
  - `allowed_types` returns `ALLOWED_TYPES` in production, and
    `ALLOWED_TYPES + [["Mock payment", "MockPaymentRequirement"]]` otherwise.
  - Add `validates :type, inclusion: { in: ->(_) { Requirement.allowed_types.map(&:last) } }`
    to `Requirement`.
  - If `RequirementsController#create` rejects types that aren't in
    `allowed_types`, it must accept the mock type outside production. Check its
    `params.expect` and type handling, and change only what the test needs.
- [ ] **Step 4: Run** the command from Step 2. Expected: PASS. Then run
  `bundle exec rspec spec/models spec/controllers`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `Validate requirement type; offer MockPaymentRequirement outside production`

### Task 2: Labels on the legacy login fields

**Files:**
- Modify: `app/views/user_sessions/_form.html.haml:15-21`
- Test: `spec/requests/user_sessions_spec.rb` (create it if absent)

**Interfaces:**
- Produces: on `/user_session/new`, `getByLabel("Email")` and
  `getByLabel("Password")` resolve to `user_session[email]` and
  `user_session[password]`. Task 7 uses them.

- [ ] **Step 1: Write the failing test.**

```ruby
RSpec.describe "Login page", type: :request do
  it "labels the email and password fields" do
    get "/user_session/new"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include('<label class="sr-only" for="user_session_email">Email</label>')
    expect(response.body).to include('<label class="sr-only" for="user_session_password">Password</label>')
  end
end
```

- [ ] **Step 2: Run** `bundle exec rspec spec/requests/user_sessions_spec.rb`.
  Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add `= f.label :email, "Email", class: "sr-only"` and
    `= f.label :password, "Password", class: "sr-only"` before each field.
    Bootstrap 3's `sr-only` hides them visually, so the page looks the same.
  - Admin and login pages are not translated, so plain strings are fine.
- [ ] **Step 4: Run** Step 2's spec, then `npx playwright test tests/password-reset.spec.ts tests/user-registration.spec.ts`.
  Expected: PASS, and the legacy flow is unchanged.
- [ ] **Step 5: Commit.** Message: `Label the login form's email and password fields`

### Task 3: Target resolution and the host guard

**Files:**
- Create: `tests/e2e/target.ts`
- Test: `tests/e2e/target.unit.spec.ts` (a Playwright test with no `page`
  fixture; it runs in the `unit` project from Task 4)

**Interfaces:**
- Produces:

```ts
export type TargetName = 'local' | 'staging';
export type PaymentMode = 'mock' | 'stripe';
export interface Target {
  name: TargetName;
  baseURL: string;
  startServer: boolean;                      // local only
  payments: PaymentMode;
  requirementType: 'MockPaymentRequirement' | 'PaymentRequirement';
  staff: { email: string; password: string };   // an operator, not an admin
  racerEmail(runId: string): string;
  inbox: 'mailpit' | 'imap';
  checkEmail: boolean;                       // E2E_CHECK_EMAIL === '1'
  imap: { host: string; port: number; user: string; password: string } | null;
  classy: { clientId: string; clientSecret: string; campaignId: number } | null;
}
export const ALLOWED_HOSTS: readonly string[];
export const DENIED_HOSTS: readonly string[];          // exact hosts
export const DENIED_SUFFIXES: readonly string[];       // ['.chiditarod.org']
export const ALLOWED_CLASSY_CAMPAIGNS: readonly number[]; // [867400]
export function assertHostAllowed(url: string): void;  // throws Error
export function resolveTarget(env: Record<string, string | undefined>): Target;
```

- **Local defaults:**
  - `baseURL` is `http://localhost:${TEST_PORT}` (`TEST_PORT` comes from
    `tests/helpers/server-env.ts`).
  - The staff login is `test+operator@example.com` / `password123`, from the
    new `test_seeds:operator` task (Task 4).
- **Staging staff login:** `E2E_OPERATOR_EMAIL` / `E2E_OPERATOR_PASSWORD`. That's
  the seeded operator Olive, created by `staging:seed`.
  - `inbox` is `mailpit`.
  - `imap` is null.
- **Staging:** `imap` is `{ host: 'monday.mxrouting.net', port: 993, user:
  E2E_EMAIL_BASE, password: E2E_IMAP_PASSWORD }`. It is required only when
  `E2E_CHECK_EMAIL=1`.
- **`classy`:** null unless all of `CLASSY_CLIENT_ID`, `CLASSY_CLIENT_SECRET`
  and `E2E_CLASSY_CAMPAIGN_ID` are set.

- [ ] **Step 1: Write the failing tests.**

```ts
import { test, expect } from '@playwright/test';
import { assertHostAllowed, resolveTarget } from './target';

const staging = {
  E2E_TARGET: 'staging',
  E2E_EMAIL_BASE: 'tests@mail.test',
  E2E_OPERATOR_EMAIL: 'a@x.test',
  E2E_OPERATOR_PASSWORD: 'pw',
};

test.describe('assertHostAllowed', () => {
  for (const url of [
    'https://dogtag.chiditarod.org',
    'https://DOGTAG.chiditarod.org./',
    'https://dogtag.herokuapp.com',
    'https://www.chiditarod.org',
    'https://dogtag-staging.herokuapp.com@dogtag.chiditarod.org/',
  ]) {
    test(`denies ${url}`, () => expect(() => assertHostAllowed(url)).toThrow(/denylist/));
  }
  test('refuses hosts not on the allowlist', () =>
    expect(() => assertHostAllowed('https://example.com')).toThrow(/allowlist/));
  test('allows staging, localhost and 127.0.0.1 with ports', () => {
    for (const url of ['https://dogtag-staging.herokuapp.com', 'http://localhost:3099', 'http://127.0.0.1:3099'])
      expect(() => assertHostAllowed(url)).not.toThrow();
  });
});

test.describe('resolveTarget', () => {
  test('defaults to local with mock payments', () => {
    const t = resolveTarget({});
    expect(t).toMatchObject({ name: 'local', payments: 'mock', requirementType: 'MockPaymentRequirement', startServer: true, inbox: 'mailpit' });
    expect(t.racerEmail('ab12')).toBe('e2e+ab12@example.com');
  });
  test('local can pay with Stripe test keys', () =>
    expect(resolveTarget({ E2E_PAYMENTS: 'stripe' })).toMatchObject({ payments: 'stripe', requirementType: 'PaymentRequirement' }));
  test('staging uses Stripe, no server, and plus-addressed racers', () => {
    const t = resolveTarget(staging);
    expect(t).toMatchObject({ name: 'staging', baseURL: 'https://dogtag-staging.herokuapp.com', payments: 'stripe', startServer: false, inbox: 'imap' });
    expect(t.racerEmail('ab12')).toBe('tests+ab12@mail.test');
  });
  test('staging refuses mock payments', () =>
    expect(() => resolveTarget({ ...staging, E2E_PAYMENTS: 'mock' })).toThrow(/E2E_PAYMENTS/));
  test('staging names each missing secret', () => {
    expect(() => resolveTarget({ E2E_TARGET: 'staging' })).toThrow(/E2E_EMAIL_BASE/);
    expect(() => resolveTarget({ ...staging, E2E_OPERATOR_PASSWORD: '' })).toThrow(/E2E_OPERATOR_PASSWORD/);
    expect(() => resolveTarget({ ...staging, E2E_CHECK_EMAIL: '1' })).toThrow(/E2E_IMAP_PASSWORD/);
  });
  test('BASE_URL may not leave the allowlist', () =>
    expect(() => resolveTarget({ ...staging, BASE_URL: 'https://dogtag.chiditarod.org' })).toThrow(/denylist/));
  test('unknown target is an error', () =>
    expect(() => resolveTarget({ E2E_TARGET: 'production' })).toThrow(/E2E_TARGET/));
  test('classy campaign must be on the allowlist', () =>
    expect(() => resolveTarget({ CLASSY_CLIENT_ID: 'x', CLASSY_CLIENT_SECRET: 'y', E2E_CLASSY_CAMPAIGN_ID: '999' })).toThrow(/campaign/));
  test('classy is null unless fully configured', () => {
    expect(resolveTarget({ CLASSY_CLIENT_ID: 'x' }).classy).toBeNull();
    expect(resolveTarget({ CLASSY_CLIENT_ID: 'x', CLASSY_CLIENT_SECRET: 'y', E2E_CLASSY_CAMPAIGN_ID: '867400' }).classy)
      .toEqual({ clientId: 'x', clientSecret: 'y', campaignId: 867400 });
  });
  test('error messages never contain secret values', () => {
    try { resolveTarget({ ...staging, E2E_CHECK_EMAIL: '1', E2E_OPERATOR_PASSWORD: 'hunter2-secret' }); } catch (e) {
      expect(String(e)).not.toContain('hunter2-secret');
    }
  });
});
```

- [ ] **Step 2: Run** `npx playwright test tests/e2e/target.unit.spec.ts --config=playwright.config.ts`
  (or with `--project=unit` once Task 4 lands). Expected: FAIL because the module
  is missing.
- [ ] **Step 3: Implement `target.ts`.**
  - Normalize the host as `new URL(u).hostname.toLowerCase().replace(/\.$/, '')`.
  - Check the denylist, then the denied suffixes, then the allowlist.
  - Messages say "denylist" or "allowlist" and include the host, but never secret
    values.
- [ ] **Step 4: Run** Step 2's command. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `E2E: target resolution with host allowlist and production denylist`

### Task 4: Playwright projects, global setup and npm scripts

**Files:**
- Modify: `playwright.config.ts`, `tests/global-setup.ts`, `package.json`
- Create: `tests/e2e/run.ts`

**Interfaces:**
- Consumes: `resolveTarget` and `assertHostAllowed` (Task 3).
- Produces:
  - In `run.ts`: `export function runId(): string` reads `E2E_RUN_ID`, which
    global setup sets once (8 hex chars from `randomUUID()`). Workers inherit
    it.
  - `export interface RaceState { raceId: number; raceName: string }`
  - `writeRaceState(s: RaceState): void` and `readRaceState(): RaceState`
    (throws if missing). They write `playwright/.state/race-<runId>.json`.
  - `export const target: Target`, resolved once in `run.ts` from `process.env`
    after `dotenv.config({ path: '.env.e2e', quiet: true })`.
- **Projects (all Desktop Chrome):**
  - `unit`: `testMatch: /\.unit\.spec\.ts$/`.
  - `admin-auth`: `testMatch: /admin-auth\.setup\.ts$/`, with
    `use: { trace: 'off', video: 'off', screenshot: 'off' }`.
  - `race-setup`: `testMatch: /race-setup\.spec\.ts$/`,
    `dependencies: ['admin-auth']`, `teardown: 'race-teardown'`, with
    `storageState: 'playwright/.auth/staff.json'`.
  - `race-teardown`: `testMatch: /race-teardown\.ts$/`, same storageState.
  - `registration`: `testMatch: /registration\.spec\.ts$/`,
    `dependencies: ['race-setup']`.
  - `live`: `testMatch: /\.live\.spec\.ts$/`. Always included. Each live spec
    calls `test.skip(!<its env>, '<VAR> not set')` at the top.
  - `local-suite`: `testMatch` is `tests/*.spec.ts` and
    `tests/spa/*.spec.ts`. It is omitted from `projects` when
    `target.name === 'staging'`.
- **Config:**
  - Call `assertHostAllowed(target.baseURL)` at top level, so a bad target fails
    before anything runs.
  - Only start `webServer` when `target.startServer`.
  - `use.baseURL = target.baseURL`, `trace: 'retain-on-failure'`,
    `video: 'retain-on-failure'`.
  - `retries` is `0` on staging and keeps the current CI behavior locally.
- **Global setup:**
  - Sets `E2E_RUN_ID`.
  - On staging, skips the SPA build and every `rails` command.
  - Locally, after `test_seeds:cleanup`, also runs
    `bundle exec rails test_seeds:operator`.
  - Add that rake task to `lib/tasks/test_seeds.rake`, mirroring
    `test_seeds:admin`. It creates `test+operator@example.com` / `password123`
    with `roles: [:operator]`, idempotently, and `cleanup` keeps it the way it
    keeps the admin.
- **npm scripts:**
  - `"e2e": "playwright test --project=unit --project=registration"`
  - `"e2e:stripe": "E2E_PAYMENTS=stripe playwright test --project=registration"`
  - `"e2e:staging": "E2E_TARGET=staging playwright test --project=unit --project=registration"`
  - `"test"` stays `playwright test`, which runs every project.

- [ ] **Step 1: Write the check.**

  `E2E_TARGET=staging BASE_URL=https://dogtag.chiditarod.org npx playwright test --list`
  should exit non-zero with "denylist" in the output.
- [ ] **Step 2: Run it** before the change. Expected: it lists tests (FAIL).
- [ ] **Step 3: Implement** the config, global setup, `run.ts` and scripts as
  described above.
- [ ] **Step 4: Verify each of these:**
  - (a) Step 1's command exits non-zero, mentions the denylist and starts no
    server.
  - (b) `npx playwright test --list` lists the unchanged legacy and SPA specs
    under `local-suite`, plus `unit`.
  - (c) `npx playwright test --project=unit` passes.
  - (d) `E2E_TARGET=staging npx playwright test --list` with
    `E2E_OPERATOR_*`/`E2E_EMAIL_BASE` unset fails, naming the missing variable.
- [ ] **Step 5: Commit.** Message: `E2E: target-aware Playwright projects and global setup`

### Task 5: One inbox interface (Mailpit locally, IMAP on staging)

**Files:**
- Create: `tests/helpers/links.ts`, `tests/e2e/imap.ts`, `tests/e2e/inbox.ts`,
  `tests/e2e/fixtures/welcome.eml`
- Modify: `tests/helpers/mailpit.ts`. Move `extractLinks` to `links.ts` and
  import it; no other change.
- Modify: `package.json`. Add devDependencies `imapflow` and `mailparser`, plus
  `@types/mailparser`.
- Test: `tests/e2e/inbox.unit.spec.ts`, `tests/e2e/imap.live.spec.ts`

**Interfaces:**
- Consumes: `target.inbox` and `target.imap`, plus `runId()` (Task 4), and the
  `ReceivedEmail` type from `tests/helpers/mailpit.ts`.
- Produces, in `inbox.ts`:
  - `clearInbox(): Promise<void>`
  - `waitForEmail(o: { to: string; subjectIncludes?: string; timeoutMs?: number }): Promise<ReceivedEmail>`
    (default timeout 15000 locally and 90000 on staging)
  - `countEmails(o: { to: string; subjectIncludes?: string }): Promise<number>`

  Locally these delegate to `tests/helpers/mailpit.ts`.
- Produces, in `imap.ts`:
  - `parseMessage(raw: Buffer, id: string): Promise<ReceivedEmail>`, using
    `simpleParser` from mailparser and `extractLinks`.
  - `imapWaitForEmail`, `imapCount` and `imapClear(toAddress: string)`.
  - Each opens an `ImapFlow` connection (`secure: true`, `logger: false`) and
    logs out in `finally`.
  - The search is `{ to, subject? }` on `INBOX`.
  - `imapClear` flags `\Deleted` and expunges only the UIDs whose `to` matches.
  - On timeout, it searches the mailbox with the `\Junk` special-use flag (or
    named `Junk`/`Spam`). If the message is there, it throws
    `found in <folder>, not INBOX`.
  - In `inbox.ts`, `clearInbox()` on IMAP clears only
    `target.racerEmail(runId())`.

- [ ] **Step 1: Write the failing tests.**
  - Make `welcome.eml` from a real Mailpit welcome email: run the current
    `tests/spa/full-registration.spec.ts` once, then
    `curl localhost:8025/api/v1/message/<id>/raw`.

```ts
// inbox.unit.spec.ts
test('parseMessage returns subject, bodies and de-duplicated links', async () => {
  const raw = readFileSync(join(__dirname, 'fixtures/welcome.eml'));
  const email = await parseMessage(raw, '1');
  expect(email.subject).toContain('Welcome to dogTag');
  expect(email.links.length).toBeGreaterThan(0);
  expect(new Set(email.links).size).toBe(email.links.length);
});
```

```ts
// imap.live.spec.ts: skips unless E2E_EMAIL_BASE and E2E_IMAP_PASSWORD are set.
// It uses IMAP APPEND, so it needs no SMTP.
test('finds only this run’s mail, reports Junk, and clears only its own', async () => {
  // APPEND msg A To: <user>+<run>@<domain> (subject "e2e A <run>") to INBOX
  // APPEND msg B To: <user>+other-<run>@<domain> to INBOX
  // APPEND msg C To: <user>+junk-<run>@<domain> to the Junk folder
  expect((await imapWaitForEmail({ to: A, subjectIncludes: 'e2e A' })).subject).toContain('e2e A');
  await expect(imapWaitForEmail({ to: C, timeoutMs: 3000 })).rejects.toThrow(/Junk|Spam/);
  await imapClear(A);
  expect(await imapCount({ to: A })).toBe(0);
  expect(await imapCount({ to: B })).toBe(1);
  // finally: imapClear(B), and delete C from Junk
});
```

- [ ] **Step 2: Run** `npx playwright test --project=unit --project=live -g "parseMessage|this run"`.
  Expected: FAIL because the modules are missing.
- [ ] **Step 3: Implement** `links.ts`, `imap.ts` and `inbox.ts` with these
  signatures, and add the devDependencies (`npm i -D --save-exact imapflow mailparser @types/mailparser`).
- [ ] **Step 4: Run** Step 2's command with `.env.e2e` present (the live test
  runs). Expected: PASS. Then `npx playwright test tests/spa/password-reset.spec.ts`,
  which still uses Mailpit through the moved `extractLinks`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `E2E: one inbox interface over Mailpit and IMAP`

### Task 6: Classy client for the optional check

**Files:**
- Create: `tests/e2e/classy.ts`
- Test: `tests/e2e/classy.live.spec.ts`

**Interfaces:**
- Consumes: `target.classy` (Task 4).
- Produces:
  - `findFundraisingTeamsByName(campaignId: number, name: string): Promise<Array<{ id: number; name: string }>>`
  - `deleteFundraisingTeam(team: { id: number; name: string }, campaignId: number): Promise<'deleted' | 'unsupported'>`.
    It throws before any request unless `team.name` starts with `Test Team E2E `
    and `campaignId` is in `ALLOWED_CLASSY_CAMPAIGNS`.
- Behavior:
  - Gets an OAuth client-credentials token from `https://api.classy.org/oauth2/auth`
    (`grant_type=client_credentials`) and caches it for the module's lifetime,
    mirroring `lib/classy_client.rb`.
  - The list uses `GET https://api.classy.org/2.0/campaigns/<id>/fundraising-teams`
    with `filter=name=<name>` and `per_page=100`. It always filters the returned
    `data` by an exact name match too, because the filter's semantics are
    unverified.
  - The delete is `DELETE /2.0/fundraising-teams/<id>`. Return `'unsupported'`
    on 403, 404 or 405, and throw on anything else non-2xx.

- [ ] **Step 1: Write the tests.** The guard test always runs:

```ts
test('deleteFundraisingTeam refuses non-e2e teams and other campaigns', async () => {
  await expect(deleteFundraisingTeam({ id: 1, name: 'Real Team' }, 867400)).rejects.toThrow(/Test Team E2E/);
  await expect(deleteFundraisingTeam({ id: 1, name: 'Test Team E2E x' }, 123)).rejects.toThrow(/campaign/);
});
```

  The live test skips unless `target.classy` is set:
  `findFundraisingTeamsByName(campaignId, 'No Such Team <runId>')` resolves to
  `[]`.
- [ ] **Step 2: Run** `npx playwright test --project=live -g Classy`. Expected:
  FAIL because the module is missing.
- [ ] **Step 3: Implement** `classy.ts`.
- [ ] **Step 4: Run** Step 2's command with Classy vars set. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `E2E: minimal Classy client for the fundraising-team check`

### Task 7: Admin login, race setup (test A) and race teardown

**Files:**
- Create: `tests/e2e/admin-forms.ts`, `tests/e2e/admin-auth.setup.ts`,
  `tests/e2e/race-setup.spec.ts`, `tests/e2e/race-teardown.ts`,
  `tests/e2e/fixtures/jsonform.json`

**Interfaces:**
- Consumes:
  - `target` and `runId()`, plus `writeRaceState`/`readRaceState` (Task 4).
  - The "Mock payment" type label (Task 1).
  - The login labels (Task 2).
- Produces, in `admin-forms.ts`:
  - `fillDateTimeSelect(page: Page, prefix: string, at: Date, timeZone: string): Promise<void>`.
    `prefix` is the Rails id stem, e.g. `race_registration_open`, which fills
    `_1i`..`_5i` (`_6i` when present). It converts `at` to wall-clock parts in
    `timeZone` with `Intl.DateTimeFormat`.
  - `createRace(page, input: RaceInput): Promise<{ id: number }>`, where
    `RaceInput` is `{ name, timeZone, registrationOpen, registrationClose, finalEditsClose, raceDatetime: Date, maxTeams, peoplePerTeam: number, experienceLabels: string[], jsonform: string, classyCampaignId?: number, classyDefaultGoal?: number }`.
  - `addRequirement(page, raceId: number, r: { name: string; typeLabel: 'Payment' | 'Mock payment' }): Promise<{ id: number }>`
  - `addTier(page, requirementId: number, t: { priceCents: number; beginAt: Date }, timeZone: string): Promise<void>`
  - `retireRace(page, raceId: number): Promise<void>` moves every window and
    the race date into the past (registration open −3 d, close −2 d, final
    edits −2 d, race −1 d) and appends ` [retired]` to the name.
  - `currentE2ERaceIds(page): Promise<number[]>` returns the ids of races named
    `Race E2E *` without `[retired]` that are listed under current races on
    `/races`.
- Produces, in `admin-auth.setup.ts`: it logs in at `/user_session/new` with
  `target.staff` and saves `playwright/.auth/staff.json`.
- **`race-setup.spec.ts` (test A):**
  1. On both targets, it retires every id from `currentE2ERaceIds`. On staging
     this is the sweep; locally it's harmless.
  2. It creates the race and both requirements with tiers using the Global
     Constraints values. Each requirement's `typeLabel` comes from
     `target.requirementType`. The Classy fields are set only when
     `target.classy`.
  3. It asserts, then calls `writeRaceState`.
- **`race-teardown.ts`:** calls `retireRace(readRaceState().raceId)`, then
  deletes `playwright/.auth/staff.json` in a `finally`.

- [ ] **Step 1: Write `race-setup.spec.ts`'s assertions.**

```ts
const races = await (await request.get('/api/v1/races')).json();
const race = races.find((r: any) => r.name === raceName);
expect(race).toMatchObject({ open_for_registration: true, people_per_team: 5 });
expect(race.payment_requirements.map((p: any) => [p.name, p.type])).toEqual([
  ['Cart Deposit', target.requirementType], ['Race Registration', target.requirementType]]);
expect(race.jsonform).toBeTruthy();
expect(Math.abs(Date.parse(race.registration_open) - registrationOpen.getTime())).toBeLessThan(60_000);
// The race show page lists both requirement names.
```

Adjust the field names to `app/views/api/v1/races/_race.json.jbuilder`. If the
JSON lacks `registration_open` or `jsonform`, assert those values on the admin
race show page instead. Don't add fields to the API for the test.

Sweep test: a second `test` in `race-setup.spec.ts`, skipped when
`target.name === 'staging'`.
1. Create a decoy `Race E2E sweep-<runId>` with `createRace`.
2. Assert `currentE2ERaceIds(page)` contains its id.
3. Run the same sweep function the setup uses.
4. Assert the id is gone, and that `/api/v1/races` no longer lists the decoy.

Export the sweep as `sweepLeftoverRaces(page): Promise<number[]>` from
`admin-forms.ts`. It returns the retired ids.

- [ ] **Step 2: Run** `npx playwright test --project=race-setup`. Expected: FAIL
  because the helpers are missing.
- [ ] **Step 3: Implement** `admin-forms.ts`, the setup, the spec and the
  teardown.
  - Copy the JSONForm fixture.
  - Paste it into the "Jsonform Data" textarea with `fill`.
- [ ] **Step 4: Run** `TZ=UTC npx playwright test --project=race-setup` (this
  runs teardown too), then run it again. Expected:
  - Both runs PASS.
  - After the run, the race has `[retired]` in its name and is gone from
    `/api/v1/races`.
  - `TZ=UTC` proves the zone handling.
  Also confirm the run used the operator: the race-setup log records the
  logged-in role, and no step needed admin.
- [ ] **Step 5: Commit.** Message: `E2E: operator login, race setup through the admin UI, and retire-on-teardown`

### Task 8: Payment adapter and the registration test (test B)

**Files:**
- Create: `tests/e2e/payments.ts`, `tests/e2e/registration.spec.ts`
- Delete: `tests/spa/full-registration.spec.ts`

**Interfaces:**
- Consumes:
  - `target`, `runId()` and `readRaceState()` (Task 4).
  - `inbox.ts` (Task 5).
  - `classy.ts` (Task 6).
  - The race created by Task 7.
- Produces, in `payments.ts`:
  - `assertTestKey(key: string | undefined): void`. It throws
    `Refusing to pay: publishable key is <first 8 chars>…, not pk_test_` unless
    the key starts with `pk_test_`.
  - `payFee(page: Page, feeItem: Locator, amountLabel: string, mode: PaymentMode): Promise<void>`
    - `mock`: clicks `Mock pay`.
    - `stripe`: clicks the fee's Pay button, then fills the `checkout.js`
      frame. The frame is `iframe[name^="stripe_checkout"]`, with placeholders
      "Card number" (`4242424242424242`), "MM / YY" (`12 / 34`, typed with a 50
      ms delay) and "CVC" (`123`). Fill "Email" if it's empty, then click the
      frame's Pay button.
    - Both modes end with `await expect(feeItem.getByText(\`Paid ${amountLabel}\`)).toBeVisible({ timeout: 60_000 })`.
- **`registration.spec.ts`** runs these steps as `test.step`s, in a fresh context
  with no storage state:
  1. Read `/api/v1/races`, find the race by `readRaceState().raceName`, and call
     `assertTestKey(race.stripe_publishable_key)`.
  2. If `target.checkEmail`, call `clearInbox()`.
  3. Sign up at `/register/signup` as `target.racerEmail(runId())`, following
     the field sequence in the deleted `full-registration` spec. If
     `checkEmail`, wait for `Welcome to dogTag`; its links include
     `new URL(target.baseURL).host`.
  4. Start a team in that race: `Test Team E2E <runId>`.
  5. Add 5 racers, as in `full-registration`. Racer emails are
     `racer<i>-<runId>@example.com`; they never receive mail, only the captain
     does. Then assert `5 of 5`.
  6. Answer every question in the chiditarod_21 fixture with schema-valid
     values, save, and assert the card's "N of N questions answered".
  7. Pay "Cart Deposit" ($88), then "Race Registration" ($130) with
     `payFee(page, item, '$88' | '$130', target.payments)`. Assert there is no
     `Team #` after the first fee, then `group "You're in!"` shows `/^Team #\d+$/`.
  8. If `checkEmail`, wait for `Registration Confirmed for` whose subject
     contains the race name.
  9. If `target.classy`, use
     `expect.poll(() => findFundraisingTeamsByName(campaignId, teamName), { timeout: 120_000 }).toHaveLength(1)`,
     then `deleteFundraisingTeam(team, campaignId)`. Log `'unsupported'` with
     `test.info().annotations` and don't fail on it.
  10. If `target.inbox === 'imap'`, call `clearInbox()` in `afterAll`.

- [ ] **Step 1: Write the `assertTestKey` unit test** in
  `tests/e2e/target.unit.spec.ts`:

```ts
test('assertTestKey refuses live and missing keys', () => {
  expect(() => assertTestKey('pk_live_abc')).toThrow(/pk_live_/);
  expect(() => assertTestKey(undefined)).toThrow(/Refusing to pay/);
  expect(() => assertTestKey('pk_test_abc')).not.toThrow();
});
```

- [ ] **Step 2: Run** `npx playwright test --project=unit`. Expected: FAIL.
- [ ] **Step 3: Implement** `payments.ts` and `registration.spec.ts`. Then delete
  `tests/spa/full-registration.spec.ts`.
- [ ] **Step 4: Run all three of these.** Expected: PASS each time.
  - (a) `npm run e2e` (local, mock).
  - (b) `E2E_CHECK_EMAIL=1 npm run e2e` (Mailpit asserts both emails).
  - (c) `npm run e2e:stripe` (local, Stripe test keys from `.env`).
- [ ] **Step 5: Commit.** Message: `E2E: registration through You're in!, with mock or Stripe test payments and optional email/Classy checks`

### Task 9: CI, docs, full verification and the first staging run

**Files:**
- Modify: `.circleci/config.yml` (around line 164-170, the Playwright step),
  `tests/README.md`, `CLAUDE.md` (E2E Learnings)

**Interfaces:** none new.

- [ ] **Step 1: Update CI.** Add `E2E_CHECK_EMAIL=1` to the Playwright step's
  env. It keeps running `npm test`, which runs every local project, including
  the legacy specs and the real Stripe test payment.
- [ ] **Step 2: Update the docs.**
  - `tests/README.md`: "Running against staging", covering `.env.e2e` keys, the
    three npm scripts and what the guard refuses.
  - `CLAUDE.md` E2E Learnings, one line each:
    - the target table;
    - the guard rule and the no-Heroku rule;
    - races are retired, not deleted;
    - IMAP plus-address racers on staging.
- [ ] **Step 2b: Stop installing root devDependencies on Heroku (security fix 6).**
  This is an ops step done by the controller, not a subagent.
  1. Run `heroku config:set NPM_CONFIG_OMIT=dev -a dogtag-staging`.
  2. Redeploy `main` to staging.
  3. Confirm both of these:
     - The build log shows no `@playwright/test` or `imapflow` install.
     - `/register` still returns 200 and loads the SPA.
  4. If the buildpack ignores the variable, stop and report it. Don't try other
     variables.
  5. Once it works, set the same on `dogtag`. The owner has authorized
     non-Stripe config vars on production.
  6. Add a line to `docs/runbooks/2026-production-launch.md`'s config-vars
     list.

  Also add to `CLAUDE.md` E2E Learnings: staging secrets and `.env.e2e` never
  go into CI or artifacts.
- [ ] **Step 3: Run the full local suite:** `bin/check` and then
  `SPA_BUILD=skip bin/check e2e`. Expected:
  - All steps `ok`.
  - Playwright reports 0 failed, with the legacy specs included.
- [ ] **Step 4: Run against staging:** `npm run e2e:staging` with `.env.e2e`
  filled in and `E2E_CHECK_EMAIL=1`. Expected PASS:
  - The race is created and later retired.
  - The team reaches "You're in!".
  - The welcome and confirmation emails are found over IMAP.
  - The Classy team is found and then deleted or annotated.
  - Report the run id to the owner.
- [ ] **Step 5: Commit, push and open the PR.**
  - Message: `E2E: CI email checks, staging run docs`.
  - The PR body lists the two app changes, the new devDependencies (`imapflow`,
    `mailparser`, `@types/mailparser`) and the deleted `full-registration`
    spec.
