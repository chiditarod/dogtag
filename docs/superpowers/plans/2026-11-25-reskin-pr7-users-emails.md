# Reskin PR 7: Users and Emails sent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Refreshed on 2026-11-26 against PR 6 (`8a6ab70`, includes PR 5) merged with PR 2 (`4a08183`, includes PR 1); PR 7 is stacked on PR 6 and PR 2.

**Goal:** Staff search, open, edit and (admins) delete user accounts, and operators and admins read the sent-emails log, in the SPA under `/register/staff/users`, `/register/staff/users/:userId` and `/register/staff/emails`. Legacy users and sent-emails pages keep working.

**Architecture:**
- Server:
  - `Api::V1::Staff::UsersController` (index, show, update, destroy) over a new `Users::StaffSearch` service, built like `Payments::PaymentSearch`.
  - `Api::V1::Staff::SentEmailsController` (index).
  - One delete guard on the model (`User#deletion_blocker`), shared by the API and the legacy `users#destroy`.
  - `SentEmail::KINDS` names every email kind.
- SPA:
  - Two feature folders, `features/staff-users` and `features/staff-emails`.
  - Both are built from PR 2's shared list parts in `frontend/src/components/list/`: `ListTable`/`ListRow`/`ListCell`, `SearchBox`, `FilterChips`, `Pagination`, `ResultCount`, `useUrlFilters`.
  - Users and Emails join `STAFF_NAV` (`features/staff/nav.ts`), the Emails route is guarded with PR 5's `RequireStaff roles={rolesFor(...)}`, and the legacy navbar points at the new pages.
  - The user page's edit forms follow PR 5/6's forms: `useLeaveGuard` + `DiscardDialog` ("Discard changes?") before leaving unsaved changes, and the shared `NotFound` on a 404.

