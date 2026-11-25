# Reskin: retire the legacy site into the SPA

Full design, worked out with the owner on 2026-11-24, including a mockup review of every new page. Approved by the owner 2026-11-24.

Mockups (static HTML, open in a browser) are in `docs/superpowers/specs/2026-11-24-reskin-mockups/`; each section names the one it follows. Where a mockup and this text differ, this text wins.

## Intent and why

The racer registration SPA (`frontend/`, served under `/register`) has proven itself on staging. The owner's goal is to **retire the entire old site**: every HAML page is either rebuilt in the SPA or dropped on purpose, and the legacy templates, Bootstrap 3, CoffeeScript, the vendored jsonform and the `REGISTRATION_UI` switch are then deleted. It is the owner's first priority.

Success: no request path renders a HAML page; racers and staff do everything they do today (minus the dropped items below) in the SPA; the repo no longer carries the legacy view stack.

## Goals

- Rebuild the remaining racer pages: account edit, password reset (finish), "Who's registered".
- Rebuild the staff pages: race list/setup (with requirements and tiers), registrations, CSV export, users (search, edit, roles, delete), sent emails log, and a staff view on the existing SPA team page.
- Point every email and entry point at SPA URLs, redirect old URLs, and serve `/` from the SPA.
- Put the Sidekiq dashboard behind the app's admin login.
- Delete the legacy racer pages and the legacy staff pages in two owner-timed cleanup PRs.

## Non-goals

- Changing email templates beyond their links (mailer views are not part of the site and stay as server templates).
- Translating staff pages (unchanged rule: admin pages are not translated).
- New staff capabilities beyond small parity fixes listed below.
- Moving the SPA base path from `/register` to `/` (option C, rejected).

## Anti-goals (a failure even if it works)

- Staff losing a capability they use during live registration (team edits, taking payment for an incomplete roster, exports, emails log) before its replacement ships.
- Removing the racer fallback before the owner says so. Registration opens 2026-12-01, likely moving to 2026-12-07 (owner, 2026-11-24; not final).
- Controllers reimplementing payment, Classy, email, finalization or time-zone logic instead of calling the existing code (`Payments::ChargeTeam`, `Payments::RefundCharge`, `Team#finalize`, `RaceTimeZone`, `Team.export`, ...).
- A page that scrolls sideways at 320px.

## Constraints

- All new UI in the SPA; no new HAML. Editing existing HAML (navbar links, the password-reset email link) is allowed until cleanup.
- The legacy racer flow keeps working until the racer cleanup PR (owner-timed).
- Stacked PRs, one concern each, opened against `chiditarod/dogtag`; never merged by us.
- Ask before Gemfile, `config/initializers`, `config/environments`, `config/application.rb` changes; call them out in the PR body (expected in the staff cleanup PR and possibly the Sidekiq PR).
- Every SPA feature: Vitest tests plus a Playwright spec in `tests/spa/` with its own `test_seeds:*` task added to `test_seeds:cleanup`.
- Bulletproof React feature folders; Chicago Flag tokens; staff pages in `StaffLayout`.
- JSON API under `/api/v1` (staff under `/api/v1/staff/*`), errors as `{ error, errors }`, authorization through `Ability`.

## Approaches

- **A. Per-area staff APIs plus SPA feature folders, the Payments pattern (chosen).** Each area gets `/api/v1/staff/*` endpoints authorized through `Ability`, jbuilder views and a feature folder. The first list page extracts the Payments table, filter, URL-state and pagination pieces into shared components. URLs stay under `/register` while old and new coexist; at cleanup `/` serves the SPA and old URLs redirect. More PRs, each ordinary to review, every step on a tested pattern.
- **B. Generic admin layer** (schema-driven CRUD API with auto screens, or react-admin). Fewer lines for simple lists, but race setup, tiers and JSONForm need custom screens anyway, it adds a dependency, and it fits neither the Chicago Flag look nor 320px. Rejected.
- **C. Move the SPA to `/` first, then port.** Clean URLs early, but collides with live legacy routes during coexistence and churns every e2e spec and email link before any page work. Rejected.

## Owner decisions (2026-11-24)

