# Registration SPA: Crew Picker and Team Page Polish: Design

**Date:** 2026-11-16
**Status:** Approved by the owner, 2026-11-16
**Branch:** `feat/register-crew-picker` (from `main`)

## Intent

The `/register` SPA works, but the team page is harder to use than it should be. The owner's words: "I want it to purr with ease of use", on phones and on desktop.

The named pain is the roster. Every empty slot repeats the same three past-racer chips plus a "+15 more" chip, so a team with five open spots shows that row five times. Picking a chip opens a pre-filled form, one person at a time.

Registration for CHIditarod XXII opens Dec 1, 2026. The work is in the SPA, with one small server change: racers are asked for Instagram instead of Twitter (section 8).

## Goals

- One clean way to bring back people from past teams, in place of the repeated chips and "+N more".
- A captain must confirm every detail of a past racer before that person is saved (owner requirement).
- The team page reads at a glance: what is done, what is left, what to do next.
- The team page uses the width of a desktop screen and still works at 320px with no horizontal scroll.
- Adding several brand-new people in a row flows from one to the next.
- Racers give an Instagram handle instead of a Twitter one, in both the SPA and the legacy flow (owner requirement).

## Non-goals

- No server change beyond the Instagram field in section 8. No change to the Gemfile, initializers or config.
- No change to the legacy HAML flow beyond that one field.
- The yearly JSONForm payload is not touched. `chiditarod_21.json` and `chiditarod_22.json` in `../dogtag-private/jsonform/` already ask "Got Instagram?" for the team. The old `teams.twitter` column is left alone.
- No redesign of login, signup, forgot password, the race list, the create-team form, the questions renderer or the payment logic. They keep today's look.
- No new colors or fonts. The Chicago Flag tokens and Oswald/Inter stay.

## Anti-goals

- A past racer's details saved without the captain confirming each one.
- A picker that is as noisy as what it replaces (rows of chips, overflow counters).
- Decoration that says nothing. Every mark on the page carries state.

## Constraints

- **Tokens:** page `#f4f8fb`, flag `#b3ddf2`, star `#e4002b`, starText `#c4001f`, navy `#12202f`, link `#2f5aae`, cards `#ffffff`. Oswald for headings, Inter for body.
- **Structure:** Bulletproof React feature folders, `@` alias, all copy through `t()` in `frontend/src/locales/en.ts`.
- **Touch targets:** at least 44px (`min-h-11`), as today.
- **Accessibility:** state is never shown by color alone. Keyboard focus is visible. `prefers-reduced-motion` turns motion off.
- **Other work in flight:** a second agent in `../dogtag` (`test/e2e-staging-design`) is writing e2e tests that register through `/register` and fill five roster slots. These strings stay exactly as they are so that work keeps matching:
  - button `+ Add someone new`
  - form name `Add a racer`
  - field labels `First name`, `Last name`, `Email`, `Phone`, `ZIP code`, `Years racing`
  - button `Save`
  - group names `Racers`, `Team questions`, `Registration fee`, `You're in!`
  - the `{filled} of {total}` pill
- **Shared resources:** `dogtag_test` is shared between checkouts and `test_seeds:cleanup` sweeps every `@example.com` user. Do not run the Playwright suite or that cleanup without the owner's go-ahead. Use a port other than 3099 for manual browser checks. The Instagram migration adds a column to that shared database, so other checkouts will see `instagram` appear in their `schema.rb` dumps until this merges.

## Approaches

How a past racer's details get reviewed before saving:

1. **Check-off list (chosen by the owner).** Each detail is a line. Tapping a line confirms it; "Change" edits it. The add button unlocks when every line is confirmed. No phone keyboard unless something needs changing. About seven taps per person.
2. **Pre-filled form where visiting a field marks it.** Least new code. On a phone every tap opens the keyboard, and tabbing through marks fields as reviewed without anyone reading them.
3. **One confirmation per person** (checkbox or popup). Two taps, but the easiest to click through, and it does not meet the "each field" requirement.

The owner picked 1. Saving past racers straight from the picker with no review was proposed first and rejected.

## Design

### 1. Roster card

The card keeps its title `Racers`, its `{filled} of {total}` pill and its `Racer slots` list.

