# Team picker for "race alongside other teams" (#302)

Status: draft for owner approval.

## Intent

Captains currently answer "Did you want to race alongside any other teams or people? Who?" as free text (`buddies` in the race JSONForm). Staff re-key those answers into Cartographer by hand. Make it a first-class field so Cartographer reads it straight from the Dogtag database.

## Goals

- A captain picks other teams in the same race from a list, and can add free-text names for teams that are not registered.
- Each listed team is labelled **Fully registered** (finalized) or **Still registering**, so captains know which teams are committed.
- Picks live in tables Cartographer can query directly (Cartographer reads the Dogtag database; no API needed).
- Picks appear in the admin CSV export.

## Non-goals / anti-goals

- No notification to the picked team, no mutual-match logic, no approval step.
- Never expose anything but team name, id and status to other captains (no racers, emails, captain identity).
- Not required for finalization; it never blocks a team.
- No migration of old `buddies` free text into picks (old answers stay in `Team#jsonform`).

## Constraints

- Team names are unique per race (`validates :name, uniqueness: { scope: :race }`).
- Today `GET /api/v1/teams` only returns the caller's own teams, and the Ability limits `:show` to the owner; a new narrowly scoped endpoint and ability are needed.
- Migrations: `text` for strings, nullable booleans, created with `bin/rails g migration`.
- Questions are saved through `PUT /api/v1/teams/:id/questions` today, which keeps only JSONForm schema keys, so picks need their own save path.

## Approaches considered

1. **Join table `team_buddies` + `teams.other_buddies` text (chosen).** Real foreign keys, queryable by Cartographer, survives renames, cleaned up when a team is deleted.
2. JSON array of team ids on `teams` (or inside `Team#jsonform`). Least code, but no foreign keys, dangling ids after a delete, awkward SQL for Cartographer.
3. Keep names as free text and only add autocomplete. Does not fix the hand-keying, because names can still drift from real teams.

The owner chose that Cartographer reads the database, which settles approach 1.

## Design

**Data**
- `team_buddies`: `team_id`, `buddy_team_id` (both FKs to `teams`, `on_delete: :cascade`), timestamps, unique index on the pair. Validation: both teams in the same race, a team cannot pick itself.
- `teams.other_buddies` (`text`, nullable): free-text names that are not registered teams.
- `Team has_many :team_buddies, dependent: :destroy` and `has_many :buddies, through:`.
- Picks are directional (A names B). Cartographer can union both directions.
- How a pick is stored: one `team_buddies` row per pick (`team_id` = the team choosing, `buddy_team_id` = the team named). Cartographer reads it with `team_buddies JOIN teams ON teams.id = buddy_team_id`. "Other" names are not rows; they are the text in `teams.other_buddies`.

**API**
- `GET /api/v1/teams/:team_id/buddy_options`: other teams in the same race as `{ id, name, finalized }`, sorted by name, excluding the caller's own team. Allowed for whoever can `:edit` the team. Status is computed at request time, so it is current.
- Picks are read and written with the team's questions: `GET/PUT /api/v1/teams/:team_id/questions` gain `buddy_team_ids` and `other_buddies`. Ids from another race, or the team's own id, are rejected with the standard `{ error, errors }` shape. Saving replaces the full set.
- Same edit rules as questions (`authorize_update!`, registration open).

**SPA**
- First field in the Questions card (`frontend/src/features/questions/`): a searchable multi-select of teams, each option tagged "Fully registered" or "Still registering". Teams are listed alphabetically by name, case-insensitive (the API sorts them; the SPA keeps that order), and a leading "The" is not moved (unlike the CSV export). The last option in the list, after the alphabetical teams, is **Other…**; selecting it reveals a free-text input ("Which other teams or people?") that is saved to `teams.other_buddies`. Deselecting Other… hides the input and clears `other_buddies` on save. If `other_buddies` already has text, the form opens with Other… selected. Optional; no effect on `questions.required` or the checklist.
- Copy in `frontend/src/locales/en.ts`. Works at 320px.

**Form text**
- Remove the `buddies` property from `../dogtag-private/jsonform/chiditarod_22.json` (part of the #304 text the owner is already reviewing). Keep `collaborating`. Remove `buddies` from the three in-repo fixtures only if they are not also used to test legacy answers.

**Admin / export**
- `Team.export` gains a `Racing with` column (picked team names, then `other_buddies`, joined with `; `).
- The legacy admin team page shows the same line. Admin is untranslated.

**Tests**
- Model: same-race and self-pick validations. Request specs: buddy_options (scope, fields, auth, only own race), save and replace, rejection of foreign ids. Query-count spec for buddy_options. Vitest for the picker and Playwright SPA spec updated for the Questions card (Playwright is not run unless stated in the PR).

## Left to the builder

Exact picker widget (reuse the crew picker's dialog and focus-trap patterns if a dialog fits better than inline), empty state text when no other teams exist yet, and CSV column placement.

## Open items for the owner

- Whether Cartographer needs a mirrored (A or B) view; directional storage is assumed.
- Wording for the field label and the two status tags.
