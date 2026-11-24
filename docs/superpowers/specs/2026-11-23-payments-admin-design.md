# Payments admin page: search and bulk refund (issue #343)

Full design, worked out with the owner on 2026-11-23 and 2026-11-24. Approved by the owner 2026-11-24.

## Intent and why

Refunders refund one payment at a time today: open a team's legacy registration page, click Refund on the paid item (`POST /charges/:charge_id/refund`, `ChargesController#refund`). After each race about 100-150 payments (cart deposits, in practice) are refunded by one staff login, which makes that one-by-one flow slow and error-prone.

The goal is one generic staff page in the SPA that lists every completed payment, filters it down to what is left to refund, and refunds a capped batch at a time with a deliberate confirmation. Nothing about it is cart-specific: a cart deposit is just a `PaymentRequirement` named "Cart Deposit". The team's account holder gets an email when a payment is refunded (owner: "a nice feature for the end user").

Success: a staff member picks the race and "Cart Deposit", then repeats "Select next N -> type REFUND N -> watch the results" until the progress line reads 142 of 142, with every refund recorded (who and when) and every team's account holder emailed once.

## Goals

- A staff shell in the SPA (`me` carries roles, a staff layout, staff routes) that the later staff-page reskin reuses.
- `GET` payments API with search and filters (race, team name, any email, payment type, status) and server-side pagination.
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
- New HAML pages. (Editing existing HAML, such as the navbar link and the legacy refund partial, is fine.)

## Anti-goals (would be a failure even if it "works")

- Refunding the same charge twice, or emailing the same team twice for one refund, under retries, double clicks, two staff tabs, or a Sidekiq retry.
- A refund that happened at Stripe but is not recorded here, with no way to heal it by retrying.
- Refunding anything other than exactly the rows the staff member reviewed in the dialog.
- The cap living only in the browser.
- The legacy racer flow or the legacy refund button breaking.

## Constraints (from the code)

- **Payment data is not queryable today.** `completed_requirements.metadata` is a `text` column holding JSON encoded two or three times (Known Quirk 10), with `charge_id`, `customer_id`, `amount` and, after a legacy refund, `"refunded": true`. SQL cannot filter, page or total on it. Read it only through `CompletedRequirement#metadata`.
- Web requests are killed after 15 s (`config/unicorn.rb`, `timeout 15`). Refunds therefore run in a Sidekiq job.
- `stripe` gem `~> 1.58` (Technical Debt 1). Use APIs that exist in 1.58 (`Stripe::Charge.retrieve`, `Stripe::Refund.create(params, idempotency_key: ...)`, or `charge.refunds.create`); confirm with Context7/the gem source. Specs use stripe-ruby-mock.
- Roles: RoleModel `admin`, `refunder`, `operator` (`User`). `Ability` already grants `:refund, :charges` to refunder, operator (and admin via `manage :all`). The legacy partial shows Refund only to refunder and admin.
- `me` (`GET /api/v1/me`, `sessions#show`, `users/_user.json.jbuilder`) has no roles. The SPA has no staff concept and no table, pagination or checkbox components.
- `Payments::ChargeTeam` is the service pattern (`Result = Data.define(...)`, `self.call(**)`, session-level advisory lock on `(team_id, requirement_id)`, `alert` to the log and Rollbar).
- `sent_emails` has a unique index on `(team_id, kind, dedupe_key)` where `dedupe_key` is not null; `UserMailer#track` sets it.
- API conventions: `Api::V1::BaseController`, `{ error, errors }` errors with a stable `code`, CSRF header, `spec/requests/api/v1/query_count_spec.rb` guards list endpoints against per-row queries.
- Mock payments (`MockPaymentRequirement`) have no Stripe charge. Staging seed payments carry fake `ch_seed_*` ids, so refunding them fails at Stripe.

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
- Search and filter by race, team name, any email, payment type and status, with server-side pagination.
- Bulk refund with an extra careful confirmation: the dialog lists every payment and the total, warns it is irreversible, requires typing `REFUND <count>`, and refuses if the selection changed.
- Batch cap from env `REFUND_BATCH_LIMIT` (default 5, later 10). The API returns it, the SPA stops selection at the cap, the server rejects larger batches with 422.
- Full refunds only; per-row results with retry; an already-refunded charge reports as refunded; record who refunded and when.
- Access: refunder, operator, admin.
- Refunds run in a background job and the page checks back for results.
- The refund email goes to the team's account holder (`team.user`), not to `completed_requirement.user`, because staff who take a payment in the legacy view are stored as the payer.
- Expected volume: 100-150 refunds per race, done by one staff login.

