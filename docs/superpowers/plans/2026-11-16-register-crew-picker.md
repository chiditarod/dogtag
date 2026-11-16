# Crew Picker and Team Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the repeated past-racer chips with one crew picker that makes the captain confirm every detail, show progress as the Chicago flag, give the team page a desktop layout, and ask racers for Instagram instead of Twitter.

**Architecture:** Almost everything is in the SPA (`frontend/src/features/roster` and `features/teams`). The picker is a two-step dialog (pick, then review) that saves through the existing `useAddPerson` mutation. The only server change is a new `people.instagram` column that replaces `twitter` in the model, API, legacy views and export.

**Tech Stack:** Rails 8, RSpec; React 19, TypeScript, Tailwind 3, TanStack Query 5, Vitest + Testing Library + MSW; Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-register-crew-picker-design.md`. Read it before any task.

## Global Constraints

- Colors only from the Tailwind tokens: `page`, `flag`, `star`, `starText`, `navy`, `link`, white. Fonts `font-display` (Oswald) and `font-sans` (Inter). No new colors, no new fonts, no changes to `tailwind.config.js`.
- All SPA copy goes through `t()` in `frontend/src/locales/en.ts`. Use the `@` alias. Follow the `features/<name>/{api,components}` layout.
- Touch targets are at least `min-h-11`. State is never shown by color alone. Keyboard focus is visible. Motion is off under `prefers-reduced-motion` (`motion-reduce:` variants).
- Pages work at 320px wide with no horizontal scroll.
- These strings must not change: `+ Add someone new`, form name `Add a racer`, labels `First name`, `Last name`, `Email`, `Phone`, `ZIP code`, `Years racing`, button `Save`, group names `Racers`, `Team questions`, `Registration fee`, `You're in!`, pill `{filled} of {total}`. No other button in the `Add a racer` form may contain the word "Save".
- No changes to the Gemfile, `config/initializers`, `config/environments`, `config/application.rb` or `spec/spec_helper.rb`.
- Do not run Playwright or `rails test_seeds:cleanup`. Playwright's global setup runs that cleanup against the shared `dogtag_test` database, which another agent is using. Task 7 says what to do instead.
- Run suites one at a time: `bin/check rspec`, `bin/check frontend`. Never rspec and vitest together.
- Commit after each task with only that task's files. Messages end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. **Double tap on "Add {name} to the team":** one POST, not two. Pinned in Task 5.
2. **Roster fills up while the dialog is open** (another tab, or the last spot taken mid-review): the server's "team is full" error shows as an alert in the dialog and nothing crashes. Pinned in Task 5.
3. **Past racer with no usable years value** (null, or the race has fewer labels than last time): the Years racing line opens in its select and cannot be confirmed until one is chosen. Pinned in Task 5.
4. **Instagram typed as a URL, with capitals, or without the `@`:** capitals and a missing `@` are normalized; a URL is rejected with a readable message, never a 500. Pinned in Task 1.
5. **Long names and emails at 320px:** values wrap inside the review line and the roster row; the page does not scroll sideways. Pinned in Task 5 (class assertion) and checked by eye in Task 7.

---

### Task 1: Instagram on the server

**Files:**
- Create: `db/migrate/<timestamp>_add_instagram_to_people.rb` (via `bin/rails g migration AddInstagramToPeople instagram:text`)
- Modify: `db/schema.rb` (only the new column; revert any other diff), `app/models/person.rb`, `app/models/team.rb` (`export` person keys), `app/controllers/api/v1/people_controller.rb`, `app/controllers/people_controller.rb`, `app/views/api/v1/people/_person.json.jbuilder`, `app/views/api/v1/past_racers/index.json.jbuilder`, `app/views/people/_form.html.haml`, `app/views/people/_table.html.haml`, `config/locales/en.yml`, `spec/fixtures/files/valid_jsonform.json`
- Test: `spec/models/person_spec.rb`, `spec/models/team_spec.rb`, `spec/requests/api/v1/people_spec.rb`, `spec/requests/api/v1/past_racers_spec.rb`, `spec/requests/api/v1/teams_spec.rb`

