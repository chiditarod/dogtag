dogtag
======

*dogtag is a Ruby on Rails application that registers user and teams for the annual [CHIditarod](http://chiditarod.org) urban shopping cart race and epic mobile food drive.  The code is 100% open-source, runs on Heroku, and has processed more than $100,000.*

![Build Status](https://travis-ci.org/chiditarod/dogtag.svg?branch=master)
[![Test Coverage](https://codeclimate.com/github/chiditarod/dogtag/badges/coverage.svg)](https://codeclimate.com/github/chiditarod/dogtag/coverage)
[![Code Climate](https://codeclimate.com/github/chiditarod/dogtag.png)](https://codeclimate.com/github/chiditarod/dogtag)

Integrations
--------
- Payments/Refunds via the Stripe API
- Fundraising campaign automation via the Classy API

Requirements
------------
- App Server like Heroku
- Redis
- PostgreSQL
- SMTP Server

Runtime Environment Variables
-----------------------------

```
DATABASE_URL=postgres://postgres:123abc@localhost:5432
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
CLASSY_CLIENT_ID=              # optional
CLASSY_CLIENT_SECRET=          # optional
CLASSY_ORGS=                   # comma-separated list of classy organization ids the client has access to. used to cache org members
ROLLBAR_ACCESS_TOKEN=          # optional
DEFAULT_FROM_EMAIL             # e.g. info@yourdomain.tld
SMTP_DOMAIN                    # e.g. heroku.com
SMTP_HOST                      # e.g. smtp.foo.tld
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
APP_HOST                       # host (and :port, if any) used in email links; production defaults to dogtag.chiditarod.org, so staging must set it
SIDEKIQ_INLINE=true            # dev/e2e only: run jobs in-process without a Sidekiq worker (ignored in production)
VITE_DEV_SERVER=http://localhost:5173  # dev only: redirect /register/* to the Vite dev server
REFUND_BATCH_LIMIT=5           # optional: most payments one staff refund batch may hold (a positive integer; default 5, anything else falls back to 5)
```

## Email delivery tracking

All email is sent through MXRoute over SMTP (the `SMTP_*` settings above). Every outgoing email is logged to `sent_emails` (`queued`, then `sent` or `failed`). MXRoute has no event webhooks, so "delivered" means "logged as sent"; the `delivered`/`bounced` statuses are never set.

- **Admin log:** operators and admins can browse `/sent_emails`, filtered by team, status, kind or recipient. Each team page also links to its emails.
- **Verify a team:** `bundle exec rake "emails:verify[<team_id>]"` (on Heroku: `heroku run rake "emails:verify[<team_id>]"`) prints each expected email with a label of `OK`, `MISSING`, `NOT DELIVERED` or `UNTRACKED`. It exits 1 if any is `MISSING` or `NOT DELIVERED`.
  - `UNTRACKED` means the email would have been sent before logging began. It does not fail the check.
  - A `sent` row counts as OK.

## Refunds

Staff with the refunder, operator or admin role can refund payments. Every refund records who did it and when (`completed_requirements.refunded_by_id`, `refunded_at`) and emails the team's account holder once.

- **Refunds** are done on the staff Payments page (below). The legacy team page's Refund and "Refund and invalidate" buttons were removed with the legacy team pages; old `/teams/...` URLs redirect to the SPA.
- **Staff API** for the payments admin page: `GET /api/v1/staff/payments` (filters `race_id`, `payment_type`, `status`, `q`, `page`; 25 per page), `POST /api/v1/staff/refund_batches` (`completed_requirement_ids`, `confirmation` = `REFUND <count>`, `expected_total_cents`), `POST /api/v1/staff/refund_batches/:id/retry` and `GET /api/v1/staff/refund_batches/:id`. A batch is refunded in the background by a Sidekiq job on the `important` queue and holds at most `REFUND_BATCH_LIMIT` payments.
- **Staff shell** in the SPA: staff (admin, refunder or operator) get a `Staff` link in the SPA header and a `Payments` item in the legacy admin menu, both going to `/register/staff/payments`. `GET /api/v1/me` now returns `roles`. Others see "Not allowed"; the server is the real gate. The Payments page opens in Browse mode, a read-only lookup: filters (race, payment type, status, search; all in the URL), a progress line (`37 of 142 refunded · $1,850 of $7,100`), a table (cards below `sm`) and pagination. `Refund payments` enters Refund mode: status is locked to Paid, staff tick up to the batch limit (the API's `refund_batch_limit`, from `REFUND_BATCH_LIMIT`; `Select next N` ticks the first rows), `Review and refund N…` opens a dialog that lists every payment and the total and needs `REFUND N` typed, then the results view polls the batch and shows `Refunded`, `Already refunded`, `Failed: <reason>` or `Stalled` per payment. `Retry K failed` re-queues all failed and stalled payments of that batch (retry is per batch, not per row). A refunded payment shows `Refunded` on the racer's fee card.
- Refunds are always full. A charge already refunded at Stripe is recorded as refunded, not as an error; a partly refunded charge is left for staff to finish in Stripe.

## Custom questions using jsonform

Each race has a `jsonform` field. This field can contain a [jsonform](https://github.com/jsonform/jsonform) schema that is consumed and rendered as questions to the end-user during their team signup. Their responses are then saved into their team record and are included when exporting a CSV.

- Answer keys are taken from the race's schema, so new questions need no code changes.
- Every team needs a captain who is one of its racers (organizers contact them directly). Racers get a star and a "Make captain" button in the SPA; a team does not finalize until a captain is chosen, and the CSV export has `captain_*` columns after the `user_*` columns (`captain_inferred` is `yes` where the migration guessed one).
- Racers also pick the teams they want to race with (and an optional free-text "other") in the SPA's Questions card. The CSV export has a final `racing_with` column and the team page shows "Racing with" to admins and operators. These are not part of the jsonform schema.
- A `form` item can be shown only when another answer matches: `{ "key": "fire-details", "type": "textarea", "showWhen": { "flame-effects": "Yes" } }`. Only optional fields may use `showWhen` (the race form rejects a required one). The racer SPA hides the field and drops its answer on save; the legacy team pages no longer exist.
- For example jsonform data, see [github](https://github.com/chiditarod/dogtag/tree/master/examples/jsonform)

## New teams

A team is flagged as new when its racers' years racing add up to 0. A blank counts as 0, and a team with no racers yet has no flag. The flag updates whenever a racer is added, edited or removed.

- Staff see it on the team page, in a "New team" column on the registrations page, and in a `new_team` column (`yes`, `no` or blank) in the CSV export.
- Admins and operators can override it on the team's edit form ("New team (staff only)"). An override sticks through roster changes until it is set back to "Automatic".
- It replaces the old "Have any of your team members raced CHIditarod in the past?" JSONForm question.

## Race time zones

Each race has a `time_zone` (an IANA id, default `America/Chicago`), chosen on the race form. Datetimes are stored in UTC, but the race and tier forms read and show their date fields in the race's zone, and every page, email and the SPA display race dates in that zone. Pick the zone first, then enter dates as local wall-clock times (e.g. `00:00` on Dec 15 for a midnight opening).

Changing the zone of an existing race keeps the wall-clock times on the form and reads them in the new zone, so the stored moments move. The save notice says so; check the dates afterwards.

A deadline (registration close, final edits close) set at exactly local midnight is shown as 11:59 PM on the previous day, so a close of Feb 15 00:00 reads "February 14 ... 11:59 PM".

## Developer Setup

*Tested against MacOS Mojave (10.14.2)*

### Prerequisites

- [Xcode](https://itunes.apple.com/us/app/xcode/id497799835)
- [Docker](https://docs.pie.apple.com/artifactory/docker.html)
- [Homebrew](https://brew.sh/)

### Install Ruby

```bash
brew install rbenv
rbenv install $(cat .ruby-version)
gem install bundler
```

### Install

#### MacOS 12.6

```sh
xcode-select --install
softwareupdate --all --install --force

brew install readline openssl v8 libpq
gem install libv8 --platform="x86_64-darwin-20"
bundle config --local build.pg --with-opt-include="/opt/homebrew/opt/libpq/include" --with-opt-lib="/opt/homebrew/opt/libpq/lib"
bundle install

docker-compose up -d db
bundle exec bin/rails db:migrate RAILS_ENV=test
rspec
```

#### MacOS 12.1

```sh
xcode-select --install
softwareupdate --all --install --force

brew install readline openssl v8 libpq
gem install libv8 --platform="x86_64-darwin-20"
bundle install
bundle exec bin/rails db:migrate RAILS_ENV=test
rspec
```

#### Prior MacOS Versions

```sh
brew install libffi libpq
export PKG_CONFIG_PATH="$PKG_CONFIG_PATH:/usr/local/opt/libffi/lib/pkgconfig"
bundle config --local build.ffi --with-ldflags="-L/usr/local/opt/libffi/lib"
bundle config --local build.pg --with-opt-dir="/usr/local/opt/libpq"
bundle install
```

### Create an `.env` file for local development

This file is used when booting Rails outside of Docker.  Customize `.env` with `STRIPE_PUBLISHABLE_KEY` and `STRIPE_PUBLISHABLE_KEY` entries, which are currently required to boot the app.

```bash
cp .env.example .env
```

## Local Development

### Start the backing services

Postgres, Redis and [Mailpit](https://mailpit.axllent.org) (local mail catcher) are all you need to run Rails and the specs from the console. The `db` container also creates the `dogtag_test` and `dogtag_development` databases.

    docker compose up -d db redis mailpit

The Playwright suite needs the same three services. To run the whole stack in containers instead, use `docker compose up -d`.

### Run the test suite

    docker-compose run web bundle exec rspec   # from within the container
    bundle exec rspec                          # or from the console

    bin/check                                  # quiet run of rspec, vitest, tsc and the SPA build
    bin/check e2e                              # Playwright (needs db, redis, mailpit running)

### Mailpit

[Mailpit](https://mailpit.axllent.org) runs in the docker compose cluster
(`axllent/mailpit`). It accepts SMTP on `1025` and serves the inbox UI at
http://localhost:8025. In development Rails delivers mail over SMTP to
`SMTP_HOST` (default `localhost`) and `SMTP_PORT` (default `1025`), so every
email dogtag sends shows up in the Mailpit inbox.

### End-to-end tests (Playwright)

Setup checklist for running the suite locally:

- [ ] Ruby 3.4 and Node 24.x installed (`bundle install` done; see Setup above).
- [ ] Docker running, with `docker compose up -d db redis mailpit` (Postgres, Redis, Mailpit on SMTP `1025`, UI at http://localhost:8025).
- [ ] `.env` exists (`cp .env.example .env`) with `STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` set (test keys; Rails will not boot without them). `e2e:stripe` needs real `pk_test_`/`sk_test_` keys; mock-payment runs only need the variables to be present.
- [ ] The development database exists and is migrated: `bundle exec rails db:create db:migrate` (Playwright boots Rails in **development**).
- [ ] `npm ci` at the repo root, and `npx playwright install chromium`.
- [ ] Nothing else is listening on port 3099 (or on `TEST_PORT`). A server already running there is reused as is, so a dev server started without the e2e variables breaks the run. Stop it first.
- [ ] `VITE_DEV_SERVER` is unset in your shell and `.env` (Rails must serve the built SPA from `public/register`).
- [ ] A frontend build is possible: global setup runs `npm --prefix frontend ci` if needed and builds the SPA; set `SPA_BUILD=skip` to reuse an existing `public/register`.
- [ ] Optional: `.env.e2e` (gitignored) only for staging, IMAP or Classy runs. It is not needed for `npm run e2e` or `npm test`. If you do not intend to hit staging, leave it empty or absent.
- [ ] Never point it at production: the host guard in `tests/e2e/target.ts` refuses anything but `localhost`, `127.0.0.1` and `dogtag-staging.herokuapp.com`.

Then:

    npm test                                  # all specs; builds the SPA first (SPA_BUILD=skip to reuse the build)
    npx playwright test tests/spa             # only the SPA suite
    npm run e2e                               # registration flow, local: mock payments, Mailpit
    npm run e2e:headed                        # same as e2e, with a visible browser
    npm run e2e:stripe                        # same, with a real Stripe test-card payment
    npm run e2e:staging                       # against dogtag-staging (needs .env.e2e; see tests/README.md)
    bin/check e2e                             # quiet run for CI-style output

Playwright boots Rails with `SIDEKIQ_INLINE=true` (jobs run in-process, no
Sidekiq worker; ignored in production). Failures
leave an HTML report (`npx playwright show-report`) and traces in
`test-results/`. See `tests/README.md` for details.

## Registration SPA (React)

The new registration UI lives in `frontend/` (Vite + React + Tailwind) and is served by Rails under `/register`.

```bash
npm --prefix frontend ci            # install
npm --prefix frontend test -- --run # unit tests (Vitest)
npm --prefix frontend run build     # builds into public/register (gitignored)
npm --prefix frontend run dev       # Vite dev server on :5173 (proxies /api to Rails on :3000)
```

- `/` redirects (301) to `/register`, and every old racer URL (`/login`, `/teams/...`, `/races`, `/account`, `/password_resets/...`) redirects to its SPA page, so old bookmarks and emails keep working. Mail links are built with `SpaUrl.for` (host from `APP_HOST`). Only the staff pages remain in HAML (races new/edit/export, requirements, tiers, the users index, sent emails and the error pages) until reskin PR 10.
- Set `VITE_DEV_SERVER=http://localhost:5173` so Rails redirects `/register/*` to the Vite dev server; without it Rails serves `public/register/index.html` (503 if not built).
- Heroku builds the SPA via the `heroku-postbuild` script; `rails_12factor` serves `public/register/assets/*`. Missing assets return 404 (only extension-less paths get the SPA shell).

## Database

### Create and Migrate

Via docker:

    docker-compose run web bundle exec rake db:migrate
    docker-compose run -e RAILS_ENV=test web bundle exec rake db:migraten

Or via the command line:

    bundle exec rake db:migrate
    RAILS_ENV=test bundle exec rake db:migrate

### Connect to postgres inside container

    docker-compose exec db psql -U postgres

### Restore postgres db from a dump file

```bash
docker cp /local/file.dump $(docker-compose ps -q  db):/file.dump
docker-compose exec db pg_restore -U postgres --verbose --clean --no-acl --no-owner -h localhost -d dogtag_development /file.dump
```

## Basic Deploy Plan

1. Test locally using TEST Stripe credentials.
2. Deploy to a Heroku staging environment using TEST credentials.
3. Deploy to production using PROD credentials.
4. If the deploy has migrations, run them right away (`heroku run rails db:migrate`), then `heroku restart`. Pushing does not migrate (no release phase), and dynos that booted before the migration do not see new columns.
5. Tail them logs.

## Yearly SDLC Cycle

Here is an outline of the yearly cycle for using Dogtag with a single event ([CHIditarod](http://www.chiditarod.org), in our case).

1. Do a development cycle to incorporate any new features.
1. Update the jsonform with any new questions and expected responses for the specific race.
1. Fill in the race's confirmation text (Markdown) in the admin race form and review it. It is shown to teams when they are fully registered and is included in the confirmation email.
1. Launch it all locally, make sure Stripe payments are functioning and a team can finalize their registration successfully.
1. Use Mailpit (http://localhost:8025) to ensure emails are being created and sent.
1. Check that the SSL certificate for dogtag.chiditarod.org is up to date and working
1. Turn on SSL in heroku and apply the cert.
1. Upgrade PostgreSQL if needed
1. Upgrade Rails to pick up security fixes.


## Developers

### Upgrade Ruby

```
export RUBY_CONFIGURE_OPTS="--with-openssl-dir=$(brew --prefix openssl)"
rbenv install 2.7.5
```

### Scratch Ruby Upgrade notes

```sh
bundle config build.thin --with-cflags="-Wno-error=implicit-function-declaration"

gem install libv8 -v '8.4.255.0' -- --with-v8-lib

bundle config build.libv8 --with-system-v8
gem install libv8 -v '8.4.255.0' --with-system-v8

CC='clang -fdeclspec' gem install libv8 -v '8.4.255.0'
CC='clang -fdeclspec' gem install libv8 -v '8.4.255.0' --with-system-v8

# bundle config build.libv8 --platform="x86_64-darwin-20"

gem install bundler -v '2.1.4'
```
