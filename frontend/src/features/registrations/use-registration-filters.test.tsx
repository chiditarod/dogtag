import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useRegistrationFilters } from './use-registration-filters';

const fields = [{ key: 'racer-type' }, { key: 'theme' }];

function setup(url = '/races/7') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ filters: useRegistrationFilters(fields), search: useLocation().search }), {
    wrapper,
  });
}

describe('useRegistrationFilters', () => {
  it('defaults to the registered tab with no search or answers', () => {
    const { result } = setup();
    expect(result.current.filters.tab).toBe('registered');
    expect(result.current.filters.q).toBe('');
    expect(result.current.filters.answers).toEqual({});
  });

  it('writes the tab, search and answers to the URL', () => {
    const { result } = setup();
    act(() => result.current.filters.setTab('registering'));
    expect(new URLSearchParams(result.current.search).get('tab')).toBe('registering');
    expect(result.current.filters.tab).toBe('registering');

    act(() => result.current.filters.setQ('doge'));
    expect(result.current.filters.q).toBe('doge');

    act(() => result.current.filters.setAnswer('racer-type', 'Racer'));
    expect(new URLSearchParams(result.current.search).get('f_racer-type')).toBe('Racer');
    expect(result.current.filters.answers).toEqual({ 'racer-type': 'Racer' });

    act(() => result.current.filters.setAnswer('racer-type', undefined));
    expect(result.current.filters.answers).toEqual({});
  });

  it('treats an unknown tab as registered and going back to registered drops the param', () => {
    const { result } = setup('/races/7?tab=nope');
    expect(result.current.filters.tab).toBe('registered');
    act(() => result.current.filters.setTab('registering'));
    act(() => result.current.filters.setTab('registered'));
    expect(new URLSearchParams(result.current.search).has('tab')).toBe(false);
  });

  it('ignores answer params for keys that are not filter fields', () => {
    const { result } = setup('/races/7?f_unknown=x&f_theme=Dogs');
    expect(result.current.filters.answers).toEqual({ theme: 'Dogs' });
  });

  it('clearFilters keeps the tab and search', () => {
    const { result } = setup('/races/7?tab=registering&q=doge&f_theme=Dogs&page=2');
    act(() => result.current.filters.clearFilters());
    expect(result.current.filters.answers).toEqual({});
    expect(result.current.filters.tab).toBe('registering');
    expect(result.current.filters.q).toBe('doge');
    expect(new URLSearchParams(result.current.search).has('page')).toBe(false);
  });
});
