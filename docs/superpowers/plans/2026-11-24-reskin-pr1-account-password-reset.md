# Reskin PR 1: Account edit and password reset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Racers edit their account (`/register/account`) and finish a password reset (`/register/reset-password/:token`) in the SPA; every self-edit, in the SPA and the legacy page, requires the current password.

**Architecture:** Two thin API additions (`PATCH /api/v1/me`, `GET`/`PUT /api/v1/password_resets/:token`) over the existing Authlogic `User`; two SPA routes in `features/account` and `features/auth`; the reset email links through a new `RegistrationUi.password_reset_url`. Legacy `users#update` gains the current-password check for self-edits; nothing legacy is removed.

**Tech Stack:** Rails 8, Authlogic 6 (SCrypt), jbuilder, RSpec request/controller specs; React 19 + TypeScript, react-router-dom 7, TanStack Query 5, Tailwind, Vitest + MSW; Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-reskin-design.md`, area 2 ("Account and password reset"). Mockups: `docs/superpowers/specs/2026-11-24-reskin-mockups/account-v2.html`, `password-reset-v1.html`. Roadmap: `docs/superpowers/plans/2026-11-24-reskin-roadmap.md`.

**Branch:** `feature/reskin-1-account` from `main`. Build: Sonnet high. Review: Opus high.

## Global Constraints

- All new UI in the SPA; no new HAML templates. Editing the existing `users/_form.html.haml` (one field) and the password-reset mailer link is allowed.
- The legacy racer flow keeps working (legacy reset page, legacy account page).
- Errors: every non-2xx JSON response is `{ "error": String, "errors": { "<field>": [String] } }` via `render_errors`.
- Strong params use `params.expect`, never `require/permit`.
- Racer copy lives in `frontend/src/locales/en.ts` through `t()`; Rails racer strings in `config/locales/en.yml`.
- Pages work at 320px wide with no horizontal scroll. Chicago Flag tokens and existing `Card`, `Field`, `Input`, `Button` components.
- Tests: request specs assert status plus data changes; Vitest + MSW for SPA; a Playwright spec in `tests/spa/` with its own `test_seeds:*` task (unique `TEST_UNIQUE_ID`, `@example.com` emails), added to `test_seeds:cleanup` if it creates anything cleanup would miss.
- No Gemfile, initializer, environment or `spec_helper.rb` changes.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; the PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and states whether the e2e specs were run.

## Review Focus

1. Changing the password on `/account` must not log the racer out or break the next save (session and CSRF still valid) — Task 1 spec and Task 7 e2e.
2. Wrong current password together with a new password: nothing is saved and the old password still works — Task 1 spec.
3. Changing the email to one another account already uses: field error under Email, nothing saved, even with a correct current password — Task 1 spec.
4. A reset link used a second time, or after 3 hours, shows "This link has expired" on load, before any typing — Task 2 spec (single use, expiry) and Task 6 Vitest.
5. A racer logged in as account A who opens account B's reset link ends up logged in as B after saving, not A — Task 2 spec.

---

### Task 1: `PATCH /api/v1/me` (self account update)

**Files:**
- Create: `app/controllers/api/v1/accounts_controller.rb`
- Modify: `config/routes.rb` (inside `namespace :v1`, next to `get "me"`)
- Test: `spec/requests/api/v1/accounts_spec.rb`

**Interfaces:**
- Produces: `PATCH /api/v1/me`, body `{ user: { first_name, last_name, email, phone, password, password_confirmation }, current_password: String }`. 200 renders `api/v1/users/show` (`{ user: { id, first_name, last_name, email, phone, roles } }`). 401 `not_authenticated` when logged out. 422 `{ error: "invalid", errors: { current_password: ["is not correct"] } }` when missing or wrong; 422 with model errors otherwise. Route: `patch "me", to: "accounts#update"`.

- [ ] **Step 1: Write the failing request spec** with these examples (log in with `api_login(user)`, password `"12345678"`; CSRF as in `users_spec.rb`):
  - `"updates name, email and phone with the current password"`: send `current_password: "12345678"`, `email: "NEW@Example.com"`; expect 200, `json["user"]["email"] == "new@example.com"`, `user.reload.first_name` changed.
  - `"refuses any change without the current password"`: omit it; expect 422, `json["errors"]["current_password"] == ["is not correct"]`, `user.reload.first_name` unchanged.
  - `"refuses a wrong current password and keeps the old password"`: `current_password: "wrong-one"`, `password`/`password_confirmation: "brandnew123"`; expect 422 and `user.reload.valid_password?("12345678")` true.
  - `"changes the password and stays logged in"`: correct current password, new password pair; expect 200, `user.reload.valid_password?("brandnew123")`, then `get "/api/v1/me"` is 200 with the same `session_user_id`.
  - `"reports a taken email without saving"`: another user owns `taken@example.com`; expect 422 with `errors["email"]` present and the email unchanged.
  - `"ignores roles"`: send `user: { roles: ["admin"] }` plus a valid change; expect 200 and `user.reload.is?(:admin)` false.
  - `"requires login"`: logged out → 401.

- [ ] **Step 2: Run it to verify it fails**

Run: `bundle exec rspec spec/requests/api/v1/accounts_spec.rb`
Expected: FAIL (route not found → 404).

- [ ] **Step 3: Implement `Api::V1::AccountsController#update`** with `before_action :require_api_user!`. Attributes via `params.expect(user: [:first_name, :last_name, :email, :phone, :password, :password_confirmation])`. Check `current_user.valid_password?(params[:current_password].to_s)` first; on failure `current_user.errors.add(:current_password, "is not correct")` and `render_errors(current_user)` (`render_errors` takes a record and serializes `errors.to_hash`; do not change its signature). Then `current_user.update(attrs)`; success renders `api/v1/users/show` with `@user = current_user`, failure `render_errors(current_user)`. Authlogic ignores blank passwords, so an empty password pair leaves the password unchanged.

