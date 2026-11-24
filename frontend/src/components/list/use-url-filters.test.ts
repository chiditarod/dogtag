import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useUrlFilters } from './use-url-filters';

function setup(url = '/list') {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [url] }, children);
  return renderHook(() => useUrlFilters(), { wrapper });
}

describe('useUrlFilters', () => {
  it('deletes page when another key changes', () => {
    const { result } = setup('/list?page=3&status=paid');
    act(() => result.current.setParams({ q: 'ada' }));
    expect(result.current.params.get('q')).toBe('ada');
    expect(result.current.params.has('page')).toBe(false);
    expect(result.current.params.get('status')).toBe('paid');
  });

  it('keeps page when only page changes', () => {
    const { result } = setup('/list?page=3&q=ada');
    act(() => result.current.setParams({ page: '4' }));
    expect(result.current.params.get('page')).toBe('4');
    expect(result.current.params.get('q')).toBe('ada');
  });

  it("deletes a key set to '' or undefined", () => {
    const { result } = setup('/list?q=ada&status=paid');
    act(() => result.current.setParams({ q: '', status: undefined }));
    expect(result.current.params.has('q')).toBe(false);
    expect(result.current.params.has('status')).toBe(false);
  });

  it('clearParams keeps only the listed keys', () => {
    const { result } = setup('/list?race_id=4&q=ada&page=2');
    act(() => result.current.clearParams(['race_id']));
    expect(result.current.params.toString()).toBe('race_id=4');
    act(() => result.current.clearParams());
    expect(result.current.params.toString()).toBe('');
  });

  it('setParams and clearParams keep their identity across URL changes', () => {
    const { result } = setup('/list');
    const { setParams, clearParams } = result.current;
    act(() => result.current.setParams({ q: 'ada' }));
    act(() => result.current.setParams({ q: 'bob' }));
    expect(result.current.setParams).toBe(setParams);
    expect(result.current.clearParams).toBe(clearParams);
  });
});
