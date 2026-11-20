# Race list ordering on /register (design)

Size: small change.

## Intent

On the `/register` race list, a racer should see races they can act on first. Today the API sorts every current race by race date, so a race whose registration is over can sit above an open one.

## Goals

- Order the list: (1) open races, then waitlist races; (2) races whose registration is over but whose race date is still ahead; (3) races not yet open for registration.
- Inside each group, sort by soonest race date. Group 3 sorts by soonest registration opening date. Ties break on `id`.
- One server-side definition of which group a race is in, used by both the sort and the SPA badges.
- A logged-in racer sees their own teams on each race tile: a "Your teams" list (variant B, status chips, of the tile mockups) with one tappable row per team, each linking to the team page.

## Non-goals

- No section headings, dimming, or other changes to the existing cards. The list is reordered and gains the teams list only (the user chose this over headings).
- Teams do not affect the sort order. A race where the racer has a team is not pulled to the top.
- No change to which races are listed (`Race.current` stays), to the legacy HAML race list, or to `/races/:id`.
- No SQL ordering or pagination.

## Constraints

- Controllers stay thin; the grouping rule lives on `Race`.
- `GET /api/v1/races` must not add queries per race (`spec/requests/api/v1/query_count_spec.rb`). Sort in Ruby after `Race.preload_registration_data`, because `full?` reads the preloaded finalized-team count.
- `_race.json.jbuilder` is shared with the `/teams` payloads, so the new field appears there too.
- Specs run under Zonebie. Build spec dates relative to `Time.zone.now` with explicit zones.

## Approaches considered

1. Sort in the controller only; the client keeps deriving status. Smallest, but the group rule would live in two places and could drift.
2. **Chosen:** sort in the controller and expose `registration_status` (`open | waitlist | closed | not_yet_open`) from a new `Race` method that both the sort and the JSON use. One definition of the rule, and the SPA stops using the browser clock for "Opens <date>".
3. Sort in SQL with a `CASE` expression. More complex than a handful of races needs, and it would still need a status field for badges.

## Design

- `Race#registration_status` returns `:open` (open for registration, not full), `:waitlist` (open for registration, full), `:closed` (registration over), or `:not_yet_open`. It is built from the existing predicates.
- `RacesController#index` keeps the current query and preload, then sorts with `sort_by` on `[group rank, date key, id]`. The rank is open 0, waitlist 1, closed 2, not_yet_open 3. The date key is `race_datetime`, or `registration_open` for `not_yet_open`.
- `_race.json.jbuilder` adds `registration_status`. The existing booleans stay, since the Start button and the show page use them.
- Frontend: add `registration_status` to the `Race` type and to `buildRace` in `src/test/fixtures.ts`. `RaceStatus` in `race-list.tsx` reads the field instead of `open_for_registration`, `full` and `Date.now()`. Badges and copy are unchanged. The list renders in server order.

### Your teams (frontend only, no backend change)

- `GET /api/v1/teams` already returns the logged-in user's teams with race and checklist. The race list calls `useTeams` only when `useMe` has a user, and matches teams to races by `team.race.id`. Logged-out visitors see the list as before.
- Each tile with one or more matching teams shows a `Your teams` label and a row per team: the team name plus a chip. The chip reads `N things left` (amber) or `Finalized #N` (green), the same wording as My teams. The `teamStatus` helper moves out of `my-teams.tsx` into `features/teams/utils.ts` so both use it. Rows are links to `/teams/:id`, with a 44px minimum tap height.
- The panel shows for any race status, including closed ones, so a captain can always reach their team. Teams are ordered as the API returns them (newest first).
- Start button (my calls): when the racer has a team in an open race the button reads `Start another team` and is the ghost (outlined) style, since a second team is allowed. With no teams it stays the solid red `Start a team`. The button still shows only when `open_for_registration`.
- The teams request is non-blocking: while it loads or if it fails, the races render without the panel and no error is shown.
- New copy in `frontend/src/locales/en.ts`: `races.yourTeams` ("Your teams") and `races.startAnother` ("Start another team").

## Testing

- Request spec: a multi-group case (open, waitlist via `:full_race`, registration-over, not-yet-open) asserting the full order, group 3 by opening date, and `registration_status` values. Keep the existing date-order spec and the query-count spec.
- Model spec: `registration_status` for each state, including the boundary at `registration_close`.
- Vitest: `race-list.test.tsx` cases switch to the new field; one test that the list shows server order. New cases for the teams list: shown only on the matching race, chip wording, button label change, none when logged out, races still render if the teams request fails.
- Playwright: `tests/spa/race-list-order.spec.ts` (order, badges, and a logged-in captain's teams list versus the logged-out view) with its own `test_seeds:*` task (unique `TEST_UNIQUE_ID`, `@example.com` emails), added to `test_seeds:cleanup`.

## Left to the builder

- Naming of the seed task and the exact fixture dates.
- Whether `registration_status` returns a symbol or string internally.
- Updating CLAUDE.md learnings and checking README.md, per project conventions. The PR states whether the e2e spec was actually run.
