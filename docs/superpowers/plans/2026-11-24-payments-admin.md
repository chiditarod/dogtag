# Payments Admin and Bulk Refund Implementation Plan (#343)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One staff page in the SPA that lists every completed payment, filters it to what is left to refund, and refunds a server-capped batch at a time in a background job, with an audit trail and one email per refunded payment.

**Architecture:** Payment facts move out of the JSON `metadata` text into real columns on `completed_requirements` (backfilled). One service (`Payments::RefundCharge`) refunds one payment under the same advisory lock as `ChargeTeam` and is called by both the legacy Refund button and a Sidekiq job (`Workers::RefundBatch`) that works through a `refund_batches`/`refund_batch_items` record. A `/api/v1/staff` API lists payments and queues, reads and retries batches; the SPA gains a staff shell and a payments page that polls a batch for per-row results.

**Tech Stack:** Rails 8, PostgreSQL 17, Sidekiq, stripe 1.58 + stripe-ruby-mock 2.4.1, RSpec + FactoryBot, React 19 + TypeScript, TanStack Query 5, react-router 7, Vitest + MSW, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-23-payments-admin-design.md` (read it with this plan; it holds the reasons).

## Delivery: four stacked PRs

| PR | Branch (from) | Tasks | Implementer |
|----|---------------|-------|-------------|
| A  | `feature/343-refund-backend` (from `main`), PR #345 | 1-6, 6a | Sonnet, **high** (money) |
| B  | `feature/343b-staff-shell` (from A) | 7-8 | Sonnet, medium |
| C  | `feature/343c-payments-page` (from B) | 9-11 | Sonnet, medium |
| D  | `feature/343d-bulk-refund-ui` (from C) | 11b, 12-15 | Sonnet, **high** (irreversible money action) |

**Status (2026-11-24):** PR A (#345) implemented Tasks 1-6. Its departures from the original plan are written into those tasks below as "As shipped". The PR #344 review found gaps that PR A must still close before it merges; they are collected in Task 6a (the deploy guard in Task 6a is already being made in PR #345).

PRs are stacked linearly and opened against `chiditarod/dogtag` (`gh pr create --repo chiditarod/dogtag --base <previous branch>`, A uses `--base main`). We never merge; the owner merges in order A, B, C, D. Each PR body states whether its Playwright spec was actually run, lists any "ask before" file it touched (none are expected), and carries its deploy note below. PR bodies end with the `Generated with Claude Code` line; commits end with the `Co-Authored-By` line.

## Global Constraints

- Work in a worktree per PR (`../dogtag-wt/343a-…` etc.). Use a separate test DB (`DATABASE_URL=postgres://postgres@localhost/dogtag_test_2`, `RAILS_ENV=test bin/rails db:create db:schema:load` once). Playwright: `DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid`, after `npm --prefix frontend run build`.
- **Ask before** touching Gemfile/Gemfile.lock, `config/initializers`, `config/environments`, `config/application.rb`, `spec/spec_helper.rb`. None is needed by this plan. If one seems needed, stop and ask the owner; if approved, call it out in the PR body. Routes, locales, `lib/tasks/test_seeds.rake`, new `spec/support` helpers are fine.
- Migrations via `bin/rails g migration`; `text` for strings, `datetime` for times. Migration specs call the public data method (`backfill_payment_columns`), never `up`/`down`.
- Stripe 1.58 calls only: `Stripe::Charge.retrieve(id: charge_id, expand: ["refunds"])` (with a `Stripe::Refund.list(charge: charge_id)` fallback when the charge carries no `refunds`; see Task 6a), `Stripe::Refund.create({ charge: id }, { idempotency_key: "refund-cr-#{cr.id}" })` (the key goes in **opts**, which become the `Idempotency-Key` header; never in params). stripe-ruby-mock 2.4.1 dedupes refunds only on a *param* `idempotency_key`, so specs assert the opts with `expect(Stripe::Refund).to receive(:create).with(hash_including(charge: …), hash_including(idempotency_key: "refund-cr-#{cr.id}")).and_call_original` rather than relying on mock dedupe. The mock marks a charge `refunded: true` after any refund, so partial-refund specs `allow(Stripe::Charge).to receive(:retrieve).and_return(Stripe::Charge.construct_from(id:, refunded: false, amount: 5000, amount_refunded: 1000, refunds: { data: [] }))`.
- **Idempotency keys replay.** Stripe caches the first response for a key for 24 hours and returns it, errors included, to every later request with that key. The key only collapses duplicate `Refund.create` calls; retry healing comes from the advisory lock plus the charge retrieve check, never from the key. The key's shape is an open owner decision (see Review decisions).
- **No `Stripe.api_version` is pinned.** On API versions 2022-11-15 and later a charge's `refunds` list is absent unless expanded, so code must expand it and must not assume it is there. The owner checks the account's API version before the first live refund. Pinning a version is a `config/initializers` change: ask first.
- Full refunds only. A refunded payment still completes its requirement: no change to finalization or `paid_cents`.
- `REFUND_BATCH_LIMIT` is read in exactly one place: `RefundBatch.max_size` (positive integer from ENV, else 5; clamped to at most `RefundBatch::MAX_SIZE` = 25, Task 6a).
- Status names (verbatim): payment `paid`, `refunding`, `refunded`, `not_refundable`; item `queued`, `refunded`, `already_refunded`, `failed`, `stalled`; service codes `refunded`, `already_refunded`, `not_refundable`, `in_progress`, `partially_refunded`, `amount_mismatch`, `stripe_error`, `unexpected` (a non-ok code becomes item status `failed` with that `error_code`; `failed` is never a service result); API codes 400 `bad_request`, 422 `batch_too_large`, `confirmation_mismatch`, `invalid_total`, `not_refundable`, `selection_changed`, `nothing_to_retry`.
- Confirmation text sent to the server is exactly `REFUND <count>` (e.g. `REFUND 5`); the server does not trim or fold case. The SPA normalizes what was typed and sends the canonical string (Task 13).
- Load associations for lists with `preload`, not `includes` (no join added to paged queries).
- Refund email goes to `team.user` (never `completed_requirement.user`), `kind: "refund"`, `dedupe_key: "refund-cr-<cr id>"`. Racer-facing, so strings in `config/locales/en.yml`. Staff page copy is not translated; it lives in `frontend/src/locales/en.ts` under `staff.*`.
- API errors are `{ error, errors, code }` via `render_errors`; staff endpoints authorize with `authorize! :refund, :charges` (403 otherwise). List endpoints add no per-row queries (`spec/requests/api/v1/query_count_spec.rb`).
- SPA: Bulletproof feature folders (`src/features/staff`, `src/features/staff-payments/{api,components}`), `@` alias, `apiFetch` from `@/lib/api-client`, works at 320px with no horizontal scroll (rows stack below `sm`).
- The legacy HAML racer flow and the legacy Refund button keep working after every PR.
- Double quotes in Ruby, `params.expect`, no `double` (use `instance_double`), request specs assert status plus data changes.

## Review Focus

