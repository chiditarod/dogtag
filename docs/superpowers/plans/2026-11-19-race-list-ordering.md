# Race List Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Order the `/register` race list so open races come first, then registration-over races, then not-yet-open races, with one server-side definition of each race's status, and show a logged-in racer's own teams (status chips) on each race tile.

**Architecture:** `Race#registration_status` and `Race#registration_sort_key` define the groups. `Api::V1::RacesController#index` sorts the preloaded races in Ruby with `sort_by(&:registration_sort_key)` (no extra queries). The race JSON exposes `registration_status`, and the SPA badge reads it instead of working status out from `open_for_registration`, `full` and the browser clock.

**Tech Stack:** Rails 8, RSpec, FactoryBot, Timecop, Vite + React 19 + TypeScript, Vitest + MSW, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-19-race-list-ordering-design.md`

## Global Constraints

- Group order: open, waitlist, closed (registration over, race date ahead), not_yet_open. Within a group: soonest `race_datetime`; `not_yet_open` sorts by soonest `registration_open`. Ties break on `id`.
- `registration_status` values are exactly `open | waitlist | closed | not_yet_open`.
- No section headings, no dimming, no change to existing card copy. The only new copy is `races.yourTeams` ("Your teams") and `races.startAnother` ("Start another team") in `frontend/src/locales/en.ts`.
- Teams never affect the sort order. The teams list needs no backend change: it reuses `GET /api/v1/teams` through `useTeams`, only when `useMe` has a user.
- Team chip wording is exactly `N things left` (amber) or `Finalized #N` (green), the same as My teams, via a shared `teamStatus` helper.
- Keep `Race.current` and the existing `open_for_registration` / `full` JSON booleans unchanged. The legacy HAML race list and `/races/:id` ordering are untouched.
- Sort in Ruby after `Race.preload_registration_data`; `spec/requests/api/v1/query_count_spec.rb` must stay green.
- `_race.json.jbuilder` is shared with `/teams` payloads, so the new field appears there too.
- No Gemfile, `config/initializers`, `config/environments`, `config/application.rb` or `spec/spec_helper.rb` changes.
- Ruby style: double quotes, no trailing whitespace, blank line at end of file. Specs run under Zonebie: build dates relative to `Time.zone.now`.
- Branch: `feature/race-list-ordering` (already created from `main`). Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A race exactly at `registration_close` still counts as open (`open_for_registration?` uses `now > registration_close`): pinned in Task 1.
- A full race whose registration is over is `closed`, not `waitlist`: pinned in Task 1.
- Two races with the same `race_datetime` keep a stable order by `id`: pinned in Task 2.
- A not-yet-open race that opens sooner but races later sorts above one that opens later but races sooner: pinned in Task 2.
- `/teams` payloads carry `registration_status` and stay correct: pinned in Task 2.
- The teams request failing or still loading must not break or block the race list: pinned in Task 4.
- A team in a closed race is still reachable, and a team in another race never appears on this tile: pinned in Task 4.

## File Structure

- Modify `app/models/race.rb`: `registration_status`, `registration_sort_key`.
- Modify `app/controllers/api/v1/races_controller.rb`: sort in `index`.
- Modify `app/views/api/v1/races/_race.json.jbuilder`: add the field.
- Modify `spec/models/race_spec.rb`, `spec/requests/api/v1/races_spec.rb`, `spec/requests/api/v1/teams_spec.rb`.
- Modify `frontend/src/types/api.ts`, `frontend/src/test/fixtures.ts`, `frontend/src/features/races/components/race-list.tsx`, `race-list.test.tsx`.
- Modify `frontend/src/features/teams/utils.ts` (add `teamStatus`), `frontend/src/features/teams/components/my-teams.tsx` (use it), `frontend/src/locales/en.ts`; create `frontend/src/features/races/components/race-teams.tsx` and its test.
- Modify `lib/tasks/test_seeds.rake` (new `race_list_order` task, plus a header comment line); create `tests/spa/race-list-order.spec.ts`.
- Modify `CLAUDE.md` (learnings) and check `README.md`.

---

### Task 1: `Race#registration_status` and `Race#registration_sort_key`

**Files:**
- Modify: `app/models/race.rb` (next to `registration_over?`, around line 185)
- Test: `spec/models/race_spec.rb` (new `describe '#registration_status'` and `describe '#registration_sort_key'` blocks)

