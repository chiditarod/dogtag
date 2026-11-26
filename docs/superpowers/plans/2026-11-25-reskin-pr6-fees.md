# Reskin PR 6: Fees (requirements and tiers), staging e2e port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Refreshed against `feature/reskin-5-race-setup` at `848413a` on 2026-11-25; PR 6 is stacked on PR 5.

**Goal:** Operators and admins set up a race's fees ("requirements") and their prices by date ("tiers") in the SPA under `/register/staff/races/:raceId/requirements/...`, with prices typed in whole dollars and start times entered in the race's zone; deleting money config that racers have paid against is refused; the staging e2e stops driving any legacy page.

**Architecture:** Two new staff controllers (`Api::V1::Staff::RequirementsController`, `Api::V1::Staff::TiersController`) over the existing `PaymentRequirement`, `Tier`, `TierValidator` and `RaceTimeZone`, reusing PR 5's `RaceDateParams` (generalized to take a field list) for wall-clock `begin_at`. Delete guards live on the models (`before_destroy`), so legacy pages get them too. SPA feature folder `features/staff-fees` (fee page, "Prices by date" table, add-fee page); the date input and its checks are pulled out of PR 5's `RaceDatesCard` into a shared `components/inputs/zoned-datetime-input.tsx`, and PR 5's "Discard changes?" leave guard (`DiscardDialog` + `useBlocker` + `beforeunload` in `RaceForm`) into `components/ui/`, so two features share them without importing each other. Fee routes sit inside PR 5's `<RequireStaff roles={rolesFor('/staff/races')}>` route group. Legacy requirement and tier pages stay and keep working.

**Tech Stack:** Rails 8, jbuilder, CanCanCan, RSpec request/model specs, Zonebie; React 19 + TypeScript, react-router-dom 7, TanStack Query 5, Tailwind, Vitest + MSW; Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-reskin-design.md`, area 7 ("Requirements and tiers (staff)"), plus area 6's date-input bullet (tiers reuse it minus the order rule). Mockup: `docs/superpowers/specs/2026-11-24-reskin-mockups/fees-v1.html`. Roadmap: `docs/superpowers/plans/2026-11-24-reskin-roadmap.md`. Interface reference: `docs/superpowers/plans/2026-11-25-reskin-pr5-race-setup.md`.

**Branch:** `feature/reskin-6-fees`, stacked on `feature/reskin-5-race-setup`. It needs nothing from PR 2 (no paginated list here). Build: Sonnet high. Review: Opus high.

## Global Constraints

- All new UI in the SPA; no new HAML and no legacy view edits. Legacy requirement/tier pages keep working; they gain only the model delete guards (they now flash `destroy_failed` instead of orphaning payments).
- API errors are `{ error, errors }` through `render_errors`; strong params use `params.expect`.
- `begin_at` is parsed only through `RaceDateParams` inside `use_race_time_zone` (`RaceTimeZone`), never by hand.
- Authorization through `Ability`, unchanged: operators and admins `:index/:show/:create/:update` on `PaymentRequirement` and `Tier`; `:destroy` admin only (`can :manage, :all`). Refunders and racers get 403 on every endpoint here.
- Staff copy says "fee" (requirement) and "price" (tier); untranslated English through `t()` with flat `staff.fees.*` keys in `frontend/src/locales/en.ts`.
- Money: tiers store cents in `tiers.price`; the SPA shows and takes whole dollars (`formatMoney` from `lib/money.ts`) and sends cents.
- 320px with no horizontal scroll; `StaffLayout`; Chicago Flag tokens; existing `Card`, `Field`, `Input`, `Button`, `ButtonLink`, `Badge`, `DialogSheet`, `QueryLoading`, `QueryError`.
- No new npm or gem dependencies; no migrations; no Gemfile, initializer, environment or `spec_helper.rb` changes.
- Specs run under Zonebie: build expected times with explicit zones.
- e2e safety rules unchanged: the staging suite logs in as an operator (never admin), touches only `Race E2E ` races, and `tests/e2e/target.ts` is not edited.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; the PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and states whether each e2e spec was run.

## Owner decisions (2026-11-25)

1. **A fee is never deletable once anyone paid it, refunded or not.** "Has payments" counts refunded completed requirements too (Task 1 `Requirement#payments?`).

## Calls made in this plan (not in the spec)

