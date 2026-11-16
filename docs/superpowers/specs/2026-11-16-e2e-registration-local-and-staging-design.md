# E2E: admin race setup + racer registration, locally and on staging

Date: 2026-11-16. Status: owner's answers to the review questions folded in; awaiting approval.

## Why

The owner wants enough confidence in the new `/register` flow that the legacy
HAML flow is never needed. That means one browser test suite that proves the
whole path:

1. An admin can create a race.
2. A new racer can register, fill the roster, answer the questions, pay both
   fees and reach the "You're in!" screen.

The suite runs the same way locally (mock payments, for automation and CI) and
against staging (Stripe test mode, real Classy), so staging can be checked
before the Nov 24 go/no-go and before every later release.

## Goals

- **Admin race setup (test A)** through the real admin UI:
  - a race with registration open now and 5 people per team;
  - 2 payment requirements with tiers;
  - JSONForm questions;
  - optionally a Classy campaign id.

  It is a prerequisite step that later tests build on, and it is also a test
  in its own right. The owner rates it less important than registration.
- **Racer registration (test B)** on the race test A created:
  - sign up;
  - create a team;
  - add 5 racers;
  - answer the JSONForm;
  - pay 2 fees;
  - assert the "You're in!" card with a team number.
- **Targets:**
  - `local`: Rails booted by Playwright, mock payments.
  - `staging`: `https://dogtag-staging.herokuapp.com`, Stripe test mode.
- **Optional checks, off unless configured:**
  - Classy: query the Classy API for the team's fundraising team (staging,
    or locally if Classy creds and a campaign are given).
  - Email: the welcome and confirmation emails arrive. Locally they are read
    from Mailpit, and on staging from the owner's test mailbox over IMAP. The
    same assertions run on both.
- **Guard:** the suite refuses to run against anything but an allowlisted
  target, and a hard denylist blocks production.
- **Saved login:** the admin logs in once per run in a setup step, and later
  steps reuse the saved session.

## Non-goals

- Changing the legacy-flow e2e specs. They stay exactly as they are, in the
  default run and in CI. The legacy flow is the launch fallback and must be
  proven working today.
- Migrating payments to Stripe Checkout Sessions. This comes only after the
  existing flow is proven solid by human testing and this automation. The tests
  must not lock that migration out (see Payment step).

## Priority (owner, 2026-11-16)

1. The legacy flow works today, as the fallback.
2. The new `/register` flow works today.
3. Upgrade Stripe, because the current gem is from 2017.

The work focuses on testing and integration.
- Running against production in any form.
- CI against staging. CI runs `local` only; staging runs are on demand.

## Anti-goals (failure even if it "works")

- Heroku becomes a test dependency. No `heroku run`, no Heroku CLI or API from
  the test process, and no Heroku login needed to run any target.
- A payment step that could charge a live card.
- Test data that is visible to real racers on production, or that breaks staging
  pages for people testing by hand.
- Two copies of the registration test (local vs. staging) that drift apart.

## Constraints

- Staging runs `RAILS_ENV=production`, so `mock_payments` is not routed there
  and `test_seeds:*` refuses to run there. All staging setup goes through the UI.
- The SPA pays with legacy Stripe Checkout (`checkout.js` popup iframe) on gem
  1.58 until the post-launch migration.
- `Requirement::ALLOWED_TYPES` offers only `PaymentRequirement` in the admin UI.
- Race, requirement and user deletes are hard deletes with no `dependent:`
  options, so they leave orphans. Races have no delete button.
- The admin login form (`/user_session/new`) has no field labels.
- Admin datetimes are Rails `datetime_select` dropdowns entered in the race's
  time zone.
- The SPA race list (`/api/v1/races`) shows races with `race_datetime > now`.
- Legacy HAML flow must keep working (CLAUDE.md).
- Ask before changing the Gemfile, `config/initializers`, `config/environments`,
  `config/application.rb` or `spec/spec_helper.rb`. Nothing here should need any
  of them.

## Approaches considered

- **A. Seed tasks on staging through `heroku run`.** One seeding path for both
  targets, and it can read `sent_emails`. Rejected: makes Heroku a test
  dependency.
- **B. Admin UI builds the race, registration uses it (chosen by the owner).**
  - Covers test A for free and needs no backdoor on staging.
  - Cost: registration depends on the admin form working, and staging cleanup
    must go through the UI.
