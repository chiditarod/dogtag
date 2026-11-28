import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { usePaymentFilters } from './use-payment-filters';

function setup(url = '/staff/payments') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(() => usePaymentFilters(), { wrapper });
}

describe('usePaymentFilters', () => {
  it('reads defaults: status all, page 1', () => {
    const { result } = setup();
    expect(result.current.values).toEqual({
      raceId: undefined,
      paymentType: undefined,
      teamId: undefined,
      status: 'all',
      q: '',
      page: 1,
    });
  });

  it('reads race, type, status, q and page from the URL', () => {
    const { result } = setup('/x?race_id=4&payment_type=9&status=paid&q=ada&page=3');
    expect(result.current.values).toEqual({
      raceId: 4,
      paymentType: 9,
      teamId: undefined,
      status: 'paid',
      q: 'ada',
      page: 3,
    });
    expect(setup('/x?race_id=all').result.current.values.raceId).toBe('all');
  });

  it('setting q resets page', () => {
    const { result } = setup('/x?page=3');
    act(() => result.current.setFilter('q', 'ada'));
    expect(result.current.values).toMatchObject({ q: 'ada', page: 1 });
  });

  it('setting page keeps the page', () => {
    const { result } = setup();
    act(() => result.current.setFilter('page', 2));
    expect(result.current.values.page).toBe(2);
  });

  it('changing race drops payment_type', () => {
    const { result } = setup('/x?race_id=4&payment_type=9');
    act(() => result.current.setFilter('raceId', 5));
    expect(result.current.values).toMatchObject({ raceId: 5, paymentType: undefined });
  });

  it('clearAll keeps the race and drops the rest', () => {
    const { result } = setup('/x?race_id=4&payment_type=9&status=paid&q=a&page=2');
    act(() => result.current.clearAll());
    expect(result.current.values).toEqual({
      raceId: 4,
      paymentType: undefined,
      teamId: undefined,
      status: 'all',
      q: '',
      page: 1,
    });
  });

  it('Browse accepts only the paid and refunded statuses', () => {
    expect(setup('/x?status=refunded').result.current.values.status).toBe('refunded');
    expect(setup('/x?status=refunding').result.current.values.status).toBe('all');
    expect(setup('/x?status=not_refundable').result.current.values.status).toBe('all');
  });

  it('setFilter and clearAll keep their identity when the URL changes', () => {
    const { result } = setup();
    const { setFilter, clearAll } = result.current;
    act(() => result.current.setFilter('status', 'paid'));
    expect(result.current.values.status).toBe('paid');
    expect(result.current.setFilter).toBe(setFilter);
    expect(result.current.clearAll).toBe(clearAll);
  });

  it('ignores out-of-range and junk params', () => {
    const { result } = setup('/x?page=-1&race_id=abc&payment_type=0&status=bogus');
    expect(result.current.values).toEqual({
      raceId: undefined,
      paymentType: undefined,
      teamId: undefined,
      status: 'all',
      q: '',
      page: 1,
    });
    expect(setup('/x?page=2.5&race_id=-4').result.current.values).toMatchObject({ page: 1, raceId: undefined });
  });

  it('reads team_id from the URL and ignores junk', () => {
    expect(setup('/x?team_id=7').result.current.values.teamId).toBe(7);
    expect(setup('/x?team_id=x').result.current.values.teamId).toBeUndefined();
    expect(setup('/x?team_id=0').result.current.values.teamId).toBeUndefined();
  });

  it('changing race drops team_id and payment_type; other filters keep team_id', () => {
    const { result } = setup('/x?race_id=4&payment_type=9&team_id=7');
    act(() => result.current.setFilter('status', 'paid'));
    expect(result.current.values).toMatchObject({ teamId: 7, paymentType: 9 });
    act(() => result.current.setFilter('raceId', 5));
    expect(result.current.values).toMatchObject({ raceId: 5, paymentType: undefined, teamId: undefined });
  });

  it("removeTeam pins the team's race only when the URL names none", () => {
    const bare = setup('/x?team_id=7&payment_type=9');
    act(() => bare.result.current.removeTeam(4));
    expect(bare.result.current.values).toMatchObject({ raceId: 4, teamId: undefined, paymentType: 9 });

    const withRace = setup('/x?race_id=3&team_id=7');
    act(() => withRace.result.current.removeTeam(4));
    expect(withRace.result.current.values).toMatchObject({ raceId: 3, teamId: undefined });

    const all = setup('/x?race_id=all&team_id=7');
    act(() => all.result.current.removeTeam(4));
    expect(all.result.current.values).toMatchObject({ raceId: 'all', teamId: undefined });

    const unknown = setup('/x?team_id=7');
    act(() => unknown.result.current.removeTeam(undefined));
    expect(unknown.result.current.values).toMatchObject({ raceId: undefined, teamId: undefined });
  });

  it("clearAll keeps the team's race when the URL names none", () => {
    const { result } = setup('/x?team_id=7&q=ada&status=paid');
    act(() => result.current.clearAll(true, 4));
    expect(result.current.values).toMatchObject({ raceId: 4, teamId: undefined, q: '', status: 'paid' });
  });

  it('removeTeam and clearAll keep one identity across URL changes', () => {
    const { result } = setup('/x?team_id=7');
    const { removeTeam, clearAll } = result.current;
    act(() => result.current.setFilter('q', 'ada'));
    expect(result.current.removeTeam).toBe(removeTeam);
    expect(result.current.clearAll).toBe(clearAll);
  });

  it('clearAll drops team_id and keeps the race', () => {
    const { result } = setup('/x?race_id=4&team_id=7');
    act(() => result.current.clearAll());
    expect(result.current.values).toMatchObject({ raceId: 4, teamId: undefined });
  });
});
