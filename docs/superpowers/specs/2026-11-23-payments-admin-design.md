# Payments admin page: search and bulk refund (issue #343)

Full design, worked out with the owner on 2026-11-23 and 2026-11-24. Approved by the owner 2026-11-24. Updated 2026-11-24 after the review of PR #344 and to match what PR #345 (`feature/343-refund-backend`, plan Tasks 1-6) shipped; where the two differed, this document now describes what shipped, plus the review fixes that PR #345 still needs (marked **required**).

## Intent and why

Refunders refund one payment at a time today: open a team's legacy registration page, click Refund on the paid item (`POST /charges/:charge_id/refund`, `ChargesController#refund`). After each race about 100-150 payments (cart deposits, in practice) are refunded by one staff login, which makes that one-by-one flow slow and error-prone.

The goal is one generic staff page in the SPA that lists every completed payment, filters it down to what is left to refund, and refunds a capped batch at a time with a deliberate confirmation. Nothing about it is cart-specific: a cart deposit is just a `PaymentRequirement` named "Cart Deposit". The team's account holder gets an email when a payment is refunded (owner: "a nice feature for the end user").

Success: a staff member picks the race and "Cart Deposit", then repeats "Select next N -> type REFUND N -> watch the results" until the progress line reads 142 of 142, with every refund recorded (who and when) and every team's account holder emailed once.

## Goals

- A staff shell in the SPA (`me` carries roles, a staff layout, staff routes) that the later staff-page reskin reuses.
- `GET` payments API with search and filters (race, team name, names and emails, payment type, status) and server-side pagination.
- The payments page: table, filters, progress line, "Select next N", per-row results, retry.
- Bulk refund through a background job, with a careful confirmation dialog and a server-enforced batch cap (`REFUND_BATCH_LIMIT`, default 5; the owner will raise it to 10).
- Full refunds only. A charge that is already refunded at Stripe reports as refunded, not as an error.
- Audit trail: `refunded_by` and `refunded_at` on every refund, from this page and from the legacy button.
- A refund email to the team's account holder, sent once per payment.
- The racer's fee card shows "Refunded" on a refunded payment.

## Non-goals

- A cart flag or "cart returned" marker.
- Partial refunds.
- The admin-only "refund and delete completed requirement" option on the new page. The legacy button keeps it until the legacy page is retired.
- Un-finalizing or un-paying a team on refund. A refunded payment still completes its requirement (as today), so the team stays finalized and `paid_cents` is unchanged.
- Translating the staff page. Admin pages are not translated; the refund email is racer-facing and is translated.
- New HAML pages. (Editing existing HAML, such as the navbar link and the legacy payment partials, is fine.)

## Anti-goals (would be a failure even if it "works")

- Refunding the same charge twice, or emailing the same team twice for one refund, under retries, double clicks, two staff tabs, or a Sidekiq retry.
- A refund that happened at Stripe but is not recorded here, with no way to heal it by retrying.
- Refunding anything other than exactly the rows the staff member reviewed in the dialog.
- The cap living only in the browser.
- The legacy racer flow or the legacy refund button breaking, including during the deploy.

## Constraints (from the code)

- **Payment data is not queryable today.** `completed_requirements.metadata` is a `text` column holding JSON encoded two or three times (Known Quirk 10), with `charge_id`, `customer_id`, `amount` and, after a legacy refund, `"refunded": true`. SQL cannot filter, page or total on it. Read it only through `CompletedRequirement#metadata`.
- Web requests are killed after 15 s (`config/unicorn.rb`, `timeout 15`). Refunds therefore run in a Sidekiq job.
- `stripe` gem `~> 1.58` (Technical Debt 1). Use APIs that exist in 1.58 (`Stripe::Charge.retrieve`, `Stripe::Refund.create(params, opts)`, `Stripe::Refund.list`); confirm with Context7/the gem source. Specs use stripe-ruby-mock.
- **No `Stripe.api_version` is pinned**, so every request uses the Stripe account's default API version. Response shapes depend on it (see `charge.refunds` below). Pinning one is a `config/initializers` change and needs the owner's approval first.
- Roles: RoleModel `admin`, `refunder`, `operator` (`User`). `Ability` already grants `:refund, :charges` to refunder, operator (and admin via `manage :all`). The legacy partial used to show Refund only to refunder and admin.
- `me` (`GET /api/v1/me`, `sessions#show`, `users/_user.json.jbuilder`) has no roles. The SPA has no staff concept and no table, pagination or checkbox components.
- `Payments::ChargeTeam` is the service pattern (`Result = Data.define(...)`, `self.call(**)`, session-level advisory lock on `(team_id, requirement_id)`, `alert` to the log and Rollbar). `ChargeTeam#record` runs **after** Stripe has charged the card.
- `sent_emails` has a unique index on `(team_id, kind, dedupe_key)` where `dedupe_key` is not null; `UserMailer#track` sets it.
- API conventions: `Api::V1::BaseController`, `{ error, errors }` errors with a stable `code`, CSRF header, `spec/requests/api/v1/query_count_spec.rb` guards list endpoints against per-row queries.
- Mock payments (`MockPaymentRequirement`) have no Stripe charge. Staging seed payments carry fake `ch_seed_*` ids, so refunding them fails at Stripe.
- The `Procfile` has no `release:` phase: a push does not migrate, and dynos booted before a migration keep the old column list until `heroku restart`.