- **C. Test-only HTTP seed endpoints.** Rejected: an endpoint that creates and
  deletes data on a public server.

## Design

### Targets and the guard (`tests/e2e/target.ts`)

`E2E_TARGET=local|staging` (default `local`) resolves to:

| | local | staging |
|---|---|---|
| baseURL | `http://localhost:$TEST_PORT` | `https://dogtag-staging.herokuapp.com` |
| Rails server | booted by Playwright `webServer` | none |
| Payments | `mock` (default) or `stripe` if `E2E_PAYMENTS=stripe` | `stripe` only |
| Requirement type created | `MockPaymentRequirement` (mock) / `PaymentRequirement` (stripe) | `PaymentRequirement` |
| Admin login | seeded `test+admin@example.com` (local `test_seeds:admin`) | `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` |
| Racer email | `e2e+<runId>@example.com` | `<user>+<runId>@<domain>` from `E2E_EMAIL_BASE` (required; the owner's test mailbox) |
| Email check (`E2E_CHECK_EMAIL=1`) | Mailpit (`tests/helpers/mailpit.ts`) | IMAP on the test mailbox (`monday.mxrouting.net:993`) |
| Classy check | when `CLASSY_CLIENT_ID/SECRET` and `E2E_CLASSY_CAMPAIGN_ID` are set | same |

Guard, evaluated when `playwright.config.ts` loads, before any test or web server
starts:

1. **Denylist.** Fail if the resolved base URL's host is any of these:
   - `dogtag.chiditarod.org`
   - `dogtag.herokuapp.com`
   - any `*.chiditarod.org`

   Then fail fast with a clear message. The denylist is checked first and is
   hard-coded.
2. **Allowlist.** The host must be exactly one of:
   - `localhost`
   - `127.0.0.1`
   - `dogtag-staging.herokuapp.com`

   The allowlist is hard-coded, so no environment variable can extend it.
   `BASE_URL` may override the URL only within it.
3. **Payment precondition.** Before the first payment, the registration test
   reads `/api/v1/races` and refuses to pay unless the race's
   `stripe_publishable_key` starts with `pk_test_`. This holds even in mock
   mode, and it means a misconfigured target cannot take a live charge.

The allowlist alone would be enough. The denylist is kept because it costs a few
lines and stays correct even if someone edits the allowlist later.

### Playwright projects

Projects are chained with `dependencies`, and test A's cleanup uses a
project-level `teardown`:

1. `admin-auth` (setup).
   - Logs in at `/user_session/new` and saves `playwright/.auth/admin.json`
     (gitignored).
   - Locally, global setup first runs `test_seeds:cleanup` and `test_seeds:admin`
     with the local `bin/rails`.
2. `race-setup` = **test A**. Uses the admin storage state. It creates the race
   in the target's time zone (`America/Chicago`):
   - Name `Race E2E <runId>`. The `Race ` prefix keeps it inside the local
     `test_seeds:cleanup` pattern.
   - Registration opens 1 day ago and closes in 14 days. Final edits close in
     14 days. The race date is in 30 days.
   - Max teams 50, 5 people per team.
   - Experience labels: a short fixed list.
   - JSONForm: `tests/e2e/fixtures/jsonform.json`, a copy of the public
     `chiditarod_21.json` fixture.
   - Classy campaign id and default goal, only when `E2E_CLASSY_CAMPAIGN_ID` is
     set.
   - Requirement 1, "Cart Deposit": one tier at $88 that begins at registration
     open.
   - Requirement 2, "Race Registration": tier 1 at $130 beginning at registration
     open, and tier 2 at $150 beginning in 7 days.

   It asserts:
   - The race show page lists both requirements and their tiers.
   - The race appears in `/api/v1/races` with `open_for_registration: true`,
     `people_per_team: 5`, both payment requirements of the expected `type`, and
     the JSONForm present.

   It writes `{ raceId, raceName }` to `playwright/.state/race-<runId>.json` for
   later projects.
3. `registration` = **test B**. Depends on `race-setup` and uses a fresh browser
   context (no admin session). It runs these steps:
   1. Sign up with the target's racer email (see the table above). On staging,
      the address is a plus-address on the owner's test mailbox, so staging mail
      is delivered rather than bounced.
   2. Pick the race by name and create team `Test Team E2E <runId>`.
   3. Fill 5 roster slots.
   4. Answer the questions.
   5. Pay both fees with the payment adapter.
   6. Assert the "You're in!" card and a `Team #<n>`.

   Optional checks:
   - Classy (below).
   - Email (below).
4. `race-teardown` (the teardown of `race-setup`) retires the race instead of
   deleting it, through the admin edit form:
   - It moves `race_datetime` and every window into the past and prefixes the
     name with `[retired]`.
   - That hides the race from the SPA list (`Race.current`) without orphaning
     its teams, people or completed requirements.

   Locally, `test_seeds:cleanup` at the next run's global setup still hard-deletes
   it. On staging, retired races accumulate, which is acceptable.

   *(Builder's call, settled by the author.)* A teardown can fail, or a run can be
   aborted, leaving an open race behind. So on staging, `race-setup` first sweeps
   any still-current `Race E2E *` race from the admin race index and retires it
   the same way. Then a leftover never shows up for people testing by hand for
   longer than one run.

### Payment step (`tests/e2e/payments.ts`)

Each target and payment mode uses one adapter, `payFee(page, feeCard, mode)`:

- **`mock`:** clicks "Mock pay" (shown for `MockPaymentRequirement`) and waits
  for the card to show paid.
- **`stripe`:** clicks Pay, then fills the `checkout.js` iframe.
  - The test card number, email, expiry and CVC come from `tests/e2e/stripe.ts`
    constants.
  - The selectors are reused from `tests/stripe-payment.spec.ts`:
    `iframe[name^="stripe_checkout"]`, plus the "Card number", "MM / YY" and
    "CVC" placeholders.
  - It then waits for the fee card to show paid.

When payments move to Checkout Sessions after launch, only this adapter and the
mock path change. The test bodies do not.

### Optional email check (`tests/e2e/inbox.ts`)

`inbox.ts` exports one interface, which the registration test uses identically on
both targets:

- `clearInbox()`
- `waitForEmail({ to, subjectIncludes, timeoutMs })` returns
  `{ id, subject, html, text, links }`.
- `countEmails({ to, subjectIncludes })`

Each target has its own backend:

- **local:** re-exports the existing `tests/helpers/mailpit.ts` unchanged. That
  file is not duplicated or rewritten.
- **staging:** IMAP via the `imapflow` npm package. This is a new root
  devDependency, called out in the PR.
  - Logs in as `E2E_EMAIL_BASE` with `E2E_IMAP_PASSWORD`.
  - Polls `INBOX` with a server-side search on `TO <user>+<runId>@<domain>` and
    the subject.
  - Parses the body to the same `{ subject, html, text, links }` shape, reusing
    Mailpit's `extractLinks`, which moves to a shared helper if needed.
  - `clearInbox()` deletes only messages to this run's address, never the whole
    mailbox. After the run, matched messages are flagged `\Deleted` and expunged.
  - On timeout it also searches the Junk/Spam folder and names that folder in
    the failure message. Mail that landed in spam is a real finding, not a
    flake.

POP3 was considered and rejected because it cannot search on the server. Every
poll would download the whole mailbox and could not delete a single run's
messages cleanly.

Assertions, on both targets:
- The welcome email arrives (`Welcome to dogTag`), and its links point at the
  target host.
- The confirmation email arrives (`Registration Confirmed for`).

Verified 2026-11-16:
- SMTP and IMAP logins work for the test mailbox.
- Mail to `<user>+probe-<hex>@<domain>` arrives in `INBOX` within about 2 s
  (`Delivered-To` is the base address).
- An IMAP `TO` search finds it, and flag-and-expunge removes it.
- The password in `.env.e2e` is quoted. Load the file with `dotenv` (already a
  devDependency), which strips the quotes.

### Optional Classy check (`tests/e2e/classy.ts`)

The check talks to Classy directly from Node, without going through dogtag:

1. It gets a token with client credentials, mirroring `lib/classy_client.rb`.
2. It polls `GET /2.0/campaigns/<id>/fundraising-teams?filter=name=<team name>`
   (falling back to paging and matching by name) for up to 2 minutes with
   `expect.poll`, because the Sidekiq worker on staging is asynchronous.
3. It asserts exactly one team with that name.

It then tries to delete that fundraising team. If deletion is unsupported or
fails, it logs and leaves the team in the test campaign.

Known side effect: dogtag links the e2e user to Classy, which creates a member
or supporter record in org 34780 for the e2e email. The owner accepts both
stray supporters and the visible test campaign (2026-11-16). The fundraising
team is still deleted when the API allows it.

Verified 2026-11-16 from staging: the list endpoint for campaign 867400 returns
paginated JSON (`data`, `total`) and accepts `filter`. The filter's matching
behavior is unverified because the campaign has no teams yet.

### App changes needed (small)

1. **Mock requirement type outside production.**
   `Requirement.allowed_types` includes `["Mock payment",
   "MockPaymentRequirement"]` when `!Rails.env.production?`. Staging is
   `production`, so staging never offers it. Add a model spec for both envs.
2. **Login field labels.** Add accessible labels (`aria-label` or visually
   hidden `<label>`) to the legacy login form's email and password fields so
   locators use roles and labels. Legacy behavior is unchanged.

No other app changes. If the builder finds the admin forms unusable without
more changes, they stop and raise it.

### Layout, commands and secrets

- **New specs:**
  - `tests/e2e/admin-auth.setup.ts`
  - `tests/e2e/race-setup.spec.ts`
  - `tests/e2e/race-teardown.ts`
  - `tests/e2e/registration.spec.ts`
- **New helpers:**
  - `tests/e2e/{target,payments,classy,admin-forms,run-id}.ts`
  - `admin-forms` holds the `datetime_select` filler and the requirement and
    tier helpers.
- **Legacy specs:** unchanged and still in the default run. They are local-only,
  so they are skipped when `E2E_TARGET=staging`.
- **Existing SPA specs:**
  - `tests/spa/full-registration.spec.ts` is superseded by `registration.spec.ts`
    plus the Mailpit option, so it is deleted.
  - `past-racers`, `password-reset` and `reminder` stay as local-only seed-based
    specs and are skipped when `E2E_TARGET=staging`.
- **npm scripts:**
  - `e2e`: local, mock.
  - `e2e:stripe`: local, Stripe test keys from `.env`.
  - `e2e:staging`: staging.

  `npm test` keeps running the local default.
- **Secrets:** `.env.e2e` holds the following. It is gitignored and also listed
  in `.git/info/exclude`, so it stays untracked on every branch.
  - `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` (a staging admin account);
  - `CLASSY_CLIENT_ID`, `CLASSY_CLIENT_SECRET` and `E2E_CLASSY_CAMPAIGN_ID`
    (optional);
  - `E2E_EMAIL_BASE`, the test mailbox address (required on staging). The
    address itself is not committed, since the repo is public.
  - `E2E_IMAP_PASSWORD`, the test mailbox password, used by the staging email
    check. MXRoute delivers plus-addresses to the base mailbox; this was
    verified 2026-11-16.

  A missing required secret fails fast with the variable's name. Secrets are
  never logged, and traces mask the password field.
- **Run settings:**
  - `trace: 'retain-on-failure'`, screenshots and video on failure.
  - On staging: `retries: 0` (a retried payment means a duplicate test charge),
    and `workers: 1`.
- **Docs:**
  - `tests/README.md` gets a short "running against staging" section.
  - CLAUDE.md gets the guard rule and the target/env table, under E2E Learnings.
- **CI:** CircleCI runs `E2E_TARGET=local` (mock) only. No secrets are needed
  beyond what it has today.
  - *(Author's call.)* CI also sets `E2E_CHECK_EMAIL=1`. Mailpit is already a CI
    service, so the welcome and confirmation email checks that
    `full-registration` gave CI are kept.
  - CI keeps running the legacy specs unchanged, including the real Stripe
    test-mode `checkout.js` payment.

## Left to the builder

- Exact locators. Prefer role and label locators, then existing ids.
- Field-filling details, including the `datetime_select` helper.
- How `runId` is generated, as long as it is unique per run and short enough
  for team names.
- Answer values for the JSONForm fixture, as long as they pass the schema.
- Whether the Classy token and request code is a small fetch wrapper or shares
  code with anything existing in `tests/`.
- The wording of guard error messages.