**Interfaces:**
- Produces: `Race#registration_status -> Symbol` (one of `:open, :waitlist, :closed, :not_yet_open`) and `Race#registration_sort_key -> Array` (`[rank Integer, Time, id Integer]`, rank 0..3 in the status order above). Tasks 2 and 3 rely on these names.

- [ ] **Step 1: Write the failing tests** in `spec/models/race_spec.rb`, using the existing `FactoryBot.build :race` style and the existing traits `:registration_opens_tomorrow` and `:registration_closed`. Names and assertions:
  - `returns :open for a race that is open and not full` (`FactoryBot.build :race`).
  - `returns :waitlist for an open race at capacity` (`FactoryBot.build :race` with `race.finalized_teams_count = race.max_teams`, the public writer `preload_registration_data` uses, so no stub is needed).
  - `returns :not_yet_open when registration opens in the future` (`:registration_opens_tomorrow`).
  - `returns :closed when registration is over` (`:registration_closed`).
  - `returns :closed, not :waitlist, for a full race whose registration is over` (`:registration_closed` with `finalized_teams_count = max_teams`). *(Review Focus)*
  - `still returns :open at the exact moment registration closes`: inside `Timecop.freeze`, build a race with `registration_close: Time.zone.now`, expect `:open`. *(Review Focus)*
  - `#registration_sort_key`: `ranks open < waitlist < closed < not_yet_open`; `uses race_datetime within a group`; `uses registration_open for a not_yet_open race`; `ends with the id`.

- [ ] **Step 2: Run to verify they fail**

Run: `bundle exec rspec spec/models/race_spec.rb -e registration_status -e registration_sort_key`
Expected: FAIL with `NoMethodError: undefined method 'registration_status'`.

- [ ] **Step 3: Implement in `app/models/race.rb`**
  - `REGISTRATION_STATUS_RANKS = { open: 0, waitlist: 1, closed: 2, not_yet_open: 3 }.freeze`
  - `def registration_status` returns `:not_yet_open` if `not_yet_open?`; else `full? ? :waitlist : :open` if `open_for_registration?`; else `:closed`.
  - `def registration_sort_key` returns `[REGISTRATION_STATUS_RANKS.fetch(status), status == :not_yet_open ? registration_open : race_datetime, id]`. Rank is the first element, so times from different groups are never compared.
  - Use endless-method syntax only if it stays readable.

- [ ] **Step 4: Run to verify they pass**

Run: `bundle exec rspec spec/models/race_spec.rb`
Expected: all examples pass.

- [ ] **Step 5: Commit**

```bash
git add app/models/race.rb spec/models/race_spec.rb
git commit -m "Add Race#registration_status and registration_sort_key"
```

(Include the `Co-Authored-By` line in the commit message.)

---

### Task 2: API ordering and `registration_status` field

**Files:**
- Modify: `app/controllers/api/v1/races_controller.rb:3-4`
- Modify: `app/views/api/v1/races/_race.json.jbuilder` (after `json.full race.full?`)
- Test: `spec/requests/api/v1/races_spec.rb`, `spec/requests/api/v1/teams_spec.rb`

**Interfaces:**
- Consumes: `Race#registration_status`, `Race#registration_sort_key` (Task 1).
- Produces: JSON key `registration_status` (string: `"open" | "waitlist" | "closed" | "not_yet_open"`) on every race object from `/api/v1/races`, `/api/v1/races/:id` and `/api/v1/teams*`.

- [ ] **Step 1: Write the failing tests** in `spec/requests/api/v1/races_spec.rb`. Build races with `FactoryBot.create(:race, registration_open:, registration_close:, final_edits_close:, race_datetime:)` using explicit `Time.zone.now` offsets (dates must satisfy open < close < final_edits < race):
  - `lists open races, then waitlist, then registration-over, then not-yet-open races`: create the four (waitlist via `:full_race`), with race dates deliberately in reverse of the expected order so date order alone cannot pass. Expect `json["races"].map { |r| r["id"] }` to equal the four ids in expected order, and `map { |r| r["registration_status"] }` to equal `%w[open waitlist closed not_yet_open]`. Note the file's top-level `let!(:race)` is a fourth open race; either account for it or build the new examples in their own `describe` that deletes it (`race.destroy`) first.
  - `orders not-yet-open races by registration_open, not race date`: two not-yet-open races where the one opening sooner races later. *(Review Focus)*
  - `breaks ties on race_datetime by id`: two open races with an identical `race_datetime`; expect the lower id first. *(Review Focus)*
  - Keep the existing `lists current races ordered by race datetime` example passing unchanged.
  - Add `"registration_status" => "open"` to the `include(...)` in the existing `returns the race fields` show example.
  - In `spec/requests/api/v1/teams_spec.rb`, in an existing example that GETs a team and asserts on `json["team"]["race"]` (or the closest equivalent), add an assertion that `race["registration_status"]` is `"open"`. *(Review Focus)*