## Design

### Data

Migration (`bin/rails g migration`, `text` for strings, `datetime` for times) on `completed_requirements`:

- `charge_id` (text, indexed), `amount_cents` (integer), `refunded_at` (datetime), `refunded_by_id` (bigint, FK to `users`, nullable, `on_delete: :nullify`), `stripe_refund_id` (text).
- Backfill from `CompletedRequirement#metadata` in a public data method (e.g. `backfill_payment_columns`) so `spec/migrations/` can call it, per CLAUDE.md. Rows with `metadata["refunded"]` get `refunded_at = updated_at` (best guess) and `refunded_by_id = nil`.
- New rows: `Requirement#complete` (or `ChargeTeam#record`) writes `charge_id` and `amount_cents` alongside metadata. Metadata stays as is; refunds also keep setting `metadata["refunded"] = true` so nothing reading the flag breaks. The legacy partial switches to the column (`cr.refunded?`).

New tables:

- `refund_batches`: `user_id` (who asked), `created_at`, `finished_at`, `retry_of_id` (nullable, the batch being retried).
- `refund_batch_items`: `refund_batch_id`, `completed_requirement_id`, `status` (`queued`, `refunded`, `already_refunded`, `failed`, `stalled`), `error_code`, `message`, `finished_at`. A unique partial index on `completed_requirement_id` where `status = 'queued'` stops two tabs from queuing the same payment.

### Payment status (one definition, on the model)

