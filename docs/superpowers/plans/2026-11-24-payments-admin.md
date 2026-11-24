# Payments Admin and Bulk Refund Implementation Plan (#343)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One staff page in the SPA that lists every completed payment, filters it to what is left to refund, and refunds a server-capped batch at a time in a background job, with an audit trail and one email per refunded payment.

**Architecture:** Payment facts move out of the JSON `metadata` text into real columns on `completed_requirements` (backfilled). One service (`Payments::RefundCharge`) refunds one payment under the same advisory lock as `ChargeTeam` and is called by both the legacy Refund button and a Sidekiq job (`Workers::RefundBatch`) that works through a `refund_batches`/`refund_batch_items` record. A `/api/v1/staff` API lists payments and queues, reads and retries batches; the SPA gains a staff shell and a payments page that polls a batch for per-row results.

**Tech Stack:** Rails 8, PostgreSQL 17, Sidekiq, stripe 1.58 + stripe-ruby-mock 2.4.1, RSpec + FactoryBot, React 19 + TypeScript, TanStack Query 5, react-router 7, Vitest + MSW, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-23-payments-admin-design.md` (read it with this plan; it holds the reasons).

## Delivery: four stacked PRs

| PR | Branch (from) | Tasks | Implementer |
|----|---------------|-------|-------------|
| A  | `feature/343a-refund-backend` (from `main`) | 1-6 | Sonnet, **high** (money) |
| B  | `feature/343b-staff-shell` (from A) | 7-8 | Sonnet, medium |
| C  | `feature/343c-payments-page` (from B) | 9-11 | Sonnet, medium |
| D  | `feature/343d-bulk-refund-ui` (from C) | 12-15 | Sonnet, **high** (irreversible money action) |

PRs are stacked linearly and opened against `chiditarod/dogtag` (`gh pr create --repo chiditarod/dogtag --base <previous branch>`, A uses `--base main`). We never merge; the owner merges in order A, B, C, D. Each PR body states whether its Playwright spec was actually run, lists any "ask before" file it touched (none are expected), and carries its deploy note below. PR bodies end with the `Generated with Claude Code` line; commits end with the `Co-Authored-By` line.

## Global Constraints

- Work in a worktree per PR (`../dogtag-wt/343a-…` etc.). Use a separate test DB (`DATABASE_URL=postgres://postgres@localhost/dogtag_test_2`, `RAILS_ENV=test bin/rails db:create db:schema:load` once). Playwright: `DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid`, after `npm --prefix frontend run build`.
- **Ask before** touching Gemfile/Gemfile.lock, `config/initializers`, `config/environments`, `config/application.rb`, `spec/spec_helper.rb`. None is needed by this plan. If one seems needed, stop and ask the owner; if approved, call it out in the PR body. Routes, locales, `lib/tasks/test_seeds.rake`, new `spec/support` helpers are fine.
- Migrations via `bin/rails g migration`; `text` for strings, `datetime` for times. Migration specs call the public data method (`backfill_payment_columns`), never `up`/`down`.
- Stripe 1.58 calls only: `Stripe::Charge.retrieve(id)`, `Stripe::Refund.create({ charge: id }, { idempotency_key: "refund-cr-#{cr.id}" })` (the key goes in **opts**, which become the `Idempotency-Key` header; never in params). stripe-ruby-mock 2.4.1 dedupes refunds only on a *param* `idempotency_key`, so specs assert the opts with `expect(Stripe::Refund).to receive(:create).with(hash_including(charge: …), hash_including(idempotency_key: "refund-cr-#{cr.id}")).and_call_original` rather than relying on mock dedupe. The mock marks a charge `refunded: true` after any refund, so partial-refund specs `allow(Stripe::Charge).to receive(:retrieve).and_return(Stripe::Charge.construct_from(id:, refunded: false, amount: 5000, amount_refunded: 1000, refunds: { data: [] }))`.
- Full refunds only. A refunded payment still completes its requirement: no change to finalization or `paid_cents`.
- `REFUND_BATCH_LIMIT` is read in exactly one place: `RefundBatch.max_size` (positive integer from ENV, else 5).
- Status names (verbatim): payment `paid`, `refunding`, `refunded`, `not_refundable`; item `queued`, `refunded`, `already_refunded`, `failed`, `stalled`; service codes `refunded`, `already_refunded`, `partially_refunded`, `not_refundable`, `in_progress`, `stripe_error`, `unexpected`; API 422 codes `batch_too_large`, `confirmation_mismatch`, `selection_changed`, `not_refundable`.
- Confirmation text is exactly `REFUND <count>` (e.g. `REFUND 5`).
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
5. **`REFUND_BATCH_LIMIT` set to junk (`"0"`, `"-3"`, `"ten"`, blank).** Falls back to 5; the API reports the value in use and the SPA caps selection at it. Pinned in Task 2 and Task 10.

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