- [ ] **Step 4: Run the spec to verify it passes**

Run: `bundle exec rspec spec/requests/api/v1/accounts_spec.rb`
Expected: PASS (7 examples). If "stays logged in" fails, Authlogic rotated the persistence token without updating the session: call `UserSession.create(current_user)` after a successful password change and re-run.

- [ ] **Step 5: Commit** — `git commit -m "Add PATCH /api/v1/me for self account edits with current password"`

### Task 2: `GET`/`PUT /api/v1/password_resets/:token`

**Files:**
- Modify: `app/controllers/api/v1/password_resets_controller.rb`, `config/routes.rb` (`resources :password_resets, only: [:create, :show, :update]`)
- Test: `spec/requests/api/v1/password_resets_spec.rb` (append)

**Interfaces:**
- Produces: `GET /api/v1/password_resets/:id` → 200 `{ email: String }` for a valid token, 404 `not_found` otherwise. `PUT /api/v1/password_resets/:id`, body `{ password, password_confirmation }` → 200 `{ user: {...} }` (same shape as `me`) and the session is that user; 404 for an unknown/expired token; 422 with `errors.password` / `errors.password_confirmation` for blank, short (<8) or mismatched.

- [ ] **Step 1: Append failing examples** (token from `user.reset_perishable_token!; user.perishable_token`):
  - `"shows the email for a valid token"`: GET → 200, `json == { "email" => user.email }`.
  - `"404s an unknown token"`: GET `/api/v1/password_resets/nope` → 404.
  - `"404s a token older than 3 hours"`: `Timecop.travel(3.hours.from_now + 1.minute)` then GET → 404.
  - `"sets the password and logs the user in"`: PUT with `"newpassword456"` pair → 200, `json["user"]["id"] == user.id`, `session_user_id == user.id`, `user.reload.valid_password?("newpassword456")`.
  - `"is single use"`: a second PUT with the same token → 404.
  - `"logs in as the token's user even when someone else is logged in"`: `api_login(other)`, PUT B's token → `session_user_id == user.id`.
  - `"rejects blank, short and mismatched passwords"`: three PUTs → 422 each, `errors` has `password` or `password_confirmation`, password unchanged.

- [ ] **Step 2: Run to verify the new examples fail**

Run: `bundle exec rspec spec/requests/api/v1/password_resets_spec.rb`
Expected: new examples FAIL (404 routing / 405); existing ones PASS.

- [ ] **Step 3: Implement `show` and `update`.** Load with `User.find_using_perishable_token(params[:id])` (honours the 3-hour `perishable_token_valid_for`); nil → `render_errors("not_found", status: :not_found)`. `update`: require both fields present (else 422 field errors "can't be blank"), assign `password`/`password_confirmation`, `save`; on success `UserSession.create(user)`, set `@user`, render `api/v1/users/show`. Authlogic resets the perishable token on save, which makes the link single use; do not add a separate mechanism.

