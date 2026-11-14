# Dec 1 Relaunch + Registration Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relaunch dogtag on Heroku for CHIditarod XXII by Dec 1, 2026, with a new racer-facing Vite/React SPA, verifiable email delivery, reminder emails, and launch fixes. The existing Rails views remain as the fallback.

**Architecture:**
- The Rails 8 app gains a JSON API (`/api/v1`) over the existing models, validators, Wisper listeners and Sidekiq workers.
- A new `frontend/` Vite + React 19 + TS + Tailwind app is built into `public/register` and served under `/register/*`, matching cartographer's stack and Bulletproof React layout.
- An env switch, `REGISTRATION_UI=spa|legacy`, decides where racers enter.
- Admin pages stay HAML/Bootstrap 3.

**Tech Stack:**
- Backend: Ruby 3.4.8, Rails 8.0.4, PostgreSQL 17, Sidekiq 7 + sidekiq-cron, Authlogic 6, CanCanCan, jbuilder, stripe 1.58 (legacy Checkout), json-schema
- Frontend: React 19, React Router 7, TanStack Query 5, Tailwind 3, Vite 6, Vitest + Testing Library + MSW, ajv
- Tooling: Playwright, Mailpit, docker-compose

**Spec:** `docs/superpowers/specs/2026-11-11-dec1-relaunch-registration-design.md`. Read it before starting any task.

## Global Constraints

- **Dates:** go/no-go is **Nov 24, 2026**. Registration opens **Dec 1, 2026**.
- **Shared code paths:** payment, Classy and email behavior must flow through the existing model/worker code:
  - `Requirement#complete`
  - Wisper `*Auditor` listeners
  - `Team#finalize`
  - `Workers::TeamFinalizer`
  - `Workers::ClassyCreateFundraisingTeam`
  - `UserMailer`

  The API calls into these and never reimplements them.
- **Legacy flow:** the legacy racer flow (HAML views) must keep working after every task. It is the Nov 24 fallback.
- **Migrations:**
  - Create them with `bin/rails g migration`.
  - Use `text` for strings, never `string`/`varchar`.
  - Use `datetime`, never `timestamp`.
- **Ruby style:**
  - Strong params use `params.expect(...)`.
  - Use double-quoted strings.
  - Leave no trailing whitespace and end every file with a newline.
- **Specs:**
  - Use RSpec and FactoryBot.
  - Use `instance_double`, never `double`.
  - Use Timecop for time.
  - Use WebMock for Classy and StripeMock for Stripe.
  - Controller and request specs assert on status plus data changes.
  - The spec runner is `bundle exec rspec` (there is no `bin/rspec`).
- **API error shape:** every non-2xx JSON response is `{ "error": String, "errors": { "<field>": [String] } }`. `errors` may be `{}`.
- **Frontend:**
  - Use the cartographer stack and versions: React ^19, react-router-dom ^7.1, @tanstack/react-query ^5.62, tailwindcss ^3.4, vite ^6, typescript ^5.7.
  - Use the `@` alias for `src`.
  - Follow Bulletproof React feature folders: `src/features/<name>/{api,components}`.
- **Design tokens ("Chicago Flag"):**

  | Token | Value |
  |---|---|
  | page bg | `#f4f8fb` |
  | flag blue | `#b3ddf2` |
  | star red | `#e4002b` |
  | red text | `#c4001f` |
  | navy text | `#12202f` |
  | link blue | `#2f5aae` |
  | cards | `#ffffff` |
  | heading font | Oswald (500/700) |
  | body font | Inter (400–700) |

  The logo is `https://i0.wp.com/chiditarod.org/wp-content/uploads/2019/03/chiditarod-long-banner-logo-300x50.png`, vendored into `frontend/public/logo.png`.
- **Mobile-first:** pages work at 320px wide with no horizontal scroll.
- **Copy:** SPA copy lives in `frontend/src/locales/en.ts`. Rails public strings live in `config/locales/en.yml`.
- **Commits and PRs:**
  - One commit per task.
  - Each PR group is its own branch, pushed to `origin` (`ometa/dogtag`), with a PR opened against `chiditarod/dogtag` via `gh pr create --repo chiditarod/dogtag`.
  - **Never merge.** The owner merges.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Irreversible or production actions** (Heroku app deletion, production DB restore, live charges) need explicit owner confirmation at the time.

## Review Focus

1. **Pasted or odd phone formats.** Inputs like `+1 (312) 555-0144`, `312.555.0144`, `13125550144` and `312 555 0144` must all save as `312-555-0144`. Seven digits, or non-US numbers, must give a field error, not a 500. *(Task 14 spec, Task 23 test.)*
2. **Session expires mid-registration.** Any API 401 sends the SPA to `/register/login?next=<current path>`, and after login the user returns to the same page with nothing lost but the unsaved field. *(Task 19 test.)*
3. **Race closes, fills up, or reaches final-edits while the page is open.** Mutations return 422 or 403 with a human message. The SPA shows it inline and refetches the team. It must not white-screen. *(Task 14 spec, Task 22 test.)*
4. **Pay is clicked twice, or the page is reloaded mid-payment.** At most one charge and one `CompletedRequirement` per team+requirement. The second attempt returns 409 `already paid` without calling Stripe. *(Task 17 spec, Task 25 test.)*
5. **The past-racer picker sees edge cases.** These cases must be handled:
   - A captain with no past teams sees no chips (and no empty chip row).
   - "unknown" placeholder people never appear.
   - The same email across years appears once (most recent).
   - People already on this team are excluded.
   - Another user's racers never appear.

   *(Task 15 spec, Task 23 test.)*

---

## File structure

**Backend (new):**
- `app/controllers/api/v1/base_controller.rb`: JSON auth, CSRF and the error envelope
- `app/controllers/api/v1/{csrf,sessions,users,password_resets,races,teams,people,past_racers,questions,payments,mock_payments}_controller.rb`
- `app/views/api/v1/**/*.json.jbuilder`
- `app/controllers/spa_controller.rb`: serves `public/register/index.html`
- `app/controllers/webhooks/sendgrid_controller.rb`
- `app/controllers/sent_emails_controller.rb`: admin email log
- `app/models/sent_email.rb`
- `app/services/team_checklist.rb`, `app/services/past_racers.rb`, `app/services/payments/charge_team.rb`, `app/services/email_verifier.rb`, `app/services/reminder_selector.rb`, `app/services/sendgrid_signature.rb`, `app/services/registration_ui.rb`
- `app/mailers/mail_tracking.rb`: interceptor + observer
- `app/workers/workers/registration_reminders.rb`
- `lib/tasks/emails.rake`
- `spec/support/api_helpers.rb`
- `spec/requests/api/v1/*_spec.rb`

**Backend (modified):** routes, ability, the questions/users/charges/teams/people controllers, models race/person/team, `user_mailer.rb` + templates, initializers stripe/sidekiq, `config/environments/*`, `config/schedule.yml`, `lib/json_form.rb`, `lib/classy_user.rb`, `docker-compose.yml`, `.circleci/config.yml`, `package.json`, `playwright.config.ts`, `CLAUDE.md`, `README.md`.

**Frontend (new, `frontend/`):**
- `src/app/{index,provider,router}.tsx`, `src/app/routes/*`
- `src/lib/{api-client,react-query,stripe-checkout}.ts`
- `src/locales/en.ts`
- `src/components/ui/{button,card,badge,field,info-tip,progress-segments}.tsx`
- `src/components/layouts/register-layout.tsx`
- `src/components/inputs/{phone-input,email-input,zip-input,use-auto-advance}.ts(x)`
- `src/features/auth/*`, `src/features/races/*`, `src/features/teams/*` (checklist, header, cards), `src/features/roster/*` (roster, slot, person form, past-racer chips), `src/features/questions/*` (jsonform renderer), `src/features/payments/*`

**E2E:** `tests/spa/*.spec.ts` and `tests/helpers/mailpit.ts`.

---

## PR 1: `chore/claude-md-and-plan` (branch from `design/dec1-relaunch`)