### Task 2: Refund batch tables, models and the batch cap

**Files:**
- Create: `db/migrate/<ts>_create_refund_batches.rb` (`bin/rails g migration CreateRefundBatches`), `app/models/refund_batch.rb`, `app/models/refund_batch_item.rb`, `spec/models/refund_batch_spec.rb`, `spec/models/refund_batch_item_spec.rb`, `spec/factories/refund_batch.rb`
- Modify: `app/models/completed_requirement.rb`, `db/schema.rb`, `lib/tasks/test_seeds.rake` (cleanup), `spec/models/completed_requirement_spec.rb`

**Interfaces:**
- Produces: `refund_batches(user_id bigint not null FK users, retry_of_id bigint FK refund_batches on_delete: :nullify, finished_at datetime, timestamps)`; `refund_batch_items(refund_batch_id FK on_delete: :cascade, completed_requirement_id FK on_delete: :cascade, status text not null default "queued", error_code text, message text, finished_at datetime, timestamps)`, index on `refund_batch_id`, **unique partial index on `completed_requirement_id` where `status = 'queued'`**.
- Produces: `RefundBatch` (`belongs_to :user`, `belongs_to :retry_of, optional`, `has_many :items, class_name: "RefundBatchItem"`), `RefundBatch.max_size -> Integer`, `RefundBatch::STALL_AFTER = 10.minutes`, `RefundBatch#mark_stalled!` (queued items of a batch created more than `STALL_AFTER` ago → `stalled`, `finished_at = now`), `RefundBatch#finished?`.
- Produces: `RefundBatchItem::STATUSES = %w[queued refunded already_refunded failed stalled]`, scope `queued`.
- Produces: `CompletedRequirement.payment_status_sql -> String` (SQL `CASE` over `completed_requirements`/`requirements`: `refunded_at IS NOT NULL` → `refunded`; `EXISTS` queued item → `refunding`; `charge_id IS NULL` or (`requirements.type = 'MockPaymentRequirement'` and `Rails.env.production?`) → `not_refundable`; else `paid`), scope `with_payment_status(status)` (requires `joins(:requirement)`), and `#payment_status -> String` (evaluates the same SQL for one row). This is the one definition; nothing else re-derives status.
- Produces: `CompletedRequirement#refundable? -> Boolean` (`payment_status == "paid"`).

- [ ] **Step 1: Failing specs.**
  - `refund_batch_spec.rb`: `".max_size is 5 when REFUND_BATCH_LIMIT is unset"`, `"is 10 when it is \"10\""`, `"is 5 for \"0\", \"-3\", \"ten\" and \"\""` (use `ClimateControl` if present, else `stub_const("ENV", ENV.to_h.merge(...))`); `"#mark_stalled! marks queued items stalled only after 10 minutes"` (Timecop: at 9 min still `queued`, at 11 min `stalled` with `finished_at`; a `refunded` item is untouched).
  - `refund_batch_item_spec.rb`: `"cannot queue the same completed requirement twice"` (second `create!` with `status: "queued"` raises `ActiveRecord::RecordNotUnique`); `"allows a new queued item once the old one is stalled"`.
  - `completed_requirement_spec.rb`: `"#payment_status"` examples for each status, including `"mock payment is not_refundable in production and paid elsewhere"` (`allow(Rails.env).to receive(:production?).and_return(true)`), and `"with_payment_status(\"paid\") matches #payment_status for every row"`.
