## Project Overview
Dogtag is a Rails app that manages user and team registration for the annual CHIditarod urban shopping cart race and mobile food drive. It takes payments via Stripe, integrates with Classy for fundraising, and supports per-race survey questions via JSONForm.

## Project Conventions

- Use sub-agents for exploring project context or structure, and use sub-agents and parallelism wherever safe.
- Use the Context7 MCP for library/API docs and setup steps, and the Playwright MCP to verify UI changes, without being asked.
- The React app follows Bulletproof React (https://github.com/alan2207/bulletproof-react).
- Put key learnings into CLAUDE.md after every iteration, and review README.md for new setup steps or changed commands.
- When a task is done, commit only the changes that task made, with a concise message.
- Commit messages end with the `Co-Authored-By` line; PR bodies end with the `Generated with Claude Code` line.
- When asking permission to run a command, also offer "Always allow"; don't re-ask for the same type of command.
- Feature branches go to `origin`; PRs open against `chiditarod/dogtag` (`gh pr create --repo chiditarod/dogtag`). Never merge; the owner merges.
- Code PRs are stacked linearly (PR2 from `main`, PR3 from PR2, ...) and must merge in order.
- Ask before Gemfile/config changes (see General) and call any such change out in the PR body.
- Irreversible or production actions (Heroku app deletion, production DB restore, live charges) need explicit owner confirmation at the time.

## Tech Stack

Ruby 3.4, Rails 8, PostgreSQL 17, Sidekiq + Redis, Authlogic 6 (SCrypt), CanCanCan + RoleModel, Stripe, RSpec/FactoryBot, Playwright (integration), Vitest (frontend), CircleCI. Frontend: Vite + React 19 + TypeScript + Tailwind SPA in `frontend/`, served under `/register`.

## Project Structure

Standard Rails layout plus: `app/services/` (plain Ruby objects shared by controllers and the API), `app/validators/`, `app/workers/workers/` (Sidekiq), `lib/` (`classy_client.rb`, `classy_user.rb`, `stripe_helper.rb`, `json_form.rb`, `tasks/`), `spec/` (RSpec), `tests/` (Playwright, TypeScript), `frontend/` (SPA built into `public/register`).

## Commands

```bash
docker compose up -d db redis mailpit      # Postgres, Redis, Mailpit (UI http://localhost:8025, SMTP 1025)
bin/rails server | console | db:migrate | db:seed | db:reset
RAILS_ENV=test bundle exec rails db:migrate
bundle exec sidekiq -C ./config/sidekiq.yml
bundle exec rspec [path[:line]]            # there is no bin/rspec
bin/check [rspec|frontend|build|e2e]       # preferred: quiet summary, logs in tmp/check/
npm test                                   # Playwright; npx playwright test tests/spa for the SPA suite
npm --prefix frontend run dev|build|test   # dev server :5173 proxies /api to :3000
bundle exec rake db:normalize:emails[_check]
```

Restore a dump locally: `pg_restore --verbose --clean --no-acl --no-owner -h localhost -d dogtag_development file.dump` (get one with `heroku pg:backups:capture --app dogtag` and `heroku pg:backups:url`).

## Coding Guidelines

### General
- Concise, idiomatic Ruby and Rails conventions; descriptive names; snake_case files/methods, CamelCase classes; Ruby 3.x features welcome; Ruby Style Guide.
- Double-quoted strings; no trailing whitespace; blank line at end of file.
- Ask before changing the Gemfile/Gemfile.lock, `config/initializers`, `config/environments`, `config/application.rb`, or `spec/spec_helper.rb`. Routes, locales and `config/schedule.yml` are fine. New helpers under `spec/support/` are fine; changing existing ones needs a reason. If something looks missing or misconfigured, stop and ask rather than work around it.
- Performance: index, eager load (no N+1), cache where it pays.

### Controllers
- New controllers/actions need routes.
- Strong params use `params.expect(user: [:name])`, not `require`/`permit`. Assign to a local variable unless reused.
- Link/redirect to an action in the same controller with `url_for(action: "the_action")` (or `{ action: :new }` in forms).

### Views
- Legacy forms are hand-written Bootstrap 3 `form_for` in HAML (no custom builder). Use `include_blank: "string"` on selects.
- The legacy racer flow must keep working after every change; it is the fallback if the SPA is not ready.

### I18n
- Public pages are translated, admin pages are not. Use Rails I18n with relative keys (`t(".title")`). HTML strings use an `_html` key suffix (no Markdown/`_md` support; only `ConfirmationText` renders Markdown).

### Migrations
- Create with `bin/rails g migration`. If one already exists on the feature branch, roll it back, edit it, and roll forward.
- `text` for all strings (never `string`/`varchar`), `datetime` (never `timestamp`), Booleans nullable unless specified.

### Testing
- RSpec with FactoryBot; multiple assertions per example are fine. Prefer real objects; mock only external APIs; `instance_double`, never `double`.
- Don't test declarative config; for validations test only the invalid case (no shoulda-matchers).
- Controller/request specs assert status plus data changes. Timecop for time. WebMock for Classy, StripeMock for Stripe. Specs run under Zonebie (random `Time.zone`), so build expected times with explicit zones.
- Sidekiq specs run fake; use `Sidekiq::Testing.inline!` for chains.
- Migration specs (`spec/migrations/`) call a data method (e.g. `backfill`), never `down`/`up` (re-adding a column inside the test transaction can break prepared statements in later specs). The one exception is `add_collaborating_to_teams_spec.rb`.
- System tests: `css_id(*)`/`css_class(*)` instead of `dom_id`/`dom_class`; Capybara async matchers, avoid flaky `find` assertions.
- Every SPA feature needs Vitest tests and a Playwright spec in `tests/spa/`, seeded by its own `test_seeds:*` task (unique `TEST_UNIQUE_ID`, `@example.com` emails) added to `test_seeds:cleanup`. State in the PR whether the e2e spec was actually run.
- `render_views` specs: Nokogiri adds no implied `<tbody>`, so select rows with `#table_id tr` and filter `> td`.

## Domain Notes

### Models
- User has_many Teams and CompletedRequirements. Team belongs_to User (the creating account, not automatically a racer), Race and an optional captain (`Person`); has_many People. Race has_many Teams and Requirements. Requirement is STI (`PaymentRequirement`, `MockPaymentRequirement`). CompletedRequirement joins Team, Requirement, User.
- Emails are downcased before validation, and validation rejects uppercase as a safety net.
- Models broadcast events with `Wisper.model`; `*Auditor` listeners react.

### Team finalization
- Needs a full roster, all payment requirements met, and all JSONForm questions answered: `team.meets_finalization_requirements?`. `Team#finalize` checks `ready_to_finalize?` (that plus `captain_id`). Do not add the captain to `meets_finalization_requirements?`: `unfinalize` and the "cannot remove a racer" guards use it, so captainless finalized teams would un-finalize on their next edit. A team that pays or fills its roster before choosing a captain finalizes as soon as the captain is chosen.
- Deleting: `Team#deletable?` (not finalized, nothing ever paid, history included) gates `DELETE /api/v1/teams/:id` and legacy `teams#destroy`. Captains delete their own deletable team while registration is open; operators any deletable team; admins any without payments. People are `dependent: :destroy`.
- `teams.new_team` is true when the sum of `people.experience` is 0, nil with no racers. `Person` callbacks call `Team#refresh_new_team` (a conditional `update_all`; skips `new_team_overridden`), so reload to see it. Staff set it via virtual `new_team_setting` (`auto`/`yes`/`no`), permitted only for admins/operators. `teams.experience` is a separate team label and does not feed it.
- Captain: `teams.captain_id` (FK to people, nullified on delete) and `captain_inferred` (true only for migration guesses). A `Person` created with the account holder's email on a captainless team becomes captain in `after_create`; nothing else is automatic. `PUT /api/v1/teams/:team_id/captain` and legacy `PUT /teams/:team_id/captain` both clear `captain_inferred` and authorize `:update` on the team: owners only while registration is open (not the final-edits window), staff any time. Payment is not gated on a captain. `TeamChecklist` `racers.done` needs a full roster and a captain, but `remaining` is 0 for a finalized team. The SPA picks the captain row from `team.captain_id`, never from the viewer's email. Person API responses carry `captain_id`.
- Buddies (#302, #332): `team_buddies` is a directional same-race join (`team_id` names `buddy_team_id`; no self-pick; unique; cascade), plus `teams.other_buddies` (free text, max 1000) and nullable `teams.collaborating`. `GET/PUT /api/v1/teams/:team_id/questions` read and write `buddy_team_ids`, `other_buddies`, `collaborating`: an absent key leaves the value, a present key replaces it, a PUT without `answers` clears answers (the SPA always sends them). `collaborating` must be JSON `true|false|null` (else 400); `false` clears picks in the same transaction; picks while it is not `true` are a 422 `invalid_buddies`. Not a finalization requirement. Any autosave must send empty picks unless the answer is Yes.
- CSV export (`Team.export`): team name via `Team#library_name` ("The X" becomes "X, The"; stored name unchanged), names starting `=+-@` prefixed with `'`, `captain_*` columns right after `user_*`, racer `experience` as a plain number, then `collaborating` and `racing_with` (`spreadsheet_safe` per element).

### JSONForm
- Permitted answer keys come from the race's JSONForm schema.
- `showWhen` (#334): a keyed form item may carry `"showWhen": { "<schema key>": "<value>" }` (one string pair, exact match against the trimmed saved answer). Anything malformed is ignored and the field stays visible. `hiddenKeys(jsonform, answers)` in `features/questions/validate.ts` is the one definition (renderer, `buildPayload` and the answered count all use it). Only optional fields may carry it: `RaceValidator#validate_jsonform` errors on any `showWhen` item that is `"required": true` or in the top-level `required` array, because the SPA's ajv enforces both but the server's json-schema gem enforces only the top-level array. The legacy `jsonform.js` ignores the key, so the field is always shown there.
- 2027 payload (`../dogtag-private/jsonform/chiditarod_22.json`) asks the theme once (team description), no longer asks `collaborating`, `buddies`, `raced-in-past` or `referred-by`, and has `racer-type: Unsure`. `tests/e2e/fixtures/jsonform.json` is the 2027 payload; Vitest fixtures and `lib/staging_seed.rb` keep 2026.

### Racers
- `people.experience` is a typed number (0-99; server-validated); `race.experience_labels` drive only the team-level dropdown. The picker carries a past racer forward as `experience + 1`, capped at 99.
- Racers give optional `instagram` and `tiktok` (normalized to lowercase `@handle`). `people.twitter` and `people.zipcode` were dropped (a stray `zipcode` param is ignored); `teams.twitter` remains.

### Completion confirmation
- `races.confirmation_text` is Markdown (max `Race::CONFIRMATION_TEXT_MAX_LENGTH` 5000) rendered by `ConfirmationText.to_html` (commonmarker + `sanitize`; links limited to http, https, mailto). `TeamChecklist` exposes `confirmation_html` (nil until finalized) and `show_confirmation` (finalized, viewer is owner, `confirmation_seen_at` blank). `POST /api/v1/teams/:team_id/confirmation` is owner-only and sets `confirmation_seen_at`; staff viewing never clears it and re-finalizing does not reset it. The same text appears in the team page header and `team_finalized_email`.

### Race list and time zones
- `GET /api/v1/races` sorts in Ruby after `Race.preload_registration_data` (`Race#full?` reads the preloaded finalized count). `Race#registration_status` (`open`, `waitlist`, `closed`, `not_yet_open`) is the one definition of the groups; order is open, waitlist, closed, not_yet_open, then soonest `race_datetime` (not-yet-open by `registration_open`), ties by id. A race exactly at `registration_close` is still open.
- `races.time_zone` is an IANA id (default `America/Chicago`, validated against `ActiveSupport::TimeZone.all`); storage and `config.time_zone` stay UTC. `RacesController`/`TiersController` wrap new/create/edit/update in `Time.use_zone` (`RaceTimeZone` concern). Display with `race.local(time)` plus `DateHelper`; deadlines use `deadline_readable`/`deadline_date` (and `formatDeadline` in `frontend/src/lib/dates.ts`), which show a local-midnight deadline as 11:59 PM the previous day.

### Background jobs
- Sidekiq workers live in `app/workers/workers/` (`Workers::*`), `include Workers::Common` and implement `run(job, log)`.
- Cron jobs live in `config/schedule.yml` (sidekiq-cron auto-loads it; lines may carry a zone like `"0 9 * * * America/Chicago"`). `Workers::RegistrationReminders` runs daily; `SentEmail` dedupe keys embed the deadline timestamp (`close-7d-<epoch>`) so a moved deadline sends a fresh reminder.

## API (`/api/v1`)

- Controllers in `app/controllers/api/v1/` inherit `Api::V1::BaseController < ActionController::Base` (not `ApplicationController`), with jbuilder views. They stay thin and call existing code (`Requirement#complete`, `*Auditor` listeners, `Team#finalize`, `Workers::TeamFinalizer`, `Workers::ClassyCreateFundraisingTeam`, `UserMailer`); never reimplement it.
- Auth is the Authlogic session cookie; authorization is the CanCanCan `Ability`. Use `authorize_update!(subject, team)` so only the owner is told "registration closed". CSRF: `GET /api/v1/csrf`, sent as `X-CSRF-Token`.
- Every non-2xx response is `{ "error": String, "errors": { "<field>": [String] } }` (`errors` may be `{}`; render with `render_errors`). Payment errors add a stable `code` because `error` is a translated sentence.
- New teams (legacy and API) go through `Race#accepts_new_teams_from?(user)`: open registration, or any time for admins/operators.
- Index endpoints rendering many races call `Race.preload_registration_data(races)` (tiers can't be preloaded via `race.requirements` because of STI); `spec/requests/api/v1/query_count_spec.rb` fails on per-row queries.
- In request specs `UserSession.find` is unusable after the request; use `session_user_id` from `spec/support/api_helpers.rb`.
- `POST /api/v1/teams/:id/mock_payments` is routed only in development/test.
- `GET /api/v1/me` returns `roles`.
- Feedback (`POST /api/v1/feedback`): logged-in users only; capped at `SEND_LIMIT` 5 per hour per account, counted from non-failed `kind: "feedback"` `sent_emails` rows (two simultaneous requests can overshoot by one). The client's `context.team_id` is a claim: the team is attached only when `Ability.new(current_user).can?(:show, team)`, otherwise the email says `claimed team id N (unverified)`. Recipient: `FEEDBACK_EMAIL`, else `UserMailer::STAFF_EMAIL`.

## Registration SPA (`frontend/`)

- Vite (`base: "/register/"`) builds to gitignored `public/register`. `SpaController#index` serves it (503 if missing; redirects to Vite only when `VITE_DEV_SERVER` is set). Routes `register` and `register/*path` sit above the catch-all in `config/routes.rb`. Heroku builds it via root `heroku-postbuild` (ignore local Node engine warnings).
- Bulletproof React feature folders: `src/features/<name>/{api,components}`, `@` alias for `src`. Copy lives in `src/locales/en.ts` via `t()` (Rails public strings in `config/locales/en.yml`). Router exports `routes`/`BASENAME` for `createMemoryRouter`; Vitest uses jsdom + MSW (`server` from `src/test/server.ts`).
- Design tokens ("Chicago Flag"): bg `#f4f8fb`, flag blue `#b3ddf2`, star red `#e4002b`, red text `#c4001f`, navy text `#12202f`, link blue `#2f5aae`, cards `#ffffff`; Oswald (500/700) headings, Inter body. Pages are mobile-first and must work at 320px with no horizontal scroll.
- Header logo: `frontend/public/logo.png` is `h-16` / `min-[400px]:h-20` / `sm:h-24` in `SiteHeader` (`shrink-0`; the user menu wraps beside it). At 320px only two menu lines fit beside `h-16`, so don't go taller. Stripe Checkout needs a square image: `logo-square.png` (regenerate with `sips --resampleWidth 256` then `sips -p 256 256 --padColor FFFFFF`).
- Wrapping in grids: `break-words` doesn't shrink a grid track's min-content, so use `grid-cols-[minmax(0,1fr)]` with `[overflow-wrap:anywhere]` on long values.
- Team page: `FlagProgress` (four stars: Team, Racers, Questions, Fee) from `stepStates(team)` in `features/teams/utils.ts`; the team route is the only wide one (`handle: { wide: true }`). The racers card collapses on finalize.
- Guided tour (`features/tour/`): targets carry `data-tour` and a missing target is skipped. It auto-starts once per mount only when the race is open, the team is unfinalized and `shouldAutoStart(me.id)` holds; ending it writes `dogtag:tour:team:v1:<user id>` (plus an in-memory mark for blocked storage); `dogtag:tour:off` disables it. Below `lg` the card docks to an edge (`dockPopup`); from `lg` it sits by the target (`placePopup`).
- Crew picker (`features/roster/components/crew-*.tsx`): step 1 ticks past racers (capped at open spots); step 2 reviews one person at a time, each of six details must be ticked or changed before `Add {first name} to the team` enables, and a person is saved only on that button. Escape backs out one level at a time (`useFocusTrap` ignores a `defaultPrevented` Escape); Close/Escape do nothing while saving. A picked racer stays out of the list for the visit even if their email changed (`pickedFrom` in `roster-card.tsx`).
- `RosterEmailField` flags a malformed or duplicate-on-roster email on blur but never blocks submit; the server's `taken_on_team` still applies. Racers on other teams in the race are not checked.
- Questions card: opens with `CollaboratingQuestion` (Yes/No); Save is blocked while it is null; only Yes shows `BuddyPicker`.
- Fee card: Pay unlocks on a full roster (`racers.filled >= racers.total`), not `racers.done`; the SPA hides Remove on a team complete apart from its captain; `FeeItem.refunded` shows a `Refunded` badge.

### Staff pages (`/register/staff/*`)
- `StaffLayout` (wide `max-w-6xl`, nav `Payments` + `Legacy admin`) under `RequireAuth` > `RequireStaff` (`isStaff`, `STAFF_ROLES`); non-staff see `NotAllowed`, unknown paths `NotFound`. Copy is under `staff.*` in `en.ts` (untranslated). The legacy navbar links `Payments` here when `can?(:refund, :charges)`.
- Payments page (`features/staff-payments`): filters live in the URL (`race_id` absent = server default, `all` = every race; `payment_type`; `status` `paid|refunded|all`; `q`; `page`). Changing anything but `page` resets `page`; changing the race drops `payment_type`; `setFilter`/`clearAll` keep one identity so a click does not restart the search debounce. One markup serves both layouts (`role=table` divs, cards below `sm`); below `sm` only Search stays on top, the rest is in a `Filters` sheet.
- Refund mode is local state (not in the URL) and forces status `paid`. `useSelection(limit)` holds whole rows by id across pages (paid only), capped by `meta.refund_batch_limit` from the API (the SPA hardcodes no cap). `ConfirmRefundDialog` snapshots the ticked rows, refuses if the live selection or a refetched row differs, and needs `REFUND N` (case/spacing ignored, posted canonical). Use `ApiError.code` (`batch_too_large`, `confirmation_mismatch`, `selection_changed`, `not_refundable`, `invalid_total`, `nothing_to_retry`), not the sentence. `BatchResults` polls every 2 s until `isBatchDone` (`finished_at` set or no item still `queued`, since a dead job never sets `finished_at`); `Retry K failed` follows the new batch id. A done batch invalidates `['staff', 'payments']`.
- Playwright: the status radios are `sr-only`; click the visible label and assert `toBeChecked()` (`check({ force: true })` fails most runs).

## Payments, refunds and reopening

- All card charges (legacy `ChargesController#create`, `POST /api/v1/teams/:id/payments`) go through `Payments::ChargeTeam`: rejects another race's requirement (`:wrong_race`), checks `requirement.completed?(team)` before touching Stripe, returns `:roster_incomplete` (422) while `team.needs_people?` unless the payer is staff, and always charges `requirement.amount_due_cents`. Callers must `authorize! :edit, team` first. Payments per team+requirement serialize on a session-level Postgres advisory lock (`Payments::AdvisoryLock`, `:in_progress` when held; incompatible with PgBouncer transaction pooling); non-`PaymentRequirement` and `MockPaymentRequirement` are `:not_payable`. Unlock failures are alerted but never change the result.
- If a charge succeeds but the completed requirement can't be saved, the charge id is logged and sent to Rollbar for a manual refund. `:duplicate_charge` = card charged, refund needed; `:already_paid` = card not charged. A Stripe error from `Charge.create` itself (e.g. timeout) logs team/requirement/user ids since the card may have been charged.
- Staff take payment for an incomplete roster in the legacy view (the SPA has no staff flag; its fee card hides Pay behind `fee.rosterFirst`).
- Payment facts are real columns on `completed_requirements` (`charge_id`, `amount_cents`, `refunded_at`, `refunded_by_id`, `stripe_refund_id`, `reopened_at`, `reopened_by_id`), written by `Requirement#complete`. Status has one definition, `CompletedRequirement.payment_status_sql` (`refunded`, `refunding` = a queued `refund_batch_items` row in a batch younger than `RefundBatch::STALL_AFTER`, `not_refundable` = no charge or mock in production, `paid`); use `with_payment_status`/`#payment_status`, never re-derive (reload after changes).
- `Payments::RefundCharge` refunds one payment under the same advisory lock: checks the charge at Stripe first (already refunded is recorded as `already_refunded` with `refunded_by` nil and Stripe's time, partly refunded is `partially_refunded` and untouched), refuses `amount_mismatch` unless Stripe's charge equals `amount_cents`, then `Stripe::Refund.create({ charge: }, { idempotency_key: "refund-<charge_id>" })` (key goes in opts; stripe-ruby-mock dedupes only on a param key, so specs assert opts). It records with `update_columns` and queues `Workers::PaymentRefundedEmail` (dedupe key `refund-<charge_id>`). Legacy `ChargesController#refund` and `Workers::RefundBatch` (`important` queue, resumable) both use it. Refund email copy (`user_mailer.payment_refunded_email`) needs owner review before production.
- `Payments::QueueRefundBatch` is all-or-nothing and checks cap, `REFUND <count>`, not-refundable ids, then the reviewed total, in that order; a unique partial index on queued items stops two tabs queuing one payment (stale items are marked `stalled` first). `REFUND_BATCH_LIMIT` (default 5, junk falls back) is read only in `RefundBatch.max_size`. `GET /staff/refund_batches/:id` never writes: an item queued 10 minutes is only reported `stalled`; only the retry action rewrites it. Staff API is `/api/v1/staff/*` (`authorize! :refund, :charges`); `Payments::PaymentSearch` defaults to the newest open race (else the latest that has run, else newest) and clamps `page` to `MAX_PAGE` 10,000. Staff payment JSON shows `refunded_by` as `{ name: "Done at Stripe" }` for such rows.
- Non-production failure hook: a `MockPaymentRequirement` payment whose `charge_id` starts `mock_fail_once_` (`Payments::RefundCharge::FAIL_ONCE_PREFIX`) fails its first refund with `stripe_error` and succeeds on retry. Mock payments aren't refundable in production. Seeded `ch_seed_*` payments can't be refunded.
- Totals are net of refunds: `Team#money_paid_in_cents` and `Race#stats` sum `CompletedRequirement#net_paid_cents` (0 once refunded). A refunded requirement stays complete (finalization and `fee.done` unchanged). Net vs gross was not decided by the owner; net is the default.
- Reopening: "Refund only" keeps the requirement complete; "Refund and reopen payment" (or later "Reopen payment") makes it incomplete so the team can pay again. Nothing is deleted. `CompletedRequirement.active` (`reopened_at IS NULL`) is what counts (`Team#completed_requirements`, `Requirement#completed?`, `#cr_for`); `Team#all_completed_requirements` is the history (staff list, `deletable?`, delete guards). One open row per team+requirement is a partial unique index plus validations. `Payments::ReopenPayment` runs under the same lock, refuses unrefunded payments (`not_refunded`), is idempotent, and un-finalizes a finalized team that no longer meets requirements. Operators and admins only (`can :reopen, :charges`; refunders may only refund): `POST /api/v1/staff/payments/:id/reopen`, legacy `POST /completed_requirements/:id/reopen`, and the legacy `reopen` param on `charges#refund`. `refund_batches.reopen` makes `Workers::RefundBatch` reopen after each refund; a refund that worked but whose reopen failed is `reopen_failed` and retry re-queues it.
- Reopening a finalized team releases its place (`Race#full?` counts finalized teams), so on a full race another team can take it and the team then can't pay. A re-finalized team keeps its `assigned_team_number`, `Workers::ClassyCreateFundraisingTeam` no-ops (has `classy_id`), but `team_finalized_email` has no dedupe key and is sent again. A refunded, kept row on an unfinalized team shows the fee done with no way to pay, so reopen abandoned teams.
- `completed_requirements.metadata` is `serialize coder: JSON` and `Requirement#complete` also `JSON.generate`s it, so rows are double-encoded (production-dump rows, e.g. staging ids 21-23, triple). `CompletedRequirement#metadata` unwraps with `JSON.load` until not a String: always use the reader, never `read_attribute`. Reproduce data bugs against a restored copy (`pg_restore` into `dogtag_staging_copy`, `DATABASE_URL=postgres://postgres@localhost/dogtag_staging_copy`).

## Other Quirks

- `teams.classy_id` is an integer; cast Classy API responses.
- Rails 7 resets SMTP settings, so `config/initializers/smtp_settings.rb` works around it.
- Authlogic 6 password validations are explicit (see User).
- `ClassyClient` reuses one memoized `HTTPClient`; never build one per request (each allocates native OpenSSL memory; `ClassyCacheOrgMemberCacher`'s ~318 pages every 20 min ratcheted the worker into R14/R15). Check native churn, not just `GC.stat`. Both Heroku apps need `MALLOC_ARENA_MAX=2` (5 sidekiq threads x ~70 MB glibc arenas). Staging has `log-runtime-metrics` on.
- `REGISTRATION_UI=spa|legacy` decides where racer-facing entry points (homepage "Get started", emails) go; `legacy` or unset uses HAML and is the fallback. `RegistrationUi.spa?` is the only reader.

## Environment Variables

Production requires: `DATABASE_URL`, `STRIPE_PUBLISHABLE_KEY`/`STRIPE_SECRET_KEY`, `SMTP_HOST|PORT|USERNAME|PASSWORD|DOMAIN` (MXRoute; it has no event webhooks, so `rake emails:verify` means "logged as sent" in `sent_emails`), `DEFAULT_FROM_EMAIL`, `APP_HOST` (links in emails; production falls back to `dogtag.chiditarod.org`, so staging must set it).

Optional: `REGISTRATION_UI`, `FEEDBACK_EMAIL` (default `registration@chiditarod.org`), `REFUND_BATCH_LIMIT`, `VITE_DEV_SERVER` (dev only), `CLASSY_CLIENT_ID`/`CLASSY_CLIENT_SECRET`/`CLASSY_ORGS`, `ROLLBAR_ACCESS_TOKEN`.

## Deployment (Heroku)

- Web: Unicorn (`config/unicorn.rb`); worker: Sidekiq. `dogtag` is production (remote `heroku`), `dogtag-staging` is staging (remote `staging`). `git push staging main` / `git push heroku main`.
- The `Procfile` has no `release:` phase, so a push does not migrate. **Standard order for any migration that adds a column the code reads:** push, run `heroku run rails db:migrate` immediately (`-a dogtag-staging` first), then `heroku restart` (dynos that booted earlier keep the old column list). From push until migrated, pages and saves touching the column fail, so deploy production at low traffic and well before a registration opening. Migrations that drop a column lose data on rollback, so run `heroku pg:backups:capture --app dogtag` first; until the restart, older dynos fail on INSERT/UPDATE with "column does not exist". There is no `ignored_columns` step.
- Migrations with this deploy shape so far: `people.instagram`/`tiktok`, `people.zipcode` drop (#329; until migrated every person write fails `NotNullViolation` because the column was NOT NULL), `team_buddies`/`other_buddies`/`collaborating`, `captain_id`, payment columns, `reopened_at`.
- Payment-columns migration: until it runs, `Requirement#complete` writes only metadata (it checks `CompletedRequirement.column_names`) and `#refunded?`/`#charge_id` fall back to metadata, so payments and checklists keep working; refunds and the staff API fail. A payment recorded by a pre-migration dyno after the migration has blank columns (listed `not_refundable`): restart right after migrating, and if one slipped in, rerun the idempotent backfill: `heroku run rails runner 'require Rails.root.join("db/migrate/20261124062730_add_payment_columns_to_completed_requirements").to_s; AddPaymentColumnsToCompletedRequirements.new.backfill_payment_columns'`.

## Yearly Launch Checklist

The 2026 production runbook is `docs/runbooks/2026-production-launch.md`; copy it for the next year.

1. **Race record:** copy last year's race and requirements, shift dates one year, three payment tiers; the owner confirms final dates and prices.
2. **JSONForm:** start from last year's payload, update year-specific text (orientation, food drive, partner), have the owner review, commit to `../dogtag-private/jsonform/`.
3. **Experience labels and confirmation text:** add the new year's label in the admin field; fill the race's confirmation text (Markdown) and have the owner review it.
4. **Heroku:** stage on `dogtag-staging` first. Delete the previous year's app (e.g. `dogtag-22`) and its git remote only after confirming with the owner right then. Provision Postgres, Redis, web and worker dynos. Config vars: Stripe live keys, Classy, SMTP, Rollbar, `REDIS_URL`, Sidekiq web auth, `APP_HOST`, `REGISTRATION_UI`, `MALLOC_ARENA_MAX=2`, `NPM_CONFIG_OMIT=dev` (keeps root test devDependencies out of the build). Restore the production dump, migrate, smoke test.
5. **Live test (production, owner required):** register a real team with production Stripe on a test race or low-price requirement; confirm finalization, the Classy team and emails; refund the charge and remove the Classy team.
6. **Go live.**

## Testing and E2E

- Stripe: `stripe-ruby-mock`; `MockPaymentRequirement` for integration without Stripe calls. Classy: WebMock (see `spec/lib/classy_client_spec.rb`).
- CircleCI runs `circleci testsuite run "rspec"` (suite in `.circleci/test-suites.yml`; results upload via `store-test-results: true`). Validate with `circleci testsuite doctor rspec`; its subprocess loses rbenv shims and hits system Ruby 2.6, so temporarily put `~/.rbenv/shims/bundle` in the `run:` line and never commit that.
- Playwright boots Rails in **development** with `SIDEKIQ_INLINE=true` (ignored in production), `REGISTRATION_UI=spa`, `APP_HOST=localhost:3099`; `VITE_DEV_SERVER` must be unset. CircleCI uses `RAILS_ENV=development` against `dogtag_test` (the test env uses in-memory mail).
- With no `DATABASE_URL` Playwright uses `dogtag_development`, and its global setup runs `test_seeds:cleanup` (deletes every `Race %` race and `@example.com` user). Always set `DATABASE_URL` to a separate migrated DB (e.g. `postgres://postgres@localhost/dogtag_test_2`); if another Rails server owns `tmp/pids/server.pid`, also set `PIDFILE=tmp/pids/e2e-3199.pid` and `TEST_PORT=3199`. Rebuild the SPA first (`npm --prefix frontend run build`). Never run a seed task by hand without `DATABASE_URL`; remove stray rows by unique id, not `test_seeds:cleanup`.
- Each spec seeds via `tests/helpers/seed.ts`. Seeds whose specs expect finalization (`basic`, `payment_tiers`, `stripe_payment`) make the first racer the account holder so the team has a captain; `tests/e2e/registration.spec.ts` picks one with `Make Racer1 Pusher captain`. Person records can only be created while their race is open; move dates with `update_columns` afterwards.
- `playwright.config.ts` sets `storageState` so `dogtag:tour:off` is `1` for every test (the tour would block clicks); the `origin` must match `baseURL`. A spec that wants the tour clears it with `test.use({ storageState: { cookies: [], origins: [] } })`.
- Picker dialog is portaled to `document.body`: use `page.getByRole('dialog')`. Step 1 checkboxes are named `Ada Racer 2025, Team` (substring match, not `exact`); step 2 renames the dialog `Review {full name}` with checkboxes `"{label}: {value}"`. A racer's roster row exists only once added, so wait for it (its name is the full name, so `exact` works).
- E2E targets (`E2E_TARGET`): `npm run e2e` (local, mock payments, Mailpit), `e2e:stripe` (local, Stripe test card), `e2e:staging` (`dogtag-staging.herokuapp.com`, Stripe test card, optional IMAP check via `E2E_CHECK_EMAIL=1`). The Classy check needs `E2E_CHECK_CLASSY=1` (it creates real Classy members/teams). Settings live in gitignored `.env.e2e` (see `tests/README.md`).
- Host guard (`tests/e2e/target.ts`) allows only `localhost`, `127.0.0.1`, `dogtag-staging.herokuapp.com` and refuses `dogtag.chiditarod.org`, `dogtag.herokuapp.com`, `*.chiditarod.org`; no env var extends it. Nothing under `tests/` may use the `heroku` CLI/API. Never pay unless the publishable key starts `pk_test_` (`payFee` enforces it). Locally in mock mode a machine without Stripe keys can run `registration` with `STRIPE_PUBLISHABLE_KEY=pk_test_localfake STRIPE_SECRET_KEY=sk_test_localfake`; never do this for `e2e:stripe` or staging.
- Staging runs log in as an **operator**, never an admin, and create their own `Race E2E <runId> <yyyy-mm-ddThh:mm>Z` via the admin UI. Races are retired (dates in the past, ` [retired]` appended), never deleted; `retireRace` refuses names without `Race E2E `. A run sweeps its own leftovers and other runs' open E2E races older than two hours. Classy teams are deleted only if named `Test Team E2E *` on the allowlisted campaign (867400); Classy refuses deleting a team with pages, so `deleteFundraisingTeam` deletes pages first. A run that dies before cleanup leaves a `Test Team E2E *` team to remove by hand.
- Staging racers are IMAP plus-addresses (`<user>+<runId>@<domain>` from `E2E_EMAIL_BASE`); only this run's mail is deleted. CI runs `npm test` with `E2E_CHECK_EMAIL=1` against Mailpit only; staging secrets and `.env.e2e` never go in CI or artifacts. Playwright keeps `fill` values and traces in reports, so secrets go through `fillSecret` (`tests/e2e/fill-secret.ts`); admin-auth, race-setup, race-teardown and staging registration keep no trace/video, and `race-teardown` deletes `playwright/.auth/staff.json`. Registration folds the retry number into its run id (`<runId>-r1`).
- Before `e2e:staging`, check staging's migrations (`heroku run -a dogtag-staging "bin/rails db:migrate:status"`) and restart afterward; a pending migration shows as "Something went wrong" in the SPA and a 500 `UnknownAttributeError` in logs. Stripe Checkout's expiry field sometimes drops a keystroke, so `payWithStripeCheckout` retypes until it reads `12 / 34`.
- Suite relies on: operators can open the new-requirement form (`can :new, Requirement`); `Requirement.allowed_types` limits the type select ("Mock payment" outside production only); legacy login fields have sr-only labels.
- Staging data is synthetic: `bin/rails staging:seed` (`lib/staging_seed.rb`) fills an **empty** DB and needs `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_PASSWORD` (optional `SEED_EMAIL_BASE`, `SEED_CLASSY_CAMPAIGN_ID`). It refuses on the production host, with a live Stripe key, or with existing users/races.
- Per-feature seeds and specs: `test_seeds:buddy_picker`, `race_list_order`, `show_when`, `team_captain` (includes a 320px row check that buttons stay inside the row), `staff_shell` (16-character refunder first name for the 320px header), `payments_admin`, `payments_partial_failure`, `reopen_payment`, each with a matching `tests/spa/*.spec.ts`. With another session running, use `TEST_PORT=3199` and a separate `DATABASE_URL`.

## Technical Debt

1. **`stripe` gem (~> 1.58.0)** is from ~2017; move to stripe-ruby v10+ (touches `lib/stripe_helper.rb` and payment code; test with `stripe-ruby-mock`).
2. **`coffee-rails`**: migrate `app/assets/javascripts/` to ES6, then drop the gem.
3. **`sass-rails` (~> 5.0)**: consider cssbundling-rails, Propshaft or Dart Sass.
4. **Dependabot PRs to close, not merge:** `codeclimate-test-reporter` 1.0.9 (pins `simplecov <= 0.13`) and the `stripe` 18 / `stripe-ruby-mock` 2.5 jump (item 1). Routine bumps: `bundle update --minor --conservative <gems>` (Rails gems are pinned `~> 8.0.0` and move together).
