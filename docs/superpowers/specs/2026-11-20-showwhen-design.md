# JSONForm `showWhen` (issue #334)

Short design, approved in conversation on 2026-11-20.

## Intent and why

The 2027 form gains an optional "Details about your fire effects" field (`fire-details`, #304). Liz asked to hide it when the team answers "No" to fire effects. The SPA's JSONForm renderer has no conditional support, and neither does the vendored legacy `jsonform.js`. This is a nice-to-have; nothing blocks it, and #304 ships `fire-details` always visible first.

## Goals

- A `form` item may carry `"showWhen": { "<schema key>": "<value>" }` (exact string equality, one pair). A custom key, not jsonform's `condition`, so no expression parsing and no clash with a future jsonform.js upgrade.
- A hidden field is not rendered, not validated, not counted, and omitted from the saved payload, so a stale answer is dropped on the next Save. Showing it again restores the draft value from this editing session.
- A malformed `showWhen` (not a one-pair object of strings, or an unknown controlling key) is ignored and the field stays visible.
- `RaceValidator#validate_jsonform` rejects a `form` item with `showWhen` whose property has `"required": true`, as an error on `jsonform`.
- The legacy HAML flow renders and saves a payload containing `showWhen` (field always visible).

## Non-goals and anti-goals

- No `showWhen` on structural items (fieldsets, etc.); keyed items only.
- No expressions, multiple pairs, or operators other than equality.
- No server answer-handling change: `JsonForm.filter_answers` already keeps only schema keys and ignores other form-item keys.
- No legacy-flow conditional behavior. Anti-goal: a hidden required field that makes Save impossible, since the server still validates the whole schema (`TeamValidator`, per-property `required`).

## Constraints

- `TeamValidator` validates saved answers against the whole schema regardless of visibility, which is why only optional fields may be conditional.
- `validate.ts` caches by schema object in a `WeakMap`; do not pass modified schema copies.
- Frontend follows Bulletproof React feature folders (`frontend/src/features/questions`); copy via `t()` if any new strings are needed.

## Approaches

1. **One visibility helper, used everywhere (chosen).** `isVisible(item, answers, schema)` is called by the renderer, `buildPayload` and the answered count. Small, local, and testable on its own.
2. Prune the schema before rendering and validating. Rejected: fights the `validate.ts` `WeakMap` cache and spreads the logic across layers.
3. Enforce on the server. Rejected: the issue rules it out, and the server cannot know what the user sees.

## Decisions

- **Hidden controller:** if a field's controlling field is itself hidden, the dependent is hidden too, so a stale draft cannot keep a chain visible. Cycles resolve to visible (the field is shown) rather than looping. (Builder's call.)
- **Answered count:** the "N answered" total in `questions-card.tsx` counts only visible fields. The issue does not mention it; without this, a hidden field leaves the count at "4 of 5" with no way to finish.
- **Comparison:** the controlling answer is compared as the string value of the current answers (including schema defaults from `defaultAnswers`) with exact equality.
- **Branch:** `feature/334-show-when` from `origin/main` (independent; not stacked).

## Parts

- `types.ts`: add optional `showWhen` to `JsonformItemObject`.
- New helper (e.g. `visibility.ts` in the questions feature): parse a `showWhen`, resolve visibility transitively.
- `jsonform-renderer.tsx`: skip hidden keyed items.
- `questions-card.tsx`: `buildPayload` omits hidden keys; the answered count uses visible keys only.
- `validate.ts`: unchanged in behavior (it validates the built payload); tests cover that hidden keys never fail validation.
- `app/validators/race_validator.rb`: reject required + `showWhen` items. Add a RaceValidator spec (none exists today).
- Test fixture: add `fire-details` (optional textarea) and a `showWhen` on it, plus `flame-effects` as controller, where the tests need them.

## Tests and docs

- Vitest: `validate.test.ts`, `jsonform-renderer.test.tsx`, `questions-card.test.tsx` cover shown vs hidden as the controlling answer changes, hidden answer omitted from the payload, re-show restores the draft, malformed `showWhen` leaves the field visible, hidden-controller chain.
- RSpec: `RaceValidator` rejects a required conditional field and accepts an optional one.
- Playwright: `tests/spa/` spec toggling the controlling answer, with its own `test_seeds:*` task (unique `TEST_UNIQUE_ID`, `@example.com` emails, `Race %` / `Test Team %` names so `test_seeds:cleanup` covers it, plus a header-comment entry). The PR states whether it ran.
- Legacy: confirm in a browser (Playwright MCP) that `vendor/assets/javascripts/jsonform.js` renders and saves a payload with `showWhen`. Recon found no code that rejects unknown form-item keys, but this is unverified until run.
- Docs: add `showWhen` to the CLAUDE.md Registration SPA notes; check README.md for anything that needs updating.

## Left to the builder

Helper file name and signature, exact error wording on `jsonform`, how the fixture is shaped, and the seed's data. Following the issue, adding `showWhen` to the real `fire-details` payload is a separate owner-gated edit after this ships.