- [ ] **Step 2: Run to verify they fail**

Run: `bundle exec rspec spec/requests/api/v1/races_spec.rb spec/requests/api/v1/teams_spec.rb`
Expected: the new examples FAIL (`registration_status` missing / wrong order).

- [ ] **Step 3: Implement**
  - Controller `index`: keep `Race.current.includes(:requirements).to_a`, call `Race.preload_registration_data(@races)`, then `@races = @races.sort_by(&:registration_sort_key)`. Drop the SQL `.order(:race_datetime)` only if it is unneeded; keeping it is harmless. The sort must come after the preload so `full?` reads the preloaded count.
  - Jbuilder: `json.registration_status race.registration_status`.

- [ ] **Step 4: Run to verify they pass**

Run: `bundle exec rspec spec/requests/api/v1/`
Expected: all pass, including `query_count_spec.rb`.

- [ ] **Step 5: Commit**

```bash
git add app/controllers/api/v1/races_controller.rb app/views/api/v1/races/_race.json.jbuilder spec/requests/api/v1/races_spec.rb spec/requests/api/v1/teams_spec.rb
git commit -m "Order the race list by registration status and expose registration_status"
```

---

### Task 3: SPA reads `registration_status`

**Files:**
- Modify: `frontend/src/types/api.ts:11-27`, `frontend/src/test/fixtures.ts` (`buildRace`, around line 11), `frontend/src/features/races/components/race-list.tsx:10-28`
- Test: `frontend/src/features/races/components/race-list.test.tsx`

**Interfaces:**
- Consumes: JSON `registration_status` (Task 2).
- Produces: `Race.registration_status: 'open' | 'waitlist' | 'closed' | 'not_yet_open'` in `frontend/src/types/api.ts`; `buildRace` defaults it to `'open'`.

- [ ] **Step 1: Write the failing tests** in `race-list.test.tsx`, replacing the boolean-driven setups with the new field:
  - `shows an open race ...`, `shows the waitlist badge ...` (`registration_status: 'waitlist'`, `open_for_registration: true`, `full: true`), `shows a closed race ...` (`registration_status: 'closed'`, `open_for_registration: false`) and `shows when registration opens ...` (`registration_status: 'not_yet_open'`) keep their assertions.
  - New: `does not show an Opens date for a closed race whose registration is over` (`registration_status: 'closed'`; `queryByText(/^Opens/)` is null).
  - New: `shows the not-yet-open Opens date without relying on the browser clock`: no `vi.useFakeTimers`, `registration_status: 'not_yet_open'` with an `registration_open` in the past; the `Opens ...` text still appears.
  - New: `renders races in the order the server sends them`: mock three races with different ids and names in a non-date order; assert `screen.getAllByRole('heading', { level: 2 })` text equals that order.

- [ ] **Step 2: Run to verify they fail**

Run: `npm --prefix frontend test -- --run src/features/races`
Expected: FAIL (type error or wrong badge for the new field).

