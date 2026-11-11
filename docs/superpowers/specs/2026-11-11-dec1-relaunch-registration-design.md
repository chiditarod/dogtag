# Dec 1 Relaunch + Registration Refresh: Design

**Date:** 2026-11-11
**Status:** Draft for approval
**Project:** 1 of 3 (see "Sequencing" below)

## Intent

Dogtag runs the registration for CHIditarod each year. It is brought up on Heroku every winter, used for one registration season, and shut down after the race. Registration for CHIditarod XXII opens on **Dec 1, 2026**, with three price tiers.

This year's launch should do two things:

1. **Do the yearly relaunch reliably.** Racers sign up, pay, get a Classy fundraising page, and receive emails, just as in previous years.
2. **Replace the racer-facing experience with a modern, smooth one, live on day one.** The current UI is 10+ years old (Bootstrap 3, hand-written forms, jQuery and CoffeeScript), looks dated, and feels clunky. Its main gaps:
   - no input help such as formatting or auto-tabbing
   - no modern tooltips
   - no way to reuse racers from past teams

The new racer-facing UI is built as a **Vite + React SPA on the same stack as `../cartographer`**, so it carries straight into Phase 2, when dogtag and cartographer merge. Shipping it now means building it once rather than building a Rails-view refresh first and redoing it later.

## Goals

- Registration opens Dec 1 on Heroku and passes a live end-to-end test with production Stripe and Classy.
- Racer-facing flow rebuilt as an SPA:
  - sign up / log in
  - pick race
  - create team
  - team checklist page with roster, questions, fee, and a "You're in" card
- Smart inputs:
  - phone formats as you type
  - email is checked as you type
  - auto-advance between fields
  - accessible tooltips
  - inline validation that mirrors the server's validation