**Interfaces:**
- Produces: person JSON and past-racer JSON carry `instagram` (string or null) and no `twitter`. `POST/PATCH /api/v1/teams/:id/people` accept `person[instagram]`.

- [ ] **Step 1: Write failing model specs** in `spec/models/person_spec.rb` (replace the twitter examples):

```ruby
describe "instagram" do
  it "saves a handle lowercased with a leading @" do
    expect(create(:person, instagram: " Sam.Okafor ").instagram).to eq("@sam.okafor")
    expect(create(:person, instagram: "@Cart_Pusher9").instagram).to eq("@cart_pusher9")
  end

  it "stores a blank handle as nil" do
    expect(create(:person, instagram: "  ").instagram).to be_nil
  end

  it "is invalid for a URL, spaces, or more than 30 characters" do
    ["https://instagram.com/sam", "sam okafor", "@#{'a' * 31}"].each do |handle|
      person = build(:person, instagram: handle)
      expect(person).not_to be_valid
      expect(person.errors[:instagram]).to eq(["should look like @handle (letters, numbers, periods and underscores)"])
    end
  end
end
```

- [ ] **Step 2: Update the request and export specs** so they expect `instagram` where they expect `twitter` today: the key lists in `people_spec.rb`, `past_racers_spec.rb` (the exact JSON shape) and `teams_spec.rb`, and the header in `team_spec.rb` (`"dawg_#{i}_instagram"`). Add to `people_spec.rb`: posting `instagram: "Sam.Okafor"` returns 201 with `"@sam.okafor"`; posting `instagram: "https://instagram.com/sam"` returns 422 with `errors["instagram"]` present.

- [ ] **Step 3: Run** `docker compose up -d db redis`, then `bundle exec rspec spec/models/person_spec.rb spec/requests/api/v1`. Expected: FAIL (unknown attribute `instagram`).

- [ ] **Step 4: Migration.** `bin/rails g migration AddInstagramToPeople instagram:text`, then `bin/rails db:migrate` and `RAILS_ENV=test bin/rails db:migrate`. `git diff db/schema.rb` must show only the `instagram` line and the version bump; revert anything else by hand.

- [ ] **Step 5: Model.** In `Person`: remove the `twitter` validation; add `before_validation :normalize_instagram` (strip, downcase, drop one leading `@`, re-add `@`; blank becomes `nil`) and

```ruby
validates :instagram, format: { with: /\A@[a-z0-9._]{1,30}\z/, allow_nil: true,
                                message: "should look like @handle (letters, numbers, periods and underscores)" }
```

- [ ] **Step 6: API, legacy views, export, fixture.**
  - Both people controllers permit `:instagram` in place of `:twitter`.
  - Both jbuilder views emit `instagram` in place of `twitter`.
  - `_form.html.haml`: the field becomes `:instagram` with label `t('.instagram')`; in `en.yml` the `people.form.twitter` line (the one beside `people.form.experience`) becomes `instagram: Got Instagram? Add your handle`. Leave the other `twitter:` key in `en.yml` alone.
  - `_table.html.haml`: header `t('instagram')`, cell `person.instagram`.
  - `Team.export`: `person_keys` lists `instagram` in place of `twitter`.
  - `valid_jsonform.json`: rename the `twitter` property and its entry in the form list to `instagram`, with the title and description copied from `../dogtag-private/jsonform/chiditarod_22.json` (the `instagram` property).

- [ ] **Step 7: Run** `bin/check rspec`. Expected: `ok rspec`, 0 failures. If a spec elsewhere relied on the fixture's `twitter` key, update it to `instagram`.

- [ ] **Step 8: Commit** `Racers give Instagram instead of Twitter (model, API, legacy flow, export)`.

---

### Task 2: Instagram in the SPA

**Files:**
- Modify: `frontend/src/types/api.ts`, `frontend/src/features/roster/api/use-past-racers.ts`, `frontend/src/features/roster/api/use-person-mutations.ts`, `frontend/src/features/roster/utils.ts`, `frontend/src/features/roster/components/person-form.tsx`, `frontend/src/features/roster/components/roster-slot.tsx`, `frontend/src/locales/en.ts`, `frontend/src/test/fixtures.ts`
- Test: `frontend/src/features/roster/components/person-form.test.tsx`, `frontend/src/features/roster/components/roster-card.test.tsx`

