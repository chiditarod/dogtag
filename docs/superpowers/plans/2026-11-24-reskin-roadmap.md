# Reskin roadmap: retire the legacy site

**Spec:** `docs/superpowers/specs/2026-11-24-reskin-design.md` (approved 2026-11-24). **Mockups:** `docs/superpowers/specs/2026-11-24-reskin-mockups/`.

Ten stacked PRs, each opened against `chiditarod/dogtag` and never merged by us. Each PR branches from the one before it (PR 1 from `main`). Each gets its own plan file, written just before it is built, so it can rely on what the previous PR actually shipped. Build with the model and effort below; every PR is reviewed by Opus high.

| # | PR | Spec area | Branch | Build | Plan |
|---|---|---|---|---|---|
| 1 | Account edit and password reset | 2 | `feature/reskin-1-account` | Sonnet high | `2026-11-24-reskin-pr1-account-password-reset.md` |
| 2 | Who's registered + shared list parts | 3, 4 (first bullet) | `feature/reskin-2-whos-registered` | Sonnet high | to write |
| 3 | Homepage intro | 8 | `feature/reskin-3-homepage-intro` | Sonnet medium | to write |
| 4 | Sidekiq admin-only | 1 | `feature/reskin-4-sidekiq` | Sonnet high | to write |
| 5 | Race setup (list, overview, form, export, staff nav) | 6 | `feature/reskin-5-race-setup` | Sonnet high | to write |
| 6 | Fees (requirements and tiers), staging e2e port | 7 | `feature/reskin-6-fees` | Sonnet high | to write |
| 7 | Users and Emails sent | 4 | `feature/reskin-7-users-emails` | Sonnet high | to write |
| 8 | Staff team view, staff Pay, Payments `team_id` | 5 | `feature/reskin-8-staff-team` | Sonnet high | to write |
| 9 | Racer cleanup (owner-timed) | 9 | `feature/reskin-9-racer-cleanup` | Sonnet high | to write |
| 10 | Staff cleanup (owner-timed) | 10 | `feature/reskin-10-staff-cleanup` | Sonnet high | to write |

Timing: PRs 1-3 aim to be on production before the deploy freeze (proposed: the day before registration opens to two days after; opening likely 2026-12-07, so 2026-12-06 to 2026-12-09). Anything not on staging and reviewed by then waits for the freeze to end. PRs 9 and 10 start only when the owner says.