**Tech Stack:** Rails 8, jbuilder, CanCanCan, RoleModel, manual limit/offset paging as in `PaymentSearch`, RSpec request/model specs; React 19 + TypeScript, react-router-dom 7, TanStack Query 5, Tailwind, Vitest + MSW; Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-reskin-design.md`, area 4 ("Users, Sent emails"), plus "Constraints", "Calls made in this design", "Testing". Mockup: `docs/superpowers/specs/2026-11-24-reskin-mockups/users-emails-v1.html`. Roadmap: `docs/superpowers/plans/2026-11-24-reskin-roadmap.md`.

**Branch:** `feature/reskin-7-users-emails`, cut from PR 6 (`feature/reskin-6-fees`, #361, tip `8a6ab70`, which carries PR 5 #359) with PR 2 (#351, `feature/reskin-2-whos-registered` at `4a08183`, which carries PR 1) merged in (`9933456`). This plan imports PR 2's `components/list/*`, `formatDate`/`formatSince` from `lib/dates.ts`, the `email_changed` mail kind from PR 1, and PR 5/6's `STAFF_NAV`/`staffNavItems`/`rolesFor`, `RequireStaff roles`, `useLeaveGuard`, `DiscardDialog` and `NotFound`. Build: Sonnet high. Review: Opus high.

## Global Constraints

- All new UI in the SPA; no new HAML. The only legacy view edits are in `app/views/application/_navbar.html.haml`. The one legacy controller change is the `users#destroy` guard (Task 1).
- Legacy `users#index/show/edit/update/destroy`, `teams#search` and `sent_emails#index` keep working (staff use them until the staff cleanup PR).
- API errors are `{ error, errors }` through `render_errors`; strong params use `params.expect`.
- Authorization goes through `Ability`. All endpoints inherit `Api::V1::Staff::BaseController` (`require_api_user!` + `authorize!(:refund, :charges)`), so racers get 403 and logged-out users 401.
  - As in PR 5/6's staff controllers, each action first authorizes against the class in a `before_action` (e.g. `before_action -> { authorize!(:destroy, User) }, only: [:destroy]`), before the record is loaded, so a role without the action gets 403, never 404, even for an unknown id. The action then authorizes the loaded record.
  - Users read: `:index, User` / `:show, user` (refunder, operator, admin).
  - Users write: `:staff_update, user` / `:destroy, user`. Only `can :manage, :all` grants these, so admin only. Never authorize the staff PATCH with `:update`: every user `can :update` themselves, so an operator could grant themselves roles.
  - Emails: `:index, SentEmail` (operator, admin).
- Staff copy is untranslated English, still through `t()` with flat `staff.users.*` / `staff.emails.*` keys in `frontend/src/locales/en.ts`.
- Pages work at 320px with no horizontal scroll and render in `StaffLayout`. Use Chicago Flag tokens and the existing `Card`, `Field`, `Input`, `Button`, `ButtonLink`, `Badge`, `DialogSheet`, `QueryLoading`, `QueryError`, `NotFound` (`components/ui/not-found.tsx`), `DiscardDialog` and `useLeaveGuard` (`components/ui/`).
- No migrations. No new npm or gem dependencies. No Gemfile, initializer, environment or `spec_helper.rb` changes.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and says whether the e2e spec ran.

## Calls made in this plan (not in the spec)

- **Search is AND over words.** Each whitespace-separated word must match first name, last name, email, or the name of a team the user owns. "Ada Racer" and "ada doge" both find Ada.
- **The delete guard also blocks the legacy `users#destroy`**, with the same reasons. The legacy page can leave ownerless teams today, and staff still use it during coexistence. The guard also covers users who made refund batches (`refund_batches` is already `restrict_with_error`), so the reason names them instead of failing generically.
- **Team links go to the legacy `/teams/:id` page**, as PR 2 does for staff. The SPA team page assumes the team's owner until PR 8 adds the staff view, and PR 8 switches these links. The spec text says "linking to the SPA team page"; the owner may prefer to wait for PR 8.
- **"Payments by this user"** links to `/staff/payments?race_id=all&q=<email>`; without `race_id=all`, Payments shows only the default race. **"Emails to this user"** links to `/staff/emails?recipient=<email>`. Each team row on the user page also has an "Emails" link to `/staff/emails?team_id=<id>`, which is how a Team chip comes from the user page.
- **Refunders still land on Payments at `/staff`.** The nav order follows the spec (Races, Users, Emails, Payments), but the index redirect uses `staffLandingPath`: Races if visible, else Payments. That keeps `tests/spa/staff-shell.spec.ts` unchanged.
- **The Emails route sits under PR 5's `RequireStaff roles={rolesFor('/staff/emails')}`**, as the Races routes do, so a refunder who opens `/staff/emails` sees `NotAllowed` instead of a generic 403 error. The Users routes need no extra guard: every staff role may open them.
- **The legacy navbar's "Search" item becomes "Users"** (→ `/register/staff/users`, the existing `application.navbar.users` key), and "Emails" (→ `/register/staff/emails`, `can?(:index, SentEmail)`) is added. **"New" (`new_user_path`) is removed from the admin dropdown** (owner decision, 2026-11-25): staff never create accounts. Users always sign up themselves (`/register/signup`); to give someone elevated privileges, they sign up first and an admin grants roles on their user page (Task 8 `UserRolesCard`). The public sign-up links (logged-out "Register", the login page's "Sign up") are unchanged, and no create-user page is built now or in the staff cleanup PR.
- **The emails list shows a Changed column** (`status_changed_at`), as the spec lists, although the mockup omits it. A queued row reads "Queued for N min" from `status_changed_at || created_at`.
- **A user page with unsaved details or roles asks "Discard changes?" before leaving**, like PR 5/6's race and fee forms. An unknown user id shows the shared `NotFound`, as the fee page does, rather than a page of its own.
- **Staff edits save with `save_without_session_maintenance`**, so an admin editing another user never touches their own session. An email change still sends PR 1's `email_changed` notice to the old address, because it is an `after_update_commit` on `User`.

## Review Focus

1. An operator (or refunder) PATCHing their **own** user through `/api/v1/staff/users/:id` with `roles: ["admin"]` gets 403, and their roles are unchanged. An operator's PATCH or DELETE of an unknown id is also 403, not 404. Owner: Task 4 spec.
2. An admin PATCHing their own roles without `admin` gets 422 `errors.roles` and keeps Admin. Another admin's Admin role can be removed. Owner: Task 4 spec, Task 8 Vitest (checkbox disabled).
3. DELETE is refused (422, user still there) for self, for a user who owns a team, and for a user with a completed requirement. Only a user with none of these is deleted, and the legacy `users#destroy` refuses the same cases. Owner: Task 1 and Task 4 specs.
4. The users and sent-emails index endpoints run the same number of queries for 1 row as for many. Owner: Task 3 and Task 5 query-count examples.
5. A two-word search ("<first> <team word>") finds the user, while a word that matches nothing returns no rows. Owner: Task 2 spec, Task 10 e2e.

---

### Task 1: Delete guard, `SentEmail` kinds and associations

**Files:**
- Modify: `app/models/user.rb`, `app/models/sent_email.rb`, `app/controllers/users_controller.rb` (`destroy`), `config/locales/en.yml` (legacy flash only if needed)
- Create: `spec/factories/sent_email.rb` (there is no `:sent_email` factory yet; `spec/models/sent_email_spec.rb` builds rows with `SentEmail.create!`)
- Test: `spec/models/user_spec.rb`, `spec/models/sent_email_spec.rb`, `spec/controllers/users_controller_spec.rb`

**Interfaces:**
- Produces:
  - `User#deletion_blocker(by:) -> String | nil`. It returns the first that applies:
    - `by.id == id` → `"You can't delete your own account."`
    - teams exist → `"Owns #{n} #{"team".pluralize(n)}. Delete or reassign them first."`
    - completed requirements exist → `"Has #{n} #{"payment".pluralize(n)}."`
    - refund batches exist → `"Made refunds, which are kept as a record."`
    - otherwise nil.
  - `SentEmail::KINDS = %w[welcome team_finalized team_waitlisted refund email_changed password_reset classy_fundraising registration_reminder feedback].freeze`.
  - `SentEmail::FILTER_STATUSES = %w[sent queued failed].freeze`.
  - `SentEmail belongs_to :team, optional: true` and `belongs_to :user, optional: true`. There is no FK, so a deleted team reads as nil.
  - Factory `:sent_email`: `kind "welcome"`, `recipient` sequence `@example.com`, `subject`, `status "sent"`, `status_changed_at { Time.current }`.
  - Legacy `UsersController#destroy`: when `deletion_blocker(by: current_user)` is present, `flash[:error]` gets the reason and it redirects to `users_path` without destroying. Otherwise it keeps today's `try_to_delete(@user, users_path)` and its `errors.full_messages` fallback.

- [ ] **Step 1:** Write failing examples:
  - `deletion_blocker`: self → the self message. A user with a `:team` → "Owns 1 team. ...". A user with a `:completed_requirement` and no team → "Has 1 payment.". A user with a `:refund_batch` → the refunds message. A bare user viewed by an admin → nil.
  - `sent_email_spec`: every `track(kind: "...")` literal in `app/mailers/*.rb` (read the files, scan `/track\(kind: "([a-z_]+)"/`) is in `KINDS`. `SentEmail.new(team_id: 0).team` is nil.
  - `users_controller_spec`: an admin `DELETE` of a user who owns a team leaves the user and sets `flash[:error]` to the reason. Deleting a bare user still works.
- [ ] **Step 2:** Run `bundle exec rspec spec/models/user_spec.rb spec/models/sent_email_spec.rb spec/controllers/users_controller_spec.rb` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Refuse deleting a user who owns teams, has payments, or is yourself; name the email kinds`

### Task 2: `Users::StaffSearch`

**Files:**
- Create: `app/services/users/staff_search.rb`
- Test: `spec/services/users/staff_search_spec.rb`

**Interfaces:**
- Produces:
  - `Users::StaffSearch.new(q: nil, page: nil)`, with `PER_PAGE = 35` and `MAX_PAGE = 10_000`. `page` is parsed and clamped exactly as in `PaymentSearch`.
  - `#users -> Array<User>`:
    - `User.reorder(:last_name, :first_name, :id)` with `includes(teams: :race)`, then `limit`/`offset`.
    - For each word of `q.to_s.split` (sanitized with `sanitize_sql_like`): `(users.first_name ILIKE :w OR users.last_name ILIKE :w OR users.email ILIKE :w OR EXISTS (SELECT 1 FROM teams WHERE teams.user_id = users.id AND teams.name ILIKE :w))`, ANDed. A blank `q` lists everyone.
  - `#meta -> { page:, per_page: 35, total_count:, total_pages: }`. Compute `total_count` with `unscope(:order).count`, because `User`'s `default_scope` orders by `last_name`.

- [ ] **Step 1:** Write failing examples:
  - ordering by last name then first name;
  - `"ada racer"` finds Ada Racer and not Bea Racer;
  - `"ada doge"` finds Ada through her team "Doge Sled";
  - `"zzz"` → `[]`;
  - `"100%"` does not match everyone (LIKE escaping);
  - 36 users → page 1 has 35, page 2 has 1, `total_pages` 2;
  - `page: "junk"` → 1.
- [ ] **Step 2:** Run `bundle exec rspec spec/services/users/staff_search_spec.rb` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add a staff user search that matches every word against name, email or team`

### Task 3: Staff users API, reading (`index`, `show`)

**Files:**
- Create: `app/controllers/api/v1/staff/users_controller.rb`, `app/views/api/v1/staff/users/index.json.jbuilder`, `show.json.jbuilder`, `_staff_user.json.jbuilder`
- Modify: `config/routes.rb` (inside `namespace :api` > `namespace :v1` > `namespace :staff`: `resources :users, only: [:index, :show, :update, :destroy]`), `spec/requests/api/v1/query_count_spec.rb`
- Test: `spec/requests/api/v1/staff/users_spec.rb`

**Interfaces:**
- Consumes: `Users::StaffSearch`, `User#deletion_blocker`, `Race#local`.
- Produces:
  - Class-level `before_action`s: `authorize!(:index, User)` (index), `authorize!(:show, User)` (show), `authorize!(:staff_update, User)` (update), `authorize!(:destroy, User)` (destroy), then `load_user` (`User.find`) for show, update and destroy.
  - `GET /api/v1/staff/users?q=&page=` (`authorize! :index, User`) → `{ users: [StaffUserRow], meta: { page, per_page, total_count, total_pages } }`.
    - `StaffUserRow = { id, first_name, last_name, email, phone, roles: String[], teams: [{ id, name, race: { id, name, year } }] }`.
    - `year` is `race.local(race.race_datetime).year`. Teams come newest race first.
  - `GET /api/v1/staff/users/:id` (`authorize! :show, user`) → `{ user: StaffUser }`. `StaffUser` = the row fields plus:
    - `created_at`;
    - `teams: [{ id, name, finalized, assigned_team_number, percent_complete, race: { id, name, year } }]`;
    - `can_edit` (`can?(:staff_update, user)`), `can_destroy` (`can?(:destroy, user)`);
    - `is_self`;
    - `delete_blocker` (`user.deletion_blocker(by: current_user)`, sent only when `can_destroy`; else nil).
  - Unknown id → 404 through the base controller's `RecordNotFound` handling (for a role that passes the class-level check).

- [ ] **Step 1:** Write the failing request spec:
  - logged out → 401;
  - `:user` → 403 on index and on show of **their own** id;
  - `:refunder_user` and `:operator_user` → index 200, ordered by last name, `meta.per_page == 35`, a user with two teams shows both with the race year;
  - `q=` multi-word works through the endpoint;
  - show 200 for the operator with `can_edit` false, `can_destroy` false, `delete_blocker` nil;
  - `:admin_user` viewing a team owner → `can_destroy` true and `delete_blocker` starting with "Owns 1 team";
  - unknown id → 404 for the operator.
  - `query_count_spec.rb`: the users index with 1 user owning 2 teams vs 4 users each owning 2 teams in different races → equal counts.
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/api/v1/staff/users_spec.rb spec/requests/api/v1/query_count_spec.rb` — FAIL.
- [ ] **Step 3:** Implement. Only the show computes `percent_complete`, which queries per team; the list does not.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add staff user list and detail API`

### Task 4: Staff users API, writing (`update`, `destroy`)

**Files:**
- Modify: `app/controllers/api/v1/staff/users_controller.rb`
- Test: `spec/requests/api/v1/staff/users_spec.rb`

**Interfaces:**
- Produces:
  - `PATCH /api/v1/staff/users/:id` (`authorize! :staff_update, user`). Body: `{ user: { first_name?, last_name?, email?, phone?, roles?: String[] } }`. No password fields; no `current_password`.
    - `roles` replaces the set. Each value must be in `User.valid_roles.map(&:to_s)`; otherwise 422 `errors.roles: ["isn't a role: <x>"]`.
    - When `user == current_user` and `roles` is present without `"admin"` → 422 `errors.roles: ["You can't remove your own Admin role"]`, nothing saved.
    - Both role errors go through `user.errors.add(:roles, ...)` and `render_errors(user)`, so the body has the usual `{ error: "invalid", errors: { roles: [...] } }` shape (no need for the fee-only `StaffFees#render_field_errors`).
    - Saves with `save_without_session_maintenance`. 200 `{ user: StaffUser }`; 422 `render_errors(user)` (e.g. `errors.email` for a taken email).
  - `DELETE /api/v1/staff/users/:id` (`authorize! :destroy, user`):
    - `deletion_blocker` present → 422 `render_errors(reason, code: "user_not_deletable")`;
    - else `destroy` → 204. If `destroy` returns false, 422 with `user.errors.full_messages.to_sentence`.

- [ ] **Step 1:** Add failing examples:
  - admin changes another user's phone and roles to `["operator"]` → 200 and the reloaded user `is?(:operator)`;
  - **operator PATCHes self with `roles: ["admin"]` → 403**, roles unchanged; refunder likewise;
  - operator PATCHes another user's `first_name` → 403;
  - admin removes own Admin (`roles: ["operator"]`) → 422 `errors.roles`, still admin;
  - admin removes Admin from another admin → 200;
  - `roles: ["wizard"]` → 422;
  - a taken email → 422 `errors.email`;
  - after an admin PATCH of another user, `session_user_id` is still the admin's id;
  - DELETE self → 422 `code == "user_not_deletable"`; DELETE a team owner → 422, user exists; DELETE a user with a completed requirement and no team → 422; DELETE a bare user → 204 and gone;
  - operator DELETE → 403;
  - operator PATCH and DELETE of an unknown id → 403 (class-level check first), admin → 404.
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/api/v1/staff/users_spec.rb` — FAIL.
- [ ] **Step 3:** Implement with `params.expect(user: [:first_name, :last_name, :email, :phone, { roles: [] }])`.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add staff user edit, roles and delete API with self and ownership guards`

### Task 5: Staff sent emails API

**Files:**
- Create: `app/controllers/api/v1/staff/sent_emails_controller.rb`, `app/views/api/v1/staff/sent_emails/index.json.jbuilder`
- Modify: `config/routes.rb` (`resources :sent_emails, only: [:index]`), `spec/requests/api/v1/query_count_spec.rb`
- Test: `spec/requests/api/v1/staff/sent_emails_spec.rb`

**Interfaces:**
- Produces: `GET /api/v1/staff/sent_emails?team_id=&status=&kind=&recipient=&page=` (`before_action -> { authorize!(:index, SentEmail) }`) →
  `{ sent_emails: [StaffSentEmail], meta: { page, per_page: 25, total_count, total_pages }, filters: { team: { id, name } | null, kinds: SentEmail::KINDS, statuses: SentEmail::FILTER_STATUSES } }`.
  - `StaffSentEmail = { id, created_at, kind, recipient, subject, status, status_changed_at, error, team: { id, name } | null }`. `team` is null when `team_id` is nil or the team is gone.
  - Filtering follows legacy `SentEmailsController`:
    - `team_id` (positive integer, else ignored);
    - `status` (any value in `SentEmail::STATUSES`, so old rows can still be found by URL; unknown values are ignored);
    - `kind` (exact);
    - `recipient` (`ILIKE %…%`, `sanitize_sql_like`).
  - Order is `created_at DESC, id DESC`. `includes(:team)`. Paging uses the same clamp as Task 2 (25 per page).
  - `filters.team` is the `team_id` filter's team (`{ id, name }`), or `{ id, name: null }` when the id is unknown.

- [ ] **Step 1:** Write the failing spec:
  - refunder and racer → 403; operator → 200;
  - newest first;
  - each filter narrows the list (`status=failed` returns the failed row with its `error`; `kind=welcome`; `recipient=ADA` matches case-insensitively; `team_id` returns only that team's rows and `filters.team.name`);
  - 26 rows → page 2 has 1;
  - a row whose team was deleted → `team` null.
  - `query_count_spec.rb`: 1 vs 5 rows on different teams → equal counts.
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/api/v1/staff/sent_emails_spec.rb spec/requests/api/v1/query_count_spec.rb` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add staff sent emails API`

### Task 6: Nav, landing path, legacy navbar

**Files:**
- Modify:
  - `frontend/src/features/staff/nav.ts` + `nav.test.ts`
  - `frontend/src/features/staff/components/staff-index-redirect.tsx`
  - `frontend/src/locales/en.ts` (`'staff.nav.users': 'Users'`, `'staff.nav.emails': 'Emails'`)
  - `app/views/application/_navbar.html.haml`, `config/locales/en.yml` (add `application.navbar.emails: Emails`; `application.navbar.users: Users` already exists)
- Test: `spec/requests/staff_navbar_spec.rb`, `frontend/src/components/layouts/staff-layout.test.tsx` (unchanged; must still pass)

`RequireStaff` already takes `roles` (PR 5) and `rolesFor(to)` already reads a nav item's roles, so this task does not touch `require-staff.tsx`.

**Interfaces:**
- Produces:
  - `STAFF_NAV` in order: Races (`admin`, `operator`), Users `/staff/users` (`admin`, `operator`, `refunder`), Emails `/staff/emails` (`admin`, `operator`), Payments (unchanged). Labels `staff.nav.users`, `staff.nav.emails`.
  - `staffLandingPath(roles: string[]): string`: `'/staff/races'` when Races is visible, else `'/staff/payments'`. `StaffIndexRedirect` uses it instead of today's "first nav item" (which would now send a refunder to Users).
  - Legacy navbar admin dropdown:
    - replace `link_to t('search'), users_path` with `t('.users')` → `/register/staff/users` when `can?(:index, User)`;
    - add `t('.emails')` → `/register/staff/emails` when `can?(:index, SentEmail)`;
    - remove `New` → `new_user_path` (owner decision: no staff account creation);
    - Races (`can?(:update, Race)`) and Payments (`can?(:refund, :charges)`) stay as PR 5 left them;
    - The order is Users, Races, Emails, Payments.

- [ ] **Step 1:** Write failing tests:
  - update the existing `nav.test.ts` examples: `staffNavItems(['refunder'])` → Users, Payments; `['operator']` and `['admin']` → Races, Users, Emails, Payments;
  - `rolesFor('/staff/emails')` → `['admin', 'operator']`;
  - `staffLandingPath(['refunder']) === '/staff/payments'` and `staffLandingPath(['operator']) === '/staff/races'`;
  - `staff-layout.test.tsx` "sends a refunder from /staff to Payments" and "sends an operator from /staff to the first nav item (Races)" pass unchanged;
  - `staff_navbar_spec.rb` (a new `describe "Legacy navbar Users and Emails links"` beside the Payments and Races ones): a refunder's legacy page links `/register/staff/users` and not `/register/staff/emails`; an operator's links both; a racer sees neither; no admin, operator or refunder dropdown links `/users/new`.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/staff src/components/layouts` and `bundle exec rspec spec/requests/staff_navbar_spec.rb` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add Users and Emails to the staff nav and the legacy admin menu`

### Task 7: Users list page

**Files:**
- Create in `frontend/src/features/staff-users/`:
  - `api/types.ts`, `api/use-staff-users.ts`
  - `use-user-filters.ts` + test
  - `components/users-page.tsx` + test, `components/users-table.tsx`, `components/role-tags.tsx`
  - `routes/staff-users-route.tsx`
- Modify: `frontend/src/app/router.tsx` (`{ path: 'users', element: <StaffUsersRoute/> }`), `en.ts`

**Interfaces:**
- Consumes: Task 3 JSON; `useUrlFilters`, `SearchBox`, `Pagination`, `ResultCount`, `ListTable`/`ListRow`/`ListCell` from `@/components/list/*`; `apiFetch`.
- Produces:
  - TS types `StaffUserRow`, `StaffUser`, `StaffUserTeam`, `StaffUsersResponse`, `StaffUserPayload` (Task 4 body), field for field matching Tasks 3 and 4.
  - Hooks:
    - `useStaffUsers({ q, page })` (key `['staff','users',{q,page}]`, `placeholderData: keepPreviousData`);
    - `useStaffUser(id)` (`['staff','users',id]`);
    - `useUpdateStaffUser(id)`, `useDeleteStaffUser(id)`: both invalidate `['staff','users']`.
  - `useUserFilters() -> { values: { q: string; page: number }, setFilter, clearAll }`, with URL keys `q` and `page` (same rules as `usePaymentFilters`).
  - `RoleTags({ roles })`: a `Badge` per role ("Admin", "Operator", "Refunder").
  - Page `/staff/users`:
    - heading "Users";
    - `SearchBox` (label and placeholder "Search name, email or team");
    - `ResultCount` (the sr-only status line, "1,284 users" via `toLocaleString`, worded through `staff.users.count_one`/`_other` as Payments does);
    - a list with columns Name (link `/staff/users/:id`), Email (`[overflow-wrap:anywhere]`), Phone, Teams (one line each, "{name} {year}", linking to legacy `/teams/:id` with a plain `<a>`; "none" in muted text), Roles (`RoleTags`). Cards below `sm` per the mockup;
    - `Pagination` with "‹ Prev"/"Next ›" and "{from}–{to} of {total}" (the `labels.page` callback builds it from `meta.page`, `meta.per_page` and `meta.total_count`);
    - dimmed with `aria-busy` while `isPlaceholderData`;
    - a caption: "One row per person. Search matches any word of a name, an email, or a team name."

- [ ] **Step 1:** Write failing tests:
  - `useUserFilters`: typing sets `q` and drops `page`.
  - `UsersPage` (MSW):
    - rows render in API order with the team line "Doge Sled 2027" linking `/teams/1`;
    - a user with no teams shows "none";
    - role tags show;
    - typing "ada doge" sends `q=ada doge` once after the debounce;
    - "Next ›" sends `page=2`.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/staff-users` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add the staff users list`

### Task 8: User page

**Files:**
- Create in `frontend/src/features/staff-users/components/`:
  - `user-page.tsx` + test
  - `user-details-card.tsx`
  - `user-roles-card.tsx` + test
  - `user-teams-card.tsx`
  - `delete-user.tsx`
- Create: `frontend/src/features/staff-users/routes/staff-user-route.tsx`
- Modify: `router.tsx` (`users/:userId`), `en.ts`, `frontend/src/lib/dates.ts` + `dates.test.ts` (`formatMonthYear`)

**Interfaces:**
- Consumes: `useStaffUser`, `useUpdateStaffUser`, `useDeleteStaffUser`, `useMe` (to know the viewer), `useLeaveGuard`, `DiscardDialog`, `NotFound`, `ApiError`.
- Produces in `lib/dates.ts`: `formatMonthYear(iso: string, timeZone: TimeZone): string`, e.g. "Mar 2019" (`formatShortDay` gives "Dec 8", with no year).
- Produces, following the mockup's screen 2:
  - Header:
    - back link "‹ Users";
    - full name;
    - "{email} · account since {Mon YYYY}" (`formatMonthYear(created_at, DEFAULT_TIME_ZONE)`);
    - when `can_destroy`, "Delete user": disabled, with `delete_blocker` shown under it, when the blocker is present. Otherwise a `DialogSheet` ("Delete {name}? This can't be undone.") → DELETE → `onDeleted` (the page's `allowLeave`, as `DeleteFee` does) → navigate to `/staff/users`. A 422 `user_not_deletable` shows its `error` in the dialog.
  - `UserDetailsCard`:
    - with `can_edit`: a form (First name, Last name, Email, Phone) and "Save details", showing 422 errors under the fields and "Saved." in a polite live region; it reports unsaved edits through `onDirtyChange(dirty)`;
    - otherwise the same four as text.
    - Caption: "Admins only; operators and refunders see these as text. No password needed here."
  - `UserRolesCard`: rendered only when `can_edit`.
    - Three checkboxes with the one-line help "Admin: everything. Operator: races, fees, team edits, exports, emails. Refunder: users, teams and refunds.";
    - when `is_self`, the Admin box is disabled and checked, with the note "You can't remove your own Admin role.";
    - "Save roles" sends only `{ roles }`; a server `errors.roles` shows under the group. It reports unsaved ticks through `onDirtyChange(dirty)`.
    - Without `can_edit`, the header shows `RoleTags` instead.
  - `UserTeamsCard`: a list with columns Team (legacy `/teams/:id` link), Race, Status ("Registered #N" when finalized, "Registered" when it has no number, else "{percent_complete}% done"), and an "Emails" link per row to `/staff/emails?team_id=:id`. Empty state: "No teams."
  - Links under the cards:
    - "Payments by this user" → `/staff/payments?race_id=all&q=<encoded email>`;
    - "Emails to this user" → `/staff/emails?recipient=<encoded email>`. Show it only when the viewer's roles include `admin` or `operator`.
  - Leave guard, as on the fee page: `UserPage` holds `detailsDirty || rolesDirty`, calls `useLeaveGuard` with it, and while `blocker.state === 'blocked'` renders `DiscardDialog` with body `staff.users.discardBody` ("Your changes to this user haven't been saved."). A successful save clears the card's dirty state.
  - A 404 (`ApiError` with `status === 404`) shows the shared `NotFound`; any other error shows `QueryError` with retry.

- [ ] **Step 1:** Write failing tests (MSW):
  - an operator payload (`can_edit: false`) shows the details as text, no Roles card and no Delete;
  - an admin with `delete_blocker: "Owns 2 teams. …"` sees a disabled Delete and the reason;
  - an admin deleting a bare user confirms, sends DELETE and lands on `/staff/users`;
  - `UserRolesCard` with `is_self` has a disabled checked Admin box, and ticking Refunder sends `{ roles: ['admin','refunder'] }`;
  - a details 422 `errors.email` shows under Email;
  - the payments link `href` is `/register/staff/payments?race_id=all&q=ada%40example.com`;
  - a 404 shows "Page not found";
  - leave guard: editing Phone then clicking "‹ Users" opens "Discard changes?" with the body above and "Keep editing" focused; Keep editing stays on the page with the edit; Discard changes lands on `/staff/users`; after "Save details" succeeds the back link leaves with no dialog; ticking a role and leaving also asks; deleting a bare user with an edited field lands on `/staff/users` with no dialog;
  - `formatMonthYear('2019-03-15T12:00:00Z', 'America/Chicago') === 'Mar 2019'`.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/staff-users src/lib/dates` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run — PASS.
- [ ] **Step 5:** Commit — `Add the staff user page with details, roles, teams and delete`

### Task 9: Emails sent page

**Files:**
- Create in `frontend/src/features/staff-emails/`:
  - `api/types.ts`, `api/use-sent-emails.ts`
  - `kinds.ts` + test
  - `use-email-filters.ts` + test
  - `components/emails-page.tsx` + test, `components/email-filters.tsx`, `components/emails-table.tsx`
  - `routes/staff-emails-route.tsx`
- Modify: `router.tsx` (a group like the Races one: `{ element: <RequireStaff roles={rolesFor('/staff/emails')}><Outlet /></RequireStaff>, children: [{ path: 'emails', element: <StaffEmailsRoute /> }] }`), `en.ts`

**Interfaces:**
- Consumes: Task 5 JSON; the shared list parts plus `FilterChips`, `DialogSheet`, `formatDate(iso, DEFAULT_TIME_ZONE)`/`formatSince(iso, DEFAULT_TIME_ZONE)` (default race zone, as Payments does).
- Produces:
  - `KIND_LABELS: Record<string, string>`:
    - `welcome` "Welcome"
    - `team_finalized` "Team finalized"
    - `team_waitlisted` "Waitlisted"
    - `refund` "Refund"
    - `email_changed` "Email address changed"
    - `password_reset` "Password reset"
    - `classy_fundraising` "Fundraising page"
    - `registration_reminder` "Registration reminder"
    - `feedback` "Problem report"
  - `kindLabel(kind: string | null): string`: falls back to the raw kind with `_` turned into spaces and capitalized, or "Unknown" for null.
  - `queuedFor(iso: string, now?: Date): string`: "for 2 min" / "for 3 h" / "for 2 days".
  - `useEmailFilters() -> { values: { teamId?: number; status: 'any' | 'sent' | 'queued' | 'failed'; kind?: string; recipient: string; page: number }, setFilter, clearAll }`.
    - URL keys are `team_id`, `status`, `kind`, `recipient`, `page`. Any other `status` in the URL reads as `any`, and the client never sends it.
  - `useSentEmails(values)` (key `['staff','sent_emails',values]`, `keepPreviousData`).
  - Page `/staff/emails`, heading "Emails sent", following the mockup's screens 3 and 5:
    - Filters:
      - `SearchBox` "Recipient email";
      - Status select "Status: Any/Sent/Queued/Failed";
      - Kind select ("Any" plus `filters.kinds` in `kindLabel` words).
      - `FilterChips`: a Team chip labelled "Team: {filters.team.name ?? '#'+id}", plus Status and Kind chips, each removable, and "Clear all".
      - Below `sm`, only the search shows inline; the selects sit behind "Filters (n)" in a `DialogSheet`, as Payments does.
    - List columns:
      - Sent (`formatDate`);
      - Kind;
      - To (`[overflow-wrap:anywhere]`);
      - Subject (`break-words`);
      - Team (legacy `/teams/:id` link, or blank);
      - Status (a `Badge`; failed rows show `error` under it in red text with `[overflow-wrap:anywhere]`; queued rows add `queuedFor`);
      - Changed (`formatSince(status_changed_at, DEFAULT_TIME_ZONE)`, or blank).
    - `ResultCount`, `Pagination`, and the caption "Newest first. Older rows may show statuses MXRoute no longer reports."

- [ ] **Step 1:** Write failing tests:
  - `kindLabel('team_finalized') === 'Team finalized'` and `kindLabel('new_thing') === 'New thing'`;
  - a test that every `KIND_LABELS` key is listed in a copy of `SentEmail::KINDS` kept in the fixture (so a missing label shows up in review);
  - `queuedFor` for 2 and 150 minutes;
  - `useEmailFilters` with `?status=delivered` reads `any`;
  - `EmailsPage` (MSW):
    - `?team_id=7` shows the chip "Team: Doge Sled", and removing it drops `team_id` from the next request;
    - choosing Status Failed sends `status=failed`;
    - a failed row shows its error text;
    - a queued row shows "Queued" and "for 2 min";
    - the Status select offers exactly Any, Sent, Queued, Failed;
    - a refunder at `/staff/emails` sees the not-allowed heading and no request is made.
- [ ] **Step 2:** Run `npm --prefix frontend test -- --run src/features/staff-emails` — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run, then `npm --prefix frontend test -- --run` and `npm --prefix frontend run build` — PASS.
- [ ] **Step 5:** Commit — `Add the staff emails sent page`

### Task 10: Seeds, Playwright, docs

**Files:**
- Modify: `lib/tasks/test_seeds.rake` (`staff_users_emails`; check that `test_seeds:cleanup` already sweeps `@example.com` users and sent emails and `Race %` races), `CLAUDE.md`, `README.md` (only if setup changed; it should not)
- Create: `tests/spa/staff-users-emails.spec.ts`

**Interfaces:**
- Produces: `test_seeds:staff_users_emails`, writing credentials (all `@example.com`, `TEST_UNIQUE_ID` in names) for:
  - an admin, an operator and a refunder;
  - `ada_email`: Ada Racer<id>, who owns `Doge Sled <id>` in an open `Race StaffUsers <id>`, with one completed requirement. Create the people while the race is open.
  - `zed_email`: Zed Deletable<id>, with no team and no payment;
  - `team_id` and `team_name`;
  - sent emails for Doge Sled to Ada: `team_finalized` sent, `welcome` failed with error `Net::SMTPAuthenticationError: 535 Incorrect authentication data`, and `welcome` queued, created 2 minutes ago;
  - one `registration_reminder` sent for another team.

- [ ] **Step 1:** Write the spec (it fails until the seed exists). Run at 1024px unless a step says otherwise:
  1. **Refunder:**
     - nav shows Users and Payments only;
     - searching "Ada<id> Doge" finds exactly Ada;
     - her page shows details as text, with no Roles card, no Delete and no "Emails to this user";
     - `/register/staff/emails` shows the not-allowed page.
  2. **Operator:**
     - from Ada's page, "Emails to this user" lists her three emails;
     - the per-team "Emails" link opens `?team_id=` with the chip "Team: Doge Sled <id>";
     - Status Failed shows the 535 error;
     - removing the chip keeps the Failed filter.
  3. **Admin:**
     - change Ada's phone and save, and the reload shows it;
     - Delete is disabled on Ada with "Owns 1 team";
     - on their own page the Admin box is disabled;
     - give Zed (a plain racer account that signed itself up) the Operator role and see the tag on the list, then log in as Zed and see the staff nav with Races (the promote-after-signup path);
     - delete Zed and land on the list without Zed.
  4. **320px:**
     - on the users list, Ada's page and the emails page, `document.documentElement.scrollWidth <= 320`;
     - the emails page opens "Filters (n)" as a sheet.
- [ ] **Step 2:** Add `test_seeds:staff_users_emails`. Rebuild the SPA (`npm --prefix frontend run build`) and run against a separate database as in CLAUDE.md "E2E Learnings": `DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid npx playwright test tests/spa/staff-users-emails.spec.ts`. It must PASS.
- [ ] **Step 3:** Run `bin/check`. All steps pass. Run `tests/spa/staff-shell.spec.ts`, `staff-races.spec.ts` (it checks the staff nav), `staff-requirements.spec.ts`, `payments-admin.spec.ts` and `whos-registered.spec.ts` the same way; they must pass unchanged.
- [ ] **Step 4:** Add a CLAUDE.md "Registration SPA" bullet covering:
  - "Staff users and emails (reskin PR 7)": the routes, the API and its roles (`:staff_update` is admin only, never `:update`);
  - the AND-over-words search;
  - `User#deletion_blocker` (also used by legacy destroy);
  - the own-Admin rule;
  - `SentEmail::KINDS` plus `KIND_LABELS` (a new mail kind needs both);
  - the Status filter offering three values;
  - team links staying legacy until PR 8;
  - `staffLandingPath` (refunders still land on Payments);
  - the Emails route guarded by `RequireStaff roles={rolesFor('/staff/emails')}`;
  - the user page's leave guard;
  - the seed and spec names.
- [ ] **Step 5:** Commit — `Add staff users and emails e2e spec and seed; document them`
- [ ] **Step 6:** Push and open the PR against `chiditarod/dogtag`, stacked on PR 6 (#361). The body says it also carries PR 2 (#351) and merges after #361 and #351, and lists:
  - the "Calls made in this plan";
  - the legacy `users#destroy` guard and the navbar changes (including removing the staff "New" user item: users sign up themselves and admins grant roles afterwards);
  - whether the e2e spec ran.
  - It notes no migrations and no Gemfile or config changes.