**Interfaces:**
- Produces: `Person.instagram: string | null`, `PastRacer.instagram: string | null`, `PersonPayload.instagram: string`, `PersonDraft.instagram: string`, `PERSON_FIELDS` contains `'instagram'`. Locale keys `'roster.instagram': 'Instagram (optional)'` and `'roster.instagramPlaceholder': '@handle'`. New helper in `utils.ts`:

```ts
/** Trims every field, lowercases the email, converts the phone to ddd-ddd-dddd. */
export function payloadFromDraft(draft: PersonDraft): PersonPayload
```

- [ ] **Step 1: Update the tests first.** In `person-form.test.tsx` and `roster-card.test.tsx` replace the `/Twitter/` label lookups with `'Instagram (optional)'` and every `twitter` fixture or payload key with `instagram`. Add to `person-form.test.tsx`: filling `Instagram (optional)` with `@sam.okafor` submits `instagram: '@sam.okafor'`, and the submitted object has no `twitter` key.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/roster`. Expected: FAIL.
- [ ] **Step 3: Rename** `twitter` to `instagram` in the files above. Remove the `roster.twitter*` keys. Move the payload-building body out of `PersonForm.handleSubmit` into `payloadFromDraft` and call it there.
- [ ] **Step 4: Run** `bin/check frontend`. Expected: `ok frontend` (tests and typecheck). `grep -ri twitter frontend/src` returns nothing outside `features/questions/__fixtures__`.
- [ ] **Step 5: Commit** `SPA: Instagram replaces Twitter on the racer form`.

---

### Task 3: The flag is the progress bar

**Files:**
- Create: `frontend/src/components/ui/chicago-star.tsx`, `frontend/src/features/teams/components/flag-progress.tsx`, `frontend/src/features/teams/components/flag-progress.test.tsx`
- Modify: `frontend/src/index.css`, `frontend/src/features/teams/utils.ts`, `frontend/src/features/teams/components/team-header.tsx`, `frontend/src/features/teams/components/checklist-card.tsx`, `frontend/src/features/teams/components/team-checklist.test.tsx`
- Delete: `frontend/src/components/ui/progress-segments.tsx` (if nothing else imports it)

**Interfaces:**
- Produces:

```ts
// chicago-star.tsx
/** Six-pointed Chicago star, one point up. Solid red when filled, red outline when not. */
export function ChicagoStar(props: { filled: boolean; className?: string }): JSX.Element

// teams/utils.ts — order: racers, questions (true when not required), fee (false while it opens later), finalized
export function stepStates(team: Team): [boolean, boolean, boolean, boolean]