- [ ] **Step 4: Run to verify all pass**

Run: `bundle exec rspec spec/requests/api/v1/password_resets_spec.rb`
Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "Add password reset token check and update to the API"`

### Task 3: Reset email links to the SPA when `REGISTRATION_UI=spa`

**Files:**
- Modify: `app/services/registration_ui.rb`, `app/mailers/user_mailer.rb:59-63`
- Test: `spec/services/registration_ui_spec.rb`, `spec/mailers/user_mailer_spec.rb` (`#password_reset_instructions`)

**Interfaces:**
- Produces: `RegistrationUi.password_reset_url(token, host:) -> String`: `"#{protocol}://#{host}/register/reset-password/#{token}"` when `spa?`, else `edit_password_reset_url(token, host:, protocol:)` (protocol from `UserMailer.default_url_options`, default `"http"`, as `team_url` does).

- [ ] **Step 1: Failing specs.** In `registration_ui_spec.rb`, mirror the existing `team_url` examples: with SPA on (stub as the file already does) expect `".../register/reset-password/abc123"` on the given host; with it off expect `"/password_resets/abc123/edit"` on the given host. In the mailer spec add `"links the reset page through RegistrationUi"`: body includes `RegistrationUi.password_reset_url(user.perishable_token, host: "80")`.
- [ ] **Step 2: Run** `bundle exec rspec spec/services/registration_ui_spec.rb spec/mailers/user_mailer_spec.rb` — Expected: new examples FAIL (`NoMethodError`).
- [ ] **Step 3: Implement** `password_reset_url` and set `@edit_password_reset_url = RegistrationUi.password_reset_url(user.perishable_token, host: host)` in the mailer.
- [ ] **Step 4: Run** the same command plus `bundle exec rspec spec/integration/email_chains_spec.rb` — Expected: PASS (the integration spec runs with the SPA off, so it still sees the legacy link).
- [ ] **Step 5: Commit** — `git commit -m "Link the password reset email to the SPA when it is on"`

### Task 4: Legacy self-edit requires the current password

**Files:**
- Modify: `app/controllers/users_controller.rb` (`update`), `app/views/users/_form.html.haml` (one field), `config/locales/en.yml` (`users.form.current_password`, `users.update.current_password_wrong`)
- Test: `spec/controllers/users_controller_spec.rb` (`#update`)

**Interfaces:**
- Produces: legacy `PATCH /users/:id` where `@user.id == current_user.id` requires top-level param `current_password`; wrong or missing → re-render `edit` with status 422, `flash.now[:error]` = `I18n.t("users.update.current_password_wrong")` ("Your current password is not correct. Nothing was saved."), no changes. Admins editing someone else are unaffected.

