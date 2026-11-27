import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { t } from '@/locales/en';
import { server } from '@/test/server';
import { batchItem, refundBatch } from '../test-fixtures';
import type { RefundBatch } from '../types';
import { BatchResults } from './batch-results';

function setup(batchId = 9) {
  const onFinished = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BatchResults batchId={batchId} onFinished={onFinished} />
    </QueryClientProvider>,
  );
  return { onFinished, invalidate };
}

const items3 = (statuses: [string, string?][]) =>
  statuses.map(([status, message], i) =>
    batchItem({ id: i + 1, completed_requirement_id: i + 1, team_name: `Team ${i + 1}`, status: status as 'queued', message: message ?? null }),
  );

const finishedBatch = (id: number, statuses: [string, string?][], extra: Partial<RefundBatch> = {}) =>
  refundBatch({ id, finished_at: '2026-11-24T18:00:05Z', items: items3(statuses), ...extra });

describe('BatchResults', () => {
  it("shows each item's result as polling advances", async () => {
    let calls = 0;
    server.use(
      http.get('/api/v1/staff/refund_batches/9', () => {
        calls += 1;
        return HttpResponse.json({
          batch:
            calls === 1
              ? refundBatch({ items: items3([['refunded'], ['queued']]) })
              : finishedBatch(9, [['refunded'], ['already_refunded']]),
        });
      }),
    );
    const { onFinished } = setup();
    expect(await screen.findByRole('dialog', { name: 'Refunding… 1 of 2 done' })).toBeInTheDocument();
    expect(screen.getByText(t('staff.refund.queued'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('staff.refund.done') })).toBeDisabled();
    // Escape does nothing while the job runs.
    await userEvent.keyboard('{Escape}');
    expect(onFinished).not.toHaveBeenCalled();

    expect(await screen.findByText('Already refunded', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: t('staff.refund.finished') })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t('staff.refund.done') }));
    expect(onFinished).toHaveBeenCalled();
  });

  it('refetches the payments list when the batch finishes', async () => {
    server.use(
      http.get('/api/v1/staff/refund_batches/9', () => HttpResponse.json({ batch: finishedBatch(9, [['refunded']]) })),
    );
    const { invalidate } = setup();
    await screen.findByText('Refunded');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff', 'payments'] });
  });

  it('Retry posts to /retry and follows the new batch, keeping the lines already refunded', async () => {
    let retried = false;
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.get('/api/v1/staff/refund_batches/9', () =>
        HttpResponse.json({ batch: finishedBatch(9, [['refunded'], ['failed', 'Stripe is down'], ['refunded']]) }),
      ),
      http.post('/api/v1/staff/refund_batches/9/retry', () => {
        retried = true;
        return HttpResponse.json({ batch: refundBatch({ id: 10, retry_of_id: 9, items: [batchItem({ id: 7, team_name: 'Team 2', status: 'queued' })] }) }, { status: 201 });
      }),
      http.get('/api/v1/staff/refund_batches/10', () =>
        HttpResponse.json({ batch: finishedBatch(10, [['refunded']], { retry_of_id: 9 }) }),
      ),
    );
    setup();
    expect(await screen.findByText('Failed: Stripe is down')).toBeInTheDocument();
    expect(screen.getByText('2 refunded, 1 need attention.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry 1 failed' }));
    await waitFor(() => expect(retried).toBe(true));
    await waitFor(() => expect(screen.queryByText(/^Failed/)).not.toBeInTheDocument());
    const list = screen.getByRole('list', { name: t('staff.refund.results') });
    await waitFor(() => expect(within(list).getAllByText('Refunded')).toHaveLength(3));
    expect(screen.queryByRole('button', { name: /^Retry/ })).not.toBeInTheDocument();
  });

  it('a stalled item gets a Retry too', async () => {
    server.use(
      http.get('/api/v1/staff/refund_batches/9', () =>
        HttpResponse.json({ batch: refundBatch({ items: items3([['stalled'], ['stalled']]) }) }),
      ),
    );
    setup();
    expect(await screen.findAllByText('Stalled')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Retry 2 failed' })).toBeInTheDocument();
  });

  it('shows the server message when a retry is refused', async () => {
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.get('/api/v1/staff/refund_batches/9', () => HttpResponse.json({ batch: finishedBatch(9, [['failed', 'x']]) })),
      http.post('/api/v1/staff/refund_batches/9/retry', () =>
        HttpResponse.json({ error: 'Nothing to retry.', errors: {}, code: 'nothing_to_retry' }, { status: 422 }),
      ),
    );
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Retry 1 failed' }));
    expect(await screen.findByText('Could not retry: Nothing to retry.')).toBeInTheDocument();
  });

  it('Escape and Done do nothing while a retry request is in flight', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.get('/api/v1/staff/refund_batches/9', () => HttpResponse.json({ batch: finishedBatch(9, [['failed', 'x']]) })),
      http.post('/api/v1/staff/refund_batches/9/retry', async () => {
        await gate;
        return HttpResponse.json({ batch: refundBatch({ id: 10, retry_of_id: 9, items: [batchItem({ status: 'queued' })] }) }, { status: 201 });
      }),
      http.get('/api/v1/staff/refund_batches/10', () => HttpResponse.json({ batch: finishedBatch(10, [['refunded']]) })),
    );
    const { onFinished } = setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Retry 1 failed' }));
    await waitFor(() => expect(screen.getByRole('button', { name: t('staff.refund.done') })).toBeDisabled());
    await userEvent.keyboard('{Escape}');
    expect(onFinished).not.toHaveBeenCalled();
    release();
    await screen.findByText('Refunded');
  });

  it('stops polling once the batch is done', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let calls = 0;
    server.use(
      http.get('/api/v1/staff/refund_batches/9', () => {
        calls += 1;
        return HttpResponse.json({ batch: calls < 2 ? refundBatch({ items: items3([['queued']]) }) : finishedBatch(9, [['refunded']]) });
      }),
    );
    try {
      setup();
      await act(() => vi.advanceTimersByTimeAsync(2100));
      await screen.findByText('Refunded');
      const atDone = calls;
      await act(() => vi.advanceTimersByTimeAsync(10_000));
      expect(calls).toBe(atDone);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refetches the list again when a retry comes back already finished', async () => {
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.get('/api/v1/staff/refund_batches/9', () => HttpResponse.json({ batch: finishedBatch(9, [['failed', 'x']]) })),
      http.post('/api/v1/staff/refund_batches/9/retry', () =>
        HttpResponse.json({ batch: finishedBatch(10, [['refunded']], { retry_of_id: 9 }) }, { status: 201 }),
      ),
      http.get('/api/v1/staff/refund_batches/10', () => HttpResponse.json({ batch: finishedBatch(10, [['refunded']]) })),
    );
    const { invalidate } = setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Retry 1 failed' }));
    await screen.findByText('Refunded');
    const listCalls = () => invalidate.mock.calls.filter(([filters]) => JSON.stringify(filters).includes('payments')).length;
    await waitFor(() => expect(listCalls()).toBe(2));
  });

  it('shows Refunded · Reopened for a reopened item and flags reopen_failed as needing attention', async () => {
    server.use(
      http.get('/api/v1/staff/refund_batches/9', () =>
        HttpResponse.json({
          batch: refundBatch({
            reopen: true,
            finished_at: '2026-11-24T18:00:05Z',
            items: [
              batchItem({ id: 1, team_name: 'Team 1', status: 'refunded', reopened: true }),
              batchItem({
                id: 2,
                team_name: 'Team 2',
                status: 'reopen_failed',
                error_code: 'unexpected',
                message: 'The payment could not be reopened. Try again.',
              }),
              batchItem({ id: 3, team_name: 'Team 3', status: 'refunded' }),
            ],
          }),
        }),
      ),
    );
    setup();
    expect(await screen.findByText('Refunded · Reopened')).toBeInTheDocument();
    expect(screen.getByText('Refunded, but not reopened: The payment could not be reopened. Try again.')).toBeInTheDocument();
    expect(screen.getByText('Refunded', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('2 refunded, 1 need attention.')).toBeInTheDocument();
    expect(document.querySelector('li[data-status="reopen_failed"]')).not.toBeNull();
  });

  it('Retry counts and re-queues reopen_failed items', async () => {
    let retried = false;
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.get('/api/v1/staff/refund_batches/9', () =>
        HttpResponse.json({
          batch: refundBatch({
            reopen: true,
            finished_at: '2026-11-24T18:00:05Z',
            items: [
              batchItem({ id: 1, team_name: 'Team 1', status: 'reopen_failed', message: null }),
              batchItem({ id: 2, team_name: 'Team 2', status: 'refunded', reopened: true }),
            ],
          }),
        }),
      ),
      http.post('/api/v1/staff/refund_batches/9/retry', () => {
        retried = true;
        return HttpResponse.json(
          { batch: finishedBatch(10, [['refunded']], { retry_of_id: 9, reopen: true }) },
          { status: 201 },
        );
      }),
      http.get('/api/v1/staff/refund_batches/10', () =>
        HttpResponse.json({ batch: finishedBatch(10, [['refunded']], { retry_of_id: 9, reopen: true }) }),
      ),
    );
    setup();
    expect(await screen.findByText('Refunded, but not reopened')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry 1 failed' }));
    await waitFor(() => expect(retried).toBe(true));
    await waitFor(() => expect(screen.queryByText('Refunded, but not reopened')).not.toBeInTheDocument());
    expect(screen.getByText('Refunded · Reopened')).toBeInTheDocument();
  });
});
