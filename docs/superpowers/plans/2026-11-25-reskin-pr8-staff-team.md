# Reskin PR 8: Staff team view, staff Pay, Payments team_id — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Provisional — refresh against the merged PR 5 (and PRs below it) before building.** This plan was written on a branch cut from `feature/reskin-5-race-setup` while PRs 6 and 7 were planned in parallel. It depends on PR 6 and PR 7 only through spec-named routes (`/staff/users/:userId`, `/staff/emails?team_id=`). If PR 2 (#351, shared list parts) is below this branch when you build, Task 5 edits the PR 2 versions of the same two files (see Task 5).

**Goal:** Staff open the normal SPA team page and get everything they use the legacy team page for: a Staff card (team number, new-team setting, collaborating, racing with, captain contact, account holder, emails count, links), edit controls whenever the server lets staff edit, "Pay $X as staff" on an incomplete roster, and "Refund on Payments" links that open Payments filtered to the team.

**Architecture:** One new read endpoint, `GET /api/v1/staff/teams/:id`, built from the existing models, plus a `can` block computed by a new `StaffTeamPermissions` service from `Ability`, the race windows and the two existing staff rules (`Payments::ChargeTeam`'s staff payer, the legacy `team_params` new-team rule), which this PR names once and shares. The racer team payload is untouched. `PUT /api/v1/teams/:id` gains `new_team_setting` for admins and operators (it does not permit it today). `Payments::PaymentSearch` gains `team_id`. In the SPA a `useTeamPermissions(team)` hook replaces every `race.open_for_registration` gate on the team page: non-staff get exactly today's rules, staff get the server's `can`. A `StaffTeamPanel` in `features/staff-teams` renders under `TeamHeader`.

**Tech Stack:** Rails 8, jbuilder, CanCanCan, RSpec request/service specs, StripeMock; React 19 + TypeScript, react-router-dom 7, TanStack Query 5, Tailwind, Vitest + MSW; Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-reskin-design.md`, area 5 ("Staff view of the team page"), plus "Constraints", "Testing", "PR plan". Mockup: `docs/superpowers/specs/2026-11-24-reskin-mockups/team-staff-v1.html`. Roadmap: `docs/superpowers/plans/2026-11-24-reskin-roadmap.md`.

**Branch:** `feature/reskin-8-staff-team`, stacked on PR 7 (`feature/reskin-7-users-emails`). Build: Sonnet high. Review: Opus high. Registration is live while this ships: no migration, no legacy page removed.

## Global Constraints

- All new UI in the SPA; no new HAML. The legacy team page, its Refund button and its staff blocks keep working unchanged (the Refund button goes at staff cleanup). The only legacy code edit is `TeamsController#team_params` calling the shared new-team rule (same behavior).
- Controllers never reimplement payment or finalization logic. Staff Pay uses the existing `usePay` → `POST /api/v1/teams/:id/payments` → `Payments::ChargeTeam` path; the new-team setting goes through `Team#new_team_setting=` and `TeamAuditor`.
- Racer behavior is unchanged: for a non-staff viewer every gate on the team page and the racer team JSON stay exactly as today.
- Authorization through `Ability`. The staff endpoint: refunder, operator, admin (`Api::V1::Staff::BaseController`) plus `authorize!(:show, team)`. Refunders get the card and links read-only: every `can` flag false except `view_payments`.
- API errors are `{ error, errors }` through `render_errors`; strong params use `params.expect`.
- Staff copy is untranslated English through `t()` with flat `staff.team.*` keys in `frontend/src/locales/en.ts`. Racer copy changes none.
- 320px with no horizontal scroll; Chicago Flag tokens; existing `Card`, `Button`, `ButtonLink`, `Badge`, `InfoTip`, `QueryError`.
- No new npm or gem dependencies; no Gemfile, initializer, environment or `spec_helper.rb` changes; no migration.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; the PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and states whether the e2e spec was run.

## Owner decisions (2026-11-25)

- **Staff edit question answers after registration closes.** Operators and admins may save a team's answers after close. The API `QuestionsController#update` and the legacy `QuestionsController#create` both change their after-close refusal to allow them (Task 2). Racer owners are still refused after close.
- **Staff Pay stays available for a waitlisted team in a full race.** The warning says the race is full and that paying puts the team over the limit (Task 8).

## Calls made in this plan (not in the spec)

- **`PUT /api/v1/teams/:id` does not permit `new_team_setting` today** (the spec says it does; only the legacy `TeamsController#team_params` does). This PR adds it for admins and operators, through one shared rule.
- **Staff edit controls come from the server**, not from SPA role checks: the staff payload carries `can` flags computed from `Ability` plus the existing windows (people only until `final_edits_close`, per `PersonValidator`; questions while registration is open, or any time for operators and admins, per the owner decision above). So after registration closes staff can edit team details, the captain, the questions and racers (until final edits close), and remove racers.
- **Staff Pay is also offered on a closed race**, because `ChargeTeam` lets admins and operators pay after close (legacy parity; the waitlisted case is an owner decision above). Each gap gets its own warning line. When there is no gap, staff see the ordinary Pay button.
- **Staff paying for someone else's team open Stripe Checkout without an email prefill** (legacy parity; the receipt goes to the address staff type), instead of the staff member's own email.
- **Per-payment link** is `/staff/payments?team_id=<team>&payment_type=<requirement>`; the panel's Payments link is `/staff/payments?team_id=<team>`. With no `race_id`, `PaymentSearch` uses the team's race, so the race select, the type select and the chip agree. An unknown `team_id` lists nothing. Changing the race drops `team_id`, like `payment_type`.
- **Emails link shown only when `can.view_emails`** (`can?(:index, SentEmail)`: operator, admin), since refunders cannot open `/staff/emails`. The count is shown to every staff role.
- **Staff who are not the team's owner get no past-racer picker and no "Add yourself"**: `PastRacers` and "Add yourself" use the signed-in user, so they would offer the staff member's own racers.
- **The guided tour does not auto-start for staff viewers** (it would open over someone else's team); "Take the tour" still works.
- **The team-page rail stops being sticky when the Staff card is shown**, so a tall rail can always scroll.
- **The staff card refreshes whenever the racer team query updates** (any mutation or refetch), so the captain contact and the new-team label follow roster edits.

## Review Focus

1. **Racers can't pay early.** A team owner (not staff) still sees no Pay button on an incomplete roster, a closed race or a full race. A refunder sees no staff Pay. The server still answers `roster_incomplete` to an owner and 403 to a refunder. Owner: Task 8 Vitest ("racer view unchanged" cases), Task 1 spec (`take_payment` false for refunder and owner), Task 3 spec.
2. **Staff Pay uses the normal payment path.** "Pay $X as staff" sends the same `POST /teams/:id/payments` body as a racer's Pay (`requirement_id`, `stripe_token`, `expected_amount_cents` after the same price recheck). It never shows when `can.take_payment` is false, and it never shows while the staff data is still loading. Owner: Task 8 Vitest.
3. **Live racer page unharmed.** For a non-staff viewer `useTeamPermissions` returns exactly the old gates. The staff endpoint is never called for them and 403s if called. The racer `GET /api/v1/teams/:id` JSON has the same keys as before. A failing staff request leaves the page on racer rules. Owner: Task 6 Vitest table, Task 3 spec.
4. **Only admins and operators get the staff-only writes.** A racer's or refunder's `new_team_setting` leaves `new_team` and `new_team_overridden` unchanged, through both the API and the legacy form. After close, the racer owner is still refused when saving answers (API 403, legacy redirect with the error) and the answers are unchanged. Owner: Task 2 specs.
5. **`team_id` never widens a refund list.** An unknown or junk `team_id` lists no payments. `team_id` with a different `race_id` lists none. With no `race_id` the list is only that team's payments in the team's race. Owner: Task 4 spec, Task 5 Vitest.

---

### Task 1: Shared staff rules and `StaffTeamPermissions`

**Files:**
- Modify: `app/services/payments/charge_team.rb` (its private `staff?` calls the new class method)
- Create: `app/services/staff_team_permissions.rb`
- Test: `spec/services/staff_team_permissions_spec.rb`, `spec/services/payments/charge_team_spec.rb` (one example for the class method)

**Interfaces:**
- Produces:
  - `Payments::ChargeTeam.staff_payer?(user) -> Boolean`: `user.is_any_of?(:admin, :operator)`. The instance `staff?` calls it, so `payable_now?`, `waitlisted?` and `roster_incomplete?` are unchanged.
  - `StaffTeamPermissions.new_team_setter?(user) -> Boolean`: `user.is_any_of?(:admin, :operator)`.
  - `StaffTeamPermissions.questions_open?(team, user) -> Boolean`: `team.race.open_for_registration? || user.is_any_of?(:admin, :operator)` (owner decision 2026-11-25). Task 2 makes both questions controllers use it.
  - `StaffTeamPermissions.new(team, user).to_h -> Hash` (symbol keys, all booleans). `ability = Ability.new(user)`, `race = team.race`, `people_window = race.open_for_registration? || race.in_final_edits_window?`:
    - `update_team`: `ability.can?(:update, team)`
    - `set_captain`: same as `update_team` (`CaptainsController` uses `authorize_update!(team, team)`)
    - `add_racers`: `people_window && ability.can?(:create, Person) && ability.can?(:update, team)`
    - `edit_racers`: `people_window && ability.can?(:update, Person.new(team: team))`
    - `remove_racers`: `ability.can?(:update, team)` (the "team complete" guard stays in the SPA and the server)
    - `edit_questions`: `race.jsonform.present? && self.class.questions_open?(team, user) && ability.can?(:edit, team)`
    - `delete_team`: `ability.can?(:destroy, team) && team.completed_requirements.none?`
    - `take_payment`: `Payments::ChargeTeam.staff_payer?(user) && ability.can?(:edit, team)`
    - `set_new_team`: `self.class.new_team_setter?(user)`
    - `view_emails`: `ability.can?(:index, SentEmail)`
    - `view_payments`: `ability.can?(:refund, :charges)`

- [ ] **Step 1:** Write failing examples in `spec/services/staff_team_permissions_spec.rb`, each with its own race (`FactoryBot.create(:race)`, dates moved with `update_columns`):
  - **operator, registration closed, inside the final-edits window:**
    - `update_team`, `set_captain`, `add_racers`, `edit_racers`, `remove_racers`, `take_payment`, `set_new_team`, `view_emails`, `view_payments` are true;
    - `edit_questions` is true (race has jsonform).
  - **refunder or racer owner, closed race:** `edit_questions` false; `questions_open?` false.
  - **operator, after `final_edits_close`:**
    - `add_racers` and `edit_racers` are false;
    - `update_team` and `take_payment` are true.
  - **refunder, open race:** every flag false except `view_payments`.
  - **admin, finalized team with no payments:** `delete_team` true; the same team with a `completed_requirement` gives false.
  - **operator on a finalized team:** `delete_team` false (`deletable?`).
  - **owner who is not staff, open race:** `take_payment`, `set_new_team`, `view_emails`, `view_payments` are false; `update_team` is true.
  - `Payments::ChargeTeam.staff_payer?` is true for operator and admin, false for refunder and racer.
- [ ] **Step 2:** Run `bundle exec rspec spec/services/staff_team_permissions_spec.rb` — FAIL.
- [ ] **Step 3:** Implement both. Keep `ChargeTeam` behavior byte-for-byte (only `staff?` delegates).
- [ ] **Step 4:** Run the new spec, `spec/services/payments/` and `spec/requests/api/v1/payments_spec.rb` — PASS.
- [ ] **Step 5:** Commit — `Name the staff payer and new-team rules once; compute staff team permissions`

### Task 2: Staff-only writes: `new_team_setting` through `PUT /api/v1/teams/:id`, answers after close

**Files:**
- Modify:
  - `app/controllers/api/v1/teams_controller.rb` (`update`), `app/controllers/teams_controller.rb` (`team_params` uses `StaffTeamPermissions.new_team_setter?`);
  - `app/controllers/api/v1/questions_controller.rb` (`update`: `unless StaffTeamPermissions.questions_open?(@team, current_user)` replaces `unless @team.race.open_for_registration?`), `app/controllers/questions_controller.rb` (`create`: the same swap; it is the only window check there).
- Test: `spec/requests/api/v1/teams_spec.rb`, `spec/requests/api/v1/questions_spec.rb`, `spec/controllers/teams_controller_spec.rb`, `spec/controllers/questions_controller_spec.rb` (existing legacy coverage must still pass)

**Interfaces:**
- Consumes: `StaffTeamPermissions.new_team_setter?`, `StaffTeamPermissions.questions_open?`.
- Produces: `PATCH|PUT /api/v1/teams/:id` with `{ team: { new_team_setting: "auto"|"yes"|"no" } }` from an admin or operator: 200 with the usual `teams/show` body. The permitted list is `[:name, :description, :experience]` plus `:new_team_setting` only for setters. It is still `authorize!(:show)` then `authorize_update!` and `TeamAuditor`.

- [ ] **Step 1:** Write failing request examples:
  - an operator sets `"yes"` on another user's team in a **closed** race → 200, `team.reload` has `new_team: true, new_team_overridden: true`; then `"auto"` → `new_team_overridden: nil` and `new_team` equals `computed_new_team`;
  - an admin sets `"no"` → 200 and the change is stored;
  - the owner (racer, open race) sends `new_team_setting: "yes"` alone → the flag and `new_team_overridden` are unchanged. Assert the status Rails gives (expected 400: `params.expect` drops the unpermitted key and the empty hash is missing); with `name` as well → 200, name changed, flag unchanged;
  - a refunder → 403 and unchanged.
  - **answers after close** (`PUT /api/v1/teams/:team_id/questions`, race with a jsonform, registration closed):
    - the racer owner → 403 with `api.errors.registration_closed`, and `team.reload.jsonform` is unchanged;
    - an operator and an admin → 200, the answers are saved, and the response checklist has `questions.done` true;
    - a refunder → 403 (no `:edit` on the team) and unchanged.
  - **legacy** (`spec/controllers/questions_controller_spec.rb`, `POST create` after close): the owner is redirected with `questions.cannot_modify` and nothing is saved; an operator's answers are saved.
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/api/v1/teams_spec.rb spec/requests/api/v1/questions_spec.rb spec/controllers/questions_controller_spec.rb` — FAIL on the operator/admin examples.
- [ ] **Step 3:** Implement. The legacy `team_params` swaps `current_user.is_any_of?(:admin, :operator)` for the shared method, and both questions controllers use `questions_open?`.
- [ ] **Step 4:** Run those specs and `bundle exec rspec spec/controllers/teams_controller_spec.rb` — PASS.
- [ ] **Step 5:** Commit — `Let admins and operators set the new-team flag and save answers after registration closes`

### Task 3: `GET /api/v1/staff/teams/:id`

**Files:**
- Create: `app/controllers/api/v1/staff/teams_controller.rb`, `app/views/api/v1/staff/teams/show.json.jbuilder`
- Modify: `config/routes.rb` (inside `namespace :staff`: `resources :teams, only: [:show]`), `spec/requests/api/v1/query_count_spec.rb`
- Test: `spec/requests/api/v1/staff/teams_spec.rb`, `spec/requests/api/v1/teams_spec.rb` (racer payload keys)

**Interfaces:**
- Consumes: `StaffTeamPermissions`, `CompletedRequirement.payment_status_sql`, `Team#racing_with_names`, `#computed_new_team`, `#new_team_setting`, `#person_experience`.
- Produces: `GET /api/v1/staff/teams/:id`. The controller inherits `Api::V1::Staff::BaseController` (401/403 as for payments) and adds `authorize!(:show, team)`. Unknown id → 404. Body:
  ```
  { staff_team: {
      id, race_id, finalized: Boolean, team_number: Integer|null,
      new_team: Boolean|null, new_team_overridden: Boolean, new_team_setting: "auto"|"yes"|"no",
      computed_new_team: Boolean|null, years_raced: Integer,          # person_experience
      collaborating: Boolean|null, racing_with: [String],
      captain: { id, first_name, last_name, email, phone } | null, captain_inferred: Boolean,
      account_holder: { id, first_name, last_name, email, phone },
      sent_emails_count: Integer,
      payments: [{ id, requirement_id, name, amount_cents, paid_at, status }],  # status from payment_status_sql
      can: { update_team, set_captain, add_racers, edit_racers, remove_racers, edit_questions,
             delete_team, take_payment, set_new_team, view_emails, view_payments } } }
  ```
  - It loads the team with `includes(:race, :user, :captain, :buddy_teams, :people)`.
  - Payments load in one query, as `PaymentSearch` does: `team.completed_requirements.joins(:requirement).where(requirements: { type: %w[PaymentRequirement MockPaymentRequirement] }).select("completed_requirements.*", "#{CompletedRequirement.payment_status_sql} AS payment_status").preload(:requirement)`, ordered by `created_at`.

- [ ] **Step 1:** Write the failing request spec:
  - **auth:**
    - 401 logged out;
    - 403 for a racer, **including the team's own owner**;
    - 200 for refunder, operator and admin;
    - 404 for an unknown id.
  - **shape** (operator; team with 3 racers, captain set, a buddy team plus `other_buddies`, `collaborating: true`, two `SentEmail` rows with this `team_id` and one for another team, one paid and one refunded completed requirement):
    - every key above;
    - `sent_emails_count == 2`;
    - `racing_with` equals `racing_with_names`;
    - the payments' `status` values are `"paid"` and `"refunded"`;
    - `can.take_payment` true;
    - `account_holder.email` is the owner's.
  - **refunder:** `can` all false except `view_payments`.
  - **racer payload unchanged** (in `teams_spec.rb`): `GET /api/v1/teams/:id` as the owner returns team keys exactly `%w[id name description experience captain_id deletable race people checklist]`.
  - **query count:** the endpoint's count is the same for a team with 1 racer and 1 payment and a team with 5 racers and 3 payments.
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/api/v1/staff/teams_spec.rb spec/requests/api/v1/teams_spec.rb spec/requests/api/v1/query_count_spec.rb` — FAIL.
- [ ] **Step 3:** Implement the route, controller and jbuilder.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add the staff team endpoint with server-computed edit permissions`

### Task 4: `team_id` filter in `Payments::PaymentSearch`

**Files:**
- Modify: `app/services/payments/payment_search.rb`, `app/controllers/api/v1/staff/payments_controller.rb`, `app/views/api/v1/staff/payments/index.json.jbuilder` (nothing to change if `filters` is passed through whole)
- Test: `spec/services/payments/payment_search_spec.rb` (filter rules), `spec/requests/api/v1/staff/payments_spec.rb` (param pass-through, one example), `spec/requests/api/v1/query_count_spec.rb` (existing payments example still constant)

**Interfaces:**
- Produces:
  - `PaymentSearch.new(..., team_id: nil)`, parsed like `payment_type` (`Integer(..., 10, exception: false)`); a present but unparseable value counts as unknown.
  - `team`: `Team.find_by(id:)` when parsed.
  - The race: when `race_id` is absent and a team is found, the team's race (before `default_race`).
  - In `filtered`:
    - `scope.none` when `team_id` was given and no team was found;
    - else `where(team_id: team.id)`.
    - The summary uses the same filter.
  - `filters` gains `team: { id, name, race_id } | nil` (nil when absent or unknown) and `team_id: Integer|nil` (the requested id, so the SPA can say "not found").
  - The controller passes `team_id: params[:team_id]`.

- [ ] **Step 1:** Write failing examples (two teams in race A, one in race B; default race is B):
  - `team_id=<A1>` with no race_id → only A1's rows, `filters.race_id == A.id`, `filters.team.name` set, `filters.payment_types` are A's, and the summary counts only A1;
  - `team_id=<A1>&race_id=<B>` → no rows;
  - `team_id=999999` → no rows, `filters.team` nil, `filters.team_id == 999999`;
  - `team_id=abc` → no rows;
  - `team_id=<A1>&payment_type=<A deposit>` → only that row.
- [ ] **Step 2:** Run `bundle exec rspec spec/services/payments/payment_search_spec.rb spec/requests/api/v1/staff/payments_spec.rb` — FAIL.
- [ ] **Step 3:** Implement; update the class comment's filter list.
- [ ] **Step 4:** Re-run with `spec/requests/api/v1/query_count_spec.rb` and `spec/services/payments/` — PASS.
- [ ] **Step 5:** Commit — `Filter staff payments by team`

### Task 5: Team chip on the Payments page

**Files:**
- Modify: `frontend/src/features/staff-payments/types.ts`, `use-payment-filters.ts`, `components/filter-chips.tsx`, `components/payments-page.tsx` (chip removal handler), `frontend/src/locales/en.ts`
- Test: `frontend/src/features/staff-payments/use-payment-filters.test.tsx`, `components/payments-page.test.tsx`

**Interfaces:**
- Consumes: Task 4 `filters.team`, `filters.team_id`.
- Produces:
  - `PaymentFilterValues.teamId?: number` (URL `team_id`, `positiveInt`).
  - `PaymentsFilterOptions.team: { id: number; name: string; race_id: number } | null` and `team_id: number | null`.
  - `setFilter('raceId', …)` also deletes `team_id`.
  - `clearAll` drops `team_id` (it keeps only the race, and the status in Refund mode, as now).
  - `ChipKey` gains `'teamId'`, label `t('staff.payments.filters.teamChip', { name })` = "Team: {name}", or `t('staff.payments.filters.teamNotFound')` = "Team not found" when `team` is null. The team chip comes first.
  - Refund mode: a race change still clears the selection. Removing the team chip does not, because the selection spans filters.
  - **If PR 2 is below this branch:** `use-payment-filters.ts` maps keys through `NAMES` and `useUrlFilters().setParams`; add `teamId: 'team_id'` and `changes.team_id = undefined` on a race change. `filter-chips.tsx` is a wrapper over `components/list/filter-chips`; add the chip there. The behavior is the same.
- [ ] **Step 1:** Write failing tests:
  - the hook reads `?team_id=7` as `teamId: 7` and ignores `team_id=x`;
  - changing the race removes `team_id` and `payment_type`;
  - `clearAll()` removes `team_id`;
  - page (MSW): `?team_id=7` sends `team_id=7` to `/api/v1/staff/payments`;
  - page (MSW): a response with `filters.team` shows the chip "Team: Ada's Second Try", and removing it drops `team_id` from the next request;
  - page (MSW): `filters.team: null, team_id: 7` shows "Team not found".
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/staff-payments` — FAIL.
- [ ] **Step 3:** Implement; `paymentsPath` (`api/use-payments.ts`, used by `usePayments`) adds `team_id` to the query string; the query key already carries the values.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Show a removable Team chip on Payments`

### Task 6: Staff team data and `useTeamPermissions`

**Files:**
- Create: `frontend/src/features/staff-teams/types.ts`, `api/use-staff-team.ts`, `api/use-set-new-team.ts`, `frontend/src/features/teams/permissions.ts`, `frontend/src/features/teams/use-team-permissions.ts`
- Test: `frontend/src/features/teams/permissions.test.ts`, `frontend/src/features/staff-teams/api/use-staff-team.test.tsx`

**Interfaces:**
- Consumes: Task 3 JSON; `isStaff` (`features/staff/utils`); `useMe`; `teamQueryKey`.
- Produces:
  - `StaffTeam` and `StaffTeamCan` types matching Task 3.
  - `staffTeamQueryKey(id) = ['staff', 'team', String(id)]`.
  - `useStaffTeam(teamId, { enabled, teamUpdatedAt })`: `GET /staff/teams/:id`, `retry: false` on 403. An effect invalidates the staff query whenever `teamUpdatedAt` (the racer `useTeam` query's `dataUpdatedAt`) changes after the first load.
  - `useSetNewTeam(teamId)`: `PATCH /teams/:id` with `{ team: { new_team_setting } }`. On success it writes the returned team into `teamQueryKey` and invalidates `staffTeamQueryKey`.
  - `interface TeamPermissions { editTeam; addRacers; editRacers; removeRacers; setCaptain; editQuestions; deleteTeam; pastRacers; addYourself; staffPay; staffLinks; closedForRacersNote }` (booleans).
  - `racerPermissions(team: Team): TeamPermissions`: today's gates exactly.
    - `editTeam: true`, `editRacers: true`;
    - `addRacers`, `setCaptain`, `editQuestions`, `pastRacers`, `addYourself` are `race.open_for_registration`;
    - `removeRacers: open && !finalized && !completeButCaptain` (move the existing `completeButCaptain` expression from `roster-card.tsx` here);
    - `deleteTeam: team.deletable && open`;
    - `staffPay`, `staffLinks`, `closedForRacersNote` are false.
  - `staffPermissions(team, staffTeam, meId): TeamPermissions`:
    - each racer gate replaced by its `can` flag (`removeRacers` still needs `!finalized && !completeButCaptain`);
    - `pastRacers` and `addYourself` = racer rule && `staffTeam.account_holder.id === meId`;
    - `staffPay = can.take_payment`, `staffLinks = true`;
    - `closedForRacersNote = race.registration_status === 'closed' && can.update_team`.
  - `useTeamPermissions(team): { permissions: TeamPermissions; staffTeam: StaffTeam | undefined; staffQuery }`:
    - racer rules unless `isStaff(me)` and the staff query has data;
    - staff rules once it loads;
    - racer rules while it loads or after it fails.
- [ ] **Step 1:** Write failing tests:
  - a table test over open / closed / final-edits / finalized / complete-but-captain fixtures: `racerPermissions` equals the old inline gates. Name the old expressions in the test, so a reviewer can compare;
  - `staffPermissions` copies `can`;
  - a non-owner staff gets no `pastRacers` or `addYourself`;
  - the closed note appears only for `closed` with `update_team`;
  - hook (MSW): a racer `me` never requests `/staff/teams/*` and gets racer rules;
  - hook (MSW): a staff `me` gets racer rules before the response and staff rules after it;
  - hook (MSW): a 500 leaves racer rules;
  - a changed `teamUpdatedAt` refetches the staff team.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/teams src/features/staff-teams` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add staff team data and one team-page permissions hook`

### Task 7: Edit controls follow the permissions

**Files:**
- Modify:
  - `frontend/src/features/roster/components/roster-card.tsx`;
  - `frontend/src/features/questions/components/questions-card.tsx`;
  - `frontend/src/features/teams/components/delete-team.tsx`, `edit-team-basics.tsx`, `team-header.tsx`, `team-checklist.tsx`;
  - `frontend/src/locales/en.ts`.
- Test: `roster-card.test.tsx`, `questions-card.test.tsx`, `delete-team.test.tsx`, `team-checklist.test.tsx`

**Interfaces:**
- Consumes: Task 6 `useTeamPermissions`.
- Produces:
  - **`RosterCard`:**
    - `open` is replaced per use: `showActions` uses `addRacers`, `usePastRacers` is enabled by `pastRacers && hasEmptySlot`, `canAddMe` needs `addYourself`, `onMakeCaptain` uses `setCaptain`, `canEdit` uses `editRacers`, `canRemove` uses `removeRacers`;
    - `OpenSpotsItem open={addRacers}`.
  - **`QuestionsCard`:** `open` → `editQuestions`.
  - **`DeleteTeam`:** renders when `deleteTeam`.
  - **`EditTeamBasics`:** renders its Edit button only when `editTeam` (always true for racers).
  - **`TeamHeader`:** when `closedForRacersNote`, a note under the race lines: "Registration is closed. The racers can no longer change this team; you can, as staff." (`staff.team.closedNote`).
  - **`TeamChecklist`:**
    - computes `useTeamPermissions` once and passes `permissions` down; the cards take a `permissions` prop instead of each calling the hook, so one staff query serves the page;
    - no tour auto-start when `isStaff(me)`;
    - the rail wrapper drops `lg:sticky` when the Staff card is shown.
- [ ] **Step 1:** Write failing tests:
  - racer fixtures on a closed race: no Add, no Make captain, no Remove, no Delete, Questions shows "closed" (the existing assertions keep passing unchanged);
  - staff (operator `can` all true, closed race): "+ Add a racer", "Make captain", "Remove" on an incomplete unfinalized team, the questions Edit button (and the form saves through the normal PUT), Delete when `can.delete_team`, and the closed note;
  - staff non-owner: no "Pick racers from past teams" and no "Add yourself";
  - refunder (`can` all false): no Edit on team details, no Add, no Remove, no Make captain, no Delete;
  - `TeamChecklist`: a staff `me` with tour storage unset does not open the tour.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/roster src/features/questions src/features/teams` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run the whole suite (`npm --prefix frontend test -- --run`) — PASS.
- [ ] **Step 5:** Commit — `Show team-page edit controls whenever the server lets staff edit`

### Task 8: Staff Pay and "Refund on Payments" in the fee card

**Files:**
- Modify: `frontend/src/features/payments/components/fee-card.tsx`, `frontend/src/features/teams/components/checklist-slots.tsx` (pass `permissions`, `staffTeam`), `frontend/src/locales/en.ts`
- Create: `frontend/src/features/payments/staff-pay.ts` (pure gap logic)
- Test: `frontend/src/features/payments/components/fee-card.test.tsx`, `frontend/src/features/payments/staff-pay.test.ts`

**Interfaces:**
- Consumes: `permissions.staffPay`, `permissions.staffLinks`, `staffTeam.payments`, `staffTeam.account_holder.id`, `useMe`.
- Produces:
  - `staffPayGaps(team): StaffPayGap[]`, where `StaffPayGap = { kind: 'roster', filled, total } | { kind: 'closed' } | { kind: 'waitlist' }`. Roster: `racers.filled < racers.total`. Closed: `!race.open_for_registration`. Waitlist: `race.full`.
  - `FeeCard({ team, permissions, staffTeam })`:
    - **With `staffPay`:**
      - the closed and waitlist early returns are skipped;
      - "opens later", "none due" and "not available" stay;
      - `canPay` is true on every row with a price;
      - when gaps exist, one warning line per gap (with the ⚠ glyph `aria-hidden`):
        - roster: "The roster isn't full ({filled} of {total}). Racers can't pay yet; staff can take payment anyway.";
        - closed: "Registration is closed, so racers can't pay; staff can take payment anyway.";
        - waitlist: "The race is full and this team is on the waitlist. Paying as staff puts the race over its team limit." (owner decision 2026-11-25);
      - with gaps, each Pay button is `variant="secondary"` (outlined) and reads "Pay {amount} as staff";
      - without gaps, the normal button.
    - **Without `staffPay`:** today's code path, byte-for-byte the same output.
    - `handlePay` uses the same `confirmedAmount` recheck and `submit`. The Checkout `email` is `me.email`, unless staff data is present and the viewer is not `account_holder`; then it is `''` (no prefill).
    - **With `staffLinks`:**
      - each done row and each line of the finalized/paid summary gets "Refund on Payments", a `Link` to `/staff/payments?team_id={team.id}&payment_type={requirement_id}`, plus " · {date}" from the matching `staffTeam.payments` row's `paid_at`;
      - the summary branch lists each paid line for staff (racers keep the single total line).
- [ ] **Step 1:** Write failing tests:
  - **racer view unchanged:** an incomplete roster shows `fee.rosterFirst` and no Pay; a closed race shows `fee.closed`; a full race shows `fee.waitlist`; no "Refund on Payments".
  - **staff, `take_payment` true, 3 of 5, closed race:** the roster and closed warnings, one outlined "Pay $120 as staff". Clicking it (mock requirement) POSTs `/teams/:id/mock_payments` with the same body a racer's mock Pay sends.
  - **staff, Stripe requirement:** the price recheck runs (a changed price shows `fee.changed` and opens no Checkout). The POST body has `requirement_id`, `stripe_token`, `expected_amount_cents`. Checkout gets `email: ''` for a non-owner.
  - **staff, full race:** the over-the-limit warning shows above "Pay $X as staff".
  - **refunder (`take_payment` false):** no Pay on an incomplete roster, and "Refund on Payments" links are present.
  - **staff data still loading** (racer permissions): no staff Pay.
  - **a paid row's link:** the `href` ends `/staff/payments?team_id=12&payment_type=34`.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/payments` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run the whole suite — PASS.
- [ ] **Step 5:** Commit — `Let staff take payment before the roster is full, through the normal Pay path`

### Task 9: `StaffTeamPanel`

**Files:**
- Create: `frontend/src/features/staff-teams/components/staff-team-panel.tsx`, `new-team-select.tsx`
- Modify: `frontend/src/features/teams/components/team-checklist.tsx` (renders the panel in the left rail under `TeamHeader` when `isStaff(me)`), `frontend/src/locales/en.ts`
- Test: `frontend/src/features/staff-teams/components/staff-team-panel.test.tsx`

**Interfaces:**
- Consumes: `useTeamPermissions().staffTeam` / `staffQuery`, `useSetNewTeam`, `ButtonLink`, `Badge`.
- Produces: `StaffTeamPanel({ team, staffTeam, query })`, a `section` labelled "Staff" with a dark (`border-navy`) border and a "only staff see this" `Badge`.
  - **Rows:**
    - Team number: the number, or "not yet (given at finalization)".
    - New team: `NewTeamSelect` when `can.set_new_team`, else the label text.
    - Collaborating: Yes / No / "Not answered".
    - Racing with: names joined with "; ", or "None".
    - Captain: name, `mailto:` email and `tel:` phone, or "No captain yet".
    - Account holder: the name is a `Link` to `/staff/users/{id}`, plus a `mailto:` email.
  - **Links row:**
    - "Emails ({n})" → `/staff/emails?team_id={id}`, only with `can.view_emails`;
    - "Payments" → `/staff/payments?team_id={id}`;
    - "Who's registered" → `/races/{race_id}/registrations`.
  - **`NewTeamSelect`:**
    - options "Automatic (now {Yes|No|No racers yet}{: N years raced})" / "Yes" / "No", values `auto|yes|no`;
    - saves on change and is disabled while pending;
    - a `role=status` "Saved" line; a server error shows under the select and the value reverts.
  - **Phone (below `lg`):**
    - collapsed by default: a button "Staff details" (`aria-expanded`) plus a one-line summary "Captain {name} · Emails ({n}) · Payments" (Emails only with `can.view_emails`);
    - from `lg` the body always shows and the toggle is hidden.
  - **States:** while loading, a one-line "Loading staff details…"; on error, `QueryError` with retry.
  - Values that can be long (team names, emails) use `[overflow-wrap:anywhere]`.
- [ ] **Step 1:** Write failing tests:
  - operator data renders every row; the account holder link `href` is `/register/staff/users/5` (memory router with `BASENAME`, or assert the `to`);
  - changing New team to "Yes" PATCHes `{ team: { new_team_setting: 'yes' } }` and shows "Saved";
  - a 422 reverts the select and shows the error;
  - refunder data: no select (label text) and no Emails link;
  - the phone toggle starts collapsed with the summary line and expands on click.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/staff-teams` — FAIL.
- [ ] **Step 3:** Implement and mount it in `TeamChecklist`.
- [ ] **Step 4:** Run the whole suite and `npm --prefix frontend run build` — PASS.
- [ ] **Step 5:** Commit — `Add the Staff card to the team page`

### Task 10: Seeds, Playwright, docs, PR

**Files:**
- Modify: `lib/tasks/test_seeds.rake` (`staff_team_panel`; check that `cleanup` already sweeps its races, users and `@example.com` sent emails), `CLAUDE.md`
- Create: `tests/spa/staff-team-panel.spec.ts`

**Interfaces:**
- Produces: `test_seeds:staff_team_panel` (unique `TEST_UNIQUE_ID`, `@example.com` emails), writing credentials for:
  - **users:** an operator, a refunder and an owner racer;
  - **`Race StaffTeam <id> Closed`:** registration closed, inside the final-edits window (dates set with `update_columns` after the racers exist). Its team `Test Team StaffPanel <short>` has:
    - 3 of 5 racers, the first is captain;
    - `collaborating: true`, one buddy team and `other_buddies`;
    - a paid `Cart Deposit` (`MockPaymentRequirement`, `CompletedRequirement` with `charge_id`/`amount_cents`) and an unpaid `Registration` mock requirement at $120;
    - two `SentEmail` rows with this `team_id` and `@example.com` recipients.
  - **`Race StaffTeam <id> Open`:** an open race with 3 per team and a mock $50 fee. Its team `Test Team StaffPay <short>` has 2 of 3 racers.

- [ ] **Step 1:** Write the spec (it fails until the seed exists). Steps run at 1024px unless noted:
  1. **Owner, open race:** the fee card says the roster comes first, and there is no Pay button and no Staff card.
  2. **Operator, open race:**
     - the warning names "2 of 3";
     - "Pay $50 as staff" is outlined;
     - clicking it marks the fee paid;
     - a racer reload still shows the team's star state consistently.
  3. **Operator, closed race:**
     - the closed note is shown;
     - the Staff card shows the team number placeholder, Collaborating Yes, the racing-with names, the captain contact and the account holder;
     - Emails (2) links to `/register/staff/emails?team_id=…` (assert the `href` only; PR 7 owns the page);
     - setting New team to "Yes" shows "Saved" and survives a reload;
     - "+ Add a racer" adds a fourth racer;
     - Questions has Edit; changing an answer and saving shows it as saved after a reload (owner decision).
  4. **Owner, closed race:** no Add, no Make captain, no team-details Edit button, and Questions shows the closed message. Edit on a racer stays (final-edits window).
  5. **Refunder, closed race:** the Staff card has no select, no Emails link, no Pay and no edit controls. "Refund on Payments" on Cart Deposit opens Payments with the chip "Team: Test Team StaffPanel <short>" and exactly one row. Removing the chip lists the race's other payments, or none.
  6. **320px, operator, closed race:** "Staff details" is collapsed with its summary line, expands on tap, and `document.documentElement.scrollWidth <= 320`.
- [ ] **Step 2:** Add the seed. Rebuild the SPA (`npm --prefix frontend run build`), then run the spec against a separate database as in CLAUDE.md "E2E Learnings": `DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid npx playwright test tests/spa/staff-team-panel.spec.ts`. It must PASS.
- [ ] **Step 3:** Run `bin/check`, then the neighbours the same way: `tests/spa/team-captain.spec.ts`, `guided-tour.spec.ts`, `payments-admin.spec.ts`, `staff-shell.spec.ts`, `buddy-picker.spec.ts`, and `tests/e2e/registration.spec.ts` (mock mode, see the fake-keys note). All must PASS.
- [ ] **Step 4:** Add a CLAUDE.md "Registration SPA" bullet "Staff team view (reskin PR 8)" covering:
  - the staff endpoint and its `can` flags (`StaffTeamPermissions`; operators and admins may save answers after close (`questions_open?`, owner decision), racers may not; people until `final_edits_close`);
  - `useTeamPermissions` as the one place team-page gates live (racer rules unchanged);
  - staff Pay gaps and the no-prefill Checkout;
  - `new_team_setting` through the teams API (`StaffTeamPermissions.new_team_setter?`, shared with legacy);
  - `PaymentSearch` `team_id` (team's race when no `race_id`; unknown lists nothing);
  - no tour auto-start for staff;
  - the seed and spec names.
  - Also fix CLAUDE.md Known Quirk 6's "the SPA has no staff flag, so staff take payment for an incomplete team in the legacy view".
- [ ] **Step 5:** Commit — `Add staff team panel e2e spec and seed; document the staff team view`
- [ ] **Step 6:** Push and open the PR against `chiditarod/dogtag` (`gh pr create --repo chiditarod/dogtag`, base `feature/reskin-7-users-emails`). The body lists:
  - the "Calls made in this plan", especially the API now permitting `new_team_setting`;
  - the owner decisions: staff save answers after close (API and legacy), and staff Pay on a waitlisted team with the over-the-limit warning;
  - that it is money-touching, with the Review Focus;
  - whether the e2e spec was run;
  - no migrations and no Gemfile/config changes;
  - the legacy Refund button stays until staff cleanup.
