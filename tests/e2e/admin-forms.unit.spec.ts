import { test, expect } from '@playwright/test';
import { e2eRaceName, isSweepable, requirementTypeLabel, SWEEP_MIN_AGE_MS, wallClockInput } from './admin-forms';

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

test.describe('SPA form helpers', () => {
  test('wallClockInput is the race-zone wall clock a datetime-local input takes', () => {
    expect(wallClockInput(new Date('2026-12-07T18:00:30Z'), 'America/Chicago')).toBe('2026-12-07T12:00');
    // Midnight is 00, not 24.
    expect(wallClockInput(new Date('2026-12-07T06:00:00Z'), 'America/Chicago')).toBe('2026-12-07T00:00');
  });
  test('requirementTypeLabel is the fee form’s Type option', () => {
    expect(requirementTypeLabel('MockPaymentRequirement')).toBe('Test payment (no card)');
    expect(requirementTypeLabel('PaymentRequirement')).toBe('Card payment');
  });
});
