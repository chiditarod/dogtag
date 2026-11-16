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

  it('does not start when storage can be read but not written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(shouldAutoStart(7)).toBe(false);
  });

  it('remembers a tour seen this session even when the seen key cannot be written', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    markSeen(7);
    // Writes work again (e.g. the probe succeeds), but the key never landed.
    setItem.mockRestore();
    expect(localStorage.getItem('dogtag:tour:team:v1:7')).toBeNull();
    expect(shouldAutoStart(7)).toBe(false);
    expect(shouldAutoStart(8)).toBe(true);
  });

  it('leaves no probe key behind', () => {
    expect(shouldAutoStart(7)).toBe(true);
    expect(localStorage.length).toBe(0);
  });
});