- [ ] **Step 1: Failing specs.** Update `"when a non-admin updates themselves"` to send `current_password: "12345678"` (factory password) and still pass. Add `"refuses a self-edit without the current password"` (422, `first_name` unchanged) and `"refuses a self-edit with a wrong current password"`. Keep `"lets an admin set roles"` (admin editing another user, no current password) passing unchanged.
- [ ] **Step 2: Run** `bundle exec rspec spec/controllers/users_controller_spec.rb` — Expected: the new refusals FAIL.
- [ ] **Step 3: Implement** the check at the top of `update` (before `try_to_update`) and add `password_field_tag :current_password` to `_form` shown only when `@user == current_user`, with label `t('.current_password')` ("Current password (required to save)").
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "Require the current password for legacy self account edits"`

### Task 5: SPA Account page

**Files:**
- Create: `frontend/src/features/account/api/use-update-account.ts`, `frontend/src/features/account/components/account-form.tsx`, `frontend/src/features/account/components/account-form.test.tsx`, `frontend/src/app/routes/account.tsx`
- Modify: `frontend/src/app/router.tsx` (add `/account` inside the `RequireAuth` children), `frontend/src/features/auth/components/user-menu.tsx` (Account link to `/account`, between My teams and Staff), `frontend/src/features/auth/components/user-menu.test.tsx`, `frontend/src/locales/en.ts`

**Interfaces:**
- Consumes: Task 1 endpoint; `useMe`, `meQueryKey`, `User` from `@/features/auth/api/use-me`; `apiFetch`, `ApiError`.
- Produces: `useUpdateAccount(): UseMutationResult<{ user: User }, ApiError, UpdateAccountInput>` where `UpdateAccountInput = { user: { first_name: string; last_name: string; email: string; phone: string; password: string; password_confirmation: string }; current_password: string }`; on success `setQueryData(meQueryKey, user)`. `AccountRoute` component.
- Copy (`en.ts`): `account.heading` "Your account", `account.details` "Your details", `account.emailHelp` "We send registration emails here.", `account.changePassword` "Change password", `account.newPassword` "New password", `account.newPasswordHelp` "Leave blank to keep your password. At least 8 characters.", `account.confirmPassword` "Confirm new password", `account.currentPassword` "Current password", `account.currentPasswordHelp` "Needed to save any change.", `account.forgot` "Forgot it?", `account.save` "Save changes", `account.saved` "Saved.", `account.checkFields` "Check the highlighted field.", `layout.account` "Account".

- [ ] **Step 1: Failing Vitest** in `account-form.test.tsx` (render via `renderApp('/account')`, MSW `GET /api/v1/me` returns a user, `GET /api/v1/csrf`):
  - `"prefills the form from me"`: first name, last name, email, phone inputs have the user's values; heading "Your account"; sub-line shows the email.
  - `"sends the current password and shows Saved"`: type current password, change phone, click "Save changes"; assert the PATCH body equals `{ user: {..., phone: "<new>", password: "", password_confirmation: ""}, current_password: "<typed>" }`; `role=status` "Saved."; new values stay in the form.
  - `"shows the server error under Current password"`: PATCH → 422 `{ error: "invalid", errors: { current_password: ["is not correct"] } }`; Current password input `aria-describedby` element contains "is not correct"; banner "Check the highlighted field."
  - `"clears the password fields after a save"`.
  - `"Forgot it? links to /forgot-password"`.
  In `user-menu.test.tsx` add `"shows an Account link for logged-in users"` (href `/register/account` via router basename or `/account` in memory router).
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/account src/features/auth/components/user-menu.test.tsx` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the hook (PATCH `/me`, `json: input`), the form (mockup `account-v2`: two cards "Your details" with first/last name in a `sm:grid-cols-2` row, email with help, phone via existing `PhoneInput`; "Change password" with new + confirm; then Current password with help and the Forgot link; full-width `Button` "Save changes"; field errors via `Field error={errorsFor(name)}` like `SignupForm`), the route (heading + email sub-line + form inside `RegisterLayout` width), the router entry and the menu link.
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `npm --prefix frontend run build` — Expected: no type errors.
- [ ] **Step 5: Commit** — `git commit -m "Add the SPA account page"`

### Task 6: SPA reset-password page

**Files:**
- Create: `frontend/src/features/auth/api/use-reset-password.ts`, `frontend/src/features/auth/components/reset-password-form.tsx`, `frontend/src/features/auth/components/reset-password-form.test.tsx`, `frontend/src/app/routes/reset-password.tsx`
- Modify: `frontend/src/app/router.tsx` (public `/reset-password/:token` next to `/forgot-password`), `frontend/src/app/routes/teams.tsx` (notice banner), `frontend/src/locales/en.ts`

**Interfaces:**
- Consumes: Task 2 endpoints; `meQueryKey`, `User`; `clearCsrfToken`.
- Produces: `usePasswordResetToken(token: string): UseQueryResult<{ email: string }, ApiError>` (`retry: false`, `skipUnauthorized: true`); `useResetPassword(token: string): UseMutationResult<{ user: User }, ApiError, { password: string; password_confirmation: string }>` (on success `clearCsrfToken()` then `setQueryData(meQueryKey, user)`, as `useSignup` does). After success the page navigates to `/teams` with `state: { notice: 'passwordChanged' }`; `TeamsRoute` shows a `role=status` banner when `location.state?.notice === 'passwordChanged'`.
- Copy: `resetPassword.heading` "Choose a new password", `resetPassword.for` "For {email}", `resetPassword.newPassword` "New password", `resetPassword.help` "At least 8 characters.", `resetPassword.confirm` "Confirm new password", `resetPassword.submit` "Save new password", `resetPassword.mismatch` "The passwords don't match.", `resetPassword.expiredHeading` "This link has expired", `resetPassword.expiredBody` "Reset links work for 3 hours and only once. Ask for a new one and use the newest email.", `resetPassword.newLink` "Send me a new link", `resetPassword.back` "Back to log in", `teams.passwordChanged` "Your password is changed and you're logged in."

