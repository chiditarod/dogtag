import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { server } from '@/test/server';
import type { RegistrationsResponse } from '../types';
import { registrationsQueryKey, useRegistrations } from './use-registrations';

function setup(raceId: number) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useRegistrations(raceId), { wrapper });
}

const data: RegistrationsResponse = {
  race: {
    id: 7,
    name: 'Race 27',
    time_zone: 'America/Chicago',
    max_teams: 100,
    finalized_count: 0,
    full: false,
    open_for_registration: true,
  },
  filter_fields: [],
  registering_kind: 'registering',
  viewer: { staff: false, can_email: false },
  finalized: [],
  registering: [],
  emails: null,
};

describe('useRegistrations', () => {
  it('loads the race registrations', async () => {
    server.use(http.get('/api/v1/races/7/registrations', () => HttpResponse.json(data)));
    const { result } = setup(7);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(registrationsQueryKey(7)).toEqual(['registrations', 7]);
  });

  it('surfaces an unknown race as a 404 ApiError without retrying', async () => {
    let calls = 0;
    server.use(
      http.get('/api/v1/races/8/registrations', () => {
        calls += 1;
        return HttpResponse.json({ error: 'Not found', errors: {} }, { status: 404 });
      }),
    );
    const { result } = setup(8);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(404);
    expect(calls).toBe(1);
  });

  it('does not fetch for an invalid race id', () => {
    const { result } = setup(Number.NaN);
    expect(result.current.fetchStatus).toBe('idle');
  });
});