- **Filled rows** stay as they are today: initials, name, Captain pill, email, phone, ZIP, years label, Edit and Remove.
- **Open spots** collapse into one row, however many there are: one dashed circle per open spot, then "3 spots to fill" ("1 spot to fill"). When the race is closed the row reads "3 open spots" and nothing else is offered.
- **Actions** sit under that row, once, while the race is open and a spot is free:
  - `Pick from past teams (18)`: shown only when the captain has past racers who are not already on this team. The number is that count. This is the primary action when shown.
  - `+ Add someone new`: opens the blank `Add a racer` form inline, as today.
  - `Add yourself`: shown only when nobody on the team has the captain's email. See below.
- `PastRacerChips` and the "+N more" chip are deleted. `PastRacerList` is replaced by the crew picker.

```
 Racers                          2 of 5
 DB  Devin Breen   Captain       Edit
     devin@…  (312) 555-0100
 DL  Dee Lamb                    Edit  Remove
     dee@…    (312) 555-0144
 ○ ○ ○  3 spots to fill
 [ Pick from past teams (18) ]
 [ + Add someone new ]
```

### 2. Crew picker

One dialog with two steps. It is a bottom sheet on phones (at most 90% of the viewport height, scrolling body, footer pinned) and a centered dialog from `sm` up. It keeps today's dialog behavior: focus trap, Escape closes, focus returns to the button that opened it.

**Step 1, pick.** Title "Pick from past teams".

- A search box appears when there are more than six past racers. It matches name and email.
- Each past racer is one checkbox row: name, then a second line with the year and team they last raced with ("2025, Cart Pushers"). Order is the API's order (most recent first).
- The captain can tick at most as many people as there are open spots. At the cap, unticked rows are disabled and the footer says "All 3 spots picked".
- Footer button: "Review 2 racers" ("Review 1 racer"), disabled with nothing ticked. Beside it: "1 spot left".

**Step 2, review.** One person at a time, in the order ticked. Title "Review Ada Racer", a counter "1 of 2", and "Last raced 2025 with Cart Pushers".

```
 Review Ada Racer                    1 of 2
 Last raced 2025 with Cart Pushers

 ✓ Name          Ada Racer           Change
 ✓ Email         ada@example.com     Change
 ○ Phone         (312) 555-0100      Change
 ○ ZIP           60614               Change
 ○ Years racing  Raced twice         Change
                 was "Raced once before" last time
 ○ Instagram     None                Change

 [ Add Ada to the team ]      Skip Ada
```