- [ ] **Step 3: Implement**
  - Add `registration_status` to the `Race` interface and a default of `'open'` in `buildRace`.
  - `RaceStatus` switches on `race.registration_status`: `open` shows the success badge; `waitlist` the warning badge; `closed` the danger badge; `not_yet_open` the danger badge plus the `Opens <date>` span. Remove the `new Date(...) > Date.now()` check.
  - The Start button keeps using `race.open_for_registration`.
  - Run `npx tsc --noEmit -p frontend` (or the project's type-check script) and fix any other `Race` literal that now lacks the field.

- [ ] **Step 4: Run to verify they pass**

Run: `npm --prefix frontend test -- --run`
Expected: all Vitest suites pass; the type check is clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "Read registration_status in the SPA race list"
```

---

### Task 4: "Your teams" list on each race tile

**Files:**
- Create: `frontend/src/features/races/components/race-teams.tsx`
- Modify: `frontend/src/features/races/components/race-list.tsx`, `frontend/src/features/teams/utils.ts`, `frontend/src/features/teams/components/my-teams.tsx`, `frontend/src/locales/en.ts`
- Test: `frontend/src/features/races/components/race-teams.test.tsx` (or extend `race-list.test.tsx`), `frontend/src/features/teams/components/my-teams.test.tsx` (must stay green)

**Interfaces:**
- Consumes: `useMe` (existing), `useTeams` from `@/features/teams/api/use-teams` returning `Team[]`, `Race.open_for_registration` and `registration_status` (Tasks 2-3).
- Produces: `teamStatus(team: Team): string` exported from `frontend/src/features/teams/utils.ts` (moved verbatim from `my-teams.tsx`: `Finalized #N` or `N thing(s) left` through the existing `teams.finalized`, `teams.thingsLeft_one`, `teams.thingsLeft_other` strings); `RaceTeams({ teams }: { teams: Team[] })` rendering the label and rows; locale keys `races.yourTeams` = `Your teams`, `races.startAnother` = `Start another team`.

- [ ] **Step 1: Write the failing tests** (MSW handlers for `/api/v1/me` and `/api/v1/teams`; build teams with the existing `buildTeam` fixture, setting `race: buildRace({ id })` and `checklist`):
  - `shows a logged-in racer's team under its own race, with the status chip`: two races, a team in race 1 with `remaining: 2` → the race 1 tile shows `Your teams`, a link named after the team to `/register/teams/<id>` and the text `2 things left`; the race 2 tile shows none of it. *(Review Focus: another race's team never appears)*
  - `shows Finalized #42 for a finalized team`.
  - `switches the button to "Start another team" when the racer already has a team in an open race`, and keeps `Start a team` on a race with no team of theirs.
  - `shows a team under a closed race and offers no start button there` (`registration_status: 'closed'`, `open_for_registration: false`). *(Review Focus)*
  - `shows no teams list and does not request teams when logged out` (`/api/v1/me` returns no user; a `/api/v1/teams` handler that fails the test if called).
  - `still renders the races when the teams request fails` (`/api/v1/teams` returns 500): race cards present, no `alert`, no `Your teams`. *(Review Focus)*
  - `my-teams.test.tsx` passes unchanged after `teamStatus` moves.

- [ ] **Step 2: Run to verify they fail**

Run: `npm --prefix frontend test -- --run src/features/races src/features/teams`
Expected: new tests FAIL (missing component and strings); existing My teams tests still pass.

- [ ] **Step 3: Implement**
  - Move `teamStatus` to `features/teams/utils.ts` and import it in `my-teams.tsx`.
  - `race-list.tsx`: read `useMe()`; call `useTeams()` only when a user exists (use the hook's `enabled` option if it has one, or a small wrapper hook in `features/races/api/` such as `useMyTeamsByRace(): Map<number, Team[]>` that returns an empty map when logged out, loading or failed). Group by `team.race.id`.
  - `RaceTeams` markup per the chosen variant B of the mockup (`race-tile-variants.html` in the session scratchpad; reproduce with Tailwind classes using the design tokens): a `Your teams` label (small caps), then `<ul>` of rows, each a `Link` to `/teams/${team.id}` with `min-h-11`, the team name (`font-semibold`, wraps with `[overflow-wrap:anywhere]`) and a chip: `Badge tone="warning"` for unfinalized, `tone="success"` for finalized, text from `teamStatus`.
  - Start button: label `races.startAnother` and outlined style when the race has one or more of the racer's teams, otherwise `races.start` solid red as today; still rendered only when `race.open_for_registration`.
  - Verify the tile at 320px wide with no horizontal scroll (Playwright MCP screenshot or the e2e step below).

- [ ] **Step 4: Run to verify they pass**

Run: `npm --prefix frontend test -- --run`
Expected: all pass; type check clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "Show a racer's own teams on each race tile"
```

---

### Task 5: Playwright spec, seed task and docs

**Files:**
- Modify: `lib/tasks/test_seeds.rake` (header comment list near line 13, new task, `cleanup` needs no change if names start with `Race `)
- Create: `tests/spa/race-list-order.spec.ts`
- Modify: `CLAUDE.md`; check `README.md`

**Interfaces:**
- Produces: rake task `test_seeds:race_list_order` writing credentials JSON `{ race_names: { open: string, waitlist: string, closed: string, not_yet_open: string }, short_id: string, captain_email: string, captain_password: string, open_team_name: string, closed_team_name: string }` via `write_test_credentials`.

- [ ] **Step 1: Add `test_seeds:race_list_order`** next to `reminder`, modeled on it (guard, `factory_bot_rails`, `TEST_UNIQUE_ID`, `short = unique_id[0..7]`). Create four races named `"Race #{short} Open"`, `"... Waitlist"`, `"... Closed"`, `"... Not Yet Open"`, with `max_teams` small and `people_per_team: 2`. Dates (weeks from now; all satisfy open < close < final_edits < race): open race registration open -1w, close +2w, final edits +3w, race +8w; waitlist race `:full_race` with race +6w; closed race registration open -3w, close -1 day, final edits +1w, race +5w; not-yet-open race registration open +1w, close +2w, final edits +3w, race +4w. Race dates are therefore the exact reverse of the expected order. Also create a captain user (`race-list-#{unique_id}@example.com`, password `password123`, as in `reminder`) with one unfinalized team named `Test Team Open #{short}` in the open race and one named `Test Team Closed #{short}` in the closed race (team creation after registration closed needs `update_columns` for dates, as CLAUDE.md notes: create the team while the race is open, then move the dates). Add the header comment line for the task. `test_seeds:cleanup` already removes `Race %` races and their teams; after running the task once, confirm `:full_race`'s finalized teams and users are removed by `test_seeds:cleanup` and, if any survive, extend cleanup to cover them.

- [ ] **Step 2: Write the spec** `tests/spa/race-list-order.spec.ts`, patterned on `tests/spa/reminder.spec.ts` (`seed<Credentials>('race_list_order')` in `beforeAll`, `dispose` in `afterAll`). The list route is public, so no login. Test `lists open races first, then waitlist, registration-over and not-yet-open races`: `page.goto('/register')`, wait for the heading `Choose your race`, read `page.getByRole('heading', { level: 2 }).allTextContents()`, filter to names containing `short_id` (other specs' races can share the page), and expect `[open, waitlist, closed, not_yet_open]`. Also assert the badges: the Open card shows `Open`, the Waitlist card `Waitlist`, the Closed card `Closed` with no `Opens` text, the Not Yet Open card `Closed` plus `Opens`; only the Open and Waitlist cards have a start link, and while logged out the Open card's link reads `Start a team` and no card shows `Your teams`. A second test, `shows a logged-in captain's teams on their race tiles`: log in through `/register/login` (pattern from `tests/spa/past-racers.spec.ts`), return to `/register`, and expect the Open card to show `Your teams`, the open team's link and an `N things left` chip and its button to read `Start another team`; the Closed card to show the closed team's link and no start link; the Waitlist and Not Yet Open cards to show no `Your teams`.

- [ ] **Step 3: Run it**

Needs `docker compose up -d db redis mailpit`.
Run: `npx playwright test tests/spa/race-list-order.spec.ts`
Expected: PASS. If another session is running, use `TEST_PORT=3199` and a separate `DATABASE_URL` as CLAUDE.md describes. Record whether it actually ran for the PR body.

- [ ] **Step 4: Docs.** Add one bullet to the Registration SPA section of `CLAUDE.md`: the race list order and groups, where `registration_status` is defined, that the sort is a Ruby `sort_by` after the preload (and why), that each tile lists the logged-in racer's own teams from `useTeams` (non-blocking, matched by `team.race.id`, `teamStatus` shared with My teams), and that `test_seeds:race_list_order` plus `tests/spa/race-list-order.spec.ts` cover it. Check `README.md`; update it only if it describes the race list or the seed tasks.

- [ ] **Step 5: Full verification**

Run: `bin/check`
Expected: rspec, frontend, build and e2e steps all pass (one summary line each). Fix anything that fails before continuing.

- [ ] **Step 6: Commit**

```bash
git add lib/tasks/test_seeds.rake tests/spa/race-list-order.spec.ts CLAUDE.md README.md
git commit -m "Add e2e spec and seed for race list ordering"
```

---

### Task 6: Push and open the PR

- [ ] **Step 1:** `git push -u origin feature/race-list-ordering`.
- [ ] **Step 2:** Open the PR against `chiditarod/dogtag` with `gh pr create --repo chiditarod/dogtag`. The body summarizes the new order, notes the `registration_status` field also appears on `/teams` payloads, states plainly whether the Playwright spec was actually run, states there are no Gemfile or config changes, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge.
