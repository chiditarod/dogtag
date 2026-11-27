# Reskin PR 5: Race setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Operators and admins list, create, edit, export and (admins) delete races in the SPA under `/register/staff/races`, with dates entered in the race's own time zone and checked before Save; the staff nav becomes role-aware.

**Architecture:** A new `Api::V1::Staff::RacesController` (plus a confirmation-preview endpoint) over the existing `Race` model, `RaceValidator`, `RaceTimeZone` concern and `Team.export`, with two small extractions shared with the legacy controller (`RaceExport`, readable validator messages) and one new parser (`RaceDateParams`) that refuses malformed and nonexistent (DST gap) wall-clock times. SPA feature folder `features/staff-races` with list, overview and one-page form; a dependency-free `lib/zoned-time.ts` converts between wall-clock strings and instants with `Intl`. Legacy race pages are untouched and keep working.

**Tech Stack:** Rails 8, jbuilder, CanCanCan, RSpec request/model specs, Zonebie; React 19 + TypeScript, react-router-dom 7, TanStack Query 5, Tailwind, Vitest + MSW; Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-reskin-design.md`, area 6 ("Race setup") and the role-aware nav bullet of area 4. Mockups: `docs/superpowers/specs/2026-11-24-reskin-mockups/race-setup-v1.html` (layout A), `race-dates-v1.html`. Roadmap: `docs/superpowers/plans/2026-11-24-reskin-roadmap.md`. The spec and mockups are in PR #355; if they are not on `main` yet, read them from `git show origin/docs/reskin-design:<path>`.

**Branch:** `feature/reskin-5-race-setup` from `upstream/main`. It does not depend on PRs 1–4. Build: Sonnet high. Review: Opus high.

## Global Constraints

- All new UI in the SPA; no new HAML. The only legacy view edit is one admin-dropdown item in `app/views/application/_navbar.html.haml`.
- Legacy race, requirement and tier pages keep working unchanged (staff use them until PR 6, and `tests/e2e/race-setup.spec.ts` drives them).
- API errors are `{ error, errors }` through `render_errors`; strong params use `params.expect`.
- Controllers never reimplement time-zone parsing (`RaceTimeZone`), export (`Team.export`) or confirmation rendering (`ConfirmationText.to_html`).
- Authorization through `Ability`: read/create/update `:update, Race` / `:create, Race` (operator, admin); `:export, Race`; `:destroy` admin only. Refunders get 403 on every endpoint here and see no Races nav item.
- Staff copy is untranslated English, still through `t()` with flat `staff.races.*` keys in `frontend/src/locales/en.ts`.
- Pages work at 320px with no horizontal scroll; staff pages render in `StaffLayout`; Chicago Flag tokens; existing `Card`, `Field`, `Input`, `Button`, `Badge`, `InfoTip`, `DialogSheet`, `QueryLoading`, `QueryError`.
- No new npm or gem dependencies; no Gemfile, initializer, environment or `spec_helper.rb` changes.
- Specs run under Zonebie: build expected times with explicit zones (`ActiveSupport::TimeZone["America/Chicago"].parse(...)`).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; the PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and states whether the e2e spec was run.

## Calls made in this plan (not in the spec)

- **Money (owner, 2026-11-25): show gross, refunded and net.** `money_gross_cents` sums every `completed_requirements.amount_cents` for the race (before refunds), `money_refunded_cents` sums those with `refunded_at` set, and `money_collected_cents` is gross minus refunded (after refunds, matching #358). The Money card shows Net as the headline ("After refunds") with "Gross $X · Refunded $Y" under it.
- **Fees on the overview are read-only in this PR**: name, "Racers can pay"/"Action required", current price, tier count, each linking to the legacy `/races/:race_id/requirements/:id/edit`, plus "Add fee" to legacy `/races/:race_id/requirements/new`. PR 6 replaces these links.
- **"Who's registered"** links to legacy `/races/:id/registrations` (a plain `<a>`). Racer cleanup redirects that URL to the SPA page, so the link keeps working.
- **Changing the time zone requires every date in the same PATCH**; otherwise 422 `errors.time_zone`. The SPA always sends all four dates when the zone changed, which keeps their wall-clock values as legacy does.
- **The JSONForm preview is interactive but never saved** (so `showWhen` can be tried); a caption says so.
- **"Email all racers (bcc)"** on the overview uses the racers on finalized teams.

## Review Focus

1. Changing the zone from Chicago to New York and saving keeps every date's wall-clock value (12:00 PM stays 12:00 PM, now Eastern), on the server and in the reloaded form. Owner: Task 5 spec, Task 12 e2e.
2. Editing only the name of a race whose stored dates carry seconds leaves every stored date byte-identical. Owner: Task 5 spec and the Task 11 Vitest test that asserts the PATCH body has no date keys.
3. A spring-forward time (`2027-03-14T02:30`, America/Chicago) is refused with a message naming the zone, in the SPA and when POSTed straight to the API. Owner: Task 3 spec, Task 7 Vitest.
4. A refunder (or a racer) gets 403 from every staff race endpoint including export, and an operator gets 403 on DELETE. Owner: Task 5 spec.
5. Deleting a race that has even one unfinalized team is refused and the race survives. Owner: Task 5 spec.

---

### Task 1: Readable race date errors, `final_edits_close` parse check

**Files:**
- Modify: `app/validators/race_validator.rb`
- Test: `spec/models/race_spec.rb` (update the examples that assert `must come before`)

**Interfaces:**
- Produces: error messages `registration_open: "must be before Registration closes"`, `registration_close: "must be before Final edits close"`, `final_edits_close: "must be before Race day"`; `final_edits_close` added to `datetimes_parse?` (`"must be a valid datetime"`).

- [ ] **Step 1:** Change the existing race_spec examples to expect the new messages, and add `"rejects an unparseable final_edits_close"`: `race.final_edits_close = "not a date"` (assign raw via `race[:final_edits_close]` if the setter casts it to nil, in which case assert the presence error instead) → `race.errors[:final_edits_close]` present.
- [ ] **Step 2:** Run `bundle exec rspec spec/models/race_spec.rb` — FAIL on the message examples.
- [ ] **Step 3:** Change the three messages and add `final_edits_close` to the `datetimes_parse?` list in `RaceValidator`.
- [ ] **Step 4:** Run `bundle exec rspec spec/models/race_spec.rb spec/controllers/races_controller_spec.rb` — PASS. Legacy flashes now read "Registration open must be before Registration closes"; that is intended.
- [ ] **Step 5:** Commit — `Say which date a race date must come before, in words`

### Task 2: `Race#setup_problems`, money totals, `RaceExport`