// flag-progress.tsx
export function FlagProgress(props: { steps: [boolean, boolean, boolean, boolean]; label: string }): JSX.Element
```

- Star geometry (fixed by the owner's reference image): a 12-point polygon in a `0 0 24 24` viewBox centered on `12,12`, vertices every 30 degrees starting straight up, alternating radius 10 and 4.1. `aria-hidden`, `data-filled`. Filled: `fill-star stroke-star`. Outline: `fill-white stroke-star`. Stroke width 1.1, `strokeLinejoin="miter"`, `strokeMiterlimit={6}`.
- `FlagProgress` markup: `role="progressbar"` with `aria-label={label}`, `aria-valuemin=0`, `aria-valuemax=4`, `aria-valuenow=<count of true>`; a white box with a `flag` border holding a `flag`-colored bar, a centered row of four `ChicagoStar`, and a second bar. Stars are `h-9 w-9`, `lg:h-11 lg:w-11`.

- [ ] **Step 1: Write failing tests** in `flag-progress.test.tsx`:
  - `steps=[true, true, false, false]` gives a progressbar named by `label` with `aria-valuenow="2"`, and the four stars' `data-filled` values are `['true','true','false','false']` in order.
  - Re-rendering with `[true, true, true, false]` gives the third star the class `star-land` and no other star.
  - Re-rendering from `[true,true,true,false]` to all true puts `flag-salute` on the progressbar.
  - On first render no star has `star-land`.
- [ ] **Step 2: Update** `team-checklist.test.tsx`: wherever it reads the progress bar, keep asserting `aria-valuenow`; replace assertions on the numbered circles (`1`, `2`, `3`, `✓`, `🔒`) with `data-filled` on the star inside each card heading.
- [ ] **Step 3: Run** `npm --prefix frontend test -- --run src/features/teams`. Expected: FAIL.
- [ ] **Step 4: Implement.** `stepStates` replaces `completedSteps` in `team-header.tsx`. `FlagProgress` keeps the previous `steps` in a ref to decide which stars just landed. In `index.css` add `@keyframes star-land` (scale 0.4, then 1.25 at 60%, then 1; 450ms ease-out), `.star-land`, and `.flag-salute svg` using the same keyframes with `animation-delay: calc(var(--i) * 130ms)`; wrap both in `@media (prefers-reduced-motion: no-preference)`. `ChecklistCard` renders `<ChicagoStar filled={done} className="h-6 w-6" />` in place of the numbered circle; `number` stays as the prop that builds the heading id.
- [ ] **Step 5: Run** `bin/check frontend`. Expected: `ok frontend`.
- [ ] **Step 6: Commit** `SPA: Chicago flag stars show registration progress`.

---

### Task 4: Team page layout

**Files:**
- Modify: `frontend/src/app/router.tsx`, `frontend/src/components/layouts/register-layout.tsx`, `frontend/src/features/teams/components/team-checklist.tsx`, `frontend/src/features/teams/components/team-header.tsx`, `frontend/src/features/teams/components/checklist-card.tsx`, `frontend/src/features/teams/components/youre-in-card.tsx`, `frontend/src/locales/en.ts`
- Test: `frontend/src/features/teams/components/team-checklist.test.tsx`, `frontend/src/app/router.test.tsx`

**Interfaces:**
- Consumes: `stepStates`, `FlagProgress` (Task 3).
- Produces: `ChecklistCard` gains `anchor: string` and renders `<section id={anchor}>`; anchors are `step-racers`, `step-questions`, `step-fee`, `step-in`. Locale keys:
  - `'team.whatsLeft': "What's left"`
  - `'team.leftRacers_one': 'Add 1 racer'`, `'team.leftRacers_other': 'Add {count} racers'`
  - `'team.leftQuestions': 'Answer the team questions'`
  - `'team.leftFee': 'Pay the registration fee'`

- [ ] **Step 1: Write failing tests.**
  - `router.test.tsx`: on `/teams/9` the `<main>` has class `max-w-5xl`; on `/` it has `max-w-xl`.
  - `team-checklist.test.tsx`: with 2 of 5 racers and the fee unpaid, a list named `What's left` holds links `Add 3 racers` (href ending `#step-racers`) and `Pay the registration fee` (`#step-fee`); with a finalized team there is no such list. The locked `You're in!` group shows `Finish the steps above to lock in your spot.` and no `Locked` pill. The four groups are still named `Racers`, `Team questions`, `Registration fee`, `You're in!`.
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `router.tsx`: `handle: { wide: true }` on `/teams/:teamId`. `RegisterLayout` reads it with `useMatches()` and uses `max-w-5xl` for the header's inner div and `<main>` when wide, `max-w-xl` otherwise.
  - `team-checklist.tsx`: error banner on top; below it `lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-10`. Left: `TeamHeader` in `lg:sticky lg:top-6`. Right: the steps inside one `divide-y divide-flag rounded-lg border border-flag bg-white` wrapper.
  - `ChecklistCard`: a plain `<section role="group">` with `p-4 lg:p-6` (no `Card`, no shadow). When `locked`: muted title, no pill, children shown as one `text-sm text-navy/70` line.
  - `TeamHeader`: no card; order is flag, team name (`text-3xl lg:text-4xl font-bold`), race, date, deadline, a row with the "N things left" line and the `Edit team details` toggle, then the `What's left` list (`hidden lg:block`, links are plain `<a href="#step-…">`). The fee link is left out while the fee opens later.
