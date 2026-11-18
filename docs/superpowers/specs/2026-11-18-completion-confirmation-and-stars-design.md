# Completion confirmation (#296) and four labeled stars (#297)

Date: 2026-11-18. Issues: chiditarod/dogtag#296, #297 (context: #311).

## Why

In the Nov 2026 walkthrough of `/register`, the tester finished registering and asked "am I done?" "You're in!" said nothing about what comes next, the four progress stars were unexplained (three were described as "registered", the fourth as "fully registered"), and the fundraising link sat at the bottom of the page. Success: a captain who finishes knows, without asking, that they are fully registered, what their team number is, and what to do next, and every page and email they see says it the same way.

## Goals

1. A per-race, admin-editable **confirmation text**, written in Markdown, shown in three places: a one-time completion modal, the "Registration Confirmed" email, and the team page header.
2. A completion modal that shows exactly once per team, to the captain, the first time they see the team finalized, whichever way it got finalized.
3. Four labeled stars: **team created, racers, questions, fee**. All four filled = fully registered (finalized).
4. Fundraising status and link near the top of the team page, only when the race has a Classy campaign.
5. Racers card collapses to names once the team is finalized.

## Non-goals

- #311 (fundraising terms-of-service guidance). The modal and card only get a placeholder spot for its link; nothing links anywhere yet.
- A separate "Start Here" guide URL field. Admins put the link in the confirmation text.
- A live Markdown preview in the admin form.
- The blurry logo (mentioned in #296). Needs a sharper asset (SVG or @2x) from the owner; separate change.
- Legacy HAML team page changes beyond what the email needs. The legacy flow must keep working, but it does not get the modal.

## Anti-goals

- Fundraising must never be a star or a requirement: some races have no fundraising.
- The modal must not appear for teams finalized before this ships, and must not appear to staff viewing someone else's team.
- No raw HTML from the admin text reaches a page or email.

## Constraints

- Gemfile change (adding `commonmarker`) needs owner sign-off (given in brainstorming) and a PR-body callout.
- Migration: `text`/`datetime` columns only, created with `bin/rails g migration`. Heroku has no release phase: migrate on `dogtag-staging` right after the push, then `heroku restart`; the PR body says so.
- API controllers stay thin; finalization still flows through `Team#finalize` / `Workers::TeamFinalizer` / `UserMailer`.
- Error JSON shape `{ error, errors }`; CSRF header on mutations; CanCanCan `Ability` for authorization.
- SPA: Bulletproof React feature folders, copy in `frontend/src/locales/en.ts`, mobile-first at 320px, Chicago Flag tokens.
- Stacked on #312 (`feature/299-unique-team-email`); does not need #314's flag. Expect small conflicts with #313 (`field.tsx`) and #315 (`fee-card.tsx`).

## Approaches considered

**Markdown rendering** (owner picked A):
- A. `commonmarker` gem; Rails renders sanitized HTML once; the email uses it and the API sends the HTML to the SPA. One renderer, identical output everywhere. Chosen.
- B. `commonmarker` for email plus `react-markdown` in the SPA. Two renderers that can disagree.
- C. Hand-rolled subset (paragraphs, bold, italic, links). No dependency, but limited and ours to maintain.

**When the modal shows** (owner picked 3):
1. Client-side, when `finalized` flips false → true on screen. Smallest, but misses admin/legacy finalization, reloads mid-payment and other devices.
2. localStorage per browser. Survives reload but per device, and would fire for every already-finalized team after deploy.
3. Server-side `teams.confirmation_seen_at`. Exactly once per team across devices; migration backfills existing finalized teams. Chosen as the safest and most reliable.

**Stars**: the issue's earlier decision was three stars; the owner revised it to four with the first earned by creating the team (issue #297 Decision section updated).

## Design (decided)

### Data
- `races.confirmation_text` (`text`, nullable): Markdown source.
- `teams.confirmation_seen_at` (`datetime`, nullable). Migration backfills `confirmation_seen_at = now` for teams where `finalized` is true.
- Unfinalize/refinalize does not clear `confirmation_seen_at`: the modal is a one-time moment; the email still goes out again.
- **Seeding (owner decision):** the migration (or a data step in it) fills `confirmation_text` for races that have not run yet (`race_datetime` in the future) with a Markdown version of today's hardcoded email paragraphs (fundraising at chiditarod.org/fundraising, the incentives link, "read chiditarod.org"), so nothing regresses until an admin edits it. Past races stay blank. Blank text still means "omit the block" everywhere.

### Rendering
- `commonmarker` gem. A single helper/service (e.g. `ConfirmationText.to_html(source)`) renders CommonMark with raw HTML escaped (commonmarker's default safe mode), then passes it through Rails `sanitize` with an allowlist (p, br, strong, em, a[href], ul, ol, li, h3/h4 at most, code). Links open normally; `href` limited to http(s)/mailto. Blank source → nil.
- `Race#confirmation_html` (or the service) is the only producer of HTML.

### Admin
- Race form (`app/views/races/_form.html.haml`): textarea "Confirmation text" with help "Markdown. Shown to captains when their team is fully registered: in a pop-up, in the confirmation email and on the team page." Permit `:confirmation_text` in `RacesController` race params. Admin-only, untranslated.

### API
- Team checklist (`TeamChecklist#to_h`) gains:
  - `confirmation_html` (string or null): rendered race text.
  - `show_confirmation` (bool): `finalized && confirmation_seen_at.nil? && viewer is the team's owner`. TeamChecklist needs the current user for this (pass it in, or compute in the jbuilder).
- `POST /api/v1/teams/:id/confirmation_seen` (name is builder's call): owner only (staff get 403 or a no-op; must not set the column), sets `confirmation_seen_at` if nil, idempotent, returns the team JSON (or 204). CSRF required.
- Types in `frontend/src/types/api.ts` updated.

### Email (`team_finalized_email` html + text)
- Keeps: race and team name, **team number** (new), racers, edit link and deadline, help address `dogtag@chiditarod.org`.
- Replaces the hardcoded fundraising/website paragraphs with the race's confirmation text (HTML part: rendered HTML; text part: the Markdown source as-is).
- Only when the race has `classy_campaign_id`, adds one fundraising line: a link to the team's page when `team.classy_id` is present (e.g. on a refinalize, where `ClassyCreateFundraisingTeam` is a no-op), otherwise "Your fundraising page is being set up; watch for a separate email." (builder-check answer, my call)
- Blank confirmation text → the block is omitted.

### SPA
**Stars** (`features/teams/utils.ts`, `flag-progress.tsx`):
- `stepStates(team)` returns `[teamCreated (always true), racers, questions (done when not required), fee]`. `checklist.finalized` is no longer a star; it is the outcome.
- `FlagProgress` gets visible labels under the stars: "Team · Racers · Questions · Fee" (in `en.ts`), still one `progressbar` with max 4. The salute plays when the fourth star lands.
- **Finalized = four stars (owner decision):** when `checklist.finalized` is true, `stepStates` returns all four true regardless of step states, so the flag never disagrees with "You're fully registered!". The cards below keep their own per-step status (an admin adding questions after finalization still shows that card as to-do).

**Header** (`team-header.tsx`), when finalized:
- "You're fully registered! Team #N" (replaces "You're in!").
- One line: fundraising page link ("Open your fundraising page ↗") or "Your fundraising page is being set up…", only when `classy_expected`.
- The confirmation text (rendered HTML, styled prose), shown at every width (my call: the "What's left" list is `lg`-only, but phones are the main audience). On desktop it takes the "What's left" slot; below `lg` it sits under the flag.

**Completion modal** (new, e.g. `features/teams/components/completion-dialog.tsx`, built on `DialogSheet`):
- Opens when `checklist.show_confirmation` is true (on load or right after a mutation returns it). Content: heading "You're fully registered!", team number and name, confirmation text, fundraising status line (Classy races only), "You can edit your team until {registration close}", "Problems? Email dogtag@chiditarod.org", a placeholder slot for the #311 link (not rendered until #311 exists), and a "Got it" button.
- Closing (button, Escape, backdrop) calls the confirmation-seen endpoint once and updates the cache. If the call fails, the modal still closes; it shows again next visit.
- The guided tour must not open at the same time (tour already only auto-starts for unfinalized teams; confirm no overlap when finalization happens mid-tour: the tour should end first, or the modal waits until the tour ends; builder's call).

**"You're in" card** (`youre-in-card.tsx`), slimmed: when finalized, shows team number, fundraising status/link (Classy races) and the #311 placeholder; drops anything that the header now carries. Locked state unchanged.

**Racers card**: once finalized, collapses to a one-line list of names with a chevron button (`aria-expanded`) to expand to the full roster.

**Tour** (`stops.ts`, `en.ts`):
- `tour.flag.title`: "Four stars to the start line"
- `tour.flag.body`: "You earned the first star by creating your team. Add racers, answer the questions and pay the fee to fill the rest. Four stars and you're fully registered."
- `tour.in` copy updated so it no longer says "first three stars" (e.g. "When all four stars are solid red, you're fully registered and get your team number.").

### Tests
- RSpec: Markdown helper (rendering, raw HTML escaped, javascript: links stripped, blank → nil); migration backfill behavior via model/request spec as practical; checklist fields (`show_confirmation` true only for owner, finalized, unseen); confirmation-seen endpoint (owner sets it, idempotent, staff cannot set it, other users 403/404); race admin update permits the field; mailer includes team number and confirmation HTML, omits fundraising line without a campaign.
- Vitest: stepStates mapping; FlagProgress labels and salute on fourth star; header finished state; modal opens on `show_confirmation`, posts once on close, does not open for staff/seen; YoureInCard slimmed; racers collapse/expand; tour copy.
- Playwright SPA suite: update any assertions on "You're in!" / star counts.

### Docs
- CLAUDE.md: fix the "Internationalization" `_md` claim (no markdown initializer exists) or leave it and note the new helper; document `confirmation_text`, `confirmation_seen_at`, the four-star mapping, the modal rule.
- README: note the new race field if admin setup is documented there.

## Left to the builder
- Exact names of the helper, endpoint and components.
- Sanitizer allowlist details within the stated bounds.
- How TeamChecklist learns the current user.
- Tour/modal overlap handling.
- Visual styling of star labels and the collapsed racers row, within the design tokens.
