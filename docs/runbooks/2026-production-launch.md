# CHIditarod XXII production launch runbook (`dogtag`)

Prepared 2026-11-16. Nothing here has been run against production yet. Run it
only when the owner says go. Steps marked **OWNER** need the owner at the time.

## Current state (verified 2026-11-16)

| Item | State |
|------|-------|
| App | `dogtag`, stack heroku-24, buildpacks `heroku/nodejs` then `heroku/ruby` |
| Deployed code | `1498c82` (PR #251), far behind `main` |
| Dynos | none (the router returns 503) |
| Add-ons | Rollbar, Sumo Logic. **No Postgres, no Redis** |
| Domain | `dogtag.chiditarod.org` → `dogtag.chiditarod.org.herokudns.com`, proxied by Cloudflare. ACM cert active, renews 2027-01-11 |
| Backup | `b354`, 2026-04-09, 971 KB, still downloadable. Same data as `../dogtag-private/postgres/postgres_dump-20260409.dump` |
| Old app | `dogtag-22` is already gone |

Config vars already set: `APP_HOST=dogtag.chiditarod.org`, `REGISTRATION_UI=spa`,
`MALLOC_ARENA_MAX=2`, `RAILS_ENV`/`RACK_ENV=production`, `LANG=en_US.UTF-8`,
`ROLLBAR_ENV=production`, `ROLLBAR_ACCESS_TOKEN`, `CLASSY_CLIENT_ID/SECRET`,
`CLASSY_ORGS=34780`, `SMTP_*` (MXRoute), `DEFAULT_FROM_EMAIL`, `SIDEKIQ_USER/PASS`,
`SECRET_KEY_BASE`, `REDIS_PROVIDER=REDIS_URL`.

Still missing:
- `DATABASE_URL` and `REDIS_URL`. Step 2 adds them.
- Stripe live keys (**OWNER**, step 1).

Unused leftovers (harmless): `LOG_LEVEL_RAILS`, `DOMAIN_NAME`, `GOOGLE_ANALYTICS`, `NEW_RELIC_APP_NAME`.

Monthly cost once running matches staging: about $22 (Postgres essential-0 $5,
Redis mini $3, Basic web $7 and Basic worker $7).

## Steps

### 0. Go/no-go result
Keep `REGISTRATION_UI=spa`, or switch to `legacy` (`heroku config:set REGISTRATION_UI=legacy -a dogtag`).
You can flip it at any time without a deploy.

### 1. Stripe live keys (OWNER)
```bash
heroku config:set STRIPE_PUBLISHABLE_KEY=pk_live_... STRIPE_SECRET_KEY=sk_live_... -a dogtag
# Check the prefixes without printing the keys:
heroku config:get STRIPE_SECRET_KEY -a dogtag | cut -c1-8   # sk_live_
```

### 2. Maintenance mode, Postgres and Redis
```bash
heroku maintenance:on -a dogtag
heroku addons:create heroku-postgresql:essential-0 -a dogtag
heroku addons:create heroku-redis:mini -a dogtag
heroku addons:wait -a dogtag
heroku config -a dogtag | grep -E '^(DATABASE_URL|REDIS_URL):' | cut -c1-30
```
Check there is no PgBouncer transaction pooling, because payments use Postgres advisory locks:
- There must be no `DATABASE_CONNECTION_POOL_URL` var.
- `DATABASE_URL` must use port 5432.

Staging runs Postgres 18 on the same plan, so don't pin a version.

### 3. Deploy `main`
```bash
git fetch upstream
git push heroku upstream/main:main
```
The build runs `heroku-postbuild`, which builds the SPA into `public/register`.

### 4. Restore the April data (OWNER confirms right before)
```bash
heroku pg:backups:restore b354 DATABASE_URL -a dogtag --confirm dogtag
```
If `b354` can't be restored, upload the local dump to a temporary signed URL and restore from that URL instead.
Do **not** clear `stripe_customer_id`. Staging cleared it only because it runs on test keys.

### 5. Migrate and take a baseline backup
```bash
heroku run rails db:migrate -a dogtag
heroku run 'rails runner "puts ActiveRecord::Base.connection_pool.migration_context.needs_migration?"' -a dogtag   # false
heroku pg:backups:capture -a dogtag
heroku pg:backups:schedule DATABASE_URL --at '03:00 America/Chicago' -a dogtag
```

### 6. Dynos
```bash
heroku ps:type web=basic worker=basic -a dogtag
heroku ps:scale web=1 worker=1 -a dogtag
heroku labs:enable log-runtime-metrics -a dogtag   # the same memory logging staging has
heroku logs -d worker -n 200 -a dogtag | grep -i cron   # registration_reminders etc. are loaded
```

### 7. Smoke test, then maintenance off
```bash
heroku maintenance:off -a dogtag
for p in / /register /register/login /api/v1/races; do curl -s -o /dev/null -w "$p %{http_code}\n" https://dogtag.chiditarod.org$p; done
```
- `/api/v1/races` shows `stripe_publishable_key` starting with `pk_live_`.
- Log in as admin. `/sidekiq` asks for the Sidekiq login and shows the cron jobs.
- Rollbar receives a test item: `heroku run 'rails runner "Rollbar.info(%q(prod launch smoke))"' -a dogtag`.
- After an MXRoute email (for example a password reset to the owner), check it appears in `sent_emails`.
- Watch memory: `heroku logs -d worker | grep memory_total` should level off around 340 MB.

### 8. Race XXII (admin UI)
Create the race with these settings:
- Time zone America/Chicago.
- Dates and prices from the launch checklist: the deposit tier starts at the same moment as tier 1.
- The 22nd-year experience label.
- `chiditarod_22.json` from dogtag-private.
- The **real** XXII Classy campaign id and default goal. On staging, test campaign 867400 is used.

### 9. Live test (OWNER, production Stripe)
1. Register a real team on a test race with a low-price tier.
2. Confirm finalization, the Classy fundraising team, and `rake "emails:verify[<team_id>]"`.
3. Refund the charge in admin.
4. Delete the Classy team and the test race.

### 10. Registration opens Dec 15 00:00 Central
Watch Rollbar, Stripe and the first registrations that morning.

## Rollback

| Problem | Action |
|---------|--------|
| New pages misbehave | `heroku config:set REGISTRATION_UI=legacy -a dogtag` |
| Bad deploy | `heroku rollback -a dogtag` |
| Bad data or migration | `heroku maintenance:on`, then restore the step 5 backup with `heroku pg:backups:restore <id> DATABASE_URL -a dogtag` |
| Worker memory kills (R14/R15) | Check `MALLOC_ARENA_MAX=2` is set. See CLAUDE.md, Known Quirks 8 |