### Task 1: Rewrite CLAUDE.md for the new working rules

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md` (dev setup section)

**Interfaces:**
- Consumes: none
- Produces: the conventions every later task follows

- [ ] **Step 1: Edit CLAUDE.md.**
  - Remove:
    - "NEVER modify the Gemfile, Rails configuration or initializers…"
    - "NEVER run `git push` or try to open PRs"
    - the "Use dogtag (`../dogtag`) for Playwright…" line
    - all `FrontdoorForm` guidance
    - the "By default tests use GoodJob…" line
  - Replace with:
    - "Feature branches are pushed to `origin`, and PRs are opened against `chiditarod/dogtag`. Never merge; the owner merges."
    - "Gemfile/config changes are allowed when a task needs them; call them out in the PR body."
    - Background jobs are Sidekiq (`Workers::*`, `include Workers::Common`, `run(job, log)`). Specs run in Sidekiq fake mode; use `Sidekiq::Testing.inline!` blocks for chains.
    - Forms in legacy views are hand-written Bootstrap 3 `form_for`.
  - Add sections:
    - **Frontend** (`frontend/`, stack, `npm --prefix frontend run dev|build|test`, served under `/register`)
    - **API conventions** (`/api/v1`, error shape from Global Constraints, jbuilder views, CSRF via `X-CSRF-Token`)
    - **`REGISTRATION_UI` switch**
    - **Yearly launch checklist** (copy the spec's "Launch operations")
- [ ] **Step 2: Update README.md** to add `docker compose up -d db redis mailpit`, the frontend dev commands, and `REGISTRATION_UI`.
- [ ] **Step 3: Commit, push and open the PR.**

```bash
git add CLAUDE.md README.md docs/superpowers/plans/2026-11-11-dec1-relaunch-registration.md
git commit -m "Update CLAUDE.md working rules; add Dec 1 implementation plan"
git push -u origin design/dec1-relaunch
gh pr create --repo chiditarod/dogtag --base main --head ometa:design/dec1-relaunch --title "Dec 1 relaunch: design, plan, CLAUDE.md rules"
```

---

## PR 2: `fix/launch-hardening` (branch from `main`)

### Task 2: Security fixes (role escalation, question ownership, client-set charge amount)

**Findings.** Each is confirmed in code:
- **Role escalation:** `users_controller.rb:79` permits `roles: []` for any user updating themselves, so any racer can make themselves admin.
- **Question ownership:** `QuestionsController#show/create` never checks that the team belongs to `current_user`.
- **Client-set charge amount:** `ChargesController#create` charges `params[:amount]` and `MockPaymentsController` records `params[:amount]`. Both are client-controlled.

**Files:**
- Modify: `app/controllers/users_controller.rb`
- Modify: `app/controllers/questions_controller.rb`
- Modify: `app/controllers/charges_controller.rb`
- Modify: `app/controllers/mock_payments_controller.rb`
- Test: `spec/controllers/users_controller_spec.rb`, `spec/controllers/questions_controller_spec.rb`, `spec/controllers/charges_controller_spec.rb`

**Interfaces:**
- Produces: `PaymentRequirement#amount_due_cents -> Integer | nil`, the active tier price. Task 17 uses it.

- [ ] **Step 1: Write the failing tests.**

```ruby
# users_controller_spec.rb
it "ignores roles when a non-admin updates themselves" do
  user = FactoryBot.create(:user); login_user!(user)
  patch :update, params: { id: user.id, user: { first_name: "X", roles: ["admin"] } }
  expect(user.reload.is?(:admin)).to be(false)
  expect(user.first_name).to eq("X")
end
it "lets an admin set roles" # admin_user updates another user to operator -> is?(:operator) true

# questions_controller_spec.rb
it "forbids saving answers to another user's team" # other user's team -> answers unchanged, response not 2xx/redirect-with-success
it "forbids viewing another user's team questions"

# charges_controller_spec.rb
it "charges the active tier price, not params[:amount]" # params amount: 100 -> Stripe charge amount == tier.price (5000)
```

- [ ] **Step 2: Run the tests and confirm they fail.**

  Run: `bundle exec rspec spec/controllers/users_controller_spec.rb spec/controllers/questions_controller_spec.rb spec/controllers/charges_controller_spec.rb`

  Expected: the new examples FAIL.
- [ ] **Step 3: Implement the fixes.**
  - **Users:** `user_params` uses `params.expect(user: [...])` without roles. Merge `roles` only when `current_user.is?(:admin)`.
  - **Questions:**
    - Load the team with `@team = Team.find(params[:team_id])`, then call `authorize! :update, @team` in `create` and `authorize! :show, @team` in `show`.
    - Ability `Team :show` already covers owners. Operators and admins keep access through their ability rules.
  - **`PaymentRequirement#amount_due_cents`:** returns `active_tier&.price`, or `nil` when no tier is active.
  - **Charges:**
    - Charge `req.amount_due_cents`.
    - Store that amount in `@cr_metadata["amount"]`.
    - If it is nil, flash the error and redirect.
  - **Mock payments:** record `requirement.amount_due_cents`.
- [ ] **Step 4: Run the tests and confirm they pass.** Run the command from Step 2, then `bundle exec rspec`.

  Expected: PASS, with no regressions.
- [ ] **Step 5: Commit.** Message: `Fix role escalation, question ownership, and client-controlled charge amount`

### Task 3: Launch fixes #143, #171, #83, TrustLogo, live Stripe call in view

**Files:**
- Modify: `config/initializers/stripe.rb`
- Modify: `config/locales/en.yml`
- Modify: `config/environments/{production,development,test}.rb`
- Modify: `app/views/user_mailer/*` (welcome + team_finalized html/text)
- Modify: `app/views/layouts/application.html.haml:19-42`
- Modify: `app/views/requirements/_payment_requirement.html.haml:1-5`
- Modify: `app/controllers/charges_controller.rb#refund`
- Create: `app/services/registration_ui.rb`
- Tests: `spec/mailers/user_mailer_spec.rb`, `spec/controllers/teams_controller_spec.rb`, `spec/controllers/charges_controller_spec.rb`

**Interfaces:**
- Produces:
  - `ENV["APP_HOST"]`, used for `config.action_mailer.default_url_options = { host: ENV.fetch("APP_HOST", "localhost:3000"), protocol: (production ? "https" : "http") }`
  - `CompletedRequirement#metadata["refunded"] == true` after a refund
  - `app/services/registration_ui.rb`:
    - `RegistrationUi.spa? -> Boolean`: true when `ENV["REGISTRATION_UI"] == "spa"`.
    - `RegistrationUi.team_url(team) -> String`: `"https://#{ENV.fetch("APP_HOST")}/register/teams/#{team.id}"` when SPA, otherwise the legacy `team_url(team)` built from mailer `default_url_options`.
    - The team-finalized email links through it.
    - Tasks 10 and 18 use it.

- [ ] **Step 1: Write the failing tests.**

```ruby
it "welcome email links use the configured mailer host" do
  allow(UserMailer).to receive(:default_url_options).and_return(host: "staging.example.org", protocol: "https")
  mail = UserMailer.welcome_email(FactoryBot.create(:user))
  expect(mail.body.encoded).to include("staging.example.org")
  expect(mail.body.encoded).not_to include("dogtag.chiditarod.org")
end
it "team update without answers flashes a real translation" do
  # PATCH teams#update on team whose race has jsonform and team has no answers
  expect(flash[:notice]).not_to match(/translation missing/i)
end
it "refund marks the completed requirement refunded" # StripeMock refund -> cr.reload.metadata["refunded"] == true
```

- [ ] **Step 2: Run the tests and confirm they fail.**

  Run: `bundle exec rspec spec/mailers/user_mailer_spec.rb spec/controllers/teams_controller_spec.rb spec/controllers/charges_controller_spec.rb`

  Expected: FAIL.
- [ ] **Step 3: Implement the fixes.** Add `RegistrationUi` (see Interfaces).
  - **#143:** `stripe.rb` logs a warning instead of raising when the keys are absent.
  - **#171:** fix the key path so `I18n.t("teams.update.success_fill_out_questions", raise: true)` resolves (the key sits under the wrong parent at `en.yml:198`), and make the controller use that full key.
  - **#83:** mailer templates use `root_url`/`team_url(team)`.
  - **TrustLogo:** delete the layout's Comodo block (lines 19-22 and 39-42).
  - **Payment card:** `_payment_requirement` reads `cr.metadata["refunded"]` instead of calling `Stripe::Charge.retrieve`.
  - **Refund:** `refund` sets `metadata["refunded"] = true` on the matching CR. Find it with `CompletedRequirement.where("metadata LIKE ?", "%#{@charge.id}%")`, or the existing `delete_by_charge` lookup pattern.
- [ ] **Step 4: Verify.**
  - `bundle exec rspec`: PASS.
  - `env -u STRIPE_PUBLISHABLE_KEY -u STRIPE_SECRET_KEY bin/rails runner 'puts :ok'` prints `ok`.
- [ ] **Step 5: Commit.** Message: `Launch fixes: optional Stripe env for rake, i18n key, mailer host, drop TrustLogo and view-time Stripe call`

### Task 4: Derive allowed question keys from the race schema (#40)

**Files:**
- Modify: `lib/json_form.rb`
- Modify: `app/controllers/questions_controller.rb` (delete `HACK_PARAM_WHITELIST`, `question_params`)
- Test: `spec/lib/json_form_spec.rb`, `spec/controllers/questions_controller_spec.rb`

**Interfaces:**
- Produces: `JsonForm.filter_answers(race, params) -> Hash{String=>String}`. It keeps only `race.question_fields` keys, drops blanks and stringifies keys. Task 18 uses it.

- [ ] **Step 1: Write the failing tests.**

```ruby
it "keeps schema keys and drops unknown and blank keys" do
  race = FactoryBot.create(:race_with_jsonform)
  key = race.question_fields.first
  params = ActionController::Parameters.new(key => "v", "evil" => "x", race.question_fields.second => "")
  expect(JsonForm.filter_answers(race, params)).to eq({ key => "v" })
end
it "saves a key that was never in the old whitelist" # race schema with property "brand-new-q" -> team.jsonform includes it
```

- [ ] **Step 2: Run** `bundle exec rspec spec/lib/json_form_spec.rb spec/controllers/questions_controller_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Implement** `JsonForm.filter_answers` with `params.to_unsafe_h.slice(*race.question_fields)`, rejecting blank values. Switch `QuestionsController#create` to use it.
- [ ] **Step 4: Run** the tests from Step 2. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `Derive allowed JSONForm answer keys from race schema (#40)`

