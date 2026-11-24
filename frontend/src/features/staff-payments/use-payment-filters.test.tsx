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
      status: 'all',
      q: '',
      page: 1,
    });
  });
});
