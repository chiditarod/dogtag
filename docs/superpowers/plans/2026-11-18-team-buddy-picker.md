# Team Buddy Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text "race alongside other teams" answer with a picker of the race's teams (alphabetical, tagged Fully registered / Still registering, with an "Other…" free-text option), stored in tables Cartographer reads directly.

**Architecture:** A `team_buddies` join table (directional: `team_id` names `buddy_team_id`) plus `teams.other_buddies` text. A read-only `buddy_options` endpoint lists the race's other teams as `{id, name, finalized}`. Picks are read and written through the existing questions endpoint. The SPA adds a `BuddyPicker` at the top of the Questions card.

**Tech Stack:** Rails 8, RSpec + FactoryBot, React 19 + TypeScript, TanStack Query, Vitest + MSW, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-18-team-buddy-picker-design.md`

## Global Constraints

- Work only in this worktree (`../dogtag-wt/302-buddy-picker`, branch `feature/302-buddy-picker`). Use the `dogtag_test_2` database (`DATABASE_URL=postgres://postgres@localhost/dogtag_test_2`, with `RAILS_ENV=test bin/rails db:create db:schema:load` once); discard any `db/schema.rb` changes other than this migration's.
- Create the migration with `bin/rails g migration`; `text` for strings, `datetime` for times, nullable booleans. One migration for the branch.
- Prefer double quotes in Ruby; strip trailing whitespace; blank line at end of file. Strong params use `params.expect` where the key is required.
- No Gemfile, `config/initializers`, `config/environments`, `config/application.rb` or `spec/spec_helper.rb` changes. Routes are fine. If one seems needed, stop and ask.
- Other captains see only `{id, name, finalized}`. Never racers, emails, captain identity.
- Picker is optional, never affects `checklist.questions.required/done` or finalization.
- Teams listed alphabetically by name, case-insensitive; "The" is not moved. "Other…" is always the last option.
- SPA copy goes in `frontend/src/locales/en.ts` via `t()`. Works at 320px with no horizontal scroll. Legacy HAML flow must keep working.
- Tests: factories, no `double` (use `instance_double`), request specs assert status plus data changes. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A picked team is renamed: the picker shows the new name (picks reference ids). Pinned in Task 2.
2. A picked team is deleted: its pick row goes away and `GET questions` still returns 200 with it absent. Pinned in Task 1 and Task 3.
3. Crafted request with a team from another race, the team's own id, or an unknown id: 422 and nothing saved. Pinned in Task 3.
4. A race with no other teams: empty options, the picker shows an empty state, and "Other…" still works. Pinned in Task 2 and Task 5.
5. `other_buddies` that is whitespace-only, over 1000 characters, or starts with `=`: blank becomes nil, over-long is rejected, and the CSV prefixes `'` so spreadsheets don't evaluate it (the same applies to picked team names). Pinned in Task 1, Task 3 and Task 4.

---

### Task 1: Data model