- [ ] **Step 2: Run** `bundle exec rspec spec/models/refund_batch_spec.rb spec/models/refund_batch_item_spec.rb spec/models/completed_requirement_spec.rb` — Expected: FAIL.
- [ ] **Step 3: Implement.** Migration, models, status SQL. In `test_seeds:cleanup` add, before the users are destroyed: `RefundBatch.where(user_id: User.where("email LIKE ?", "%@example.com").select(:id)).delete_all` and `CompletedRequirement.where(requirement_id: Requirement.where(race_id: Race.where("name LIKE ?", "Race %").select(:id)).select(:id)).delete_all` (items go by FK cascade; today's cleanup leaves orphan completed requirements behind).
- [ ] **Step 4: Run** the Step 2 command — Expected: PASS.
- [ ] **Step 5: Commit** "Add refund batches and one payment status definition".

### Task 3: `Payments::RefundCharge`, shared lock, refund email

**Files:**
- Create: `app/services/payments/advisory_lock.rb`, `app/services/payments/refund_charge.rb`, `app/workers/workers/payment_refunded_email.rb`, `app/views/user_mailer/payment_refunded_email.html.haml` (and `.text.haml` if siblings have one), `spec/services/payments/refund_charge_spec.rb`, `spec/workers/payment_refunded_email_spec.rb`
- Modify: `app/services/payments/charge_team.rb` (use the shared lock), `app/mailers/user_mailer.rb`, `config/locales/en.yml`, `spec/mailers/user_mailer_spec.rb`, `spec/migrations/add_payment_columns_to_completed_requirements_spec.rb` (the "sends no email" example)

**Interfaces:**
- Produces: `Payments::AdvisoryLock.with_lock(team_id:, requirement_id:) { … } -> block value, or Payments::AdvisoryLock::HELD` and `Payments::AdvisoryLock.alert(message)` (log + Rollbar). Moved verbatim from `ChargeTeam#with_advisory_lock`/`#release_advisory_lock`/`#alert`; same key `(team_id, requirement_id)`, so a refund and a charge for the same payment exclude each other. `ChargeTeam` maps `HELD` to `failure(:in_progress)`; its specs must pass unchanged.
- Produces: `Payments::RefundCharge.call(user:, completed_requirement:) -> Result` with `Result = Data.define(:ok, :code, :message)`; `ok` is true for `refunded` and `already_refunded`.
- Produces: `Workers::PaymentRefundedEmail.perform_async({ "user_id", "team_id", "completed_requirement_id", "requirement_name", "amount_cents", "race_name" })` (plain values, so it still sends after an admin deletes the row); `UserMailer#payment_refunded_email(user, team, details)` with `track(kind: "refund", team:, user:, dedupe_key: "refund-cr-#{details[:completed_requirement_id]}")`.

Service order (spec "RefundCharge" 1-6): `not_refundable` unless `payment_status` is `paid` or `refunding` (an item being processed is `refunding`) → lock (`in_progress` when `HELD`) → `reload`; `already_refunded` if `refunded?` → mock outside production: record with `stripe_refund_id: nil`, no Stripe → `Stripe::Charge.retrieve`; `charge.refunded` → record with `charge.refunds.data.last&.id`, return `already_refunded`; `amount_refunded > 0` → `partially_refunded` with message naming the amount already refunded → `Stripe::Refund.create` (Global Constraints) → record. **Record** = one `update!` of `refunded_at: Time.current`, `refunded_by: user`, `stripe_refund_id`, `metadata: metadata.merge("refunded" => true)` (written as `JSON.generate`, matching `Requirement#complete`), then enqueue the email. Rescue like `ChargeTeam`: `Stripe::InvalidRequestError` → `stripe_error` with Stripe's reason; other `Stripe::StripeError` → `stripe_error` and, if `Refund.create` was attempted, `alert` "Refund outcome unknown … charge X team Y requirement Z; retry heals it"; a save failure after a successful Stripe refund → `alert` with refund id, charge, team, requirement, then `unexpected`; anything else → `unexpected`.

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
- `retry`: `batch.mark_stalled!`, then the batch's `failed` + `stalled` items' completed requirements that are still `paid` become a new batch with `retry_of: batch` (no confirmation; still capped, same `not_refundable` handling; nothing to retry → `nothing_to_retry`).
- Produces: `Workers::RefundBatch` (`include Sidekiq::Worker`, `include Workers::Common`, `sidekiq_options queue: :important, retry: 3, backtrace: true`), `run(job, log)`: for each `queued` item of the batch ordered by id, call `Payments::RefundCharge` with `batch.user` and update the item (`status` = `refunded`/`already_refunded` from the code, otherwise `failed` with `error_code`, `message`; `finished_at`); then `batch.update!(finished_at:)`. An item already marked `stalled` is skipped.

- [ ] **Step 1: Failing specs.**
  - Queue service: one example per code above with exact `errors` keys; `"queues nothing when any id is bad"` (`RefundBatch.count` and `RefundBatchItem.count` unchanged); `"rejects 6 ids when the limit is 5"`; `"accepts 10 ids when REFUND_BATCH_LIMIT is 10"`; `"a second batch for a queued payment is not_refundable and queues nothing"`; `"retry re-queues failed and stalled items as a new batch with retry_of"`; `"retry skips an item that has since been refunded"`.
  - Worker (`Sidekiq::Testing.inline!`, StripeMock): `"refunds every queued item and finishes the batch"`; `"resumes after a mid-batch failure without refunding or emailing twice"` (first run: second item's `RefundCharge` raises once via `allow(...).and_call_original` + one-time raise; rerun the worker: `Stripe::Refund.create` called exactly 3 times for 3 items, 3 email jobs); `"records failed with error_code and message"` (`ch_seed_1` → `failed`, `stripe_error`); `"rerunning a finished batch does nothing"`.
- [ ] **Step 2: Run** `bundle exec rspec spec/services/payments/queue_refund_batch_spec.rb spec/workers/refund_batch_spec.rb` — Expected: FAIL.
- [ ] **Step 3: Implement** both.
- [ ] **Step 4: Run** the Step 2 command — Expected: PASS.
- [ ] **Step 5: Commit** "Queue capped refund batches and work through them in Sidekiq".

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

### Task 6: `/api/v1/staff` API and fee item `refunded`

**Files:**
- Create: `app/controllers/api/v1/staff/base_controller.rb`, `app/controllers/api/v1/staff/payments_controller.rb`, `app/controllers/api/v1/staff/refund_batches_controller.rb`, `app/services/payments/payment_search.rb`, `app/views/api/v1/staff/payments/index.json.jbuilder`, `app/views/api/v1/staff/refund_batches/show.json.jbuilder`, `spec/requests/api/v1/staff/payments_spec.rb`, `spec/requests/api/v1/staff/refund_batches_spec.rb`, `spec/services/payments/payment_search_spec.rb`
- Modify: `config/routes.rb` (inside `namespace :v1`, above the catch-all), `app/services/team_checklist.rb` (`fee_line` adds `refunded`), `spec/services/team_checklist_spec.rb`, `spec/requests/api/v1/query_count_spec.rb`, `README.md` (env var), `CLAUDE.md` (key learnings)

**Interfaces:**
- Routes: `namespace :staff do resources :payments, only: :index; resources :refund_batches, only: [:create, :show] do post :retry, on: :member, action: :retry_failed end end` (`retry` is a Ruby keyword, so the action is `retry_failed`; the path stays `/retry`).
- `Api::V1::Staff::BaseController < Api::V1::BaseController`: `before_action :require_api_user!` then `authorize! :refund, :charges`.
- `Payments::PaymentSearch.new(race_id:, payment_type:, status:, q:, page:)` with `#payments` (relation, 25 per page, order `completed_requirements.created_at DESC, completed_requirements.id DESC`, `includes(:user, :refunded_by, requirement: :race, team: :user)`, selects `payment_status_sql AS payment_status`), `#meta`, `#filters`. `race_id` absent → the newest open race (by `race_datetime`; the newest race if none is open), `race_id=all` → every race; `payment_type` is a requirement id within that race; `status` one of the four or `all` (absent = `all`); `q` ILIKE on team name, payer email, owner email, or `EXISTS` a racer (`people.email`) on the team, with `sanitize_sql_like`; inner joins drop orphan rows.
- `GET /api/v1/staff/payments` → `{ payments: [{ id, race: { id, name }, team: { id, name }, owner: { name, email }, paid_by: { name, email }, payment_type, amount_cents, paid_at, status, refunded_at, refunded_by: { name } | null }], meta: { page, per_page, total_count, total_pages, refund_batch_limit, summary: { count, refunded_count, total_cents, refunded_cents } }, filters: { race_id, races: [{ id, name, registration_status }], payment_types: [{ id, name }] } }`. Summary uses the same filters except `status`.
- `POST /api/v1/staff/refund_batches` (`params.expect(completed_requirement_ids: [])`, `confirmation`, `expected_total_cents`) → 201 `{ batch }` or 422/400 `render_errors(..., code:)` with `errors` from the service. `POST /:id/retry` → 201 `{ batch }` or 422. `GET /:id` calls `batch.mark_stalled!` then → 200 `{ batch: { id, created_at, finished_at, retry_of_id, items: [{ id, completed_requirement_id, team_name, payment_type, amount_cents, status, error_code, message, finished_at }] } }`.
- `TeamChecklist` fee line: `refunded: Boolean` (from the already loaded completed requirement; no extra query).

- [ ] **Step 1: Failing request specs.** Authorization: `"a racer gets 403"` (and 401 logged out); `"refunder, operator and admin get 200"`. Payments: `"defaults to the newest open race, and race_id=all lists every race"`, `"filters by payment_type and status"`, `"q matches team name, payer, owner and racer email, case-insensitively"`, `"q treats % and _ literally"`, `"pages 25 per page in created_at desc, id desc order"`, `"summary ignores the status filter"`, `"reports refund_batch_limit"`. Batches: one example per 422 code asserting `json["code"]` and that `RefundBatch.count` is unchanged; `"201 queues the batch and enqueues the job"` (`Workers::RefundBatch.jobs.size == 1`); `"retry returns a new batch with retry_of_id"`; `"show reports items stalled after 10 minutes"` (Timecop). Query count: `"GET /staff/payments does not add queries per row"` (measure with 1 payment, then 5, expect equal). `team_checklist_spec`: `"fee item is refunded after a refund"`.
- [ ] **Step 2: Run** `bundle exec rspec spec/requests/api/v1/staff spec/services/payments/payment_search_spec.rb spec/requests/api/v1/query_count_spec.rb spec/services/team_checklist_spec.rb` — Expected: FAIL.
- [ ] **Step 3: Implement.** Check the list query with `EXPLAIN ANALYZE` on a restored copy; add an index only if it helps (spec leaves this to the builder; note the result in the PR).
- [ ] **Step 4: Run** `bin/check rspec` — Expected: all green.
- [ ] **Step 5: Docs and commit.** README: `REFUND_BATCH_LIMIT` (optional, default 5) and the staff payments API. CLAUDE.md: a short "Refunds (#343)" entry (columns, single status SQL, service, worker, cap, legacy button, deploy order). Commit "Add the staff payments and refund batch API".

**PR A verify:** `bin/check rspec`. Playwright: none new in this PR (no SPA change); state that in the PR body. Manual: in development, refund one mock payment with the legacy button and see `refunded_by` in the console and the email in Mailpit.

**PR A deploy note (PR body):** The migration adds columns that `Requirement#complete` writes on every payment, so from the push until it has run, every payment fails. Push to `dogtag-staging`, run `heroku run rails db:migrate -a dogtag-staging` immediately, then `heroku restart -a dogtag-staging`; production the same at low traffic, well before a registration opening. Capture a backup first (`heroku pg:backups:capture --app dogtag`); the migration adds only, but the backfill rewrites columns on every completed requirement. The new `Workers::RefundBatch` runs on the `important` queue on the existing worker dyno. `REFUND_BATCH_LIMIT` is optional (default 5); setting it to 10 is an owner config-var change. No Gemfile or `config/` changes.

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
- [ ] **Step 3: Commit** "Add staff shell e2e spec and seed". Update README (staff entry point) and CLAUDE.md (staff shell entry).

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
- Produces `test_seeds:payments_admin`: race `Race Payments <id8>` (open, newest `race_datetime` so it is the default), a `MockPaymentRequirement` named `Cart Deposit` and one named `Registration`, a refunder `payments-refunder-<id>@example.com`, 7 teams `Test Team Payments <n> <id8>` each with an owner `payments-owner-<n>-<id>@example.com` and a completed `Cart Deposit` (mock metadata, `charge_id: "mock_ch_…"`, `amount: 5000`), one team also paid `Registration`, one `Cart Deposit` already refunded (`refunded_at` set). Credentials: refunder email/password, race id, owner emails. Covered by existing cleanup (Task 2).

- [ ] **Step 1: Write the spec:** refunder opens Staff → Payments; picks the seeded race and `Cart Deposit`; progress reads `1 of 7 refunded`; status `Paid` lists 6 rows and `Refunded` lists 1; search by one owner email shows that team only; reload keeps filters (URL); at 320px rows are cards, the `Filters` sheet opens and `document.documentElement.scrollWidth <= 320`.
- [ ] **Step 2: Run** `npm --prefix frontend run build && DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid npx playwright test tests/spa/payments-admin.spec.ts` — Expected: PASS.
- [ ] **Step 3: Commit** "Add payments page e2e spec and seed". CLAUDE.md: payments page entry.

**PR C verify:** `bin/check`. **Deploy note:** none.

---

## PR D: Refund mode, confirmation, polling, retry, fee card (Tasks 12-15) — Sonnet, high effort

### Task 11b: Refund mode (selection and bottom bar)

**Files:**
- Create: `frontend/src/features/staff-payments/use-selection.ts`, `use-selection.test.ts`, `frontend/src/features/staff-payments/components/refund-bar.tsx`
- Modify: `payments-page.tsx`, `payments-table.tsx`, `en.ts`

**Interfaces:**
- Produces: `useSelection(limit: number) -> { selected: Map<number, StaffPayment>; toggle(row): void; selectNext(rows: StaffPayment[]): void; clear(): void; isFull: boolean }`. Only `status === 'paid'` rows can be selected; never more than `limit`; selection spans pages; `selectNext` adds the first unselected paid rows of the given page until full; cleared when the race filter changes.
- `PaymentsPage` gets a `Refund payments` button (local `mode: 'browse' | 'refund'` state, not in the URL). Entering sets status to `paid` (locked) and keeps the other filters; shows a red top edge, the title `Payments · Refund mode`, `Cancel`, a banner `Tick up to {limit} paid payments. Refunds cannot be undone.` and `Select next {n}`. The table shows checkboxes (about 44 px targets) on paid rows; refunded rows are greyed with no checkbox; at the cap the rest disable with `staff.payments.capReached` (`Batch limit is {limit}. Refund these first.`). `RefundBar` is pinned to the bottom: `{n} of {limit} selected · {total}` and `Review and refund {n}…` (full width on mobile). Cancel clears the selection and returns to Browse.

- [ ] **Step 1: Failing tests:** `"only paid rows have enabled checkboxes"`; `"stops at refund_batch_limit and disables the rest with the cap note"` (limit 5, 8 paid rows); `"Select next N ticks the first paid rows up to the cap"`; `"selection survives moving to page 2"`; `"changing race clears the selection"`; `"entering refund mode locks status to Paid and Cancel returns to Browse"`; `"the bottom bar shows count and total"`.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/staff-payments` — Expected: FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** "Add Refund mode with capped selection and the bottom bar".

### Task 12: Batch hooks

**Files:**
- Create in `frontend/src/features/staff-payments/api/`: `use-create-refund-batch.ts`, `use-refund-batch.ts`, `use-retry-refund-batch.ts`, `refund-batches.test.tsx`; add `RefundBatch`, `RefundBatchItem`, `RefundItemStatus` to `types.ts`

**Interfaces:**
- `useCreateRefundBatch() -> mutation({ ids: number[]; confirmation: string; expectedTotalCents: number }) -> RefundBatch` (POST `/staff/refund_batches` with `completed_requirement_ids`, `confirmation`, `expected_total_cents`).
- `useRefundBatch(id: number | null)`: GET `/staff/refund_batches/:id`, `refetchInterval: q => q.state.data?.finished_at ? false : 2000`, `enabled: id != null`.
- `useRetryRefundBatch() -> mutation(batchId) -> RefundBatch`.
- On a finished batch the page invalidates `['staff', 'payments']`.

- [ ] **Step 1: Failing tests** (fake timers): `"polls every 2 s until finished_at is set, then stops"`; `"create sends the exact body"`; `"a 422 surfaces ApiError.error = selection_changed"`.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/staff-payments/api` — Expected: FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** — PASS. **Step 5: Commit** "Add refund batch hooks with polling".

### Task 13: Confirmation dialog

**Files:**
- Create: `frontend/src/features/staff-payments/components/confirm-refund-dialog.tsx`, `confirm-refund-dialog.test.tsx`
- Modify: `payments-page.tsx` (the bottom bar's `Review and refund {n}…` opens it), `en.ts`

**Interfaces:**
- `ConfirmRefundDialog({ snapshot: StaffPayment[]; current: Map<number, StaffPayment>; latestRows: StaffPayment[]; onConfirmed(batch: RefundBatch): void; onClose(): void })` on `DialogSheet` (`closeOnBackdrop={false}`): lists every snapshot row (team, owner email, type, amount), the total, the title `Refund {n} payments?`, a bold red warning `staff.refund.irreversible` ("This cannot be undone. The money goes back to each card."), `staff.refund.emailNote` ("Each team's account holder will be emailed. Refunds take about 5 to 10 business days to appear."), the total,, and an input labelled `Type REFUND {n} to confirm`. Confirm (a red button, faded while disabled) is enabled only when the input equals `REFUND {n}` (case and surrounding spaces ignored; the number must equal the count) and the snapshot still matches: same ids as `current`, and every snapshot row that appears in `latestRows` still has `status === 'paid'` and the same `amount_cents`. A mismatch shows `staff.refund.changed` ("The selection changed. Close and review again.") and disables Confirm. 422 responses show copy per code (`batch_too_large`, `confirmation_mismatch`, `selection_changed`, `not_refundable` listing the failing ids' teams). Close/Escape do nothing while the POST is in flight.

- [ ] **Step 1: Failing tests:** `"lists every payment and the total"`; `"Confirm stays disabled for 'REFUND 4' and 'REFUND 50' and enables for ' refund 5 '"`; `"enables for exactly REFUND 5 and posts ids, confirmation and expected total"`; `"refuses when a refetch shows a selected row refunded"`; `"refuses when the selection changed"`; `"shows the server's selection_changed message"`; `"Escape does not close while submitting"`.
- [ ] **Step 2-4:** run `npm --prefix frontend test -- --run src/features/staff-payments/components/confirm-refund-dialog.test.tsx` (FAIL → implement → PASS).
- [ ] **Step 5: Commit** "Add the typed refund confirmation dialog".

### Task 14: Per-row results, retry, and the racer fee card

**Files:**
- Create: `frontend/src/features/staff-payments/components/batch-results.tsx`, `batch-results.test.tsx`
- Modify: `payments-page.tsx`, `frontend/src/types/api.ts` (`FeeItem.refunded: boolean`), `frontend/src/test/fixtures.ts`, `frontend/src/features/payments/components/fee-card.tsx`, `fee-card.test.tsx`, `en.ts` (`fee.refunded`)

**Interfaces:**
- `BatchResults({ batchId: number; onFinished(): void })`, shown inside the dialog after confirming (title `Refunding… {done} of {n} done`; the dialog cannot be closed while the job runs; `Done` calls `onFinished`): one line per item: `Queued…`, `Refunded`, `Already refunded`, `Failed: {message}`, `Stalled`; while any item is queued it shows `Refunding {done} of {n}…`. When the batch has `failed` or `stalled` items it shows one `Retry {k} failed` button (`useRetryRefundBatch`, then follows the new batch id). The retry is per batch, not per row, because the API re-queues all of a batch's failed and stalled items. `onFinished` clears the selection, leaves Refund mode and invalidates payments, so refunded rows leave the Paid view.
- Fee card: a fee item with `refunded` shows `Refunded` on its row; in the collapsed paid/finalized summary, each refunded item adds a line `{name}: refunded`. Finalization and `paid_cents` text unchanged.

- [ ] **Step 1: Failing tests:** `"shows each item's result as polling advances"` (MSW returns queued, then finished); `"Retry posts to /retry and follows the new batch"`; `"finishing clears the selection and refetches the list"`; fee card `"shows Refunded on a refunded item"` and `"finalized summary notes the refund"`.
- [ ] **Step 2-4:** run `npm --prefix frontend test -- --run src/features/staff-payments src/features/payments` (FAIL → implement → PASS).
- [ ] **Step 5: Commit** "Show per-row refund results with retry, and Refunded on the racer fee card".

### Task 15: Bulk refund e2e

**Files:**
- Modify: `tests/spa/payments-admin.spec.ts`, `lib/tasks/test_seeds.rake` (`payments_admin` credentials add one owner password so the spec can log in as that racer)

- [ ] **Step 1: Extend the spec** (Playwright runs with `SIDEKIQ_INLINE=true`, so the batch finishes inside the POST; the page still polls once and shows results): `Refund payments` → `Select next 5` → `Review and refund 5…` → dialog lists 5 teams and `$250.00`; typing `REFUND 4` keeps Confirm disabled; `REFUND 5` → results show 5 `Refunded`; progress line reads `6 of 7 refunded`; Paid view shows 1 row; at 320px the bottom bar and dialog buttons stay inside the viewport; `waitForEmail` finds one refund email for a refunded owner and `countEmails` stays 1 for that owner after reloading; log in as that owner, the team page fee card shows `Refunded`; the legacy team page as the refunder shows the `refunded` label.
- [ ] **Step 1a: Single-refund e2e (owner requirement, 2026-11-24).** A separate Playwright test refunds exactly one payment (select 1, `Review and refund 1…`, dialog title `Refund 1 payment?` with correct singular wording, type `REFUND 1`, result `Refunded`, one email, fee card shows `Refunded`), so batch of 1 is covered as well as batch of N.
- [ ] **Step 1b: Partial-failure e2e (owner requirement, 2026-11-24).** A second Playwright test in `tests/spa/payments-admin.spec.ts` seeds a batch of 3 where one payment fails on its first attempt and succeeds on retry (needs a failure hook that exists only outside production, e.g. a `MockPaymentRequirement` payment whose `charge_id` starts `mock_fail_once_`, which raises a Stripe-style error the first time and records that it did; it must be unreachable in production, covered by a spec, and listed in the PR body). Steps from the staff user's view: select 3, confirm; results show 2 `Refunded` and 1 `Failed: <message>` with a `Retry 1 failed` button; the progress line counts only the 2; the Paid view still lists the failed payment; click Retry; the results show all 3 `Refunded`; Done; the list and progress line update; exactly one refund email per team after the retry (`countEmails` is 1 for each, including the retried one); at 320px the failed row and Retry button stay inside the viewport. Also add an RSpec request spec (`Sidekiq::Testing.inline!`, StripeMock failing the first refund call) if one does not already cover create, partial failure, retry, completion with each payment refunded exactly once.
- [ ] **Step 2: Run** `npm --prefix frontend run build && DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid npx playwright test tests/spa/payments-admin.spec.ts tests/spa/staff-shell.spec.ts` and `npm test` (whole suite, legacy flow included) — Expected: PASS.
- [ ] **Step 3: Commit** "Cover bulk refund end to end". README/CLAUDE.md: refund flow, `REFUND_BATCH_LIMIT`, "retry is per batch".

**PR D verify:** `bin/check`. **Deploy note:** none beyond PR A's. Before the first real use on production, the owner runs one live refund on a low-price test payment (irreversible: owner confirms at the time).

---

## Self-review notes

- Spec coverage: data (T1-2), status (T2), service (T3), worker (T4), legacy + Ability (T5), API + cap + fee item (T6), shell (T7-8), page (T9-11 Browse, T11b Refund mode), dialog/polling/retry/fee card/e2e (T12-15), email (T3), deploy (PR notes).
- Builder's calls fixed here: page size 25, poll 2 s, job `retry: 3`, `payment_type` = requirement id, retry action named `retry_failed`, two migrations (columns, batch tables), retry is per batch.