- `refunded`: `refunded_at` present.
- `refunding`: has a `queued` batch item.
- `paid`: refundable, neither of the above.
- `not_refundable`: a `MockPaymentRequirement` payment in production, or no `charge_id`. Outside production, mock payments are refundable without calling Stripe, mirroring `POST /mock_payments` being dev/test-only, so the e2e spec can run the whole flow (builder's call, see below).

### `Payments::RefundCharge` service

`Payments::RefundCharge.call(user:, completed_requirement:)` returns `Result(ok, code, message)` with codes `refunded`, `already_refunded`, `not_refundable`, `in_progress`, `stripe_error`, `unexpected`.

1. Take the same session-level advisory lock as `ChargeTeam` on `(team_id, requirement_id)`; `in_progress` if held.
2. Reload; if `refunded_at` is set, return `already_refunded`.
3. Retrieve the Stripe charge. If Stripe already shows it fully refunded (refunded in the Stripe dashboard, or a killed earlier attempt), record it, queue the email (step 6), and return `already_refunded`. If Stripe shows it partially refunded (`refunded: false`, `amount_refunded > 0`), refund nothing and return `failed` with code `partially_refunded` and a message naming the amount already refunded, for staff to finish in Stripe (builder's call: rare, and refunding "the rest" would not be a full refund of what this app recorded).
4. Otherwise create a full refund with idempotency key `refund-cr-<completed_requirement id>`, so a repeat after a crash returns the same refund instead of a new one.
5. Record `refunded_at`, `refunded_by_id` (this user; for step 3, also this user, since they confirmed it), `stripe_refund_id`, and `metadata["refunded"] = true`.
6. Queue the refund email (below) whenever this app records the refund for the first time, including step 3, so a team whose refund was made in the dashboard or by a killed attempt is still emailed once; the dedupe key prevents a second email. The backfill sends nothing. Then return.

A Stripe error after the refund call may hide whether the refund happened: alert with the charge, team and requirement ids (as `ChargeTeam#flag_unknown_charge_outcome` does). A retry heals it through steps 3-4.

The legacy `ChargesController#refund` calls this service too (synchronously, one payment fits in the time limit), so legacy refunds are audited and emailed. Its admin-only "delete completed requirement" option keeps working after the service returns. Deleting the row also deletes its `refunded_at`/`refunded_by_id`, so that path logs one line (charge id, team, requirement, admin user id, time) before deleting; this audit gap is accepted for an admin-only option that is being retired (builder's call). The email job takes plain values (team owner's user id, team id, requirement name, amount, race), not the completed requirement, so it still sends after the row is deleted.

### Background job

`Workers::RefundBatch` (`include Workers::Common`, `queue: :important`, a small retry count). It processes only the batch's `queued` items, one at a time, writing each item's status, code and message as it finishes, then sets `finished_at`. Because finished items are skipped, a Sidekiq retry resumes where it stopped. An item still `queued` more than 10 minutes after the batch was created is reported `stalled` and can be retried (the retry marks it `stalled` before queuing a new item).

### API (`/api/v1/staff/...`, authorized with `can? :refund, :charges`, otherwise 403)

- `GET /staff/payments?race_id=&payment_type=&status=&q=&page=`:
  - Rows (25 per page, stable order `completed_requirements.created_at DESC, id DESC`): id, race, team (id, name), team owner (name, email), paid by (name, email; `completed_requirement.user`), payment type (requirement name), amount, paid at, status, refunded at, refunded by.
  - `q` matches the team name or any email (paid by, team owner, any racer), case-insensitive, with `sanitize_sql_like`.
  - `meta`: `page`, `per_page`, `total_count`, `total_pages`, `refund_batch_limit`, and a summary over the current filters ignoring status: `refunded_count`, `count`, `refunded_cents`, `total_cents` (drives the progress line).
  - `filters`: races (id, name, newest first) and the payment types for the selected race.
  - No per-row queries (add to `query_count_spec.rb`).
- `POST /staff/refund_batches` `{ completed_requirement_ids, confirmation, expected_total_cents }`:
  - Item codes from the service: `refunded`, `already_refunded`, `partially_refunded`, `not_refundable`, `in_progress`, `stripe_error`, `unexpected`.
  - 422 `batch_too_large` when over `REFUND_BATCH_LIMIT`; 422 `confirmation_mismatch` unless `confirmation == "REFUND #{ids.size}"`; 422 `selection_changed` when `expected_total_cents` differs from the server's sum; 422 `not_refundable` with `errors` keyed by id for ids that are refunded, refunding, not refundable or unknown. All-or-nothing: nothing is queued on any error.
  - 201 with the batch, then the job is enqueued.
- `POST /staff/refund_batches/:id/retry`: re-queues that batch's `failed` and `stalled` items as a new batch (`retry_of_id`) without retyping, since the staff member already confirmed those payments; still capped.
- `GET /staff/refund_batches/:id`: the batch and its items (status, code, message). Staff can read any batch.
- `REFUND_BATCH_LIMIT` is read in one place (a positive integer, default 5).

### Staff shell (SPA)

- `GET /me` adds `roles` (e.g. `["refunder"]`). The SPA `User` type gains `roles`.
- `RequireStaff` guard (any of admin, refunder, operator) under `RequireAuth`; a non-staff user sees a not-allowed page. The server is the real gate.
- `StaffLayout` (wide, `max-w-5xl` or wider): a staff nav with "Payments" for now, and a link back to the legacy admin.
- Routes under `/register/staff/*` (e.g. `/register/staff/payments`).
- Entry points: a "Staff" link in the SPA header for users with a staff role; a "Payments" item in the legacy navbar admin dropdown (an edit to the existing navbar).
- Feature folder `frontend/src/features/staff-payments/{api,components}` (Bulletproof React). Copy in `en.ts` under `staff.*` (the SPA's only string mechanism; not translated).

### Payments page

```
Race [CHIditarod 2026 ▾]  Type [Cart Deposit ▾]  Status [Paid ▾]  Search [________]
37 of 142 refunded · $1,850 of $7,100                [Select next 10] [Refund 10…]
☑ Team Name        owner@…   Cart Deposit   $50   Nov 2   Paid
☑ …
                                                   ‹ Prev  Page 1 of 11  Next ›
```

- Defaults: the newest race, all payment types, status Paid. Filters live in the URL query so a reload keeps them.
- Checkboxes on refundable rows only; once `refund_batch_limit` rows are ticked, the rest disable with a note saying why. Selection may span pages.
- "Select next N" ticks the first refundable rows on the current page up to the cap.
- "Refund N…" opens the confirmation dialog (built on `DialogSheet`/`useFocusTrap`): every payment (team, team owner, type, amount), the total, an irreversibility warning and the email note ("each team's account holder will be emailed"), and a text field that must read exactly `REFUND N`. The dialog snapshots the selection; if the selection or a refetch changes those rows while it is open, it refuses and asks to review again. The server repeats the checks above.
- After confirming: the page polls `GET /staff/refund_batches/:id` (about every 2 s) and shows each row's result (Refunded, Already refunded, Failed: message, Stalled). Failed and stalled rows get a Retry button (`POST .../retry`). When the batch finishes, the selection clears, the list and progress line refetch, and refunded rows drop out of the Paid view, so the next round starts with "Select next N".
- Works at 320 px (rows stack), like the rest of the SPA.

### Refund email

`UserMailer#payment_refunded_email` to the team's account holder (`team.user`), tracked with `kind: "refund"`, the team, and `dedupe_key: "refund-cr-<id>"`, so a retry never sends twice. It names the race, team, payment type and amount, and says refunds usually take 5-10 business days to appear. Strings in `config/locales/en.yml`. Delivered asynchronously like the other mailers.

### Racer fee card

`TeamChecklist` fee items carry `refunded`; the SPA fee card shows "Refunded" on that row. Finalization and `paid_cents` are unchanged.

### Deploy

The migration adds columns that `ChargeTeam`/`Requirement#complete` write on every payment and the new page reads. Push, migrate immediately (`dogtag-staging` first), then `heroku restart`; do production at low traffic and well before a registration opening. Set `REFUND_BATCH_LIMIT` only when moving off the default.

## Testing

- Service: stripe-ruby-mock for refunded, already refunded at Stripe, already recorded, Stripe error, lock held, mock payment in production vs development.
- Worker: `Sidekiq::Testing.inline!`, resume after a mid-batch failure, no double refund or email on rerun.
- Request specs: authorization (racer 403; refunder, operator, admin 200), filters, search across all email sources, pagination, every 422 code, query count.
- Migration spec calls the backfill method on factory data, including double- and triple-encoded metadata and legacy `refunded` rows.
- Mailer spec and dedupe.
- Legacy refund controller spec still passes, now recording `refunded_by`.
- Vitest for the page, selection cap, dialog refusal, polling and retry.
- Playwright `tests/spa/payments-admin.spec.ts` seeded by `test_seeds:payments_admin` (mock payments, a refunder user, `@example.com`), added to `test_seeds:cleanup`.

## Left to the builder

- Exact Stripe 1.58 calls and how stripe-ruby-mock supports them.
- Polling interval, page size and job retry count, within the numbers above.
- Component breakdown and naming in the feature folder, and whether a small table/checkbox primitive goes in `components/ui`.
- Index choices beyond those listed, checked with `EXPLAIN` on realistic data.
- How the backfill handles a row whose metadata cannot be decoded (skip and log is fine).