- Six lines: Name (first and last together), Email, Phone, ZIP code, Years racing, Instagram.
- Each line is a checkbox. Unconfirmed lines have a flag-blue tint and an empty circle; confirmed lines are white with a tick. Screen readers hear the label, the value and the checked state.
- **Change** turns that one line into its input (the existing `EmailInput`, `PhoneInput`, `ZipInput`, the years select, or two text inputs for the name) with a `Done` button. Pressing Done keeps the new value and marks the line confirmed.
- **Missing values:** a required detail that is blank opens in its input straight away and cannot be confirmed until filled. A blank Instagram shows "None" and can be confirmed.
- **Years racing** is pre-set to last time's value plus one, capped at the race's last label (today's rule). When that changed the value, the line says what it was. A past racer with no value starts in the select.
- **Add Ada to the team** is disabled until all six lines are confirmed. A line under it says how many are left ("3 details left to confirm").
- Pressing it saves the person with the existing `useAddPerson` mutation, then moves to the next person, or closes the dialog after the last.
- **Server errors:** field errors reopen the matching lines in their inputs with the message and mark them unconfirmed. Other errors (for example the team is full) show as an alert in the dialog. A 403 closes the dialog and shows the page banner, as today.
- **Skip Ada** moves on without saving. **Back** returns to step 1 with the remaining ticks kept.
- Closing the dialog keeps the people already added and drops the rest. Nothing is stored for unconfirmed picks.

### 3. Add yourself

Shown when no one on the team has the captain's email, a spot is free and the race is open.

- If the captain is among their own past racers, it opens the review step for that one record.
- Otherwise it opens the `Add a racer` form with first name, last name, email and phone filled from the account. The captain fills in the rest and presses Save.

### 4. Adding several new people in a row

No new button. After a new person is saved and a spot is still open, focus lands on `+ Add someone new`, so Enter (or one tap) starts the next person. Keep that behavior if it is already there; add it if it is not.

A `Save and add another` button was considered and dropped (builder's call, not the owner's): Playwright matches button names by substring, so a second button containing "Save" would break `getByRole('button', { name: 'Save' })` in the existing specs and in the e2e tests being written in `../dogtag`.

### 5. The flag is the progress bar

The four steps on the team page (racers, questions, fee, you're in) map onto the four stars of the Chicago flag. A new `FlagProgress` component replaces `ProgressSegments` in the team header: two flag-blue bars with four six-pointed stars between them.

- A star is solid red when its step is done and an outline when it is not. Stars map to steps by position. Questions count as done when the race has none (today's rule), so the flag always has four stars.
- It keeps the `progressbar` role, label and values that `ProgressSegments` has now.
- Each step heading carries the same star in place of the numbered circle: outline while to do, solid red when done. The pill and the screen-reader ", done" / ", to do" text stay.
- **Motion:** a star scales in once when its step becomes done. When the team is finalized, the four stars pulse once in order. That is the only motion on the page that the user did not trigger, and it is off under `prefers-reduced-motion`.

This is the one bold element. Everything around it stays plain.

### 6. Team page layout

- **Below `lg`:** one column, as today.
- **From `lg`:** two columns in a wider container (about `max-w-5xl`). The left rail (about 20rem, sticky) holds the team header: name, race, date, deadline, the flag, the "N things left" line, a short "What's left" list that links to each unfinished step, and "Edit team details". The steps fill the right column.
- Only the team page goes wide. Every other route keeps `max-w-xl`.

### 7. Finished steps start collapsed

Only the Racers step changes here (builder's call):

- **Racers:** when the roster is already full as the page loads, the step starts as a one-line summary ("5 of 5" and the first names) with a `Show racers` button that opens the full list. A roster filled during the visit stays open, so nothing disappears under the user's hands. The collapse is local to the roster; there is no generic collapsible.
- **Team questions** and **Registration fee** are untouched. They already shrink to a summary when done ("4 of 4 questions answered" with `Edit answers`; "Paid $218 total"), and existing tests depend on exactly that.
- **You're in!**, while locked, becomes one quiet line ("Finish the steps above to lock in your spot.") instead of a full card. The group name and the finalized state stay as today.

### 8. Instagram replaces Twitter for racers

The owner chose a real Instagram field over relabelling the old one.

- **Database:** a new nullable `instagram` text column on `people`, added with a generated migration. The `people.twitter` column stays, with its data untouched, and is no longer read or written by any screen.
- **Model:** `Person` validates `instagram` when present: an `@` followed by 1 to 30 letters, numbers, periods or underscores. Before validation the value is trimmed, lowercased and given a leading `@` if it lacks one, so `Sam.Okafor` and `@sam.okafor` both save as `@sam.okafor`. The `twitter` validation is removed along with the field.
- **API:** `instagram` replaces `twitter` in the permitted person attributes, the person JSON and the past-racers JSON.
- **SPA:** the form field is `Instagram (optional)` with the placeholder `@handle`. Types, drafts, payloads, fixtures and the filled row use `instagram`.
- **Past racers:** nobody has an Instagram handle on file yet, so this year every past racer's Instagram line reads "None". Old Twitter handles are never shown as Instagram. From next year the saved handle carries over like any other detail.
- **Legacy flow:** the people form asks for Instagram in place of Twitter, the legacy controller permits `instagram`, and the people table shows an Instagram column in place of Twitter.
- **Export:** `Team.export` lists `instagram` in place of `twitter` for each racer.
- **Test fixture:** `spec/fixtures/files/valid_jsonform.json` is the one place a team-level "Got Twitter?" question remains. It gets the "Got Instagram?" wording and key from `chiditarod_22.json`, so no Twitter question is left anywhere the new flow can render.

## Testing

- **Vitest:** rewrite `roster-card.test.tsx` around the picker and review (cap at open spots, search, confirm-all gate, Change, missing value, bumped years note, server field error, skip, back, close midway, focus return). Add tests for `FlagProgress`, the full-roster-collapsed-on-load rule, Add yourself, and focus landing on `+ Add someone new` after a save. Update `team-checklist.test.tsx` where headings or progress markup change.
- **RSpec:** the `Person` model (handle rule and normalizing), the people and past-racers request specs (JSON shape), and the `Team.export` header spec.
- **Playwright:** rewrite `tests/spa/past-racers.spec.ts` for the new picker and review. `full-registration.spec.ts` should pass unchanged; if it needs a change, say why in the PR.
- **By eye:** screenshots of the team page and the picker at 320px, 390px and 1280px.

## Left to the builder

- Component and file names inside `features/roster` and `features/teams`.
- Exact wording of new strings beyond those quoted here.
- How the layout learns that the team route is wide (a route `handle` is the obvious way).
- The star's SVG geometry and the exact timing of the two animations.
- Whether the review lines are built on native checkboxes or `role="checkbox"` buttons.
