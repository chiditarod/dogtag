import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useUserFilters } from './use-user-filters';

function setup(url = '/staff/users') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(() => useUserFilters(), { wrapper });
}

describe('useUserFilters', () => {
  it('reads q and page from the URL, defaulting to an empty search on page 1', () => {
    expect(setup().result.current.values).toEqual({ q: '', page: 1 });
    expect(setup('/x?q=ada&page=3').result.current.values).toEqual({ q: 'ada', page: 3 });
  });

  it('typing a search sets q and drops page', () => {
    const { result } = setup('/x?page=3');
    act(() => result.current.setFilter('q', 'ada doge'));
    expect(result.current.values).toEqual({ q: 'ada doge', page: 1 });
  });

  it('setting page keeps q', () => {
    const { result } = setup('/x?q=ada');
    act(() => result.current.setFilter('page', 2));
    expect(result.current.values).toEqual({ q: 'ada', page: 2 });
  });

  it('clearAll drops everything', () => {
    const { result } = setup('/x?q=ada&page=2');
    act(() => result.current.clearAll());
    expect(result.current.values).toEqual({ q: '', page: 1 });
  });

  it('ignores junk pages and keeps setFilter stable across URL changes', () => {
    expect(setup('/x?page=-1').result.current.values.page).toBe(1);
    expect(setup('/x?page=2.5').result.current.values.page).toBe(1);
    const { result } = setup();
    const { setFilter } = result.current;
    act(() => result.current.setFilter('q', 'a'));
    expect(result.current.setFilter).toBe(setFilter);
  });
});
