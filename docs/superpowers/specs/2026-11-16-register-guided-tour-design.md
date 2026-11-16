# Registration SPA: First-Visit Guided Tour: Design

**Date:** 2026-11-16
**Status:** Approved by the owner, 2026-11-16 (approach and design as proposed in conversation)
**Branch:** `feat/register-guided-tour`, stacked on `feat/register-crew-picker`

## Intent

The owner's words: "when a user first begins registering, we want to add little guided tour modal overlays, they can click next or prev or end at the bottom of the popup. the goal is to quickly help the user identify the key things, for example, the 4 stars represent how complete the registration is."

Everyone is new to this team page this year. The tour takes a few seconds and tells a captain what the page is asking of them.

## Goals

- The first time a signed-in person opens a team page, a short tour starts by itself.
- Each stop highlights one part of the page and explains it in a sentence or two.
- Every popup has Prev, Next and End tour at the bottom.
- It never comes back uninvited, and it can be replayed on request.
- It works on phones (down to 320px) and on desktop.

## Non-goals

- No tour on the login, signup, race list or create-team pages.
- No server change. Nothing about the tour is stored in the database.
- No new npm dependency.

## Anti-goals

- A tour that blocks someone who wants to get on with it. End tour and Escape always work, on every stop.
- A tour that reappears on every visit.
- End-to-end tests broken by an overlay that opens by itself.

## Approaches

1. **Build it in the app (chosen).** Five stops, one popup component, one highlight. Small, matches the design tokens, no dependency.
2. **A tour library (react-joyride, Shepherd).** More features than five stops need, a new dependency to keep current, and its own styling to fight.
3. **A one-time explainer modal with no highlights.** Cheaper, but it does not point at anything, which is what the owner asked for.

Where "seen" is remembered:

- **Per browser, in localStorage (chosen, builder's proposal accepted by the owner).** No migration before Dec 1. Someone who moves from phone to laptop sees it once on each.
- **Per account, in the database.** Follows the person across devices, but needs a migration and an API change.

## Design

### Stops

In this order. The Team questions stop is left out when the race has no questions, and the counter adjusts ("1 of 4").

| # | Highlights | Title | Body |
|---|---|---|---|
| 1 | The flag in the team header | Four stars, four steps | Each star turns red when its step is done. Fill all four and your team is in. |
| 2 | The Racers step heading | Add your racers | Add each racer here. If you have raced before, you can pick people from your past teams. |
| 3 | The Team questions step heading | Answer the team questions | A few questions about your team and cart. You can change your answers later. |
| 4 | The Registration fee step heading | Pay the registration fee | Pay by card here. If the price is going up, this step shows the date. |
| 5 | The You're in! step heading | You're in | When the first three stars are red, your spot is locked in and you get your team number. |

### The popup

```
        ★ ★ ☆ ☆        <- highlighted; the rest of the page is dimmed
 ┌────────────────────────────────────────┐
 │ Four stars, four steps                 │
 │ Each star turns red when its step is   │
 │ done. Fill all four and your team is   │
 │ in.                                    │
 │                                        │
 │ 1 of 5          End tour   Prev   Next │
 └────────────────────────────────────────┘
```

- A `role="dialog"`, modal, named by its title. Focus moves to the title on every stop and stays inside the popup. Escape ends the tour. When the tour ends, focus goes back to where it was (or to the replay link).
- Buttons, left to right: the counter ("1 of 5"), then `End tour` (plain link style), `Prev` (secondary, not shown on the first stop), `Next` (primary). On the last stop `Next` reads `Done`.
- **Highlight:** the target gets a clear ring; everything else is dimmed with the same navy tint the picker dialog uses. The page behind cannot be clicked while the tour is open.
- **Desktop (`lg` and up):** the popup sits next to the target, below it when there is room and above it when there is not, kept inside the viewport.
- **Phones and tablets:** the popup is a card fixed to the bottom of the screen, full width, and the target is scrolled into view above it.
- The target is scrolled into view when a stop opens. The highlight follows the target on scroll and resize.
- Motion is limited to the popup and highlight moving between stops, and is off under `prefers-reduced-motion`.

### When it starts

- Automatically, once the team page has loaded, when all of these hold: the team is not finalized, this browser has no "seen" mark for this user, and tours are not switched off (below).
- The "seen" mark is written when the tour ends by any route (Done, End tour, Escape). Key: `dogtag:tour:team:v1:<user id>` in localStorage.
- If localStorage cannot be read or written, the tour does not start by itself.
- **Replay:** a `Take the tour` link in the team header starts it from the first stop at any time, including on a finalized team.

### Switching it off for tests

- A localStorage key `dogtag:tour:off` set to `1` stops the tour from starting by itself. The replay link still works.
- Playwright sets that key for every test through `storageState` in `playwright.config.ts`, so existing specs and the e2e tests being written in `../dogtag` are not blocked. One new spec clears the key and walks the tour.
- Vitest sets the key in the shared test setup; the tour's own tests clear it.

## Testing

- **Vitest:** starts once on first visit; does not start when seen, when switched off, when the team is finalized, or when localStorage throws; Next, Prev, Done, End tour and Escape; the counter; the questions stop left out when not required; focus on the title each stop and restored at the end; replay link.
- **Playwright:** a `tests/spa/guided-tour.spec.ts` that clears the off switch, signs in as a new captain, sees stop 1, steps to the end, reloads and confirms it does not come back, then replays it from the link. Not run without the owner's go-ahead (shared database).
- **By eye:** each stop at 320px, 390px and 1280px.

## Left to the builder

- File and component names inside `frontend/src/features/tour`.
- How targets are marked (ids or `data-tour` attributes) and how the popup is positioned.
- Whether the focus trap is shared with `DialogSheet` through a small hook.
- Exact wording of the replay link's placement in the header.