1. **Two tabs (or a double click) queue the same payment.** The second POST gets 422 `not_refundable` with that id in `errors`, nothing is queued, and Stripe is called once. Pinned in Task 4 (unique partial index → `RecordNotUnique` mapped to 422) and Task 3 (lock + `refunded_at` check).
2. **Sidekiq retries the job after it refunded some items, or the process died between Stripe's refund and our save.** Rerun skips finished items; for the killed item Stripe already shows `refunded: true`, so it is recorded as `already_refunded`, emailed once, and never refunded twice. Pinned in Task 3 and Task 4.
3. **The selection changes between review and submit** (a refetch moved a row to Refunded, or a crafted request sends different ids or a stale total). 422 `selection_changed` / `not_refundable` server side; the dialog refuses client side. Pinned in Task 4 and Task 13.
4. **Old rows: undecodable metadata, triple-encoded metadata, legacy `"refunded": true`, mock charges, `ch_seed_*` fake charges.** Backfill skips and logs the first, decodes the others; mock rows are `not_refundable` in production only; a fake charge fails with `stripe_error` and a readable message, and is retryable. Pinned in Task 1, Task 3 and Task 5.
5. **`REFUND_BATCH_LIMIT` set to junk (`"0"`, `"-3"`, `"ten"`, blank) or too high (`"100"`).** Junk falls back to 5, too high clamps to 25; the API reports the value in use and the SPA caps selection at it. Pinned in Task 2, Task 6a and Task 11b.
6. **The deploy window.** From the push until the migration has run, `Requirement#complete` passing the new attributes raises after Stripe charged the card ("Charged but not recorded"; the racer's retry charges again), and team pages calling `refunded?` raise until the dynos restart. The guard in Task 6a (write the columns only when they exist; `refunded?` falls back to metadata) makes payments and team pages work throughout. Pinned in Task 6a and the PR A deploy note.
7. **A batch whose job never ran.** Its items must not keep payments `refunding` forever or keep the results dialog open forever. Stale queued items stop counting after 10 minutes, are marked stalled when the payment is queued again, and the batch reports `done`. Pinned in Task 6a and Task 14.

---

## PR A: backend (Tasks 1-6) — Sonnet, high effort

### Task 1: Payment columns on `completed_requirements` and backfill

**Files:**
- Create: `db/migrate/<ts>_add_payment_columns_to_completed_requirements.rb` (`bin/rails g migration AddPaymentColumnsToCompletedRequirements`), `spec/migrations/add_payment_columns_to_completed_requirements_spec.rb`
- Modify: `app/models/completed_requirement.rb`, `app/models/requirement.rb` (`#complete`), `app/views/requirements/_payment_requirement.html.haml`, `db/schema.rb`, `spec/models/completed_requirement_spec.rb`, `spec/models/requirement_spec.rb`, `spec/factories/completed_requirement.rb`

**Interfaces:**
- Produces: columns `charge_id` (text, indexed, not unique), `amount_cents` (integer), `refunded_at` (datetime), `refunded_by_id` (bigint, FK `users`, `on_delete: :nullify`), `stripe_refund_id` (text).
- Produces: `AddPaymentColumnsToCompletedRequirements#backfill_payment_columns` (public): for every row, decode via `CompletedRequirement#metadata`; set `charge_id = metadata["charge_id"]`, `amount_cents = metadata["amount"]` (Integer or nil); when `metadata["refunded"]` is truthy, `refunded_at = updated_at`, `refunded_by_id` stays nil. Undecodable row: `Rails.logger.warn` with its id and skip. Uses `update_columns` (no callbacks, no email). Idempotent.
- Produces: `CompletedRequirement#refunded?` (`refunded_at.present?`), `belongs_to :refunded_by, class_name: "User", optional: true`.
- Produces: `Requirement#complete(team_id, user, metadata = {})` also writes `charge_id: metadata["charge_id"]`, `amount_cents: metadata["amount"]` (same metadata as today).

- [ ] **Step 1: Failing specs.**
  - Migration spec (`described_class.new.backfill_payment_columns` inside `suppress_messages`, then `CompletedRequirement.reset_column_information`): `"copies charge_id and amount from double-encoded metadata"`; `"copies them from triple-encoded metadata"` (write the raw column with `update_column(:metadata, JSON.generate(JSON.generate(JSON.generate(hash))))`); `"sets refunded_at to updated_at and leaves refunded_by nil for legacy refunded rows"`; `"skips a row whose metadata cannot be decoded"` (`update_column(:metadata, "{not json")`, columns stay nil, no raise); `"sends no email"` (`Workers::PaymentRefundedEmail` has no jobs — add this example in Task 3 once the worker exists).
  - `requirement_spec.rb`: `"#complete stores charge_id and amount_cents"` (`charge_id == "ch_1"`, `amount_cents == 5000`, `metadata["charge_id"] == "ch_1"` still).
- [ ] **Step 2: Run** `bundle exec rspec spec/migrations/add_payment_columns_to_completed_requirements_spec.rb spec/models/requirement_spec.rb` — Expected: FAIL (unknown attribute / method).
- [ ] **Step 3: Implement.** Generate the migration; `change` adds the columns, index and FK, then `reversible { |d| d.up { backfill_payment_columns } }`. Run `bin/rails db:migrate` and `RAILS_ENV=test bin/rails db:migrate`; keep only this migration's lines in `db/schema.rb`. Update the model and `Requirement#complete`. Switch the legacy partial to `cr.refunded?` for the label and `cr.charge_id` for `charge_refund_url` (the permission check changes in Task 5).
- [ ] **Step 4: Run** the Step 2 command plus `bundle exec rspec spec/models spec/controllers/charges_controller_spec.rb` — Expected: PASS.
- [ ] **Step 5: Commit** "Store charge id, amount and refund audit columns on completed requirements".

**As shipped (PR #345, 87083e7 and 7b27ff8):** the backfill calls `CompletedRequirement.reset_column_information` first, skips non-hash metadata as well as undecodable metadata, sets `amount_cents = Integer(metadata["amount"].to_s, exception: false)` (the amount may be a string), and sets `refunded_at = updated_at || created_at || Time.current` only when it is still nil. To keep the legacy label and the legacy refund in step between this commit and Task 5, `CompletedRequirement.mark_refunded_by_charge` also wrote `refunded_at` here (Task 5 then removed the method). Still to fix in Task 6a: `Integer(..., 10, exception: false)` (without the base, `"010"` reads as 8), and the deploy guard on `Requirement#complete` and `refunded?`.

### Task 2: Refund batch tables, models and the batch cap

**Files:**
- Create: `db/migrate/<ts>_create_refund_batches.rb` (`bin/rails g migration CreateRefundBatches`), `app/models/refund_batch.rb`, `app/models/refund_batch_item.rb`, `spec/models/refund_batch_spec.rb`, `spec/models/refund_batch_item_spec.rb`, `spec/factories/refund_batch.rb`
- Modify: `app/models/completed_requirement.rb`, `db/schema.rb`, `lib/tasks/test_seeds.rake` (cleanup), `spec/models/completed_requirement_spec.rb`

**Interfaces:**
- Produces: `refund_batches(user_id bigint not null FK users, retry_of_id bigint FK refund_batches on_delete: :nullify, finished_at datetime, timestamps)`; `refund_batch_items(refund_batch_id FK on_delete: :cascade, completed_requirement_id FK on_delete: :cascade, status text not null default "queued", error_code text, message text, finished_at datetime, timestamps)`, index on `refund_batch_id`, **unique partial index on `completed_requirement_id` where `status = 'queued'`**.
- Produces: `RefundBatch` (`belongs_to :user`, `belongs_to :retry_of, optional`, `has_many :items, class_name: "RefundBatchItem"`), `RefundBatch.max_size -> Integer`, `RefundBatch::STALL_AFTER = 10.minutes`, `RefundBatch#mark_stalled!` (queued items of a batch created more than `STALL_AFTER` ago → `stalled`, `finished_at = now`), `RefundBatch#finished?`.
- Produces: `RefundBatchItem::STATUSES = %w[queued refunded already_refunded failed stalled]`, scope `queued`.
- Produces: `CompletedRequirement.payment_status_sql -> String` (SQL `CASE` over `completed_requirements`/`requirements`: `refunded_at IS NOT NULL` → `refunded`; `EXISTS` queued item → `refunding` (only one created less than `STALL_AFTER` ago, Task 6a); `charge_id IS NULL` or (`requirements.type = 'MockPaymentRequirement'` and `Rails.env.production?`) → `not_refundable`; else `paid`), scope `with_payment_status(status)` (requires `joins(:requirement)`), and `#payment_status -> String` (evaluates the same SQL for one row). This is the one definition; nothing else re-derives status.
- Produces: `CompletedRequirement#refundable? -> Boolean` (`payment_status == "paid"`).

- [ ] **Step 1: Failing specs.**
  - `refund_batch_spec.rb`: `".max_size is 5 when REFUND_BATCH_LIMIT is unset"`, `"is 10 when it is \"10\""`, `"is 5 for \"0\", \"-3\", \"ten\" and \"\""` (use `ClimateControl` if present, else `stub_const("ENV", ENV.to_h.merge(...))`); `"#mark_stalled! marks queued items stalled only after 10 minutes"` (Timecop: at 9 min still `queued`, at 11 min `stalled` with `finished_at`; a `refunded` item is untouched).
  - `refund_batch_item_spec.rb`: `"cannot queue the same completed requirement twice"` (second `create!` with `status: "queued"` raises `ActiveRecord::RecordNotUnique`); `"allows a new queued item once the old one is stalled"`.
  - `completed_requirement_spec.rb`: `"#payment_status"` examples for each status, including `"mock payment is not_refundable in production and paid elsewhere"` (`allow(Rails.env).to receive(:production?).and_return(true)`), and `"with_payment_status(\"paid\") matches #payment_status for every row"`.
- [ ] **Step 2: Run** `bundle exec rspec spec/models/refund_batch_spec.rb spec/models/refund_batch_item_spec.rb spec/models/completed_requirement_spec.rb` — Expected: FAIL.
- [ ] **Step 3: Implement.** Migration, models, status SQL. In `test_seeds:cleanup` add, before the users are destroyed: `RefundBatch.where(user_id: User.where("email LIKE ?", "%@example.com").select(:id)).delete_all` and `CompletedRequirement.where(requirement_id: Requirement.where(race_id: Race.where("name LIKE ?", "Race %").select(:id)).select(:id)).delete_all` (items go by FK cascade; today's cleanup leaves orphan completed requirements behind).
- [ ] **Step 4: Run** the Step 2 command — Expected: PASS.
- [ ] **Step 5: Commit** "Add refund batches and one payment status definition".

**As shipped (PR #345, ba0b7e2, d5707d1, d572d76):** `RefundBatch has_many :items, dependent: :delete_all`; `RefundBatch#stalled?` (batch created at least `STALL_AFTER` ago) and `#reported_status(item)` report a queued item of a stalled batch as `stalled` without writing; only `mark_stalled!` (called by retry) rewrites items. `User has_many :refund_batches, dependent: :restrict_with_error`, and `UsersController#destroy` shows the model's error ("Cannot delete record because dependent refund batches exist") instead of a generic failure. Still to fix in Task 6a: `payment_status_sql` counts every queued item as `refunding` whatever its age, `max_size` has no upper clamp, and `mark_stalled!` does not set the batch's `finished_at`.

### Task 3: `Payments::RefundCharge`, shared lock, refund email

**Files:**
- Create: `app/services/payments/advisory_lock.rb`, `app/services/payments/refund_charge.rb`, `app/workers/workers/payment_refunded_email.rb`, `app/views/user_mailer/payment_refunded_email.html.haml` (and `.text.haml` if siblings have one), `spec/services/payments/refund_charge_spec.rb`, `spec/workers/payment_refunded_email_spec.rb`
- Modify: `app/services/payments/charge_team.rb` (use the shared lock), `app/mailers/user_mailer.rb`, `config/locales/en.yml`, `spec/mailers/user_mailer_spec.rb`, `spec/migrations/add_payment_columns_to_completed_requirements_spec.rb` (the "sends no email" example)

**Interfaces:**
- Produces: `Payments::AdvisoryLock.with_lock(team_id:, requirement_id:) { … } -> block value, or Payments::AdvisoryLock::HELD` and `Payments::AdvisoryLock.alert(message)` (log + Rollbar). Moved verbatim from `ChargeTeam#with_advisory_lock`/`#release_advisory_lock`/`#alert`; same key `(team_id, requirement_id)`, so a refund and a charge for the same payment exclude each other. `ChargeTeam` maps `HELD` to `failure(:in_progress)`; its specs must pass unchanged.
- Produces: `Payments::RefundCharge.call(user:, completed_requirement:) -> Result` with `Result = Data.define(:ok, :code, :message)`; `ok` is true for `refunded` and `already_refunded`.
- Produces: `Workers::PaymentRefundedEmail.perform_async({ "user_id", "team_id", "completed_requirement_id", "requirement_name", "amount_cents", "race_name" })` (plain values, so it still sends after an admin deletes the row); `UserMailer#payment_refunded_email(user, team, details)` with `track(kind: "refund", team:, user:, dedupe_key: "refund-cr-#{details[:completed_requirement_id]}")`.

Service order (spec "RefundCharge" steps 1-9): `already_refunded` if `refunded?` (no lock, no Stripe) → lock (`in_progress` when `HELD`) → `reload`; `already_refunded` if `refunded?` → `not_refundable` if `payment_status == "not_refundable"` → mock outside production: record with `stripe_refund_id: nil`, no Stripe → `Stripe::Charge.retrieve(id:, expand: ["refunds"])`; `charge.refunded` → record the covering refund (amount equal to the charge, else the newest) with `refunded_by: nil` and `refunded_at` = its Stripe `created`, return `already_refunded`; `amount_refunded > 0` → `partially_refunded` with message naming the amount already refunded; `charge.amount != amount_cents` → `amount_mismatch` → `Stripe::Refund.create` (Global Constraints) → record. **Record** = one `update_columns` (validations skipped on purpose: a refund that reached Stripe is always recorded) of `refunded_at`, `refunded_by_id`, `stripe_refund_id`, `metadata` (`JSON.generate(metadata.merge("refunded" => true))`, matching `Requirement#complete`) and `updated_at`, then enqueue the email (a failure to enqueue is alerted, never fails the refund). Rescue like `ChargeTeam`: `Stripe::InvalidRequestError` → `stripe_error` with Stripe's reason; other `Stripe::StripeError` → `stripe_error` and, if `Refund.create` was sent with no response, `alert` "Refund outcome unknown … charge X team Y requirement Z; retry heals it"; a failure after Stripe returned a refund → `alert` "Refunded at Stripe but not recorded" with refund id, charge, team, requirement, then `unexpected`; anything else → `unexpected`.

**As shipped (PR #345, 63e35d0, d487c02, 4da8f58, 2d14ccc, d1d1ae3, d08ae1e):** as above, with three differences that Task 6a fixes: the `not_refundable` check runs first (before `refunded?` and the lock), the charge is retrieved without `expand` (the code reads `charge[:refunds]` safely and falls back to now when absent, but then records no refund id), and `already_refunded` from the `refunded?` checks never re-queues a lost email. The email worker skips (logs) when the user or team no longer exists. A mock payment is never recorded refunded in production even if the status check were bypassed.

- [ ] **Step 1: Failing specs** (`StripeMock.start`/`stop`; build a real charge with `Stripe::Charge.create` on a `StripeMock.create_test_helper.generate_card_token`, complete the requirement with that `charge_id`):
  - `"refunds the charge and records who and when"` (`code == :refunded`, `refunded_by == refunder`, `refunded_at` set, `stripe_refund_id` starts with `"re_"`, `metadata["refunded"] == true`, one `Workers::PaymentRefundedEmail` job with `"user_id" => team.user.id`) — and the idempotency-key expectation from Global Constraints.
  - `"records a charge already refunded at Stripe as already_refunded and emails once"` (refund it through Stripe first; no second `Stripe::Refund.create`; one email job).
  - `"returns already_refunded without calling Stripe when refunded_at is set"` (`expect(Stripe::Charge).not_to receive(:retrieve)`; no email job).
  - `"returns partially_refunded and changes nothing"` (constructed charge, message includes `"$10.00"`).
  - `"returns stripe_error with Stripe's reason for an unknown charge"` (`charge_id: "ch_seed_1"`, nothing recorded).
  - `"returns stripe_error and alerts when Refund.create raises a connection error"` (`StripeMock.prepare_error(Stripe::APIConnectionError.new("timeout"), :new_refund)`; `expect(Payments::AdvisoryLock).to receive(:alert).with(/Refund outcome unknown/)`).
  - `"returns in_progress while the payment lock is held"` (hold `pg_try_advisory_lock(team_id, requirement_id)` on a second connection from `ActiveRecord::Base.connection_pool.checkout`).
  - `"mock payment: refunds without Stripe in development, not_refundable in production"`.
  - Mailer: `"#payment_refunded_email goes to the team owner with race, team, payment type and amount"`, `"tracks kind refund with dedupe_key refund-cr-<id>"`, `"a second delivery with the same dedupe key is suppressed"` (one `SentEmail` row; one delivery).
- [ ] **Step 2: Run** `bundle exec rspec spec/services/payments spec/mailers/user_mailer_spec.rb spec/workers/payment_refunded_email_spec.rb` — Expected: new examples FAIL, existing `charge_team_spec` PASS.
- [ ] **Step 3: Implement** the lock module (then make `ChargeTeam` use it), the service, the worker (`queue: :default, retry: true`, mirrors `Workers::TeamFinalizedEmail`), the mailer method and `en.yml` strings under `user_mailer.payment_refunded_email.*` (subject, body with race, team, payment type, amount, "Refunds usually take 5-10 business days to appear", help line `dogtag@chiditarod.org`).
- [ ] **Step 4: Run** the Step 2 command plus `bundle exec rspec spec/controllers/charges_controller_spec.rb spec/requests/api/v1/payments_spec.rb` — Expected: PASS.
- [ ] **Step 5: Commit** "Refund one payment through a locked, idempotent service and email the team owner".

### Task 4: `Workers::RefundBatch` and queuing a batch

**Files:**
- Create: `app/services/payments/queue_refund_batch.rb`, `app/workers/workers/refund_batch.rb`, `spec/services/payments/queue_refund_batch_spec.rb`, `spec/workers/refund_batch_spec.rb`

**Interfaces:**
- Produces: `Payments::QueueRefundBatch.call(user:, completed_requirement_ids:, confirmation:, expected_total_cents:) -> Result` and `Payments::QueueRefundBatch.retry(user:, batch:) -> Result`, `Result = Data.define(:ok, :code, :errors, :batch)`. Checks in order: `batch_too_large` (`ids.size > RefundBatch.max_size`), `confirmation_mismatch` (`confirmation != "REFUND #{ids.size}"`), `not_refundable` (`errors` keyed by id string: `["already refunded"]`, `["being refunded"]`, `["not refundable"]`, `["not found"]`), `selection_changed` (`expected_total_cents != sum(amount_cents)`). All-or-nothing in one transaction; `ActiveRecord::RecordNotUnique` on the queued index → `not_refundable` with `["being refunded"]` for every id. Empty or duplicate ids → `bad_request`. On success enqueue `Workers::RefundBatch.perform_async({ "refund_batch_id" => batch.id })` **after** commit.
- `retry`: `batch.mark_stalled!`, then the batch's `stalled` items and its retryable `failed` items (Task 6a: not `partially_refunded`, `not_refundable` or `amount_mismatch`) whose completed requirements are still `paid` become a new batch with `retry_of: batch` (no confirmation; still capped, same `not_refundable` handling; nothing to retry → `nothing_to_retry`).
- Produces: `Workers::RefundBatch` (`include Sidekiq::Worker`, `include Workers::Common`, `sidekiq_options queue: :important, retry: 3, backtrace: true`), `run(job, log)`: for each `queued` item of the batch ordered by id, call `Payments::RefundCharge` with `batch.user` and update the item (`status` = `refunded`/`already_refunded` from the code, otherwise `failed` with `error_code`, `message`; `finished_at`); then `batch.update!(finished_at:)`. An item already marked `stalled` is skipped.

- [ ] **Step 1: Failing specs.**
  - Queue service: one example per code above with exact `errors` keys; `"queues nothing when any id is bad"` (`RefundBatch.count` and `RefundBatchItem.count` unchanged); `"rejects 6 ids when the limit is 5"`; `"accepts 10 ids when REFUND_BATCH_LIMIT is 10"`; `"a second batch for a queued payment is not_refundable and queues nothing"`; `"retry re-queues failed and stalled items as a new batch with retry_of"`; `"retry skips an item that has since been refunded"`.
  - Worker (`Sidekiq::Testing.inline!`, StripeMock): `"refunds every queued item and finishes the batch"`; `"resumes after a mid-batch failure without refunding or emailing twice"` (first run: second item's `RefundCharge` raises once via `allow(...).and_call_original` + one-time raise; rerun the worker: `Stripe::Refund.create` called exactly 3 times for 3 items, 3 email jobs); `"records failed with error_code and message"` (`ch_seed_1` → `failed`, `stripe_error`); `"rerunning a finished batch does nothing"`.
- [ ] **Step 2: Run** `bundle exec rspec spec/services/payments/queue_refund_batch_spec.rb spec/workers/refund_batch_spec.rb` — Expected: FAIL.
- [ ] **Step 3: Implement** both.
- [ ] **Step 4: Run** the Step 2 command — Expected: PASS.
- [ ] **Step 5: Commit** "Queue capped refund batches and work through them in Sidekiq".

**As shipped (PR #345, f6c2bd6, d5707d1, ee8a063):** check order is `bad_request` (not an array, empty, duplicate or non-integer ids; 400) → `batch_too_large` → `confirmation_mismatch` (exact string) → `invalid_total` (the total must be an integer, a numeric string, or a float with no fraction; `10000.0` matches `10000`) → `not_refundable` → `selection_changed`. If enqueuing the job fails after the commit, the batch stays saved and an alert says its items will show as stalled after 10 minutes. `retry` returns `nothing_to_retry` when nothing qualifies. The worker loads each item with `batch.items.find(item_id)` and skips it unless still `queued`. Still to fix in Task 6a: the worker's `find` raises for an item deleted with its completed requirement, `retry` re-queues every `failed` item (including ones a retry cannot change), and queuing a payment whose old queued item is stale hits the unique index.

### Task 5: Legacy Refund button through the service; Ability alignment

**Files:**
- Modify: `app/controllers/charges_controller.rb` (`#refund`), `app/views/requirements/_payment_requirement.html.haml`, `app/models/completed_requirement.rb` (remove `mark_refunded_by_charge`, keep or remove `delete_by_charge` per its remaining callers), `spec/controllers/charges_controller_spec.rb` (`describe '#refund'` blocks at ~L35 and ~L446), `spec/models/completed_requirement_spec.rb`, `spec/models/ability_spec.rb`

**Interfaces:**
- Consumes: `Payments::RefundCharge.call(user:, completed_requirement:)`.
- Produces: `POST /charges/:charge_id/refund` finds `CompletedRequirement.find_by!(charge_id: params[:charge_id])` (404 JSON when missing), calls the service synchronously, sets `flash[:notice]` on `ok` (`already_refunded` says so) or `flash[:error] = result.message`, then redirects to `prior_url`. `require_charge_object` is no longer used by `refund`. `delete_completed_requirement` is cast with `ActiveModel::Type::Boolean` (today `"false"` counts as true); when true, admin, and the service returned `ok`, log one line (charge id, team id, requirement id, admin user id, time) and destroy the row with `CompletedRequirementAuditor` subscribed.
- The **Ability fix:** the partial shows Refund when `can?(:refund, :charges)` (today it checks `is_any_of? [:refunder, :admin]`, hiding it from operators whom `Ability` already allows, and whom the new API allows). "Refund and invalidate" stays admin-only. No new Ability rules are added; `ability_spec.rb` pins that refunder, operator and admin `can :refund, :charges` and a racer cannot.

- [ ] **Step 1: Rewrite the failing controller specs** to assert behavior (status, redirect, data), not `receive(:delete_by_charge)`: `"refunds through the service and records refunded_by"`, `"reports already refunded without calling Stripe again"`, `"shows the service's message when Stripe fails"`, `"admin with delete_completed_requirement=true deletes the row after refunding"`, `"delete_completed_requirement=false keeps the row"`, `"non-admin passing delete keeps the row"`, `"404 for an unknown charge id"`, `"a racer is denied"`; plus a `render_views` spec that an operator sees the Refund button on a paid team and a racer does not.
- [ ] **Step 2: Run** `bundle exec rspec spec/controllers/charges_controller_spec.rb spec/models/ability_spec.rb` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bundle exec rspec` (full) — Expected: PASS.
- [ ] **Step 5: Commit** "Route the legacy Refund button through RefundCharge and show it to every refunder role".

**As shipped (PR #345, 56357e7, d572d76):** `CompletedRequirement.find_by(charge_id:)` with a 404 JSON body; `mark_refunded_by_charge` and `require_charge_object` removed; `refund_notice` casts the flag, logs the audit line and destroys the row (its batch items go by FK cascade, which is why the worker must skip a deleted item, Task 6a). Deleting a user with refund batches is refused with the model's message (Task 2).

### Task 6: `/api/v1/staff` API and fee item `refunded`

**Files:**
- Create: `app/controllers/api/v1/staff/base_controller.rb`, `app/controllers/api/v1/staff/payments_controller.rb`, `app/controllers/api/v1/staff/refund_batches_controller.rb`, `app/services/payments/payment_search.rb`, `app/views/api/v1/staff/payments/index.json.jbuilder`, `app/views/api/v1/staff/refund_batches/show.json.jbuilder`, `spec/requests/api/v1/staff/payments_spec.rb`, `spec/requests/api/v1/staff/refund_batches_spec.rb`, `spec/services/payments/payment_search_spec.rb`
- Modify: `config/routes.rb` (inside `namespace :v1`, above the catch-all), `app/services/team_checklist.rb` (`fee_line` adds `refunded`), `spec/services/team_checklist_spec.rb`, `spec/requests/api/v1/query_count_spec.rb`, `README.md` (env var), `CLAUDE.md` (key learnings)

**Interfaces:**
- Routes: `namespace :staff do resources :payments, only: :index; resources :refund_batches, only: [:create, :show] do post :retry, on: :member, action: :retry_failed end end` (`retry` is a Ruby keyword, so the action is `retry_failed`; the path stays `/retry`).
- `Api::V1::Staff::BaseController < Api::V1::BaseController`: `before_action :require_api_user!` then `authorize! :refund, :charges`.
- `Payments::PaymentSearch.new(race_id:, payment_type:, status:, q:, page:)` with `#payments` (relation, 25 per page, order `completed_requirements.created_at DESC, completed_requirements.id DESC`, `preload(:user, :refunded_by, requirement: :race, team: :user)`, selects `payment_status_sql AS payment_status`), `#meta`, `#filters`. `race_id` absent → the default race (shipped: the newest open race by `race_datetime`, else the newest race; the proposed "most recent race whose `race_datetime` has passed, else the newest" waits on the owner, see Review decisions), `race_id=all` → every race, an unknown id → nothing; `payment_type` is a requirement id within that race; `status` one of the four or `all` (absent = `all`); `q` ILIKE, with `sanitize_sql_like`, on the team name and on the name (`CONCAT_WS(' ', first_name, last_name)`) or email of the account holder, the payer, or any racer (`EXISTS` subqueries); inner joins drop orphan rows.
- `GET /api/v1/staff/payments` → `{ payments: [{ id, race: { id, name }, team: { id, name }, owner: { name, email }, paid_by: { name, email }, payment_type, amount_cents, paid_at, status, refunded_at, refunded_by: { name } | null }], meta: { page, per_page, total_count, total_pages, refund_batch_limit, summary: { count, refunded_count, total_cents, refunded_cents } }, filters: { race_id, races: [{ id, name, registration_status }], payment_types: [{ id, name }] } }`. Summary uses the same filters except `status`.
- `POST /api/v1/staff/refund_batches` (`params.expect(completed_requirement_ids: [])`, `confirmation`, `expected_total_cents`) → 201 `{ batch }` or 422/400 `render_errors(..., code:)` with `errors` from the service. `POST /:id/retry` → 201 `{ batch }` or 422. `GET /:id` never writes; it reports a queued item of a batch older than `STALL_AFTER` as `stalled` (`RefundBatch#reported_status`) → 200 `{ batch: { id, created_at, finished_at, retry_of_id, done, items: [{ id, completed_requirement_id, team_name, payment_type, amount_cents, status, error_code, message, finished_at, retryable }] } }` (`done` and `retryable` come in Task 6a).
- `TeamChecklist` fee line: `refunded: Boolean` (from the already loaded completed requirement; no extra query).

- [ ] **Step 1: Failing request specs.** Authorization: `"a racer gets 403"` (and 401 logged out); `"refunder, operator and admin get 200"`. Payments: `"defaults to the newest open race, and race_id=all lists every race"`, `"filters by payment_type and status"`, `"q matches team name and the payer's, owner's and racers' names and emails, case-insensitively"`, `"q treats % and _ literally"`, `"pages 25 per page in created_at desc, id desc order"`, `"summary ignores the status filter"`, `"reports refund_batch_limit"`. Batches: one example per 422 code asserting `json["code"]` and that `RefundBatch.count` is unchanged; `"201 queues the batch and enqueues the job"` (`Workers::RefundBatch.jobs.size == 1`); `"retry returns a new batch with retry_of_id"`; `"show reports items stalled after 10 minutes"` (Timecop). Query count: `"GET /staff/payments does not add queries per row"` (measure with 1 payment, then 5, expect equal). `team_checklist_spec`: `"fee item is refunded after a refund"`.
- [ ] **Step 2: Run** `bundle exec rspec spec/requests/api/v1/staff spec/services/payments/payment_search_spec.rb spec/requests/api/v1/query_count_spec.rb spec/services/team_checklist_spec.rb` — Expected: FAIL.
- [ ] **Step 3: Implement.** Check the list query with `EXPLAIN ANALYZE` on a restored copy; add an index only if it helps (spec leaves this to the builder; note the result in the PR).
- [ ] **Step 4: Run** `bin/check rspec` — Expected: all green.
- [ ] **Step 5: Docs and commit.** README: `REFUND_BATCH_LIMIT` (optional, default 5) and the staff payments API. CLAUDE.md: a short "Refunds (#343)" entry (columns, single status SQL, service, worker, cap, legacy button, deploy order), and remove from the `## Planned: Payments admin page (#343)` section the bullets this PR ships (refund service, cap, audit), so a reader never finds the same feature both planned and shipped. Commit "Add the staff payments and refund batch API".

**As shipped (PR #345, 6cc7465, d5707d1):** as above, with `preload`, the name-or-email search, `invalid_total`, `nothing_to_retry`, and a `GET /:id` that never writes (it does not call `mark_stalled!`; stalled is only reported). CLAUDE.md gained Known Quirk 11 "Refunds (#343)"; the `Planned` section was not yet trimmed (Task 6a).

### Task 6a: PR A review fixes (required before PR A merges)

From the PR #344 review of the plan against what PR #345 shipped. Each item names the behavior; specs as listed. The deploy guard (first item) is being made in PR #345 already; the rest belong in the same PR.

**Files:**
- Modify: `app/models/requirement.rb`, `app/models/completed_requirement.rb`, `app/models/refund_batch.rb`, `app/services/payments/refund_charge.rb`, `app/services/payments/queue_refund_batch.rb`, `app/workers/workers/refund_batch.rb`, `app/views/api/v1/staff/refund_batches/show.json.jbuilder`, `db/migrate/20261124062730_add_payment_columns_to_completed_requirements.rb` (the backfill method only; the migration has not run anywhere shared), `lib/staging_seed.rb`, `CLAUDE.md`, `README.md`, and the matching specs (`spec/models/requirement_spec.rb`, `spec/models/completed_requirement_spec.rb`, `spec/models/refund_batch_spec.rb`, `spec/services/payments/refund_charge_spec.rb`, `spec/services/payments/queue_refund_batch_spec.rb`, `spec/workers/refund_batch_spec.rb`, `spec/requests/api/v1/staff/refund_batches_spec.rb`, `spec/migrations/add_payment_columns_to_completed_requirements_spec.rb`, `spec/lib/staging_seed_spec.rb` if one exists)

**Behavior:**
1. **Deploy guard.** `Requirement#complete` passes `charge_id`/`amount_cents` only when `CompletedRequirement` knows those attributes; `CompletedRequirement#refunded?` returns `metadata["refunded"]` truthiness when `refunded_at` is not a known attribute. Specs stub the attribute check: `"#complete records the payment (metadata only) before the columns exist"`, `"#refunded? falls back to metadata before the column exists"`.
2. **Backfill amount.** `Integer(metadata["amount"].to_s, 10, exception: false)`. Spec: `"reads \"010\" as 10 and \"5000\" as 5000"`.
3. **Service check order.** `refunded?` first (`already_refunded`, no lock), again after the reload inside the lock, then `not_refundable`. Spec: `"a refunded payment with no charge id returns already_refunded, not not_refundable"`.
4. **Expanded refunds.** `Stripe::Charge.retrieve(id: cr.charge_id, expand: ["refunds"])`; when the returned charge has no `refunds`, `Stripe::Refund.list(charge: cr.charge_id)`. Confirm both exist in stripe 1.58 and stripe-ruby-mock 2.4.1 (Context7/gem source); if the mock ignores `expand`, stub `retrieve` with a constructed charge without `refunds` for the fallback spec. Specs: `"retrieves the charge with refunds expanded"`, `"lists refunds when the charge carries none"`.
5. **Lost refund email.** On `already_refunded` from the `refunded?` checks, enqueue the email again when no `SentEmail` row has `kind: "refund"` and `dedupe_key: "refund-cr-<id>"`, and only when `stripe_refund_id` or `refunded_by_id` is present (never for backfilled legacy refunds). Specs: `"re-queues the email when none was logged"`, `"does not re-queue when the email was logged"`, `"never emails a backfilled legacy refund"`.
6. **Stale queued items.** `payment_status_sql` counts as `refunding` only a queued item created less than `RefundBatch::STALL_AFTER` ago (`refund_batch_items.created_at > NOW() - INTERVAL '10 minutes'`, built from the constant). `QueueRefundBatch` (both `call` and `retry`), inside its transaction and before inserting, marks queued items older than `STALL_AFTER` for the same payments `stalled` with `finished_at`, then sets `finished_at` on any batch left with no queued items. Specs: `"a queued item older than 10 minutes no longer counts as refunding"`, `"queuing a payment whose old item is stale marks it stalled and queues the new one"`.
7. **Batch finishes once nothing is queued.** `mark_stalled!` and item 6 set the batch's `finished_at` when no queued items remain. The batch JSON adds `done` (`finished_at` present, or no item's `reported_status` is `queued`). Spec: `"a stalled batch reports done"`.
8. **Worker claims items.** Re-read each item with `RefundBatchItem.find_by(id: item_id)` right before processing; skip it when nil (deleted with its completed requirement) or not `queued`. Spec: `"skips an item deleted by refund and invalidate and still finishes the batch"`.
9. **Retry exclusions.** `retry` re-queues `stalled` items and `failed` items whose `error_code` is `stripe_error`, `in_progress` or `unexpected`; never `partially_refunded`, `not_refundable` or `amount_mismatch`. The batch JSON marks each item `retryable` with the same rule (one method on `RefundBatchItem`, used by both). Spec: `"retry leaves out partially_refunded, not_refundable and amount_mismatch"`.
10. **Batch cap clamp.** `RefundBatch::MAX_SIZE = 25`; `max_size` returns `[value, MAX_SIZE].min` for a positive integer, else 5. Spec: `"is 25 for \"100\""`.
11. **Exact confirmation.** Request spec: `"\"refund 5\", \" REFUND 5\" and \"REFUND  5\" are 422 confirmation_mismatch; \"REFUND 5\" is 201"`.
12. **Staging seed.** `lib/staging_seed.rb` writes `charge_id` and `amount_cents` on the completed requirements it creates (it runs after the migrations, so the backfill never sees them). Check by running `staging:seed` against a scratch database (`DATABASE_URL=postgres://postgres@localhost/dogtag_seed_check`) and confirming `CompletedRequirement.where(charge_id: nil).count == 0`.
13. **Docs.** CLAUDE.md: update Known Quirk 11 for items 1-10, and trim the `## Planned: Payments admin page (#343)` section to what PRs B-D still have to ship (the section comes with this docs PR, #344; if PR A's base does not have it yet, trim it in whichever PR merges second). README: the 25 cap.

- [ ] **Step 1:** failing specs above. **Step 2:** run them (FAIL). **Step 3:** implement. **Step 4:** `bin/check rspec` (PASS). **Step 5:** commit per item group ("Guard the payment columns until the migration has run", "Refund check order, expanded refunds and the lost-email heal", "Stale queued items, retry exclusions and the batch cap", "Fill payment columns in the staging seed").

**PR A verify:** `bin/check rspec`. Playwright: none new in this PR (no SPA change); state that in the PR body. Manual: in development, refund one mock payment with the legacy button and see `refunded_by` in the console and the email in Mailpit.

**PR A deploy note (PR body):**

- **Without the Task 6a guard this deploy charges cards it cannot record.** From the push until the migration has run, `Requirement#complete` passing `charge_id`/`amount_cents` raises `ActiveModel::UnknownAttributeError` inside `ChargeTeam#record`, after Stripe has charged the card: the racer sees an error, Rollbar says "Charged but not recorded", nothing is saved, and the racer's retry charges the card again. With the guard, payments are recorded (metadata only) throughout.
- Without the `refunded?` fallback, every team page that shows a payment (legacy partial, SPA fee card via `TeamChecklist`) raises from the push until the migration has run and the dynos have restarted.
- Even with both, until migrate and restart: the staff API and the legacy Refund button fail, and payments taken between the migration and the restart are saved without `charge_id`/`amount_cents` (old dynos keep the old column list).
- Order: `heroku pg:backups:capture --app dogtag` (the backfill rewrites a column on every completed requirement); push to `dogtag-staging`; `heroku run rails db:migrate -a dogtag-staging` immediately; `heroku restart -a dogtag-staging`; then rerun the idempotent backfill once to fill rows created in the window: `heroku run -a dogtag-staging 'bin/rails runner "require Rails.root.join(%q(db/migrate/20261124062730_add_payment_columns_to_completed_requirements)).to_s; AddPaymentColumnsToCompletedRequirements.new.backfill_payment_columns"'`. Production the same, at low traffic and well before a registration opening.
- `Workers::RefundBatch` runs on the `important` queue on the existing worker dyno. `REFUND_BATCH_LIMIT` is optional (default 5, at most 25); setting it to 10 is an owner config-var change. No Gemfile or `config/` changes.
- Before the first live refund: the owner checks the Stripe account's API version (charge `refunds` expansion) and runs one live refund on a low-price test payment (irreversible; owner confirms at the time).

---

## PR B: SPA staff shell (Tasks 7-8) — Sonnet, medium effort

### Task 7: `me.roles`, staff guard, layout and routes

**Files:**
- Create: `frontend/src/features/staff/utils.ts`, `frontend/src/features/staff/components/require-staff.tsx`, `frontend/src/features/staff/components/not-allowed.tsx`, `frontend/src/components/layouts/staff-layout.tsx`, `frontend/src/app/routes/staff-payments.tsx` (placeholder heading only; Task 11 fills it), `frontend/src/features/staff/components/require-staff.test.tsx`, `frontend/src/components/layouts/staff-layout.test.tsx`
- Modify: `app/views/api/v1/users/_user.json.jbuilder` (`json.roles user.roles.map(&:to_s)`), `spec/requests/api/v1/sessions_spec.rb` (or wherever `GET /me` is specced), `frontend/src/features/auth/api/use-me.ts` (`User.roles: string[]`), `frontend/src/test/fixtures.ts` (`user.roles: []`), `frontend/src/app/router.tsx`, `frontend/src/app/router.test.tsx`, `frontend/src/features/auth/components/user-menu.tsx` (+ its test), `frontend/src/locales/en.ts`, `app/views/application/_navbar.html.haml` (+ `config/locales/en.yml` key)

**Interfaces:**
- Produces: `STAFF_ROLES = ['admin', 'refunder', 'operator'] as const`, `isStaff(user: User | undefined): boolean` in `@/features/staff/utils`.
- Produces: `RequireStaff({ children })`: uses `useMe()`; non-staff renders `<NotAllowed />` (heading `staff.notAllowed.heading`, link home). Server remains the gate.
- Produces: `StaffLayout()`: calls `useUnauthorizedRedirect()`, logo header with `UserMenu`, staff nav (`<nav aria-label={t('staff.nav')}>`) with `Payments` (`/staff/payments`, `NavLink`) and `Legacy admin` (`<a href="/users">`, the search page every staff role can open), `max-w-6xl` container, page bg tokens as `RegisterLayout`.
- Produces routes (before `*`): `{ path: '/staff', element: <StaffLayout />, children: [{ element: <RequireAuth><RequireStaff><Outlet /></RequireStaff></RequireAuth>, children: [{ index: true, element: <Navigate to="payments" replace /> }, { path: 'payments', element: <StaffPaymentsRoute /> }] }] }`.
- `UserMenu` shows a `Staff` link (`/staff/payments`) when `isStaff(me)`. Legacy navbar admin dropdown gains `Payments` → `/register/staff/payments`.

- [ ] **Step 1: Failing tests.** RSpec: `"GET /me includes roles"` (`["refunder"]` for a refunder, `[]` for a racer). Vitest: `"racer sees not allowed at /staff/payments"`; `"refunder sees the staff nav and Payments heading"`; `"logged out is sent to login with the return path"`; `"/staff redirects to /staff/payments"`; `"UserMenu shows Staff only to staff"`.
- [ ] **Step 2: Run** `bundle exec rspec spec/requests/api/v1/sessions_spec.rb && npm --prefix frontend test -- --run src/features/staff src/components/layouts src/app/router.test.tsx src/features/auth` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the Step 2 command and `npm --prefix frontend run build` — Expected: PASS, build succeeds; at 320px the staff nav wraps without horizontal scroll.
- [ ] **Step 5: Commit** "Add the SPA staff shell: roles on me, staff guard, layout and routes".

### Task 8: Staff shell e2e

**Files:**
- Create: `tests/spa/staff-shell.spec.ts`
- Modify: `lib/tasks/test_seeds.rake` (`test_seeds:staff_shell`: a racer and a refunder, `staff-shell-racer-<id>@example.com` / `staff-shell-refunder-<id>@example.com`, written with `write_test_credentials`; existing cleanup covers them)

- [ ] **Step 1: Write the spec:** refunder logs in at `/register/login`, sees `Staff` in the header, lands on `/register/staff/payments` with heading `Payments`; racer opening the same URL sees `Not allowed` and no staff nav; at 320px `document.documentElement.scrollWidth <= 320`.
- [ ] **Step 2: Run** `npm --prefix frontend run build && DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid npx playwright test tests/spa/staff-shell.spec.ts` — Expected: PASS.
- [ ] **Step 3: Commit** "Add staff shell e2e spec and seed". Update README (staff entry point) and CLAUDE.md (staff shell entry; remove the staff-shell bullet from the `Planned: Payments admin page (#343)` section).

**PR B verify:** `bin/check` (all steps). **Deploy note:** none (no migration, no config). `me` now carries `roles`.

---

## PR C: payments page, Browse mode (Tasks 9-11) — Sonnet, medium effort

### Task 9: API hooks, types and URL filters

**Files:**
- Create: `frontend/src/features/staff-payments/types.ts`, `frontend/src/features/staff-payments/api/use-payments.ts`, `frontend/src/features/staff-payments/use-payment-filters.ts`, `frontend/src/features/staff-payments/use-payment-filters.test.tsx`, `frontend/src/features/staff-payments/api/use-payments.test.tsx`

**Interfaces:**
- Produces types mirroring Task 6 JSON: `PaymentStatus = 'paid' | 'refunding' | 'refunded' | 'not_refundable'`, `StaffPayment`, `PaymentsMeta`, `PaymentsFilters`, `PaymentsResponse`.
- Produces: `PaymentFilterValues = { raceId?: number; paymentType?: number; status: PaymentStatus | 'all'; q: string; page: number }`; `usePaymentFilters() -> { values, setFilter(key, value) }` backed by `useSearchParams` (`race_id`, `payment_type`, `status` default `all`, `q`, `page` default 1); changing any filter other than `page` resets `page` to 1; changing `race_id` drops `payment_type`; the race defaults to the server's choice (`filters.race_id`) when absent, and `all` means every race. Refund mode is local page state (not in the URL).
- Produces: `paymentsQueryKey(values) = ['staff', 'payments', values]`, `usePayments(values)` (GET `/staff/payments?…`, `placeholderData: keepPreviousData`).

- [ ] **Step 1: Failing tests:** `"reads defaults: status all, page 1"`, `"setting q resets page"`, `"changing race drops payment_type"`, `"usePayments sends the filters as query params"` (MSW handler asserts the URL).
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/staff-payments` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same — Expected: PASS.
- [ ] **Step 5: Commit** "Add staff payments query and URL filters".

### Task 10: Browse page: filters, table and cards, progress line, pagination

Mockups reviewed with the owner on 2026-11-24 (see spec "Payments page"). Read-only: no checkboxes and no Refund button in this PR.

**Files:**
- Create in `frontend/src/features/staff-payments/components/`: `payment-filters.tsx` (desktop row plus the 320 px `Filters` sheet), `filter-chips.tsx`, `progress-line.tsx`, `payments-table.tsx` (table from `sm`, cards below), `pagination.tsx`, `payments-page.tsx`; tests `payments-page.test.tsx`
- Modify: `frontend/src/app/routes/staff-payments.tsx` (renders `PaymentsPage`), `frontend/src/locales/en.ts` (`staff.payments.*`)

**Interfaces:**
- Produces: `PaymentsPage()` titled `Payments`: filters (Race select with open/closed and `All races`; Payment type select with `All types`, listing only the chosen race's payment requirements from the top-level `filters`; Status as `All | Paid | Refunded`, a segmented control in the mobile sheet; Search debounced 300 ms), removable chips with `Clear all`, `ProgressLine` (`{refunded_count} of {count} refunded · {refunded} of {total}` from `meta.summary`, `formatCents` from `@/features/teams/utils`), `PaymentsTable` (team, account holder email, type, amount, paid date, status badge with `Refunded {date}`; cards below `sm` with `grid-cols-[minmax(0,1fr)]` and `[overflow-wrap:anywhere]` on emails), `Pagination` (`‹ Prev`, `Page {page} of {total}`, `Next ›`). Below `sm`, only Search stays on top and the rest sit behind a `Filters` row opening a sheet with `Show {n} payments` and `Clear all`.
- Consumes: `usePayments`, `usePaymentFilters`.

- [ ] **Step 1: Failing tests:** `"shows the progress line from summary"` (`37 of 142 refunded · $1,850.00 of $7,100.00`); `"payment type options follow the chosen race"`; `"status filter and chips update the URL"`; `"search is debounced"`; `"refunded rows show their refund date"`; `"empty list shows the empty state"`; `"error shows QueryError with retry"`; `"at 320px the Filters row opens a sheet"`.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/staff-payments` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same — Expected: PASS.
- [ ] **Step 5: Commit** "Add the staff payments Browse page with filters, cards and progress".

### Task 11: Payments page e2e

**Files:**
- Create: `tests/spa/payments-admin.spec.ts`
- Modify: `lib/tasks/test_seeds.rake` (`test_seeds:payments_admin`)

**Interfaces:**
- Produces `test_seeds:payments_admin`: race `Race Payments <id8>` (open while seeding so racers can be added), a `MockPaymentRequirement` named `Cart Deposit` and one named `Registration`, a refunder `payments-refunder-<id>@example.com`, 7 teams `Test Team Payments <n> <id8>` each with an owner `payments-owner-<n>-<id>@example.com` and a completed `Cart Deposit` made through `Requirement#complete` (mock metadata, `charge_id: "mock_ch_…"`, `amount: 5000`, so the `charge_id`/`amount_cents` columns are filled), one team also paid `Registration`, one `Cart Deposit` already refunded (`refunded_at` set). The spec always picks the race in the Race filter, so it does not depend on the default-race rule (an open owner decision). Credentials: refunder email/password, race id, owner emails. Covered by existing cleanup (Task 2).

- [ ] **Step 1: Write the spec:** refunder opens Staff → Payments; picks the seeded race and `Cart Deposit`; progress reads `1 of 7 refunded`; status `Paid` lists 6 rows and `Refunded` lists 1; search by one owner email shows that team only; reload keeps filters (URL); at 320px rows are cards, the `Filters` sheet opens and `document.documentElement.scrollWidth <= 320`.
- [ ] **Step 2: Run** `npm --prefix frontend run build && DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid npx playwright test tests/spa/payments-admin.spec.ts` — Expected: PASS.
- [ ] **Step 3: Commit** "Add payments page e2e spec and seed". CLAUDE.md: payments page entry (and trim the search/filter bullet from the `Planned` section).

**PR C verify:** `bin/check`. **Deploy note:** none.

---

## PR D: Refund mode, confirmation, polling, retry, fee card (Tasks 11b, 12-15) — Sonnet, high effort

Task 11b belongs to PR D, not PR C: PR C stays read-only.

### Task 11b: Refund mode (selection and bottom bar)

**Files:**
- Create: `frontend/src/features/staff-payments/use-selection.ts`, `use-selection.test.ts`, `frontend/src/features/staff-payments/components/refund-bar.tsx`
- Modify: `payments-page.tsx`, `payments-table.tsx`, `en.ts`

**Interfaces:**
- Produces: `useSelection(limit: number) -> { selected: Map<number, StaffPayment>; toggle(row): void; selectNext(rows: StaffPayment[]): void; clear(): void; isFull: boolean }`. Only `status === 'paid'` rows can be selected; never more than `limit`; selection spans pages; `selectNext` adds the first unselected paid rows of the given page until full; cleared when the race filter changes.
- `PaymentsPage` gets a `Refund payments` button (local `mode: 'browse' | 'refund'` state, not in the URL). It is disabled while `All races` is chosen, with the note `staff.payments.pickOneRace` (`Pick one race to refund.`): Refund mode works on one race only. Entering sets status to `paid` (locked) and keeps the other filters, so only `paid` rows are listed (refunded, refunding and not-refundable rows are not shown, not greyed); shows a red top edge, the title `Payments · Refund mode`, `Cancel`, a banner `Refunding {race name} ({race date}). Tick up to {limit} paid payments. Refunds cannot be undone.` and `Select next {n}`. When the race date is more than a year before today the banner adds an amber `staff.payments.oldRace` (`This race was more than a year ago. Check that you picked the right race.`). The table shows checkboxes (about 44 px targets) on `paid` rows only (a guard: a row that turns `refunding` on a refetch leaves the list); at the cap the rest disable with `staff.payments.capReached` (`Batch limit is {limit}. Refund these first.`). `RefundBar` is pinned to the bottom: `{n} of {limit} selected · {total}` and `Review and refund {n}…` (full width on mobile). Cancel clears the selection and returns to Browse. The race date needs `race_datetime` on each entry of `filters.races`, which PR A does not return (it has `id`, `name`, `registration_status`): add it in `PaymentSearch#races` in this PR, with a request spec.

- [ ] **Step 1: Failing tests:** `"only paid rows have enabled checkboxes"`; `"stops at refund_batch_limit and disables the rest with the cap note"` (limit 5, 8 paid rows); `"Select next N ticks the first paid rows up to the cap"`; `"selection survives moving to page 2"`; `"changing race clears the selection"`; `"entering refund mode locks status to Paid and Cancel returns to Browse"`; `"Refund payments is disabled under All races"`; `"the banner names the race and warns when it is more than a year old"`; `"the bottom bar shows count and total"`.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/staff-payments` — Expected: FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** "Add Refund mode with capped selection and the bottom bar".

### Task 12: Batch hooks

**Files:**
- Create in `frontend/src/features/staff-payments/api/`: `use-create-refund-batch.ts`, `use-refund-batch.ts`, `use-retry-refund-batch.ts`, `refund-batches.test.tsx`; add `RefundBatch` (with `done`), `RefundBatchItem` (with `retryable`), `RefundItemStatus` to `types.ts`
- Modify: `frontend/src/lib/api-client.ts` (`ApiError.code`), `frontend/src/lib/api-client.test.ts`

**Interfaces:**
- `ApiError` gains `code?: string`, read from the response body's `code` in `toApiError` (constructor `new ApiError(status, error, errors, code)`; existing callers unchanged). `error` stays the human-readable sentence the server sent; code branches on `err.code`, never on `err.error`.
- `useCreateRefundBatch() -> mutation({ ids: number[]; confirmation: string; expectedTotalCents: number }) -> RefundBatch` (POST `/staff/refund_batches` with `completed_requirement_ids`, `confirmation`, `expected_total_cents`).
- `useRefundBatch(id: number | null)`: GET `/staff/refund_batches/:id`, `refetchInterval: q => q.state.data?.done ? false : 2000`, `enabled: id != null`. `done` (Task 6a) is true once `finished_at` is set or no item reports `queued`, so a batch whose job died stops polling once its items report `stalled`.
- `useRetryRefundBatch() -> mutation(batchId) -> RefundBatch`.
- On a done batch the page invalidates `['staff', 'payments']`.

- [ ] **Step 1: Failing tests** (fake timers): `"polls every 2 s until the batch is done, then stops"` (including a batch with `finished_at` null whose items are all `stalled`); `"create sends the exact body"`; `"a 422 surfaces err.code === 'selection_changed' and err.error is the server's sentence"`; in `api-client.test.ts`: `"ApiError carries the body's code, and undefined when there is none"`.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/staff-payments/api src/lib/api-client.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** — PASS. **Step 5: Commit** "Add refund batch hooks with polling".

### Task 13: Confirmation dialog

**Files:**
- Create: `frontend/src/features/staff-payments/components/confirm-refund-dialog.tsx`, `confirm-refund-dialog.test.tsx`
- Modify: `payments-page.tsx` (the bottom bar's `Review and refund {n}…` opens it), `en.ts`

**Interfaces:**
- `ConfirmRefundDialog({ snapshot: StaffPayment[]; current: Map<number, StaffPayment>; latestRows: StaffPayment[]; onConfirmed(batch: RefundBatch): void; onClose(): void })` on `DialogSheet` (`closeOnBackdrop={false}`): lists every snapshot row (team, owner email, type, amount), the total, the title `Refund {n} payments?`, a bold red warning `staff.refund.irreversible` ("This cannot be undone. The money goes back to each card."), `staff.refund.emailNote` ("Each team's account holder will be emailed. Refunds take about 5 to 10 business days to appear."), and an input labelled `Type REFUND {n} to confirm`. The title is singular for one (`Refund 1 payment?`). Confirm (a red button, faded while disabled) is enabled only when the normalized input equals `REFUND {n}` and the snapshot still matches: same ids as `current`, and every snapshot row that appears in `latestRows` still has `status === 'paid'` and the same `amount_cents`. Normalizing (one helper, `normalizeConfirmation`): trim, collapse runs of spaces to one, upper-case. The number must equal the count. **The POST always sends the canonical `REFUND {n}`, never the raw input**, because the server compares the exact string (Task 6a pins that with a request spec). A mismatch shows `staff.refund.changed` ("The selection changed. Close and review again.") and disables Confirm. Error responses show copy chosen by `err.code` (`batch_too_large`, `confirmation_mismatch`, `invalid_total`, `selection_changed`, `not_refundable` listing the failing ids' teams from `err.errors`; anything else shows `err.error`). Close/Escape do nothing while the POST is in flight.

- [ ] **Step 1: Failing tests:** `"lists every payment and the total"`; `"Confirm stays disabled for 'REFUND 4' and 'REFUND 50' and enables for ' refund 5 ' and 'Refund  5'"`; `"posts exactly 'REFUND 5' (not the typed text) with the ids and expected total"`; `"refuses when a refetch shows a selected row refunded"`; `"refuses when the selection changed"`; `"shows the server's selection_changed message"`; `"Escape does not close while submitting"`.
- [ ] **Step 2-4:** run `npm --prefix frontend test -- --run src/features/staff-payments/components/confirm-refund-dialog.test.tsx` (FAIL → implement → PASS).
- [ ] **Step 5: Commit** "Add the typed refund confirmation dialog".

### Task 14: Per-row results, retry, and the racer fee card

**Files:**
- Create: `frontend/src/features/staff-payments/components/batch-results.tsx`, `batch-results.test.tsx`
- Modify: `payments-page.tsx`, `frontend/src/types/api.ts` (`FeeItem.refunded: boolean`), `frontend/src/test/fixtures.ts`, `frontend/src/features/payments/components/fee-card.tsx`, `fee-card.test.tsx`, `en.ts` (`fee.refunded`)

**Interfaces:**
- `BatchResults({ batchId: number; onFinished(): void })`, shown inside the dialog after confirming (title `Refunding… {done} of {n} done`; the dialog cannot be closed until the batch is `done`; `Done` calls `onFinished`): one line per item: `Queued…`, `Refunded`, `Already refunded`, `Failed: {message}`, `Stalled`; while any item is queued it shows `Refunding {done} of {n}…`. When any item is `retryable` it shows one `Retry {k} failed` button, k = the retryable items (`useRetryRefundBatch`, then follows the new batch id). Failed items that are not retryable (`partially_refunded`, `not_refundable`, `amount_mismatch`) show their message and `staff.refund.checkStripe` ("Check this payment in Stripe."), and do not count toward k. The retry is per batch, not per row, because the API re-queues all of a batch's retryable items. `onFinished` clears the selection, leaves Refund mode and invalidates payments, so refunded rows leave the Paid view.
- Fee card: a fee item with `refunded` shows `Refunded` on its row; in the collapsed paid/finalized summary, each refunded item adds a line `{name}: refunded`. Finalization and `paid_cents` text unchanged.

- [ ] **Step 1: Failing tests:** `"shows each item's result as polling advances"` (MSW returns queued, then finished); `"Retry posts to /retry and follows the new batch"`; `"Retry counts only retryable items and a partially refunded item points to Stripe"`; `"a batch whose items all report stalled can be closed"`; `"finishing clears the selection and refetches the list"`; fee card `"shows Refunded on a refunded item"` and `"finalized summary notes the refund"`.
- [ ] **Step 2-4:** run `npm --prefix frontend test -- --run src/features/staff-payments src/features/payments` (FAIL → implement → PASS).
- [ ] **Step 5: Commit** "Show per-row refund results with retry, and Refunded on the racer fee card".

### Task 15: Bulk refund e2e

**Files:**
- Modify: `tests/spa/payments-admin.spec.ts`, `lib/tasks/test_seeds.rake` (`payments_admin` credentials add one owner password so the spec can log in as that racer; three extra teams for Step 1b, one with `charge_id: "mock_fail_once_<id8>"`), `app/views/requirements/_mock_payment_requirement.html.haml` (the refunded label), `app/services/payments/refund_charge.rb` (the `mock_fail_once_` hook), `spec/services/payments/refund_charge_spec.rb`, a `render_views` controller spec for the mock partial, `CLAUDE.md`, `README.md`

**Interfaces:**
- The mock-payment partial shows the same `%span.label.label-primary` `t("refunded")` label as `_payment_requirement.html.haml` when `cr.refunded?`, instead of the amount and `completed`. Without it the Step 1 assertion "the legacy team page as the refunder shows the `refunded` label" cannot pass, because every seeded payment is a mock payment. RSpec (`render_views`): `"a refunded mock payment shows the refunded label"`.
- `mock_fail_once_` hook, in `RefundCharge`'s mock branch, guarded by `Rails.env.development? || Rails.env.test?` (so never in production, including staging, which runs `RAILS_ENV=production`): when the mock payment's `charge_id` starts with `mock_fail_once_` and its metadata lacks `"mock_fail_once_tripped"`, write `metadata["mock_fail_once_tripped"] = true` on that completed requirement with `update_columns` (state lives on the row, so it survives across processes and the Playwright server) and return `failure(:stripe_error, "Mock failure on the first attempt (test hook).")`; the next attempt records the refund as usual. Specs: `"mock_fail_once_ fails the first attempt and refunds on the second"`, `"mock_fail_once_ never fires in production"` (`allow(Rails.env).to receive(:production?).and_return(true)` and the env predicates false: the payment is `not_refundable`, nothing is written). List the hook in the PR body.

- [ ] **Step 1: Extend the spec** (Playwright runs with `SIDEKIQ_INLINE=true`, so the batch finishes inside the POST; the page still polls once and shows results): `Refund payments` → `Select next 5` → `Review and refund 5…` → dialog lists 5 teams and `$250.00`; typing `REFUND 4` keeps Confirm disabled; `REFUND 5` → results show 5 `Refunded`; progress line reads `6 of 7 refunded`; Paid view shows 1 row; at 320px the bottom bar and dialog buttons stay inside the viewport; `waitForEmail` finds one refund email for a refunded owner and `countEmails` stays 1 for that owner after reloading; log in as that owner, the team page fee card shows `Refunded`; the legacy team page as the refunder shows the `refunded` label.
- [ ] **Step 1a: Single-refund e2e (owner requirement, 2026-11-24).** A separate Playwright test refunds exactly one payment (select 1, `Review and refund 1…`, dialog title `Refund 1 payment?` with correct singular wording, type `REFUND 1`, result `Refunded`, one email, fee card shows `Refunded`), so batch of 1 is covered as well as batch of N.
- [ ] **Step 1b: Partial-failure e2e (owner requirement, 2026-11-24).** A second Playwright test in `tests/spa/payments-admin.spec.ts` seeds a batch of 3 where one payment fails on its first attempt and succeeds on retry (the `mock_fail_once_` hook above). Steps from the staff user's view: select 3, confirm; results show 2 `Refunded` and 1 `Failed: <message>` with a `Retry 1 failed` button; the progress line counts only the 2; the Paid view still lists the failed payment; click Retry; the results show all 3 `Refunded`; Done; the list and progress line update; exactly one refund email per team after the retry (`countEmails` is 1 for each, including the retried one); at 320px the failed row and Retry button stay inside the viewport. Also add an RSpec request spec (`Sidekiq::Testing.inline!`, StripeMock failing the first refund call) if one does not already cover create, partial failure, retry, completion with each payment refunded exactly once.
- [ ] **Step 2: Run** `npm --prefix frontend run build && DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid npx playwright test tests/spa/payments-admin.spec.ts tests/spa/staff-shell.spec.ts` and `npm test` (whole suite, legacy flow included) — Expected: PASS.
- [ ] **Step 3: Commit** "Cover bulk refund end to end". README/CLAUDE.md: refund flow, `REFUND_BATCH_LIMIT`, "retry is per batch", the `mock_fail_once_` hook; and **delete the `## Planned: Payments admin page (#343)` section** from CLAUDE.md, now that everything in it has shipped (its "not building" items move into the shipped entry). Each earlier PR trims the bullets it ships (Task 6/6a, Task 8, Task 11), so the section never describes shipped work as planned.

**PR D verify:** `bin/check`. **Deploy note:** none beyond PR A's. Before the first real use on production, the owner checks the Stripe account's API version and runs one live refund on a low-price test payment (irreversible: owner confirms at the time).

---

## Self-review notes

- Spec coverage: data (T1-2), status (T2, T6a), service (T3, T6a), worker (T4, T6a), legacy + Ability (T5), API + cap + fee item (T6, T6a), deploy guard and staging seed (T6a), shell (T7-8), page (T9-11 Browse), Refund mode (T11b, in PR D), dialog/polling/retry/fee card/e2e (T12-15), email (T3, T6a), deploy (PR notes).
- Builder's calls fixed here: page size 25, poll 2 s, job `retry: 3`, `payment_type` = requirement id, retry action named `retry_failed`, two migrations (columns, batch tables), retry is per batch, `REFUND_BATCH_LIMIT` at most 25, stale queued items stop counting after `STALL_AFTER`, Refund mode needs one race.

## Review decisions

Raised by the PR #344 review and left to the owner; nothing in this plan depends on the answer except where noted.

1. **Stripe idempotency key shape.** Shipped: `refund-cr-<completed_requirement id>`. Completed requirement ids repeat across the development, test, e2e and staging databases, which share one Stripe test account, so within Stripe's 24-hour key window a second database's payment with the same id gets an idempotency error and fails with `stripe_error` (production has its own live-mode keys and is not affected). Alternative: `refund-<charge_id>`, unique across databases and safe because a charge is refunded at most once. Either way retry healing comes from the lock and the retrieve check, not the key. Changing it touches `RefundCharge` and the opts assertion in its spec.
2. **Refunder attribution for refunds the app made itself.** Shipped: a refund found already done at Stripe is recorded with `refunded_by` nil and Stripe's time, because the app cannot tell a dashboard refund from its own attempt that died before saving. If the owner wants those attributed, `Refund.create` can carry `metadata: { completed_requirement_id, refunded_by_id }`, and the "already refunded at Stripe" branch can attribute a covering refund that carries this payment's id to that user (dashboard refunds stay nil).
3. **Default race on the payments page.** Shipped: the newest open race, else the newest race. Proposed: the most recent race whose `race_datetime` has passed, else the newest race, since refunds happen after a race, when its registration is already closed. The e2e specs pick the race explicitly, so either answer only changes `Payments::PaymentSearch#default_race` and its request spec.
