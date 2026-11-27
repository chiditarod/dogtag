
## Project Overview
Dogtag is a Ruby on Rails application that manages user and team registration for the annual CHIditarod urban shopping cart race and mobile food drive. It processes payments via Stripe, integrates with Classy for fundraising campaigns, and supports custom per-race survey questions via JSONForm.

## Project Conventions

- Always use sub-agents when exploring a project's context or structure.
- Always use sub-agents and parallelism whenever it is safe to do so to increase throughput and reduce token use.
- Always use Context7 MCP when you need library/API documentation, code generation, setup or configuration steps without user explicitly asking.
- Always use Playwrite MCP when you need to verify UI changes without user explicitly asking.
- Ensure the React app follows Bulletproof React standard (https://github.com/alan2207/bulletproof-react).
- Put key learnings into CLAUDE.md after every iteration.
- Once you finish a task, automatically commit all changes that your work made with a concise and descriptive message. ensure you do not commit changes that you did not make as part of that task.
- When asking the user for permission to execute a command, additionally prompt to "Always allow" to remember their choice for the session. Do not re-ask for the same type of command.
- Feature branches are pushed to `origin`, and PRs are opened against `chiditarod/dogtag` (`gh pr create --repo chiditarod/dogtag`). Never merge; the owner merges.
- Code PRs are stacked linearly (PR2 from `main`, then PR3 from PR2, and so on). Stacked PRs must be merged in order.
- Ask before Gemfile/config changes (see Coding Guidelines > General); call any such change out in the PR body.
- Irreversible or production actions (Heroku app deletion, production DB restore, live charges) need explicit owner confirmation at the time.
- Commit messages end with the `Co-Authored-By` attribution line; PR bodies end with the `Generated with Claude Code` line.
- After finishing each task, review and update README.md if the task introduced new setup steps, commands, or changed how things work.

## Tech Stack

- **Ruby**: 3.4
- **Rails**: 8
- **Database**: PostgreSQL 17
- **Background Jobs**: Sidekiq with Redis
- **Frontend**: Vite + React 19 + TypeScript + Tailwind SPA in `frontend/`, served under `/register`
- **Authentication**: Authlogic 6.x with SCrypt
- **Authorization**: CanCanCan with RoleModel
- **Payments**: Stripe API
- **Testing**: RSpec, FactoryBot, Playwright (integration), Vitest (frontend)
- **CI/CD**: CircleCI

## Project Structure

The project follows standard Rails conventions:

```
app/                # Core application code (MVC)
  models/           # ActiveRecord models with validations and business logic
  controllers/      # Thin controllers, authorization via CanCan
  views/            # HAML templates
  workers/          # Sidekiq background jobs (in workers/ subdirectory)
  services/         # Plain Ruby service objects shared by controllers and the API
  validators/       # Custom validators (TeamValidator, PersonValidator, etc.)
  mailers/          # Email templates
  helpers/          # View helpers

lib/                # Library code
  classy_client.rb  # Classy API wrapper
  classy_user.rb    # Classy user linking logic
  stripe_helper.rb  # Stripe utility methods
  json_form.rb      # JSONForm parsing
  tasks/            # Rake tasks

spec/               # Unit tests
  models/           # Model specs
  controllers/      # Controller specs
  workers/          # Background job specs
  lib/              # Library specs
  factories/        # FactoryBot factories
  support/          # Shared examples and test helpers

tests/              # Playwright integration tests (TypeScript)

frontend/           # Vite + React SPA for racer registration (built into public/register)

bin/                # Executable scripts

config/             # Configuration files

db/                 # Database schema and migrations

public/             # Public assets
```

## Development Workflow

### Running the Application
- Use `bin/rails server` to start the development server
- Use `bin/rails console` to start the Rails console

### Database Operations
- Use `bin/rails db:migrate` to run pending migrations
- Use `bin/rails db:seed` to seed the database
- Use `bin/rails db:reset` to reset the database

### Running Tests
- Use `bundle exec rspec` to run all tests (there is no `bin/rspec`)
- Use `bundle exec rspec [path]` for specific tests
- Prefer `bin/check` (all suites, quiet: one summary line per step, failure details only, full logs in `tmp/check/`); `bin/check rspec|frontend|build|e2e` runs one step

## Coding Guidelines

### General
- Write concise, idiomatic Ruby code with accurate examples
- Follow Rails conventions and best practices
- Use object-oriented and functional programming patterns as appropriate
- Prefer iteration and modularization over code duplication
- Use descriptive variable and method names (e.g., user_signed_in?, calculate_total)
- Structure files according to Rails conventions (MVC, concerns, helpers, etc.)
- Ask before changing the Gemfile/Gemfile.lock, `config/initializers`, `config/environments`, `config/application.rb`, or `spec/spec_helper.rb`. Routes, locales and `config/schedule.yml` are fine to change. New helpers under `spec/support/` are fine; changes to existing ones need a reason. Call any such change out in the PR body. If something appears to be missing or misconfigured, stop and ask rather than working around it.

### Common Patterns
- If a form url or controller redirect is to an action in the same controller, use a hash with the action name as the key e.g. `{ action: :new }`
- When making migrations, use `text` for all string fields; never use `string` or `varchar`

### Naming Conventions
- Use snake_case for file names, method names, and variables
- Use CamelCase for class and module names
- Follow Rails naming conventions for models, controllers, and views

### Ruby and Rails Usage
- Use Ruby 3.x features when appropriate (e.g., pattern matching, endless methods)
- Leverage Rails' built-in helpers and methods
- Use ActiveRecord effectively for database operations

### Syntax and Formatting
- Follow the Ruby Style Guide (https://rubystyle.guide/)
- Use Ruby's expressive syntax (e.g., unless, ||=, &.)
- Prefer double quotes for strings
- Always strip whitespace at the end of lines and ensure a blank line exists at the end of the file

### Controllers
- When adding new controllers or actions, don't forget to update the routes.rb
- Use `expect` syntax instead of `require`/`allow` for strong parameters:
  ```ruby
  # Good
  params.expect(user: [:name, :favorite_pie])

  # Bad
  params.require(:user).permit(:name, :favorite_pie)
  ```
- Unless parameters are reused more than once, assign strong parameters to a local variable rather than a method
- When linking or redirecting to an action in the same controller, use `url_for(action: "the_action")` instead of path helpers

### View templates
- The kept staff forms (races, requirements, tiers) are hand-written Bootstrap 3 `form_for` (HAML). There is no custom form builder.
- When creating `select` tags, use `include_blank: "string"` instead of manually adding a blank option to the list of options.
- Only staff pages remain in HAML (races new/edit/export, requirements, tiers, users index, sent emails, error pages); they go in reskin PR 10. Racer pages are SPA only, and old racer URLs redirect to it (see Racer entry points).

### Internationalization
- All public or client-facing pages will be translated. Admin pages will not be translated.
- Follow Rails I18n conventions for extracting strings to config/locales.
- Use relative identifiers whenever possible. For example, the relative `t(".title")` in `app/views/pages/homepage` is preferred to `t("pages.homepage.title")`.
- For strings that contain HTML, name the key with an `_html` suffix and author it as HTML (Rails marks it safe). There is no Markdown initializer or `_md` key support; only `ConfirmationText` renders Markdown (see Registration SPA).

### Database Migrations
- Always create a migration using `bin/rails g migration <NAME>`. If a migration has been created in the current development feature branch, rollback the migration, edit it and then roll forward rather than creating a new migration.
- Use `text` for all string fields; never use `string` or `varchar`
- Use `datetime` instead of `timestamp`
- Assume that Boolean values should be nullable unless specified

### Testing
- Write tests using RSpec. It's ok to put multiple assertions in the same example
- Use factories (FactoryBot) for test data generation
- Prefer real objects over mocks unless there is an external dependency like a third party API call. Use `instance_double` if necessary; never `double`
- Don't test declarative configuration. For validations, only test that it's not valid when the validation is violated. `shoulda-matchers` is not used.
- Test controllers behaviorally: assert on status code and/or data changes
- Use Timecop for time traveling
- Migration specs (`spec/migrations/`) call a data method on the migration (e.g. `backfill`), never `down`/`up`: re-adding a column inside the test transaction can reorder the table and break prepared statements in later specs
- Use WebMock for Classy and StripeMock for Stripe
- Request and controller specs assert on status plus data changes
- Sidekiq specs run in fake mode by default. Use `Sidekiq::Testing.inline!` blocks to run job chains end to end.
- Every frontend (SPA) feature needs a Playwright e2e spec in `tests/spa/` as well as Vitest tests. Seed it with its own `test_seeds:*` task (unique `TEST_UNIQUE_ID`, `@example.com` emails) and add that data to `test_seeds:cleanup`. State in the PR whether the e2e spec was actually run.

#### System Tests
- When writing System Tests, use `css_id(*)` and `css_class(*)` instead of `"#{dom_id(*)}"` `"#{dom_class(*)}"`
- Use Capybara async matchers and expectations and generally avoid asserting on `find` methods that may be flaky.

## Performance Optimization
- Use database indexing effectively
- Implement caching strategies (fragment caching, Russian Doll caching)
- Use eager loading to avoid N+1 queries
- Optimize database queries using includes, joins, or select

## Key Models & Relationships

- **User** → has_many Teams, has_many CompletedRequirements
- **Team** → belongs_to User (the account holder), belongs_to Race, has_many People, belongs_to captain (a `Person` on this team, optional)
- **Race** → has_many Teams, has_many Requirements
- **Person** → belongs_to Team
- **Requirement** (STI) → PaymentRequirement, MockPaymentRequirement
- **CompletedRequirement** → joins Team, Requirement, User

### Team Finalization

Teams must meet all requirements to finalize:
1. All people slots filled (configurable per race)
2. All payment requirements satisfied
3. All custom JSONForm questions answered

Use `team.meets_finalization_requirements?` to check status. Finalizing also needs a captain: `Team#finalize` checks `team.ready_to_finalize?` (`meets_finalization_requirements? && captain_id.present?`). Do not add the captain to `meets_finalization_requirements?`: `unfinalize` and the "team complete, cannot remove a racer" guards use it, so every already-finalized team without a captain would be un-finalized on its next edit. A team that pays or fills its roster before choosing a captain stays unfinalized until the captain is chosen, then finalizes immediately (choosing goes through `TeamAuditor` + `update`).

CSV exports (`Team.export`) write the team name with `Team#library_name` ("The Secret Gentlemen" becomes "Secret Gentlemen, The"); only a leading "The" is moved and the stored name is unchanged. The legacy race page's export dropdown (with that info icon) was deleted in reskin PR 9; `GET /races/:race_id/export` stays for staff.
`Team.export` also prefixes a team name starting with `=`, `+`, `-` or `@` with `'` so spreadsheets do not evaluate it (name column only). `app/assets/javascripts/tooltips.js` (`.js-tooltip` info icons) has no user since the legacy race page went; it goes with the rest of the HAML in PR 10.

Deleting a team: `Team#deletable?` (not finalized, nothing paid) gates `DELETE /api/v1/teams/:id` and the SPA's delete (the legacy `teams#destroy` is gone). The Ability lets a captain delete their own deletable team while registration is open, and operators any deletable team; admins can delete any team without payments. People are `dependent: :destroy`. The SPA shows `DeleteTeam` from `team.deletable`, and staff delete from the Pending table on the SPA registrations page (`/register/races/:id/registrations`) or from the staff team page.

## Common Patterns

### Email Handling

All email addresses are automatically downcased before validation. The validation also rejects uppercase emails as a safety net:

```ruby
before_validation :downcase_email
validate :email_must_be_lowercase
```

### Background Jobs

Background jobs are Sidekiq workers in `app/workers/workers/` (`Workers::*`). They `include Workers::Common` and implement `run(job, log)`:

```ruby
class Workers::MyWorker
  include Workers::Common

  def run(job, log)
    # Job logic
  end
end
```

Specs run in Sidekiq fake mode; use `Sidekiq::Testing.inline!` blocks for chains.

Cron jobs live in `config/schedule.yml`; sidekiq-cron auto-loads it on Sidekiq server startup (no initializer needed). `Workers::RegistrationReminders` runs daily; idempotency comes from `SentEmail` dedupe keys (`ReminderSelector`). Dedupe keys embed the deadline timestamp (e.g. `close-7d-<epoch>`) so a moved deadline or tier start sends a fresh reminder. Cron lines may carry a zone (`"0 9 * * * America/Chicago"`) to follow DST.

### Event-Driven Architecture

Models use Wisper for pub/sub events:

```ruby
include Wisper.model
# Events broadcast on create/update
```

## Frontend

- The racer registration SPA lives in `frontend/` (Vite + React ^19 + TypeScript ^5.7, react-router-dom ^7.1, @tanstack/react-query ^5.62, Tailwind ^3.4, Vite ^6, Vitest + Testing Library + msw). It mirrors the cartographer app's stack.
- Follow Bulletproof React feature folders: `src/features/<name>/{api,components}`. Use the `@` alias for `src`.
- It is built into `public/register` (gitignored) and served by Rails under `/register/*` through `SpaController`.
- Commands: `npm --prefix frontend run dev|build|test`.
- The dev server runs on port 5173 and proxies `/api` to `http://localhost:3000`. The Rails redirect to the dev server is opt-in: set `VITE_DEV_SERVER=http://localhost:5173`.
- SPA copy lives in `frontend/src/locales/en.ts`. Rails public strings live in `config/locales/en.yml`.
- Header logo: `frontend/public/logo.png` (640x389, small ribbon lettering) is sized `h-16` / `min-[400px]:h-20` / `sm:h-24` in `SiteHeader` (`components/layouts/site-header.tsx`, shared by `RegisterLayout` and `StaffLayout`). The logo does not shrink (`shrink-0`); the user menu beside it shrinks and wraps onto more lines (`flex-wrap`, `whitespace-nowrap` items), so a long first name plus `Staff` stays inside 320px. At 320px two menu lines fit beside an `h-16` logo, so do not go taller there. Stripe Checkout wants a roughly square image, so it uses `logo-square.png` (256x256, logo centered on opaque white); regenerate it with `sips --resampleWidth 256` then `sips -p 256 256 --padColor FFFFFF` if the logo changes.
- Design tokens ("Chicago Flag"): page bg `#f4f8fb`, flag blue `#b3ddf2`, star red `#e4002b`, red text `#c4001f`, navy text `#12202f`, link blue `#2f5aae`, cards `#ffffff`. Headings use Oswald (500/700); body uses Inter (400-700).
- Pages are mobile-first and work at 320px wide with no horizontal scroll.

## API Conventions

- The JSON API lives under `/api/v1` (`app/controllers/api/v1/`) with jbuilder views in `app/views/api/v1/`.
- Controllers are thin. Payment, Classy and email behavior flow through the existing code (`Requirement#complete`, Wisper `*Auditor` listeners, `Team#finalize`, `Workers::TeamFinalizer`, `Workers::ClassyCreateFundraisingTeam`, `UserMailer`). The API calls into these and never reimplements them.
- Auth is the same-origin Authlogic session cookie. Authorization uses the existing CanCanCan `Ability`.
- CSRF: fetch the token from the CSRF endpoint and send it as the `X-CSRF-Token` header on mutating requests.
- Every non-2xx JSON response has the shape `{ "error": String, "errors": { "<field>": [String] } }`. `errors` may be `{}`.

## Racer entry points

- There is no `REGISTRATION_UI` switch any more (removed in reskin PR 9; `RegistrationUi` is gone). `GET /` is a 301 to `/register`, and every old racer URL redirects to its SPA page (`config/routes.rb`): `/login` and `/user_session/new`, `/users/new`, `/users/:id` and `/users/:id/edit`, `/account` and `/account/edit`, `/password_resets/new` and `/password_resets/:token/edit`, `/races`, `/races/:id`, `/races/:race_id/registrations`, `/teams`, `/teams/new?race_id=N` and `/teams/:id` plus everything under it (numeric ids only). `spec/requests/legacy_redirects_spec.rb` is the table; `tests/spa/legacy-redirects.spec.ts` follows a few in a browser.
- Mail links to the SPA are built by `SpaUrl.for(path, host:)` (`app/services/spa_url.rb`, host and protocol from `UserMailer.default_url_options`, so `APP_HOST`).
- The kept legacy navbar still logs out through `DELETE /user_session` (`user_sessions#destroy`, then `/register`), and `require_user` sends a logged-out visitor of a staff page to `/register/login` (no `store_location`).
- Rollback is `heroku rollback`, not a flag: the previous release still has the legacy pages, and every redirect target exists in PR 8, so browser-cached 301s resolve.
- Config: after PR 9 `REGISTRATION_UI=spa` is still set on `dogtag-staging` and `dogtag` but nothing reads it. The owner unsets it (`heroku config:unset REGISTRATION_UI -a dogtag-staging`, then `-a dogtag`) after PR 9 has run cleanly on production for about a week, or once PR 10 ships.

## Yearly Launch Checklist

The 2026 production runbook with exact commands is `docs/runbooks/2026-production-launch.md`; copy it for the next year.

1. **Race record:**
   - Copy last year's race record and requirements, shifting dates by one year as a starting point.
   - Three payment tiers.
   - The owner confirms final dates and prices before go-live.
2. **JSONForm:** start from last year's payload (e.g. `chiditarod_22.json`).
   - Update year-specific text (orientation date/venue, food drive amounts, partner).
   - The owner reviews the text.
   - Commit the payload to `../dogtag-private/jsonform/`.
3. **Experience labels:** add the new year's label through the admin field.
   - **Confirmation text:** fill in the race's confirmation text (Markdown) in the admin race form and have the owner review it; it appears in the completion modal, the team page header and the finalized email.
4. **Heroku:**
   - `dogtag` is production (`dogtag.chiditarod.org`, `heroku` remote) and `dogtag-staging` is staging. Stage first on `dogtag-staging`.
   - Delete the previous year's app (e.g. `dogtag-22`) and remove its git remote. Deleting an app is irreversible, so confirm with the owner right before doing it.
   - Provision Postgres, Redis, a web dyno, and a worker dyno.
   - Set config vars: Stripe live keys, Classy, SMTP (MXRoute), Rollbar, `REDIS_URL`, Sidekiq web auth, `APP_HOST`, `MALLOC_ARENA_MAX=2`, `NPM_CONFIG_OMIT=dev` (keeps root test devDependencies out of the build).
   - Restore the production dump, run migrations, and smoke test.
5. **Live test (production):**
   - Register a real team using production Stripe on a test race or a low-price requirement.
   - Confirm finalization, the Classy fundraising team, and the emails.
   - Refund the charge and remove the Classy team afterwards.
   - Requires the owner, who holds production credentials.
6. **Go live.**

## Environment Variables

Required for production:
- `DATABASE_URL` - PostgreSQL connection string
- `STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` - Stripe API keys
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_DOMAIN` - all mail goes through MXRoute SMTP. MXRoute has no event webhooks, so email "delivery verification" (`rake emails:verify`) means "logged as sent" in `sent_emails`
- `DEFAULT_FROM_EMAIL`
- `APP_HOST` - Public host for links in emails (password resets, welcome; built by `SpaUrl.for`). Production falls back to `dogtag.chiditarod.org`, so staging must set it

Optional:
- `FEEDBACK_EMAIL` - where the SPA's "Report a problem" link (`POST /api/v1/feedback`, `UserMailer#feedback_email`) sends mail; defaults to `registration@chiditarod.org`. Logged-in racers only (the SPA hides the link and the API answers 401 otherwise); capped at 5 sends per account per hour
- `VITE_DEV_SERVER` - dev only; redirect SPA routes to the Vite dev server
- `CLASSY_CLIENT_ID`, `CLASSY_CLIENT_SECRET`, `CLASSY_ORGS` - Classy integration
- `ROLLBAR_ACCESS_TOKEN` - Error tracking

## Development Commands

```bash
# Start PostgreSQL, Redis and Mailpit via Docker
docker compose up -d db redis mailpit

# Run migrations
bundle exec rails db:migrate
RAILS_ENV=test bundle exec rails db:migrate

# Run tests
bundle exec rspec                           # All tests
bundle exec rspec spec/models/              # Model tests only
bundle exec rspec spec/path/to_spec.rb:42   # Single test at line

# Run integration tests (Playwright). Needs: docker compose up -d db redis mailpit
npm test
npx playwright test tests/spa   # SPA suite only (Mailpit inbox at http://localhost:8025)

# Frontend (SPA)
npm --prefix frontend run dev     # Vite dev server on :5173
npm --prefix frontend run build   # builds into public/register
npm --prefix frontend run test    # Vitest

# Start development server
bundle exec rails server

# Start Sidekiq worker
bundle exec sidekiq -C ./config/sidekiq.yml


# Rails console
bundle exec rails console
```

## Database Operations

```bash
# Restore from dump (via Docker)
docker-compose exec -T db pg_restore --verbose --no-owner --no-acl -U postgres -d dogtag_test < file.dump

# Run specific migration
bundle exec rails db:migrate:up VERSION=20251227035004

# Rollback
bundle exec rails db:rollback

# Normalize emails (rake task)
bundle exec rake db:normalize:emails        # Convert to lowercase
bundle exec rake db:normalize:emails_check  # Dry run
```

## Deployment

Deployed on Heroku with:
- Web dyno: Unicorn (`bundle exec unicorn -p $PORT -c ./config/unicorn.rb`)
- Worker dyno: Sidekiq (`bundle exec sidekiq -C ./config/sidekiq.yml`)

```bash
# Deploy to staging
git push staging main

# Deploy to production
git push heroku main

# Run migrations on Heroku
heroku run rails db:migrate
heroku run rails db:migrate -a staging-app-name
heroku restart -a staging-app-name   # after any migration that adds a column the code reads

# Download a production database and then restore it locally
# Useful for testing migrations:
heroku pg:backups:capture --app dogtag
curl -o file.dump `heroku pg:backups:url --app dogtag`
pg_restore --verbose --clean --no-acl --no-owner -h localhost -d dogtag_development file.dump
```

The `Procfile` has no `release:` phase, so a push does not migrate. When a deploy adds a column that views or JSON read (e.g. `people.instagram`, read by every person row), pages that read it fail from the push until the migration has run. Dynos that booted before the migration keep the old column list, so `heroku restart` after migrating. Run the migration right after the push, on `dogtag-staging` first. A migration that drops a column (e.g. `people.twitter`) also loses its data on rollback, so run `heroku pg:backups:capture --app dogtag` first; until `heroku restart`, dynos that booted earlier still list the dropped column in every INSERT/UPDATE and fail with "column does not exist".

## Registration SPA

- React SPA in `frontend/` (Vite, `base: "/register/"`, builds to `public/register`, gitignored). `SpaController#index` serves the build, 503 if missing, redirects to Vite only when `VITE_DEV_SERVER` is set.
- Routes `register` and `register/*path` sit above the catch-all in `config/routes.rb`. Racer entry points are not switchable: `/` and the old racer URLs redirect to the SPA (see Racer entry points).
- Frontend tests: `npm --prefix frontend test -- --run` (Vitest + jsdom + MSW; export `server` from `src/test/server.ts`). Strings via `t()` in `src/locales/en.ts`. Router exports `routes`/`BASENAME` so tests can use `createMemoryRouter`.
- Heroku builds the SPA via root `heroku-postbuild`; local Node may differ from the pinned 24.x (ignore engine warnings).
- Guided tour on the team page (`frontend/src/features/tour/`: `storage.ts`, `stops.ts`, `components/guided-tour.tsx`; copy under `tour.*` in `en.ts`). Targets carry `data-tour` (`flag` on the progress flag; `racers`, `questions`, `fee`, `in` on each step's heading row (`tour.flag` copy: "Four stars to the start line")), and a stop whose target is missing is skipped. `teamTourStops` leaves out `questions` when the race has none and `fee` when no fee is due. `TeamChecklist` opens it once per mount only when the race is open, the team is not finalized, and `shouldAutoStart(me.id)` is true (not seen, not switched off with `dogtag:tour:off`, and localStorage writable). Ending it (`End tour`, `Done`, Escape) writes `dogtag:tour:team:v1:<user id>` (and an in-memory mark, so blocked storage cannot bring it back); `Take the tour` in `TeamHeader` replays it. Below `lg` the card docks to the bottom or top edge and the page scrolls per `dockPopup` (`placement.ts`); from `lg` it sits next to the target (`placePopup`).
- Crew picker (`frontend/src/features/roster/components/crew-picker.tsx`, `crew-pick-list.tsx`, `crew-review.tsx`): the Racers step has one `Pick racers from past teams (N)` button instead of per-slot chips. Step 1 ticks past racers (capped at the open spots), step 2 reviews one person at a time. Each of the six details (name, email, phone, years racing, Instagram, TikTok) must be ticked or changed before `Add {first name} to the team` enables, and a person is saved only when that button is pressed. `Add yourself` reviews the account holder alone when they are one of their own past racers; otherwise it opens the `Add a racer` form pre-filled from the account. Escape backs out one level at a time: it clears a non-empty search, then puts back a line opened with `Change`, and only then closes the dialog (`useFocusTrap`, used by `DialogSheet`, ignores an Escape whose `defaultPrevented` is set). Close and Escape do nothing while a save is in flight. A racer added through the picker stays out of the list for the visit even if their email was changed in review (`pickedFrom` in `roster-card.tsx`).
- Racer years and email (#330): a racer's `people.experience` is a number the captain types (`YearsInput`: text input, `inputMode="numeric"`, no spinner), not a pick from `race.experience_labels`. The labels still drive only the team-level `teams.experience` dropdown. The SPA rejects blank/non-digits (`yearsProblem`); the server rejects outside 0-99 (`Person` numericality) and the message shows through `FieldErrors`. Display is `yearsCount` (`roster.yearsCount_one/_other`); the picker carries a past racer forward as `experience + 1`, capped at 99. `Team.export` writes the plain number in each racer's `experience` column (the team column still uses the label). The email field is `RosterEmailField` (shared by `PersonForm` and `CrewReview`): on blur `emailProblem` flags a malformed address or a duplicate of another racer on the roster (`otherEmails` excludes the person being edited); it clears on the next change and never blocks submit, so the server's `taken_on_team` still applies. Racers on a different team in the same race are not checked.
- Wrapping inside a grid: `break-words` does not shrink a grid track's min-content width, so one long email widens the whole column. Use `grid-cols-[minmax(0,1fr)]` on the grid with `[overflow-wrap:anywhere]` on the values that must wrap.
- Team page progress is `FlagProgress` (four labeled Chicago-flag stars: Team, Racers, Questions, Fee) driven by `stepStates(team)` in `features/teams/utils.ts`: Team is lit once the team exists, Racers when the roster is full, Questions when answered (or not required), Fee when paid (not while it only opens later); a finalized team has all four lit. `cardSteps` gives the card statuses. The team route is the only wide one: `handle: { wide: true }` in `app/router.tsx`, read by `RegisterLayout`.
- Completion confirmation: `races.confirmation_text` is Markdown rendered by `ConfirmationText.to_html` (`app/services/confirmation_text.rb`: commonmarker, then `sanitize` with a small tag allowlist). `races.confirmation_text` is capped at `Race::CONFIRMATION_TEXT_MAX_LENGTH` (5000). `TeamChecklist` exposes `confirmation_html` (nil until the team is finalized, so it is neither rendered nor sent early) and `show_confirmation` (finalized, viewer is the owner, `teams.confirmation_seen_at` blank). The SPA shows `CompletionDialog` once, and closing it calls the owner-only `POST /api/v1/teams/:team_id/confirmation` (`useMarkConfirmationSeen`), which sets `confirmation_seen_at`; staff viewing never clear it and re-finalizing does not reset it. The migration backfilled `confirmation_seen_at` for already finalized teams and seeded `confirmation_text` only for races upcoming at migration time (later races start blank). `ConfirmationText` limits link `href` to http, https and mailto. The same text feeds the team page header (`ConfirmationText`) and `team_finalized_email` (team number, `Team#classy_fundraising_url` line, help line `dogtag@chiditarod.org`). The racers card collapses on finalize with a `Hide racers` toggle.
- Racers give `instagram` and `tiktok` handles (model, API, SPA; both optional, normalized to a lowercase `@handle`). The unused `people.twitter` column was dropped; `teams.twitter` still exists. Racers no longer give a ZIP code (`people.zipcode` dropped in #329; the organizers never used it and it is not replaced by an emergency contact). A stray `zipcode` param is ignored. Deploy: capture a backup first (rollback loses the data), migrate right after the push, then `heroku restart`. The column was `NOT NULL`, so from the push until the migration has run every person create or update fails with `PG::NotNullViolation` (new code no longer writes it), and from the migration until the restart dynos that booted earlier fail with "column does not exist". There is no `ignored_columns` step; deploy at low traffic, and well before a registration opening.
- New team flag (#301): `teams.new_team` is true when the sum of `people.experience` is 0 (blank counts as 0), nil with no racers. `Person` after_save (when experience or team changes) and after_destroy call `Team#refresh_new_team`, a conditional `update_all` that skips teams with `new_team_overridden`; reload a team to see the new value. Staff set it through the virtual `new_team_setting` (`auto`/`yes`/`no`), which `TeamsController#team_params` permits only for admins and operators. Display text lives in `NewTeamHelper` (admin-only, untranslated). `teams.experience` is a separate self-reported team label index and does not feed the flag. Nothing reads the old `raced-in-past` JSONForm answer; it remains only in old answers, the Vitest fixture and the staging seed (the 2027 payload no longer asks it).
- Team picker (#302): racers say which other teams they want to race with. `team_buddies` is a directional join table (`team_id` names `buddy_team_id`; same race, no self-pick, unique pair, FK cascade) and `teams.other_buddies` is free text (stripped, blank becomes nil, max `Team::OTHER_BUDDIES_MAX_LENGTH` 1000). `GET /api/v1/teams/:team_id/buddy_options` returns `{ teams: [{ id, name, finalized }] }` for the other teams in the race (name only, sorted by `LOWER(name)` then id, authorized with `:edit`). `GET/PUT /api/v1/teams/:team_id/questions` also read and write `buddy_team_ids` and `other_buddies`: an absent key leaves the value unchanged, a present key replaces it, and bad ids are a 422 `invalid_buddies`. A PUT without `answers` still clears the answers, so the SPA always sends them. Picks cannot be saved for a race without a JSONForm because `no_questions` runs first. Same-route question (#332): nullable `teams.collaborating` (migration backfilled `true` for teams with a pick or non-blank `other_buddies`, nil otherwise). The questions API reads it and PUT takes it with the same absent/present rule; it must be a JSON `true`, `false` or `null` (else 400 `bad_request`); saving `false` also clears `team_buddies` and `other_buddies` in the same transaction; non-empty `buddy_team_ids` or non-blank `other_buddies` while the resulting value is not `true` is a 422 `invalid_buddies` with `errors.collaborating`. It is not a finalization requirement (the legacy flow never asks it). The SPA Questions card opens with `CollaboratingQuestion` (Yes/No radios plus an `InfoTip`); Save is blocked with "Choose Yes or No" while it is null, so teams from before it existed see it unanswered. Only Yes shows `BuddyPicker` (legend "Teams you want to race alongside", explanation in an `InfoTip` in the legend; the fieldset is `aria-labelledby` the legend text so the tip button stays out of the group name); the draft keeps picks while toggling, and the SPA sends empty picks unless the answer is Yes. Any future autosave must follow the same rule. Search, the "Fully registered"/"Still registering" tags and "Other..." (reveals the free text) are unchanged; picks are optional and have no effect on finalization. The admin CSV export ends with `collaborating` (`Yes`/`No`/blank) then `racing_with` (picked names, then the other text, `spreadsheet_safe` per element), and the admin team page shows "Collaborating" (once answered) and "Racing with" to admins and operators. The 2027 JSONForm (`../dogtag-private/jsonform/chiditarod_22.json`, #304) no longer asks `collaborating`, `buddies`, `raced-in-past` or `referred-by`; the old `buddies` and `collaborating` questions stay only in old answers and the in-repo 2026 JSONForm fixtures. Deploy order: the migration adds `teams.other_buddies` and the `team_buddies` table, and every Team save or page that touches them (team create/update, finalize, the admin page, the CSV export, delete, the Questions card) fails until the migration has run and dynos have restarted, so push, migrate immediately (`heroku run rails db:migrate -a dogtag-staging` first), then `heroku restart`; do production in low traffic. Deploy for #332 is the same: `teams.collaborating` is read by the Questions card and every team save, so push, migrate immediately (staging first), then `heroku restart`. There are no migration specs elsewhere; `spec/migrations/add_collaborating_to_teams_spec.rb` runs the migration's `down`/`up` inside the test transaction to check the backfill. Tests: `test_seeds:buddy_picker` (the captain's team starts with `collaborating` nil) and `tests/spa/buddy-picker.spec.ts`; on a machine with another session running, use `TEST_PORT=3199` and a separate `DATABASE_URL` (e.g. `dogtag_test_2`) so runs do not collide.
- Race list order (`/register`): `GET /api/v1/races` sorts in Ruby (`sort_by(&:registration_sort_key)`) after `Race.preload_registration_data`, because `Race#full?` reads the preloaded finalized-team count and sorting earlier would query per race. `Race#registration_status` (`open`, `waitlist`, `closed` = registration over, `not_yet_open`) is the one definition of the groups and is also in the race JSON (so it appears on `/teams` payloads too); the SPA badge (`RaceStatus`) reads it instead of the browser clock. Order: open, waitlist, closed, not_yet_open; within a group soonest `race_datetime` (not-yet-open by `registration_open`), ties by id. A race exactly at `registration_close` still counts as open. Logged-in racers also see their own teams on each tile (`RaceTeams`, `useMyTeamsByRace`: `useTeams` enabled only when `useMe` has a user, matched by `team.race.id`, non-blocking). The chip uses `teamChip` (`Finalized #N` / `N things left`), not My teams' longer `teamStatus` wording, and the start button reads `Start another team` (outlined) once the racer has a team in an open race. Tests: `test_seeds:race_list_order` (race dates run opposite to the expected order) and `tests/spa/race-list-order.spec.ts`.
- JSONForm `showWhen` (#334): a keyed `form` item may carry `"showWhen": { "<schema key>": "<value>" }` (exact string equality against the trimmed answer, as saved; one pair; a custom key, not jsonform's `condition`), e.g. `{ "key": "fire-details", "type": "textarea", "showWhen": { "flame-effects": "Yes" } }`. It is valid only when it is a one-pair object of strings naming a schema key; anything else (array, two pairs, non-string value, unknown key) is ignored and the field stays visible. `hiddenKeys(jsonform, answers)` in `features/questions/validate.ts` is the one definition: the renderer skips hidden keys, `buildPayload` omits them (so a stale answer is dropped on the next Save, and `validateAnswers` never sees them), and the "N of M answered" count excludes them. A field whose controller is itself hidden is hidden; a cycle or self reference leaves its fields visible; a missing answer matches nothing. Showing a field again restores the draft from the same editing session. Only optional fields may carry it: `RaceValidator#validate_jsonform` adds an error on `jsonform` for any form item (nested fieldsets included) with a `showWhen` key whose property is `"required": true`, even a malformed one, or whose key is in the schema's top-level `required` array. The SPA's ajv validates the visible answers against both the per-property `"required": true` and the top-level array, so a hidden required field would leave the racer unable to save; server-side, the json-schema gem (6.1, Draft 6) enforces only the top-level array and ignores per-property booleans. The server's answer handling is unchanged (`filter_answers` ignores other form-item keys). The SPA is the only racer UI, so nothing else renders the form. Tests: `test_seeds:show_when` and `tests/spa/show-when.spec.ts`. After this ships, adding `showWhen` to `fire-details` in the 2027 payload is a separate owner-gated edit to `../dogtag-private/jsonform/`.
- 2027 payload (#304): the team theme is asked once, on the team description (`teams.descriptionHelp` in `en.ts`, "...If you don't know yet, put TBD."); the payload has no theme questions. `racer-type` has a third option `Unsure` (staff filter the CSV's raw `racer-type` column on it to follow up) and `private-comments` keeps its key but is the last form item, in its own fieldset. `tests/e2e/fixtures/jsonform.json` is the 2027 payload (Vitest fixtures and `lib/staging_seed.rb` keep 2026), and its `ANSWERS` answer `flame-effects` "Yes" so the `showWhen` field `fire-details` appears.
- Team captain (#331): `teams.captain_id` (FK to `people`, `on_delete: :nullify`) names the racer organizers contact; `teams.captain_inferred` is true only for captains the migration guessed. `Team.user` is only the account that created the team and is not automatically a racer. The migration backfilled in order: a racer whose email matches the owner's, then (finalized teams only) the lowest-id racer with `captain_inferred` true; unfinalized teams with no match stay nil. A `Person` created with the account holder's email on a team with no captain becomes captain in `after_create` (a conditional `update_all`, so the SPA and API agree); nothing else is chosen automatically. `PUT /api/v1/teams/:team_id/captain` (`{ person_id }`, `authorize_update!`, 422 `errors.person_id` for a racer from another team, 200 `teams/show`) clears `captain_inferred` and authorizes `:update` on the **team**: owners change the captain only while registration is open (not in the final-edits window, unlike racer edits), staff any time. The SPA hides `Make captain` when the race is closed. Person create/update/destroy API responses carry the team's `captain_id` (adding the account holder can make them captain; removing the captain nulls it), and `usePeopleCache` writes it into the cached team. Payment is not gated on a captain: the SPA fee card unlocks Pay on a full roster (`racers.filled >= racers.total`), not on `racers.done`. The SPA hides Remove on a team that is complete apart from its captain (the server would refuse it), and the SPA prompts for a captain while there are racers and none is chosen. `TeamChecklist` `racers.captain` is a boolean and `racers.done` needs a full roster **and** a captain, but `remaining` is 0 for a finalized team (a finalized team from before captains can stay captainless and shows every star lit). Team JSON carries `captain_id`; the SPA picks the captain row from it (`data-captain`, `captain-star`), never from the viewer's email. `Team.export` adds `captain_first_name`, `captain_last_name`, `captain_email`, `captain_phone`, `captain_inferred` (`yes` for a guess) right after the `user_*` columns, so the racer columns shift right by five; guessed captains appear nowhere else. Specs: the team factories (`:finalized_team`, `:with_enough_people`) make the first racer captain; `AddCaptainToTeams#backfill_captains` is public so `spec/migrations` runs it on factory data. Deploy order: the migration adds a column every team read and save touches, so push, migrate immediately (`heroku run rails db:migrate -a dogtag-staging` first), then `heroku restart`; from the push until the migration has run, team pages and saves fail. Tests: `test_seeds:team_captain` and `tests/spa/team-captain.spec.ts` (including a 320px row check that asserts buttons stay inside the row, since a clipped button never widens the page). Seeds whose specs expect finalization (`basic`, `payment_tiers`, `stripe_payment`) make the first racer the account holder so the team has a captain; `tests/e2e/registration.spec.ts` picks one with `Make Racer1 Pusher captain`.
- Staff shell (#343): `GET /api/v1/me` returns `roles` (strings). `/register/staff/*` uses `StaffLayout` (`components/layouts/staff-layout.tsx`, wide `max-w-6xl`, staff nav `Payments` + `Legacy admin` -> `/users`; nav shown only when `isStaff(me)`) with routes under `RequireAuth` > `RequireStaff` (`features/staff`, `isStaff`, `STAFF_ROLES`); non-staff see `NotAllowed`. `UserMenu` shows `Staff` for staff on racer pages; `StaffLayout` turns it off (`SiteHeader staffLink={false}`) since its staff nav covers it. Unknown `/staff/*` paths render `NotFound` inside the guard (non-staff still see `NotAllowed`). The kept legacy navbar admin dropdown links `Payments` to `/register/staff/payments` when `can?(:refund, :charges)`. Staff copy lives under `staff.*` in `en.ts` (untranslated). Tests: `test_seeds:staff_shell` (the refunder has a 16-character first name for the 320px header check), `tests/spa/staff-shell.spec.ts`, `spec/requests/staff_navbar_spec.rb`.
- Legacy team pages deleted (reskin PR 9): `/teams`, `/teams/new?race_id=N`, `/teams/:id` and everything under it (`/edit`, `/people/...`, `/questions`) 301 to `/register/...` (numeric ids only; `/teams/abc` is a 404); the old team, people, questions, captain, charge and mock-payment controllers, views and routes are gone, while `Payments::ChargeTeam`, `Payments::RefundCharge` and the `/api/v1` payment, mock-payment, people, questions and captain controllers stay. Only `GET /teams/search` (staff JSON for the users page select2) is kept in `TeamsController`; it parameterizes the query (`Two Words` becomes `two-words`), so a name with spaces never matches. `teams/_table`, `teams/_team_item` and `NewTeamHelper` were deleted with the legacy race pages.
- Legacy race pages deleted (reskin PR 9): `GET /races`, `/races/:id` and `/races/:race_id/registrations` 301 to `/register` and `/register/races/:id/registrations` (numeric ids only). `RacesController` keeps `new`, `create`, `edit` (its own action now, no longer `alias show`), `update`, `destroy` and `export` for staff until PR 10, and `require_user` guards every action. The kept routes are declared before the redirects.
- Kept legacy pages (reskin PR 9): the legacy navbar, `require_user` (logged out goes to `/register/login`, no `store_location`), `user_update_checker` (`/register/account`), logout (`DELETE /user_session` then `/register`) and the kept staff HAML (`/users`, `/sent_emails`, race, requirement and tier forms) link literal SPA paths (`/register/teams/<id>`, `/register/staff/users/<id>`), never racer route helpers, so deleting a racer route cannot break them. `spec/requests/kept_legacy_pages_spec.rb` renders every kept page (and the 404 page, which carries the navbar) logged out, as a racer and as an admin: each must have no `translation_missing` span and no GET link to a racer URL (`racer_hrefs`). Add a new kept page to its `staff_pages` hash. A missing key in these pages was invisible before (Rails renders a `translation_missing` span), so the spec scans for it. In the test environment `consider_all_requests_local` is true, so a racer hitting a staff page raises `CanCan::AccessDenied` instead of redirecting.
- Account and password reset (reskin PR 1): `/register/account` (`features/account`, `RequireAuth`; user menu link `Account`) edits name, email, phone and password through `PATCH /api/v1/me`, which needs `current_password` for every change (the owner's rule; a wrong one is a 422 `errors.current_password = ["is not correct"]` from `api.errors.current_password_incorrect`, a `password_confirmation` sent without a `password` is a 422 on `password` (Authlogic ignores a blank password, so it would otherwise save nothing and answer 200), and a password change keeps the session logged in). Any change of `users.email` (any path, via `User` `after_update_commit`) queues `Workers::EmailChangedEmail`, which mails the **old** address (`UserMailer#email_changed_email`, kind `email_changed`); `update_column` (the email-normalizing rake task) skips it. The legacy `/users/:id` and `/account` pages are gone and redirect to `/register/account`. `/register/reset-password/:token` (`features/auth/components/reset-password-form.tsx`) uses `GET/PUT /api/v1/password_resets/:token`: an unknown, expired or used token is 404 and shows `This link has expired`; a successful PUT logs the user in and the SPA lands on My teams with a notice (read once, then removed from history state so a reload does not repeat it). The reset clears `failed_login_count`. The API reset saves through `User#reset_password_from_link`, which validates only the password fields (an older record failing a newer rule, such as a missing phone, can still reset) and skips Authlogic session maintenance so the explicit `UserSession.create` logs in once. On success the SPA drops every cached query except `me` and the token query, since the reset can replace another account's session. The feedback form sends `feedbackPath(pathname)`, which replaces a reset token with `[redacted]`. The reset email links to the SPA page through `SpaUrl.for`; an old `/password_resets/:token/edit` link redirects there. No migrations. Tests: `test_seeds:account`, `tests/spa/account.spec.ts` (includes a 320px check) and `tests/spa/password-reset.spec.ts` (the legacy `tests/password-reset.spec.ts` was retired in PR 9).
- Payments page, Browse mode (#343): `features/staff-payments` (`api/use-payments.ts`, `use-payment-filters.ts`, `components/`). Filters live in the URL (`race_id` absent = the server's default race, `race_id=all` = every race, `payment_type`, `status` `paid|refunded|all`, any other status (even the server's `refunding`/`not_refundable`) falls back to all, `q`, `page`); changing anything but `page` resets `page`, changing the race drops `payment_type`; `clearAll` keeps the race. `setFilter`/`clearAll` keep one identity (the URL setter is read through a ref; `useSearchParams` hands back a new one on every URL change), so a filter click does not restart the search debounce, and the page's Clear all bumps a `key` on `SearchBox` so pending text is dropped. A URL race id the server does not know (`filters.race_id` null) shows a `Race not found` option and message; the server's resolved default race is not written back to the URL (follow-up). A `page` past `total_pages` is replaced with the last page once the response settles. While new filters load (`isPlaceholderData`) the list is dimmed and `aria-busy`, the sheet button reads `Show payments`, and a `role=status` line announces the count once settled. The race and type options come from the response's top-level `filters` (types only for the chosen race, so the type select is disabled for `all`). Search is debounced 300 ms in `SearchBox` and sends trimmed text; it has its own row below `lg` and the inline controls wrap (they overflowed at 640px). One markup serves both layouts (`role=table` divs: table from `sm`, cards below with `grid-cols-[minmax(0,1fr)]`; team and person names use `break-words`, emails `[overflow-wrap:anywhere]`; the card labels are `sm:hidden` but not `aria-hidden`, so screen readers hear them on cards); below `sm` only Search stays on top and the rest is behind a `Filters` sheet (`DialogSheet`). `formatMoney` shows whole dollars with thousands separators; dates use the default race zone because payment JSON carries none. No checkboxes or Refund button yet. Tests: `test_seeds:payments_admin` and `tests/spa/payments-admin.spec.ts` (checks 320, 640, 768 and 1024px). The status radios are `sr-only` and URL-controlled: in Playwright click the visible label in the `Status` group and assert `toBeChecked()`; `check({ force: true })` fails most runs with "did not change its state".
- Payments page, Refund mode (#343): `Refund payments` sets local `mode` state (not in the URL; a reload returns to Browse) and sets status to `paid`; the status radios are disabled and the status chip hidden, and `clearAll(true)` keeps the status. `useSelection(limit)` (`use-selection.ts`) holds whole `StaffPayment` rows by id (so the selection spans pages), only `paid` rows, never more than `limit`, which is `meta.refund_batch_limit` from the API (the SPA hardcodes no cap; before the list loads it is 0); it is cleared when the race filter or the race the response resolved to (`data.filters.race_id`; it changes when a `team_id` chip is removed with no `race_id` in the URL) changes. At the cap the other boxes disable and `aria-describedby` points to one cap note. `RefundBar` is fixed to the bottom. `ConfirmRefundDialog` takes a snapshot of the ticked rows and refuses (`staff.refund.changed`) when the live selection differs or a refetch shows a snapshot row not `paid` or with another amount; Confirm needs `REFUND N` (case and surrounding or repeated spaces ignored) but posts the canonical `REFUND N`, the ids and `expected_total_cents`. The API's `error` is a sentence; the stable machine code is `ApiError.code` (added to `lib/api-client.ts`: `batch_too_large`, `confirmation_mismatch`, `selection_changed`, `not_refundable` with `errors` keyed by payment id, `invalid_total`, `nothing_to_retry`). Wording is singular or plural through `_one`/`_other` keys (`Refund 1 payment?`, `Show 1 payment`). `BatchResults` is its own `DialogSheet`: `useRefundBatch` polls every 2 s until `isBatchDone` (`finished_at` set, or no item still `queued`, since a dead job never sets `finished_at` and the server reports old queued items as `stalled`); Escape and Done do nothing until then. One `Retry K failed` posts `/retry` for the whole batch and follows the new batch id; items finished in earlier batches stay in the list (`carried`), so after a retry all payments show. `Done` returns to Browse and clears the selection; a done batch invalidates `['staff', 'payments']`. The racer fee card (`FeeItem.refunded`) shows a `Refunded` badge on the row and a `{name}: refunded` line in the paid summary; totals are unchanged. Non-production failure hook: a `MockPaymentRequirement` payment whose `charge_id` starts `mock_fail_once_` (`Payments::RefundCharge::FAIL_ONCE_PREFIX`) fails its first refund with `stripe_error` and refunds on the retry (`metadata["fail_once_tripped"]`); mock payments are not refundable in production and `refund_mock` refuses there before reading the charge id. Tests: `test_seeds:payments_admin` (batch of 5, single refund) and `test_seeds:payments_partial_failure` (3 payments, the second fails once), both in `tests/spa/payments-admin.spec.ts`.
- Staff races (reskin PR 5): `features/staff-races` under `/register/staff/races` (list, `/new`, `/:id` overview, `/:id/edit`), admin and operator only (`STAFF_NAV` in `features/staff/nav.ts` is the one place nav roles live; the server is the gate: `Api::V1::Staff::RacesController`, `index/show/new/create/update/destroy` plus `GET /api/v1/staff/races/:id/export.csv` and `POST /api/v1/staff/confirmation_preview`, with `:export` for operators and `destroy` for admins only; a refunder gets 403). The races routes are wrapped in `<RequireStaff roles={rolesFor('/staff/races')}>` (`rolesFor` in `nav.ts` reads the nav item's roles), so a refunder who types the URL sees Not allowed. Dates travel as `datetime-local` wall clocks (`YYYY-MM-DDTHH:mm`) and `RaceDateParams` (`app/services/race_date_params.rb`) parses them in the race's zone and refuses a spring-forward gap time instead of letting ActiveSupport shift it; a time-zone change re-reads every date in the new zone, so the SPA sends all four dates with `time_zone` (`buildRacePayload`) and the form shows a note. `lib/zoned-time.ts` (`fromWallClock`, `toWallClock`, `zoneAbbreviation`, `isInPast`) uses only Intl and never throws (a blank or unknown zone gives null/empty). A deadline at local midnight is shown to racers as 11:59 PM the day before ("Racers see" line, `formatDeadline`). `Race#setup_problems` (list "Setup" column): `No fee set up` (no `PaymentRequirement`), `<fee> has no price` (no tiers), `<fee> has no price when registration opens` (earliest tier `begin_at` after `registration_open`), `Questions (JSONForm) don't parse`; empty means "Ready". The overview Money card shows `Race#money_totals` `net_cents` (after refunds) with `gross_cents` and `refunded_cents` underneath. "Email registered racers (bcc)" is a `mailto:` to `dogtag@chiditarod.org` with every registered racer in `bcc` (addresses encoded); a full race makes it too long for many mail apps, so `Copy emails` copies the plain list. Fees on the overview link to the SPA fee pages (see Staff fees below); "Who's registered" still goes to the legacy page. The legacy admin navbar gained one `Races` item pointing at the SPA. Questions are optional: the form's `parseJsonform` blocks Save only for text that does not parse (blank text and valid JSON that defines no questions, such as `{}` or an empty `schema.properties`, are both sent as `jsonform: null` (`buildRacePayload`), because the racer questions flow and the legacy `JsonForm.add_csrf` assume `schema.properties` and null is the supported "no questions" state; the editor notes "No questions: this will be saved as a race without questions."; `Race#question_fields` also tolerates a stored schema-less value). The model applies the same rule for every writer (legacy race form, direct API): `Race#normalize_jsonform` (`before_validation`) stores blank text and parseable JSON without a non-empty `schema.properties` object as nil, and leaves unparseable text for `RaceValidator`. `RaceForm` asks before an in-app navigation drops changes (the shared `useLeaveGuard` over `useBlocker`, and `DiscardDialog`: Keep editing is focused and is Escape; a successful save sets a `leaving` ref first so it navigates without asking; `beforeunload` still covers tab close). Tests: `test_seeds:staff_races` (operator, admin, refunder, a Busy race with a fee, a finalized team with a payment and an unfinalized team, and an Empty race) and `tests/spa/staff-races.spec.ts` (checks desktop width and 320px); the spec creates `Race Staff <id> New` so `test_seeds:cleanup` sweeps it.
- Staff fees (reskin PR 6): `features/staff-fees` under `/register/staff/races/:raceId/requirements/new` and `/:requirementId` (inside the same `<RequireStaff roles={rolesFor('/staff/races')}>` group, so a refunder sees Not allowed). API under `/api/v1/staff`: `GET/POST races/:race_id/requirements`, `GET/PATCH/DELETE requirements/:id`, `POST requirements/:requirement_id/tiers`, `PATCH/DELETE tiers/:id`. Operators and admins create and edit; only admins delete (`can_destroy` and `destroy_blocked_reason` ride on each fee and each price). Every fee/price call answers `{ requirement, race }` (`_fee.json.jbuilder`: `current_tier`, `next_tier`, `paid_team_count` = unrefunded payments, `tiers` with `price_cents`, `begin_at`, `status`), and the race carries `time_zone`. Prices travel as integer cents in `price` (the SPA types whole dollars and `parseDollars` converts; the server rejects part dollars and caps at $100,000) and `begin_at` as a wall clock in the race zone (`RaceDateParams`); a PATCH sends only the keys that changed, so an untouched start keeps its seconds. The type is fixed after create (`PATCH` with `type` is a 422 "can't be changed after the fee is created"); the SPA shows it read-only, and the add-fee form offers only `Requirement.allowed_types` (the mock type outside production). A new fee is created with its first price in one request (errors come back as `tier.price` / `tier.begin_at`); the form prefills Starts with registration opening (a start in the past only warns). The two delete guards live on the models, so legacy and API agree: `Requirement#destroy_blocked_reason` (any payment, refunded ones included, blocks deleting a fee) and `Tier#destroy_blocked_reason` (the only price of a paid fee stays). Price status is `current` (in effect), `next` (the first later one), `later` or `past`; the fee status line says whether racers can pay now, from a date, or not at all. "Right now" links `see payments` to `/staff/payments?race_id=<race>&payment_type=<fee>&status=paid`. Price starts use `ZonedDateTimeInput` (`components/inputs/`, shared with the race form); `DiscardDialog` and `useLeaveGuard` moved to `components/ui/` and are used by `RaceForm`, the fee page (name and open price form) and the add-fee page. The price row is a `role=row` containing a `display: contents` form, so its cells line up with the table; a `PricesTable` allows one open form at a time. Tests: `test_seeds:staff_requirements` (operator, admin, refunder; `Race Fees <id>` with a paid Registration Fee at $100 and $120 and an unpaid Cart Deposit) and `tests/spa/staff-requirements.spec.ts` (1024px, plus checks at 320, 640, 768 and 1024px that an open edit or add price row stays inside the page, its Price input and Save/Cancel fully on screen; the form's buttons stack until `lg` so the table fits at 640px). Existing-data changes: `Tier` now requires `begin_at` (the legacy tier form refuses a blank start); `PaymentRequirement#chronological_tiers` and `ReminderSelector` skip undated tiers, which the staff API does not list and which do not count toward the last-price rule; `TierValidator` messages are now "is already used by another price on this fee"; legacy deletes of a paid fee or its last price flash "Deletion failed." (new `destroy_failed` locale key). The price row form checks whole dollars only when the price changed, so a legacy tier at odd cents or $0 can still have just its start moved, and it warns "in the past" only for a start the staff member changed.
- Staff users and emails (reskin PR 7): `features/staff-users` (`/register/staff/users`, `/users/:userId`) and `features/staff-emails` (`/register/staff/emails`). API under `/api/v1/staff`: `GET users`, `GET/PATCH/DELETE users/:id` (`Api::V1::Staff::UsersController`) and `GET sent_emails`. Roles: Users is open to admin, operator and refunder (read-only for the last two); Emails and `Emails to this user` are admin and operator only (`can :index, SentEmail`; a refunder who types the URL sees Not allowed). Editing details and roles is the `:staff_update` action, which has no Ability rule on purpose so only `can :manage, :all` (admin) matches: never authorize an update here with `:update`, which an operator or the owner could hold. An admin cannot remove their own Admin role (the Roles card locks the box and says so; the server refuses it too), and `can_edit`/`can_destroy`/`is_self` ride on each user. Search (`Users::StaffSearch`) is AND over whitespace words (first 10), each matching a first name, last name, email or the name of one of the user's teams, case-insensitive; 35 per page. `User#deletion_blocker(by:)` is the one rule for deleting a user (own account, owns teams, has payments, made refund batches or any single refund (`completed_requirements.refunded_by_id`, which nullifies on delete and would turn the audit row into "Done at Stripe")) and is shared by the API (a disabled Delete with the reason, `Owns 1 team. ...`) and the legacy `users#destroy`; the legacy navbar no longer offers `New` user (users sign up themselves and an admin grants roles afterwards; the public Register and Sign up links to `new_user_path` are unchanged and covered in `spec/requests/staff_navbar_spec.rb`). On a user page the details form is for admins and plain text for others; the page asks before an in-app navigation drops unsaved details or roles (`useLeaveGuard` + `DiscardDialog`), and a delete calls `allowLeave` first so unsaved edits are not asked about and it lands on the list. Emails sent: `SentEmail::KINDS` lists every mail kind and the SPA's `KIND_LABELS` (`features/staff-emails/kinds.ts`) gives each its words; a new mail kind needs both (an unknown kind falls back to its capitalized raw name). The Status filter offers three values (`SentEmail::FILTER_STATUSES`: sent, queued, failed), not the unused delivery-event statuses; an older stored status still shows as stored. The team filter is a chip only (`?team_id=`, reached from the per-team `Emails` link on the user page), the sheet button `Filters (n)` counts status and kind only, and removing a chip keeps the others. A queued email's age counts from `status_changed_at`. Team links on these pages open the SPA team page (`/register/teams/:id`, reskin PR 8). `staffLandingPath(roles)` (`features/staff/nav.ts`) sends `/staff` to Races for admins and operators and to Payments for a refunder (not Users); the Emails route sits in its own `<RequireStaff roles={rolesFor('/staff/emails')}>` group, so the nav item's roles are the guard. No migrations. Tests: `test_seeds:staff_users_emails` (admin, operator, refunder; Ada owns `Doge Sled <id>` in `Race StaffUsers <id>` with one payment and three emails (sent, failed with a 535 error, queued 2 minutes); Zed has no team; one reminder for another team) and `tests/spa/staff-users-emails.spec.ts` (1024px, plus 320px; it promotes Zed to Operator, logs in as him to see the staff nav, then deletes him and asserts the list, not `Page not found`).
- Who's registered (reskin PR 2): `/register/races/:raceId/registrations` (`features/registrations`, wide route, linked from each race tile as `See who's registered`) reads `GET /api/v1/races/:race_id/registrations`, open to any logged-in user (401 logged out, 404 unknown race). Roles: every row carries a `staff` object (assigned number, payments paid/total, `updated_at`, `new_team`) only for admin/operator/refunder, and the top-level `emails` (bcc lists for the two tabs) only for admin/operator; everyone else gets `null` for both. Tabs: Registered = finalized teams, numbered ones first by `assigned_team_number`; second tab = unfinalized teams, newest update first and named `Still registering`, or once finalized teams reach `max_teams` the `Waitlist`, oldest `created_at` first with positions `#1`, `#2` (`registering_kind`, `waitlist_position`). Filter selects come from `races.filter_field` (labels `key.tr("-_", "  ").humanize`; options from the answers of both tabs). URL keys: `tab` (absent = registered, else `registering`), `q` (team name), `f_<key>` per filter field; search and filters run in the browser over the full payload. `Delete` uses `can :destroy` (own deletable team while open, any deletable team for operators) and the shared `DeleteTeamDialog`. Team names link to the SPA team page (`/register/teams/:id`) for owners (`mine`) and staff (`can_show`); other racers see the name as text. The team page's Staff card and `useTeamPermissions` handle a viewer who is not the owner (it used to open the legacy `/teams/:id` page because the SPA page assumed its owner; reskin PR 8 removed that assumption). The shared list parts (`ListTable`/`ListRow`/`ListCell`, `SearchBox`, `ResultCount`, `Pagination`, `FilterChips`, `useUrlFilters`) live in `frontend/src/components/list/` and are what later staff pages reuse (Payments already does). A staff row with an empty cell must keep the cell (only below `sm` it is hidden), or the columns shift; `tests/spa/whos-registered.spec.ts` checks cell and header alignment at 1024px. Tests: `test_seeds:who_registered` (racer, operator, refunder, an open race with 2 finalized and 2 unfinalized teams, a full race with 2 waitlisted) and `tests/spa/whos-registered.spec.ts`. The two bcc mailto links each have a `Copy ... emails` button beside them (clipboard, `Copied`/`Could not copy` in a polite live region) because a full race's list can exceed what some mail handlers accept in a URL. Owners whose user row is gone (`teams.user_id` has no FK) are skipped from the owners list.
- Staff team view (reskin PR 8): staff open any team on the SPA team page. `GET /api/v1/staff/teams/:id` (`staff_team`, authorized `:show`) returns the team number placeholder, the new-team setting (`new_team_setting` `auto|yes|no`, `computed_new_team`), `collaborating`, `racing_with`, the captain and account holder contacts, `sent_emails_count`, the payments and a `can` object built by `StaffTeamPermissions` from the `Ability` (`update_team`, `set_captain`, `add_racers`, `edit_racers`, `remove_racers`, `edit_questions`, `delete_team`, `take_payment`, `set_new_team`, `view_emails`, `view_payments`). People can be added or edited until `final_edits_close`; operators and admins (not racers) may save answers after registration closes (`StaffTeamPermissions.questions_open?`, an owner decision, enforced by the API; the legacy questions controller is gone). `useTeamPermissions` (`features/teams/`) is the one place the team page's gates live: racers get `racerPermissions` (today's rules, unchanged, so the owner still sees `Edit team details` on a closed race and the server refuses the save), staff get `staffPermissions` from the server's `can` flags, and a staff viewer is read-only (no edit controls and no Pay) until the staff payload loads and stays read-only with `staff.team.readOnlyNote` if it fails. The `Staff` card (`features/staff-teams`, `StaffTeamPanel`) shows to every staff role, collapsed behind a summary line below `lg`; its New team select (`NewTeamSelect`) saves on change through `PUT /api/v1/teams/:id` with `new_team_setting`, permitted by `StaffTeamPermissions.new_team_setter?` (admins and operators), the same rule the API team update uses (the legacy `TeamsController#team_params` is gone). Staff Pay: `FeeCard({ team, permissions, staffTeam })` gates the racer Pay button on `permissions.pay` (false while a staff viewer's staff request loads or fails, so no Pay at all then) and, with `permissions.staffPay` (`can.take_payment`, admins and operators), skips the closed and waitlist early returns and shows one warning per gap from `staffPayGaps` (`features/payments/staff-pay.ts`: roster, closed, waitlist) above outlined `Pay {amount} as staff` buttons (no gap: the ordinary Pay). It uses the same `usePay` body and price recheck as a racer, and Checkout gets `email: ''` when the staff team's `account_holder` is not the viewer, so the staff member's own email is not prefilled for someone else's team. A refunder gets no staff Pay (only the ordinary Pay on their own team). With `staffLinks`, paid rows and each paid line of the summary carry `Refund on Payments` (`/staff/payments?team_id=&payment_type=<requirement id>`, the DOM href has the `/register` basename; it opens `/register/staff/payments?team_id=...&payment_type=...`) plus the paid date from `staffTeam.payments`; a refunder on a closed team that is not paid up sees only `Registration is closed.` in the fee card (no payment lines), so the Staff card's `Payments` link is their way in. The tour does not auto-start for staff (`Take the tour` still works). Staff team links (Who's registered, Users, the user page, Emails) all open `/register/teams/:id`. `useSetNewTeam` awaits its own `fetchQuery` of the staff team (the `useStaffTeam` effect invalidates with `cancelRefetch: false`, so it joins that fetch instead of cancelling it). Tests: `test_seeds:staff_team_panel` (an operator, a refunder, an owner; a closed race inside the final-edits window with a 3-of-5 team, and an open race with a 2-of-3 team and a $50 mock fee) and `tests/spa/staff-team-panel.spec.ts`.
- Racer cleanup (reskin PR 9): no racer request renders a HAML page. Deleted: the homepage and its store JS, the legacy sign-up, login, password reset and account pages, the team, people, questions, captain, charge and mock-payment controllers and views (including the legacy Refund and "Refund and invalidate" buttons, so all of `ChargesController`), the race list, race page and registrations page, their locale keys, and the legacy Playwright specs and seeds (including `test_seeds:basic`). `spec/requests/legacy_redirects_spec.rb` covers the redirect table; `spec/requests/kept_legacy_pages_spec.rb` renders every kept staff page logged out, as a racer and as an admin (no `translation_missing`, no racer links); `spec/i18n/kept_keys_spec.rb` lists the locale keys that look like racer copy but are still read by the API, services, mailers or kept pages (add a key there when a deleted page's key turns out to be live). A key used by a kept controller, such as `requirement_not_found` in `TiersController`, must exist in `config/locales/en.yml` (specced). E2E: `test_seeds:legacy_redirects` and `tests/spa/legacy-redirects.spec.ts`. Deploy: no migration and no restart; staging first, then production, watching Rollbar for `NoMethodError` on kept staff pages and for 404s on old racer paths. Owner-timed: PR 9 ships only when the owner says, never during the 2026-12-06 to 2026-12-09 freeze.
- Nokogiri's HTML parser does not add an implied `<tbody>`, so in `render_views` specs select legacy table rows with `#table_id tr` and filter for `> td`.

## Planned: Payments admin page (#343)

- A generic staff page in the SPA (all new code lives in `frontend/`, no new HAML) to search completed payments by race, team name, any email, payment type and status, and bulk refund them. Nothing is special about carts: a cart deposit is just a `PaymentRequirement` named "Cart Deposit".
- Bulk refund has a configurable cap, `REFUND_BATCH_LIMIT` (default 5): the API returns it, the SPA stops selection at the cap, the server rejects larger batches with 422. The confirmation dialog lists every payment and the total and requires typing `REFUND <count>`.
- Full refunds only. Refunds go through one `Payments::RefundCharge` service (like `Payments::ChargeTeam`); record who refunded and when. Access: refunder, operator, admin.
- Needs a staff shell in the SPA first (`me` carries roles, staff layout), which the rest of the staff-page reskin reuses.
- Not building at this time: a cart flag or "cart returned" marker, partial refunds, and the admin-only "refund and delete completed requirement" option (the legacy button was deleted with the legacy team pages in PR 9).

## Known Quirks

1. **JSONForm answers**: Permitted answer keys come from the race's JSONForm schema; no allowlist to maintain

2. **Classy ID type**: `teams.classy_id` is an integer column - ensure proper type casting when working with Classy API responses

3. **Rails 7 SMTP settings**: Uses an initializer (`config/initializers/smtp_settings.rb`) to work around a Rails 7 bug where smtp_settings get reset

4. **Authlogic 6.x**: Password validations are explicit (not automatic) - see User model for the pattern

5. **JSON API (`/api/v1`)**: Controllers inherit `Api::V1::BaseController < ActionController::Base` (not `ApplicationController`). Authlogic is activated automatically by its railtie; CSRF token comes from `GET /api/v1/csrf` and is sent as `X-CSRF-Token`. Errors render `{ error, errors }` via `render_errors`; payment errors add a stable `code` (`already_paid`, `in_progress`, `duplicate_charge`, `card_error`, ...) because their `error` is a translated sentence. Use `authorize_update!(subject, team)` for update checks so only the team's owner is told "registration closed". New teams (the API) go through `Race#accepts_new_teams_from?(user)`: open registration, or any time for admins/operators. In request specs, `UserSession.find` is not usable after the request (Authlogic is deactivated); use `session_user_id` from `spec/support/api_helpers.rb`. Index endpoints that render race JSON for many races call `Race.preload_registration_data(races)` (tiers can't be preloaded through `race.requirements` because of STI); `spec/requests/api/v1/query_count_spec.rb` fails if a list endpoint adds queries per row.

6. **Payments**: All card charges (`POST /api/v1/teams/:id/payments`; the legacy `ChargesController` is gone) go through `Payments::ChargeTeam`, which rejects a requirement from another race (`:wrong_race`), checks `requirement.completed?(team)` before touching Stripe, returns `:roster_incomplete` (422) while `team.needs_people?` unless the payer is staff (payment specs build teams with `:with_enough_people`; the SPA fee card keeps the price, next tier and paid rows and hides only the Pay button behind `fee.rosterFirst`; staff (admin or operator, `Payments::ChargeTeam.staff_payer?`) take payment for an incomplete, closed or waitlisted team from the SPA fee card, which warns about each gap), and always charges `requirement.amount_due_cents`. Callers must `authorize! :edit, team` first. Payments for one team+requirement are serialized with a session-level Postgres advisory lock (`:in_progress` when held); non-`PaymentRequirement` and `MockPaymentRequirement` are `:not_payable`. If the completed requirement cannot be saved after a successful charge, the charge id is logged (and sent to Rollbar) so it can be refunded by hand; a concurrent request that already recorded it yields `:duplicate_charge` (card charged, refund needed), distinct from `:already_paid` (card not charged). A Stripe error raised by `Stripe::Charge.create` itself (e.g. a timeout) logs the team/requirement/user ids since the card may have been charged. A failed or no-op advisory unlock is alerted but never changes the payment result. The lock is incompatible with PgBouncer transaction pooling. `POST /api/v1/teams/:id/mock_payments` is routed only in development/test.

7. **Race time zones**: `races.time_zone` holds an IANA id (default `America/Chicago`, validated by `Race.valid_time_zone?` against the ids the admin select offers, i.e. Rails' `ActiveSupport::TimeZone.all`, so the SPA's Intl always knows the zone); storage and `config.time_zone` stay UTC. `RacesController`/`TiersController` wrap new/create/edit/update in `Time.use_zone` via the `RaceTimeZone` concern (a submitted `race[time_zone]` wins). Display with `race.local(time)` plus `DateHelper` (`human_readable` adds `%Z`); deadlines use `deadline_readable`/`deadline_date` (and `formatDeadline` in `frontend/src/lib/dates.ts`), which show a local-midnight deadline as 11:59 PM the previous day. Openings/tier begins use the plain formatters. Specs run under Zonebie (random `Time.zone`), so build expected times with explicit zones.

8. **Worker memory / Classy HTTP**: `ClassyClient` reuses one memoized `HTTPClient` (`http_client`); never build an `HTTPClient` per request. Each one allocates an OpenSSL context in native memory, and `Workers::ClassyCacheOrgMemberCacher` (every 20 min, ~318 pages) ratcheted the Basic worker's RSS into R14/R15 kills. Ruby `GC.stat[:heap_live_slots]` stayed flat, so check native churn, not just retained objects. Both Heroku apps also need `MALLOC_ARENA_MAX=2`: the worker boots with `RAILS_ENV=production`, so `config/sidekiq.yml` gives it 5 threads, and each thread's glibc arena kept ~70 MB (5 x 70 MB + ~190 MB boot > 512 MB). With both fixes the staging worker levels off at ~340 MB. Staging has `log-runtime-metrics` on (`sample#memory_total` in `heroku logs -d worker`).

9. **Feedback (`POST /api/v1/feedback`)**: requires a logged-in user (`require_api_user!`; the SPA's `FeedbackLink` renders only when `useMe` has a user). The cap (`SEND_LIMIT` 5 per `SEND_WINDOW` 1 hour per account) counts the user's non-failed `kind: "feedback"` rows in `sent_emails`, so it holds across dynos without a cache store and failed deliveries do not count; two simultaneous requests can both pass the check, so it can overshoot by a send. The client's `context.team_id` is only a claim. The controller attaches the team (email body, `sent_emails` tracking) only when `Ability.new(current_user).can?(:show, team)` (CanCan checks the exact action asked, so `:read` does not match rules written for `:show`); otherwise the email says `claimed team id N (unverified)`. A non-hash `context` is ignored. The email puts sender, team and page above a labelled message so a sender cannot forge a footer. `UserMailer::STAFF_EMAIL` is the staff address (also the footer's `global_questions`); `FEEDBACK_EMAIL` overrides it when non-empty.

10. **Authlogic `last_request_at` and the perishable token**: `ApplicationController` and `Api::V1::BaseController` set `last_request_update_allowed?` to false. Otherwise Authlogic saves `last_request_at` on every authenticated request, and every `User` save rotates the perishable token (Authlogic's `before_save :reset_perishable_token`), so a logged-in racer's reset link was always "expired". Nothing reads `last_request_at` now; if you ever turn on `logout_on_timeout`, also re-enable the update, or every session will look stale at once. Any other save still rotates the token: a failed login (which bumps `failed_login_count`) kills a pending reset link (#352, needs a dedicated reset token column).

11. **`completed_requirements.metadata` encoding**: the column is `serialize coder: JSON` and `Requirement#complete` also passes `JSON.generate(...)`, so new rows are stored double-encoded. Rows from the production dump (staging ids 21-23, 2024-2025) are triple-encoded and decode to a String after the coder. `CompletedRequirement#metadata` therefore unwraps with `JSON.load` until the value is no longer a String; always read it through the reader, never `read_attribute`. Staging and production both hold such rows, so reproduce data bugs against a restored copy (`heroku pg:backups:capture`, then `pg_restore` into a separate `dogtag_staging_copy` database, `DATABASE_URL=postgres://postgres@localhost/dogtag_staging_copy`).

12. **Refunds (#343)**: payment facts live in real columns on `completed_requirements` (`charge_id`, `amount_cents`, `refunded_at`, `refunded_by_id`, `stripe_refund_id`), written by `Requirement#complete` and backfilled from the JSON metadata (`AddPaymentColumnsToCompletedRequirements#backfill_payment_columns`; undecodable rows are skipped and logged). Metadata still carries `refunded: true`. The one status definition is `CompletedRequirement.payment_status_sql` (`refunded`, `refunding` = a queued `refund_batch_items` row whose batch is younger than `RefundBatch::STALL_AFTER` (`RefundBatch.stall_cutoff`, the same rule as `reported_status`; an older one lists as `paid` and can be queued again, and `QueueRefundBatch` marks such stale items `stalled` before inserting so the unique queued index does not reject them), `not_refundable` = no charge or a mock payment in production, `paid`); never re-derive it, use `with_payment_status` / `#payment_status` (a row loaded with the `payment_status` select carries it, so reload after changes). `Payments::RefundCharge` refunds one payment: same advisory lock as `ChargeTeam` (shared in `Payments::AdvisoryLock`), checks the charge at Stripe first (already refunded there is recorded as `already_refunded`, partly refunded is `partially_refunded` and untouched), then `Stripe::Refund.create({ charge: }, { idempotency_key: "refund-<charge_id>" })` (the key goes in opts; stripe-ruby-mock dedupes only on a param key, so specs assert the opts). It queues `Workers::PaymentRefundedEmail` with plain values (mailer dedupe key `refund-<charge_id>`, the same shape as the Stripe idempotency key, to `team.user`). `Workers::RefundBatch` (`important` queue; skips finished and stalled items, so a Sidekiq retry resumes) goes through it; refunds are only done on the staff Payments page (the legacy Refund and "Refund and invalidate" buttons and `ChargesController` were deleted in PR 9). `GET /staff/refund_batches/:id` never writes: an item still queued 10 minutes after its batch was created is only reported `stalled` (`RefundBatch#reported_status`); the retry action alone rewrites stalled items, and the lock, Stripe check and unique queued index stop a late original job double refunding. `RefundCharge` records with `update_columns` (a refund that reached Stripe is always recorded), refuses `amount_mismatch` unless the Stripe charge equals `amount_cents` (whole-charge refunds only), and records a refund it finds already made at Stripe with `refunded_by` nil and Stripe's own time (the staff payments JSON shows such a row's `refunded_by` as `{ name: "Done at Stripe" }`; a backfilled row with no Stripe refund id shows null). `Payments::QueueRefundBatch` is all-or-nothing and checks cap, `REFUND <count>`, not-refundable ids and the reviewed total, in that order; a unique partial index on queued items stops two tabs queuing one payment. `REFUND_BATCH_LIMIT` is read only in `RefundBatch.max_size` (junk falls back to 5). Staff API is `/api/v1/staff/*` (`authorize! :refund, :charges`); `Payments::PaymentSearch` lists the newest open race by default (else the most recent race that has already run, else the newest race) and clamps `page` to `MAX_PAGE` (10,000). `team_id` narrows to one team and never widens: without `race_id` the race is the team's (before the default race), an unknown or junk id or a different race lists nothing, and `race_id=all` with a `team_id` still lists only that team's payments, and `filters` carries `team` (`{ id, name, race_id }` or nil) plus the requested `team_id`. Deleting a payment row also deletes its audit columns; the only refund path is `RefundCharge`, which never deletes it. Deploy: back up (`heroku pg:backups:capture --app dogtag`), push, migrate immediately (`dogtag-staging` first), then `heroku restart`. Until the migration has run, `Requirement#complete` writes only the metadata (it checks `CompletedRequirement.column_names`, so a charged card is still recorded) and `#refunded?` / `#charge_id` fall back to the metadata, so payments and `TeamChecklist` keep working and the backfill fills those rows; refunds and the staff payments API fail until then. A dyno that booted before the migration keeps the old column list until `heroku restart`, so a payment it records after the migration has blank columns (listed as `not_refundable`): restart right after migrating, and if one slipped in, rerun the idempotent backfill (`heroku run rails runner 'require Rails.root.join("db/migrate/20261124062730_add_payment_columns_to_completed_requirements").to_s; AddPaymentColumnsToCompletedRequirements.new.backfill_payment_columns'`). Refund email copy (`user_mailer.payment_refunded_email` in `en.yml`) needs owner review before production.

## E2E Learnings

- CircleCI Smarter Testing: the `test` job runs `circleci testsuite run "rspec"` (suite in `.circleci/test-suites.yml`, results uploaded by `store-test-results: true`, so there is no `store_test_results` step). Validate locally with `circleci testsuite doctor rspec` (needs `brew install circleci` and `circleci extension install testsuite`). Doctor's subprocess loses the rbenv shims and hits `/usr/bin/bundle` (system Ruby 2.6): temporarily put `~/.rbenv/shims/bundle` in the `run:` line to validate, and never commit that. No credit-charged features (impact analysis, dynamic splitting, auto-rerun) are enabled.

- Staging runs on synthetic data, not a production dump: `bin/rails staging:seed` (`lib/staging_seed.rb`) fills an **empty** database. It needs `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and `SEED_PASSWORD`, plus optional `SEED_EMAIL_BASE` (plus-addresses every seeded email into the test mailbox) and `SEED_CLASSY_CAMPAIGN_ID`. It refuses on the production host, with a live Stripe key, or with existing users/races. It covers past racers, a finalized team, a half-paid team, a just-started team, a full race with a waitlist, a not-yet-open race and a closed race. Seeded payments use fake `ch_seed_*` ids, so refunds of them fail.

- Playwright boots Rails in **development** (delivery_method :smtp to Mailpit) with `SIDEKIQ_INLINE=true` (config/initializers/sidekiq.rb; ignored in production), `APP_HOST=localhost:3099`; `VITE_DEV_SERVER` must be unset. CircleCI runs the same with `RAILS_ENV=development` against the `dogtag_test` DB, since the test env uses in-memory mail delivery.
- Playwright boots Rails in development, so with no `DATABASE_URL` it uses `dogtag_development`, and its global setup runs `test_seeds:cleanup` against that database (it deletes every `Race %` race and `@example.com` user). Always set `DATABASE_URL` to a separate migrated database (e.g. `postgres://postgres@localhost/dogtag_test_2`). If another Rails server (your own `bin/rails s`) owns `tmp/pids/server.pid`, also set `PIDFILE=tmp/pids/e2e-3199.pid` with `TEST_PORT=3199`; the SPA build in `public/register` must be rebuilt first (`npm --prefix frontend run build`) or the spec runs against stale UI. Running a seed task by hand without `DATABASE_URL` writes into the development database; remove its rows by unique id, never with `test_seeds:cleanup`.
- Each Playwright spec seeds with its own `test_seeds:*` task (unique `TEST_UNIQUE_ID`, `@example.com` emails) via `tests/helpers/seed.ts`; `test_seeds:cleanup` sweeps users, teams, `Race %` races and `@example.com` SentEmail rows.
- E2E targets (`tests/e2e/`, `E2E_TARGET`): `npm run e2e` = local, mock payments, Mailpit; `npm run e2e:stripe` = local, Stripe test card; `npm run e2e:staging` = `dogtag-staging.herokuapp.com`, Stripe test card, optional IMAP check (`E2E_CHECK_EMAIL=1`). The Classy check runs on either target only with `E2E_CHECK_CLASSY=1` (credentials alone never enable it): it gives the race a campaign, so the server creates real Classy members and teams. Locally the server reads `CLASSY_*` from `.env`; the config passes the `.env.e2e` Classy keys through only when the check is on. Settings live in the gitignored `.env.e2e`; see `tests/README.md`.
- The host guard (`tests/e2e/target.ts`) allows only `localhost`, `127.0.0.1` and `dogtag-staging.herokuapp.com`, and refuses `dogtag.chiditarod.org`, `dogtag.herokuapp.com` and `*.chiditarod.org` first; no env var extends the lists, and a `BASE_URL` host must belong to the chosen target. Nothing under `tests/` may use the `heroku` CLI, the Heroku API or `heroku run`. Never pay unless the race's publishable key starts with `pk_test_`. Locally in mock mode (`npm run e2e`) the server never calls Stripe, so a machine without Stripe keys can still run the whole `registration` project by starting it with fake keys: `STRIPE_PUBLISHABLE_KEY=pk_test_localfake STRIPE_SECRET_KEY=sk_test_localfake`. Never do this for `e2e:stripe` or staging.
- The staging run logs in as an **operator**, never an admin, and builds its own `Race E2E <runId> <yyyy-mm-ddThh:mm>Z` through the SPA staff pages (`tests/e2e/admin-forms.ts` fills fields by label; `forbidLegacyPages` fails a test that loads any page outside `/register`; the race and fee forms ask "Discard changes?" if left unsaved, so helpers never navigate away mid-form). Races are retired (dates moved to the past, ` [retired]` appended), not deleted; `retireRace` refuses names without the `Race E2E ` prefix. A run sweeps its own leftovers and other runs' open E2E races older than two hours, so concurrent runs don't retire each other's races. Classy teams are deleted only if named `Test Team E2E *` on the allowlisted campaign.
- Classy refuses `DELETE /fundraising-teams/:id` (400, `Can not delete a Fundraising Team that has active Fundraising Pages.`) while the team has a page; the server creates the captain's page with the team. `deleteFundraisingTeam` (`tests/e2e/classy.ts`) deletes the team's pages first, then the team, and its error messages include Classy's response body. Whether a delete is hard or only archives is unverified. A run that dies before cleanup leaves a `Test Team E2E *` team on campaign 867400; remove it by hand.
- On staging, racers are IMAP plus-addresses (`<user>+<runId>@<domain>` from `E2E_EMAIL_BASE`); only mail to this run's address is deleted from the shared mailbox. Locally, mail goes through Mailpit.
- Staging secrets and `.env.e2e` never go into CI or artifacts. CI runs `npm test` with `E2E_CHECK_EMAIL=1` against Mailpit only. Playwright titles every `fill` step `Fill "<value>"` and the HTML report keeps step titles for passed tests, so passwords, the operator login and private mailbox addresses go in through `fillSecret` (`tests/e2e/fill-secret.ts`, native value setter + `input`/`change`, titled "Evaluate"). admin-auth records no trace, video or screenshot; on staging race-setup and race-teardown keep no trace or video (they carry the operator's session cookie), and neither does registration (traces keep evaluate arguments, request bodies and DOM snapshots, so the mailbox address and racer password); failure screenshots stay; `race-teardown` deletes `playwright/.auth/staff.json`. `payFee` takes the race's publishable key and refuses a non-`pk_test_` key itself. Registration folds the retry number into its run id (`<runId>-r1`) so a CI retry can sign up again.
- Before `e2e:staging`, check that staging has run the latest migrations (`heroku run -a dogtag-staging "bin/rails db:migrate:status"`) and was restarted afterwards. A pending migration shows up as a generic "Something went wrong" in the SPA and a 500 `UnknownAttributeError` in `heroku logs` (the `people.instagram` column broke "Add 5 racers" this way). The Stripe Checkout popup's expiry field sometimes drops its last keystroke (`12 / 3`), so `payWithStripeCheckout` retypes until the field reads `12 / 34`.
- App changes the suite relies on: operators can create requirements (`can :create, PaymentRequirement` / `Tier`, used by the staff fee pages); `Requirement.allowed_types` limits the add-fee type select ("Test payment (no card)" is offered outside production only). The staging suite no longer touches legacy pages: it logs in at `/register/login`, reads the staff roles from `GET /api/v1/me` (`loggedInRoles`), drives `/register/staff/*` and fails on any non-SPA navigation (`forbidLegacyPages`). `addFee` and `addPrice` surface the form's error text on a failed save; the sweep covers every non-retired `Race E2E ` race (the two-hour age rule still protects a concurrent run's).
- Person records can only be created while their race is open; seed past races by moving dates with `update_columns` afterwards.
- `playwright.config.ts` sets `storageState` so `dogtag:tour:off` is `1` in localStorage for every test; otherwise the tour opens by itself and blocks clicks on the team page. A spec that wants the tour clears it with `test.use({ storageState: { cookies: [], origins: [] } })` (`tests/spa/guided-tour.spec.ts`). Any other checkout's Playwright config needs the same `storageState` lines, or its specs will be blocked by the tour. The `origin` must match the `baseURL` origin.
- The picker dialog is portaled to `document.body`, so locate it with `page.getByRole('dialog')`, not inside the `Racers` group. Step 1 checkboxes are named by the racer plus a last-raced line (`Ada Racer 2025, Team`), so use the default substring match, not `exact`. Step 2 renames the dialog `Review {full name}` and its checkboxes read `"{label}: {value}"` (`Instagram: None` when blank). The roster pill `N of M`, the open-spots row (`3 spots to fill`) and the roster rows live in the `Racers` group. A racer's roster row exists only once they are added, so wait for it there; the row's name is just the full name, so `exact` works on it.

## Technical Debt

The following items were identified during the Rails 8 upgrade and should be addressed when time permits:

1. **`stripe` gem (~> 1.58.0)**: Very outdated version from ~2017. Should be updated to modern stripe-ruby (v10+). This will require updating API calls throughout `lib/stripe_helper.rb` and payment-related code. Test thoroughly with `stripe-ruby-mock`.

2. **`coffee-rails` gem**: CoffeeScript is deprecated. JavaScript assets should be migrated to ES6. Files to convert are in `app/assets/javascripts/`. Can be removed from Gemfile after migration.

3. **`sass-rails` gem (~> 5.0)**: Consider migrating to modern CSS tooling (cssbundling-rails, Propshaft, or Dart Sass). Current stylesheets are in `app/assets/stylesheets/`.

4. **Dependabot PRs to close, not merge**: `codeclimate-test-reporter` 1.0.9 pins `simplecov <= 0.13` (it would downgrade simplecov from 0.22 to 0.3.9), and the `stripe` 18 / `stripe-ruby-mock` 2.5 jump is the item 1 migration above, not a drive-by bump. Routine bumps: `bundle update --minor --conservative <gems>` (the Rails gems are pinned `~> 8.0.0` and must move together).

## Testing External Services

### Stripe
- Use `stripe-ruby-mock` gem in tests
- MockPaymentRequirement available for integration tests without real Stripe calls

### Local mail (Mailpit)
- `docker compose up -d db redis mailpit`; Mailpit's UI is at http://localhost:8025 (SMTP on `1025`).

### Classy
- Mock HTTP calls with WebMock
- See `spec/lib/classy_client_spec.rb` for patterns

## Quick Reference

| Task | Command |
|------|---------|
| Run all tests | `bundle exec rspec` |
| Run specific test file | `bundle exec rspec spec/models/user_spec.rb` |
| Start local services | `docker compose up -d db redis mailpit` |
| Rails console | `bundle exec rails console` |
| Database migrate | `bundle exec rails db:migrate` |
| Heroku deploy | `git push heroku main` |
| Heroku logs | `heroku logs --tail` |