## Approaches

How the refunds of a batch run (the web request limit is 15 s; 10 Stripe refunds usually take 3-8 s but can take longer):

1. **Background job, page checks back (chosen by the owner).** `POST` validates and records a batch, a Sidekiq job refunds each item, and the page polls the batch for per-row results. No timeout risk, and the batch finishes even if the tab closes or the network drops. Costs a batch table and polling UI.
2. One synchronous request per batch with a ~10 s time budget, remaining items reported "not started, retry". Least machinery and immediate results, but a slow Stripe moment can kill the worker mid-batch (healed by retry, but rough). Not chosen.
3. The page sends one request per payment. Live progress, but the server could no longer enforce the batch cap. Rejected: contradicts the decided server-side cap.

Idempotency is the same in every approach and comes from the per-payment safeguards below, not from the job itself. The job needs them because Sidekiq retries.

Storage: real columns on `completed_requirements` (a payment is refunded at most once, since refunds are full) plus a batch/item table for the job's progress. A separate refunds ledger was not needed.

## Decided by the owner

- Generic staff payments page; nothing cart-specific.
- All new UI in the SPA (`frontend/`), no new HAML.
- Search and filter by race, team name, names and emails, payment type and status, with server-side pagination.
- Bulk refund with an extra careful confirmation: the dialog lists every payment and the total, warns it is irreversible, requires typing `REFUND <count>`, and refuses if the selection changed.
- Batch cap from env `REFUND_BATCH_LIMIT` (default 5, later 10). The API returns it, the SPA stops selection at the cap, the server rejects larger batches with 422.
- Full refunds only; per-row results with retry; an already-refunded charge reports as refunded; record who refunded and when.
- Access: refunder, operator, admin.
- Refunds run in a background job and the page checks back for results.
- The refund email goes to the team's account holder (`team.user`), not to `completed_requirement.user`, because staff who take a payment in the legacy view are stored as the payer.
- Expected volume: 100-150 refunds per race, done by one staff login.
- E2E coverage: a single refund, a batch of N, and a partial failure healed by retry (2026-11-24).

Decided by the owner (see "Owner decisions" at the end): the Stripe idempotency key is `refund-<charge_id>`, a refund found already made at Stripe is shown as "Done at Stripe", and the default race is the newest open race, else the most recent race that has already run, else the newest.

## Design

### Data

Migration `AddPaymentColumnsToCompletedRequirements` (`bin/rails g migration`, `text` for strings, `datetime` for times) on `completed_requirements`:

- `charge_id` (text, indexed, not unique), `amount_cents` (integer), `refunded_at` (datetime), `refunded_by_id` (bigint, FK to `users`, nullable, `on_delete: :nullify`), `stripe_refund_id` (text).
- Backfill in a public data method, `backfill_payment_columns`, so `spec/migrations/` can call it (per CLAUDE.md). It:
  - calls `CompletedRequirement.reset_column_information` first, since the model may have been loaded before the columns existed;
  - reads each row through `CompletedRequirement#metadata` and skips (with a `Rails.logger.warn` naming the id) a row whose metadata cannot be decoded or is not a hash;
  - sets `charge_id = metadata["charge_id"]` and `amount_cents = Integer(metadata["amount"].to_s, 10, exception: false)`. Old rows may hold the amount as a string such as `"5000"`; base 10 matters, since `Integer("010")` without it is 8 and `Integer("0x10")` is 16. (**Required:** PR #345 calls `Integer` without the base.)
  - for a row with `metadata["refunded"]` and no `refunded_at`, sets `refunded_at = updated_at || created_at || Time.current` (a best guess) and leaves `refunded_by_id` nil;
  - writes with `update_columns` (no callbacks, no email) and is idempotent, so it can be run again after the deploy (see Deploy).
- New rows: `Requirement#complete` writes `charge_id` and `amount_cents` alongside the metadata, **only when the model knows those attributes** (**required**, being added to PR #345: before the migration, passing them raises `ActiveModel::UnknownAttributeError` after the card was charged; see Deploy). Metadata stays as is; refunds also keep setting `metadata["refunded"] = true` so nothing reading the flag breaks.
- `CompletedRequirement#refunded?` is `refunded_at.present?` when the `refunded_at` attribute exists, and otherwise falls back to `metadata["refunded"]` being truthy (**required**, being added to PR #345), so team pages render on dynos that do not know the column yet.
- The legacy payment partial switches to `cr.refunded?` for the label and `cr.charge_id` for the Refund URL. So that the label and the legacy refund agree at every commit, Task 1 made the old `CompletedRequirement.mark_refunded_by_charge` also write `refunded_at`; Task 5 then removed that method when the button moved to the service.
- The mock-payment partial (`_mock_payment_requirement.html.haml`) shows no refund state today; it gets the same `cr.refunded?` label, so a refunded mock payment reads "Refunded" in the legacy view (plan Task 15).

New tables (migration `CreateRefundBatches`):

- `refund_batches`: `user_id` (who asked; not null, FK to `users`), `retry_of_id` (nullable, the batch being retried, `on_delete: :nullify`), `finished_at`, timestamps.
- `refund_batch_items`: `refund_batch_id` (FK, `on_delete: :cascade`), `completed_requirement_id` (FK, `on_delete: :cascade`, so an admin's "refund and invalidate" deletes the item with the row), `status` (`queued`, `refunded`, `already_refunded`, `failed`, `stalled`; default `queued`), `error_code`, `message`, `finished_at`, timestamps. A unique partial index on `completed_requirement_id` where `status = 'queued'` stops two tabs from queuing the same payment.
- `User has_many :refund_batches, dependent: :restrict_with_error`: refund batches are the audit of who refunded what, so deleting a staff user who made one is refused, and the legacy `users#destroy` shows the reason ("Cannot delete record because dependent refund batches exist") instead of a generic failure.

### Payment status (one definition, on the model)

`CompletedRequirement.payment_status_sql` is the only definition (a SQL `CASE`, used by `with_payment_status` and `#payment_status`); nothing else re-derives it.

- `refunded`: `refunded_at` present.
- `refunding`: has a `queued` batch item created less than `RefundBatch::STALL_AFTER` (10 minutes) ago. (**Required:** PR #345 counts every queued item, whatever its age.) An older queued item does not count, so a job that never ran (Redis down, the worker killed and Sidekiq out of retries) cannot leave a payment `refunding` forever: it reads `paid` again and can be selected. When a new batch is queued for that payment, `QueueRefundBatch` first marks the old queued item `stalled` (with `finished_at`), in the same transaction, so the unique queued index admits the new item. A late original job then skips the stalled item; the lock and Stripe check below would stop a double refund anyway.
- `not_refundable`: a `MockPaymentRequirement` payment in production, or no `charge_id`. Outside production, mock payments are refundable without calling Stripe, mirroring `POST /mock_payments` being dev/test-only, so the e2e spec can run the whole flow.
- `paid`: none of the above.

### `Payments::RefundCharge` service

`Payments::RefundCharge.call(user:, completed_requirement:)` returns `Result(ok, code, message)`. `ok` is true for `refunded` and `already_refunded`. The other codes are `not_refundable`, `in_progress`, `partially_refunded`, `amount_mismatch`, `stripe_error` and `unexpected`. These are service codes; a batch item stores `refunded` or `already_refunded` as its status and every other code as status `failed` with `error_code` set to the code. `failed` is an item status, never a service result. Messages are for staff and are not translated.

Order of checks:

1. If `refunded?`, return `already_refunded` (no lock, no Stripe call).
2. Take the same session-level advisory lock as `ChargeTeam` on `(team_id, requirement_id)` (shared in `Payments::AdvisoryLock`); `in_progress` if held.
3. Inside the lock, reload. If `refunded?` now (another request finished it while this one waited), return `already_refunded`.
4. If `payment_status` is `not_refundable` (evaluated after the reload), return `not_refundable`. (**Required:** PR #345 checks `not_refundable` before step 1; reorder it.)
5. A mock payment outside production is recorded without calling Stripe (`stripe_refund_id` nil). In development and test only (never in production, including staging, which runs `RAILS_ENV=production`), a mock payment whose `charge_id` starts with `mock_fail_once_` fails its first attempt with `stripe_error`, for the partial-failure e2e spec; it remembers the failed attempt in that row's metadata (`"mock_fail_once_tripped" => true`, written with `update_columns`), so the retry succeeds. The hook is guarded by `Rails.env.development? || Rails.env.test?` and covered by a spec that it never fires in production.
6. Retrieve the charge with its refunds expanded: `Stripe::Charge.retrieve(id: charge_id, expand: ["refunds"])`. On Stripe API versions 2022-11-15 and later the `refunds` list is not included on a charge unless expanded, and no `Stripe.api_version` is pinned, so the code never assumes the list is present: if `charge.refunds` is missing anyway, it lists them with `Stripe::Refund.list(charge: charge_id)`. (`refunded`, `amount` and `amount_refunded` are on the charge in every version.) **Before the first live refund the owner checks the account's default API version** (Stripe dashboard, Developers) and that staging's test mode uses the same one.
   - `charge.refunded` (refunded in the Stripe dashboard, or by an earlier attempt that died before saving): record it with `refunded_by` nil, `refunded_at` = the covering refund's Stripe `created` time (now if Stripe lists none), and `stripe_refund_id` = the refund whose amount equals the charge's, else the newest. Queue the email and return `already_refunded`. Nobody in this app is known to have made it, so it is not attributed to the staff member who ran the retry (this replaces the original "also this user"). The staff payments JSON shows such a row's `refunded_by` as `{ "name": "Done at Stripe" }` when `stripe_refund_id` is present; a backfilled refund with no Stripe refund id shows `null`.
   - `amount_refunded > 0` (partly refunded): refund nothing and return `partially_refunded` with a message naming the amount already refunded, for staff to finish in Stripe (refunding "the rest" would not be a full refund of what this app recorded).
   - `charge.amount != amount_cents`: refund nothing and return `amount_mismatch` (whole-charge refunds only; also catches a missing or wrong backfilled amount).
7. Otherwise create a full refund: `Stripe::Refund.create({ charge: charge_id }, { idempotency_key: "refund-<charge_id>" })` (the key goes in opts, which become the `Idempotency-Key` header).
8. Record with one `update_columns` of `refunded_at`, `refunded_by_id` (this user), `stripe_refund_id`, `metadata["refunded"] = true` and `updated_at`. It skips validations on purpose: a refund that reached Stripe is always recorded, even if the row would no longer validate (for example the payer's account was deleted), or every retry would repeat the failure.
9. Queue the refund email (below) whenever this app records the refund for the first time (steps 5, 6 and 8). A failure to queue it is alerted and never fails the refund. The backfill sends nothing.

The email on `already_refunded` from steps 1 and 3 (**required**): if no `SentEmail` row exists for `kind: "refund"` and `dedupe_key: "refund-<charge_id>"`, and the row was refunded by this app (`stripe_refund_id` or `refunded_by_id` present), queue the email again. That heals an email job that was lost or failed for good. If the first job is only waiting in the queue, the mailer's dedupe key still lets just one send through. Backfilled legacy refunds have neither column set and are never emailed.

**What the idempotency key does and does not do.** Stripe stores the first response for a key for 24 hours and replays it, errors included, to any later request with the same key; after 24 hours it forgets the key. So the key only collapses two `Refund.create` calls for the same payment within 24 hours into one refund. Retry healing relies on the advisory lock and the charge retrieve check in step 6 (which finds the charge refunded and records it), not on the key. Two consequences: a payment whose first `Refund.create` failed at Stripe gets the same cached error on every retry for 24 hours (staff see the same message; fix the cause in Stripe or wait), and the key is `refund-<charge_id>` (decided: unique across databases that share one Stripe test account, and safe because a charge is refunded at most once).

Errors: `Stripe::InvalidRequestError` returns `stripe_error` with Stripe's reason. Any other `Stripe::StripeError` returns `stripe_error`, and if `Refund.create` was sent with no response, also alerts "Refund outcome unknown" with the charge, team and requirement ids (as `ChargeTeam#flag_unknown_charge_outcome` does); a retry heals it through step 6. An error after Stripe returned a refund (the save failed) alerts "Refunded at Stripe but not recorded" with the refund, charge, team and requirement ids and returns `unexpected`; a retry records it through step 6.

The legacy `ChargesController#refund` calls this service too (synchronously; one payment fits in the time limit), so legacy refunds are audited and emailed. It finds the payment with `CompletedRequirement.find_by(charge_id:)` (404 JSON when there is none), sets `flash[:notice]` from the result or `flash[:error]` to its message, and redirects to the prior URL. `delete_completed_requirement` is cast with `ActiveModel::Type::Boolean` (before, `"false"` counted as true). The admin-only "Refund and invalidate" deletes the row after a successful refund; that deletes its `refunded_at`/`refunded_by_id` and (FK cascade) its batch items, so it first logs one line (charge id, team, requirement, admin user id, time). This audit gap is accepted for an admin-only option that is being retired. The email job takes plain values (team owner's user id, team id, completed requirement id, requirement name, amount, race name), not the completed requirement, so it still sends after the row is deleted; it skips (logs, no raise) when the user or team no longer exists.

### Background job

`Workers::RefundBatch` (`include Workers::Common`, `queue: :important`, `retry: 3`). It processes only the batch's `queued` items, in id order, one at a time:

- It claims each item by re-reading it with `RefundBatchItem.find_by(id:)` right before processing, and skips it when it is gone (deleted with its completed requirement) or no longer `queued` (a retry marked it `stalled`). (**Required:** PR #345 uses `find`, which raises `RecordNotFound` for a deleted item, so Sidekiq retries the whole job and the batch never finishes.)
- It writes each item's status, `error_code` and message as it finishes, so a Sidekiq retry resumes where it stopped and never refunds or emails twice.
- It sets the batch's `finished_at` at the end. `finished_at` is also set whenever a write leaves the batch with no `queued` items (**required**: `mark_stalled!` and the stale-item marking in `QueueRefundBatch` do this too), so a batch whose job died still ends up finished once retried.

Stalled items: an item still `queued` `STALL_AFTER` (10 minutes) after its batch was created is **reported** `stalled` by `GET /staff/refund_batches/:id` (`RefundBatch#reported_status`), but a GET never writes. Only a retry (`mark_stalled!`) or queuing a new batch for the same payment rewrites it to `stalled`, right before re-queuing, so a payment is never queued twice. A late original job that still runs is safe: it skips items no longer `queued`, and for one it already read, the lock, the `refunded?` re-check and the Stripe check stop a second refund.

### API (`/api/v1/staff/...`, authorized with `authorize! :refund, :charges`, otherwise 403; 401 when logged out)

- `GET /staff/payments?race_id=&payment_type=&status=&q=&page=` (`Payments::PaymentSearch`):
  - Rows (25 per page, stable order `completed_requirements.created_at DESC, id DESC`, associations loaded with `preload`, not `includes`, so no join is added to the paged query): id, race, team (id, name), team owner (name, email), paid by (name, email; `completed_requirement.user`), payment type (requirement name), amount, paid at, status, refunded at, refunded by (name).
  - `race_id` absent means the default race; `all` means every race; an unknown id lists nothing. Default race (owner decision): the newest race (by `race_datetime`) whose registration is open, else the most recent race whose `race_datetime` has passed, else the newest race.
  - `q` matches, case-insensitively and with `sanitize_sql_like`: the team name, and the name (first and last) or email of the account holder, the payer, or any racer on the team. Every place that describes the search (this spec, the plan, the SPA placeholder) uses this one list.
  - `meta`: `page`, `per_page`, `total_count`, `total_pages`, `refund_batch_limit`, and a `summary` over the current filters ignoring status: `count`, `refunded_count`, `total_cents`, `refunded_cents` (drives the progress line).
  - `filters`: the race in use (`race_id`, or `all`), races (id, name, `registration_status`, newest first; plus `race_datetime`, added with Refund mode, which shows the race's date) and the payment types (payment requirements) of the selected race.
  - No per-row queries (pinned in `query_count_spec.rb`).
- `POST /staff/refund_batches` `{ completed_requirement_ids, confirmation, expected_total_cents }` (`Payments::QueueRefundBatch`), checked in this order, all or nothing (nothing is queued on any error):
  - 400 `bad_request` for an empty list, duplicate ids, or an id that is not an integer.
  - 422 `batch_too_large` when over `REFUND_BATCH_LIMIT`.
  - 422 `confirmation_mismatch` unless `confirmation` is exactly `"REFUND #{ids.size}"`. The server does not trim or fold case; the SPA normalizes what the staff member typed and always sends that exact string (see the dialog).
  - 422 `invalid_total` unless `expected_total_cents` is a whole number of cents (an integer, a numeric string, or a float with no fraction).
  - 422 `not_refundable` with `errors` keyed by id (`["already refunded"]`, `["being refunded"]`, `["not refundable"]`, `["not found"]`). Losing a race on the queued-item index is reported the same way, with `["being refunded"]` for every id.
  - 422 `selection_changed` when `expected_total_cents` differs from the server's sum of `amount_cents`.
  - 201 with the batch; the job is enqueued after the commit. If enqueuing fails (Redis down), the batch stays saved, an alert is logged, and its items report `stalled` after 10 minutes so staff can retry.
- `POST /staff/refund_batches/:id/retry`: runs `mark_stalled!`, then re-queues that batch's `stalled` items and its `failed` items whose `error_code` can change on a retry (`stripe_error`, `in_progress`, `unexpected`) and whose payment is still `paid`, as a new batch with `retry_of_id`, without retyping (the staff member already confirmed those payments); still capped. `partially_refunded`, `not_refundable` and `amount_mismatch` are left out (**required**: PR #345 retries every `failed` item): a retry cannot change them; they need a fix in Stripe or in the data. 422 `nothing_to_retry` when nothing qualifies.
- `GET /staff/refund_batches/:id`: the batch (`id`, `created_at`, `finished_at`, `retry_of_id`, and **required** `done`: true once `finished_at` is set or no item reports `queued`) and its items (`id`, `completed_requirement_id`, `team_name`, `payment_type`, `amount_cents`, reported `status`, `error_code`, `message`, `finished_at`, and **required** `retryable`: what the retry above would re-queue). Staff can read any batch. Never writes.
- `REFUND_BATCH_LIMIT` is read in one place, `RefundBatch.max_size`: a positive integer, default 5; blank, zero, negative or non-numeric values fall back to 5. **Required:** clamp it to at most 25 (`RefundBatch::MAX_SIZE`): one page holds 25 rows, so `Select next N` can always fill a batch from the current page, and one job's worth of Stripe calls stays short. A value above 25 means 25, not 5.

### Staff shell (SPA)

- `GET /me` adds `roles` (e.g. `["refunder"]`). The SPA `User` type gains `roles`.
- `RequireStaff` guard (any of admin, refunder, operator) under `RequireAuth`; a non-staff user sees a not-allowed page. The server is the real gate.
- `StaffLayout` (wide, `max-w-5xl` or wider): a staff nav with "Payments" for now, and a link back to the legacy admin.
- Routes under `/register/staff/*` (e.g. `/register/staff/payments`).
- Entry points: a "Staff" link in the SPA header for users with a staff role; a "Payments" item in the legacy navbar admin dropdown (an edit to the existing navbar).
- Feature folder `frontend/src/features/staff-payments/{api,components}` (Bulletproof React). Copy in `en.ts` under `staff.*` (the SPA's only string mechanism; not translated).
- `ApiError` (`frontend/src/lib/api-client.ts`) gains `code` (the response body's `code`, or undefined), so the page can branch on `selection_changed`, `not_refundable` and the rest. `error` stays the human-readable sentence.

### Payments page (Browse and Refund mode)

The page is called **Payments**. It opens in Browse mode, a read-only lookup for every staff role. **Refund mode** is a deliberate mode entered with a `Refund payments` button. Mockups were reviewed with the owner on 2026-11-24 (visual companion; the screens are not committed).

```
Browse:       Payments                                    [Refund payments]
              CHIditarod 2026 ▾  All types ▾  All ▾  Search team, name or email
              37 of 142 deposits refunded · $1,850 of $7,100
              Team                Type          Amount  Status
              The Secret Gents    Cart Deposit  $50     Paid
              Wheelie Good        Cart Deposit  $50     Refunded Nov 20

Refund mode:  red top edge, "Payments · Refund mode"                [Cancel]
              "Refunding CHIditarod 2026 (Mar 7, 2026). Tick up to 5 paid payments.
               Refunds cannot be undone."                          [Select next 5]
              ☑ Team  Cart Deposit  $50   (only Paid rows are listed)
              ┌ 2 of 5 selected · $100            [Review and refund 2…] ┐  (bottom bar)
```

- **Filters** (all in the URL query, so a reload or a shared link keeps them): Race (default as the API decides; lists every race with open/closed; `All races` allowed), Payment type (only the chosen race's payment requirements, so a filter can never return nothing; changing the race drops it), Status (`All`, `Paid`, `Refunded`; default `All` in Browse), and Search (debounced about 300 ms; matches the team name and the name or email of the account holder, the payer or any racer). Active filters show as removable chips with `Clear all`. No payment date range in v1.
- **Mobile (must work at 320 px, no horizontal scroll):** rows become cards below `sm` (emails use `[overflow-wrap:anywhere]` inside a `grid-cols-[minmax(0,1fr)]` grid); search stays on top and the other filters sit behind one `Filters` row that opens a sheet (Race, Payment type, a three-way Status control, `Show N payments`, `Clear all`); checkboxes are about 44 px tap targets; the Refund-mode bottom bar is pinned with a full-width button; the confirmation dialog fills the screen and scrolls its list while the total, typed field and buttons stay visible. The Playwright spec asserts `scrollWidth <= 320` and that the buttons sit inside the viewport.
- **Entering Refund mode** needs one race: with `All races` chosen the `Refund payments` button is disabled with the note `Pick one race to refund.` It keeps the other filters and sets Status to `Paid` (locked while in the mode), so only `paid` rows are listed: refunded, refunding and not-refundable rows are not shown at all (they are not greyed out). The banner names the race and its date. When that race's date is more than a year ago, the banner adds an amber warning (`This race was more than a year ago. Check that you picked the right race.`). Refund mode is local page state, not in the URL, so a reload returns to Browse. Cancel, or finishing a batch, clears the selection and returns to Browse.
- **Selection:** checkboxes on `paid` rows only (a row that turns `refunding` or `refunded` on a refetch leaves the list; the dialog check below catches it if it was selected); once `refund_batch_limit` rows are ticked, the rest disable with a note saying why. Selection may span pages and is cleared when the race changes. `Select next N` (in the banner row) ticks the first unselected rows on the current page up to the cap.
- **`Review and refund N…`** opens the confirmation dialog (built on `DialogSheet`/`useFocusTrap`, `closeOnBackdrop={false}`): the title states the count (`Refund N payments?`, singular for one), a bold red `This cannot be undone. The money goes back to each card.`, every payment (team, account holder, type, amount), the total, the email note (`Each team's account holder will be emailed. Refunds take about 5 to 10 business days to appear.`), and a text field that must read `REFUND N`. The SPA normalizes the typed text (trims it, ignores case, collapses inner spaces) and compares it with `REFUND N`, where the number must equal the count; on Confirm it sends the canonical `REFUND N`, never the raw input, because the server requires the exact string. The red button stays faded until it matches. The dialog snapshots the selection; if the selection or a refetch changes those rows while it is open, it refuses and asks to review again. The server repeats the checks above.
- **After confirming:** the dialog switches to a results view (`Refunding… 1 of 2 done`) and polls `GET /staff/refund_batches/:id` (about every 2 s) until the batch is `done` (`finished_at` set, or no item reports `queued`; a batch whose job died therefore stops polling once its items report `stalled`), showing each row's result (`Refunded`, `Already refunded`, `Failed: message`, `Stalled`). It cannot be closed while the batch is not done (backdrop and Escape do nothing). When any item is `retryable`, one `Retry {k} failed` button (k = retryable items) posts `.../retry` for the batch and follows the new batch; failed items that are not retryable (partly refunded, not refundable, amount mismatch) show their message and a hint to check Stripe. `Done` ends Refund mode, clears the selection and refetches the list and progress line, so refunded rows leave the Paid view.
- **Not in v1:** clicking a row for a details view, a payment date range, a "cart returned" marker.

### Refund email

`UserMailer#payment_refunded_email(user, team, details)` to the team's account holder (`team.user`), tracked with `kind: "refund"`, the team, and `dedupe_key: "refund-<charge_id>"`, so a retry never sends twice. It names the race, team, payment type and amount, and says refunds usually take 5-10 business days to appear. Strings in `config/locales/en.yml` (`user_mailer.payment_refunded_email.*`); the copy needs the owner's review before production. Delivered asynchronously by `Workers::PaymentRefundedEmail` (`default` queue).

### Racer fee card

`TeamChecklist` fee items carry `refunded` (from the already loaded completed requirement; no extra query); the SPA fee card shows "Refunded" on that row. Finalization and `paid_cents` are unchanged.

### Staging seed

`bin/rails staging:seed` (`lib/staging_seed.rb`) fills an empty database after the migrations have run, so the backfill never sees its rows. It must write `charge_id` and `amount_cents` on the completed requirements it creates (**required**), or every seeded payment reads `not_refundable` and the staff page shows a $0 total. Seeded `ch_seed_*` charges still fail at Stripe with `stripe_error`, which is useful for checking the failure path on staging.

### Deploy

**Without the guard below, this deploy charges cards it cannot record.** From the push until the migration has run, `Requirement#complete` passing `charge_id`/`amount_cents` raises `ActiveModel::UnknownAttributeError` inside `ChargeTeam#record`, which runs after Stripe has charged the card. The racer sees an error, the log and Rollbar say "Charged but not recorded", nothing is saved, the team stays unpaid, and the racer's retry charges the card again. Every payment in that window becomes a manual refund.

Required behavior (being added to PR #345 by its own fix; not optional):

- `Requirement#complete` writes `charge_id` and `amount_cents` only when the model knows those attributes, so payments are recorded (metadata only) on a dyno that has not seen the columns.
- `CompletedRequirement#refunded?` falls back to `metadata["refunded"]` when `refunded_at` is not a known attribute. Without it, every team page that shows a payment (the legacy `_payment_requirement` partial and the SPA's `TeamChecklist` fee line) raises from the push until the migration has run **and** the dynos have restarted.

Even with both, until the migration has run and the dynos have restarted: the staff API and the legacy Refund button fail (the new tables and columns are missing, or dynos booted earlier do not know them), and payments taken between the migration and the restart are saved without `charge_id`/`amount_cents` (the old dynos still use the old column list). Order:

1. `heroku pg:backups:capture --app dogtag` (the migration only adds, but the backfill rewrites a column on every completed requirement).
2. Push to `dogtag-staging` first, then run `heroku run rails db:migrate -a dogtag-staging` immediately, then `heroku restart -a dogtag-staging`.
3. Fill the rows created between the migration and the restart by running the backfill once more (it is idempotent): `heroku run -a dogtag-staging 'bin/rails runner "require Rails.root.join(%q(db/migrate/20261124062730_add_payment_columns_to_completed_requirements)).to_s; AddPaymentColumnsToCompletedRequirements.new.backfill_payment_columns"'`.
4. Production the same, at low traffic and well before a registration opening.

`Workers::RefundBatch` runs on the `important` queue on the existing worker dyno. Set `REFUND_BATCH_LIMIT` only when moving off the default (an owner config-var change). Before the first live refund, the owner checks the Stripe account's API version (see the service, step 6) and runs one live refund on a low-price test payment (irreversible; the owner confirms at the time).

## Testing

- Service: stripe-ruby-mock for refunded, already refunded at Stripe (and which refund is recorded), already recorded (no Stripe call), partially refunded, amount mismatch, unknown charge, Stripe connection error with the alert, save failure after a Stripe refund, lock held, mock payment in production vs development, the check order (a refunded row returns `already_refunded` before `not_refundable`), the retrieve expanding refunds and the list fallback when the charge carries none, the email re-queue on `already_refunded` only when no `SentEmail` row exists and never for backfilled rows, and the `mock_fail_once_` hook (fails once, then succeeds; never fires in production).
- Worker: `Sidekiq::Testing.inline!`, resume after a mid-batch failure, no double refund or email on rerun, a deleted item is skipped and the batch still finishes, stalled items skipped, a late original job never refunds twice.
- Queue service: every code above, all-or-nothing, a stale queued item (older than 10 minutes) is marked stalled and its payment queued again, retry leaves out `partially_refunded`, `not_refundable` and `amount_mismatch`, `REFUND_BATCH_LIMIT` above 25 clamps to 25.
- Request specs: authorization (logged out 401; racer 403; refunder, operator, admin 200), filters, search across team name and every name and email source, pagination, every 400/422 code, the confirmation is exact (`"refund 5"`, `" REFUND 5"` and `"REFUND  5"` are 422 `confirmation_mismatch`; `"REFUND 5"` is 201), `done` and `retryable` in the batch JSON, query count.
- Model: `Requirement#complete` and `CompletedRequirement#refunded?` when the new attributes are unknown (stub the attribute check), `payment_status` for a fresh and a stale queued item, `with_payment_status` agreeing with `#payment_status`.
- Migration spec calls the backfill method on factory data, including double- and triple-encoded metadata, a string amount (`"5000"` and `"010"`), legacy `refunded` rows (with and without `updated_at`), and undecodable metadata.
- Mailer spec and dedupe.
- Legacy refund controller spec still passes, now recording `refunded_by`; deleting a staff user with refund batches is refused with the message.
- Vitest for the page, selection cap, single-race Refund mode, dialog refusal, typed-confirmation normalization (the POST body carries exactly `REFUND N`), `ApiError.code`, polling until `done`, and retry counting only retryable items.
- Playwright `tests/spa/payments-admin.spec.ts` seeded by `test_seeds:payments_admin` (mock payments, a refunder user, `@example.com`), added to `test_seeds:cleanup`: a single refund, a batch of N, and a partial failure healed by retry.

## Left to the builder

- Exact Stripe 1.58 calls and how stripe-ruby-mock supports them (including `expand` on retrieve and `Refund.list`).
- Polling interval, page size and job retry count, within the numbers above.
- Component breakdown and naming in the feature folder, and whether a small table/checkbox primitive goes in `components/ui`.
- Index choices beyond those listed, checked with `EXPLAIN` on realistic data.

## Owner decisions

Raised by the PR #344 review and decided by the owner on 2026-11-24:

1. **Stripe idempotency key:** `refund-<charge_id>`. Charge ids are Stripe's, so they are unique across the databases that share one Stripe test account; a charge is refunded at most once (full refunds only). Healing still relies on the lock and the retrieve check, not on the key.
2. **A refund found already made at Stripe:** recorded with `refunded_by` nil and Stripe's time, and shown as "Done at Stripe" (the staff payments JSON `refunded_by: { name: "Done at Stripe" }` when `stripe_refund_id` is present).
3. **Default race on the payments page:** the newest open race, else the most recent race that has already run, else the newest race.
