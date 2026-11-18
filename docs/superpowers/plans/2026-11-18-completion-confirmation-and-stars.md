# Completion Confirmation and Four Labeled Stars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each race an admin-editable Markdown confirmation text, show it once in a completion modal and always in the confirmation email and team page header, and relabel the progress flag's four stars as team created, racers, questions, fee.

**Architecture:** Rails renders the Markdown once (commonmarker, then Rails `sanitize`) and ships the HTML in the team checklist JSON; the email uses the same renderer. A nullable `teams.confirmation_seen_at` decides whether the captain still owes a modal; the SPA reads `checklist.show_confirmation` and posts to a new endpoint when the modal closes. Stars are derived client-side in `stepStates`.

**Tech Stack:** Rails 8, PostgreSQL, commonmarker 2.x (new), jbuilder, RSpec; React 19 + TanStack Query + Tailwind, Vitest + MSW; Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-completion-confirmation-and-stars-design.md`

## Global Constraints

- Branch `feature/296-completion-confirmation`, stacked on #312 (`origin/feature/299-unique-team-email`). PR to `chiditarod/dogtag` with `--head ometa:feature/296-completion-confirmation --base main`; body says "Stacked on #312; merge that first", calls out the Gemfile change and the migration (migrate on `dogtag-staging` right after the push, then `heroku restart`), and ends with the Generated with Claude Code line.
- Specs run with `DATABASE_URL=postgresql://postgres@localhost/dogtag_test_2`.
- Migrations: `bin/rails g migration`, `text` and `datetime` only.
- Strong params use `params.expect`.
- Help address: `dogtag@chiditarod.org`.
- SPA copy lives in `frontend/src/locales/en.ts`; works at 320px with no horizontal scroll; wrapping values use `[overflow-wrap:anywhere]`.
- Exact copy: tour flag title `Four stars to the start line`; tour flag body `You earned the first star by creating your team. Add racers, answer the questions and pay the fee to fill the rest. Four stars and you're fully registered.`; finished heading `You're fully registered!`.
- Star order and labels: `Team`, `Racers`, `Questions`, `Fee`. A finalized team shows all four filled.
- Fundraising lines appear only when the race has `classy_campaign_id` (`checklist.classy_expected`).
- Commit after each task; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Admin text with raw HTML (`<script>`, `<img onerror>`) or a `javascript:` link: rendered as escaped text or dropped, never executed (Task 1 test).
2. Staff (admin/operator) opening a captain's finalized, unseen team: no modal, and the endpoint must not set `confirmation_seen_at` (Task 3 and Task 7 tests).
3. Captain whose race registration has closed (admin finalized them late): the modal still shows and can be dismissed; the endpoint must authorize on ownership, not on `:update` (Task 3 test).
4. Team that finalizes through a mutation (last racer, last answer, payment): the mutation's checklist carries `show_confirmation: true`, so the modal opens without a reload (Task 3 test on the payments/people response; Task 7 test).
5. The mark-seen request fails: the modal still closes and the page keeps working; it returns on the next visit (Task 7 test).

---

### Task 1: Markdown renderer (commonmarker)

**Files:**
- Modify: `Gemfile`, `Gemfile.lock` (owner approved; call out in PR)
- Create: `app/services/confirmation_text.rb`
- Test: `spec/services/confirmation_text_spec.rb`

**Interfaces:**
- Produces: `ConfirmationText.to_html(source : String | nil) -> ActiveSupport::SafeBuffer | nil` (nil when `source.blank?`).

- [ ] **Step 1: Write the failing spec** `spec/services/confirmation_text_spec.rb`:
  - `"renders paragraphs, emphasis and links"`: `to_html("Hi **there**\n\nRead [Start Here](https://example.com/start)")` includes `<p>Hi <strong>there</strong></p>` and `<a href="https://example.com/start">Start Here</a>`; `html_safe?` is true.
  - `"renders lists"`: `"- one\n- two"` includes `<li>one</li>`.
  - `"never passes raw HTML through"`: for `"<script>alert(1)</script>"` and `"<img src=x onerror=alert(1)>"`, output does not include `<script` or `onerror`.
  - `"drops javascript: links"`: `"[x](javascript:alert(1))"` output does not include `javascript:`.
  - `"keeps mailto links"`: `"[mail](mailto:dogtag@chiditarod.org)"` includes `href="mailto:dogtag@chiditarod.org"`.
  - `"is nil when blank"`: `to_html(nil)` and `to_html("  \n")` are nil.