**Files:**
- Modify: `app/models/race.rb`, `app/controllers/races_controller.rb` (`export` calls `RaceExport`)
- Create: `app/services/race_export.rb`
- Test: `spec/models/race_spec.rb`, `spec/services/race_export_spec.rb`

**Interfaces:**
- Produces:
  - `Race#setup_problems -> Array<String>`. It reads only loaded `requirements`/`tiers` (no queries when preloaded with `Race.preload_registration_data`). Rules, in this order:
    - `"No fee set up"` when the race has no `PaymentRequirement` (mock included).
    - Per payment requirement with no tiers: `"#{name} has no price"`.
    - Per payment requirement whose earliest tier `begin_at` is after `registration_open`: `"#{name} has no price when registration opens"`.
    - `"Questions (JSONForm) don't parse"` when `jsonform` is present and `JSON.parse` raises.
  - `Race#money_totals -> { gross_cents:, refunded_cents:, net_cents: }`: one query (a single `SELECT SUM(amount_cents), SUM(amount_cents) FILTER (WHERE refunded_at IS NOT NULL)` over completed requirements of the race's teams); nil amounts count as 0; `net_cents = gross_cents - refunded_cents`.
  - `RaceExport.call(race_id, finalized: false) -> { data: String, filename: "race_#{race_id}_export.csv", type: "text/csv; charset=utf-8; header=present" }`: `CSV.generate` over `Team.export(race_id)` or `Team.export(race_id, finalized: true)`, exactly as the legacy action does today.

- [ ] **Step 1:** Write the failing examples:
  - `setup_problems`:
    - a race with no requirements → `["No fee set up"]`;
    - a `:payment_requirement` without tiers named "Registration" → includes `"Registration has no price"`;
    - a tier starting a day after `registration_open` → includes `"Registration has no price when registration opens"`;
    - `jsonform: "{"` → includes `"Questions (JSONForm) don't parse"`;
    - a ready race (`:payment_requirement_with_tier` starting before opening, valid or nil jsonform) → `[]`.
  - money: two paid completed requirements of 5000 and 3000 cents on two teams, the 3000 one with `refunded_at: Time.current` → `money_totals == { gross_cents: 8000, refunded_cents: 3000, net_cents: 5000 }`; a race with no payments → all 0.
  - `RaceExport`: with one finalized and one unfinalized team, `CSV.parse(result[:data]).size` is 3 without `finalized` and 2 with `finalized: true`; check the filename and type.
- [ ] **Step 2:** Run `bundle exec rspec spec/models/race_spec.rb spec/services/race_export_spec.rb` — FAIL.
- [ ] **Step 3:** Implement the three methods and `RaceExport`. Legacy `RacesController#export` becomes `send_data result[:data], type: result[:type], disposition: "attachment; filename=#{result[:filename]}"`. Keep its 400 for a blank `race_id`.
- [ ] **Step 4:** Run the two specs plus `spec/controllers/races_controller_spec.rb` — PASS.
- [ ] **Step 5:** Commit — `Add race setup problems, net money totals, and a shared CSV export`

### Task 3: `RaceDateParams` (wall-clock date parsing with DST-gap refusal)

**Files:**
- Create: `app/services/race_date_params.rb`
- Test: `spec/services/race_date_params_spec.rb`

**Interfaces:**
- Produces:
  - `RaceDateParams::FIELDS = %w[registration_open registration_close final_edits_close race_datetime]`.
  - `RaceDateParams.call(attrs, zone:) -> [Hash parsed, Hash errors]`. `attrs` is a string-keyed hash. `zone` is an `ActiveSupport::TimeZone`.
    - For each `FIELDS` key present in `attrs`: blank → `errors[key] = ["Enter a date and time"]`.
    - A value not matching `/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\z/` → `["must be a date and time"]`.
    - Otherwise `t = zone.parse(value)`; if `t.strftime("%Y-%m-%dT%H:%M") != value[0, 16]`, then `["doesn't exist in #{zone.tzinfo.name}: the clocks jump forward that night"]`. Else `parsed[key] = t`.
    - Non-date keys pass through untouched in `parsed`.

- [ ] **Step 1:** Write the failing examples (zone `ActiveSupport::TimeZone["America/Chicago"]`):
  - `"2026-12-07T12:00"` parses to `zone.parse("2026-12-07 12:00")`;
  - `"2026-12-07T12:00:30"` keeps the seconds;
  - `"2027-03-14T02:30"` gives the gap error and no parsed key;
  - `"2027-11-07T01:30"` (fall-back overlap) parses;
  - `"12/07/2026"` gives the format error;
  - `""` gives "Enter a date and time";
  - `name: "x"` passes through;
  - absent keys are absent from both hashes.
- [ ] **Step 2:** Run `bundle exec rspec spec/services/race_date_params_spec.rb` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Parse race dates as wall-clock times and refuse clock-change gaps`

### Task 4: Staff races API, reading (`index`, `show`)

**Files:**
- Create: `app/controllers/api/v1/staff/races_controller.rb`, `app/views/api/v1/staff/races/index.json.jbuilder`, `show.json.jbuilder`, `_staff_race.json.jbuilder`
- Modify: `config/routes.rb` (inside `namespace :staff`), `spec/requests/api/v1/query_count_spec.rb`
- Test: `spec/requests/api/v1/staff/races_spec.rb`

**Interfaces:**
- Consumes: Task 2 methods.
- Produces:
  - Routes: `resources :races, only: [:index, :show, :create, :update, :destroy] do get :export, on: :member, defaults: { format: :csv } end` and `post :confirmation_preview, to: "confirmation_previews#create"`. The export and preview actions arrive in Task 6; the routes can land now.
  - The controller inherits `Api::V1::Staff::BaseController`, with `before_action { authorize!(:update, Race) }` for `index`/`show`.
  - `GET /api/v1/staff/races` → `{ races: [StaffRaceSummary] }`, newest `race_datetime` first.
    - `StaffRaceSummary = { id, name, race_datetime, registration_open, registration_close, final_edits_close, time_zone, registration_status, teams: { finalized, total }, setup_problems }`.
    - It loads `Race.includes(:requirements)` → `Race.preload_registration_data` and one grouped `Team.where(race_id:).group(:race_id).count`.
  - `GET /api/v1/staff/races/:id` → `{ race: StaffRace }`. `StaffRace` = the summary fields plus:
    - `max_teams, people_per_team, full`
    - `jsonform` (raw text, not parsed), `filter_field` (array, from `filter_field_array`), `experience_labels_text`
    - `classy_campaign_id, classy_default_goal, confirmation_text, confirmation_text_max_length`
    - `money: { gross_cents, refunded_cents, net_cents }` (from `Race#money_totals`)
    - `teams: { finalized, total, registering }`
    - `racer_emails` (finalized teams' racers, unique, sorted)
    - `payment_requirements: [{ id, name, type, enabled, current_price_cents, tier_count }]`
    - `can_destroy` (`can?(:destroy, race)`), `has_teams`.

- [ ] **Step 1:** Write the failing request spec:
  - logged out → 401;
  - `:user` and `:refunder_user` → 403 on index and show;
  - `:operator_user` → index 200 with races ordered by `race_datetime` desc, `teams` counts right for a race with one finalized and one unfinalized team, `setup_problems` `["No fee set up"]` for a bare race;
  - show 200 with `jsonform` returned as the stored string, `money` from Task 2's fixture, `can_destroy` false for the operator and true for `:admin_user`;
  - unknown id → 404.
  - In `query_count_spec.rb` add the index (one race vs three races, each with a tiered requirement and a team: equal counts).
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/api/v1/staff/races_spec.rb spec/requests/api/v1/query_count_spec.rb` — FAIL.
- [ ] **Step 3:** Implement the routes, controller actions and views.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add staff race list and detail API`

### Task 5: Staff races API, writing (`create`, `update`, `destroy`)

**Files:**
- Modify: `app/controllers/api/v1/staff/races_controller.rb`
- Test: `spec/requests/api/v1/staff/races_spec.rb`

**Interfaces:**
- Consumes: `RaceDateParams.call`, `RaceTimeZone#use_race_time_zone`.
- Produces:
  - `POST /api/v1/staff/races` (`authorize! :create, Race`) and `PATCH /api/v1/staff/races/:id` (`authorize! :update, race`).
    - Body: `{ race: { name, time_zone, registration_open, registration_close, final_edits_close, race_datetime, max_teams, people_per_team, jsonform, filter_field: [String], experience_labels_text, classy_campaign_id, classy_default_goal, confirmation_text } }`. Dates are wall-clock strings without an offset.
    - Responses: 201/200 `{ race: StaffRace }`; 422 `render_errors(race)` with field-keyed errors (validator errors plus `RaceDateParams` errors merged into `race.errors`).
    - `filter_field` is joined with `reject(&:blank?).join(",")` as legacy `prepare_params` does; an empty array clears it.
    - A PATCH whose `time_zone` differs from the stored one and does not include all four dates → 422 `errors.time_zone: ["send every date when you change the time zone"]`, nothing saved.
  - `DELETE /api/v1/staff/races/:id` (`authorize! :destroy, race`; admin only): 422 `render_errors("Delete or move this race's teams first", code: "race_has_teams")` when `race.teams.exists?`; else 204.
  - `include RaceTimeZone` with `around_action :use_race_time_zone, only: [:create, :update]` and a private `race_time_zone` with the same rule as the legacy controller: the submitted valid zone, else the stored race's, else `Race::DEFAULT_TIME_ZONE`.

- [ ] **Step 1:** Add failing examples:
  - operator creates a race with dates `"2026-12-07T12:00"` etc. and `time_zone: "America/Chicago"` → 201 and `race.registration_open == ActiveSupport::TimeZone["America/Chicago"].parse("2026-12-07 12:00")`;
  - out-of-order dates → 422 with `errors.final_edits_close == ["must be before Race day"]`;
  - `race_datetime: "2027-03-14T02:30"` → 422 gap error, no race created;
  - PATCH only `name` on a race whose `registration_open` has 17 seconds → the stored value is unchanged (compare `registration_open_before_type_cast` or `.to_f`);
  - PATCH `time_zone: "America/New_York"` with all four dates at their Chicago wall-clock values → each stored time equals `ActiveSupport::TimeZone["America/New_York"].parse(<same wall clock>)`;
  - the same zone change with only one date → 422 `errors.time_zone`, zone unchanged;
  - `filter_field: ["racer-type", ""]` stores `"racer-type"`;
  - refunder POST/PATCH → 403;
  - operator DELETE → 403;
  - admin DELETE of a race with one unfinalized team → 422 `code == "race_has_teams"` and the race still exists;
  - admin DELETE of an empty race → 204 and gone.
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/api/v1/staff/races_spec.rb` — FAIL.
- [ ] **Step 3:** Implement. Use `params.expect(race: [..., { filter_field: [] }])`, pass the date keys through `RaceDateParams.call(attrs.to_h, zone: Time.zone)`, assign `parsed`, call `race.valid?`, add the date errors to `race.errors`, and save only if `race.errors.empty?`.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add staff race create, update and delete API`

### Task 6: Export and confirmation-preview endpoints

**Files:**
- Modify: `app/controllers/api/v1/staff/races_controller.rb` (`export`)
- Create: `app/controllers/api/v1/staff/confirmation_previews_controller.rb`
- Test: `spec/requests/api/v1/staff/races_spec.rb`, `spec/requests/api/v1/staff/confirmation_previews_spec.rb`

**Interfaces:**
- Produces:
  - `GET /api/v1/staff/races/:id/export.csv[?finalized=true]` (`authorize! :export, race`): `send_data` from `RaceExport.call(race.id, finalized: params[:finalized] == "true")`.
  - `POST /api/v1/staff/confirmation_preview` (`authorize! :update, Race`): body `{ text }` → `{ html: ConfirmationText.to_html(text) }`. If the text is longer than `Race::CONFIRMATION_TEXT_MAX_LENGTH`, 422 `errors.text`.

- [ ] **Step 1:** Write the failing examples:
  - operator export → 200, `content_type` starts `text/csv`, `Content-Disposition` includes `race_#{id}_export.csv`, and the body row count matches the Task 2 fixture with and without `finalized=true`;
  - refunder export → 403;
  - preview `"**hi**"` → `html` includes `<strong>hi</strong>`;
  - preview of `[x](javascript:alert(1))` → `html` has no `javascript:`;
  - 5001 characters → 422;
  - refunder → 403.
- [ ] **Step 2:** Run both specs — FAIL.
- [ ] **Step 3:** Implement. The CSV route sits inside the JSON-default namespace with `defaults: { format: :csv }`, so `render_errors` still returns JSON for a 403. Check that `CanCan::AccessDenied` on a `.csv` request renders JSON 403 and not a missing-template 500; if it does not, add `request.format = :json` in a `rescue_from` for that action only.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add staff race CSV export and confirmation text preview endpoints`

### Task 7: `lib/zoned-time.ts`

**Files:**
- Create: `frontend/src/lib/zoned-time.ts`, `frontend/src/lib/zoned-time.test.ts`

**Interfaces:**
- Produces (a "wall clock" is a `YYYY-MM-DDTHH:mm` string, the `datetime-local` value):
  - `toWallClock(iso: string | null, timeZone: string): string`: `''` for null.
  - `fromWallClock(wall: string, timeZone: string): string | null`: an ISO instant. Returns `null` when the wall clock does not exist in that zone. For an ambiguous fall-back time it returns the earlier instant.
  - `zoneAbbreviation(wall: string, timeZone: string): string`: e.g. `CST`/`CDT`, from `Intl.DateTimeFormat(..., { timeZoneName: 'short' })` at that instant (or at the wall clock read as UTC when it does not exist).
  - `isInPast(wall: string, timeZone: string, now?: Date): boolean`.
  - Algorithm for `fromWallClock`:
    1. Read the wall clock as UTC to get `guess`.
    2. Correct it twice by the zone's offset at that instant: `offset(t) = wall-clock-of(t in zone) − t`, using `formatToParts`.
    3. Check that `toWallClock(result) === wall`; return `null` if not.

- [ ] **Step 1:** Write the failing tests:
  - `toWallClock("2026-12-07T18:00:00Z", "America/Chicago") === "2026-12-07T12:00"`;
  - `fromWallClock("2026-12-07T12:00", "America/Chicago") === "2026-12-07T18:00:00.000Z"`;
  - `fromWallClock("2027-03-14T02:30", "America/Chicago") === null`;
  - `fromWallClock("2027-11-07T01:30", "America/Chicago") === "2027-11-07T06:30:00.000Z"`;
  - `zoneAbbreviation("2027-03-15T00:00", "America/Chicago") === "CDT"` and `"2027-02-15T00:00"` gives `"CST"`;
  - a round trip for `Europe/London` and `Pacific/Auckland`.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/lib/zoned-time.test.ts` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add wall-clock time zone helpers for race dates`

### Task 8: Role-aware staff nav and legacy navbar link

**Files:**
- Create: `frontend/src/features/staff/nav.ts`, `frontend/src/features/staff/nav.test.ts`
- Modify: `frontend/src/components/layouts/staff-layout.tsx`, `frontend/src/app/router.tsx` (the `/staff` index redirect), `frontend/src/locales/en.ts` (`'staff.nav.races': 'Races'`), `app/views/application/_navbar.html.haml`
- Test: `frontend/src/components/layouts/staff-layout.test.tsx` (extend or create), `spec/requests/staff_navbar_spec.rb`

**Interfaces:**
- Produces:
  - `type StaffNavItem = { to: string; labelKey: string; roles: string[] }`.
  - `STAFF_NAV: StaffNavItem[]` in display order: Races `/staff/races` (`admin`, `operator`), Payments `/staff/payments` (`admin`, `operator`, `refunder`). PRs 7 and 8 add Users and Emails here.
  - `staffNavItems(roles: string[]): StaffNavItem[]`.
  - `StaffLayout` renders `staffNavItems(me.roles)` as `NavLink`s, then the existing `Legacy admin` link.
  - The `/staff` index navigates to the first item's `to` (refunders land on Payments, as today).
  - Legacy navbar: an admin dropdown item `Races` → `/register/staff/races`, shown when `can?(:update, Race)`, placed before Payments.

- [ ] **Step 1:** Write the failing tests:
  - `staffNavItems(['refunder'])` gives only Payments, and `['operator']` gives Races then Payments;
  - StaffLayout with an operator `me` shows a `Races` link and with a refunder does not;
  - `staff_navbar_spec.rb`: an operator's legacy page has a link to `/register/staff/races` and a refunder's does not.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/staff src/components/layouts` and `bundle exec rspec spec/requests/staff_navbar_spec.rb` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run both, plus `npm --prefix frontend test -- --run` — PASS.
- [ ] **Step 5:** Commit — `Make the staff nav role-aware and add Races`

### Task 9: Races list page

**Files:**
- Create in `frontend/src/features/staff-races/`:
  - `api/types.ts`, `api/use-staff-races.ts`
  - `components/races-list.tsx` + test
  - `routes/staff-races-route.tsx`
- Modify: `frontend/src/app/router.tsx` (`{ path: 'races', element: <StaffRacesRoute/> }` and later siblings), `en.ts`

**Interfaces:**
- Consumes: Task 4 JSON.
- Produces:
  - TS types `StaffRaceSummary`, `StaffRace`, `RacePayload` (the request body of Task 5), field for field matching Tasks 4 and 5.
  - Hooks:
    - `useStaffRaces()` (key `['staff','races']`)
    - `useStaffRace(id)` (`['staff','races',id]`)
    - `useCreateRace()`, `useUpdateRace(id)`, `useDeleteRace(id)`: all through `apiFetch`, each invalidating `['staff','races']`.
- Page `/staff/races`:
  - heading "Races" and a "New race" button;
  - a `role=table` list (table from `sm`, cards below, `grid-cols-[minmax(0,1fr)]`);
  - columns: Race (link to `/staff/races/:id`), Race day (`formatDate` in the race zone), Registration (the status badge plus "closes {formatDeadline}" while open or "opens {date}" while not yet open), Teams ("N of max registered", "M still registering" when M > 0), Setup ("Ready" or each problem on its own line, in red text);
  - a caption under the list: 'Newest race first. "Setup" flags problems that would stop a racer paying or finishing.'

- [ ] **Step 1:** Write the failing Vitest test with an MSW handler returning two races, one with `setup_problems: ["No fee set up"]`: the rows are in API order, "No fee set up" is shown, "Ready" is shown for the other, and the race link has `href="/register/staff/races/<id>"`.
- [ ] **Step 2:** Run it — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add the staff races list`

### Task 10: Race overview page

**Files:**
- Create: `frontend/src/features/staff-races/components/race-overview.tsx` + test, `components/delete-race.tsx`, `routes/staff-race-route.tsx`
- Modify: `router.tsx` (`races/:raceId`), `en.ts`

**Interfaces:**
- Consumes: `useStaffRace`, `useDeleteRace`, `formatDate`/`formatDeadline`, the money formatter used by the payments page (move it from `features/staff-payments` to `lib/money.ts` if it lives inside the feature; update its import).
- Produces: `/staff/races/:raceId`, following the mockup's overview.
  - Header: back link "‹ Races", name, status badge, "Race day {date} · {zone}".
  - Actions: "Who's registered" (`<a href="/races/:id/registrations">`), "Start a team" (`Link` to `/races/:id/teams/new`), "Edit race".
  - Cards:
    - Teams: "finalized / max", and "N still registering" or "N on waitlist" when `full`.
    - Money collected: net as the headline, caption "After refunds", and the line "Gross $X · Refunded $Y" under it (always shown, $0 included).
    - Export (CSV): links "Registered teams" (`?finalized=true`) and "All teams" to `/api/v1/staff/races/:id/export.csv`, plus `InfoTip` 'Names are written "Secret Gentlemen, The"'.
    - Dates: four rows. Deadlines use `formatDeadline`, the others `formatDate`, all in the race zone.
    - Fees: read-only rows linking to legacy pages, plus "Add fee"; see Calls.
    - Teams and questions: racers per team, the question count from the parsed jsonform, filter fields.
    - Experience choices.
    - Fundraising and confirmation: Classy campaign and goal, "Set (N characters)" or "Not set".
    - Staff email: "Email all racers (bcc)" `mailto:dogtag@chiditarod.org?bcc=<racer_emails joined by ,>`, hidden when empty.
  - Admins (`can_destroy`) see "Delete race":
    - disabled with "This race has teams, so it can't be deleted." when `has_teams`;
    - otherwise a `DialogSheet` confirmation, and on success navigate to `/staff/races`.

- [ ] **Step 1:** Write the failing Vitest tests:
  - the deadline row shows `formatDeadline` output for a midnight `registration_close`;
  - the export links carry the right hrefs;
  - an operator payload (`can_destroy: false`) shows no Delete;
  - an admin with `has_teams: true` sees a disabled Delete with the reason;
  - an admin with no teams confirms, gets a DELETE request, and lands on the list.
- [ ] **Step 2:** Run it — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add the staff race overview with exports and delete`

### Task 11: Race date fields

**Files:**
- Create: `frontend/src/features/staff-races/components/race-dates-card.tsx` + test, `frontend/src/features/staff-races/date-checks.ts` + test

**Interfaces:**
- Consumes: `lib/zoned-time.ts`, `formatDate`, `formatDeadline`, `Race.selectable_time_zones` (served as `time_zones: string[]` on the show and a new `GET /api/v1/staff/races/new` payload; add `new` to Task 4's routes and controller with `authorize! :create, Race`. It returns `{ race: defaults, time_zones }`, where the defaults are `time_zone: "America/Chicago"`, `people_per_team: 5`, the default experience labels and empty dates. Include `time_zones` on `show` too).
- Produces:
  - `type DateField = 'registration_open' | 'registration_close' | 'final_edits_close' | 'race_datetime'`.
  - `DATE_LABELS: Record<DateField, string>`: "Registration opens", "Registration closes", "Final edits close", "Race day".
  - `checkDates(values: Record<DateField, string>, timeZone: string, now?: Date): { errors: Partial<Record<DateField, string>>; warnings: Partial<Record<DateField, string>> }`:
    - empty → "Enter a date and time";
    - `fromWallClock` null → "{h:mm AM} doesn't exist on {Mon D} in {zone}: clocks jump forward.";
    - order (first failing pair only, on the earlier field) → "Must be before {LABEL} ({formatted other value})";
    - in the past → warning "This is in the past." (for `registration_open`: "This is in the past: registration opens as soon as you save.").
  - `RaceDatesCard({ timeZone, values, initialTimeZone, onChange, onTimeZoneChange, serverErrors, timeZones })`:
    - the time zone select, with the hint "All dates below are in this zone.";
    - per field, a native `datetime-local` (`step=60`) with `zoneAbbreviation` beside it and a green line "Racers see: opens/closes/final edits until/race day {formatted}" (`formatDeadline` for the three deadlines);
    - the error or warning text and the server errors under the field;
    - for `registration_close` and `final_edits_close`, a hint when the value is midnight: 'Midnight {Mon D} = racers see "{formatDeadline}".';
    - when `timeZone !== initialTimeZone`, the note "You changed the time zone from {a} to {b}. The times above are now read in the new zone; check them before saving."
  - Checks run on blur per field and on Save for all fields.

- [ ] **Step 1:** Write the failing tests:
  - `checkDates`:
    - out of order → `errors.final_edits_close` starts "Must be before Race day";
    - the gap value → the gap message;
    - a past `registration_open` → a warning only.
  - `RaceDatesCard`:
    - renders "CDT" for a March 15 value and "CST" for a February value;
    - the "Racers see" line for closes at midnight Feb 15 reads Feb 14 11:59 PM;
    - changing the zone shows the note.
- [ ] **Step 2:** Run them — FAIL.
- [ ] **Step 3:** Implement; also the API `new` action and its request-spec example (operator 200 with `time_zones` including `"America/Chicago"`, refunder 403).
- [ ] **Step 4:** Re-run the Vitest tests and `bundle exec rspec spec/requests/api/v1/staff/races_spec.rb` — PASS.
- [ ] **Step 5:** Commit — `Add race date fields with zone labels, racer previews and order checks`

### Task 12: Race form page (new and edit)

**Files:**
- Create in `frontend/src/features/staff-races/`:
  - `components/race-form.tsx` + test
  - `components/jsonform-editor.tsx` + test
  - `components/confirmation-text-card.tsx`
  - `build-race-payload.ts` + test
  - `routes/staff-race-edit-route.tsx`, `routes/staff-race-new-route.tsx`
- Modify: `router.tsx` (`races/new`, `races/:raceId/edit`), `en.ts`

**Interfaces:**
- Consumes: Tasks 7, 9, 11; `JsonformRenderer({ jsonform, value, onChange, errors })` and `hiddenKeys` from `features/questions`; `POST /api/v1/staff/confirmation_preview`.
- Produces:
  - `buildRacePayload(initial: RaceFormValues, current: RaceFormValues, isNew: boolean): RacePayload`:
    - a new race sends everything;
    - an edit sends only changed non-date fields plus the changed date fields;
    - when `time_zone` changed it sends `time_zone` and all four dates;
    - dates go as wall-clock strings.
  - `jsonErrorLocation(text: string, error: unknown): { line: number; column: number } | null`. It reads `line N column M` from the message, else `position N` (and computes line/column from `text`), else null.
  - `JsonformEditor({ value, onChange, filterField, onFilterFieldChange, error })`:
    - a monospace textarea;
    - the parse error "Line L, column C: {message}";
    - a preview (`JsonformRenderer` with local, never-saved answers, captioned "Preview: what racers see. Answers here are not saved.") of the last text that parsed, with "Preview shows the last version that parsed." while broken;
    - "Show on Who's registered" checkboxes, one per schema key (label = property `title` or key), checked from `filterField`; keys no longer in the schema are dropped from the value.
    - Below `sm` the preview is behind a "Show preview" button.
  - `ConfirmationTextCard`: a textarea, "N / 5000" (the limit from the API), and the server preview (debounced 400 ms) rendered with `SafeHtml`.
  - `RaceForm`:
    - one page of section cards in this order: Basics (name, max teams, racers per team), Dates (`RaceDatesCard`), Questions (JSONForm), Experience choices (textarea, "One per line. These are the team-level choices; racers type their own years."), Fundraising (Classy campaign ID, default team goal in $), Confirmation text;
    - a Save bar stuck to the bottom with "Unsaved changes" when dirty, "Cancel" (back to the overview, or the list for a new race) and "Save race" / "Create race";
    - client checks block Save;
    - server 422 `errors` show under each field (`errors.jsonform` under the editor);
    - after an error the page scrolls to and focuses the first field with an error;
    - a `beforeunload` prompt while dirty;
    - success navigates to the overview.

- [ ] **Step 1:** Write the failing tests:
  - `buildRacePayload`:
    - an edit that changes only `name` → `{ name }` with no date keys;
    - a zone change → all four dates plus `time_zone`;
    - `filter_field` is sent as an array.
  - `jsonErrorLocation`: `"Unexpected token } in JSON at position 10"` on a two-line text gives the right line and column.
  - `JsonformEditor`: invalid text shows the "Line" error and keeps the previous preview; ticking a question adds its key.
  - `RaceForm` (MSW):
    - the PATCH body for a name-only edit has no dates;
    - a 422 with `errors.final_edits_close` shows the text under Final edits close;
    - Save is blocked (no request) while a date is out of order.
- [ ] **Step 2:** Run them — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run, then the whole suite with `npm --prefix frontend test -- --run` and `npm --prefix frontend run build` — PASS.
- [ ] **Step 5:** Commit — `Add the staff race form with JSONForm editor and confirmation preview`

### Task 13: Seeds, Playwright, docs

**Files:**
- Modify: `lib/tasks/test_seeds.rake` (`staff_races`; check `test_seeds:cleanup` already sweeps `Race %` races and `@example.com` users), `CLAUDE.md`, `README.md` if setup changed (it should not)
- Create: `tests/spa/staff-races.spec.ts`

**Interfaces:**
- Produces: `test_seeds:staff_races`, writing credentials for:
  - an operator, an admin and a refunder (`@example.com`, `TEST_UNIQUE_ID` in names);
  - `Race Staff <id> Busy` (open, one tiered fee, one finalized team with a payment, one unfinalized team);
  - `Race Staff <id> Empty` (no teams, no fee).

- [ ] **Step 1:** Write the spec (it fails until the seed exists). Run at 1024px unless a step says otherwise:
  1. **Refunder:** no Races link; `/register/staff/races` shows the not-allowed page.
  2. **Operator, list:** Busy and Empty appear; Empty shows "No fee set up".
  3. **Operator, new race:** fill `Race Staff <id> New` with dates in America/Chicago, including a midnight close. The "Racers see" line shows 11:59 PM of the previous day. Set the final edits after race day and see "Must be before Race day"; fix it. Type broken JSON and see "Line"; fix it. Tick one filter question. Save and land on the overview showing the dates.
  4. **Operator, edit:** switch the zone to America/New_York, see the note, save. The reloaded form shows the same wall-clock values and EST.
  5. **Operator, export:** the "All teams" export download is a CSV whose first line contains `name`.
  6. **Admin:** Delete is disabled on Busy. Deleting Empty returns to a list without it.
  7. **320px:** on the list, overview and form, `document.documentElement.scrollWidth <= 320`.
- [ ] **Step 2:** Add `test_seeds:staff_races`. Then rebuild the SPA (`npm --prefix frontend run build`) and run it against a separate database, as in CLAUDE.md "E2E Learnings": `DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid npx playwright test tests/spa/staff-races.spec.ts`. It must PASS.
- [ ] **Step 3:** Run `bin/check` — all steps pass. Also run `npx playwright test tests/spa/staff-shell.spec.ts tests/spa/payments-admin.spec.ts` the same way; the nav change must not break them.
- [ ] **Step 4:** Add a CLAUDE.md "Registration SPA" bullet covering:
  - "Staff races (reskin PR 5)": routes, the API and its roles;
  - `RaceDateParams` (wall-clock + gap refusal);
  - a zone change needs every date;
  - `zoned-time.ts`;
  - `setup_problems` rules;
  - the Money card's gross/refunded/net definitions (`Race#money_totals`);
  - fees still link to legacy until PR 6;
  - `STAFF_NAV` is the one place nav roles live;
  - the test seed and spec names.
- [ ] **Step 5:** Commit — `Add staff races e2e spec and seed; document race setup`
- [ ] **Step 6:** Push and open the PR against `chiditarod/dogtag`. The body lists:
  - the "Calls made in this plan";
  - the changed legacy validator messages;
  - the new legacy navbar item;
  - whether the e2e spec was run.
  - It notes no migrations and no Gemfile/config changes.