- **The e2e port covers race creation, retiring and the sweep too**, not only fees: the spec says the staff cleanup cannot land while the e2e touches legacy pages, and PR 5 built the SPA race form but left `tests/e2e` driving the legacy one. `createRace`/`retireRace` drive the SPA race form, the sweep reads `GET /api/v1/staff/races`, and roles come from `GET /api/v1/me`.
- **The e2e staff login moves off the legacy page as part of the port** (controller ruling 2026-11-25): `admin-auth.setup.ts` logs in at `/register/login`, since the staff cleanup cannot land while any e2e touches a legacy page. A navigation guard fails the run on any non-`/register` page load.
- **Delete guards live on the models** (`before_destroy` + `throw :abort`), so the legacy destroy actions are protected as well. What counts as paid is owner decision 1.
- **Duplicate price and start-time messages** become readable on the server (`"is already used by another price on this fee"` for both `price` and `begin_at`); the SPA pre-checks against the loaded prices with the mockup wording ("This fee already has a $120 price.", "A price already starts at this time.").
- **Whole dollars, $1 or more, is an API rule, not a model rule**: the staff tier endpoints refuse a `price` that is not a multiple of 100 or is below 100 (`errors.price`); legacy forms and existing odd-cent tiers are untouched.
- **Type is refused, not ignored, on PATCH**: a `type` key gives 422 `errors.type`.
- **Type labels**: `PaymentRequirement` is "Card payment" and `MockPaymentRequirement` "Test payment (no card)" in the SPA (mockup wording); the API sends class names from `Requirement.allowed_types`.
- **"Teams paid" counts unrefunded payments**; its link is `/staff/payments?race_id=<race>&payment_type=<requirement id>&status=paid` (`payment_type` is the Payments filter's requirement id; `status=paid` makes the list match the count; controller ruling 2026-11-25).
- **Price statuses**: Current (the active tier), Next (the first future one), Later (further future ones), Past (earlier than Current).
- **Fee status line**: "Racers can pay" when a price is in effect now; "Racers can pay from {date}" when every price starts later; "No price: racers can't pay" with no prices.
- **Name help text** uses the mockup line; the legacy `requirements.form.name_instructions` key does not exist (legacy shows a missing-translation label), so there is no legacy text to carry over.
- Tier create/update/delete respond with the whole fee (`{ requirement, race }`) so statuses and counts refresh from one response.

## Review Focus

1. Deleting a fee with any completed requirement (refunded included) is refused through the API (422 `fee_has_payments`) and the legacy action, and the fee, its prices and its payments survive. Owner: Task 1 model spec, Task 2 request spec.
2. The only price of a paid fee cannot be deleted (422 `only_price_of_paid_fee`); the second-to-last can. Owner: Task 1 model spec, Task 3 request spec.
3. A price start `2027-02-01T00:00` on an America/Chicago race is stored as Chicago midnight, `2027-03-14T02:30` is refused, and editing only the price leaves `begin_at` byte-identical. Owner: Task 3 request spec, and the Task 7 Vitest test asserting the PATCH body has no `begin_at`.
4. An operator gets 403 on every DELETE, a refunder 403 on every endpoint, and a PATCH carrying `type` is 422 with the type unchanged. Owner: Task 2 and Task 3 request specs.
5. The staging e2e loads no legacy page: `forbidLegacyPages` fails the run on any document navigation outside `/register`, and the local `npm run e2e` run passes with it on. Owner: Task 10.

---

### Task 1: Model groundwork — date parsing for any field, readable duplicate messages, delete guards, paid counts

**Files:**
- Modify: `app/services/race_date_params.rb`, `app/validators/tier_validator.rb`, `app/models/requirement.rb`, `app/models/tier.rb`
- Test: `spec/services/race_date_params_spec.rb`, `spec/models/tier_spec.rb`, `spec/models/requirement_spec.rb` (the guard and counts live on `Requirement`; `payment_requirement_spec.rb` also exists and is untouched), `spec/controllers/requirements_controller_spec.rb`, `spec/controllers/tiers_controller_spec.rb`

**Interfaces:**
- Produces:
  - `RaceDateParams.call(attrs, zone:, fields: FIELDS)` → `[parsed, errors]`: same rules (blank → `"Enter a date and time"`; non-String, wrong shape or impossible date such as `2027-02-30` → `"must be a date and time"`; spring-forward gap → `"doesn't exist in <zone>: the clocks jump forward that night"`), applied to the keys in `fields`. Race callers (`Api::V1::Staff::RacesController#save_race`, `race_params`, `time_zone_change_error`, which read `RaceDateParams::FIELDS`) are unchanged.
  - `TierValidator` messages: `price` and `begin_at` → `"is already used by another price on this fee"`.
  - `Requirement#payments?` → `completed_requirements.exists?`.
  - `Requirement#paid_team_count` → `completed_requirements.where(refunded_at: nil).count`.
  - `Requirement#destroy_blocked_reason -> String | nil`: `"Can't delete: #{n} teams have paid it."` (n = unrefunded count, singular "1 team has") when `payments?`, or `"Can't delete: it has refunded payments."` when every payment is refunded; nil otherwise.
  - `Tier#destroy_blocked_reason -> String | nil`: `"Can't delete the only price of a fee teams have paid."` when the requirement has exactly one tier and `payments?`.
  - Both models `before_destroy` add the reason to `errors[:base]` and `throw :abort`.

- [ ] **Step 1:** Write the failing examples:
  - `RaceDateParams.call({ "begin_at" => "2027-02-01T00:00" }, zone: chicago, fields: %w[begin_at])` parses to `chicago.parse("2027-02-01 00:00")`; `"2027-03-14T02:30"` gives the gap error; `"2027-02-30T00:00"` gives `"must be a date and time"` on `begin_at`; a `registration_open` key passed with `fields: %w[begin_at]` is copied through unparsed.
  - Tier: a second tier with the same price → `errors[:price] == ["is already used by another price on this fee"]`; same `begin_at` → the same on `begin_at`.
  - Requirement: with one completed requirement, `destroy` returns false, the record and its tiers still exist, `destroy_blocked_reason` reads "1 team has paid it"; with only a refunded one (`refunded_at: Time.current`) it is still blocked with the refunded wording and `paid_team_count == 0`; without any it is destroyed.
  - Tier: the only tier of a paid requirement is not destroyed; with two tiers one is destroyed; the only tier of an unpaid requirement is destroyed.
  - Legacy controllers: an admin `DELETE` of a paid requirement (and of its only tier) leaves the row and sets the `destroy_failed` flash.
- [ ] **Step 2:** Run `bundle exec rspec spec/services/race_date_params_spec.rb spec/models spec/controllers/requirements_controller_spec.rb spec/controllers/tiers_controller_spec.rb` — FAIL.
- [ ] **Step 3:** Implement. Update any existing spec asserting `must be unique per payment requirement`.
- [ ] **Step 4:** Re-run, plus `spec/requests/api/v1/staff/races_spec.rb` (the staff race delete calls `requirement.destroy!` on each fee only after refusing a race with teams (`race_has_teams`); a race with no teams has no payments, so the guard never aborts there and tiers still go by `dependent: :delete_all`) and `spec/models/race_spec.rb` (`setup_problems`) — PASS.
- [ ] **Step 5:** Commit — `Refuse deleting fees and last prices that teams have paid; read any date field in the race zone`

### Task 2: Staff requirements API

**Files:**
- Create: `app/controllers/api/v1/staff/requirements_controller.rb`, `app/views/api/v1/staff/requirements/index.json.jbuilder`, `show.json.jbuilder`, `_fee.json.jbuilder`, `_fee_race.json.jbuilder`
- Modify: `config/routes.rb` (inside `namespace :staff`), `spec/requests/api/v1/query_count_spec.rb`
- Test: `spec/requests/api/v1/staff/requirements_spec.rb`

**Interfaces:**
- Consumes: Task 1; `RaceDateParams`; `RaceTimeZone`; `Requirement.allowed_types`.
- Produces:
  - Routes (inside `namespace :staff`, matching the spec's paths): `resources :requirements, only: [:index, :create]` nested in the existing `resources :races` block; `resources :requirements, only: [:show, :update, :destroy] do resources :tiers, only: [:create] end`; `resources :tiers, only: [:update, :destroy]` (Task 3 fills the tier actions).
  - JSON:
    - `FeeRace = { id, name, time_zone, registration_open }`.
    - `FeeTier = { id, price_cents, begin_at, status: "past"|"current"|"next"|"later", can_destroy, destroy_blocked_reason }`, chronological.
    - `Fee = { id, race_id, name, type, enabled, current_tier: { price_cents, begin_at } | null, next_tier: same | null, paid_team_count, tiers: [FeeTier], can_destroy, destroy_blocked_reason }`. `can_destroy` is `can?(:destroy, record)` (role only); the reason is separate so the SPA can show a disabled button with it.
  - `GET /api/v1/staff/races/:race_id/requirements` (`authorize! :index, PaymentRequirement`) → `{ race: FeeRace, requirements: [Fee], types: [String] }` (`types` = `Requirement.allowed_types.map(&:last)`). Payment requirements only, by id; tiers preloaded; paid counts in one grouped query.
  - `GET /api/v1/staff/requirements/:id` (`authorize! :show`) → `{ requirement: Fee, race: FeeRace }`. `PaymentRequirement.find`, so a non-payment id is 404.
  - `POST /api/v1/staff/races/:race_id/requirements` body `{ requirement: { name, type }, tier: { price, begin_at } }` (`price` in cents, `begin_at` a wall clock):
    - `type` not in `types` → 422 `errors.type: ["Choose a type"]` (checked before `Requirement.new(type:)`, which raises on an unknown class);
    - `authorize! :create` on the built record;
    - `begin_at` parsed with `RaceDateParams` (`fields: %w[begin_at]`) inside `use_race_time_zone` (zone = the race's);
    - the whole-dollar rule (see Calls) on `price` → `errors["tier.price"]`;
    - requirement errors keyed `name`/`type`, tier errors keyed `tier.price`/`tier.begin_at`;
    - both saved in one transaction → 201 `{ requirement: Fee, race: FeeRace }`.
  - `PATCH /api/v1/staff/requirements/:id` body `{ requirement: { name } }`: a `type` key → 422 `errors.type: ["can't be changed after the fee is created"]`; else 200 `{ requirement, race }` or 422.
  - `DELETE /api/v1/staff/requirements/:id` (`authorize! :destroy`; admin): blocked → 422 `render_errors(reason, code: "fee_has_payments")`; else 204.

- [ ] **Step 1:** Write the failing request spec:
  - logged out 401; `:user` and `:refunder_user` 403 on every action;
  - operator index: `types` includes `"PaymentRequirement"`, a fee with tiers $100 (past start) and $120 (future start) has `current_tier.price_cents == 10000`, `tiers` statuses `["current", "next"]`, `paid_team_count` 1 with one paid and one refunded payment;
  - operator create with `begin_at: "2026-12-07T12:00"` → 201, the tier's `begin_at == ActiveSupport::TimeZone["America/Chicago"].parse("2026-12-07 12:00")`; `price: 5050` → 422 `errors["tier.price"]`, nothing created; blank name → 422 `errors.name`, no tier created; `type: "Bogus"` → 422 `errors.type`;
  - operator PATCH name → 200; PATCH with `type` → 422, type unchanged;
  - operator DELETE → 403; admin DELETE of a paid fee → 422 `code == "fee_has_payments"`, fee exists; admin DELETE of an unpaid fee → 204 and its tiers are gone;
  - `query_count_spec.rb`: index with one fee vs three fees (each with two tiers and a payment) runs the same number of queries.
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/api/v1/staff/requirements_spec.rb spec/requests/api/v1/query_count_spec.rb` — FAIL.
- [ ] **Step 3:** Implement. Compute statuses from `active_tier` and `next_tiers.first` in the partial; `destroy_blocked_reason` in the index uses the grouped counts (pass them into the partial, or memoize per record) so it adds no per-row query.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add staff fee API with the first price set on create`

### Task 3: Staff tiers API

**Files:**
- Modify: `app/controllers/api/v1/staff/tiers_controller.rb` (create), routes from Task 2
- Test: `spec/requests/api/v1/staff/tiers_spec.rb`

**Interfaces:**
- Consumes: Task 1, Task 2's `show` view.
- Produces:
  - `POST /api/v1/staff/requirements/:requirement_id/tiers` body `{ tier: { price, begin_at } }` (`authorize! :create` on the built tier) → 201 `{ requirement: Fee, race: FeeRace }`.
  - `PATCH /api/v1/staff/tiers/:id` body `{ tier: { price?, begin_at? } }` (absent keys unchanged) → 200 same shape.
  - Errors: 422 field-keyed `price`/`begin_at` (TierValidator, the whole-dollar rule, `RaceDateParams`).
  - `DELETE /api/v1/staff/tiers/:id` (admin) → 200 `{ requirement, race }`, or 422 `render_errors(reason, code: "only_price_of_paid_fee")`.
  - `include RaceTimeZone`, `around_action :use_race_time_zone, only: [:create, :update]`, `race_time_zone` = the requirement's (or tier's requirement's) race zone, as the legacy `TiersController` reads it.
  - The whole-dollar check lives in one private helper shared with Task 2 (e.g. a `StaffFeeParams` concern under `app/controllers/concerns/`): `price` must be an Integer, `>= 100`, `% 100 == 0`, else `"Whole dollars only, $1 or more."`.

- [ ] **Step 1:** Write the failing examples:
  - operator create `{ price: 14000, begin_at: "2027-02-01T00:00" }` on a Chicago race → 201, stored at Chicago midnight, response `tiers` has three rows;
  - `begin_at: "2027-03-14T02:30"` → 422 `errors.begin_at` gap message;
  - a duplicate price → 422 `errors.price == ["is already used by another price on this fee"]`;
  - `price: 50` → 422 whole-dollar message;
  - PATCH `{ price: 15000 }` on a tier whose `begin_at` has 17 seconds → `begin_at` unchanged (compare `.to_f`);
  - refunder 403; operator DELETE 403;
  - admin DELETE of the only tier of a paid fee → 422 `code == "only_price_of_paid_fee"`; of one of two tiers → 200 with one tier left.
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/api/v1/staff/tiers_spec.rb` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run, plus Task 2's spec — PASS.
- [ ] **Step 5:** Commit — `Add staff price API with whole-dollar prices read in the race zone`

### Task 4: Shared zoned date input and leave guard (extracted from the race form)

**Files:**
- Create: `frontend/src/components/inputs/zoned-datetime-input.tsx` + test, `frontend/src/components/ui/discard-dialog.tsx`, `frontend/src/components/ui/use-leave-guard.ts`
- Modify: `frontend/src/lib/zoned-time.ts` (+ test), `frontend/src/features/staff-races/date-checks.ts`, `frontend/src/features/staff-races/components/race-dates-card.tsx`, `frontend/src/features/staff-races/components/race-form.tsx`, `frontend/src/locales/en.ts`

**Interfaces:**
- Produces:
  - In `lib/zoned-time.ts` (moved from `date-checks.ts`, which re-imports them; `wallWhen` is module-private there today and becomes exported): `wallDay(wall)` (`Mar 14`), `wallTime(wall)` (`2:30 AM`), `wallWhen(wall)` (`Sat, Mar 6, 10:00 AM`).
  - `ZonedDateTimeInput(props: InputHTMLAttributes & { value: string; timeZone: string; onValueChange(wall: string): void })`: the `datetime-local` `Input` (`step=60`, `min-w-0 flex-1`) plus the zone abbreviation span (`min-w-10 shrink-0 whitespace-nowrap`), exactly the markup `RaceDatesCard` renders today; spreads the `Field` control props (so `onBlur` still marks the field touched).
  - `wallClockProblem(wall: string, timeZone: string): string | null`: `staff.races.dates.required` when empty, `staff.races.dates.gap` when `fromWallClock` is null for a real wall clock and a non-blank zone (a blank zone gives null, as `checkDates` does today), else null. `checkDates` uses it for its first two checks.
  - `RaceDatesCard` renders `ZonedDateTimeInput`; no visible change.
  - `DiscardDialog({ body: string; onKeep(): void; onDiscard(): void })`: PR 5's `RaceForm`-local `DiscardDialog` moved as is (`DialogSheet`, title "Discard changes?", "Keep editing" `autoFocus` and the Escape/close action, "Discard changes" secondary), with the body passed in.
  - `useLeaveGuard(dirty: boolean): { blocker: Blocker; allowLeave(): void }`: PR 5's `RaceForm` logic moved as is: `useBlocker` blocks while `dirty` and not `allowLeave`d when pathname or search changes (read through refs), plus the `beforeunload` listener while `dirty`. `allowLeave()` sets the `leaving` ref; callers call it right before their own success navigation.
  - Keys: `staff.races.form.discardTitle`/`keepEditing`/`discard` become `staff.discard.title`/`staff.discard.keepEditing`/`staff.discard.discard` (same text); `staff.races.form.discardBody` stays and `RaceForm` passes it.
  - `RaceForm` uses both; no behavior change.

- [ ] **Step 1:** Write the failing tests: `ZonedDateTimeInput` shows `CDT` for `2027-03-15T00:00` and `CST` for `2027-02-15T00:00` and calls `onValueChange` with the typed value; `wallClockProblem("", tz)` and the gap value give the two messages, `wallClockProblem("2027-03-14T02:30", "")` is null; `wallWhen` formats as before.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/components/inputs src/lib/zoned-time.test.ts` — FAIL.
- [ ] **Step 3:** Implement and switch `RaceDatesCard`/`checkDates`/`RaceForm` over.
- [ ] **Step 4:** Re-run, plus `src/features/staff-races` unchanged — PASS. `race-form.test.tsx`'s `RaceForm leaving with changes` block (Cancel asks, Escape is Keep editing, Discard leaves, back link and staff nav ask, browser back asks, clean form and a save leave without asking) and the `beforeunload` test are the guard's tests and must pass unedited.
- [ ] **Step 5:** Commit — `Share the race zone date input and the leave guard so fees can use them`

### Task 5: Fee API hooks, types and price checks

**Files:**
- Create in `frontend/src/features/staff-fees/`: `api/types.ts`, `api/use-staff-fees.ts`, `price-checks.ts` + test, `test-fixtures.ts`
- Modify: `frontend/src/locales/en.ts` (`staff.fees.*`, including `staff.fees.discardBody`: "Your changes to this fee haven't been saved.")

**Interfaces:**
- Consumes: Task 2/3 JSON; Task 4.
- Produces:
  - Types `FeeRace`, `FeeTier`, `Fee`, `FeeResponse = { requirement: Fee; race: FeeRace }`, `FeesResponse = { race; requirements; types }`, `NewFeePayload = { requirement: { name; type }; tier: { price; begin_at } }`, `TierPayload = { price?: number; begin_at?: string }`.
  - `FEE_TYPE_LABELS: Record<string, string>` ("Card payment", "Test payment (no card)").
  - Hooks (keys under `['staff','fees']`; every write also invalidates `['staff','races']` (the literal key; PR 5's `staffRacesKey` is not imported across features) so the overview's fees card and `setup_problems` refresh): `useFees(raceId)`, `useFee(id)`, `useCreateFee(raceId)`, `useRenameFee(id)`, `useDeleteFee(id)`, `useAddPrice(feeId)`, `useUpdatePrice(tierId, feeId)`, `useDeletePrice(tierId, feeId)`. Price writes `setQueryData` the returned `FeeResponse`.
  - `parseDollars(text: string): number | null`: `"140"`, `"$140"`, `"140.00"`, `"1,000"` → cents; `"0.50"`, `"0"`, `""`, `"abc"` → null.
  - `checkPrice(draft: { price: string; begin: string }, others: FeeTier[], timeZone: string, now?: Date): { errors: { price?: string; begin_at?: string }; warning?: string }`: "Whole dollars only, $1 or more."; "This fee already has a $120 price."; `wallClockProblem`; "A price already starts at this time." (same instant as another tier); past start → warning "This is in the past.". `others` excludes the tier being edited.
  - `firstPriceGap(starts: (string | null)[] /* ISO */, registrationOpen: string, timeZone: string): string | null`: the client side of PR 5's `Race#setup_problems` rule "`<fee> has no price when registration opens`" (null starts are skipped, as its `filter_map` does); when the earliest start is after `registrationOpen`, "The first price starts {Mon D}, after registration opens ({Mon D}). Teams can't pay this fee from {Mon D} to {Mon D}."
  - `racersPayLine(cents, wall, timeZone)`: "Racers pay $140 from Mon, Feb 1, 2027, 12:00 AM CST" (`formatDate` + time + `zoneAbbreviation`).

- [ ] **Step 1:** Write the failing tests for `parseDollars`, `checkPrice` (each message, the edited tier ignored as its own duplicate) and `firstPriceGap` (null when it starts at or before opening).
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/staff-fees` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add staff fee hooks and price checks`

### Task 6: Fee page — header, name, "Right now", delete

**Files:**
- Create: `frontend/src/features/staff-fees/components/fee-page.tsx` + test, `components/right-now-card.tsx`, `components/delete-fee.tsx`, `routes/staff-fee-route.tsx`
- Modify: `frontend/src/app/router.tsx` (`races/:raceId/requirements/:requirementId`, added to the children of the existing `<RequireStaff roles={rolesFor('/staff/races')}>` group next to the race routes, so no new guard or roles list), `frontend/src/features/staff/components/require-staff.test.tsx`, `en.ts`

**Interfaces:**
- Consumes: `useFee`, `useRenameFee`, `useDeleteFee`, `formatMoney`, `formatDate`, Task 4 `useLeaveGuard`/`DiscardDialog`.
- Produces `/staff/races/:raceId/requirements/:requirementId` (a fee whose `race_id` differs from the URL's shows `NotFound`; a refunder sees `NotAllowed` from the route group):
  - Header: back link "‹ {race name}" to the race overview; fee name; "{type label} · {status line}" (see Calls).
  - Admins (`can_destroy`) see "Delete fee": disabled with `destroy_blocked_reason` under it, else a `DialogSheet` confirm; success navigates to the race overview.
  - Name card: `Field` "Name", help "Racers see this name on their team's fee card and receipt.", "Save name" (enabled when changed and non-blank); server `errors.name` under it.
  - "Right now" card: Price "$100 since {date, time zone}" or "No price in effect"; Next "$120 from ..." or "No later price"; Paid "N teams · see payments" (link per Calls) or "No teams yet".
  - Leave guard: the page is dirty while the name differs from the saved one or an open `PriceRowForm` (Task 7) reports changes; `useLeaveGuard(dirty)` with `DiscardDialog body={t('staff.fees.discardBody')}`. A successful delete calls `allowLeave()` before navigating.

- [ ] **Step 1:** Write the failing tests (MSW): Right now shows both prices and the paid link `href` `/register/staff/payments?race_id=7&payment_type=3&status=paid`; an operator payload shows no Delete; an admin with a reason sees a disabled Delete and the reason; an admin without one confirms, a DELETE is sent and the route changes to the overview without a "Discard changes?" dialog (also with an edited name); renaming sends `{ requirement: { name } }` only; with an unsaved name the back link opens dialog "Discard changes?" with "Your changes to this fee haven't been saved.", "Keep editing" is focused and keeps the URL and the typed name, "Discard changes" lands on the overview; after "Save name" succeeds the back link leaves without asking. In `require-staff.test.tsx`: `refunder typing a fee path sees not allowed` (`/staff/races/7/requirements/3`).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add the staff fee page with current price, paid teams and delete`

### Task 7: "Prices by date" table with inline add and edit

**Files:**
- Create: `frontend/src/features/staff-fees/components/prices-table.tsx` + test, `components/price-row-form.tsx`
- Modify: `fee-page.tsx`, `en.ts`

**Interfaces:**
- Consumes: Task 4 `ZonedDateTimeInput`, Task 5 checks and hooks, `toWallClock`.
- Produces `PricesTable({ fee, race })`:
  - Caption "A team pays the price in effect when it pays, not when it registered."; footer "Changing a price only affects teams that haven't paid yet."
  - `role=table` from `sm` (Price, Starts, Status, actions), cards below `sm` (price, status badge, "from {start}", actions), `grid-cols-[minmax(0,1fr)]`.
  - Status badges Current/Next/Later/Past.
  - "Edit" turns a row into `PriceRowForm` (only one row or the add form open at a time); "+ Add a price" opens an empty one prefilled with nothing.
  - `PriceRowForm({ initial?, others, race, onSave, onCancel, onDirtyChange })`: reports to the fee page's leave guard (Task 6) whether its dollars or wall clock differ from `initial` (an empty add form is clean); "$" dollars input (`inputMode="numeric"`) and `ZonedDateTimeInput` with the race zone; under them `checkPrice` errors (on blur and on Save), server errors per field, the `racersPayLine` when valid, and the `firstPriceGap` warning computed over the prices as they would be after the save. Buttons "Cancel" and "Add price" / "Save price". It sends `price` only if the dollars changed and `begin_at` only if the wall clock changed.
  - Admins see "Delete" per row: disabled with `destroy_blocked_reason`, else a `DialogSheet` confirm.

- [ ] **Step 1:** Write the failing tests: `$0.50` blocks Save with "Whole dollars only"; a duplicate `$120` shows "This fee already has a $120 price." without a request; adding `$140` at `2027-02-01T00:00` POSTs `{ tier: { price: 14000, begin_at: "2027-02-01T00:00" } }`; editing only the price PATCHes a body with no `begin_at`; a server 422 `errors.begin_at` shows under Starts; the first-price warning appears when the only start is after `registration_open` and does not block Save; operators see no Delete; an add form with `140` typed makes the back link ask "Discard changes?", an opened but untouched add form does not, and a saved price leaves the page clean.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add inline price editing to the staff fee page`

### Task 8: "Add a fee" page

**Files:**
- Create: `frontend/src/features/staff-fees/components/new-fee-form.tsx` + test, `routes/staff-fee-new-route.tsx`
- Modify: `router.tsx` (`races/:raceId/requirements/new`, placed before `:requirementId` in the same `RequireStaff roles={rolesFor('/staff/races')}` group), `en.ts`

**Interfaces:**
- Consumes: `useFees(raceId)` (race context and `types`), `useCreateFee`, Task 4/5 (including `useLeaveGuard`/`DiscardDialog` with `staff.fees.discardBody`).
- Produces `/staff/races/:raceId/requirements/new`:
  - Fields: Name (help as Task 6), Type (`select` of `types` with `FEE_TYPE_LABELS`, default `PaymentRequirement`; when `MockPaymentRequirement` is offered, the help "\"Test payment (no card)\" is offered on staging and local only."), First price ($), Starts (`ZonedDateTimeInput`, prefilled with `toWallClock(race.registration_open, race.time_zone)`), the `racersPayLine`, and "Prefilled with registration opening. You can add more prices after saving."
  - "Add fee" runs the same `checkPrice` (no others) and name check, POSTs `NewFeePayload`, shows server errors under their fields (`tier.price` under First price, `tier.begin_at` under Starts), and on 201 calls `allowLeave()` then navigates to the new fee page.
  - Leave guard: dirty when any field differs from its initial value (the prefilled Starts and the default type count as initial).

- [ ] **Step 1:** Write the failing tests: Starts is prefilled from `registration_open` in the race zone; the POST body is `{ requirement: { name: "Cart Deposit", type: "PaymentRequirement" }, tier: { price: 5000, begin_at: "2026-12-07T12:00" } }`; a 422 `errors["tier.price"]` shows under First price; success lands on `/staff/races/7/requirements/<id>` without a "Discard changes?" dialog; with a typed name the back link asks "Discard changes?" and "Keep editing" stays; the untouched form leaves without asking; a refunder at `/staff/races/7/requirements/new` sees not allowed.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run, then `npm --prefix frontend test -- --run` and `npm --prefix frontend run build` — PASS.
- [ ] **Step 5:** Commit — `Add the staff add-a-fee page with its first price`

### Task 9: Race overview fees card points at the SPA

**Files:**
- Modify: `frontend/src/features/staff-races/components/race-overview.tsx` (+ test), `en.ts` (`staff.race.tiers_one/_other` → `{n} price` / `{n} prices`)

**Interfaces:**
- Produces: `FeeRow` (today a plain `<a href="/races/:raceId/requirements/:id/edit">`) is a router `Link` to `/staff/races/:raceId/requirements/:id`; `FeesCard`'s "Add fee" (today `<a href="/races/:id/requirements/new">`) is a `Link` to `/staff/races/:raceId/requirements/new`. Nothing on the overview links to `/races/:id/requirements` any more. `StaffRacePaymentRequirement` (`enabled`, `current_price_cents`, `tier_count`) is unchanged.

- [ ] **Step 1:** Change the overview test to expect the SPA hrefs (`/register/staff/races/7/requirements/3`, `/register/staff/races/7/requirements/new`) and "2 prices" — FAIL.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/staff-races` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Link the race overview's fees to the new fee pages`

### Task 10: Port the staging e2e off legacy pages

**Files:**
- Modify: `tests/e2e/admin-forms.ts`, `tests/e2e/race-setup.spec.ts`, `tests/e2e/race-teardown.ts`, `tests/e2e/admin-auth.setup.ts`, `tests/e2e/admin-forms.unit.spec.ts`, `tests/README.md` (the race-setup description)

**Interfaces:**
- Produces (in `admin-forms.ts`; the module comment is rewritten for the SPA):
  - `wallClockInput(at: Date, timeZone: string): string` → `YYYY-MM-DDTHH:mm` in the zone (built on the existing `wallClock`; `fillDateTimeSelect` is removed).
  - `forbidLegacyPages(page: Page): void`: on every main-frame `framenavigated`, a URL whose path does not start with `/register` (`about:blank` allowed) fails the test with the URL. API calls through `page.request` are not navigations and stay allowed.
  - `loggedInRoles(page) -> string[]`: `GET /api/v1/me` → `user.roles` (lowercase, e.g. `"operator"`). Callers check `operator` present, `admin` absent.
  - `createRace(page, input) -> { id }`: `/register/staff/races/new`; fills by label (Name, Max teams, Racers per team, Time zone first, the four date labels "Registration opens", "Registration closes", "Final edits close", "Race day" (PR 5's `DATE_LABELS` text, written out since `tests/` does not import `frontend/src`) via `wallClockInput`, Questions JSON, Team experience choices, Campaign ID, Default team goal ($)); clicks "Create race"; waits for `/register/staff/races/(\d+)$`; throws with the page's field errors if it stays on the form (e.g. the model's "must be before Registration closes"). Helpers never navigate away from an unsaved race form, since PR 5's "Discard changes?" dialog would block it; a successful save navigates without asking.
  - `retireRace(page, raceId)`: `/register/staff/races/:id/edit`; refuses a name without `E2E_RACE_PREFIX` (unchanged rule); appends `RETIRED_SUFFIX`; reads the zone from the Time zone select; fills the four past dates; "Save race"; waits for the overview URL.
  - `currentE2ERaceIds`/`sweepLeftoverRaces`: read `GET /api/v1/staff/races` with the session (`page.request`), keep names passing `isSweepable`; retire through `retireRace`.
  - `requirementTypeLabel(type) -> 'Card payment' | 'Test payment (no card)'`.
  - `addFee(page, raceId, { name, typeLabel, priceDollars, beginAt }, timeZone) -> { id }`: `/register/staff/races/:raceId/requirements/new`, fills Name, Type, First price, Starts; "Add fee"; id from the URL.
  - `addPrice(page, raceId, feeId, { priceDollars, beginAt }, timeZone)`: on the fee page, "+ Add a price", fill, "Add price", wait for the new row's price in the Prices by date table.
  - `admin-auth.setup.ts`: `/register/login`, `fillSecret` on "Email" and "Password", "Log in", wait for the logged-in user menu, then the role check above.
  - `race-setup.spec.ts`: both tests call `forbidLegacyPages(page)` first; test A creates the race, `addFee` Cart Deposit ($88 from opening), `addFee` Race Registration ($130 from opening) and `addPrice` $150 a week out; the `/api/v1/races` assertions are unchanged; the final check opens `/register/staff/races/:id` and sees both fee names in the Fees card. `race-teardown.ts` calls the new `retireRace` (with `forbidLegacyPages`).

- [ ] **Step 1:** Add the failing unit tests to `admin-forms.unit.spec.ts`: `wallClockInput(new Date("2026-12-07T18:00:30Z"), "America/Chicago") === "2026-12-07T12:00"`; `requirementTypeLabel("MockPaymentRequirement") === "Test payment (no card)"`.
- [ ] **Step 2:** Run `npx playwright test --project=unit` — FAIL.
- [ ] **Step 3:** Implement the port.
- [ ] **Step 4:** Run `--project=unit` — PASS. Then rebuild the SPA and run the local mock target against a separate database (CLAUDE.md "E2E Learnings"): `DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid STRIPE_PUBLISHABLE_KEY=pk_test_localfake STRIPE_SECRET_KEY=sk_test_localfake npm run e2e` (the local target logs in as `test+operator@example.com`, see `tests/e2e/target.ts`). It must PASS, including registration (it reads the race these helpers made). `grep -n "goto('/\(races\|tiers\|users\|user_session\)" tests/e2e` returns nothing.
- [ ] **Step 5:** Commit — `Drive the staging race setup e2e through the SPA staff pages`

Staging (`npm run e2e:staging`) runs only after this PR is deployed to `dogtag-staging`; the PR states whether it was run.

### Task 11: Seed, Playwright spec, docs, PR

**Files:**
- Modify: `lib/tasks/test_seeds.rake` (`staff_requirements`; `cleanup` already sweeps `Race %` races, their completed requirements and `@example.com` users, so check only), `CLAUDE.md`, `README.md` if setup changed (it should not)
- Create: `tests/spa/staff-requirements.spec.ts`

**Interfaces:**
- Produces `test_seeds:staff_requirements` (`TEST_UNIQUE_ID`), printing credentials as other seeds do:
  - an operator, an admin and a refunder (`@example.com`);
  - `Race Fees <id>`, open, America/Chicago, with "Registration Fee" ($100 from a day before opening, $120 from two weeks out) and one finalized `Test Team Fees <id>` that paid it (`CompletedRequirement.create!` with `charge_id: "mock_ch_..."`, `amount_cents: 10000`, as `payments_admin` does);
  - "Cart Deposit" on the same race, one price, no payments.

- [ ] **Step 1:** Write the spec (fails until the seed exists), at 1024px unless noted:
  1. **Refunder:** the fee page URL and the add-fee URL show the not-allowed page (PR 5's `rolesFor('/staff/races')` group).
  2. **Operator, overview:** the Fees card links to the Registration Fee page; Right now shows $100 and $120 and "1 team"; "see payments" opens Payments with the fee selected and status Paid; no Delete buttons.
  3. **Operator, prices:** "+ Add a price" with `0.50` shows "Whole dollars only"; `120` shows the duplicate message; `140` with a date a month out adds a row marked Later; Edit it to `150` and see it saved with the same start.
  4. **Operator, add a fee:** "Add fee" from the overview; Starts is prefilled; name `Late Fee`, `$25`; lands on its page with "Card payment" (or the mock label locally) shown read-only.
  5. **Admin:** Delete fee on Registration Fee is disabled with "1 team has paid it"; delete Cart Deposit and return to the overview without it.
  6. **320px:** on the fee page (with the add form open) and the add-fee page, `document.documentElement.scrollWidth <= 320`.
- [ ] **Step 2:** Add the seed. Rebuild the SPA and run `DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid npx playwright test tests/spa/staff-requirements.spec.ts` — PASS. Also run `tests/spa/staff-races.spec.ts` (PR 5's, seeded by `test_seeds:staff_races`; its Busy race's fee row now links into the SPA) and `tests/spa/payments-admin.spec.ts` the same way.
- [ ] **Step 3:** Run `bin/check` — all steps pass.
- [ ] **Step 4:** CLAUDE.md:
  - a "Staff fees (reskin PR 6)" bullet in "Registration SPA": routes (inside the `rolesFor('/staff/races')` group), API and roles, the JSON shapes' key points, whole dollars sent as cents, type fixed after create, the two delete guards on the models (refunded payments count), statuses, the Payments link, `ZonedDateTimeInput`, the shared `DiscardDialog`/`useLeaveGuard` in `components/ui/` (moved out of `RaceForm`; the fee page and add-fee page use them), the seed and spec;
  - in "E2E Learnings": the staging suite now drives `/register/staff/*` and logs in at `/register/login`, `forbidLegacyPages`, roles from `/api/v1/me`; drop the now-wrong lines about the legacy new-requirement form and the legacy login labels, keeping the facts that still hold (operators can create requirements; `Requirement.allowed_types` gates the mock type);
  - in the "Staff races (reskin PR 5)" bullet, the sentence "Fees on the overview still link to the legacy requirement pages (`/races/:id/requirements/...`) until PR 6 moves them into the SPA" becomes "Fees on the overview link to the SPA fee pages", and "`RaceForm` asks before ... (`useBlocker`, `DiscardDialog` ...)" names the shared `useLeaveGuard`.
- [ ] **Step 5:** Commit — `Add staff fees e2e spec and seed; document fees and the e2e port`
- [ ] **Step 6:** Push and open the PR against `chiditarod/dogtag`, based on the PR 5 branch. The body lists the "Calls made in this plan", the changed legacy messages (TierValidator wording, legacy deletes now refused when paid), that it has no migrations and no Gemfile/config changes, and whether `tests/spa/staff-requirements.spec.ts`, local `npm run e2e` and `npm run e2e:staging` were run.