- [ ] **Step 1: Failing Vitest** (`renderApp('/reset-password/tok123')`):
  - `"shows the account email from the token"`: GET → `{ email: "ada@example.com" }`; heading "Choose a new password"; text "For ada@example.com".
  - `"shows the expired state on a 404 before any typing"`: GET → 404; heading "This link has expired"; link "Send me a new link" has href ending `/forgot-password`; no password inputs rendered.
  - `"flags mismatched passwords without calling the server"`: different values, submit; "The passwords don't match." under Confirm; no PUT request made.
  - `"saves, logs in and lands on My teams with a notice"`: PUT → `{ user }`; URL is `/teams`; `role=status` "Your password is changed and you're logged in."
  - `"shows server field errors"`: PUT → 422 `{ errors: { password: ["is too short (minimum is 8 characters)"] } }`; error under New password.
  - `"shows the expired state if the PUT 404s"` (link used in another tab meanwhile).
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/auth/components/reset-password-form.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** hooks, form, route, router entry and the teams notice (mockup `password-reset-v1`; `Card` layout like `ForgotPasswordRoute`; `QueryLoading` while the token GET is pending).
- [ ] **Step 4: Run** `npm --prefix frontend test -- --run` — Expected: whole Vitest suite PASS. `npm --prefix frontend run build` — no type errors.
- [ ] **Step 5: Commit** — `git commit -m "Add the SPA reset-password page"`

### Task 7: End-to-end specs, seed, docs, PR

**Files:**
- Modify: `tests/spa/password-reset.spec.ts`, `lib/tasks/test_seeds.rake` (add `account`; the user email is `account-<id>@example.com`, so `cleanup` already sweeps it), `CLAUDE.md` (Registration SPA section: one bullet for `/account` + `/reset-password/:token`, `PATCH /api/v1/me` current-password rule, `RegistrationUi.password_reset_url`), `README.md` only if a command or setup step changed
- Create: `tests/spa/account.spec.ts`

**Interfaces:**
- Consumes: everything above. Seed `test_seeds:account` writes credentials `{ user_email, password: "oldpassword123", new_password: "newpassword456", user_id }` like `password_reset`.

- [ ] **Step 1: Rewrite the reset e2e** so the step "Follow the emailed link" expects the link to match `/\/register\/reset-password\/[^/]+$/` and contain `APP_HOST`, fills "New password" and "Confirm new password" by label, clicks "Save new password", and expects heading "My teams" plus the status "Your password is changed and you're logged in."; the final step (clear cookies, log in with the new password) stays. Add a step: open the same link again → heading "This link has expired".
- [ ] **Step 2: Write `tests/spa/account.spec.ts`**: log in through `/register/login`; open the user menu "Account"; change phone with the current password → "Saved."; try a change with a wrong current password → "is not correct" under Current password; change the password (current + new pair) → "Saved.", then change the phone again without logging in (proves session and CSRF survive); log out and log in with the new password → "My teams". Run at 320px for one screenshot-free layout check: `page.setViewportSize({ width: 320, height: 800 })` and assert `document.documentElement.scrollWidth <= 320`.
- [ ] **Step 3: Run the e2e specs** (separate DB, see CLAUDE.md E2E Learnings): `npm --prefix frontend run build && DATABASE_URL=postgres://postgres@localhost/dogtag_test_2 npx playwright test tests/spa/password-reset.spec.ts tests/spa/account.spec.ts` — Expected: PASS. Also run the legacy `tests/password-reset.spec.ts` the same way — Expected: PASS (legacy page unchanged).
- [ ] **Step 4: Run everything** — `bin/check` — Expected: every step reports success (rspec, frontend, build, e2e).
- [ ] **Step 5: Update `CLAUDE.md` (and README if needed), commit** — `git commit -m "Add account and password reset e2e specs and docs"`
- [ ] **Step 6: Push and open the PR** — `git push -u origin feature/reskin-1-account` then `gh pr create --repo chiditarod/dogtag --base main --title "Reskin PR 1: account edit and password reset in the SPA"` with a body covering: what ships, the current-password rule (owner decision) including the legacy page, the reset email switch (`REGISTRATION_UI=spa` only), no migrations, e2e run status, and the `🤖 Generated with [Claude Code](https://claude.com/claude-code)` line. Do not merge.
