# First-Visit Guided Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The first time a signed-in person opens a team page, a five-stop tour highlights the key parts (starting with the four stars) with Prev, Next and End tour on every popup.

**Architecture:** A new `frontend/src/features/tour` feature holds the stops, the "seen" storage and one `GuidedTour` component (a modal popup plus a highlight around the current target). `TeamChecklist` decides when it opens; targets are marked with `data-tour` attributes. Nothing is stored on the server.

**Tech Stack:** React 19, TypeScript, Tailwind 3, Vitest + Testing Library; Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-register-guided-tour-design.md`. Read it before any task.

## Global Constraints

- Branch `feat/register-guided-tour`, stacked on `feat/register-crew-picker`.
- No server change, no new npm dependency, no changes to `frontend/tailwind.config.js`.
- Colors only from the Tailwind tokens: `page`, `flag`, `star`, `starText`, `navy`, `link`, white. Fonts `font-display` and `font-sans`.
- All copy through `t()` in `frontend/src/locales/en.ts`, with the exact strings below. Use the `@` alias and the `features/<name>/{api,components}` layout.
- Touch targets at least `min-h-11`. Keyboard focus visible. Motion off under `prefers-reduced-motion`. Works at 320px with no horizontal scroll.
- Existing accessible names and strings on the team page must not change (Playwright specs and `../dogtag`'s e2e work depend on them).
- Do not run Playwright or any `rails test_seeds` task (shared database). `npx playwright test --list` is allowed.
- Run `bin/check frontend` before each commit. Commit only the task's files, by path. Messages end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Copy (exact)

```
'tour.flag.title': 'Four stars, four steps',
'tour.flag.body': 'Each star turns solid red when its step is done. Fill all four and your team is in.',
'tour.racers.title': 'Add your racers',
'tour.racers.body': 'Add each racer here. If you have raced before, you can pick people from your past teams.',
'tour.questions.title': 'Answer the team questions',
'tour.questions.body': 'A few questions about your team and cart. You can change your answers later.',
'tour.fee.title': 'Pay the registration fee',
'tour.fee.body': 'Pay by card here. If the price is going up, this step shows the date.',
'tour.in.title': "You're in",
'tour.in.body': 'When the first three stars are solid red, your spot is locked in and you get your team number.',
'tour.counter': '{index} of {total}',
'tour.prev': 'Prev',
'tour.next': 'Next',
'tour.done': 'Done',
'tour.end': 'End tour',
'tour.replay': 'Take the tour',
```

## Review Focus

1. **A target is not on the page** (race with no questions, or markup changed): that stop is skipped and the counter matches the stops shown; nothing crashes. Task 1.
2. **localStorage throws** (blocked site data): the tour does not start by itself, the page works, and the replay link still runs the tour. Task 1.
3. **Team data refetches while the tour is open** (the page polls): the tour stays on its current stop and does not reopen after it ends. Task 2.
4. **Target near the bottom of a desktop viewport:** the popup goes above the target and stays fully inside the viewport. Task 1 (placement function unit test).
5. **Rotation or resize mid-tour:** highlight and popup follow the target. Task 1.

---

### Task 1: Tour feature (storage, stops, popup)

**Files:**
- Create: `frontend/src/features/tour/storage.ts`, `frontend/src/features/tour/stops.ts`, `frontend/src/features/tour/placement.ts`, `frontend/src/features/tour/components/guided-tour.tsx`, and tests `storage.test.ts`, `stops.test.ts`, `placement.test.ts`, `components/guided-tour.test.tsx`
- Create: `frontend/src/components/ui/use-focus-trap.ts` (the Tab trap and Escape handling lifted out of `dialog-sheet.tsx`, which then uses it; its behavior and tests stay the same)
- Modify: `frontend/src/components/ui/dialog-sheet.tsx`, `frontend/src/locales/en.ts`, `frontend/src/test/setup.ts`

**Interfaces:**
- Produces:

```ts
// storage.ts
export const TOUR_OFF_KEY = 'dogtag:tour:off';
export const tourSeenKey = (userId: number) => `dogtag:tour:team:v1:${userId}`;
/** False when the off key is "1", the seen key exists, or localStorage throws. */
export function shouldAutoStart(userId: number): boolean;
/** Writes the seen key; swallows storage errors. */
export function markSeen(userId: number): void;

