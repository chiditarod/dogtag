import { describe, expect, it } from 'vitest';
import { buildChecklist, buildRace, buildTeam } from '@/test/fixtures';
import { staffPayGaps } from './staff-pay';

const team = (racers: { filled: number; total: number }, race = {}) =>
  buildTeam({
    race: buildRace(race),
    checklist: buildChecklist({ racers: { ...racers, captain: true, done: false } }),
  });

describe('staffPayGaps', () => {
  it('has no gaps for a full roster in an open race with room', () => {
    expect(staffPayGaps(team({ filled: 5, total: 5 }))).toEqual([]);
  });

  it('names an incomplete roster with its counts', () => {
    expect(staffPayGaps(team({ filled: 3, total: 5 }))).toEqual([
      { kind: 'roster', filled: 3, total: 5 },
    ]);
  });

  it('names a closed race and a full race', () => {
    expect(staffPayGaps(team({ filled: 5, total: 5 }, { open_for_registration: false }))).toEqual([
      { kind: 'closed' },
    ]);
    expect(staffPayGaps(team({ filled: 5, total: 5 }, { full: true }))).toEqual([{ kind: 'waitlist' }]);
  });

  it('lists every gap, roster first', () => {
    expect(
      staffPayGaps(team({ filled: 1, total: 5 }, { open_for_registration: false, full: true })),
    ).toEqual([{ kind: 'roster', filled: 1, total: 5 }, { kind: 'closed' }, { kind: 'waitlist' }]);
  });
});
