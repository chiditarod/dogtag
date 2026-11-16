import { test, expect } from '@playwright/test';
import { e2eRaceName, isSweepable, SWEEP_MIN_AGE_MS } from './admin-forms';

test.describe('isSweepable', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000);

  test('names carry the UTC start time to the minute', () =>
    expect(e2eRaceName('abc12345', new Date('2026-11-16T09:35:42Z'))).toBe('Race E2E abc12345 2026-11-16T09:35Z'));
  test('another run’s fresh race is left alone', () =>
    expect(isSweepable(e2eRaceName('other', minutesAgo(30)), 'mine', now)).toBe(false));
  test('another run’s race older than the cutoff is swept', () => {
    expect(SWEEP_MIN_AGE_MS).toBe(2 * 3_600_000);
    expect(isSweepable(e2eRaceName('other', minutesAgo(120)), 'mine', now)).toBe(true);
  });
  test('this run’s own race is swept whatever its age', () =>
    expect(isSweepable(e2eRaceName('mine', minutesAgo(1)), 'mine', now)).toBe(true));
  test('a run id that only starts with this one is not this run', () =>
    expect(isSweepable(e2eRaceName('mine-r1', minutesAgo(1)), 'mine', now)).toBe(false));
  test('an E2E name without a time counts as old', () =>
    expect(isSweepable('Race E2E 41bfc507', 'mine', now)).toBe(true));
  test('retired and non-E2E races are never swept', () => {
    expect(isSweepable(`${e2eRaceName('other', minutesAgo(600))} [retired]`, 'mine', now)).toBe(false);
    expect(isSweepable('CHIditarod XXII', 'mine', now)).toBe(false);
    expect(isSweepable('Race E2Etest', 'mine', now)).toBe(false);
  });
});
