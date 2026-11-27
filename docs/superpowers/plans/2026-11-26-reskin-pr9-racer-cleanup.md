# Reskin PR 9: Racer cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Written on 2026-11-26 against PR 8 (`47255e6`, which carries PRs 1-8). PR 9 is stacked on #363. **Owner-timed:** it is built now but ships only when the owner says, never inside the deploy freeze (2026-12-06 to 2026-12-09, registration opening likely 2026-12-07).

**Goal:** No racer request renders a HAML page. The legacy racer controllers, views, JS and their specs are deleted. `/` and every old racer URL 301 to the SPA under `/register`. Emails link SPA URLs unconditionally. `RegistrationUi` and `REGISTRATION_UI` are gone. The legacy **staff** pages that PR 10 deletes keep working: race new/edit/export, requirements, tiers, users index/search/destroy, teams search, sent emails, the navbar and the error pages.

**Architecture:**
- Deletion by area, each task removing routes, controllers, views and specs together, so every commit is green.
- Redirects are plain `config/routes.rb` `redirect(...)` entries (301, Rails' default). Numeric ids are constrained (`/\d+/`), so junk paths still fall to the existing `errors#not_found` catch-all and nothing is interpolated unchecked.
- Kept staff routes are declared before the redirects, so `/races/new`, `/races/:id/edit`, `/teams/search` and `/users/search` are never swallowed.
- One small `SpaUrl` module builds absolute SPA links for mailers from `UserMailer.default_url_options`, replacing `RegistrationUi`.
- Kept legacy chrome (navbar, `require_user`, `user_update_checker`) and kept staff pages link literal SPA paths, so later deletions cannot leave them calling a deleted route helper.

**Tech Stack:** Rails 8 routes, RSpec request/controller/mailer specs, HAML (edits to kept staff views only), CoffeeScript (one kept staff file), React 19 + Vitest (one link), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-reskin-design.md` (on branch `docs/reskin-design`, commit `ba134bb`; read it with `git show ba134bb:docs/superpowers/specs/2026-11-24-reskin-design.md`). This PR covers area 9 "Racer cleanup (owner-timed)", plus "Constraints", "Testing" ("Cleanup PRs: request specs for every redirect, including `/` to `/register`") and the "Calls made" line "`/` 301-redirects to `/register` at racer cleanup". Roadmap: `docs/superpowers/plans/2026-11-24-reskin-roadmap.md` (same commit).

**Branch:** `feature/reskin-9-racer-cleanup`, stacked on PR 8 (`feature/reskin-8-staff-team`, #363, tip `47255e6`). Build: Sonnet high. Review: Opus high. No migration.

## Global Constraints

- Delete only racer-side code. Everything listed for PR 10 (staff races HTML, requirements, tiers, users HTML index/search/destroy, sent_emails, teams search, the application layout and navbar, error ERB pages, `app/assets` legacy JS/CSS, the vendored jsonform under `vendor/assets/javascripts/`, the `Legacy admin` SPA nav link) stays and must keep working.
- Editing kept staff HAML/CoffeeScript is allowed (links, redirect targets). No new HAML.
- No Gemfile, `config/initializers`, `config/environments`, `config/application.rb` or `spec_helper.rb` change. `config/routes.rb` and `config/locales/en.yml` are fine to change.
- Models, `Ability`, services and the API are not changed, even where a method or rule loses its last legacy caller (`Race.past`, `can [:create], :charges`, `DateHelper#human_date_short`, ...). PR 10 or later can prune them.
- Locale keys that the API, services or mailers read stay (Task 7 has the list and a spec).
- Strings: double quotes, files end with a newline, no trailing whitespace.
- Request specs assert status plus the redirect location or the data. Log in with `api_login(user)` from `spec/support/api_helpers.rb`.
- Commits end with a blank line and the `Co-Authored-By` / `Claude-Session` lines. The PR body ends with the `Generated with Claude Code` line and says whether the e2e specs were run.

## Owner decisions

None yet. Open questions (recommended answers in brackets; the plan is written to the recommendation):

1. **The legacy team page's Refund and "Refund and invalidate" buttons go in PR 9, not PR 10. Is that OK?** The spec deletes `teams#show` here, and the PR 8 plan said the button stays until staff cleanup. Refunds have gone through Payments (team filter and Refund mode) since PR 8. Without the team page, nothing sets `session[:prior_url]`, so `ChargesController#refund` can only answer 400. [Yes. Delete `ChargesController` (create and refund), its views, route and spec in Task 5. If the answer is no, PR 9 cannot redirect `/teams/:id` as the spec says, and the spec needs changing first.]
2. **When should `REGISTRATION_UI` be unset on `dogtag-staging` and `dogtag`?** After this PR nothing reads it. But `heroku rollback` to the PR 8 release does read it, and with `spa` the rolled-back app's emails and homepage still point at the SPA. [Leave it set to `spa` until PR 9 has run cleanly on production for a week (or until PR 10 ships). Then the owner runs `heroku config:unset REGISTRATION_UI -a dogtag-staging`, then `-a dogtag`.]

## Calls made in this plan (not in the spec)

- **Redirect additions beyond the spec's list:**
  - `/users/:id` (the deleted `users#show`) → `/register/account`, like `/users/:id/edit`;
  - `/users/new` → `/register/signup`;
  - `/password_resets/new` → `/register/forgot-password`;
  - `/teams/new?race_id=N` → `/register/races/N/teams/new` (plain `/register` without a numeric `race_id`);
  - `/login` and `/user_session/new` → `/register/login` (there is no `/login` route today; the spec says "`/login` paths").
- **Every redirect target already exists in PR 8's SPA.** So a browser-cached 301 still resolves after a `heroku rollback`, and 301 (the spec's choice) is safe. Query strings are not carried over, except the `race_id` read above.
- **Staff URLs shared with racers.** Staff have the SPA replacements (PRs 2, 5, 7, 8), so these follow the spec's racer targets:
  - `/teams/:id`, its nested paths and `/teams` (staff now use the SPA team page, PR 8);
  - `/users/:id/edit` (staff edit users on `/register/staff/users/:id`, PR 7);
  - `/races`, `/races/:id`, `/races/:id/registrations` (staff use `/register/staff/races`, PR 5, and Who's registered, PR 2).

  The kept legacy pages that linked to them now link SPA paths directly (Task 3): the users index (names, Edit, team, race), its select2 search, the sent emails team link, and the SPA race overview's "Who's registered".
- **Logout stays on the kept navbar.** `UserSessionsController#destroy` and `DELETE /user_session` stay until PR 10 deletes the navbar. Logout redirects to `/register`. `new`/`create` go.
- **Logged-out visits to kept staff pages** redirect to `/register/login` with no `next`. The SPA's `next` only takes SPA paths, so staff land on My teams after logging in. `require_no_user`, `store_location` and `redirect_back_or_default` lose their last callers and are deleted.
- **`user_update_checker`** (a user whose record fails a newer validation) redirects to `/register/account` instead of the deleted legacy edit page.
- **The root keeps its `home` route name** (`root to: redirect("/register"), as: :home`), so `home_url` callers that stay (`render_access_denied`, the navbar brand) keep working through the 301. The welcome email links `SpaUrl.for` instead.
- **Legacy race `create` redirects to `edit_race_url(@race)`, `destroy` to `/register/staff/races`, and requirement `destroy` to `edit_race_url(race)`.** These replaced targets (`races_path`, `race_url`) are now redirects to the racer landing page.
- **Legacy local-suite Playwright specs are deleted, not ported.** Each is covered by a SPA spec (Task 8 has the map). A new `tests/spa/legacy-redirects.spec.ts` covers old links landing in the SPA.
- **Seeds only those specs used are deleted:** `basic`, `payment_tiers`, `stripe_payment`, `user_registration`, `password_reset_token`, and `tests/STRIPE_TEST_CONTEXT.md`.
- **`NewTeamHelper` (and its only callers) and `application/_progressbar` are deleted.** Only the deleted team views used them. `DateHelper`, `MoneyHelper`, `TimeZoneHelper` and `FlashHelper` stay (mailers and kept staff views use them).

## Review Focus

1. **A kept page calls a deleted route helper and 500s.** The error pages render the application layout and navbar for every visitor, logged out included. So a navbar `races_path`, `teams_path`, `edit_user_path`, `new_user_session_path`, `new_password_reset_url` or `new_user_path` breaks every 404. The same holds for `team_path` in sent emails and `team_url`/`race_url`/`edit_user_path` in the users index. Owner: Task 3 `spec/requests/kept_legacy_pages_spec.rb`. It renders every kept staff page and `/no-such-page` (logged out, racer, admin): each answers its status, has no `translation_missing` span and no href to a redirected racer URL. Tasks 4-7 rerun it.
2. **A redirect is missing, wrong, or swallows a kept staff route.** Owner: Task 2/4/5/6 `spec/requests/legacy_redirects_spec.rb`. Every old URL answers 301 to its exact target. The "kept routes are not redirected" examples cover `/races/new`, `/races/:id/edit` and `/races/:race_id/export` (operator 200), `/teams/search` and `/users/search` (JSON 200), `/users` (admin 200), and `DELETE /users/:id` (admin, user removed). Junk ids (`/teams/abc`) are 404.
3. **An email links a deleted legacy URL.** Owner: Task 1 `spec/services/spa_url_spec.rb` and `spec/mailers/user_mailer_spec.rb`. These pin the exact `https://<host>/register/...` link in welcome, team finalized, registration reminder and password reset. `spec/integration/email_chains_spec.rb` follows the reset link through the redirect-free SPA URL.
4. **Deleting legacy locale keys breaks API, service or mailer messages.** `charges.*` (`Payments::ChargeTeam`, API mock payments), `teams.destroy.has_payments`, `people.destroy.team_complete`, `at` and `api.*` look legacy but are not. Owner: Task 7 `spec/i18n/kept_keys_spec.rb`, plus the existing `spec/requests/api/v1/payments_spec.rb`, `teams_spec.rb` and `people_spec.rb`.
5. **Staff are stranded on a kept page: logged out, an invalid record, or logging out.** Owner: Task 3 specs in `spec/controllers/application_controller_spec.rb` and the kept controller specs. A logged-out `GET /races/new` redirects to `/register/login`. An invalid user on `/users` redirects to `/register/account`. `DELETE /user_session` logs out and redirects to `/register`. Task 3 also repoints the users index select2 to SPA pages, checked in the browser.

---

### Task 1: `SpaUrl` and SPA links in every email

**Files:**
- Create: `app/services/spa_url.rb`, `spec/services/spa_url_spec.rb`
- Modify:
  - `app/mailers/user_mailer.rb` (`password_reset_instructions`, `registration_reminder`, and `welcome_email`, which sets `@home_url`);
  - `app/views/user_mailer/welcome_email.html.haml`, `welcome_email.text.erb` (`home_url` → `@home_url`);
  - `app/views/user_mailer/team_finalized_email.html.haml`, `team_finalized_email.text.erb` (`RegistrationUi.team_url(@team)` → `SpaUrl.for("/teams/#{@team.id}")`).
- Test: `spec/mailers/user_mailer_spec.rb`, `spec/integration/email_chains_spec.rb` (the password-reset example)

**Interfaces:**
- Produces: `SpaUrl.for(path = "/", host: nil) -> String`. It returns `"#{protocol}://#{host}/register#{path}"`. The protocol is `UserMailer.default_url_options[:protocol]` or `"http"`. The host is the given `host`, else `UserMailer.default_url_options.fetch(:host)`, port included. `path` must start with `/`. `SpaUrl::BASE_PATH = "/register"`.
- `UserMailer#password_reset_instructions(user, host)` keeps its signature (`Workers::PasswordResetEmail` passes the host) and links `SpaUrl.for("/reset-password/#{user.perishable_token}", host: host)`.

- [ ] **Step 1:** Write failing examples:
  - `spec/services/spa_url_spec.rb`, stubbing `UserMailer.default_url_options` as `registration_ui_spec.rb` does:
    - `{ host: "register.example.org", protocol: "https" }`: `SpaUrl.for("/teams/5")` is `"https://register.example.org/register/teams/5"`, and `SpaUrl.for` is `"https://register.example.org/register/"`.
    - `{ host: "localhost:3000" }`: `SpaUrl.for("/teams/5")` is `"http://localhost:3000/register/teams/5"`.
    - `SpaUrl.for("/reset-password/abc123", host: "mail.example.org")` with https options is `"https://mail.example.org/register/reset-password/abc123"`.
  - `spec/mailers/user_mailer_spec.rb`:
    - replace the two `RegistrationUi.team_url(team)` expectations with the literal `"https://staging.example.org/register/teams/#{team.id}"`, stubbing the options in those examples;
    - replace "links the reset page through RegistrationUi" with "links the SPA reset page": the body includes `"http://80/register/reset-password/#{user.perishable_token}"` (the spec passes host `'80'`; keep the protocol the examples' options give);
    - add "welcome email links the SPA landing" under `describe "mailer host"`: the body includes `"https://staging.example.org/register/"`.
  - `spec/integration/email_chains_spec.rb` "password reset email contains a working edit link": expect `SpaUrl.for("/reset-password/#{user.reload.perishable_token}", host: "example.org")`, not `edit_password_reset_url`.
- [ ] **Step 2:** Run `bundle exec rspec spec/services/spa_url_spec.rb spec/mailers/user_mailer_spec.rb spec/integration/email_chains_spec.rb` — FAIL.
- [ ] **Step 3:** Implement `SpaUrl` and switch the mailer and the four templates. `RegistrationUi` stays until Task 2 (the homepage still reads it).
- [ ] **Step 4:** Run the same specs plus `spec/workers/` — PASS.
- [ ] **Step 5:** Commit — `Link the SPA from every email through SpaUrl`

### Task 2: `/` redirects to `/register`; delete the homepage, the store and `RegistrationUi`

**Files:**
- Delete:
  - `app/controllers/homepages_controller.rb`, `app/views/homepages/`;
  - `app/views/store/`, `app/views/application/_store.html`;
  - `app/services/registration_ui.rb`, `spec/services/registration_ui_spec.rb`;
  - `spec/controllers/homepages_controller_spec.rb`, `spec/requests/homepage_spec.rb`.
- Create: `spec/requests/legacy_redirects_spec.rb`
- Modify:
  - `config/routes.rb` (root);
  - `tests/helpers/server-env.ts` (drop `REGISTRATION_UI`), `playwright.config.ts` (drop it from the comment).

**Interfaces:**
- `root to: redirect("/register"), as: :home` (301). The `match "/", to: "errors#not_found", via: [:post, :put, :patch, :delete]` line stays.

- [ ] **Step 1:** Write `spec/requests/legacy_redirects_spec.rb` with a helper `expect_moved(path, to)`: `get path`, then `expect(response).to have_http_status(:moved_permanently)` and `expect(response).to redirect_to(to)`. Examples:
  - `"/" moves to /register`, logged out and logged in as a racer;
  - `"POST / is still a 404"`: `post "/"` → 404.
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/legacy_redirects_spec.rb` — FAIL (`GET /` renders the homepage, 200).
- [ ] **Step 3:** Change the root route and delete the files listed. `grep -rn "RegistrationUi\|REGISTRATION_UI\|store/main\|homepages" app lib config spec tests` must return nothing except docs (Task 9).
- [ ] **Step 4:** Run the redirect spec, `spec/routing/` and `spec/requests/spa_spec.rb` — PASS.
- [ ] **Step 5:** Commit — `Redirect / to the SPA; remove the legacy homepage, store and REGISTRATION_UI switch`

### Task 3: Kept legacy chrome and staff pages point at the SPA

**Files:**
- Modify:
  - `app/views/application/_navbar.html.haml`:
    - brand → `"/register"`;
    - Races → `"/register"`;
    - My teams → `"/register/teams"`;
    - Edit profile → `"/register/account"`;
    - Login → `"/register/login"`;
    - Forgot password → `"/register/forgot-password"`;
    - Register → `"/register/signup"`;
    - Logout stays `user_session_path` (DELETE).
  - `app/controllers/application_controller.rb`:
    - `require_user` redirects to `"/register/login"` with the existing notice and no `store_location`;
    - `user_update_checker` redirects to `"/register/account"`;
    - `should_run_update_checker` drops the `users` edit/update clause and keeps `user_sessions#destroy`.
  - `app/controllers/user_sessions_controller.rb` (`destroy` redirects to `"/register"` with `logout_success`).
  - `app/views/users/index.html.haml`:
    - the name links → `"/register/staff/users/#{user.id}"`;
    - Edit → the same;
    - team → `"/register/teams/#{t.id}"`;
    - race → `"/register/staff/races/#{t.race.id}"`;
    - remove the `new_user_path` "+" link (owner decision 2026-11-25: staff never create accounts);
    - Destroy stays `user` (DELETE).
  - `app/assets/javascripts/users/index.js.coffee` (select2 form actions → `"/register/staff/users/#{userId}"` and `"/register/teams/#{teamId}"`).
  - `app/views/sent_emails/index.html.haml` (team link → `"/register/teams/#{email.team_id}"`).
  - `app/controllers/races_controller.rb` (`create` → `edit_race_url(@race)`, `destroy` → `"/register/staff/races"`), `app/controllers/requirements_controller.rb` (`destroy` → `edit_race_url(@requirement.race)`).
  - `frontend/src/features/staff-races/components/race-overview.tsx` ("Who's registered" becomes `ButtonLink to={`/races/${race.id}/registrations`}`, an SPA route).
- Create: `spec/requests/kept_legacy_pages_spec.rb`
- Test:
  - `spec/requests/staff_navbar_spec.rb`, `spec/controllers/application_controller_spec.rb`;
  - `spec/controllers/{races,requirements,tiers,sent_emails,charges,users}_controller_spec.rb` (every `redirect_to(new_user_session_path)` becomes `redirect_to("/register/login")`);
  - `spec/controllers/user_sessions_controller_spec.rb` (destroy);
  - `frontend/src/features/staff-races/components/race-overview.test.tsx`.

**Interfaces:**
- Produces: a spec helper (inside `kept_legacy_pages_spec.rb`) `racer_hrefs(body) -> [String]`. It returns every `a[href]` and `form[action]` value matching `%r{\A/(teams|account|login|user_session/new|password_resets|races/?\z|races/\d+/?\z|races/\d+/registrations|users/new|users/\d+/edit)}` or exactly `/users/<id>` used as a GET link (exclude `data-method="delete"` / `button_to` forms).

- [ ] **Step 1:** Write failing examples.
  - `spec/requests/kept_legacy_pages_spec.rb`. Each page: status 200 (404 for the error page), `expect(response.body).not_to include("translation_missing")`, `expect(racer_hrefs(response.body)).to eq([])`:
    - admin `GET /users`, with a racer owning a team that has a paid `CompletedRequirement`, so the team, race, payment and Edit cells render;
    - operator `GET /sent_emails`, with a `SentEmail` carrying `team_id`;
    - operator `GET /races/new`, `GET /races/:id/edit` (race with a payment requirement), `GET /races/:race_id/requirements/:id/edit` (requirement with a tier), `GET /tiers/new?requirement_id=`, `GET /tiers/:id/edit`;
    - `GET /no-such-page` logged out, as a racer and as an admin: 404, and the navbar hrefs include `/register/login` (logged out) or `/register/account` (logged in).
  - `spec/requests/staff_navbar_spec.rb`:
    - every `get "/races"` becomes `get "/no-such-page"` with `have_http_status(:not_found)` (the 404 page carries the navbar);
    - "Public sign-up links" becomes "keeps the logged-out Register link on the SPA sign-up page" (`.navbar a[href="/register/signup"]` text `Register`);
    - delete the login-page example.
  - `spec/controllers/application_controller_spec.rb`:
    - an anonymous controller action behind `before_action :require_user` redirects a logged-out request to `"/register/login"`;
    - the same action, for a logged-in user whose record is invalid (`update_column(:phone, nil)`), redirects to `"/register/account"`.
  - `spec/controllers/races_controller_spec.rb`: successful `#create` redirects to `edit_race_url(Race.last)`, and `#destroy` to `"/register/staff/races"`. `spec/controllers/requirements_controller_spec.rb`: `#destroy` redirects to `edit_race_url(race)` (the two `race_url` expectations).
  - `spec/controllers/user_sessions_controller_spec.rb` `#destroy`: redirects to `"/register"` and the session is gone.
  - `race-overview.test.tsx`: the `staff.race.registered` link's href is `/register/races/4/registrations`.
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/kept_legacy_pages_spec.rb spec/requests/staff_navbar_spec.rb spec/controllers/` and `npm --prefix frontend test -- --run src/features/staff-races` — FAIL.
- [ ] **Step 3:** Implement the edits. The new spec also exposes a gap that predates this PR: `races/edit.html.haml` reads `races.edit.race_requirements` and `races.edit.no_requirements_added`, but those keys live under `races.show` (the action used to be `alias edit show`, and lazy lookup follows the template). Copy them to a new `races.edit` scope in `config/locales/en.yml`. If another kept page shows `translation_missing` before any change, fix it the same way and list it in the commit message. Do not delete `require_no_user`, `store_location` or `redirect_back_or_default` yet; Task 4 removes them with their last callers.
- [ ] **Step 4:** Run the same specs — PASS.
- [ ] **Step 5:** Browser check (Playwright MCP, dev server with the SPA built): as an admin on `/users`, picking a user in the name search lands on `/register/staff/users/<id>`, and picking a team lands on `/register/teams/<id>`.
- [ ] **Step 6:** Commit — `Point the kept legacy navbar, staff pages and login fallbacks at the SPA`

### Task 4: Delete the legacy account pages (sign-up, login, password reset, account edit)

**Files:**
- Delete:
  - `app/controllers/password_resets_controller.rb`, `app/views/password_resets/`;
  - `app/views/user_sessions/`;
  - `app/views/users/{_form,create,destroy,edit,new,show,update}.html.haml` (keep `users/index.html.haml`);
  - `spec/controllers/password_resets_controller_spec.rb`, `spec/requests/user_sessions_spec.rb`.
- Modify:
  - `app/controllers/user_sessions_controller.rb` (only `destroy`, `before_action :require_user`);
  - `app/controllers/users_controller.rb`: only `index`, `destroy`, `search`; drop `user_params`; `before_action :require_user`;
  - `app/controllers/application_controller.rb` (delete `require_no_user`, `store_location`, `redirect_back_or_default`);
  - `config/routes.rb`;
  - `spec/controllers/users_controller_spec.rb` (keep the index/destroy/search examples, delete new/create/show/edit/update; move "runs the user_update_checker" onto `#index`);
  - `spec/controllers/user_sessions_controller_spec.rb` (keep `#destroy` only);
  - `spec/integration/email_chains_spec.rb` ("signup sends welcome" becomes a request spec: `post "/api/v1/users"` with `FactoryBot.attributes_for(:user)` inside `Sidekiq::Testing.inline!`, with the same assertions);
  - `spec/requests/legacy_redirects_spec.rb`.

**Interfaces (routes):**
```ruby
resources :users, only: [:index, :destroy]
get "users/new", to: redirect("/register/signup")
get "users/:id", to: redirect("/register/account"), constraints: { id: /\d+/ }
get "users/:id/edit", to: redirect("/register/account"), constraints: { id: /\d+/ }
get "account", to: redirect("/register/account")
get "account/edit", to: redirect("/register/account")
resource :user_session, only: [:destroy]
get "user_session/new", to: redirect("/register/login")
get "login", to: redirect("/register/login")
get "password_resets/new", to: redirect("/register/forgot-password")
get "password_resets/:token/edit", to: redirect("/register/reset-password/%{token}"), constraints: { token: /[A-Za-z0-9_-]+/ }
```
The `users/search` and `teams/search` lines at the top of the file stay first. `resource :account` and `resources :password_resets` are removed.

- [ ] **Step 1:** Add failing examples to `legacy_redirects_spec.rb`:
  - `/account`, `/account/edit`, `/users/7`, `/users/7/edit` → `/register/account`;
  - `/users/new` → `/register/signup`;
  - `/login`, `/user_session/new` → `/register/login`;
  - `/password_resets/new` → `/register/forgot-password`;
  - a real token (`user.reset_perishable_token!`; `user.perishable_token`) at `/password_resets/<token>/edit` → `/register/reset-password/<token>`;
  - kept routes are not redirected: admin `GET /users` → 200; admin `GET "/users/search", params: { q: "x" }, as: :json` → 200 JSON array; admin `DELETE /users/:id` on a user with no teams → redirects to `users_path` and `User.exists?(id)` is false;
  - old forms are gone: `post "/users"`, `post "/user_session"`, `patch "/users/7"` → 404.
- [ ] **Step 2:** Run `bundle exec rspec spec/requests/legacy_redirects_spec.rb` — FAIL.
- [ ] **Step 3:** Delete and edit as listed.
- [ ] **Step 4:** Run `bundle exec rspec spec/requests/ spec/controllers/ spec/integration/` — PASS (including `kept_legacy_pages_spec.rb`).
- [ ] **Step 5:** Commit — `Delete the legacy sign-up, login, password reset and account pages; redirect their URLs`

### Task 5: Delete the legacy team pages (teams, people, questions, captains, charges, mock payments)

**Files:**
- Delete:
  - `app/controllers/{people,questions,captains,charges,mock_payments}_controller.rb`;
  - `app/views/{people,questions,charges}/`;
  - `app/views/teams/` (all of it);
  - `app/views/requirements/_payment_requirement.html.haml`, `_mock_payment_requirement.html.haml`;
  - `app/views/application/_progressbar.html.haml`;
  - `app/helpers/new_team_helper.rb` (and its spec if one exists);
  - `app/assets/javascripts/questions/show.js.coffee`;
  - `spec/controllers/{teams,people,questions,captains,charges}_controller_spec.rb`, `spec/controllers/teams_emails_link_spec.rb`, `spec/views/requirements/refunded_payment_spec.rb`.
- Modify:
  - `app/controllers/teams_controller.rb` (only `search` stays, with `before_action :require_user`, `set_no_cache`, `load_and_authorize_resource`);
  - `config/routes.rb`;
  - `spec/requests/legacy_redirects_spec.rb`;
  - `tests/spa/payments-admin.spec.ts` (delete the three "Legacy team page, as the refunder" lines; the owner's SPA check right after covers the badge).

**Interfaces (routes):**
```ruby
get "teams", to: redirect("/register/teams")
get "teams/new", to: redirect { |_params, req| ... }   # "/register/races/<race_id>/teams/new" when race_id is all digits, else "/register"
get "teams/:id", to: redirect("/register/teams/%{id}"), constraints: { id: /\d+/ }
get "teams/:id/*rest", to: redirect("/register/teams/%{id}"), constraints: { id: /\d+/ }, format: false
```
`resources :teams`, `resources :charges` and `post 'mock_payment'` are removed. `get 'teams/search'` stays at the top.

- [ ] **Step 1:** Add failing examples to `legacy_redirects_spec.rb`:
  - `/teams` → `/register/teams`;
  - `/teams/new?race_id=12` → `/register/races/12/teams/new`; `/teams/new` and `/teams/new?race_id=abc` → `/register`;
  - `/teams/34`, `/teams/34/edit`, `/teams/34/people/new`, `/teams/34/people/56/edit`, `/teams/34/questions` → `/register/teams/34`, logged out and as the team's owner (same 301);
  - `/teams/abc` → 404;
  - kept: operator `GET "/teams/search", params: { q: <team name> }, as: :json` → 200 with `[{ "id" => team.id, "text" => "#{team.name} - #{team.race.name}" }]`;
  - gone: `post "/teams"`, `post "/charges"`, `post "/charges/ch_1/refund"`, `post "/mock_payment"`, `delete "/teams/34"`, `put "/teams/34/captain"` → 404.
- [ ] **Step 2:** Run it — FAIL.
- [ ] **Step 3:** Delete and edit as listed. Then `grep -rnE "team_(url|path)|teams_path|team_questions|team_people|team_person|team_captain|charges_path|charge_refund|mock_payment_path|new_team_label|new_team_setting_options" app lib config` must return nothing outside `app/controllers/api` and the jbuilder views (whose `team_id` keys are not helpers).
- [ ] **Step 4:** Run `bundle exec rspec` (full) — PASS. `spec/services/payments/`, `spec/requests/api/v1/payments_spec.rb` and `refund_batches` specs prove the shared payment and refund paths are untouched.
- [ ] **Step 5:** Commit — `Delete the legacy team, racer, questions, captain and payment pages; redirect team URLs to the SPA`

### Task 6: Delete the legacy race list, race page and registrations page

**Files:**
- Delete:
  - `app/views/races/{index,show,registrations,_race_item,_race_metadata,_admin_buttons}.html.haml`;
  - `app/assets/javascripts/races/registrations.js.coffee`;
  - `spec/views/races/_race_metadata.html.haml_spec.rb`.
- Modify:
  - `app/controllers/races_controller.rb`:
    - remove `index`, `show`, `registrations`;
    - `edit` becomes its own action that loads `@race` (it was `alias edit show`);
    - `before_action :require_user` for every action;
  - `config/routes.rb`;
  - `spec/controllers/races_controller_spec.rb` (delete the `#index`, `#show` and `#registrations` examples, including the logged-out one);
  - `spec/requests/legacy_redirects_spec.rb`.

**Interfaces (routes):**
```ruby
resources :races, only: [:new, :create, :edit, :update, :destroy] do
  get :export
  resources :requirements, only: [:new, :create, :edit, :update, :destroy]
end
get "races", to: redirect("/register")
get "races/:id", to: redirect("/register"), constraints: { id: /\d+/ }
get "races/:race_id/registrations", to: redirect("/register/races/%{race_id}/registrations"), constraints: { race_id: /\d+/ }
```

- [ ] **Step 1:** Add failing examples:
  - `/races` and `/races/12` → `/register`;
  - `/races/12/registrations` → `/register/races/12/registrations`;
  - kept, as an operator: `GET /races/new` → 200, `GET /races/:id/edit` → 200, `GET /races/:race_id/export` → 200 with `content_type` `text/csv`;
  - kept, logged out: `GET /races/new` redirects to `/register/login`;
  - gone: `post "/races/12/registrations"` → 404.
- [ ] **Step 2:** Run it — FAIL.
- [ ] **Step 3:** Delete and edit as listed. `grep -rnE "races_(url|path)|\brace_(url|path)|race_registrations_(url|path)" app lib config` must return nothing.
- [ ] **Step 4:** Run `bundle exec rspec spec/controllers/races_controller_spec.rb spec/views/ spec/requests/` — PASS.
- [ ] **Step 5:** Commit — `Delete the legacy race list, race page and registrations page; redirect their URLs`

### Task 7: Remove the deleted pages' locale keys; keep the shared ones

**Files:**
- Modify: `config/locales/en.yml`
- Create: `spec/i18n/kept_keys_spec.rb`

**Interfaces:**
- Delete these subtrees:
  - `homepages`, `password_resets`, `user_sessions`, `questions`, `captains`;
  - `users.create`, `users.new`, `users.edit`, `users.form`, `users.update`;
  - `people.*` except `people.destroy.team_complete`;
  - `teams.*` except `teams.destroy.has_payments`;
  - `requirements.payment_requirement`;
  - `races.registrations`, `races.index`, `races.race_metadata`, `races.race_item`, `races.show`.
- Delete these top-level keys only when `grep -rn "<key>" app lib` finds no remaining caller: `store_instructions`, `please_create_to_continue`, `must_select_race`, `must_select_team`, `login_success`, `login_failed`, `create_success_user`, `create_success_with_race`, `register_for`, `refund_and_invalidate`, `mush`, `dogpen`.
- Keep:
  - `application.navbar.*`;
  - `users.index`, `users.review_your_info`;
  - `races.update`, `races.form`, `races.destroy`, `races.edit` (added in Task 3);
  - `requirements.table`, `tiers.*`;
  - `charges.*`, `api.*`, `user_mailer.*`, `activerecord.*`;
  - `at`, `logout_success`, `global_questions`, and every generic key (`save`, `delete`, `edit`, `back`, ...) still used by a kept view.

- [ ] **Step 1:** Write `spec/i18n/kept_keys_spec.rb`. "keeps every key the API, services and mailers read": `I18n.exists?(key, :en)` is true for each of:
  - `charges.unexpected`, `charges.stripe_error`, `charges.invalid_request`, `charges.api_connection`, `charges.price_changed`, `charges.mock_declined`, `charges.mock_not_saved`, `charges.roster_incomplete`, `charges.race_full`, `charges.already_paid`, `charges.in_progress`, `charges.duplicate_charge`, `charges.not_payable`, `charges.wrong_race`, `charges.no_active_price`;
  - `teams.destroy.has_payments`, `people.destroy.team_complete`;
  - `api.errors.registration_closed`, `at`, `logout_success`, `users.review_your_info`, `global_questions`.
- [ ] **Step 2:** Run it — PASS (it guards Step 3). Run `spec/requests/kept_legacy_pages_spec.rb` — PASS.
- [ ] **Step 3:** Delete the keys.
- [ ] **Step 4:** Run `bundle exec rspec` (full) — PASS, with no `translation_missing` in `kept_legacy_pages_spec.rb`.
- [ ] **Step 5:** Commit — `Remove locale keys of the deleted racer pages`

### Task 8: Playwright: retire the legacy specs, add a redirect spec

**Files:**
- Delete:
  - `tests/password-reset.spec.ts`, `tests/payment-tiers.spec.ts`, `tests/stripe-payment.spec.ts`, `tests/user-joins-team.spec.ts`, `tests/user-registration.spec.ts`, `tests/STRIPE_TEST_CONTEXT.md`;
  - in `lib/tasks/test_seeds.rake`, the tasks `basic`, `payment_tiers`, `stripe_payment`, `user_registration`, `password_reset_token` and their header comment lines.
- Create: `tests/spa/legacy-redirects.spec.ts`; task `test_seeds:legacy_redirects` in `lib/tasks/test_seeds.rake`.
- Modify: `playwright.config.ts` (the `local-suite` `testMatch` becomes only `/tests[\\/]spa[\\/][^\\/]+\.spec\.ts$/`; fix its comment, which says "the legacy and seed-based SPA specs").

**Coverage map for the deleted specs** (checked; nothing to port):

| Deleted spec | Covered by |
|---|---|
| `user-registration` | `tests/e2e/registration.spec.ts` sign-up (in `npm test` through the `registration` project) |
| `user-joins-team`, `payment-tiers`, `stripe-payment` | `tests/e2e/registration.spec.ts`: 5 racers, two fees with a later price, pay, `You're in!`. `npm run e2e:stripe` runs the real Checkout. Tier choice is covered by the `Tier`/`Requirement` model specs and fee-card Vitest |
| `password-reset` | `tests/spa/password-reset.spec.ts` |

`tests/e2e/registration.spec.ts`, `race-setup.spec.ts` and `admin-auth.setup.ts` already use only `/register` pages and `/api/v1` (checked: `/register/signup`, `/register/login`, `/register/staff/races/...`). `admin-forms.ts`'s navigation guard fails a run on any non-`/register` page load, so the staging path cannot touch a deleted page.

**Interfaces:**
- Produces `test_seeds:legacy_redirects` (unique `TEST_UNIQUE_ID`). It writes credentials `{ captain_email, captain_password, team_id, team_name, reset_token }`:
  - `Race Redirects <id[0..7]>`, open, 3 per team;
  - owner `redirects-owner-<id>@example.com` / `password123`;
  - team `Test Team Redirects <id[0..7]>` with one racer;
  - `reset_token`: a second user `redirects-reset-<id>@example.com` after `reset_perishable_token!`.

  `test_seeds:cleanup` already sweeps `Race %`, `Test Team%` and `@example.com`; confirm, no change.

- [ ] **Step 1:** Write `tests/spa/legacy-redirects.spec.ts` (seed through `tests/helpers/seed.ts`), at 320×700:
  1. Logged out, `page.goto('/')` ends on a URL matching `/\/register\/?$/` and shows the heading `Choose your race`; `document.documentElement.scrollWidth <= 320`.
  2. Logged out, `page.goto('/teams/<team_id>')` ends on `/register/login?next=...`; logging in there (labels `Email`, `Password`, button `Log in`) lands on `/register/teams/<team_id>` showing the team name.
  3. `page.goto('/password_resets/<reset_token>/edit')` ends on `/register/reset-password/<reset_token>` with the heading `Choose a new password`.
  4. Logged in as the owner, `page.goto('/account')` ends on `/register/account`.
- [ ] **Step 2:** Add the seed. Build the SPA (`npm --prefix frontend run build`). Run against a separate database:
  `DATABASE_URL=postgres://postgres@localhost/dogtag_reskin5_e2e TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid npx playwright test tests/spa/legacy-redirects.spec.ts`
  It must PASS.
- [ ] **Step 3:** Delete the legacy specs and seeds and fix `playwright.config.ts`. `grep -rn "test_seeds:\(basic\|payment_tiers\|stripe_payment\|user_registration\|password_reset_token\)" tests lib spec` must return nothing (README fixes are Task 9).
- [ ] **Step 4:** Run the whole local suite the same way, with the fake Stripe keys so the `registration` project runs in mock mode:
  `STRIPE_PUBLISHABLE_KEY=pk_test_localfake STRIPE_SECRET_KEY=sk_test_localfake DATABASE_URL=postgres://postgres@localhost/dogtag_reskin5_e2e TEST_PORT=3199 PIDFILE=tmp/pids/e2e-3199.pid E2E_CHECK_EMAIL=1 npm test`
  Everything must PASS, including `tests/spa/payments-admin.spec.ts` (edited in Task 5) and `tests/e2e/registration.spec.ts`. Staging e2e (`npm run e2e:staging`) is never run by Claude; the owner runs it after the staging deploy.
- [ ] **Step 5:** Commit — `Retire the legacy Playwright specs and seeds; add a legacy redirect spec`

### Task 9: Docs and hand-off

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `docs/runbooks/2026-production-launch.md`, `tests/README.md`

- [ ] **Step 1:** `README.md`:
  - remove the `REGISTRATION_UI=spa` env line (line 40) and the "Set `REGISTRATION_UI=spa`..." bullet (line 224);
  - fix "Playwright boots Rails with ... `REGISTRATION_UI=spa`" (line 209);
  - replace the `test_seeds:basic` examples with `test_seeds:past_racers`;
  - say that `/` redirects to `/register` and that only staff pages remain in HAML until PR 10.
- [ ] **Step 2:** `CLAUDE.md`:
  - replace the "`REGISTRATION_UI` Switch" section with a short "Racer entry points" section covering:
    - `/` 301 → `/register`;
    - the redirect table;
    - `SpaUrl.for` for mail links;
    - the kept `user_sessions#destroy` logout;
    - `require_user` → `/register/login`;
  - drop `REGISTRATION_UI` from the Heroku config-var list (Yearly Launch Checklist item 4) and from "Environment Variables";
  - replace "The legacy racer flow (HAML views) must keep working after every change" with "Only staff pages remain in HAML (races new/edit/export, requirements, tiers, users index, sent emails, error pages); they go in reskin PR 10";
  - fix the racer-legacy mentions:
    - Registration SPA bullets #330 (legacy `number_field`), #331 (legacy `CaptainsController`, `#choose-captain`, legacy table), `showWhen` (vendored jsonform legacy check) and 2027 payload (`description_instructions`);
    - the Account bullet (legacy `/users/:id` self-edit; legacy `tests/password-reset.spec.ts`);
    - Team Finalization "Deleting a team" (legacy `teams#destroy`);
    - Known Quirk 6 (legacy `ChargesController#create`, `no_pay_roster`) and 11 (legacy `ChargesController#refund`, "Refund and invalidate");
    - Planned Payments ("the legacy button stays until the legacy page is retired");
  - add a "Racer cleanup (reskin PR 9)" bullet under Registration SPA covering:
    - the deleted areas;
    - `spec/requests/legacy_redirects_spec.rb` and `kept_legacy_pages_spec.rb`;
    - `spec/i18n/kept_keys_spec.rb`;
    - `test_seeds:legacy_redirects` / `tests/spa/legacy-redirects.spec.ts`.
- [ ] **Step 3:** `docs/runbooks/2026-production-launch.md`:
  - the config-var line no longer lists `REGISTRATION_UI` as needed (note: "not read since reskin PR 9; unset after it is stable");
  - step 0 "Go/no-go" no longer offers flipping to `legacy`;
  - the Rollback row "New pages misbehave" becomes `heroku rollback -a dogtag` (the previous release still has the legacy pages, and keeps `REGISTRATION_UI=spa`).
- [ ] **Step 4:** `tests/README.md`:
  - remove the legacy spec entries (`user-joins-team.spec.ts`, the `basic` seed examples);
  - fix the `password-reset.spec.ts` line (it no longer follows a legacy page);
  - add `legacy-redirects.spec.ts`;
  - drop `REGISTRATION_UI=spa` from the Playwright environment line.
- [ ] **Step 5:** Run `bin/check` — every step passes.
- [ ] **Step 6:** Commit — `Document the racer cleanup: redirects, SPA mail links, no REGISTRATION_UI`
- [ ] **Step 7:** Hand-off to the controller, who opens the PR against `chiditarod/dogtag` (base `feature/reskin-8-staff-team`). The PR body lists:
  - **Owner-timed.** Do not merge or deploy until the owner says. Never during the 2026-12-06 to 2026-12-09 freeze; the spec waits until the SPA has carried live registration cleanly for a stretch the owner picks. Stacked on #363 (PRs 1-8 must be deployed first).
  - **Deploy:**
    - no migration, no `heroku restart`; no Gemfile/config changes (routes and locales only);
    - staging first (`git push staging ...`). Smoke: `/`, an old `/teams/<id>` link, an old reset link, `/users` and `/races/new` as staff, a 404 page logged out, logout from the legacy navbar;
    - the owner runs `npm run e2e:staging`;
    - then production; watch Rollbar for `NoMethodError` on kept staff pages and for 404s on old racer paths.
  - **Rollback:** `heroku rollback`. Every redirect target exists in PR 8, so browser-cached 301s still resolve.
  - **`REGISTRATION_UI`:** leave it set until the owner's answer to open question 2.
  - **Calls made and open questions:** the "Calls made in this plan" and both open questions with the owner's answers, especially the Refund button and `ChargesController` going in this PR.
  - **Review Focus** (above).
  - **E2E:** whether `tests/spa/legacy-redirects.spec.ts` and the full local `npm test` were run (local only; staging is left to the owner).