- [ ] **Step 2: Run** `DATABASE_URL=postgresql://postgres@localhost/dogtag_test_2 bundle exec rspec spec/services/confirmation_text_spec.rb`. Expected: FAIL, `uninitialized constant ConfirmationText`.
- [ ] **Step 3: Add the gem** with `bundle add commonmarker --version "~> 2.0"` (latest 2.x; must install a precompiled `x86_64-linux` and `arm64-darwin` gem, so confirm `Gemfile.lock` lists platform gems and no Rust toolchain is needed).
- [ ] **Step 4: Implement** `ConfirmationText.to_html` in `app/services/confirmation_text.rb`: `Commonmarker.to_html(source, options: { render: { unsafe: false, escape: true, hardbreaks: true }, extension: { header_ids: nil } }, plugins: { syntax_highlighter: nil })`, then `ActionController::Base.helpers.sanitize(html, tags: %w[p br strong em a ul ol li h3 h4 code blockquote], attributes: %w[href])`. Rails' sanitizer already strips non-http(s)/mailto protocols.
- [ ] **Step 5: Run** the spec. Expected: PASS.
- [ ] **Step 6: Commit** `Render race confirmation text from Markdown`.

### Task 2: Columns, seed, and the admin field

**Files:**
- Create: `db/migrate/<ts>_add_confirmation_to_races_and_teams.rb`
- Modify: `db/schema.rb`, `app/controllers/races_controller.rb:109-116`, `app/views/races/_form.html.haml` (after the classy fields), `config/locales/en.yml` (`races.form.confirmation_text`, `races.form.confirmation_text_help`; admin page, but the form already uses `t('.…')` labels)
- Test: `spec/controllers/races_controller_spec.rb`

**Interfaces:**
- Produces: `races.confirmation_text :text` (nullable), `teams.confirmation_seen_at :datetime` (nullable); `Race#confirmation_text`, `Team#confirmation_seen_at`.

- [ ] **Step 1: Write the failing controller spec**: `"saves the confirmation text"` — as admin, `patch :update, params: { id: race.id, race: { confirmation_text: "Welcome **racers**" } }`; expect redirect and `race.reload.confirmation_text == "Welcome **racers**"`.
- [ ] **Step 2: Run** it. Expected: FAIL (`unknown attribute` or unchanged value).
- [ ] **Step 3: Generate** `bin/rails g migration AddConfirmationToRacesAndTeams`. `change` adds both columns. A `reversible` `up` block, using `execute`/SQL (not app models or constants), sets:
  - `teams.confirmation_seen_at = NOW()` where `finalized = true`;
  - `races.confirmation_text = <DEFAULT>` where `race_datetime > NOW()` and `confirmation_text IS NULL`, where `<DEFAULT>` is this Markdown (quoted with `connection.quote`):
    ```
    How about some fundraising? Fundraising for The CHIditarod Foundation funds grants to other Chicago nonprofits and shows off all the work your team puts into the race. Visit [chiditarod.org/fundraising](http://www.chiditarod.org/fundraising) to get started, and check out the [fundraising incentives](http://www.chiditarod.org/fundraising-incentives).

    More news is on the way. In the meantime, read up at [chiditarod.org](http://www.chiditarod.org/).
    ```
  Run `bin/rails db:migrate` and `RAILS_ENV=test DATABASE_URL=postgresql://postgres@localhost/dogtag_test_2 bin/rails db:migrate`. Keep only this migration's lines in the `db/schema.rb` diff (shared test DB: discard foreign schema changes).
- [ ] **Step 4: Permit** `:confirmation_text` in `race_params`; add a `text_area :confirmation_text, rows: 8` form group with help text `Markdown. Shown to captains when their team is fully registered: in a pop-up, in the confirmation email and on the team page.`
- [ ] **Step 5: Run** the controller spec. Expected: PASS. Check by hand that `bin/rails db:rollback` then `db:migrate` works.
- [ ] **Step 6: Commit** `Add race confirmation text and team confirmation_seen_at`.