### Task 5: Per-race experience labels

**Files:**
- Create: migration `AddExperienceLabelsToRaces`
- Modify: `app/models/race.rb`
- Modify: `app/models/team.rb` (remove `EXPERIENCE_LEVELS`; update `export`)
- Modify: `app/views/teams/_form.html.haml:21`, `app/views/people/_form.html.haml:33`, `app/views/teams/_table.html.haml`
- Modify: race admin form `app/views/races/_form.html.haml`, plus `RacesController` permitted params
- Test: `spec/models/race_spec.rb`, `spec/models/team_spec.rb`, `spec/controllers/races_controller_spec.rb`

**Interfaces:**
- Produces:
  - `Race::DEFAULT_EXPERIENCE_LABELS` (frozen Array: the old 22 entries plus `"22nd year: old enough to know better"`)
  - `Race#experience_labels -> Array<String>`: the column value, or the default when empty
  - `Race#experience_label(index) -> String`: returns `"#{index} years"` when out of range
  - `Race#experience_labels_text=(String)`: newline-separated input for the admin form

- [ ] **Step 1: Write the failing tests.**

```ruby
it "defaults to the built-in labels incl. 22nd year" do
  expect(Race.new.experience_labels.size).to eq(23)
  expect(Race.new.experience_labels.last).to start_with("22nd year")
end
it "uses admin-entered labels" do
  race = FactoryBot.create(:race); race.update!(experience_labels_text: "Rookie\nVet\n")
  expect(race.reload.experience_labels).to eq(%w[Rookie Vet])
end
it "falls back for out-of-range index" do
  expect(FactoryBot.build(:race, experience_labels: ["a"]).experience_label(4)).to eq("4 years")
end
it "export emits the label, not the integer" # Team.export(race.id) row contains race.experience_label(team.experience)
```

- [ ] **Step 2: Run** `bundle exec rspec spec/models/race_spec.rb spec/models/team_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Write the migration.**
  - Column: `add_column :races, :experience_labels, :text, array: true, default: [], null: false`.
  - Data backfill: `Race.update_all(experience_labels: <old 22 labels>)`. Use a SQL literal so the migration doesn't depend on the model constant.
  - Run `bin/rails db:migrate` and `RAILS_ENV=test bin/rails db:migrate`.
- [ ] **Step 4: Update the model, views and admin form.** Add the textarea `experience_labels_text`, and update the race factory if needed. Run all specs. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `Make years-racing labels configurable per race`

### Task 6: Classy #162, a returning captain whose email is already a Classy member

**Files:**
- Modify: `lib/classy_user.rb:67-80`
- Test: `spec/lib/classy_user_spec.rb`

**Interfaces:**
- Consumes: `ClassyClient#get_member(id_or_email)` (existing)
- Produces: `link_user_to_classy!` never returns silently without setting `user.classy_id`. It either sets it or raises `TransientError`.

- [ ] **Step 1: Read the issue.** Run `gh issue view 162 --repo chiditarod/dogtag` and mirror its scenario. With WebMock:
  - `create_member` returns 400 `email_address: ["This email address is already used"]`
  - `create_supporter` returns 400 `member_id: ["... is already a supporter for Organization ..."]`
  - `ClassyCacheOrgMember` has no row

  Write two tests:
  - `it "looks up the member by email when the cache misses"`: `get_member(email)` returns `{ "id" => 777 }`, so `user.reload.classy_id == 777`.
  - `it "raises TransientError when the member cannot be found"`: `get_member` returns 404, so `expect { ... }.to raise_error(TransientError)`.
