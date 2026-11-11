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
REGISTRATION_UI=spa            # optional: use the React SPA under /register (only takes effect once the SPA is built, or VITE_DEV_SERVER is set)
SENDGRID_WEBHOOK_PUBLIC_KEY=   # optional: verification key for the SendGrid event webhook (POST /webhooks/sendgrid); when unset, the webhook is rejected and "sent" counts as delivered
SIDEKIQ_INLINE=true            # dev/e2e only: run jobs in-process without a Sidekiq worker (ignored in production)
VITE_DEV_SERVER=http://localhost:5173  # dev only: redirect /register/* to the Vite dev server
```

## Custom questions using jsonform

Each race has a `jsonform` field. This field can contain a [jsonform](https://github.com/jsonform/jsonform) schema that is consumed and rendered as questions to the end-user during their team signup. Their responses are then saved into their team record and are included when exporting a CSV.

- Answer keys are taken from the race's schema, so new questions need no code changes.
- For example jsonform data, see [github](https://github.com/chiditarod/dogtag/tree/master/examples/jsonform)

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

### Build and run all containers

This will also create the `dogtag_test` and `dogtag_development` databases and boot Mailpit.

    docker compose up -d

To run only the services needed when Rails runs on the host (and for the Playwright suite):

    docker compose up -d db redis mailpit

### Run the test suite

    docker-compose run web bundle exec rspec   # from within the container
    bundle exec rspec                          # or from the console

### Mailpit

[Mailpit](https://mailpit.axllent.org) runs in the docker compose cluster
(`axllent/mailpit`). It accepts SMTP on `1025` and serves the inbox UI at
http://localhost:8025. In development Rails delivers mail over SMTP to
`SMTP_HOST` (default `localhost`) and `SMTP_PORT` (default `1025`), so every
email dogtag sends shows up in the Mailpit inbox.

### End-to-end tests (Playwright)

    docker compose up -d db redis mailpit
    npm ci && npx playwright install chromium
    npm test                                  # all specs; builds the SPA first (SPA_BUILD=skip to reuse the build)
    npx playwright test tests/spa             # only the SPA suite

Playwright boots Rails with `SIDEKIQ_INLINE=true` (jobs run in-process, no
Sidekiq worker; ignored in production) and `REGISTRATION_UI=spa`. See
`tests/README.md` for details.

## Registration SPA (React)

The new registration UI lives in `frontend/` (Vite + React + Tailwind) and is served by Rails under `/register`.

```bash
npm --prefix frontend ci            # install
npm --prefix frontend test -- --run # unit tests (Vitest)
npm --prefix frontend run build     # builds into public/register (gitignored)
npm --prefix frontend run dev       # Vite dev server on :5173 (proxies /api to Rails on :3000)
```

- Set `REGISTRATION_UI=spa` to make the homepage "Get started" link and emails point at `/register` (default is the legacy UI). It only takes effect when the SPA is built (or `VITE_DEV_SERVER` is set), so a missing build falls back to the legacy UI instead of linking to a 503.
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
4. Tail them logs.

## Yearly SDLC Cycle

Here is an outline of the yearly cycle for using Dogtag with a single event ([CHIditarod](http://www.chiditarod.org), in our case).

1. Do a development cycle to incorporate any new features.
1. Update the jsonform with any new questions and expected responses for the specific race.
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
