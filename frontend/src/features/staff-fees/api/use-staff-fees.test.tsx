import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { feeResponse, feeTier } from '../test-fixtures';
import { feeKey, raceFeesKey, useAddPrice, useCreateFee, useDeleteFee, useDeletePrice, useRenameFee, useUpdatePrice } from './use-staff-fees';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

function seed(client: QueryClient) {
  client.setQueryData(raceFeesKey(1), { stale: true });
  client.setQueryData(['staff', 'races'], { stale: true });
  client.setQueryData(['staff', 'races', '1'], { stale: true });
}

function expectInvalidated(client: QueryClient) {
  expect(client.getQueryState(raceFeesKey(1))?.isInvalidated).toBe(true);
  expect(client.getQueryState(['staff', 'races'])?.isInvalidated).toBe(true);
  expect(client.getQueryState(['staff', 'races', '1'])?.isInvalidated).toBe(true);
}

describe('fee writes', () => {
  it('store the returned fee and refresh the fee lists and the races', async () => {
    const { client, wrapper } = setup();
    seed(client);
    const response = feeResponse({ id: 10, tiers: [feeTier({ id: 5 })] });
    let body: unknown;
    server.use(
      http.post('/api/v1/staff/requirements/10/tiers', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(response, { status: 201 });
      }),
      http.patch('/api/v1/staff/tiers/5', () => HttpResponse.json(response)),
      http.delete('/api/v1/staff/tiers/5', () => HttpResponse.json(response)),
      http.patch('/api/v1/staff/requirements/10', () => HttpResponse.json(response)),
      http.post('/api/v1/staff/races/1/requirements', () => HttpResponse.json(response, { status: 201 })),
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
    );

    const { result } = renderHook(
      () => ({
        add: useAddPrice(10),
        update: useUpdatePrice(5, 10),
        remove: useDeletePrice(5, 10),
        rename: useRenameFee(10),
        create: useCreateFee(1),
      }),
      { wrapper },
    );
    const runs: Array<() => Promise<unknown>> = [
      () => result.current.add.mutateAsync({ price: 14000, begin_at: '2027-02-01T06:00:00Z' }),
      () => result.current.update.mutateAsync({ price: 15000 }),
      () => result.current.remove.mutateAsync(),
      () => result.current.rename.mutateAsync('New name'),
      () =>
        result.current.create.mutateAsync({
          requirement: { name: 'Fee', type: 'PaymentRequirement' },
          tier: { price: 14000, begin_at: '2027-02-01T06:00:00Z' },
        }),
    ];
    for (const run of runs) {
      client.removeQueries({ queryKey: feeKey(10) });
      seed(client);
      await act(async () => {
        await run();
      });
      expect(client.getQueryData(feeKey(10))).toEqual(response);
      expectInvalidated(client);
    }
    expect(body).toEqual({ tier: { price: 14000, begin_at: '2027-02-01T06:00:00Z' } });
  });

  it('drops a deleted fee from the cache and refreshes the lists', async () => {
    const { client, wrapper } = setup();
    seed(client);
    client.setQueryData(feeKey(10), feeResponse());
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.delete('/api/v1/staff/requirements/10', () => new HttpResponse(null, { status: 204 })),
    );
    const { result } = renderHook(() => useDeleteFee(10), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    await waitFor(() => expect(client.getQueryData(feeKey(10))).toBeUndefined());
    expectInvalidated(client);
  });
});