1. Retire all of the old site.
2. **Retirement timing, option A:** new pages ship alongside the old; the old racer pages are deleted in one cleanup PR once the SPA has carried live registration cleanly for a stretch the owner picks; the old staff pages are deleted in a second cleanup PR once staff have done their real work (registrations, exports, team edits, users) in the new pages. During coexistence a fix may need to land in both.
3. **Drop "Refund and invalidate"** (admin-only: refund and delete the completed requirement). Not rebuilt. An admin who truly needs it refunds on the Payments page, then removes the record in the Rails console.
4. **Drop the swag store** (`store/_main`, `store/_products.html`); no longer used.
5. Build approach A (above).

## Page map

### Rebuilt

| Legacy | SPA (basename `/register`) | Audience |
|---|---|---|
| `users#edit`, `/account` | `/account` | logged-in racer (self) |
| `password_resets#edit/update` | `/reset-password/:token` | logged out |
| `races#registrations` | `/races/:raceId/registrations` ("Who's registered") | logged-in; staff see extra columns |
| `homepages#index` | intro copy on the SPA landing (`/`), see Homepage | anyone |
| `teams#show` staff blocks, `teams#edit` staff fields | staff panel on `/teams/:teamId` | refunder (read), operator, admin |
| `races#index/new/edit/show` stats, `races#export` | `/staff/races`, `/staff/races/new`, `/staff/races/:raceId`, `/staff/races/:raceId/edit` | operator, admin |
| `requirements/*`, `tiers/*` | `/staff/races/:raceId/requirements/:requirementId` (and new) | operator, admin |
| `users#index/search/show/edit(roles)/destroy`, `teams#search` | `/staff/users`, `/staff/users/:userId` | refunder, operator (read); admin (edit, roles, delete) |
| `sent_emails#index` | `/staff/emails` | operator, admin |
| `/sidekiq` (unauthenticated unless env set) | unchanged screen, admin session required | admin |

### Dropped (no rebuild)

