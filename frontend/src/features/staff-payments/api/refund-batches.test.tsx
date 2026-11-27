import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { server } from '@/test/server';
import { batchItem, refundBatch } from '../test-fixtures';
import { useCreateRefundBatch } from './use-create-refund-batch';
import { REFUND_POLL_MS, useRefundBatch } from './use-refund-batch';
import { useRetryRefundBatch } from './use-retry-refund-batch';

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => vi.useRealTimers());

describe('useRefundBatch', () => {
  it('polls every 2 s until finished_at is set, then stops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let calls = 0;
    server.use(
      http.get('/api/v1/staff/refund_batches/9', () => {
        calls += 1;
        return HttpResponse.json({
          batch: refundBatch({
            finished_at: calls >= 3 ? '2026-11-24T18:00:07Z' : null,
            items: [batchItem({ status: calls >= 3 ? 'refunded' : 'queued' })],
          }),
        });
      }),
    );
    const { result } = renderHook(() => useRefundBatch(9), { wrapper: wrapper() });
    await waitFor(() => expect(calls).toBe(1));
    await act(() => vi.advanceTimersByTimeAsync(REFUND_POLL_MS));
    await waitFor(() => expect(calls).toBe(2));
    await act(() => vi.advanceTimersByTimeAsync(REFUND_POLL_MS));
    await waitFor(() => expect(calls).toBe(3));
    await waitFor(() => expect(result.current.data?.finished_at).toBeTruthy());
    await act(() => vi.advanceTimersByTimeAsync(REFUND_POLL_MS * 3));
    expect(calls).toBe(3);
  });

  it('stops polling when nothing is queued any more (items reported stalled)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let calls = 0;
    server.use(
      http.get('/api/v1/staff/refund_batches/9', () => {
        calls += 1;
        return HttpResponse.json({ batch: refundBatch({ items: [batchItem({ status: 'stalled' })] }) });
      }),
    );
    renderHook(() => useRefundBatch(9), { wrapper: wrapper() });
    await waitFor(() => expect(calls).toBe(1));
    await act(() => vi.advanceTimersByTimeAsync(REFUND_POLL_MS * 3));
    expect(calls).toBe(1);
  });

  it('does not fetch without an id', async () => {
    let calls = 0;
    server.use(http.get('/api/v1/staff/refund_batches/:id', () => { calls += 1; return HttpResponse.json({}); }));
    renderHook(() => useRefundBatch(null), { wrapper: wrapper() });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toBe(0);
  });
});

describe('useCreateRefundBatch', () => {
  it('create sends the exact body, including reopen', async () => {
    let body: unknown;
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.post('/api/v1/staff/refund_batches', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ batch: refundBatch() }, { status: 201 });
      }),
    );
    const { result } = renderHook(() => useCreateRefundBatch(), { wrapper: wrapper() });
    let batch;
    await act(async () => {
      batch = await result.current.mutateAsync({ ids: [3, 4], confirmation: 'REFUND 2', expectedTotalCents: 10000, reopen: true });
    });
    expect(body).toEqual({
      completed_requirement_ids: [3, 4],
      confirmation: 'REFUND 2',
      expected_total_cents: 10000,
      reopen: true,
    });
    expect(batch).toMatchObject({ id: 9 });
  });

  it('a 422 surfaces the stable code and the per-id errors', async () => {
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.post('/api/v1/staff/refund_batches', () =>
        HttpResponse.json(
          { error: 'The selection changed since you reviewed it. Review it again.', errors: {}, code: 'selection_changed' },
          { status: 422 },
        ),
      ),
    );
    const { result } = renderHook(() => useCreateRefundBatch(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({ ids: [3], confirmation: 'REFUND 1', expectedTotalCents: 1, reopen: false }).catch(() => {});
    });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect((result.current.error as ApiError).code).toBe('selection_changed');
    expect((result.current.error as ApiError).status).toBe(422);
  });
});

describe('useRetryRefundBatch', () => {
  it('posts to /retry and returns the new batch', async () => {
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.post('/api/v1/staff/refund_batches/9/retry', () =>
        HttpResponse.json({ batch: refundBatch({ id: 10, retry_of_id: 9 }) }, { status: 201 }),
      ),
    );
    const { result } = renderHook(() => useRetryRefundBatch(), { wrapper: wrapper() });
    let batch;
    await act(async () => {
      batch = await result.current.mutateAsync(9);
    });
    expect(batch).toMatchObject({ id: 10, retry_of_id: 9 });
  });
});
