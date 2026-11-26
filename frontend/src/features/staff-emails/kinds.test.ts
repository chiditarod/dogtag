import { describe, expect, it } from 'vitest';
import { KIND_LABELS, kindLabel, queuedFor } from './kinds';
import { SERVER_KINDS } from './test-fixtures';

describe('kindLabel', () => {
  it('uses the plain words, else the raw kind capitalized, else Unknown', () => {
    expect(kindLabel('team_finalized')).toBe('Team finalized');
    expect(kindLabel('new_thing')).toBe('New thing');
    expect(kindLabel(null)).toBe('Unknown');
  });

  it('has a label for every kind the server lists', () => {
    expect(Object.keys(KIND_LABELS).sort()).toEqual([...SERVER_KINDS].sort());
  });
});

describe('queuedFor', () => {
  const now = new Date('2026-12-09T12:00:00Z');
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

  it('says minutes, hours and days', () => {
    expect(queuedFor(ago(2), now)).toBe('for 2 min');
    expect(queuedFor(ago(150), now)).toBe('for 3 h');
    expect(queuedFor(ago(2 * 24 * 60), now)).toBe('for 2 days');
    expect(queuedFor(ago(24 * 60), now)).toBe('for 1 day');
  });

  it('never says 0 min', () => {
    expect(queuedFor(ago(0), now)).toBe('for 1 min');
  });
});