### Task 3: Checklist fields and the confirmation-seen endpoint

**Files:**
- Modify: `app/services/team_checklist.rb`, `app/views/api/v1/teams/_team.json.jbuilder`, `app/controllers/api/v1/{people,questions,payments,mock_payments}_controller.rb` (each `TeamChecklist.new` call), `config/routes.rb` (inside `resources :teams`)
- Create: `app/controllers/api/v1/confirmations_controller.rb`
- Test: `spec/services/team_checklist_spec.rb`, `spec/requests/api/v1/teams_spec.rb`, `spec/requests/api/v1/confirmations_spec.rb`, `spec/requests/api/v1/payments_spec.rb` (or `mock_payments`), `spec/requests/api/v1/query_count_spec.rb` (must stay green)

**Interfaces:**
- Consumes: `ConfirmationText.to_html` (Task 1); columns (Task 2).
- Produces:
  - `TeamChecklist.new(team, viewer: nil)`; `to_h` adds `confirmation_html: String | nil` and `show_confirmation: Boolean` (`team.finalized && team.confirmation_seen_at.nil? && viewer&.id == team.user_id`).
  - `POST /api/v1/teams/:team_id/confirmation` → `Api::V1::ConfirmationsController#create`: 200 with `{ checklist: <checklist> }`.
- [ ] **Step 1: Write the failing specs:**
  - Checklist spec: `"exposes the race's confirmation HTML"` (race `confirmation_text: "**Hi**"`, `confirmation_html` includes `<strong>Hi</strong>`; nil when blank). `"asks the owner to see the confirmation once"`: finalized team, `confirmation_seen_at: nil`; `TeamChecklist.new(team, viewer: team.user).to_h[:show_confirmation]` is true; false for `viewer: nil`, for another user, for an admin, when `confirmation_seen_at` is set, and when not finalized.
  - Confirmations request spec:
    - `"marks it seen for the owner"`: 200; `team.reload.confirmation_seen_at` present; `json.dig("checklist","show_confirmation") == false`.
    - `"is idempotent"`: a second POST leaves the first timestamp unchanged (Timecop).
    - `"works after registration closes"`: race closed; owner still gets 200 and it is set.
    - `"does not let staff use it up"`: logged in as an admin (and an operator); response is 403, the column stays nil.
    - `"refuses other users"`: another user gets 403 or 404 (match how `authorize!(:show, team)` fails today); column stays nil.
    - Logged out: 401.
  - Teams request spec: `GET /api/v1/teams/:id` for an owner of a finalized unseen team returns `checklist.show_confirmation == true` and `checklist.confirmation_html`.
  - Mock-payments request spec: a payment that finalizes the team responds with `checklist.show_confirmation == true`.
- [ ] **Step 2: Run** those specs. Expected: FAIL.
- [ ] **Step 3: Implement**:
  - `TeamChecklist#initialize(team, viewer: nil)`; `confirmation_html` memoized per race is fine; `ConfirmationText.to_html(race.confirmation_text)&.to_str`.
  - Pass `viewer: current_user` at every call site (jbuilder partial uses `current_user`; confirm it is a helper in `Api::V1::BaseController`, otherwise pass it in through `locals`).
  - Route: `resource :confirmation, only: [:create]` under `resources :teams`.
  - Controller: `before_action :require_api_user!`; find team; `authorize!(:show, team)`; then `raise CanCan::AccessDenied unless team.user_id == current_user.id`; `team.update_column(:confirmation_seen_at, Time.current) if team.confirmation_seen_at.nil?`; render `{ checklist: TeamChecklist.new(team, viewer: current_user).to_h }`. Uses the base controller's error shape.
- [ ] **Step 4: Run** the specs plus `spec/requests/api/v1/query_count_spec.rb`. Expected: PASS.
- [ ] **Step 5: Commit** `Tell the SPA when a captain should see the confirmation`.

### Task 4: Confirmation email

**Files:**
- Modify: `app/views/user_mailer/team_finalized_email.html.haml`, `app/views/user_mailer/team_finalized_email.text.erb`
- Test: `spec/mailers/user_mailer_spec.rb` (`#team_finalized_email`)