- [ ] **Step 4: Run** `bin/check frontend`. Expected: `ok frontend`.
- [ ] **Step 5: Commit** `SPA: two-column team page with a what's-left rail`.

---

### Task 5: Crew picker dialog

**Files:**
- Create: `frontend/src/components/ui/dialog-sheet.tsx`, `frontend/src/features/roster/review.ts`, `frontend/src/features/roster/review.test.ts`, `frontend/src/features/roster/components/crew-picker.tsx`, `frontend/src/features/roster/components/crew-pick-list.tsx`, `frontend/src/features/roster/components/crew-review.tsx`, `frontend/src/features/roster/components/crew-picker.test.tsx`
- Modify: `frontend/src/locales/en.ts`

**Interfaces:**
- Consumes: `PastRacer`, `useAddPerson(teamId)`, `draftFromPastRacer`, `payloadFromDraft`, `splitPersonErrors`, `fullName`, the input components in `@/components/inputs`.
- Produces:

```ts
// components/ui/dialog-sheet.tsx — the shell lifted out of past-racer-list.tsx:
// portal, role="dialog" aria-modal, Tab trap, Escape calls onClose, focus returns to the opener on unmount.
// Bottom sheet below sm (max-h-[90dvh], rounded top), centered max-w-lg from sm.
export function DialogSheet(props: { labelledBy: string; onClose: () => void; children: ReactNode }): JSX.Element

// features/roster/review.ts
export type LineKey = 'name' | 'email' | 'phone' | 'zipcode' | 'experience' | 'instagram';
export const LINE_KEYS: readonly LineKey[];             // in that order
export interface LineState { confirmed: boolean; editing: boolean; error: string | null }
export type ReviewLines = Record<LineKey, LineState>;
export function isLineBlank(key: LineKey, draft: PersonDraft): boolean;   // instagram is never "blank" (optional)
export function initialLines(draft: PersonDraft): ReviewLines;            // blank required lines start editing with the missing message
export function lineValue(key: LineKey, draft: PersonDraft, race: Race): string; // name joined; experience label; instagram or "None"
export function experienceNote(racer: PastRacer, draft: PersonDraft, race: Race): string | null; // 'was "Raced once before" last time' when bumped
export function applyFieldErrors(lines: ReviewLines, fieldErrors: FieldErrors): ReviewLines; // first_name/last_name map to 'name'; hit lines become editing, unconfirmed, with the message
export function unconfirmedCount(lines: ReviewLines): number;

// features/roster/components/crew-picker.tsx
export function CrewPicker(props: {
  team: Team;
  racers: PastRacer[];          // past racers not on the team
  openSpots: number;
  reviewOnly?: PastRacer;       // skip the list and review this one person (Add yourself)
  onAdded: (person: Person) => void;
  onForbidden: (error: unknown) => void;   // 403: parent shows the page banner; the picker closes itself
  onClose: () => void;
}): JSX.Element
```

- Locale keys (exact copy):

```
'roster.pickFromPast': 'Pick from past teams ({count})',
'roster.pickTitle': 'Pick from past teams',
'roster.searchPlaceholder': 'Search {count} past racers',
'roster.lastRacedShort': '{year}, {team}',
'roster.reviewNone': 'Review racers',
'roster.reviewCount_one': 'Review 1 racer',
'roster.reviewCount_other': 'Review {count} racers',
'roster.spotsLeft_one': '1 spot left',
'roster.spotsLeft_other': '{count} spots left',
'roster.allPicked_one': 'The open spot is picked',
'roster.allPicked_other': 'All {count} spots picked',
'roster.reviewTitle': 'Review {name}',
'roster.reviewProgress': '{index} of {total}',
'roster.lastRacedWith': 'Last raced {year} with {team}',
'roster.name': 'Name',
'roster.instagramLine': 'Instagram',
'roster.none': 'None',
'roster.yearsWas': 'was "{label}" last time',
'roster.missing': '{label} is missing. Add it to continue.',
'roster.change': 'Change',
'roster.changeLabel': 'Change {label}',
'roster.done': 'Done',
'roster.addToTeam': 'Add {name} to the team',
'roster.skip': 'Skip {name}',
'roster.backToList': 'Back to list',
'roster.leftToConfirm_one': '1 detail left to confirm. Tap each line once you have checked it.',
'roster.leftToConfirm_other': '{count} details left to confirm. Tap each line once you have checked it.',
'roster.allConfirmed': 'All six details confirmed.',
```

