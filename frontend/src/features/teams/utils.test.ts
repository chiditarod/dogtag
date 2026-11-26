import { describe, expect, it } from 'vitest';
import { cardSteps, feePill, isFeeOpensLater, stepStates } from '@/features/teams/utils';
import { buildChecklist, buildTeam } from '@/test/fixtures';

const team = (overrides: Parameters<typeof buildChecklist>[0] = {}) =>
  buildTeam({ checklist: buildChecklist(overrides) });

describe('stepStates', () => {
  it('earns only the team star for a new team with questions and a fee due', () => {
    expect(
      stepStates(team({ racers: { filled: 0, total: 5, captain: false, done: false }, questions: { required: true, done: false } })),
    ).toEqual([true, false, false, false]);
  });

  it('keeps the racers star empty for a full roster without a captain', () => {
    const states = stepStates(team({ racers: { filled: 5, total: 5, captain: false, done: false } }));
    expect(states[1]).toBe(false);
    expect(stepStates(team({ racers: { filled: 5, total: 5, captain: true, done: true } }))[1]).toBe(true);
  });

  it('counts questions as done when the race has none', () => {
    expect(stepStates(team({ questions: { required: false, done: false } }))[2]).toBe(true);
  });

  it('keeps the fee star empty while the fee opens later', () => {
    const opensLater = {
      done: true,
      amount_due_cents: null,
      paid_cents: 0,
      next_tier: { price_cents: 15000, begins_at: '2026-12-01T06:00:00.000Z' },
      requirement_id: null,
      items: [],
    };
    expect(stepStates(team({ fee: opensLater }))[3]).toBe(false);
  });

  it('keeps the fee star lit when every payment was refunded and a later tier is coming', () => {
    const refundedItem = {
      requirement_id: 7,
      name: 'Registration',
      done: true,
      amount_due_cents: null,
      paid_cents: 10000,
      next_tier: { price_cents: 15000, begins_at: '2026-12-01T06:00:00.000Z' },
      refunded: true,
    };
    const allRefunded = {
      done: true,
      amount_due_cents: null,
      paid_cents: 0,
      next_tier: { price_cents: 15000, begins_at: '2026-12-01T06:00:00.000Z' },
      requirement_id: 7,
      items: [refundedItem],
    };
    expect(isFeeOpensLater(allRefunded)).toBe(false);
    expect(stepStates(team({ fee: allRefunded }))[3]).toBe(true);
    expect(cardSteps(buildChecklist({ fee: allRefunded }))[2]).toBe(true);
    expect(feePill(allRefunded, 'America/Chicago')).toBe('Paid');
  });

  it('fills all four stars once finalized, even if a step regressed', () => {
    expect(
      stepStates(team({ finalized: true, questions: { required: true, done: false } })),
    ).toEqual([true, true, true, true]);
  });

  it('fills the racers star for a finalized team that never had a captain', () => {
    expect(
      stepStates(team({ finalized: true, racers: { filled: 5, total: 5, captain: false, done: false } })),
    ).toEqual([true, true, true, true]);
  });
});