- **Past-racer picker:** a captain can fill roster slots from people on their own previous teams, then edit the details.
- **Years racing becomes configurable per race.** No code change is needed each year.
- **The JSONForm param whitelist hack goes away (#40).** Allowed keys are derived from the race's schema.
- **Automatic reminder emails (#206)** to captains of unfinalized teams.
- Playwright e2e for the new flow against a docker-compose Postgres sidecar, plus closing the Classy test gaps.

## Non-goals (this project)

- Redesigning admin pages. They stay Bootstrap 3 Rails views. Admin moves to a cartographer-style interface in Phase 2.
- Upgrading the `stripe` gem, or moving off legacy Stripe Checkout (`checkout.js`). Both are planned for after launch.
- Authlogic → Devise (#203), Unicorn → Puma (#204), Sprockets/Sass modernization.
- Per-person JSONForm questions. They are the long-term home for years racing, but too large for this window.
- Converting the whole app to API-only mode. We add an API alongside the existing app.
- Reminder emails to individual racers. Captains only.

## Anti-goals (failure even if it "works")

- Registration not open on Dec 1, or a launch that breaks payment, Classy team creation, or finalization emails.
- A new UI that is slower for a returning captain than the old one.
- A look that feels like a generic corporate checkout instead of CHIditarod.
- Leaking one user's past racers to another user.
- Losing or corrupting historical registration data from the restored dump.

## Constraints

- **Today:** Nov 11. **Go/no-go: Nov 24. Launch: Dec 1.**
- **Fallback:** the existing Rails racer-facing views stay deployed and working. If the SPA flow is not passing its e2e suite and a staging run with Stripe test mode + Classy by Nov 24, Dec 1 opens on the legacy views, with the small fixes listed below. The SPA ships mid-season.
- Hosting stays on Heroku. The team knows it, and there are existing apps and remotes:
  - `heroku` → `dogtag`
  - `staging` → `dogtag-staging`
  - `dogtag-22`
- Payment, Classy team creation, finalization, and all emails must keep running through the **existing model-layer code paths**:
  - Wisper listeners
  - `Team#finalize`
  - `Workers::TeamFinalizer`
  - `Workers::ClassyCreateFundraisingTeam`
  - `UserMailer`

  The SPA calls into these through the API. It does not reimplement them.
- Classy and Stripe worked end to end last season (Jan–Feb 2026). Treat those integrations as working, and verify them live rather than rewriting them.

## Decisions made with the project owner

| Topic | Decision |
|---|---|
| Approach | SPA now (not a Rails-view refresh), with Nov 24 go/no-go and the legacy views as fallback |
| Frontend stack | Same as cartographer: Vite, React 19, TypeScript, Tailwind, TanStack React Query, React Router, following Bulletproof React structure |
| Roster step | **Option A, "team roster"**: one page for the whole team. One slot per racer (`people_per_team`). Empty slots show one-tap chips of past racers, plus "add someone new". Picking fills the slot for review and editing. |
| Team page | **Option A, "one-page checklist"**: numbered cards (Racers, Team questions, Registration fee, You're in!). Cards can be done in any order. The fee card shows current tier and next price change. The final card unlocks on finalization and shows team number and Classy link. |
| Visual direction | **Option A, "Chicago Flag"** (see Design system below). The "CHIditarod License" concept was not chosen. |
| Reminder emails | Issue #206 as written. Captains only. |
| Sequencing | Project 1 (this doc) → Project 2 (SPA hardening, API mode, Stripe/test modernization) → Project 3 (Phase 2 merge with cartographer, separate brainstorm) |
| Old CLAUDE.md rules | Revisit them. The owner trusts current output more (see Workflow) |
| PRs | Claude opens PRs on GitHub (per the owner's original request) |

Mockups from the session are in `.superpowers/brainstorm/2437-1794380927/content/`:
- `racers-step.html`
- `team-hub.html`
- `style-directions.html`

## Current state (facts from the codebase survey)

- **Stack:** Rails 8.0.4, Ruby 3.4.8, Sprockets 3.7, HAML, `bootstrap-sass` 3.4.1 + Bootswatch "lumen".
  - jQuery and Bootstrap JS come from a CDN.
  - CoffeeScript is used in `app/assets/javascripts/`.
  - Jobs run on **Sidekiq** 7 with sidekiq-cron. There is no GoodJob and no ActiveJob.
  - Web runs on Unicorn.
  - There is **no `FrontdoorForm`**, although CLAUDE.md claims there is.
- **Racer flow today:**
  1. Homepage
  2. `/races`
  3. `users#new` (signup)
  4. `teams#new?race_id=`, which collects name, description, and experience
  5. `questions#show` (JSONForm)
  6. Team page with tabs (People / Payments / Basics / Details)
  7. `people#new` per racer
  8. Stripe legacy Checkout button → `charges#create`

  Finalization is automatic through Wisper listeners calling `team.finalize || team.unfinalize`.
- **Person fields:** first/last name, email, phone, zipcode, experience (integer), twitter.
  - Phone must match `555-867-5309`.
  - Zip must match `12345(-1234)`.
  - `PersonValidator` enforces the registration window and `people_per_team`.
  - Person has **no `user_id`**. It only `belongs_to :team`.
- **Years racing:**
  - Defined in `Team::EXPERIENCE_LEVELS` (`app/models/team.rb:41-64`), 22 joke labels.
  - Stored as the **integer index** in both `teams.experience` and `people.experience`.
  - Read in these places:
    - admin registrations table (`teams/_table.html.haml`)
    - CSV export (`Team.export`)
    - `Team#person_experience`
  - Not used by Classy or emails.
- **JSONForm:**
  - The schema is in `races.jsonform` (text). Answers are a flat JSON object in `teams.jsonform` (text), at team level only.
  - Rendered by vendored Joshfire `jsonform.js`.
  - Answers are saved through `HACK_PARAM_WHITELIST` in `questions_controller.rb`.
  - Validated by `TeamValidator` with `JSON::Validator.fully_validate`.
  - Last year's payload is `../dogtag-private/jsonform/chiditarod_21.json`:
    - all properties are strings or enums
    - four fieldsets
    - agreement fields use `pattern: ^Yes$`
    - textarea for `explain-theme`
- **Emails:** `UserMailer` (welcome, password reset, team finalized, Classy fundraising team created, waitlisted). The waitlisted email is never sent. Every email goes to the captain only. There are no reminders. The only cron job is `ClassyCacheOrgMemberCacher`, every 20 minutes.
- **Tests:**
  - ~520 RSpec examples.
  - Classy specs:
    - `classy_client_spec`: ~36
    - `classy_user_spec`: ~10
    - `classy_create_fundraising_team_spec`: 6
    - No specs for `ClassyCacheOrgMemberCacher` or `ClassyFundraisingTeamEmail`.
  - Playwright `tests/` has 5 single-test specs (`playwright.config.ts`, port 3099).
- **Launch data:**
  - Latest dump: `../dogtag-private/postgres/postgres_dump-20260409.dump`.
  - Latest JSONForm: `chiditarod_21.json`.
  - XXII (2027) is race #22.

## Design

### Architecture

```
Browser
  ├─ /            → SPA (racer-facing)          frontend/  (Vite build → served by Rails)
  ├─ /api/v1/*    → JSON API (new controllers)  app/controllers/api/v1/
  └─ /admin pages → existing Rails HAML views   (unchanged)
Rails models, validators, Wisper listeners, Sidekiq workers, mailers: shared, unchanged in behavior
```

- **`frontend/`:** a new Vite + React + TS + Tailwind app, structured per Bulletproof React like cartographer's.
  - Production build output is served by Rails from `public/`.
  - The exact mount path and catch-all route are left to the builder (see "Left to the builder").
  - The Heroku build uses the existing `heroku/nodejs` + `heroku/ruby` buildpacks in `app.json`.
- **Switch:** an env var such as `REGISTRATION_UI=spa|legacy` controls where the homepage's "Get started" and the racer-facing entry points send people. Flipping it is the fallback mechanism.
- **Auth:**
  - Same-origin Authlogic session cookie, so there is no token auth.
  - The API exposes a CSRF token, and the SPA sends it on mutating requests.
  - Authorization uses the existing CanCanCan `Ability`.
- **API (`/api/v1`).** These are thin controllers over the existing models and the same validations. Errors are returned as `{ errors: { field: [messages] } }` so the SPA can show them inline.
  - `session`: login, logout, `me`
  - `users`: signup, password-reset request
  - `races`:
    - list and show
    - includes dates, open/closed state, `people_per_team`, current and next payment tier, `experience_labels`, and the JSONForm schema and form
  - `teams`: create, show (with checklist status), update
  - `teams/:id/people`: create, update, destroy
  - `past_racers`: see the next section
  - `teams/:id/questions`: show (schema + saved answers), update
  - `teams/:id/charges`: create, accepting the legacy Checkout token and reusing `ChargesController` logic through an extracted service

### Past-racer picker

- **Source:** `Person.joins(:team).where(teams: { user_id: current_user.id })`, across all races, excluding the current team.
- **Visibility:** only people from teams **the current user captained**. There is no global person search.
- **Dedupe:** by downcased email, keeping the most recent record.
- **Exclusions:**
  - placeholder people (email containing "unknown", matching `Person.registered_for_race`)
  - anyone already on the current team
- **Picking** copies the fields into a new `Person` on the current team. There is no link back to the old record, and no schema change. Editing changes only this year's record.
- **UI:**
  - Chips in each empty roster slot show the most recent first, with "+N more" opening a searchable list.
  - "Add someone new" opens the blank inline form.

### Inputs

- **Phone:** masked as `(312) 555-0144` while typing. It is normalized to the stored format the server validates (`312-555-0144`), and normalization happens server-side too so either format is accepted.
- **Email:** format checked on blur, and lowercased (the server already downcases).
- **Zip:** numeric mask.
- **Auto-advance:** moves to the next field when a masked field is complete. Tab and enter order follow the visual order.
- **Tooltips:** accessible, opening on focus, hover, or tap. They explain things like years racing, why we need phone and zip, and placeholder racers.
- **Validation:** client-side checks mirror the model validations. Server errors map back onto fields.

### Team checklist page

The page has a header and four numbered cards. Each card shows a status pill and can be done in any order.

- **Header:**
  - race name and date
  - registration close date
  - "N things left"
  - progress segments
  - edit link for team basics (name, description, team years racing)
- **Card 1, Racers:** the roster, described above.
- **Card 2, Team questions:**
  - Renders the race's JSONForm (see below).
  - Shows "Done" when answers are saved and valid.
- **Card 3, Registration fee:**
  - Shows the current tier price and when the next tier starts.
  - The Pay button opens legacy Stripe Checkout and posts the token to the API.
  - Hidden or replaced with waitlist messaging when the race is full (existing behavior).
- **Card 4, You're in!:**
  - Locked until the team is finalized.
  - Then shows the team number and the Classy fundraising page link, once the Classy job has created it.

### JSONForm in the SPA

- A small React renderer for the subset used by recent payloads:
  - `fieldset` sections with titles and help text
  - string fields
  - enums as select or radio
  - textarea
  - `pattern`, `maxLength` and `required`
  - `^Yes$` agreement checkboxes
- Validation runs client-side against the schema, and server-side in `TeamValidator` (unchanged).
- **#40:** the allowed answer keys are the schema's top-level `properties` keys. Remove `HACK_PARAM_WHITELIST` from both the legacy controller and the new API, so the fallback also benefits.
- **Constraint:** the legacy Joshfire renderer must still render the same payload, because of the fallback. Payloads therefore stay in the Joshfire format; the React renderer reads that format, and there is no new schema dialect.

### Years racing, configurable

- Add a per-race list of experience labels to `races`. Use a text array or a JSON text column; the builder picks, following the `text`-not-`string` convention.
- Admins edit it in the existing race admin form, one label per line, index = years.
- **Default:** copy of `Team::EXPERIENCE_LEVELS` plus a new entry for the 22nd year.
- A migration backfills existing races with the current list.
- Team and person forms (SPA and legacy) read labels from the race.
- The admin table and CSV export read labels from the team's race.
- Storage stays an integer index, so existing data keeps working.
- Remove the constant once nothing reads it.

### Reminder emails (#206)

- A daily sidekiq-cron job finds **unfinalized teams for open races** and emails the **captain** when any of these is true:
  1. a payment tier changes within the next 48 hours (the builder may tune the window)
  2. registration closes in 7 days
  3. registration closes in 24 hours. Issue #206 says "124 hours", which is read as a typo.
- **Idempotent:** each sent reminder is recorded in `sent_emails` (team, kind, tier/date `dedupe_key`; see Email delivery verification), so nothing is sent twice.
- **Content:**
  - what's still missing (the checklist status)
  - the price change or deadline
  - a link to the team page
- Respect the existing SMTP setup and `UserMailer` conventions, with i18n strings.

### Design system: "Chicago Flag"

- **Colors:**
  - background: pale flag blue `#f4f8fb`
  - accent: `#b3ddf2`
  - actions, stars, and "needs attention": star red `#e4002b` (`#c4001f` for text on light)
  - text: navy `#12202f`
  - links: site blue `#2f5aae`
  - cards: white
- **Type:** Oswald for headings (echoes the logo), Inter for body.
- **Assets:** the existing banner logo from chiditarod.org. Tone is playful ("Dress Up. Cause Chaos. DO GOOD."), but clear at the moment someone pays.
- **Responsive:** mobile-first, working at 320px+. Desktop is a centered single column with a wider roster.
- **Implementation:** Tailwind theme tokens, reusable later in Phase 2.

### Small fixes riding along (also apply to the legacy fallback)

- **#171:** missing i18n key `en.teams.update.success_fill_out_questions`.
- **#83:** welcome email hard-codes `dogtag.chiditarod.org`. Use the request/host config.
- **#143:** rake must not require Stripe env vars.
- **Comodo TrustLogo script:** remove the `document.write` script from the layout.
- **Live Stripe call in view:** remove the live `Stripe::Charge.retrieve` from `requirements/_payment_requirement.html.haml`, or move it out of view rendering.

## Launch operations (the yearly routine)

1. **Race XXII record:**
   - Copy last year's race record and requirements, shifting dates by one year as a starting point.
   - Three payment tiers.
   - The owner confirms final dates and prices before go-live.
2. **JSONForm XXII:** start from `chiditarod_21.json`.
   - Update year-specific text (orientation date/venue, food drive amounts, partner).
   - The owner reviews the text.
   - Commit the payload to `../dogtag-private/jsonform/chiditarod_22.json`.
3. **Experience labels:** add the 22nd-year label through the new admin field.
4. **Heroku:**
   - **`dogtag` is production** (`dogtag.chiditarod.org`, `heroku` remote) and **`dogtag-staging` is staging**.
   - Delete the `dogtag-22` app and remove its git remote. Deleting the app is irreversible, so confirm with the owner right before doing it.
   - Provision Postgres, Redis, a web dyno, and a worker dyno on `dogtag`.
   - Set config vars: Stripe live keys, Classy, SMTP (SendGrid), SendGrid event-webhook verification key, Rollbar, `REDIS_URL`, Sidekiq web auth.
   - Restore `postgres_dump-20260409.dump`, run migrations, and smoke test.
   - Stage first on `dogtag-staging`.
5. **Live test (production):**
   - Register a real team using production Stripe on a test race or a low-price requirement.
   - Confirm finalization, the Classy fundraising team, and the emails.
   - Refund the charge and remove the Classy team afterwards.
   - Requires the owner, who holds production credentials.
6. **Go live Dec 1.**

## Testing

- **RSpec:**
  - Request specs for every API endpoint, covering status codes plus data changes, authorization, and error shape.
  - Specs for the past-racer query (visibility, dedupe, exclusions).
  - Specs for reminder selection and idempotency.
  - Specs for the experience-label migration and backfill.
  - Specs for the #40 key derivation.
- **Classy gaps:**
  - Specs for `ClassyCacheOrgMemberCacher` and `ClassyFundraisingTeamEmail`.
  - A spec reproducing #162: a returning captain changes email, then Classy says "email address is already used".
- **Frontend:** Vitest + React Testing Library for inputs, the roster, and the JSONForm renderer.
- **Playwright e2e:**
  - Runs against Rails + the built SPA with a **docker-compose Postgres sidecar**, for local dev and local integration runs.
  - Covers the full racer path through `MockPaymentRequirement` and Stripe test mode.
  - Covers the past-racer picker with seeded history.
  - Existing `tests/` specs keep covering the legacy flow.

## Priority ladder if time runs short (Claude's call; owner to check)

Build in this order. Cut from the bottom.

1. **Launch-critical, needed for either UI:**
   - XXII race record and JSONForm
   - 22nd-year experience label (at minimum by appending to the constant)
   - Heroku provisioning and restore
   - #143, #171, #83
   - live test
2. **SPA core:**
   - API
   - auth
   - team checklist
   - roster with smart inputs
   - questions renderer + #40
   - payment
   - "You're in" card
3. **Email verification:**
   - layer 1 specs
   - layer 2 Mailpit e2e
   - layer 3 `sent_emails` log + `emails:verify`

   These are needed before the live test. The SendGrid webhook, admin page, and delivered/bounced status may follow shortly after Dec 1 if time is short.
4. **Past-racer picker.**
5. **#162 fix** (see below).
6. **Reminder emails.** These may ship after Dec 1, but must be live before the first tier change.
7. **Per-race experience labels** (column + admin field). If cut, the constant just gets the 22nd label.
8. **Classy spec gaps** beyond #162.

## Classy #162 (Claude's call)

Fix it for launch, not just reproduce it. Returning captains who changed their email hit "This email address is already used" in `ClassyUser#link_user_to_classy!`, and returning captains are exactly who the picker serves. Reproduce it in a spec first, then make the smallest change in `ClassyUser`/`ClassyClient`, for example looking up the existing Classy member by the old email or linking by Classy id. Avoid a broader Classy rewrite.

## Email delivery verification (owner decision: all three layers)

Production sends through **SendGrid** over SMTP (existing `SMTP_*` config). Emails must be verifiable programmatically at every level, not by "check your inbox".

### Layer 1: RSpec chain specs

Each spec runs with `Sidekiq::Testing.inline!` and asserts on `ActionMailer::Base.deliveries`: recipient, subject, and key links.

| Chain | Expected email |
|---|---|
| Signup (legacy controller and API) | welcome email |
| Password-reset request | reset email with a working token link |
| Finalization through Wisper → `TeamFinalizer` | team-finalized email |
| `ClassyCreateFundraisingTeam` (WebMock'd Classy) | Classy fundraising email with the fundraising page URL |
| Each reminder trigger | exactly one reminder. Running the job twice sends nothing new. Finalized teams and closed races get none. |

### Layer 2: Mailpit in docker-compose for local and e2e

- Add a **Mailpit** service (SMTP + HTTP API) alongside the Postgres sidecar.
- In development and the Playwright e2e environment, the app sends real SMTP to Mailpit.
- Playwright helpers query Mailpit's API to assert, per test:
  - the email arrived
  - its recipient and subject
  - links point at the right host (covers #83)
- Each test clears the Mailpit inbox before it runs.
- The password-reset e2e follows the emailed link to completion.
- The full-registration e2e asserts welcome + finalized emails.
- A reminder e2e triggers the reminder job and asserts the email.

### Layer 3: Outgoing log + SendGrid event webhook (staging/production)

- **`sent_emails` table:**
  - Columns:
    - mailer
    - action
    - recipient
    - subject
    - related records (`user_id`, `team_id`, `race_id` as applicable)
    - `kind` / `dedupe_key` (used for reminders)
    - SMTP `message_id`
    - status (`sent`, `failed`, `delivered`, `bounced`, `dropped`, `deferred`, `spam_report`)
    - error
    - timestamps
  - Written by an ActionMailer delivery observer/interceptor, so every mailer is covered without per-mailer code. Delivery exceptions record `failed`.
- **Correlation with SendGrid:**
  - Each outgoing message gets an `X-SMTPAPI` header with `unique_args: { sent_email_id: <id> }`.
  - SendGrid echoes this in event webhook payloads.
  - This avoids relying on SendGrid's own message id, which differs from the SMTP Message-ID.
- **Webhook endpoint (`POST /webhooks/sendgrid`):**
  - Verifies SendGrid's **signed event webhook** (ECDSA public key in a config var) and rejects unsigned requests.
  - Updates `sent_emails.status` from `processed`, `delivered`, `deferred`, `bounce`, `dropped` and `spamreport` events.
  - Must be idempotent, because SendGrid retries and batches events.
- **Setup:**
  - Configuring the event webhook URL and signing key in the SendGrid dashboard is an owner step.
  - Do it on staging first.
- **Admin page:** recent emails with filters by team, recipient, status, and kind. Linked from the team admin view.
- **Rake task:** `emails:verify[team_id]` prints each expected email for the team's current state and its status, then exits non-zero if any are missing or not `delivered`. Expected emails:
  - welcome
  - finalized
  - Classy fundraising
  - any reminders that were due
- **Reminder idempotency:** use `sent_emails` (`kind` + `dedupe_key` unique per team) instead of a separate reminders table.
- **Live production test:**
  - After the test registration, `emails:verify` must report all emails `delivered`.
  - Checking the actual inbox is optional, either by the owner or through the Gmail connector if the owner allows it.

## Go/no-go criteria (Nov 24)

All must be true to launch on the SPA:
- The full racer path passes in Playwright: signup, team, roster with picker, questions, payment, finalization.
- On staging with Stripe test mode, finalization triggers the Classy team creation job and the emails. A Classy sandbox is used if available; otherwise this step is verified in the production live test.
- Email layers 1 and 2 pass in CI and locally. On staging, `emails:verify` reports the test team's emails as at least `sent`, and as `delivered` once the SendGrid webhook is configured.
- No regressions in the RSpec suite. The legacy flow still works.
- The owner has clicked through it on a phone and a desktop.

## Workflow

- **The relaxed rules apply as soon as this doc is approved.** The CLAUDE.md rewrite is the first PR, but other work does not wait for it to merge.
- **CLAUDE.md is rewritten as part of this project.**
  - Remove:
    - the ban on Gemfile/config/initializer changes
    - "never push/never open PRs"
    - the `FrontdoorForm` guidance
    - the GoodJob references
  - Add:
    - the frontend stack
    - the API conventions
    - the `REGISTRATION_UI` switch
    - the launch checklist
  - Keep the rest (text columns, `params.expect`, i18n, testing style).
- **Branches and PRs:** work happens on feature branches pushed to `origin` (`ometa/dogtag`). PRs are opened against `chiditarod/dogtag`, matching how recent PRs (#250, #251) landed. **The owner reviews and merges every PR. Claude never merges.** Keep PRs small and independently mergeable so review keeps pace with the 13-day window, and stack branches when one PR depends on another.
- **Housekeeping:**
  - Add `.superpowers/` to `.gitignore`.
  - Secrets committed in plain text in dogtag-private should be rotated (Heroku long-term API key, old Rails secret, SSL keys). The owner does the rotation, and this is not blocking.

## Left to the builder

- SPA mount path and Rails catch-all routing, and how the Vite build lands in `public/`.
- Exact API payload shapes, and whether to add a serializer gem or hand-roll JSON.
- Phone/mask library choice, tooltip primitive, form library.
- Column type for experience labels; exact `sent_emails` columns and indexes; cron time of day.
- PR breakdown and order. Smaller PRs are preferred, and the ops steps are not PRs.

## Sequencing (beyond this doc)

- **Project 2 (after launch):**
  - SPA hardening
  - broader API mode
  - `stripe` gem upgrade and modern Checkout
  - deeper Playwright/Classy coverage
  - Puma
  - Devise evaluation
- **Project 3 (Phase 2):** merge dogtag and cartographer.
  - Dogtag becomes the racer- and race-admin-facing app.
  - Cartographer's admin handles routes and team assignments.
  - Finalized teams become cartographer's yearly inputs.
  - It gets its own deep research and brainstorm.