- Behavior the tests below do not spell out: the search box shows only when `racers.length > 6`; list order is the order of `racers`; the review queue is a snapshot taken when "Review N racers" is pressed, in tick order; `{name}` in `addToTeam` and `skip` is the first name; line labels reuse `roster.email`, `roster.phone`, `roster.zip`, `roster.years`; each line is a `role="checkbox"` button whose accessible name is `"{label}: {value}"`; unconfirmed lines are `bg-flag/30` with an empty circle, confirmed lines white with a tick; values use `break-words`.

- [ ] **Step 1: Write failing unit tests** in `review.test.ts` (race labels `['This is our first','Raced once before','Twice']`):
  - `initialLines` for a complete draft: all six lines `{confirmed:false, editing:false, error:null}`.
  - A draft with `phone: ''` gives `phone` `{editing:true, error:'Phone is missing. Add it to continue.'}`; a draft with `instagram: ''` leaves `instagram` not editing, and `lineValue('instagram', …)` is `'None'`.
  - A draft with `experience: ''` gives `experience.editing === true`.
  - `experienceNote` for a racer with `experience: 0` whose draft says `'1'` is `'was "This is our first" last time'`; for a racer already at the last label (`2`, draft `'2'`) it is `null`.
  - `applyFieldErrors(lines, { first_name: ["can't be blank"], email: ['is invalid'] })` sets `name` and `email` to editing, unconfirmed, with those messages, and leaves the rest.
- [ ] **Step 2: Write failing component tests** in `crew-picker.test.tsx`. MSW handles `POST /api/v1/teams/9/people`. Fixtures (all `last_raced_year: 2025`, `last_team_name: 'Cart Pushers'`, `instagram: null`): `ada` = Ada Lovelace, `ada@example.com`, phone `312-555-0111`, zipcode `60614`, experience `0`; `grace` = Grace Hopper, `grace@example.com`, phone `312-555-0112`, zipcode `60647`, experience `1`; `edsger` = Edsger Dijkstra, `edsger@example.com`, `phone: null`, zipcode `60622`, experience `0`; plus a `racer(n)` helper to reach 8. The race is `buildRace()` (5 per team, labels `['This is our first','Raced once before','Twice']`):
  - **Cap:** with `openSpots=2`, ticking two rows disables the other checkboxes, shows `All 2 spots picked`, and the button reads `Review 2 racers`. Unticking one shows `1 spot left`.
  - **Search:** with 8 racers the searchbox `Search past racers` is present; typing `gra` leaves one row; typing `zzz` shows `No past racers match.` With 6 racers there is no searchbox.
  - **Gate:** after `Review 1 racer` for Ada, the heading is `Review Ada Lovelace`, `Add Ada to the team` is disabled, and the hint reads `6 details left to confirm. Tap each line once you have checked it.` Clicking all six checkboxes enables the button and shows `All six details confirmed.`
  - **Change:** `Change email` shows a textbox `Email`; typing a new address and pressing `Done` shows the line checked with the new value.
  - **Missing value:** reviewing Edsger shows a `Phone` textbox with `Phone is missing. Add it to continue.`; pressing `Done` while empty keeps the message; entering `3125550113` and `Done` shows `(312) 555-0113` checked.
  - **Years note:** Ada (`experience: 0`) shows `was "This is our first" last time` on the Years racing line.
  - **Save and advance:** confirming all and pressing add POSTs `{ person: { …, experience: 1, phone: '312-555-0111', instagram: '' } }`, calls `onAdded`, and shows `Review Grace Hopper` with `2 of 2`. After the last person `onClose` is called.
  - **Double tap (Review Focus 1):** two rapid clicks on the add button produce exactly one POST.
  - **Field error:** a 422 with `errors: { email: ['has already been taken'] }` reopens the Email line in its input with that message, unchecked.
  - **Team full (Review Focus 2):** a 422 with `errors: { maximum: ['Team is full'] }` shows an alert `Team is full`; the dialog stays open.
  - **No years value (Review Focus 3):** a racer with `experience: null` shows the `Years racing` select; `Done` with `Select one` still chosen keeps the line unconfirmed.
  - **403:** calls `onForbidden` and then `onClose`.
  - **Skip / Back / Escape:** `Skip Ada` moves to Grace with no POST; `Back to list` shows the list with Grace still ticked; Escape calls `onClose`.
  - **reviewOnly:** renders the review for that racer with no `Back to list` button and progress `1 of 1`.
  - **Wrapping (Review Focus 5):** the value element of a review line has class `break-words`.