- [ ] **Step 2: Run** `bundle exec rspec spec/lib/classy_user_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Implement.** When the cache record is nil, call `cc.get_member(user.email)`. On success, set `user.classy_id` from `["id"]` and save. Otherwise raise `TransientError`.
- [ ] **Step 4: Run** the spec. Expected: PASS.
- [ ] **Step 5: Commit, push and open the PR.** Message: `Classy: fall back to member lookup by email when cache misses (#162)`

```bash
git push -u origin fix/launch-hardening
gh pr create --repo chiditarod/dogtag --base main --head ometa:fix/launch-hardening --title "Launch hardening: security fixes, #40, #83, #143, #162, #171, configurable experience labels"
```

---

## PR 3: `feat/email-verification` (branch from `fix/launch-hardening`)

### Task 7: `sent_emails` log, mail tracking, SendGrid correlation header

**Files:**
- Create: migration `CreateSentEmails`
- Create: `app/models/sent_email.rb`
- Create: `app/mailers/mail_tracking.rb`
- Create: `config/initializers/mail_tracking.rb`
- Modify: `app/mailers/user_mailer.rb`
- Test: `spec/models/sent_email_spec.rb`, `spec/mailers/mail_tracking_spec.rb`

**Interfaces:**
- Produces:
  - Table `sent_emails`:

    | Column | Type |
    |---|---|
    | `mailer` | text |
    | `action` | text |
    | `recipient` | text |
    | `subject` | text |
    | `user_id` | bigint |
    | `team_id` | bigint |
    | `race_id` | bigint |
    | `kind` | text |
    | `dedupe_key` | text |
    | `message_id` | text |
    | `status` | text, default `"queued"` |
    | `error` | text |
    | `status_changed_at` | datetime |
    | timestamps | |

    Indexes on `team_id`, `status` and `message_id`, plus a **unique index on `[team_id, kind, dedupe_key]` where `dedupe_key IS NOT NULL`**.
  - `SentEmail::STATUSES = %w[queued sent delivered deferred bounced dropped spam_report]`
  - `SentEmail#delivered? -> Boolean`
  - Header contract read by the interceptor and stripped before send: `X-Dogtag-Team-Id`, `X-Dogtag-User-Id`, `X-Dogtag-Race-Id`, `X-Dogtag-Kind`, `X-Dogtag-Dedupe-Key`
  - `UserMailer#track(kind:, team: nil, user: nil, dedupe_key: nil)`, a private helper that sets those headers. Every existing mailer action calls it with these kinds: `welcome`, `password_reset`, `team_finalized`, `team_waitlisted`, `classy_fundraising`.
  - `MailTracking.delivering_email(message)` (interceptor):
    - creates a `SentEmail` with status `queued`
    - sets `message["X-SMTPAPI"] = { unique_args: { sent_email_id: id } }.to_json`
    - stores `message_id`
  - `MailTracking.delivered_email(message)` (observer): sets status `sent` and `status_changed_at`.

- [ ] **Step 1: Write the failing tests.**

```ruby
it "logs a sent welcome email with kind and user" do
  user = FactoryBot.create(:user)
  UserMailer.welcome_email(user).deliver_now
  e = SentEmail.last
  expect([e.kind, e.user_id, e.recipient, e.status]).to eq(["welcome", user.id, user.email, "sent"])
  expect(JSON.parse(ActionMailer::Base.deliveries.last["X-SMTPAPI"].value)).to eq({ "unique_args" => { "sent_email_id" => e.id } })
  expect(ActionMailer::Base.deliveries.last["X-Dogtag-Kind"]).to be_nil
end
it "rejects a duplicate dedupe_key for the same team and kind" # second create! raises ActiveRecord::RecordNotUnique
```

- [ ] **Step 2: Run** `bundle exec rspec spec/models/sent_email_spec.rb spec/mailers/mail_tracking_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Implement.** Write the migration (then migrate dev and test), the model, the interceptor/observer, the initializer registration (`ActionMailer::Base.register_interceptor` / `register_observer`), and the `track` calls in `UserMailer`.
- [ ] **Step 4: Run** `bundle exec rspec`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `Log every outgoing email with SendGrid correlation id`

### Task 8: Email chain specs (layer 1) and `emails:verify`

**Files:**
- Create: `app/services/email_verifier.rb`
- Create: `lib/tasks/emails.rake`
- Test: `spec/integration/email_chains_spec.rb`, `spec/services/email_verifier_spec.rb`

**Interfaces:**
- Produces:
  - `EmailVerifier.new(team).report -> Array<{kind: String, status: String|nil, ok: Boolean}>`
    - Expected kinds: `welcome` (captain), `team_finalized` if `team.finalized`, and `classy_fundraising` if `team.classy_id` is present. Plus one row per `registration_reminder` sent for the team.
    - `ok` is true only when status is `delivered`, or when status is `sent` and `ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"]` is blank.
  - `EmailVerifier#ok? -> Boolean`
  - Rake task `emails:verify[team_id]` prints one line per row (`kind  status  OK|MISSING|NOT DELIVERED`) and calls `exit 1` unless `ok?`.

- [ ] **Step 1: Write the chain specs.** Run every chain inside `Sidekiq::Testing.inline! { ... }`. Assert on `ActionMailer::Base.deliveries` and `SentEmail`.
  - `"signup sends welcome"`: `post :create` on UsersController, then one delivery to the user with subject `"Welcome to dogTag"`.
  - `"password reset email contains a working edit link"`: `user.reset_password!("example.org")`. The body includes `edit_password_reset_url(user.reload.perishable_token, host: "example.org")`.
  - `"finalizing a team sends team_finalized and classy_fundraising"`:
    - Setup: a race `:with_classy_data`, WebMock stubs for `get_campaign`, `create_member`, `create_fundraising_team` and `create_fundraising_page`, and the last payment completed.
    - Expected: the subjects include `"Registration Confirmed for"` and `"Fundraising is ready for"`.
  - `"EmailVerifier reports MISSING when finalized email absent"` and `"ok when all expected are sent"`.
- [ ] **Step 2: Run** `bundle exec rspec spec/integration/email_chains_spec.rb spec/services/email_verifier_spec.rb`. Expected: the verifier specs FAIL. Chain specs that fail reveal real gaps; fix the code, not the spec.
- [ ] **Step 3: Implement** `EmailVerifier` and the rake task.
- [ ] **Step 4: Run** `bundle exec rspec`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `Add email chain specs and emails:verify rake task`

### Task 9: SendGrid signed event webhook + admin email log

**Files:**
- Create: `app/services/sendgrid_signature.rb`
- Create: `app/controllers/webhooks/sendgrid_controller.rb`
- Create: `app/controllers/sent_emails_controller.rb`
- Create: `app/views/sent_emails/index.html.haml`
- Modify: `config/routes.rb` (before the catch-all)
- Modify: `app/models/ability.rb` (operator: `can :index, SentEmail`)
- Modify: `app/views/teams/show.html.haml` (operators get a link to the team's emails)
- Test: `spec/services/sendgrid_signature_spec.rb`, `spec/requests/webhooks/sendgrid_spec.rb`, `spec/controllers/sent_emails_controller_spec.rb`

**Interfaces:**
- Produces:
  - `SendgridSignature.valid?(payload:, signature:, timestamp:, public_key:) -> Boolean`
    - Verifies an ECDSA P-256 SHA256 signature over `timestamp + payload`.
    - `public_key` is the base64 DER string from `ENV["SENDGRID_WEBHOOK_PUBLIC_KEY"]`.
    - Headers: `X-Twilio-Email-Event-Webhook-Signature` and `X-Twilio-Email-Event-Webhook-Timestamp`.
  - `POST /webhooks/sendgrid`:
    - Skips CSRF.
    - Returns 401 on a bad or missing signature.
    - Takes a JSON array of events and maps `event` to `status` with `{ "processed"=>"sent", "delivered"=>"delivered", "deferred"=>"deferred", "bounce"=>"bounced", "dropped"=>"dropped", "spamreport"=>"spam_report" }`, finding the row by `sent_email_id`.
    - **Never downgrade:** a terminal status (`delivered`, `bounced`, `dropped`, `spam_report`) is not overwritten by `sent` or `deferred`.
    - Returns 200 even for unknown ids.
  - `GET /sent_emails?team_id=&status=&kind=&recipient=` (operator+), paginated with kaminari.

- [ ] **Step 1: Write the failing tests.**
  - In the specs, generate a key with `OpenSSL::PKey::EC.generate("prime256v1")` and sign the test payloads with it.
  - Signature: valid gives true; a tampered payload gives false; a wrong key gives false.
  - Request:
    - unsigned gives 401 with no change
    - a signed `delivered` event changes the status to `delivered`
    - replaying the same event is still `delivered` (idempotent)
    - `deferred` after `delivered` stays `delivered`
    - an unknown id gives 200
  - Controller: a racer gets denied; an operator sees rows filtered by `team_id`.
- [ ] **Step 2: Run** `bundle exec rspec spec/services/sendgrid_signature_spec.rb spec/requests/webhooks spec/controllers/sent_emails_controller_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Implement** the signature service, the webhook controller, and the admin index and route.
- [ ] **Step 4: Run** `bundle exec rspec`. Expected: PASS.
- [ ] **Step 5: Commit, push and open the PR.** Message: `SendGrid signed event webhook and admin email log`. PR title: `Email delivery verification (sent_emails log, chain specs, emails:verify, SendGrid webhook)`, base `fix/launch-hardening` (stacked; note in the body that it merges after PR 2).

---

## PR 4: `feat/registration-reminders` (branch from `feat/email-verification`)

### Task 10: Reminder emails (#206)

**Files:**
- Create: `app/services/reminder_selector.rb`
- Create: `app/workers/workers/registration_reminders.rb`
- Create: `app/views/user_mailer/registration_reminder.{html.haml,text.erb}`
- Modify: `app/mailers/user_mailer.rb`
- Modify: `config/schedule.yml`
- Modify: `config/locales/en.yml`
- Test: `spec/services/reminder_selector_spec.rb`, `spec/workers/registration_reminders_spec.rb`, `spec/mailers/user_mailer_spec.rb`

**Interfaces:**
- Consumes: `SentEmail` unique `[team_id, kind, dedupe_key]` (Task 7), `PaymentRequirement#next_tiers`, `Race#registration_close`, `RegistrationUi.team_url` (Task 3)
- Produces:
  - `ReminderSelector.new(now: Time.zone.now).due -> Array<Reminder>`, where `Reminder = Data.define(:team, :kind, :dedupe_key, :details)`.
    - Teams considered: `Team.all_unfinalized` in races where `open_for_registration?`.
    - Kinds:
      - `"tier_change"`: an enabled `PaymentRequirement` has a next tier with `begin_at` in `(now, now + 48.hours]`. `dedupe_key` is `"tier-#{tier.id}"` and `details` is `{ new_price_cents:, begins_at: }`.
      - `"closing_week"`: `registration_close` is in `(now + 6.days, now + 7.days]`. `dedupe_key` is `"close-7d"`.
      - `"closing_day"`: `registration_close` is in `(now, now + 24.hours]`. `dedupe_key` is `"close-24h"`.
    - Already-sent combinations (an existing `SentEmail` row) are excluded.
  - `UserMailer.registration_reminder(team, kind, details)`:
    - Sent to the captain only.
    - Subject is `"#{race.name}: #{t(".subject_#{kind}")}"`.
    - The body lists missing checklist items: racers `x of y`, questions not done, fee unpaid.
    - Calls `track(kind: "registration_reminder", team:, dedupe_key:)`.
  - `Workers::RegistrationReminders#run(job, log)` delivers each due reminder with `deliver_now`, rescuing `ActiveRecord::RecordNotUnique` per reminder.
  - `schedule.yml` entry `registration_reminders: cron "0 15 * * *"` (9am Central), class `Workers::RegistrationReminders`, queue `default`.

- [ ] **Step 1: Write the failing tests.** Use Timecop throughout.
  - `"selects tier_change 47h before a tier"` and `"not 49h before"`.
  - `"selects closing_week at 6.5 days"` and `"closing_day at 23h"`.
  - `"skips finalized teams"`, `"skips closed races"`, `"skips when already sent"`.
  - Worker: `"sends once, sends nothing on second run"`: deliveries count is 1, then still 1.
  - Mailer: `"lists what is missing and links to the team page"`.
- [ ] **Step 2: Run** `bundle exec rspec spec/services/reminder_selector_spec.rb spec/workers/registration_reminders_spec.rb spec/mailers/user_mailer_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Implement** the selector, mailer, templates, i18n, worker and schedule.
- [ ] **Step 4: Run** `bundle exec rspec`. Expected: PASS. Then verify locally that the cron loads: `bundle exec sidekiq -C config/sidekiq.yml` should log the `registration_reminders` cron job. If sidekiq-cron does not auto-load `schedule.yml`, add `Sidekiq::Cron::Job.load_from_hash YAML.load_file(...)` in `configure_server`.
- [ ] **Step 5: Commit, push and open the PR** (stacked on PR 3). Message: `Daily registration reminder emails to captains (#206)`

---

## PR 5: `feat/api-v1` (branch from `fix/launch-hardening`)

### Task 11: API base, CSRF, sessions, signup, password reset

**Files:**
- Create: `app/controllers/api/v1/{base,csrf,sessions,users,password_resets}_controller.rb`
- Create: `app/views/api/v1/users/_user.json.jbuilder`
- Create: `spec/support/api_helpers.rb`
- Modify: `spec/spec_helper.rb` (require `spec/support/**/*.rb`)
- Modify: `config/routes.rb` (an `api/v1` namespace placed before the `*path` catch-all)
- Test: `spec/requests/api/v1/{csrf,sessions,users,password_resets}_spec.rb`

**Interfaces:**
- Produces:
  - `Api::V1::BaseController < ActionController::Base`:
    - `protect_from_forgery with: :exception`, with CSRF read from the `X-CSRF-Token` header
    - `current_user` (Authlogic `UserSession.find&.record`)
    - `require_api_user!`: returns 401 `{error:"not_authenticated", errors:{}}`
    - `render_errors(record_or_message, status:)`
  - Rescues:

    | Exception | Status |
    |---|---|
    | `CanCan::AccessDenied` | 403 |
    | `ActiveRecord::RecordNotFound` | 404 |
    | `ActionController::ParameterMissing` | 400 |
    | `ActionController::InvalidAuthenticityToken` | 422 `{error:"invalid_csrf"}` |
  - `GET /api/v1/csrf` returns `{ token }`.
  - `GET /api/v1/me` returns `{ user: {id, first_name, last_name, email, phone} }`, or 401.
  - `POST /api/v1/session {email, password, remember_me}` returns 200 `{user}` or 422 `{error:"login_failed"}`. `DELETE /api/v1/session` returns 204.
  - `POST /api/v1/users {user:{first_name,last_name,email,phone,password,password_confirmation}}`:
    - Returns 201 `{user}`, logs the user in, and enqueues `Workers::WelcomeEmail`.
    - Returns 422 with field errors on invalid input.
    - **No roles accepted.**
  - `POST /api/v1/password_resets {email}` always returns 202, so the response doesn't reveal whether an account exists. It calls `reset_password!(request.host_with_port)` when the user exists.
  - `ApiHelpers#api_login(user)` (posts to the session endpoint) and `ApiHelpers#json`, for request specs.

- [ ] **Step 1: Write the failing request specs** for each endpoint above. Cover the status codes, `UserSession.find` after login, and the welcome job enqueued (`Workers::WelcomeEmail.jobs.size == 1`). Also cover the CSRF case: a POST without the token gets 422 when `ActionController::Base.allow_forgery_protection = true` is set inside the example.
- [ ] **Step 2: Run** `bundle exec rspec spec/requests/api/v1`. Expected: FAIL.
- [ ] **Step 3: Implement** the controllers, jbuilder views and routes.
- [ ] **Step 4: Run** `bundle exec rspec`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `API v1: base controller, CSRF, session, signup, password reset`

### Task 12: Races endpoints

**Files:**
- Create: `app/controllers/api/v1/races_controller.rb`
- Create: `app/views/api/v1/races/{index,show,_race}.json.jbuilder`
- Test: `spec/requests/api/v1/races_spec.rb`

**Interfaces:**
- Produces: `GET /api/v1/races` lists `Race.current` and `GET /api/v1/races/:id`. Public, no login. Race JSON fields:

  | Field | Source |
  |---|---|
  | `id`, `name` | |
  | `race_datetime`, `registration_open`, `registration_close`, `final_edits_close` | ISO8601 |
  | `open_for_registration` | `open_for_registration?` |
  | `full` | `full?` |
  | `people_per_team` | |
  | `experience_labels` | `Race#experience_labels` |
  | `jsonform` | parsed race jsonform, or null |
  | `stripe_publishable_key` | `Rails.configuration.stripe[:publishable_key]` |
  | `payment_requirements` | `[{ id, name, type, current_price_cents, next_tier: {price_cents, begins_at} \| null }]` |

- [ ] **Step 1: Write failing specs** asserting these fields for a race with `payment_requirement_with_tier` plus a future `tier3`.
- [ ] **Step 2: Run** `bundle exec rspec spec/requests/api/v1/races_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Implement** the controller, views and routes.
- [ ] **Step 4: Run** the spec. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `API v1: races`

### Task 13: Team checklist service

**Files:**
- Create: `app/services/team_checklist.rb`
- Test: `spec/services/team_checklist_spec.rb`

**Interfaces:**
- Produces: `TeamChecklist.new(team).to_h`:

  ```ruby
  {
    racers:    { filled: Integer, total: Integer, done: Boolean },
    questions: { required: Boolean, done: Boolean },
    fee:       { done: Boolean, amount_due_cents: Integer|nil, paid_cents: Integer, next_tier: {price_cents:, begins_at:}|nil, requirement_id: Integer|nil },
    finalized: Boolean,
    remaining: Integer,          # count of not-done among racers/questions/fee
    team_number: Integer|nil,
    classy_fundraising_url: String|nil
  }
  ```

  The Classy URL is `"https://www.classy.org/fundraising-team/#{team.classy_id}"`, or nil. Confirm the URL format against `app/views/user_mailer/classy_fundraising_team_created*`.

- [ ] **Step 1: Write failing specs** for each case:
  - an empty team gives `remaining == 3`
  - a full roster gives `racers.done`
  - a race without jsonform gives `questions.required == false` and `done == true`
  - a paid team gives `fee.done` and `paid_cents == 5000`
  - a finalized team gives `team_number` set
- [ ] **Step 2: Run** `bundle exec rspec spec/services/team_checklist_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Implement** the service using `Team#people`, `#completed_questions?`, `#completed_all_requirements?`, `#money_paid_in_cents`, `PaymentRequirement#amount_due_cents` and `#next_tiers`.
- [ ] **Step 4: Run** the spec. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `TeamChecklist service`

### Task 14: Teams and people endpoints

**Files:**
- Create: `app/controllers/api/v1/{teams,people}_controller.rb`
- Create: `app/views/api/v1/teams/{index,show,_team}.json.jbuilder`, `app/views/api/v1/people/_person.json.jbuilder`
- Modify: `app/models/person.rb` (phone normalization)
- Test: `spec/requests/api/v1/{teams,people}_spec.rb`, `spec/models/person_spec.rb`

**Interfaces:**
- Consumes: `TeamChecklist`, `Ability`, `PersonAuditor`/`TeamAuditor` subscriptions. Subscribe exactly as the legacy controllers do so finalization still fires.
- Produces:
  - `GET /api/v1/teams` returns the user's teams.
  - `POST /api/v1/teams {race_id, team:{name, description, experience}}` returns 201.
  - `GET /api/v1/teams/:id` returns `{ team: {id, name, description, experience, race: <race json>, people: [<person>], checklist: <TeamChecklist>} }`.
  - `PATCH /api/v1/teams/:id`.
  - `POST /api/v1/teams/:team_id/people {person:{first_name,last_name,email,phone,zipcode,experience,twitter}}` returns 201 with `{person, checklist}`.
  - `PATCH` / `DELETE /api/v1/teams/:team_id/people/:id` return `{person?, checklist}`.
  - The person JSON is `{id, first_name, last_name, email, phone, zipcode, experience, twitter}`.
  - `Person.normalize_phone(String) -> String`: strips non-digits, then drops a leading `1` from 11 digits. A 10-digit result becomes `"ddd-ddd-dddd"`; anything else is returned unchanged so validation fails. `Person#phone=` uses it.
  - Authorization is the existing `Ability`. Another user's team gives 403; a closed race gives 403 on mutate (Team `update` rule) or 422 with `generic` from `PersonValidator`.

- [ ] **Step 1: Write failing specs.**
  - Model: `normalize_phone` for `"+1 (312) 555-0144"`, `"312.555.0144"`, `"13125550144"` and `"312 555 0144"` all give `"312-555-0144"`. `"555-0144"` stays invalid with an error on `:phone`.
  - Requests:
    - create, update and delete a person
    - adding a person beyond `people_per_team` gives 422 `errors.maximum`
    - another user's team gives 403
    - a closed race (trait `:registration_closed`) on create person gives 422 or 403 with a non-empty `error`
    - filling the last slot of an otherwise complete team sets `checklist.finalized == true` and `Workers::TeamFinalizer.jobs.size == 1`
- [ ] **Step 2: Run** `bundle exec rspec spec/requests/api/v1/teams_spec.rb spec/requests/api/v1/people_spec.rb spec/models/person_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Implement** the controllers, views, routes and `normalize_phone`.
- [ ] **Step 4: Run** `bundle exec rspec`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `API v1: teams and people with checklist`

### Task 15: Past racers endpoint

**Files:**
- Create: `app/services/past_racers.rb`
- Create: `app/controllers/api/v1/past_racers_controller.rb`
- Test: `spec/services/past_racers_spec.rb`, `spec/requests/api/v1/past_racers_spec.rb`

**Interfaces:**
- Produces:
  - `PastRacers.new(user:, team:).call -> Array<Person>`:
    - Includes people on teams where `teams.user_id == user.id`, excluding `team`.
    - Excludes emails matching `/unknown/i` and emails already on `team`.
    - Dedupes by downcased email, keeping the most recently `updated_at`.
    - Orders by `updated_at` desc.
  - `GET /api/v1/teams/:team_id/past_racers` (team must be the user's) returns `{ past_racers: [{ <person fields minus id>, last_team_name, last_race_name, last_raced_year }] }`.

- [ ] **Step 1: Write failing specs.** These cover Review Focus #5:
  - a user with no history gives `[]`
  - an "unknown" placeholder is excluded
  - the same email in 2024 and 2025 returns only the 2025 record
  - a person already on the current team is excluded
  - another user's racer is never included
  - the endpoint returns 403 for another user's team
- [ ] **Step 2: Run** `bundle exec rspec spec/services/past_racers_spec.rb spec/requests/api/v1/past_racers_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Implement** the service, controller and route.
- [ ] **Step 4: Run** the specs. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `API v1: past racers for roster picker`

### Task 16: Questions endpoints

**Files:**
- Create: `app/controllers/api/v1/questions_controller.rb`
- Test: `spec/requests/api/v1/questions_spec.rb`

**Interfaces:**
- Consumes: `JsonForm.filter_answers` (Task 4), `TeamValidator`
- Produces:
  - `GET /api/v1/teams/:team_id/questions` returns `{ jsonform: <race schema+form>, answers: <hash> }`.
  - `PUT /api/v1/teams/:team_id/questions {answers: {...}}`:
    - Returns 200 `{answers, checklist}`.
    - Returns 422 `{error:"invalid_answers", errors:{questions:[...]}}` when `TeamValidator` fails.
    - Returns 403 for another user's team or a closed race.

- [ ] **Step 1: Write failing specs.**
  - valid answers are saved
  - unknown keys are dropped
  - an invalid enum value gives 422
  - another user's team gives 403
  - a closed race gives 403
- [ ] **Step 2: Run** `bundle exec rspec spec/requests/api/v1/questions_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Implement** the controller and route.
- [ ] **Step 4: Run** the spec. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `API v1: team questions`

### Task 17: Payments endpoint via a shared charge service

**Files:**
- Create: `app/services/payments/charge_team.rb`
- Create: `app/controllers/api/v1/{payments,mock_payments}_controller.rb`
- Modify: `app/controllers/charges_controller.rb` (delegate to the service)
- Test: `spec/services/payments/charge_team_spec.rb`, `spec/requests/api/v1/payments_spec.rb`, existing `spec/controllers/charges_controller_spec.rb`

**Interfaces:**
- Consumes: `Customer.get(user, token, email)`, `PaymentRequirement#amount_due_cents`, `Requirement#complete`, `StripeHelper`
- Produces:
  - `Payments::ChargeTeam.call(user:, team:, requirement:, stripe_token:, stripe_email:) -> Result`, where `Result = Data.define(:ok, :error_code, :message, :completed_requirement)`.
  - `error_code` values:

    | Code | When |
    |---|---|
    | `:already_paid` | `requirement.completed?(team)`. Stripe is not called. |
    | `:no_active_tier` | |
    | `:customer_failed` | |
    | `:card_error` | |
    | `:stripe_error` | |
    | `:unexpected` | |

  - The amount is always `requirement.amount_due_cents`. Metadata is `requirement.stripe_params(team)[:metadata]`.
  - `POST /api/v1/teams/:team_id/payments {requirement_id, stripe_token, stripe_email}` returns 201 `{checklist}`, 409 for `already_paid`, 402 for `card_error`, and 422 or 502 for the other codes.
  - `POST /api/v1/teams/:team_id/mock_payments {requirement_id}` is only routed when `Rails.env.development? || Rails.env.test?`. It mirrors `MockPaymentsController` but uses `amount_due_cents`.

- [ ] **Step 1: Write failing specs** using StripeMock. These cover Review Focus #4:
  - success creates a CR with amount 5000
  - a second call gives `:already_paid` and Stripe is not called again
  - a card error (`StripeMock.prepare_card_error(:card_declined)`) gives 402 with no CR
  - another user's team gives 403
  - the legacy `charges#create` spec still passes through the service
- [ ] **Step 2: Run** `bundle exec rspec spec/services/payments spec/requests/api/v1/payments_spec.rb spec/controllers/charges_controller_spec.rb`. Expected: FAIL.
- [ ] **Step 3: Implement.** Write the service, then the controllers. `ChargesController#create` keeps its flash and redirect behavior.
- [ ] **Step 4: Run** `bundle exec rspec`. Expected: PASS.
- [ ] **Step 5: Commit, push and open the PR** (base `fix/launch-hardening`). Message: `API v1: payments via shared ChargeTeam service`

---

## PR 6: `feat/spa-registration` (branch from `feat/api-v1`)

### Task 18: Scaffold the SPA, serve it under `/register`, add the `REGISTRATION_UI` switch

**Files:**
- Create: `frontend/` (package.json, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js, index.html, `src/main.tsx`, `src/app/{index,provider,router}.tsx`, `src/index.css`, `src/locales/en.ts`, `src/components/layouts/register-layout.tsx`, `src/components/ui/{button,card,badge,progress-segments}.tsx`, `public/logo.png`), plus `vitest.config.ts` and `src/test/setup.ts`
- Create: `app/controllers/spa_controller.rb`
- Modify: `config/routes.rb`: add `get "register", to: "spa#index"` and `get "register/*path", to: "spa#index"`, both before the catch-all
- Modify: `app/views/homepages/index.html.haml:11`: when `RegistrationUi.spa?`, link to `/register`
- Modify: `package.json` (root): add `"heroku-postbuild": "npm --prefix frontend ci && npm --prefix frontend run build"`
- Modify: `.gitignore`: add `/public/register`
- Test: `spec/requests/spa_spec.rb`, `frontend/src/app/router.test.tsx`

**Interfaces:**
- Produces:
  - Vite settings: `base: "/register/"`, `build.outDir: "../public/register"`, dev server port 5173, proxy `/api` → `http://localhost:3000`, alias `@` → `src`.
  - `SpaController#index`:
    - development redirects to `http://localhost:5173#{request.fullpath}`
    - otherwise renders `public/register/index.html`
    - returns 503 text when the build is missing
  - Tailwind theme: colors `flag: "#b3ddf2"`, `star: "#e4002b"`, `starText: "#c4001f"`, `navy: "#12202f"`, `link: "#2f5aae"`, `page: "#f4f8fb"`. Fonts `display: ["Oswald"]`, `sans: ["Inter"]` (Google Fonts in `index.html`).
  - SPA routes (React Router, basename `/register`):

    | Path | Purpose |
    |---|---|
    | `/` | race list |
    | `/login` | log in |
    | `/signup` | sign up |
    | `/forgot-password` | password reset request |
    | `/races/:raceId/teams/new` | create team |
    | `/teams` | my teams |
    | `/teams/:teamId` | team checklist |

  - `RegisterLayout` has a white header (logo plus user menu), a `#b3ddf2` bottom border, and a centered column with `max-w-xl`.
  - `t(key: keyof typeof en): string` from `src/locales/en.ts`.

- [ ] **Step 1: Write failing tests.**
  - Rails: `GET /register/teams/5` gives 200 HTML containing `<div id="root">` once `public/register/index.html` exists. Write a fixture file in the spec and remove it after. When the file is missing, it gives 503.
  - Vitest: rendering the router at `/register/` shows the race-list heading.
- [ ] **Step 2: Run** `bundle exec rspec spec/requests/spa_spec.rb && npm --prefix frontend test -- --run`. Expected: FAIL.
- [ ] **Step 3: Implement** the scaffold, mirroring `../cartographer/frontend` (the package versions in Global Constraints, plus `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `msw` and `ajv` as deps), plus the controller, routes and homepage switch.
- [ ] **Step 4: Verify.**
  - `npm --prefix frontend run build` creates `public/register/index.html`.
  - `bundle exec rspec spec/requests/spa_spec.rb` passes.
  - `npm --prefix frontend test -- --run` passes.
- [ ] **Step 5: Commit.** Message: `Scaffold registration SPA under /register with REGISTRATION_UI switch`

### Task 19: API client, auth guard, login, signup, forgot password

**Files:**
- Create: `frontend/src/lib/{api-client,react-query}.ts`
- Create: `frontend/src/features/auth/api/{use-me,use-login,use-signup,use-password-reset}.ts`
- Create: `frontend/src/features/auth/components/{login-form,signup-form,forgot-password-form,require-auth}.tsx`
- Create: `frontend/src/app/routes/{login,signup,forgot-password}.tsx`
- Create: `frontend/src/components/ui/field.tsx`
- Test: `frontend/src/lib/api-client.test.ts`, `frontend/src/features/auth/components/*.test.tsx`

**Interfaces:**
- Produces:
  - `apiFetch<T>(path: string, init?: RequestInit): Promise<T>`:
    - Prefixes `/api/v1` and sends `credentials: "same-origin"`.
    - Fetches and caches the CSRF token from `/csrf`, and attaches `X-CSRF-Token` on non-GET requests.
    - On a 422 `invalid_csrf` it refetches the token and retries once.
    - On a 401 it calls `onUnauthorized()`.
    - Throws `ApiError {status, error, errors: Record<string,string[]>}`.
  - `setUnauthorizedHandler(fn: () => void)`. The app sets it to `navigate("/login?next=" + encodeURIComponent(location.pathname + location.search))`.
  - `<RequireAuth>`: when `useMe()` gives 401, redirect to `/login?next=…`.
  - `LoginForm`: after success it navigates to `next` or `/teams`.
  - `Field` (label, input slot, `InfoTip` slot, and the error list from `ApiError.errors[name]`).

- [ ] **Step 1: Write failing tests** with MSW. These cover Review Focus #2.
  - `apiFetch` retries once after `invalid_csrf`.
  - A 401 calls the unauthorized handler.
  - A `LoginForm` server 422 shows "Email or password is incorrect".
  - `SignupForm` shows a field error under Email from `errors.email`.
  - `RequireAuth` redirects to `/login?next=%2Fteams%2F5`; after login it lands on `/teams/5`.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/lib src/features/auth`. Expected: FAIL.
- [ ] **Step 3: Implement** the client, hooks, forms and routes.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `SPA: API client with CSRF and auth flows`

### Task 20: Smart inputs and InfoTip

**Files:**
- Create: `frontend/src/components/inputs/{phone-input,email-input,zip-input}.tsx`
- Create: `frontend/src/components/inputs/use-auto-advance.ts`
- Create: `frontend/src/components/inputs/format.ts`
- Create: `frontend/src/components/ui/info-tip.tsx`
- Test: `frontend/src/components/inputs/*.test.ts(x)`

**Interfaces:**
- Produces:
  - `formatPhoneDisplay(raw: string): string` turns digits into `(ddd) ddd-dddd` as typed. It accepts pasted `+1…` input and drops the leading 1 of 11 digits.
  - `toApiPhone(display: string): string` gives `ddd-ddd-dddd`, or the raw value if it isn't 10 digits.
  - `isLikelyEmail(s: string): boolean` mirrors the Rails regex in `person.rb:20`.
  - `PhoneInput`, `EmailInput` and `ZipInput` take `{ value, onChange, onComplete?, name, invalid? }`. Email lowercases on blur. Zip allows `ddddd` or `ddddd-dddd`.
  - `useAutoAdvance(ref)` focuses the next focusable field in DOM order when `onComplete` fires: 10 phone digits or 5 zip digits.
  - `InfoTip({ label, children })` is built on `@radix-ui/react-popover`. It opens on click/tap and keyboard (Enter/Space), and has `aria-label`.

- [ ] **Step 1: Write failing tests.**
  - `formatPhoneDisplay` for `"+1 (312) 555-0144"`, `"3125550144"` and `"312.555.0144"` gives `"(312) 555-0144"`.
  - `toApiPhone("(312) 555-0144")` gives `"312-555-0144"`.
  - Typing 10 digits moves focus to the next input.
  - Email blur lowercases the value.
  - InfoTip opens on Enter and shows its content.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/components`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `SPA: smart phone/email/zip inputs, auto-advance, InfoTip`

### Task 21: Race list, create team, my teams

**Files:**
- Create: `frontend/src/features/races/api/use-races.ts`
- Create: `frontend/src/features/races/components/race-list.tsx`
- Create: `frontend/src/features/teams/api/{use-teams,use-create-team}.ts`
- Create: `frontend/src/features/teams/components/{create-team-form,my-teams}.tsx`
- Create: `frontend/src/app/routes/{races,new-team,teams}.tsx`
- Test: `*.test.tsx` beside each component

**Interfaces:**
- Produces:
  - `RaceList` shows each current race with its date, registration window and an "open/closed/full" badge, and links to `/races/:id/teams/new`. Starting registration requires auth.
  - `CreateTeamForm` has name, description, and a team years-racing `<select>` from `race.experience_labels`. On 201 it navigates to `/teams/:id`.
  - `MyTeams` lists the user's teams with race name and checklist `remaining`.

- [ ] **Step 1: Write failing tests.**
  - A closed race shows the "Registration closed" badge with no start button.
  - `CreateTeamForm` shows a duplicate-name 422 error under Name.
  - Success navigates to `/teams/9`.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/races src/features/teams`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `SPA: race list, create team, my teams`

### Task 22: Team checklist page

**Files:**
- Create: `frontend/src/features/teams/api/use-team.ts`
- Create: `frontend/src/features/teams/components/{team-checklist,team-header,checklist-card,youre-in-card,edit-team-basics}.tsx`
- Create: `frontend/src/app/routes/team.tsx`
- Test: `team-checklist.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/teams/:id` (Task 14), `TeamChecklist` shape (Task 13)
- Produces:
  - `useTeam(teamId)` is the query key `["team", teamId]`. Mutations elsewhere call `queryClient.setQueryData(["team", id], …)` with the returned checklist, or invalidate it.
  - `TeamChecklist` renders:
    - a header (race name and date, "closes <date>", `"{remaining} things left"`, `ProgressSegments` with 4 segments)
    - cards ① Racers, ② Team questions (only if `checklist.questions.required`), ③ Registration fee, ④ You're in!
  - `ChecklistCard({ number, title, status: "done"|"todo", pill: string, children })`.
  - `YoureInCard` is locked (muted, lock icon) until `checklist.finalized`, then shows `team_number` and the `classy_fundraising_url` link. While the URL is null it shows "Your fundraising page is being set up" and polls `useTeam` every 10s for up to 5 minutes.
  - `EditTeamBasics` is an inline expandable form (name, description, years racing) in the header.

- [ ] **Step 1: Write failing tests** with MSW. The last case covers Review Focus #3.
  - `remaining=2` renders "2 things left".
  - The questions card is hidden when not required.
  - Finalized with a URL shows the team number and the link.
  - A mutation 403 with `error: "Registration is closed"` shows a page-level banner and refetches the team.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/teams`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `SPA: one-page team checklist`

### Task 23: Roster card with past-racer chips

**Files:**
- Create: `frontend/src/features/roster/api/{use-past-racers,use-person-mutations}.ts`
- Create: `frontend/src/features/roster/components/{roster-card,roster-slot,person-form,past-racer-chips,past-racer-list}.tsx`
- Test: `roster-card.test.tsx`, `person-form.test.tsx`

**Interfaces:**
- Consumes: Task 14 people endpoints, Task 15 `GET past_racers`, Task 20 inputs
- Produces:
  - `RosterCard` renders `race.people_per_team` slots. Filled slots show initials, name, the captain marker for the first person whose email equals the user's, contact details, the years label, and **Edit**.
  - Each empty slot shows "+ Add someone new" and, when past racers exist, up to 3 `PastRacerChips` (most recent) plus "+N more". "+N more" opens `PastRacerList`, a searchable list.
  - Picking a chip opens `PersonForm` pre-filled (`experience` + 1, capped at the last label index). Nothing is saved until the user presses Save.
  - `PersonForm` fields, in order, with auto-advance: first, last, email, phone, zip, years racing (select from `race.experience_labels`, with an InfoTip "Count CHIditarods you've raced, not counting this one"), and twitter. On Save it calls POST or PATCH. Server field errors map to fields.
  - Remove (delete) is available unless `checklist.finalized`, matching the legacy `people#destroy` rule.

- [ ] **Step 1: Write failing tests.** These cover Review Focus #5 (UI) and #1 (UI).
  - With zero past racers, no chip row renders.
  - With chips, picking "Dee Lamb" pre-fills the form and nothing is POSTed until Save.
  - Save posts phone `"312-555-0144"` when the user typed `"3125550144"`.
  - A server 422 `{errors:{phone:["should be in the form 555-867-5309"]}}` shows under Phone.
  - The slot count equals `people_per_team`.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/roster`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `SPA: roster with past-racer picker and smart person form`

### Task 24: JSONForm renderer

**Files:**
- Create: `frontend/src/features/questions/api/use-questions.ts`
- Create: `frontend/src/features/questions/components/{questions-card,jsonform-renderer,jsonform-field}.tsx`
- Create: `frontend/src/features/questions/validate.ts`
- Create: fixture `frontend/src/features/questions/__fixtures__/chiditarod_21.json` (copy of `../dogtag-private/jsonform/chiditarod_21.json`; question text is public race content)
- Test: `jsonform-renderer.test.tsx`, `validate.test.ts`

**Interfaces:**
- Produces:
  - `JsonformRenderer({ jsonform: {schema, form}, value: Record<string,string>, onChange, errors })`. It supports the Joshfire subset:
    - `form[]` items of `{ type: "fieldset", title, items: [...] }`, `{ type: "help", helpvalue }` and `{ type: "submit" }` (ignored; the card has its own Save)
    - plain key strings or `{ key, type?: "textarea"|"radios"|"select", title?, description?, titleMap? }`
  - Rendering rules:
    - A schema enum renders as `select`, or radios when there are 3 or fewer options.
    - An `agree-*` field (enum `["No","Yes"]` with `pattern ^Yes$`) renders as a single checkbox that maps to `"Yes"`/`"No"`.
    - `maxLength` and `pattern` are enforced by validation, not by blocking input.
    - Unknown form item types render nothing and log `console.warn` once.
  - `validateAnswers(schema, answers): Record<string,string[]>` uses ajv (draft-04 compatible, `allErrors`). It returns per-key messages, translating a pattern failure on `agree-*` to "You must agree to continue".
  - `QuestionsCard` is collapsed to a summary when done and expands to edit. Save calls PUT and shows server 422 errors per key.

- [ ] **Step 1: Write failing tests** against the `chiditarod_21.json` fixture.
  - It renders the 4 fieldset titles.
  - `racer-type` renders as radios.
  - `explain-theme` renders a textarea.
  - Leaving `agree-to-rules` unchecked gives the error "You must agree to continue".
  - `instagram` set to `"bad"` gives a pattern error.
  - A valid full answer set gives `{}`.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/questions`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `SPA: JSONForm renderer for race questions`

### Task 25: Fee card with legacy Stripe Checkout

**Files:**
- Create: `frontend/src/lib/stripe-checkout.ts`
- Create: `frontend/src/features/payments/api/use-pay.ts`
- Create: `frontend/src/features/payments/components/fee-card.tsx`
- Test: `fee-card.test.tsx`

**Interfaces:**
- Consumes: race `payment_requirements` and `stripe_publishable_key` (Task 12), checklist `fee` (Task 13), the Task 17 endpoints
- Produces:
  - `openStripeCheckout({ key, amountCents, email, description }): Promise<{ token: string, email: string } | null>`:
    - Lazy-loads `https://checkout.stripe.com/checkout.js` once.
    - Uses `StripeCheckout.configure({ key, locale: "auto", image: "/register/logo.png", token })`.
    - Resolves null when the user closes the popup.
  - `FeeCard` shows the price (`$300` format), a "Goes to $X on <date>" line when `next_tier` exists, and a Pay button.
    - While paying, the button is disabled and reads "Processing…".
    - A 409 shows "Already paid" and refetches the team.
    - A 402 shows the card error.
    - When the race is `full`, it shows the waitlist message instead of Pay.
    - When the requirement `type === "MockPaymentRequirement"`, it shows a "Mock pay" button that calls `mock_payments`.

- [ ] **Step 1: Write failing tests.** These cover Review Focus #4 (UI).
  - With Pay clicked twice quickly, `openStripeCheckout` (mocked) is called once.
  - A 409 response shows "Already paid".
  - The next-tier line renders.
  - A full race hides Pay.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/payments`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm --prefix frontend test -- --run` and `npm --prefix frontend run build`. Expected: both PASS.
- [ ] **Step 5: Commit, push and open the PR** (base `feat/api-v1`). Message: `SPA: registration fee card with Stripe Checkout`

---

## PR 7: `test/e2e-mailpit` (branch from `feat/spa-registration`)

### Task 26: Mailpit, inline Sidekiq for e2e, and the SPA Playwright suite

**Files:**
- Modify: `docker-compose.yml` (replace the `mailcatcher` service with `mailpit: image axllent/mailpit:v1.21`, ports `1025:1025` and `8025:8025`, and point web/worker `SMTP_HOST` at it)
- Modify: `config/environments/development.rb` (`delivery_method :smtp`, address `ENV.fetch("SMTP_HOST","localhost")`, port `ENV.fetch("SMTP_PORT","1025")`, `raise_delivery_errors = true`)
- Modify: `config/initializers/sidekiq.rb` (when `ENV["SIDEKIQ_INLINE"] == "true"` and not production, `require "sidekiq/testing"; Sidekiq::Testing.inline!`)
- Modify: `playwright.config.ts` (webServer env `SIDEKIQ_INLINE=true REGISTRATION_UI=spa`)
- Modify: `tests/global-setup.ts` (`npm --prefix frontend run build` unless `SPA_BUILD=skip`)
- Modify: `lib/tasks/test_seeds.rake` (new `test_seeds:spa_registration` and `test_seeds:past_racers`, writing credentials JSON like `user_registration`)
- Modify: `.circleci/config.yml` (integration job: add the `axllent/mailpit:v1.21` service image and `SMTP_HOST=localhost`)
- Create: `tests/helpers/mailpit.ts`
- Create: `tests/spa/{full-registration,past-racers,password-reset,reminder}.spec.ts`

**Interfaces:**
- Produces, in `tests/helpers/mailpit.ts`:
  - `clearInbox(): Promise<void>` (`DELETE http://localhost:8025/api/v1/messages`)
  - `waitForEmail({ to, subjectIncludes, timeoutMs = 15000 }): Promise<{ id, subject, html, text, links: string[] }>`. It polls `GET /api/v1/search?query=to:<to>` and then `GET /api/v1/message/<id>`.

- [ ] **Step 1: Write the e2e specs.** Each spec calls `clearInbox()` in `beforeEach`.
  - **`full-registration`:**
    - Sign up in the SPA. Expect the welcome email (`"Welcome to dogTag"`), and its links contain `localhost:3099`.
    - Create a team, add 2 racers (`people_per_team` from the seed) using the typed phone `3125550144`, and answer the questions.
    - Mock pay. The "You're in!" card shows the team number.
    - Expect the email `"Registration Confirmed for"`.
  - **`past-racers`:** the seeded captain with a 2025 team sees the chips. Picking one pre-fills the form; Save fills the slot.
  - **`password-reset`:** request a reset in the SPA, `waitForEmail` for "Password Reset", follow the link (legacy page), set a new password, and log in through the SPA.
  - **`reminder`:** the seed is a race closing in 23h with an unfinalized team. Run `bundle exec rails runner 'Workers::RegistrationReminders.new.perform({})'` via `execSync`, then expect one email to the captain. Run it again and expect still one (count messages).
- [ ] **Step 2: Run** `docker compose up -d db redis mailpit && npx playwright test tests/spa`. Expected: FAIL until the seeds and config exist, then PASS. Existing `tests/*.spec.ts` must still pass (`npm test`).
- [ ] **Step 3: Implement** the compose, environment, initializer, seed, config and CI changes.
- [ ] **Step 4: Run** `npm test`. Expected: all Playwright specs PASS locally.
- [ ] **Step 5: Commit, push and open the PR** (base `feat/spa-registration`). Message: `E2E: Mailpit inbox checks and SPA Playwright suite`

---

## PR 8: `test/classy-coverage` (branch from `main`)

### Task 27: Classy spec gaps

**Files:**
- Test: `spec/workers/classy_cache_org_member_cacher_spec.rb`, `spec/workers/classy_fundraising_team_email_spec.rb`

**Interfaces:** none new.

- [ ] **Step 1: Write the specs.**
  - **Cacher:**
    - With `CLASSY_ORGS="1,2"` and WebMock pages of supporters for each org, `ClassyCacheOrgMember` rows are upserted (count, latest `classy_updated_at` wins).
    - A blank `CLASSY_ORGS` is a no-op.
    - A Classy 500 is logged and doesn't raise (match the existing `wrapper` retry behavior).
  - **Fundraising email worker:** one delivery to the captain with subject `"Fundraising is ready for"`, plus a `SentEmail` with kind `classy_fundraising` (requires PR 3; if PR 3 hasn't merged, assert only the delivery).
- [ ] **Step 2: Run** `bundle exec rspec spec/workers/classy_cache_org_member_cacher_spec.rb spec/workers/classy_fundraising_team_email_spec.rb`. Expected: PASS. A FAIL means a real bug; investigate it with superpowers:systematic-debugging.
- [ ] **Step 3: Commit, push and open the PR.** Message: `Spec coverage for Classy org member cacher and fundraising email worker`

---

## Ops: launch runbook (not PRs; needs the owner for credentials and confirmations)

### Task 28: XXII race data, staging, go/no-go, production launch

**Files:**
- Create: `../dogtag-private/jsonform/chiditarod_22.json` (committed in dogtag-private, never in dogtag)

- [ ] **Step 1: Write the XXII JSONForm.**
  - Copy `chiditarod_21.json` to `chiditarod_22.json`.
  - Update the year-specific text:
    - orientation date and venue
    - food-drive amounts
    - partner
    - any 2026 dates
  - Show the owner the diff for approval.
  - Validate it: `ruby -rjson -e 'JSON.parse(File.read(ARGV[0]))' <file>`, and check it renders in the SPA renderer test by temporarily pointing the fixture at it.
- [ ] **Step 2: Bring up staging (`dogtag-staging`).**
  - Check `heroku apps:info -a dogtag-staging`, then add Postgres, Redis, a web dyno and a worker dyno.
  - Set config vars: `APP_HOST`, `REGISTRATION_UI=spa`, Stripe **test** keys, `CLASSY_*`, `SMTP_*` (SendGrid), `SENDGRID_WEBHOOK_PUBLIC_KEY`, `SIDEKIQ_USER/PASS` and `ROLLBAR_ACCESS_TOKEN`.
  - Restore the April dump: upload `postgres_dump-20260409.dump` to a temporary signed URL and run `heroku pg:backups:restore <url> DATABASE_URL -a dogtag-staging --confirm dogtag-staging`. **Confirm with the owner first.**
  - Deploy the merged `main`, then run `heroku run rails db:migrate -a dogtag-staging`.
- [ ] **Step 3: Create race XXII on staging.**
  - Use the admin UI: copy race XXI's settings, shifting dates +1 year, with 3 tiers copied from XXI shifted +1 year. Add the 22nd-year label and paste the JSONForm.
  - The owner confirms the final dates and prices.
  - The owner configures the SendGrid event webhook URL `https://<staging-host>/webhooks/sendgrid` with signing enabled.
- [ ] **Step 4: Run the staging verification.**
  - Register a team on a phone and on a desktop through `/register`, paying with Stripe test card `4242…`.
  - Check finalization, the Classy team creation (or the Classy sandbox), and the emails.
  - `heroku run rake "emails:verify[<team_id>]" -a dogtag-staging` must exit 0.
- [ ] **Step 5: Make the Nov 24 go/no-go call** against the spec's criteria. If any criterion fails, set `REGISTRATION_UI=legacy` for launch and record what failed.
- [ ] **Step 6: Bring up production (`dogtag`).**
  - Repeat Step 2 with the live keys, `APP_HOST=dogtag.chiditarod.org`, and the chosen `REGISTRATION_UI` value.
  - The restore needs **owner confirmation**.
  - Point the SendGrid webhook at production.
  - Create race XXII in production.
- [ ] **Step 7: Run the production live test (with the owner).**
  - Register a real team on a hidden test race with a $1 tier (or the owner's chosen low-price requirement).
  - Confirm finalization and the Classy fundraising team.
  - `rake emails:verify` must report all `delivered`.
  - Refund the charge through the admin refund, delete the Classy team in Classy, and delete the test race.
- [ ] **Step 8: Clean up and go live.**
  - **With owner confirmation**, run `heroku apps:destroy dogtag-22 --confirm dogtag-22` and `git remote remove dogtag-22`.
  - Open registration on Dec 1.
  - Add the year's learnings to CLAUDE.md in a small follow-up PR.
