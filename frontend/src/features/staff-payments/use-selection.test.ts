import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { payment } from './test-fixtures';

import { useSelection } from './use-selection';

const rows = (n: number, overrides = {}) =>
  Array.from({ length: n }, (_, i) => payment({ id: i + 1, ...overrides }));

describe('useSelection', () => {
  it('ignores rows that are not paid', () => {
    const { result } = renderHook(() => useSelection(5));
    act(() => result.current.toggle(payment({ id: 1, status: 'refunded' })));
    act(() => result.current.toggle(payment({ id: 2, status: 'refunding' })));
    expect(result.current.selected.size).toBe(0);
  });

  it('toggles a row on and off', () => {
    const { result } = renderHook(() => useSelection(5));
    act(() => result.current.toggle(payment({ id: 1 })));
    expect([...result.current.selected.keys()]).toEqual([1]);
    act(() => result.current.toggle(payment({ id: 1 })));
    expect(result.current.selected.size).toBe(0);
  });

  it('never selects more than the limit', () => {
    const { result } = renderHook(() => useSelection(2));
    act(() => rows(3).forEach((row) => result.current.toggle(row)));
    expect(result.current.selected.size).toBe(2);
    expect(result.current.isFull).toBe(true);
    // Unticking still works when full.
    act(() => result.current.toggle(payment({ id: 1 })));
    expect(result.current.isFull).toBe(false);
  });

  it('selectNext adds the first unselected paid rows up to the limit', () => {
    const { result } = renderHook(() => useSelection(3));
    const page = [
      payment({ id: 1, status: 'refunded' }),
      payment({ id: 2 }),
      payment({ id: 3 }),
      payment({ id: 4 }),
      payment({ id: 5 }),
    ];
    act(() => result.current.toggle(page[2]));
    act(() => result.current.selectNext(page));
    expect([...result.current.selected.keys()].sort()).toEqual([2, 3, 4]);
  });

  it('clear empties the selection', () => {
    const { result } = renderHook(() => useSelection(5));
    act(() => result.current.selectNext(rows(3)));
    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
  });
});