- [ ] **Step 3: Run** `npm --prefix frontend test -- --run src/features/roster/review.test.ts src/features/roster/components/crew-picker.test.tsx`. Expected: FAIL.
- [ ] **Step 4: Implement** `DialogSheet`, `review.ts`, then the three components. `CrewPicker` owns the step, the tick list, the queue and index, and calls `useAddPerson(team.id).mutate`; the add button is `disabled` while unconfirmed lines remain and `loading` while the mutation is pending. `CrewReview` holds the `PersonDraft` and `ReviewLines` for one racer and is keyed by the racer's email so its state resets between people.
- [ ] **Step 5: Run** `bin/check frontend`. Expected: `ok frontend`.
- [ ] **Step 6: Commit** `SPA: crew picker with a per-detail review before saving`.

---

### Task 6: Roster card

**Files:**
- Modify: `frontend/src/features/roster/components/roster-card.tsx`, `frontend/src/features/roster/components/roster-slot.tsx`, `frontend/src/features/roster/utils.ts`, `frontend/src/locales/en.ts`
- Delete: `frontend/src/features/roster/components/past-racer-chips.tsx`, `frontend/src/features/roster/components/past-racer-list.tsx`
- Test: `frontend/src/features/roster/components/roster-card.test.tsx` (rewrite the chip and "+N more" tests; keep the edit, remove and captain tests)

**Interfaces:**
- Consumes: `CrewPicker` (Task 5), `useMe`.
- Produces: `draftFromUser(user: User): PersonDraft` in `utils.ts` (first name, last name, email, phone formatted for display; the rest empty). Locale keys:

```
'roster.spotsToFill_one': '1 spot to fill',
'roster.spotsToFill_other': '{count} spots to fill',
'roster.openSpots_one': '1 open spot',
'roster.openSpots_other': '{count} open spots',
'roster.addYourself': 'Add yourself',
'roster.showRacers': 'Show racers',
```

Remove `roster.more`, `roster.emptyClosed`, `roster.pastRacers` and `racerChipLabel`.

- [ ] **Step 1: Rewrite the failing tests** in `roster-card.test.tsx`:
  - **One picker entry:** 2 of 5 racers and 8 past racers gives exactly one button `Pick from past teams (8)`, exactly one `+ Add someone new`, the text `3 spots to fill`, and no element with the group name `Past racers` and no text matching `/more$/`.
  - **List shape:** the `Racer slots` list has 3 items (two people and the open-spots row).
  - **No past racers:** no `Pick from past teams` button; `+ Add someone new` is still there.
  - **Closed race:** `3 open spots`, and none of the three action buttons.
  - **Picker round trip:** `Pick from past teams (8)` opens a dialog named `Pick from past teams`; ticking Dee, reviewing, confirming all six and adding shows `Dee Lamb` in the list, the pill `3 of 5`, and the button count drops to `(7)`. Escape returns focus to the `Pick from past teams` button.
  - **Add yourself, not a past racer:** with nobody on the team matching `me.email`, `Add yourself` opens the `Add a racer` form with First name, Last name, Email and Phone filled from the account and ZIP code empty.
  - **Add yourself, past racer:** when a past racer has `me.email`, `Add yourself` opens the dialog on `Review {my name}` with `1 of 1`.
  - **Add yourself hidden** when a person on the team has `me.email`.
  - **Focus after save:** saving a new person through `Add a racer` with spots still open moves focus to `+ Add someone new`; saving the last open spot moves focus to that person's Edit button.
  - **Collapsed on load:** a team that loads with 5 of 5 shows the first names joined with `, ` and a `Show racers` button, and no `Edit …` buttons; pressing `Show racers` shows the five rows. A team that goes from 4 to 5 during the test keeps its rows visible.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/roster/components/roster-card.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The list renders one `SlotItem` per person, then one open-spots `li` when spots remain: one dashed `border-flag` circle per open spot (`aria-hidden`) and the `spotsToFill` text, or `openSpots` when the race is closed.
  - Under the list, while the race is open, a spot is free and no add form is showing: `Pick from past teams ({count})` (primary, `data-focus-key="pick"`, only when `available.length > 0`), `+ Add someone new` (`data-focus-key="add"`; primary when there is no picker button, secondary otherwise), `Add yourself` (secondary). Stacked on phones, a wrapping row from `sm`.
  - The add form renders under the list in place of those buttons. `ActiveForm` loses `slot`.
  - `CrewPicker` renders when the picker state is set: `{ reviewOnly?: PastRacer }`. `onAdded` sets the status message `{name} added`; `onForbidden` calls `reportError`.
  - Collapse state is `useState(() => checklist.racers.done)`.
  - `EmptySlot` is removed from `roster-slot.tsx`.
