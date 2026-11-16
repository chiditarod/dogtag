import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markSeen, shouldAutoStart, TOUR_OFF_KEY } from '@/features/tour/storage';

describe('tour storage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts on empty storage and not once seen', () => {
    expect(shouldAutoStart(7)).toBe(true);
    markSeen(7);
    expect(shouldAutoStart(7)).toBe(false);
    expect(shouldAutoStart(8)).toBe(true);
  });

  it('does not start when tours are switched off', () => {
    localStorage.setItem(TOUR_OFF_KEY, '1');
    expect(shouldAutoStart(7)).toBe(false);
  });

  it('does not start, and does not throw, when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(shouldAutoStart(7)).toBe(false);
  });

  it('swallows errors when storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => markSeen(7)).not.toThrow();
  });
});