**Interfaces:**
- Consumes: `ConfirmationText.to_html`; `TeamChecklist`'s URL rule (reuse it: extract `TeamChecklist#classy_fundraising_url` into `Team#classy_fundraising_url` so both share it).

- [ ] **Step 1: Write failing mailer specs:**
  - `"includes the team number and the race's confirmation text"`: `race.confirmation_text = "Read the [guide](https://example.com/g)"`, team with `assigned_team_number: 42`; HTML part includes `Team #42` and `<a href="https://example.com/g">guide</a>`; text part includes `Team #42` and the raw Markdown.
  - `"drops the old hardcoded fundraising copy"`: body does not include `How about some Fundraising`.
  - `"omits the fundraising line without a campaign"`: race without `classy_campaign_id`; no `fundraising page`.
  - `"says the page is being set up"`: campaign, no `team.classy_id`; includes `Your fundraising page is being set up`.
  - `"links an existing fundraising page"`: campaign and `team.classy_id`; includes `https://www.classy.org/team/<id>?campaignId=<cid>`.
  - `"omits the text block when blank"`: no error, still includes the edit link and `dogtag@chiditarod.org`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** both templates: race and team name, `Team #N` (when assigned), racers, edit link and deadline (unchanged), confirmation block (HTML part: `ConfirmationText.to_html`; text part: raw `confirmation_text`), the fundraising line rule above, and `Problems? Email dogtag@chiditarod.org`. Remove the hardcoded fundraising/website paragraphs.
- [ ] **Step 4: Run** the whole `spec/mailers/user_mailer_spec.rb` and `spec/services/team_checklist_spec.rb`. Expected: PASS.
- [ ] **Step 5: Commit** `Put the race's confirmation text in the confirmation email`.

### Task 5: Four labeled stars and tour copy

**Files:**
- Modify: `frontend/src/types/api.ts` (Checklist), `frontend/src/features/teams/utils.ts:35-44`, `frontend/src/features/teams/components/flag-progress.tsx`, `frontend/src/features/teams/components/team-checklist.tsx:97`, `frontend/src/locales/en.ts`, `frontend/src/features/tour/stops.ts` (comment only)
- Test: `frontend/src/features/teams/utils.test.ts` (create), `flag-progress.test.tsx`, `team-checklist.test.tsx`, `frontend/src/features/tour/stops.test.ts`, and test fixtures building a `Checklist` (add the two new fields)

**Interfaces:**
- Produces: `Checklist.confirmation_html: string | null`, `Checklist.show_confirmation: boolean`; `stepStates(team) -> [team: true, racers, questions, fee]`, all `true` when `checklist.finalized`; `FlagProgress` props `{ steps, label, starLabels: [string, string, string, string] }`; keys `team.star.team|racers|questions|fee` = `Team`, `Racers`, `Questions`, `Fee`.

- [ ] **Step 1: Write failing tests:**
  - `utils.test.ts`: new team (no racers, questions required, fee due) → `[true,false,false,false]`; race without questions → index 2 true; fee opens later → index 3 false; `finalized: true` with `questions.done: false` → all true.
  - `flag-progress.test.tsx`: renders the four labels in order as visible text; salute when the fourth star lands (update the existing "fourth star" test to the new mapping).
  - `team-checklist.test.tsx`: update "card stars" expectations: a fresh team shows 1 of 4; heading cards still use racers/questions/fee states (destructure `[, racersDone, questionsDone, feeDone]`).
  - `stops.test.ts`: flag stop title/body equal the exact copy in Global Constraints; `in` body is `When all four stars are solid red, you're fully registered and get your team number.`
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement**: types; `stepStates`; `FlagProgress` renders labels under each star (small text, `text-navy/70`, grid of four equal columns so the labels sit under their stars at 320px); `TeamHeader` passes the labels; update `tour.flag.*` and `tour.in.body` in `en.ts`.
- [ ] **Step 4: Run** Vitest. Expected: PASS.
- [ ] **Step 5: Commit** `Label the four stars: team, racers, questions, fee`.

### Task 6: Finished-state header and the slimmed "You're in" card