- [ ] **Step 4: Run** `bin/check frontend`. Expected: `ok frontend`. `grep -rn "PastRacerChips\|PastRacerList\|racerChipLabel\|roster.more" frontend/src` returns nothing.
- [ ] **Step 5: Commit** `SPA: one crew picker replaces the per-slot past-racer chips`.

---

### Task 7: End-to-end spec, docs, visual check

**Files:**
- Modify: `tests/spa/past-racers.spec.ts`, `CLAUDE.md`, `README.md` (only if setup or commands changed)

- [ ] **Step 1: Rewrite** `tests/spa/past-racers.spec.ts` for the new flow, keeping its seed (`test_seeds:past_racers`: Ada, Grace and Edsger Racer, 3 per team):
  - In the `Racers` group, click `Pick from past teams (3)`.
  - In the dialog `Pick from past teams`, tick the checkbox `Ada Racer`, click `Review 1 racer`.
  - Expect heading `Review Ada Racer` and `Add Ada to the team` disabled.
  - Click each of the six checkboxes (`Name: …`, `Email: …`, `Phone: (312) 555-0100`, `ZIP code: …`, `Years racing: …`, `Instagram: None`), then `Add Ada to the team`.
  - Expect the dialog gone, `Ada Racer` (exact) and her email in the roster, the pill `1 of 3`, and the button now `Pick from past teams (2)`.
- [ ] **Step 2: Check `tests/spa/full-registration.spec.ts` by reading it** against the new markup: `+ Add someone new` (`.first()`), form `Add a racer`, `Save`, the `{n} of {n}` pill, and the group names are unchanged. Note any line that would no longer match and fix the spec, saying why in the commit message.
- [ ] **Step 3: Do not run Playwright** (see Global Constraints). Run `npx tsc --noEmit -p tests` if a tsconfig exists there, otherwise `npx playwright test tests/spa --list` to prove the specs parse. Report in the hand-back that the e2e run is waiting on the owner.
- [ ] **Step 4: Visual check.** `npm --prefix frontend run build`, start Rails on port 3100 against the development database with `REGISTRATION_UI=spa`, sign in as a development user with a team, and take screenshots of the team page and both picker steps at 320px, 390px and 1280px wide. Confirm no horizontal scroll at 320px (`document.documentElement.scrollWidth === clientWidth`).
- [ ] **Step 5: Docs.** In `CLAUDE.md`: update the "Roster slots repeat past-racer chips" E2E learning to describe the single picker; add a short "Registration SPA" note on the crew picker (review gate, nothing saved until confirmed), `FlagProgress`/`stepStates`, the wide team route (`handle.wide`), and that racers give `instagram` (the `people.twitter` column is unused).
- [ ] **Step 6: Run** `bin/check rspec`, then `bin/check frontend`, then `bin/check build`. Expected: three `ok` lines.
- [ ] **Step 7: Commit** `E2E and docs for the crew picker`.
