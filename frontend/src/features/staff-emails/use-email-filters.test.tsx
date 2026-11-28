import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useEmailFilters } from './use-email-filters';

function setup(url = '/staff/emails') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(() => useEmailFilters(), { wrapper });
}

describe('useEmailFilters', () => {
  it('defaults to no filters on page 1', () => {
    expect(setup().result.current.values).toEqual({
      teamId: undefined,
      userId: undefined,
      status: 'any',
      kind: undefined,
      recipient: '',
      page: 1,
    });
  });

  it('reads every key from the URL', () => {
    const { values } = setup('/x?team_id=7&user_id=12&status=failed&kind=welcome&recipient=ada&page=3').result.current;
    expect(values).toEqual({ teamId: 7, userId: 12, status: 'failed', kind: 'welcome', recipient: 'ada', page: 3 });
  });

  it('reads a status the page does not offer as any', () => {
    expect(setup('/x?status=delivered').result.current.values.status).toBe('any');
    expect(setup('/x?status=').result.current.values.status).toBe('any');
  });

  it('ignores a junk team id, user id or page', () => {
    expect(setup('/x?team_id=abc&user_id=-1&page=-2').result.current.values).toMatchObject({
      teamId: undefined,
      userId: undefined,
      page: 1,
    });
    expect(setup('/x?user_id=1.5').result.current.values.userId).toBeUndefined();
  });

  it('a change drops the page; page keeps the filters; any and undefined remove their keys', () => {
    const { result } = setup('/x?team_id=7&status=failed&page=3');
    act(() => result.current.setFilter('kind', 'welcome'));
    expect(result.current.values).toMatchObject({ teamId: 7, status: 'failed', kind: 'welcome', page: 1 });
    act(() => result.current.setFilter('page', 2));
    expect(result.current.values).toMatchObject({ kind: 'welcome', page: 2 });
    act(() => result.current.setFilter('status', 'any'));
    act(() => result.current.setFilter('teamId', undefined));
    expect(result.current.values).toMatchObject({ teamId: undefined, status: 'any', kind: 'welcome' });
  });

  it('clearAll drops everything', () => {
    const { result } = setup('/x?team_id=7&user_id=12&status=failed&recipient=ada&page=2');
    act(() => result.current.clearAll());
    expect(result.current.values).toMatchObject({ teamId: undefined, userId: undefined, status: 'any', recipient: '', page: 1 });
  });
});