**Files:**
- Create: `frontend/src/features/teams/components/confirmation-text.tsx`, `frontend/src/features/teams/components/fundraising-status.tsx`
- Modify: `frontend/src/features/teams/components/team-header.tsx`, `youre-in-card.tsx`, `frontend/src/locales/en.ts`, `frontend/src/index.css` (only if prose styling needs a class)
- Test: `team-checklist.test.tsx`, `frontend/src/features/payments/components/fee-card.test.tsx:158` (heading name), Playwright references in `tests/e2e/registration.spec.ts:195` and `tests/spa/guided-tour.spec.ts:51-52`

**Interfaces:**
- Consumes: `Checklist.confirmation_html`, `classy_expected`, `classy_fundraising_url`, `team_number`.
- Produces: `<ConfirmationText html={string} className?>` (renders server-sanitized HTML via `dangerouslySetInnerHTML`; links styled `text-link underline`; values wrap with `[overflow-wrap:anywhere]`); `<FundraisingStatus checklist compact?>` (link `Open your fundraising page` when the URL is set, pending text when `classy_expected` and no URL, nothing otherwise). Keys: `team.fullyRegistered` = `You're fully registered!`.

- [ ] **Step 1: Write failing tests** in `team-checklist.test.tsx`:
  - finalized team with `team_number: 42`, `confirmation_html: '<p>Build your <strong>cart</strong></p>'`, campaign and URL: the header shows `You're fully registered!`, `Team #42`, a link `Open your fundraising page` with that href, and the text `Build your cart`.
  - same, `classy_expected: false`: no fundraising link or pending text anywhere on the page.
  - finalized, `confirmation_html: null`: no empty prose block (query by a `data-testid="confirmation-text"` and expect none).
  - unfinalized: no confirmation text.
  - "You're in" card when finalized: shows team number and fundraising status; heading becomes `You're fully registered!`; no duplicate confirmation text inside the card.
- [ ] **Step 2: Run** Vitest. Expected: FAIL.
- [ ] **Step 3: Implement**: header `remainingText` returns `team.fullyRegistered` when finalized; under it a line `Team #N` plus `<FundraisingStatus compact>`; then `<ConfirmationText>` at every width (the `What's left` block keeps `hidden lg:block`). `YoureInCard` title uses `team.fullyRegistered` when finalized and renders team number + `<FundraisingStatus>`; locked state unchanged. Update the fee-card test and the two Playwright specs to the new heading/text.
- [ ] **Step 4: Run** Vitest. Expected: PASS.
- [ ] **Step 5: Commit** `Show the finished state and confirmation text on the team page`.

### Task 7: Completion modal

**Files:**
- Create: `frontend/src/features/teams/components/completion-dialog.tsx`, `frontend/src/features/teams/api/use-mark-confirmation-seen.ts`
- Modify: `frontend/src/features/teams/components/team-checklist.tsx`, `frontend/src/locales/en.ts`
- Test: `frontend/src/features/teams/components/completion-dialog.test.tsx`, `team-checklist.test.tsx`

**Interfaces:**
- Consumes: `POST /api/v1/teams/:id/confirmation` → `{ checklist }` (Task 3); `setTeamChecklist` (`use-team.ts`); `DialogSheet`; `ConfirmationText`, `FundraisingStatus` (Task 6).
- Produces: `useMarkConfirmationSeen(teamId) -> UseMutationResult` (on success writes the checklist with `setTeamChecklist`); `<CompletionDialog team onClose>`.
- Keys: `confirm.title` = `You're fully registered!`; `confirm.team` = `Team #{number} · {name}`; `confirm.editUntil` = `You can edit your team until {date}.` (use `formatDeadline` on `race.registration_close`); `confirm.help` = `Problems? Email dogtag@chiditarod.org` (address as a `mailto:` link); `confirm.done` = `Got it`.

- [ ] **Step 1: Write failing tests:**
  - opens on load when `show_confirmation: true` (dialog named `You're fully registered!`, shows team number, confirmation text, help link with `mailto:dogtag@chiditarod.org`, edit-until line).
  - does not open when `show_confirmation: false` (staff view or already seen).
  - opens after a mutation writes a checklist with `show_confirmation: true` into the cache (render with false, then `setTeamChecklist(... true)`).
  - `Got it` posts once to `/api/v1/teams/:id/confirmation` (MSW handler counts calls) and closes; Escape does the same.
  - if the POST returns 500, the dialog still closes and no team-page error banner appears.
  - fundraising line only with `classy_expected`.
  - the guided tour does not render while the dialog is open (finalized teams never auto-start the tour; also guard `Take the tour` while the dialog is up by rendering the tour only when the dialog is closed).