// stops.ts
export type TourStopId = 'flag' | 'racers' | 'questions' | 'fee' | 'in';
export interface TourStop { id: TourStopId; title: string; body: string }
/** In order flag, racers, questions, fee, in; 'questions' is left out when the race has none. */
export function teamTourStops(team: Team): TourStop[];

// placement.ts — desktop only
/** Popup's top-left: below the target when it fits, else above; clamped 16px inside the viewport. */
export function placePopup(target: DOMRect, popup: { width: number; height: number },
  viewport: { width: number; height: number }): { top: number; left: number };

// components/guided-tour.tsx
/** Targets are `[data-tour="<stop id>"]`. Stops whose target is missing are skipped. Renders nothing when no stop has a target. */
export function GuidedTour(props: { stops: TourStop[]; onEnd: () => void }): JSX.Element | null;

// components/ui/use-focus-trap.ts
export function useFocusTrap(ref: RefObject<HTMLElement | null>, onEscape: () => void): void;
```

- `GuidedTour` behavior: a portaled `role="dialog"` `aria-modal` popup named by its title (`h2`, `tabIndex={-1}`, focused on every stop); body text; footer with the counter (`tour.counter`), then `End tour` (ghost), `Prev` (secondary; not rendered on the first stop), and `Next` (primary; reads `Done` on the last stop and ends the tour). Escape calls `onEnd`. A fixed, `pointer-events-none` ring element is placed over the target's rect with a `0 0 0 9999px` navy/50 box-shadow for the dim; a transparent full-screen layer under the popup blocks clicks on the page. On each stop the target is scrolled into view (`block: 'center'`; smooth unless reduced motion). The rect is re-read on `scroll` and `resize`. From `lg` (`window.matchMedia('(min-width: 1024px)')`) the popup is positioned with `placePopup`; below it the popup is a card fixed to the bottom, full width with 12px margins. Focus returns to the previously focused element when it unmounts.

- [ ] **Step 1: Failing unit tests.**
  - `storage.test.ts`: `shouldAutoStart(7)` is true on empty storage; false after `markSeen(7)`; still true for user 8; false when `TOUR_OFF_KEY` is `'1'`; false and no throw when `localStorage.getItem` throws; `markSeen` does not throw when `setItem` throws.
  - `stops.test.ts`: a team whose checklist has `questions.required: true` gives ids `['flag','racers','questions','fee','in']` with the exact titles above; `required: false` gives four, without `questions`.
  - `placement.test.ts`: target at top 100, height 60 in a 1280x800 viewport with a 360x200 popup gives `top: 172` (12px gap) and `left` equal to the target's left; a target at top 700 gives a `top` of `700 - 200 - 12`; a target at left 1100 gives `left: 1280 - 360 - 16`; `left` is never below 16.
- [ ] **Step 2: Failing component tests** in `guided-tour.test.tsx` (render three `<div data-tour="…">` targets for `flag`, `racers`, `fee` beside the component and pass five stops):
  - Shows a dialog named `Four stars, four steps` with `1 of 3` (the two stops without targets are skipped — Review Focus 1); the title has focus; there is no `Prev` button.
  - `Next` shows `Add your racers`, `2 of 3`, and a `Prev` button; `Prev` goes back.
  - On the last stop the primary button is `Done`; pressing it calls `onEnd` once.
  - `End tour` calls `onEnd` from any stop; Escape calls `onEnd`.
  - Tab from the last button wraps to the first; Shift+Tab from the title stays inside the dialog.
  - With no targets on the page it renders nothing and does not call `onEnd`.
  - Firing `resize` after changing the target's mocked `getBoundingClientRect` moves the ring (its inline `top`/`left` change) — Review Focus 5.
- [ ] **Step 3: Run** the four test files. Expected: FAIL (modules missing).
- [ ] **Step 4: Implement.** Extract `useFocusTrap` from `dialog-sheet.tsx` first and keep `crew-picker.test.tsx` green. Add the locale keys. In `frontend/src/test/setup.ts` add a `beforeEach` that clears `localStorage` and sets `TOUR_OFF_KEY` to `'1'` so no existing test sees the tour.
- [ ] **Step 5: Run** `bin/check frontend`. Expected: `ok` lines.
- [ ] **Step 6: Commit** `SPA: guided tour popup, stops and seen-once storage`.

---

### Task 2: Start it on the team page

**Files:**
- Modify: `frontend/src/features/teams/components/team-checklist.tsx`, `team-header.tsx`, `checklist-card.tsx`, `flag-progress.tsx`, `youre-in-card.tsx` (only if needed to pass the marker through), `frontend/src/locales/en.ts` (no new keys expected)
- Test: `frontend/src/features/teams/components/team-checklist.test.tsx`

**Interfaces:**
- Consumes: `GuidedTour`, `teamTourStops`, `shouldAutoStart`, `markSeen`, `TOUR_OFF_KEY` (Task 1); `useMe` from `@/features/auth/api/use-me`.
- Produces: `data-tour="flag"` on the `FlagProgress` root; `ChecklistCard` gains `tourId?: TourStopId` and puts `data-tour` on its heading row (the row with the star, title and pill), passed as `racers`, `questions`, `fee`, `in`; `TeamHeader` gains `onTakeTour: () => void` and renders a ghost button `Take the tour` (`tour.replay`) as the last item in the header, on every screen size.

- [ ] **Step 1: Failing tests** in `team-checklist.test.tsx` (each test that wants the tour first removes `TOUR_OFF_KEY`):
  - First visit: after the team loads, a dialog named `Four stars, four steps` is shown.
  - Ending it with `End tour` closes it, writes `dogtag:tour:team:v1:<me.id>`, and moves focus to `Take the tour`.
  - With the seen key already set, no dialog appears; pressing `Take the tour` opens it at stop 1.
  - With `TOUR_OFF_KEY` set (the default in tests), no dialog appears, and `Take the tour` still opens it.
  - A finalized team does not auto-start.
  - Refetch while open (Review Focus 3): go to stop 2, then make the team query refetch (invalidate it, MSW returns the same team); the dialog still shows stop 2. After ending, another refetch does not reopen it.
  - A race with no questions shows `1 of 4`.
  - The four group names and the existing pills are unchanged.
- [ ] **Step 2: Run** `npm --prefix frontend test -- --run src/features/teams`. Expected: FAIL.
- [ ] **Step 3: Implement.** `TeamChecklist` keeps `tourOpen` in state. An effect that runs once per mount, after the team and `useMe` data are both present, opens it when `!checklist.finalized && shouldAutoStart(me.id)`. `onEnd` calls `markSeen(me.id)`, closes it and focuses the replay button. The stops are memoized on `checklist.questions.required` so a refetch does not reset the tour.
- [ ] **Step 4: Run** `bin/check frontend`. Expected: `ok` lines.
- [ ] **Step 5: Commit** `SPA: the tour starts on a first team-page visit and can be replayed`.

---

### Task 3: End-to-end switch, spec, docs, visual check

**Files:**
- Modify: `playwright.config.ts`, `CLAUDE.md`, `tests/README.md`
- Create: `tests/spa/guided-tour.spec.ts`

- [ ] **Step 1: Switch the tour off for every Playwright test.** In `playwright.config.ts` `use`, add

```ts
storageState: {
  cookies: [],
  origins: [{
    origin: process.env.BASE_URL || `http://localhost:${TEST_PORT}`,
    localStorage: [{ name: 'dogtag:tour:off', value: '1' }],
  }],
},
```

- [ ] **Step 2: Write** `tests/spa/guided-tour.spec.ts` in the style of `tests/spa/past-racers.spec.ts`, seeded with `past_racers`, with `test.use({ storageState: { cookies: [], origins: [] } })` so the switch is absent: log in, open the team, expect the dialog `Four stars, four steps` and `1 of 4` (that seed's race has no questions); `Next` three times through `Add your racers`, `Pay the registration fee`, `You're in`; `Done`; expect no dialog; reload and expect no dialog; press `Take the tour` and expect `Four stars, four steps`; press `End tour`.
- [ ] **Step 3: Parse check only:** `npx playwright test tests/spa --list` lists the new spec. Do not run it.
- [ ] **Step 4: Docs.** `CLAUDE.md` "Registration SPA": one bullet on the tour (where it lives, the `data-tour` markers, auto-start rule, `dogtag:tour:team:v1:<user id>` and `dogtag:tour:off`). "E2E Learnings": one bullet that `playwright.config.ts` switches the tour off through `storageState`, and that a spec wanting the tour clears it with `test.use`. `tests/README.md`: one line for the new spec.
- [ ] **Step 5: Visual check (controller).** Each stop at 320px, 390px and 1280px in a real browser: highlight on the right element, popup fully on screen, buttons reachable, no horizontal scroll.
- [ ] **Step 6: Run** `bin/check frontend` and `bin/check build`. Expected: `ok` lines.
- [ ] **Step 7: Commit** `E2E switch, spec and docs for the guided tour`.
