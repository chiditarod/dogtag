import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { t } from '@/locales/en';
import { server } from '@/test/server';
import { payment, refundBatch } from '../test-fixtures';
import type { StaffPayment } from '../types';
import { ConfirmRefundDialog } from './confirm-refund-dialog';

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    payment({ id: i + 1, team: { id: 100 + i, name: `Team ${i + 1}` }, owner: { name: `Owner ${i + 1}`, email: `owner${i + 1}@example.com` } }),
  );

function setup(
  snapshot: StaffPayment[] = rows(5),
  { current, latestRows }: { current?: Map<number, StaffPayment>; latestRows?: StaffPayment[] } = {},
) {
  const onConfirmed = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <ConfirmRefundDialog
        snapshot={snapshot}
        current={current ?? new Map(snapshot.map((row) => [row.id, row]))}
        latestRows={latestRows ?? snapshot}
        onConfirmed={onConfirmed}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onConfirmed, onClose, ...view };
}

const confirmButton = (n = 5) =>
  screen.getByRole('button', { name: n === 1 ? 'Refund 1 payment' : `Refund ${n} payments` });
const typeInto = (text: string) => userEvent.type(screen.getByLabelText(/^Type REFUND/), text);

describe('ConfirmRefundDialog', () => {
  it('lists every payment and the total', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Refund 5 payments?' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: t('staff.refund.list') });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(within(list).getByText('Team 3')).toBeInTheDocument();
    expect(within(list).getByText('owner3@example.com')).toBeInTheDocument();
    expect(screen.getByText('Total: $250')).toBeInTheDocument();
    expect(screen.getByText(t('staff.refund.irreversible'))).toBeInTheDocument();
    expect(screen.getByText(t('staff.refund.emailNote'))).toBeInTheDocument();
  });

  it('uses the singular for one payment', () => {
    setup(rows(1));
    expect(screen.getByRole('dialog', { name: 'Refund 1 payment?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Type REFUND 1 to confirm')).toBeInTheDocument();
    expect(confirmButton(1)).toBeDisabled();
  });

  it("Confirm stays disabled for 'REFUND 4' and 'REFUND 50' and enables for ' refund 5 '", async () => {
    setup();
    await typeInto('REFUND 4');
    expect(confirmButton()).toBeDisabled();
    await userEvent.clear(screen.getByLabelText(/^Type REFUND/));
    await typeInto('REFUND 50');
    expect(confirmButton()).toBeDisabled();
    await userEvent.clear(screen.getByLabelText(/^Type REFUND/));
    await typeInto(' refund 5 ');
    expect(confirmButton()).toBeEnabled();
  });

  it('enables for exactly REFUND 5 and posts ids, confirmation and expected total', async () => {
    let body: unknown;
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.post('/api/v1/staff/refund_batches', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ batch: refundBatch({ id: 12 }) }, { status: 201 });
      }),
    );
    const { onConfirmed } = setup();
    await typeInto('REFUND 5');
    await userEvent.click(confirmButton());
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
    expect(body).toEqual({ completed_requirement_ids: [1, 2, 3, 4, 5], confirmation: 'REFUND 5', expected_total_cents: 25000 });
    expect(onConfirmed.mock.calls[0][0]).toMatchObject({ id: 12 });
  });

  it('refuses when a refetch shows a selected row refunded', async () => {
    const snapshot = rows(2);
    setup(snapshot, { latestRows: [snapshot[0], { ...snapshot[1], status: 'refunded' }] });
    await typeInto('REFUND 2');
    expect(screen.getByText(t('staff.refund.changed'))).toBeInTheDocument();
    expect(confirmButton(2)).toBeDisabled();
  });

  it('refuses when a refetch shows a changed amount', async () => {
    const snapshot = rows(2);
    setup(snapshot, { latestRows: [snapshot[0], { ...snapshot[1], amount_cents: 6000 }] });
    await typeInto('REFUND 2');
    expect(confirmButton(2)).toBeDisabled();
  });

  it('refuses when the selection changed', async () => {
    const snapshot = rows(2);
    setup(snapshot, { current: new Map([[1, snapshot[0]]]) });
    await typeInto('REFUND 2');
    expect(screen.getByText(t('staff.refund.changed'))).toBeInTheDocument();
    expect(confirmButton(2)).toBeDisabled();
  });

  it("shows the server's selection_changed message", async () => {
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.post('/api/v1/staff/refund_batches', () =>
        HttpResponse.json({ error: 'x', errors: {}, code: 'selection_changed' }, { status: 422 }),
      ),
    );
    const { onConfirmed } = setup(rows(2));
    await typeInto('REFUND 2');
    await userEvent.click(confirmButton(2));
    expect(await screen.findByText(t('staff.refund.error.selection_changed'))).toBeInTheDocument();
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('not_refundable names the failing teams', async () => {
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.post('/api/v1/staff/refund_batches', () =>
        HttpResponse.json({ error: 'x', errors: { '2': ['already refunded'] }, code: 'not_refundable' }, { status: 422 }),
      ),
    );
    setup(rows(2));
    await typeInto('REFUND 2');
    await userEvent.click(confirmButton(2));
    expect(await screen.findByText(/Team 2 \(already refunded\)/)).toBeInTheDocument();
  });

  it('Escape and Cancel do nothing while submitting; Escape closes otherwise', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
      http.post('/api/v1/staff/refund_batches', async () => {
        await gate;
        return HttpResponse.json({ batch: refundBatch() }, { status: 201 });
      }),
    );
    const { onClose, onConfirmed } = setup(rows(1));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    await typeInto('REFUND 1');
    await userEvent.click(confirmButton(1));
    await waitFor(() => expect(screen.getByRole('button', { name: t('staff.refund.cancel') })).toBeDisabled());
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
  });
});