- [ ] **Step 2: Run** Vitest. Expected: FAIL.
- [ ] **Step 3: Implement**: `TeamChecklist` keeps `const [dismissed, setDismissed] = useState(false)`; renders `<CompletionDialog>` when `checklist.show_confirmation && !dismissed`; `onClose` sets `dismissed` and fires the mutation (errors swallowed: no `reportError`). The dialog body scrolls (`overflow-y-auto`) and text wraps at 320px.
- [ ] **Step 4: Run** Vitest. Expected: PASS.
- [ ] **Step 5: Commit** `Show a one-time confirmation when a team is fully registered`.

### Task 8: Racers card collapses when the team finishes

The roster already starts collapsed (first names + `Show racers`) when it is full on load (`roster-card.tsx:51,236-255`). **Keep that behavior exactly as it is (owner requirement):** a full roster on load still starts collapsed whether or not the team is finalized, and a spot opening still expands it. This task only adds: collapsing when the team becomes finalized during the visit, and the chevron/expanded state on the toggle.

**Files:**
- Modify: `frontend/src/features/roster/components/roster-card.tsx`, `frontend/src/locales/en.ts`
- Test: `frontend/src/features/roster/components/roster-card.test.tsx`

- [ ] **Step 1: Write failing tests** (existing collapse-on-load tests in `roster-card.test.tsx` must stay unchanged and green; add one if none covers "full, unfinalized roster on load starts collapsed"): a full, unfinalized roster that becomes `finalized: true` (cache update) collapses to the names line; the toggle is a button with `aria-expanded="false"` and a chevron icon (`aria-hidden`); expanding sets `aria-expanded="true"` and a `Hide racers` button collapses it again (only when the roster is full).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with a previous-finalized ref (same render-time pattern as the existing `collapsed && hasEmptySlot` adjustment). Key `roster.hideRacers` = `Hide racers`.
- [ ] **Step 4: Run** Vitest. Expected: PASS.
- [ ] **Step 5: Commit** `Collapse the racers card when the team is fully registered`.

### Task 9: End-to-end check, docs, and PR

**Files:**
- Modify: `tests/spa/*.spec.ts` as needed, `CLAUDE.md`, `README.md` (if it documents race admin fields)

- [ ] **Step 1:** Run `bin/check` (rspec, frontend, build, e2e). Expected: all steps pass; fix anything that fails and re-run.
- [ ] **Step 2:** Verify in a browser with Playwright MCP at 320px and desktop: finish a team on a race with confirmation text (mock payment), see the modal, close it, reload (no modal), confirm header and card. Check the email in Mailpit.
- [ ] **Step 3: Update CLAUDE.md:**
  - Replace the Internationalization `_md` bullets (the markdown initializer does not exist) with a note that `_html` keys are used.
  - Add a Registration SPA bullet: `races.confirmation_text` (Markdown, `ConfirmationText.to_html`, commonmarker + sanitize), `checklist.confirmation_html` / `show_confirmation`, `teams.confirmation_seen_at` (owner-only `POST /api/v1/teams/:id/confirmation`; staff never clear it; refinalize does not reset it), and the four stars mapping (team, racers, questions, fee; finalized = four).
  - Update the guided tour bullet's copy references.
- [ ] **Step 4: Update README** if it lists race admin fields or a launch step (add "fill in the race's confirmation text" to the yearly checklist in CLAUDE.md as well).
- [ ] **Step 5: Commit** `Document confirmation text and the four stars`.
- [ ] **Step 6:** `git push -u origin feature/296-completion-confirmation`; `gh pr create --repo chiditarod/dogtag --head ometa:feature/296-completion-confirmation --base main` with title `Completion confirmation and four labeled stars (#296, #297)`, a body summarizing the changes, "Stacked on #312; merge that first", the Gemfile (commonmarker) and migration callouts with the staging migrate + restart step, "Closes #296, closes #297", ending with the Generated with Claude Code line.
- [ ] **Step 7:** Message the dogtag-ee session with the PR URL and open questions.