**Files:**
- Create: `db/migrate/<timestamp>_create_team_buddies.rb` (via `bin/rails g migration CreateTeamBuddies`), `app/models/team_buddy.rb`, `spec/models/team_buddy_spec.rb`, `spec/factories/team_buddy.rb`
- Modify: `app/models/team.rb`, `db/schema.rb` (only this migration's lines), `spec/models/team_spec.rb`

**Interfaces:**
- Produces: table `team_buddies(team_id, buddy_team_id, timestamps)`, FKs to `teams` with `on_delete: :cascade`, unique index on `[team_id, buddy_team_id]`; column `teams.other_buddies` (text, nullable).
- Produces: `TeamBuddy` (`belongs_to :team`, `belongs_to :buddy_team, class_name: "Team"`); `Team#team_buddies`, `Team#buddy_teams` (through), `Team#other_buddies` (stripped; blank stored as nil), validation `other_buddies` length ≤ 1000. Constant `Team::OTHER_BUDDIES_MAX_LENGTH = 1000`.
- Produces: factory `:team_buddy` (two teams in the same race).

- [ ] **Step 1: Write failing specs**
  - `team_buddy_spec.rb`: `"is invalid when the teams are in different races"`, `"is invalid when a team names itself"`, `"is invalid when the same pair is added twice"` (each asserts `valid?` false and an error on the field).
  - `team_spec.rb`: `"is invalid when other_buddies is over 1000 characters"`; `"stores blank other_buddies as nil"` (`"   "` → nil); `"destroying a team removes picks it made and picks that name it"` (both `TeamBuddy` rows gone, other team still present).
- [ ] **Step 2: Run** `bundle exec rspec spec/models/team_buddy_spec.rb spec/models/team_spec.rb` — Expected: FAIL (missing table/model).
- [ ] **Step 3: Generate the migration, create the table and add `teams.other_buddies`; run it for dev and test DBs.** Add the model, associations (`has_many :team_buddies, dependent: :destroy` and `has_many :named_by_buddies, class_name: "TeamBuddy", foreign_key: :buddy_team_id, dependent: :destroy`), the validations, and a `before_validation` that strips `other_buddies` and nils blanks.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** (`git add db app spec docs`, message "Add team_buddies and teams.other_buddies").

### Task 2: `buddy_options` endpoint

**Files:**
- Create: `app/controllers/api/v1/buddy_options_controller.rb`, `app/views/api/v1/buddy_options/show.json.jbuilder` (or `render json:` if simpler), `spec/requests/api/v1/buddy_options_spec.rb`
- Modify: `config/routes.rb` (inside `resources :teams`: `resource :buddy_options, only: [:show]`), `spec/requests/api/v1/query_count_spec.rb`

**Interfaces:**
- Produces: `GET /api/v1/teams/:team_id/buddy_options` → `200 { "teams": [{ "id": Integer, "name": String, "finalized": Boolean }] }`, other teams in the same race only (not the caller's team), ordered by `LOWER(name)` then `id`. Authorization: `authorize!(:edit, team)`; 401 logged out, 403 on a team the user can't edit.

- [ ] **Step 1: Write failing request specs** (patterned on `questions_spec.rb`):
  - `"lists the other teams in the race alphabetically with finalized flags"` (create "banana", "Apple", "cherry" teams, one finalized; assert names order `Apple, banana, cherry`, keys exactly `id name finalized`, own team absent, finalized true/false).
  - `"leaves out teams from other races"`; `"returns an empty list when the race has no other teams"`; `"shows a renamed team under its new name"`; `"returns 403 on another user's team"`; `"returns 401 when logged out"`; `"allows an operator"`.
  - Add a case to `query_count_spec.rb` proving the query count does not grow with the number of teams.
- [ ] **Step 2: Run** `bundle exec rspec spec/requests/api/v1/buddy_options_spec.rb` — Expected: FAIL (routing error).
- [ ] **Step 3: Implement `Api::V1::BuddyOptionsController#show`** (inherits `Api::V1::BaseController`, `before_action :require_api_user!`; one `select(:id, :name, :finalized)` query; `finalized` is `team.finalized == true`).
- [ ] **Step 4: Run** the new spec and `spec/requests/api/v1/query_count_spec.rb` — Expected: PASS.
- [ ] **Step 5: Commit** ("Add buddy_options API").

### Task 3: Save and read picks through the questions endpoint

**Files:**
- Modify: `app/controllers/api/v1/questions_controller.rb`, `spec/requests/api/v1/questions_spec.rb`

**Interfaces:**
- Produces: `GET /api/v1/teams/:team_id/questions` also returns `buddy_team_ids: [Integer]` (ascending ids) and `other_buddies: String | nil`. `PUT` accepts optional `buddy_team_ids: [Integer]` and `other_buddies: String`. A key that is absent is left unchanged; a present key replaces the whole set (empty array clears). Duplicate ids are collapsed. The PUT response also includes both fields plus `answers` and `checklist` as today.
- Errors: ids not found, in another race, or equal to the team's own id → `422 { error: "invalid_buddies", errors: { buddy_team_ids: [String] } }` and nothing is saved (answers included). `other_buddies` over 1000 characters → `422` with `errors: { other_buddies: [String] }`.

- [ ] **Step 1: Write failing request specs** (add to `questions_spec.rb`, using the existing `valid_answers`):
  - `"GET returns picked team ids and other_buddies"`; `"GET omits a picked team after it is deleted and still returns 200"`.
  - `"PUT saves picks and other_buddies with the answers"`; `"PUT replaces the previous picks"`; `"PUT with an empty buddy_team_ids clears them"`; `"PUT without buddy keys leaves picks unchanged"`; `"PUT dedupes repeated ids"`; `"PUT stores blank other_buddies as nil"`.
  - `"PUT rejects a team from another race"`, `"PUT rejects the team's own id"`, `"PUT rejects an unknown id"` — each: 422 `invalid_buddies`, `TeamBuddy.count` unchanged, `team.reload.jsonform` unchanged.
  - `"PUT rejects other_buddies over 1000 characters"`.
- [ ] **Step 2: Run** `bundle exec rspec spec/requests/api/v1/questions_spec.rb` — Expected: new examples FAIL.
- [ ] **Step 3: Implement** in `QuestionsController`: a private `buddy_params` that returns the present buddy keys (use `params.permit(buddy_team_ids: [], ...)`; `expect` raises when absent), validate ids against `Team.where(race_id: @team.race_id).where.not(id: @team.id)`, and apply answers, `other_buddies` and the id set inside one `Team.transaction` so a failure rolls all back. Add a private `render_questions_payload`-style helper if it keeps `show` and `update` DRY.
- [ ] **Step 4: Run** the questions spec and `bundle exec rspec spec/requests/api/v1` — Expected: PASS.
- [ ] **Step 5: Commit** ("Save team picks through the questions API").

### Task 4: CSV export and admin display

**Files:**
- Modify: `app/models/team.rb` (`Team.export`, `Team.make_header`), `app/views/teams/show.html.haml`, `spec/models/team_spec.rb` (export specs), `spec/controllers/teams_controller_spec.rb` (admin show, `render_views`)

**Interfaces:**
- Produces: a final export column `racing_with` appended after `new_team` (so older column positions don't move): picked team names (the stored `name`, not `library_name`, in the same alphabetical order as the picker) then `other_buddies`, joined with `"; "`, run through `spreadsheet_safe`. Empty string when none. `Team#racing_with_names -> Array<String>` returns picked names then `other_buddies` (when present).

- [ ] **Step 1: Write failing specs:** `"export includes racing_with with picked names then other"` (header ends `new_team, racing_with`; value `"Apple; Cherry; The Other Crew"`); `"export prefixes a formula-looking other_buddies with an apostrophe"`; `"export leaves racing_with empty when nothing is picked"`; admin show spec: `"shows who the team wants to race with"` for an admin (`render_views`).
- [ ] **Step 2: Run** `bundle exec rspec spec/models/team_spec.rb spec/controllers/teams_controller_spec.rb` — Expected: new examples FAIL.
- [ ] **Step 3: Implement** `Team#racing_with_names`, extend `export`/`make_header`, add a "Racing with" line to the admin team show page (untranslated, shown only when non-empty). Avoid N+1 in `export` by including `:buddy_teams` where the race's teams are loaded.
- [ ] **Step 4: Run** the same command plus `bundle exec rspec spec/models` — Expected: PASS.
- [ ] **Step 5: Commit** ("Export and show who a team wants to race with").

### Task 5: SPA picker

**Files:**
- Create: `frontend/src/features/questions/api/use-buddy-options.ts`, `frontend/src/features/questions/components/buddy-picker.tsx`, `frontend/src/features/questions/components/buddy-picker.test.tsx`
- Modify: `frontend/src/features/questions/api/use-questions.ts`, `frontend/src/features/questions/components/questions-card.tsx`, `frontend/src/features/questions/components/questions-card.test.tsx`, `frontend/src/features/questions/types.ts`, `frontend/src/locales/en.ts`

**Interfaces:**
- Consumes: Task 2 and Task 3 API shapes.
- Produces: `interface BuddyOption { id: number; name: string; finalized: boolean }` and `interface BuddySelection { teamIds: number[]; otherSelected: boolean; otherText: string }` in `types.ts`. `useBuddyOptions(teamId): UseQueryResult<BuddyOption[]>` (query key `['team-buddy-options', String(teamId)]`). `QuestionsResponse` gains `buddy_team_ids: number[]` and `other_buddies: string | null`. `useSaveAnswers(teamId)` mutation input becomes `{ answers: Answers; buddy_team_ids: number[]; other_buddies: string }` and PUTs all three. `BuddyPicker({ options: BuddyOption[]; value: BuddySelection; onChange(value: BuddySelection): void; disabled?: boolean })`.
- Copy (add to `en.ts`): `questions.buddies.legend` "Teams you want to race with", `.hint` "Pick any teams already in this race. Names only; teams are told nothing.", `.search` "Search teams", `.registered` "Fully registered", `.inProgress` "Still registering", `.other` "Other…", `.otherLabel` "Which other teams or people?", `.empty` "No other teams yet. Use Other… to name teams that haven't signed up."

- [ ] **Step 1: Write failing tests**
  - `buddy-picker.test.tsx`: `"lists teams in the order given with a status tag each and Other… last"`; `"filters by the search box without losing selections"`; `"selecting Other… reveals the free-text field and deselecting hides it"`; `"shows the empty state when there are no teams but still offers Other…"`; `"names each checkbox with team name and status"` (accessible names, e.g. `Apple Racers, Fully registered`).
  - `questions-card.test.tsx` (extend `serve` with `buddyOptions`, `buddyTeamIds`, `otherBuddies`): `"saves picked teams and other text with the answers"` (assert the PUT body has `buddy_team_ids` and `other_buddies`); `"opens with saved picks and Other… selected when other_buddies exists"`; `"clearing Other… sends an empty other_buddies"`; `"shows an invalid_buddies server error on the picker"`; `"a picker change alone saves when all other answers are unchanged"`.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run questions` — Expected: FAIL.
- [ ] **Step 3: Implement.** `BuddyPicker` is a `fieldset`/`legend` with a search input and a scrollable list of native checkboxes (alphabetical order comes from the API; do not re-sort), a `Badge`-style status tag per row, and the last checkbox "Other…" that reveals a textarea (max 1000 via `maxLength`). Render it first inside the form in `QuestionsCard` before `JsonformRenderer`; the selection is draft state initialized from the saved values; `buildPayload` for answers stays unchanged. Use `grid-cols-[minmax(0,1fr)]` plus `[overflow-wrap:anywhere]` for long names. Escape-to-close is not needed (not a dialog).
- [ ] **Step 4: Run** `npm --prefix frontend test -- --run`, `npm --prefix frontend exec tsc -- --noEmit -p frontend` (or the repo's typecheck script) — Expected: PASS.
- [ ] **Step 5: Commit** ("Add team picker to the Questions card").

### Task 6: Form payload, docs, full check, PR

**Files:**
- Modify: `README.md` (only if it documents the questions API or export columns), `CLAUDE.md` (a "Team picker (#302)" bullet under Registration SPA covering the join table, `buddy_options`, the questions API fields, `racing_with` column, and that `buddies` stays only in fixtures/old answers)
- External: `../dogtag-private/jsonform/chiditarod_22.json`

- [ ] **Step 1: Ask the owner before touching the private repo, then remove the `buddies` property and any `form` reference to it from `chiditarod_22.json`; commit it in `../dogtag-private` (master). Do not load the payload into a race.** Leave the in-repo fixtures (`spec/fixtures/files/valid_jsonform.json`, `tests/e2e/fixtures/jsonform.json`, `frontend/src/features/questions/__fixtures__/chiditarod_21.json`) as they are: they keep exercising old answers.
- [ ] **Step 2: Update CLAUDE.md** (and README if needed) as listed above.
- [ ] **Step 3: Run** `bin/check` (rspec, frontend, build) with `DATABASE_URL` pointing at `dogtag_test_2`. Expected: every step reports success. If a Playwright SPA spec for the Questions card needs updating (`tests/spa/`), update it, and say in the PR whether it was actually run.
- [ ] **Step 4: Commit** ("Document the team picker").
- [ ] **Step 5: Push and open the PR:** `git push -u origin feature/302-buddy-picker`, then `gh pr create --repo chiditarod/dogtag --head ometa:feature/302-buddy-picker --base main`. The body lists what changed, the migration to run (staging first, then `heroku restart`), the questions API additions, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. The owner merges.