- `races#show` for racers (race list tiles cover it; the staff "Money collected" stat moves to `/staff/races/:raceId`).
- `users#show` (account edit covers racers; `/staff/users/:userId` covers staff).
- The per-payment Refund button on the team page (replaced by a link to Payments filtered to that team; one refund path).
- "Refund and invalidate" (owner decision 3).
- Swag store (owner decision 4).
- `teams#index` legacy (SPA `/teams` already lists the user's own teams; staff list teams through registrations).
- Dead code: `teams/mush.html.haml`, `teams/_notify_waitlisted`, the `mush!` race-form subtitle.
- Outdated homepage sections (browser requirements, slow Heroku emails, "unknown" placeholder racers, bugs link). See Homepage.

## Design by area

### 1. Sidekiq lock-down

Require an admin Authlogic session for `/sidekiq` via a routes constraint (`constraints AdminConstraint` around the mount; the constraint reads the Authlogic session from the request). Non-admins get 404. Keep the optional basic auth as a second layer only if it is free to keep; if fail-closed behavior needs `config/initializers/sidekiq.rb` changes, ask first. Request spec: anonymous and non-admin 404, admin 200.

### 2. Account and password reset (racer)

- `PATCH /api/v1/me`: first_name, last_name, email, phone, password, password_confirmation. Same rules as legacy `users/_form` (password optional, min 8, confirmation required when set; email downcased; no roles). Returns the `me` payload. **Owner decision (2026-11-24, mockup `account-v2`): every self-edit requires `current_password`** (name, email, phone or password); a wrong or missing one is 422 with `errors.current_password`, and nothing is saved. Staff editing another user on `/staff/users/:userId` do not need it. **Call:** the legacy `users#update` gets the same check for self-edits (a small edit to the existing form and controller), so `/account` on the old site is not a way around it during coexistence.
- `PUT /api/v1/password_resets/:token`: password + password_confirmation, both required; uses the perishable token (3 h); on success logs the user in and returns `me`. Invalid/expired token: 422 with a message telling them to request a new link.
- `GET /api/v1/password_resets/:token`: returns `{ email }` for a valid token, 404 for an unknown or expired one (no other detail), so the page can show the expired state before anyone types. **Call.**
- SPA `/account` (behind `RequireAuth`), linked from `UserMenu`. SPA `/reset-password/:token` (logged out): heading "Choose a new password", "For <email>", new + confirm fields, "Save new password"; an expired or used link shows "This link has expired" with "Send me a new link" (to `/forgot-password`); on success the user is logged in and lands on `/teams` with "Your password is changed and you're logged in." (mockup `password-reset-v1`).
- Password-reset email: link through a new `RegistrationUi.password_reset_url(token)` (SPA path when `spa?`, legacy otherwise). Replace the deliberate legacy-link step in `tests/spa/password-reset.spec.ts` with the SPA page.
- Legacy `password_resets#update` stays as is until racer cleanup.

### 3. Who's registered (racer and staff)

- `GET /api/v1/races/:race_id/registrations` (any logged-in user, `can :registrations, Race`). Returns `filter_fields` (labels from `race.filter_field_array`) and two lists:
  - `finalized`: finalized teams.
  - `registering`: unfinalized teams. Section title is "Waitlist" when `race.full?` (ordered by `waitlist_position`, i.e. `created_at`), else "Still registering" (ordered by `updated_at DESC`). **Call:** this replaces the legacy panel that labels every unfinalized team "waitlisted".
  - Per team for everyone: id, name, description, percent_complete, team experience label, racer experience sum, filter-field answers, `can_show`, `deletable` (only true for teams the viewer may delete).
  - Staff extras (admin, operator, refunder, decided server-side): payments "X of Y paid" and updated_at, `assigned_team_number`, new-team label. For admin/operator also the owner emails per list for a bcc mailto (`dogtag@chiditarod.org`, bcc owners) and all registered racer emails.
- SPA `/races/:raceId/registrations`: per-section client search (team name) and per-filter-field selects; table from `sm`, cards below. This is the first new list, so this PR extracts the shared list parts (area 4, first bullet) and Payments switches to them. Linked from the race tiles. Delete uses the existing `DELETE /api/v1/teams/:id` and `DeleteTeam` confirmation.
- **Owner decisions (mockups `whos-registered-v1`, `whos-registered-desktop-v1`):** the two lists are tabs, "Registered (N)" and "Still registering (N)" (or "Waitlist (N)" with `#position` when the race is full), not stacked sections. The staff view as mocked is approved: team number, payments "X of Y paid" with relative time, "New team" tag, and "Email all racers (bcc)" / "Email team owners (bcc)" buttons for the current tab (not for refunders). The route is wide (`handle: { wide: true }`). Racers on a phone get cards; filters sit behind a "Filters (n)" sheet below `sm`.
- Fixes the legacy column misalignment bug by construction.
- Query count: add the endpoint to `spec/requests/api/v1/query_count_spec.rb`.

### 4. Users, Sent emails (shared list parts come from PR 2)

- The shared list parts, extracted in PR 2 (Who's registered): from `features/staff-payments` into `components/` (or `features/staff/components`): URL-state filters hook (generic keys), debounced `SearchBox`, `FilterChips`, `Pagination` (strings passed in), responsive `role=table` list (table from `sm`, cards below, `grid-cols-[minmax(0,1fr)]`), result-count `role=status` line. Payments switches to them with no behavior change (its Playwright spec must still pass unchanged).
- `GET /api/v1/staff/users?q=&page=`: one search box over first/last name, email and team name (fixes the legacy multi-word bug), 35 per page, ordered by last_name. Rows: name, email, phone, teams (name, race, link), roles. Refunder, operator, admin read.
- `GET /api/v1/staff/users/:id`, `PATCH` (admin: name, email, phone, roles), `DELETE` (admin). **Call:** refuse deleting yourself, and refuse any user who owns any team or has any completed requirement (422 telling the admin to delete or reassign the teams first). `User has_many :teams` has no `dependent:` and `teams.user_id` no foreign key, so a legacy delete leaves ownerless teams that break the team page, `Team.export` and `Ability`; no schema change is needed with this guard.
- SPA `/staff/users`, `/staff/users/:userId` (profile, teams linking to the SPA team page, payments link to Payments filtered by that user's email, roles editor for admins only; operators no longer see a roles field they cannot save).
- **Users pages (mockup `users-emails-v1`, owner approved in review):** one row per person (legacy repeated a person per team) with name, email, phone, teams (with race year) and role tags; 35 per page. The user page has Details (editable by admins only, no current password), Roles (checkboxes with a one-line description of each role, admins only; **call:** an admin cannot remove their own Admin role), Teams (race and status), links to that user's payments and emails, and "Delete user" disabled with the reason when the guard applies.
- **Emails sent (same mockup):** recipient search, Status (Sent, Queued, Failed; MXRoute reports nothing after "sent", so older statuses show as-is but are not offered as filters; **call**) and Kind (plain-word names for each `kind`) selects, a removable Team chip when opened from a team or user page, newest first, failed rows show the error under the status, queued rows show for how long. Phone: cards and a Filters sheet.
- `GET /api/v1/staff/sent_emails?team_id=&status=&kind=&recipient=&page=`, 25 per page, `created_at DESC`. Columns: sent, kind, recipient, subject, team (link), status, changed, error. Operator and admin.
- SPA `/staff/emails` with URL filters.
- `StaffLayout` nav is role-aware (introduced in PR 5): Races (operator/admin), Users (refunder/operator/admin), Emails (operator/admin), Payments (refunder/operator/admin), plus `Legacy admin` until staff cleanup. One helper maps roles to nav items; the server stays the authority.

### 5. Staff view of the team page

- `GET /api/v1/staff/teams/:id` (refunder, operator, admin): team number, new-team label and setting, collaborating, racing-with names, captain contact, account holder (name, email, link to `/staff/users/:id`), sent-emails count. Kept out of the racer team payload.
- SPA `/teams/:teamId` renders a `StaffTeamPanel` when `isStaff(me)`: the fields above, `new_team_setting` select (operator/admin, through the existing `PUT /api/v1/teams/:id`, which already permits it only for staff), link to `/staff/emails?team_id=`, link to `/staff/payments?team_id=` per payment (replaces the Refund button).
- `Payments::PaymentSearch` gains a `team_id` filter (shown as a chip).
- **Layout (mockup `team-staff-v1`, owner approved in review):** on laptop the Staff card ("only staff see this", dark border) sits under `TeamHeader` in the left rail; on a phone it is a collapsed "Staff details" card near the top with a one-line summary. When registration is closed for racers, staff see a note "The racers can no longer change this team; you can, as staff." and the edit controls. "Pay $X as staff" is an outlined button under a warning naming the gap (roster N of M); it goes through the normal payment path. Paid rows link "Refund on Payments". Refunders see the Staff card and links read-only, no edit controls and no staff Pay.
- **Parity, money:** staff may take payment for an incomplete roster (`Payments::ChargeTeam` already allows it; the SPA fee card hides Pay behind `fee.rosterFirst`). For staff viewers the fee card shows Pay on an incomplete roster with a one-line note. This removes the last reason staff need the legacy team page.
- **Parity, editing windows:** staff see edit controls (racers, captain, questions, team details, delete when deletable) whenever the server allows staff, not only while registration is open.

### 6. Race setup (staff)

- `GET /api/v1/staff/races` (list: name, race date, registration status, teams finalized/total; newest first), `POST`, `GET /:id`, `PATCH /:id` (operator, admin), `DELETE /:id` (admin). **Call:** `DELETE` refuses a race that has any teams.
- Race fields: name, time_zone, registration_open, registration_close, final_edits_close, race_datetime, max_teams, people_per_team, jsonform, filter_field (array; server joins as `prepare_params` does), experience_labels_text, classy_campaign_id, classy_default_goal, confirmation_text.
- **Time zones:** the SPA sends wall-clock datetimes without offset (`2026-12-01T00:00:00`) plus `time_zone`; the controller includes `RaceTimeZone` so parsing happens in the submitted zone exactly as legacy. Inputs are `datetime-local` with the zone name shown beside them; changing the zone shows an inline note that the times are now read in the new zone (replaces the legacy flash). Deadline fields carry a hint that midnight means "through 11:59 PM the day before" (`formatDeadline` already displays it that way). Specs run under Zonebie: build expected times with explicit zones.
- **Form layout (owner chose A, mockup `race-setup-v1`):** one page of section cards (Basics, Dates, Questions, Experience choices, Fundraising, Confirmation text) with a Save bar stuck to the bottom; server errors show under each field and the page scrolls to the first.
- **Date input and checks (mockup `race-dates-v1`):** each date is a native `datetime-local` input (minute precision) with the race zone's abbreviation for that date beside it (CST/CDT via `Intl`) and a green "Racers see: ..." line using the same formatters racers get (`formatDeadline` for the three deadlines). The SPA sends only the date fields the user changed (so an existing value with seconds is not rewritten), as wall-clock strings plus `time_zone`. Checks: (1) the input itself only yields a real date and time or empty; empty is "Enter a date and time"; (2) on blur and before Save the SPA applies the server's order rule (registration opens < registration closes < final edits close < race day) and names the other field and its value; (3) a time that does not exist in the zone (spring-forward gap) is refused with a plain message, in the SPA and on the server (the server checks the parsed time's wall clock equals the input); (4) a date in the past is a non-blocking warning; (5) the server stays the authority: `RaceValidator` (presence, parse, order, and add `final_edits_close` to `datetimes_parse?`) with field-keyed errors in readable words ("must be before Race day", not "must come before race_datetime"). Changing the zone keeps the wall-clock values (as legacy) and shows a note to recheck them. Tiers' `begin_at` uses the same input and checks except the order rule.
- **Kept additions (owner, 2026-11-24):** the races list has a "Setup" column flagging what would stop racers paying or finishing (no enabled fee, a fee with no price tier, a JSONForm that does not parse); the API returns `setup_problems: [String]` per race. The confirmation text card has a live preview rendered by the server (`POST /api/v1/staff/confirmation_preview { text }` -> `{ html }` through `ConfirmationText.to_html`, debounced; **call**), with the character count against `CONFIRMATION_TEXT_MAX_LENGTH`.
- **JSONForm editor:** monospace textarea; client-side `JSON.parse` error with line/column; live preview rendering the questions with the existing `features/questions` renderer (read-only, `showWhen` honored); `filter_field` options derived from the current editor contents. Server validation stays `RaceValidator` (including the `showWhen` required-field rule); its errors show through `FieldErrors`.
- `GET /api/v1/staff/races/:id` also returns `money_collected_cents` (legacy `stats['money_raised']`).
- **Export:** `GET /api/v1/staff/races/:id/export.csv[?finalized=true]` calls `Team.export` unchanged, same filename and content type; plain download links (same-origin cookie). Operator, admin.
- SPA `/staff/races` (list), `/staff/races/new`, `/staff/races/:raceId` (overview: status, dates, money collected, links to registrations, edit, exports with the existing "Secret Gentlemen, The" info tip, mailto all racers, and a `Start a team` link to the SPA `/races/:raceId/teams/new` at any time, since `Race#accepts_new_teams_from?` already lets admins and operators create teams outside the open window; parity with legacy), `/staff/races/:raceId/edit`.

### 7. Requirements and tiers (staff)

- `/api/v1/staff/races/:race_id/requirements` (`GET`, `POST`), `/api/v1/staff/requirements/:id` (`GET`, `PATCH`; `DELETE` admin), `/api/v1/staff/requirements/:requirement_id/tiers` (`POST`), `/api/v1/staff/tiers/:id` (`PATCH`; `DELETE` admin).
- Requirement fields: name (with the legacy naming instructions as help text), type from `Requirement.allowed_types` (mock only outside production). Tier fields: price, begin_at (race zone, via `RaceTimeZone` with the requirement's race). `TierValidator` uniqueness errors surface per field. **Call:** price is entered in dollars in the SPA and sent as cents.
- **Call, data safety:** `DELETE` of a requirement refuses when it has completed requirements (legacy orphaned them); `DELETE` of a tier refuses when it is the requirement's only tier and the requirement has completed requirements. Delete buttons are shown to admins only (legacy showed them to operators, who then got a permission error).
- **Fee pages (mockup `fees-v1`, owner approved in review):** staff copy says "fee" for requirement and "price" for tier. The fee page shows name (editable), type (set only when the fee is created; **call**), status ("Racers can pay" or not), a "Right now" card (current price and since when, next price and from when, how many teams paid, link to Payments filtered to that fee), and a "Prices by date" table (price, starts, Current/Next/Past) with inline add and edit using the race-date input and its "Racers pay $X from ..." line. Checks: whole dollars, $1 or more (**call**); `TierValidator` duplicates (same price or same start) as field errors; a warning (not blocking) when the first price starts after registration opens. "Delete fee" is disabled with the reason when any team has paid it. "Add a fee" takes name, type and the first price plus start (prefilled with registration opening) in one step (**call**; legacy needed a second page).
- SPA: requirements listed on `/staff/races/:raceId` (name, enabled or "action required", tier count); `/staff/races/:raceId/requirements/:requirementId` shows the requirement form and its tier table with inline add/edit.
- **Staging e2e:** `tests/e2e/race-setup.spec.ts` and `admin-forms.ts` drive the legacy race/requirement/tier forms. Port them to the new pages in this PR; the staff cleanup cannot land until they no longer touch legacy pages. The operator-only and `Race E2E ` safety rules are unchanged.

### 8. Homepage and links

- The SPA landing (`/register/`, the race list) gets an intro card above "Choose your race" (owner chose layout B, mockup `homepage-v2`): heading "Register for CHIditarod", tagline "Chicago's annual urban shopping-cart race and mobile food drive." (laptop), a one-line summary "Start a team, add N racers, answer the questions and pay the fee to register your team." and a disclosure "How registration and the waitlist work" that opens four steps (1 Make an account and start a team for the race. 2 Add all N racers. 3 Answer the team questions and pay the fee. 4 Your team is registered. We'll send you a confirmation email with your team number.) and the waitlist line (first come, first served; unfinished teams go on the waitlist in the order they started; change your team until registration closes). N is the race's `people_per_team` (with several open races, use the soonest open race's value, or drop the number). Laptop: intro left, race list right. Copy in `en.ts`; the old outdated sections are dropped.
- Until racer cleanup, legacy `/` stays and its "Get started" keeps switching on `RegistrationUi`.
- Legacy navbar: admin dropdown items point to the new staff pages as each ships.

### 9. Racer cleanup (owner-timed)

- Delete racer controllers and views: homepages, users (new/create/show/edit/update), user_sessions, password_resets HTML, races index/show/registrations, teams, people, questions, captains, charges (create), store, the racer jsonform JS.
- `/` 301-redirects to `/register` (the SPA base path stays `/register`; the router is not changed). Old racer URLs 301 to SPA equivalents: `/races` -> `/register`, `/races/:id` -> `/register`, `/races/:id/registrations` -> `/register/races/:id/registrations`, `/teams` -> `/register/teams`, `/teams/:id` (and its nested people/questions paths) -> `/register/teams/:id`, `/account` and `/users/:id/edit` -> `/register/account`, `/login` paths -> `/register/login`, `/password_resets/:token/edit` -> `/register/reset-password/:token` (emails sent before the deploy carry the old link).
- Remove `RegistrationUi` and `REGISTRATION_UI`; emails link SPA URLs unconditionally. Update README, CLAUDE.md, the launch runbook and Heroku config var lists.
- Racer-facing legacy specs are deleted or replaced by request specs on the redirects. `tests/e2e/registration.spec.ts` must already use only SPA racer pages (verify; port anything left).

### 10. Staff cleanup (owner-timed, after 9)

- Delete staff controllers and views (races HTML, requirements, tiers, users HTML, sent_emails, charges refund HTML action, teams search), the application layout and navbar, error ERB pages replaced by static pages in the new look, `app/assets` legacy JS/CSS, the vendored jsonform.
- Old staff URLs redirect to `/register/staff/...` equivalents.
- Gem and asset-pipeline removals (coffee-rails, sass-rails, jQuery/Bootstrap/select2/tablesorter gems, possibly sprockets if mailers do not need it): owner approval required, called out in the PR body. Check mailer layouts do not depend on the asset pipeline before removing it.
- Remove the `Legacy admin` nav link.

## Testing

Each PR: RSpec request specs (status plus data changes, `Ability` per role), Vitest for components and hooks, a Playwright spec in `tests/spa/` with its own seed task, checked at 320px. Seeds: `test_seeds:account`, `test_seeds:who_registered`, `test_seeds:staff_users_emails`, `test_seeds:staff_team_panel`, `test_seeds:staff_races`, `test_seeds:staff_requirements`. Cleanup PRs: request specs for every redirect, including `/` to `/register`. Run e2e with a separate `DATABASE_URL` (see CLAUDE.md E2E Learnings) and state in each PR whether it ran.

## PR plan (stacked, in order)

| # | PR | Concern | Model / effort (build) |
|---|---|---|---|
| 1 | Account and password reset (area 2) | racer auth, data | Sonnet high |
| 2 | Who's registered, shared list parts extracted from Payments (area 3, area 4 first bullet) | racer + staff data exposure by role | Sonnet high |
| 3 | Homepage intro on the SPA landing (area 8) | copy | Sonnet medium |
| 4 | Sidekiq admin-only (area 1) | security | Sonnet high |
| 5 | Race setup: list, form, overview, export, role-aware staff nav (area 6) | launch-critical data | Sonnet high |
| 6 | Requirements and tiers, staging e2e port (area 7) | launch-critical money config | Sonnet high |
| 7 | Users, Sent emails (area 4) | roles, user delete | Sonnet high |
| 8 | Staff team panel, staff Pay on incomplete roster, Payments `team_id` filter (area 5) | money | Sonnet high |
| 9 | Racer cleanup (when the owner says) | deletes, redirects | Sonnet high |
| 10 | Staff cleanup (when the owner says) | deletes, gems | Sonnet high |

Every PR is reviewed by Opus high. PRs 1-8 remove no legacy page, so each can ship while registration is live. The role-aware staff nav arrives in PR 5 with the Races item and grows as each staff page ships; each staff PR also points the legacy navbar's admin dropdown item at its new page.

### Timing around the registration opening (2026-12-01, likely moving to 2026-12-07)

- **Owner:** racer pages first. Staff keep using the legacy pages until their replacements ship, including setting up the 2027 race, its fees and tiers in the legacy race pages.
- **Proposal (owner unsure):** freeze from the day before the opening until two days after it: nothing merges or deploys while registration opens. With a 2026-12-07 opening that is 2026-12-06 to 2026-12-09 (with 2026-12-01 it would be 2026-11-30 to 2026-12-03). Racer PRs that are reviewed and on staging before the freeze may go to production up to the day before it starts; anything later waits for the freeze to end. PRs 1-3 add no migrations.

## Calls made in this design (not owner decisions)

- Emails stay server templates; only their links change.
- Sidekiq behind an admin session; error pages become static pages in the new look.
- "Who's registered" splits "Waitlist" (race full) from "Still registering".
- Guards the legacy pages lacked: no self-delete, no deleting a race with teams, no deleting a requirement with completed requirements; delete buttons only for roles that can use them.
- Price entered in dollars; staff team data on a separate staff endpoint; one search box on Users.
- Homepage folded into the SPA landing intro; outdated sections dropped.
- Legacy self-edit gets the same current-password check (owner decided the rule for the SPA).
- `GET /api/v1/password_resets/:token` so the reset page can show the email or the expired state on load.
- Race form sends only changed dates; changing the zone keeps wall-clock times; nonexistent (DST gap) times are refused.
- Server-rendered confirmation-text preview endpoint; `setup_problems` per race for the Setup column.
- Fees: whole dollars, $1 or more; type fixed after creation; the first price is set when the fee is created.
- An admin cannot remove their own Admin role.
- Emails sent: Status filter offers only Sent, Queued, Failed.
- Mockups copied next to this document so builders in other sessions can open them.
- Within the owner's order (racer pages first, then staff): Sidekiq first among the staff PRs, race setup before users and the team panel; the shared list parts are extracted with the first list (Who's registered).
- The freeze window and its fallback (the owner was unsure; this is the proposal).
- Deleting a user is refused while they own any team or have any payment.
- `/` 301-redirects to `/register` at racer cleanup.
- Staff can start a team at any time from the staff race page (legacy parity).

## Left to the builder

- Exact component names and file layout inside the feature folders.
- Copy for staff pages (untranslated), within the existing tone.
- How the Sidekiq constraint reads the Authlogic session.
- Card vs table breakpoints per list, within the 320px rule.
