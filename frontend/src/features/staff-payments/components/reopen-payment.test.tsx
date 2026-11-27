import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import { emptyPayments, payment } from '../test-fixtures';
import type { PaymentsResponse } from '../types';

const refundedBase = { status: 'refunded' as const, refunded_at: '2026-11-20T18:00:00Z', refunded_by: { name: 'Rae Refunder' } };

const rows = [
  payment({ id: 1, team: { id: 11, name: 'Paid Team' } }),
  payment({ id: 2, team: { id: 12, name: 'Refunded Team' }, ...refundedBase }),
  payment({
    id: 3,
    team: { id: 13, name: 'Reopened Team' },
    ...refundedBase,
    reopened_at: '2026-11-22T18:00:00Z',
    reopened_by: { name: 'Opal Operator' },
  }),
];

function serve({ canReopen, reopenResponse }: { canReopen: boolean; reopenResponse?: () => Response }) {
  const state = { reopened: false, calls: [] as string[], lists: 0 };
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: [canReopen ? 'operator' : 'refunder'] } })),
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'x' })),
    http.get('/api/v1/staff/payments', () => {
      state.lists += 1;
      const payments = rows.map((row) =>
        row.id === 2 && state.reopened
          ? { ...row, reopened_at: '2026-11-25T18:00:00Z', reopened_by: { name: 'Opal Operator' } }
          : row,
      );
      const response: PaymentsResponse = { ...emptyPayments, payments, can_reopen: canReopen };
      return HttpResponse.json(response);
    }),
    http.post('/api/v1/staff/payments/:id/reopen', ({ params }) => {
      state.calls.push(String(params.id));
      if (reopenResponse) return reopenResponse();
      state.reopened = true;
      return HttpResponse.json({
        id: Number(params.id),
        message: 'The payment was reopened. The team can pay again.',
        reopened_at: '2026-11-25T18:00:00Z',
        reopened_by: { name: 'Opal Operator' },
      });
    }),
  );
  return state;
}

const row = (id: number) => screen.getAllByRole('row').find((r) => r.getAttribute('data-payment-id') === String(id))!;

describe('Reopen payment', () => {
  it('shows a Reopened badge with who and when on a reopened row, and no action on it', async () => {
    serve({ canReopen: true });
    renderApp('/staff/payments');
    await screen.findByText('Reopened Team');
    const reopened = within(row(3));
    expect(reopened.getByText(t('staff.payments.reopened'))).toBeInTheDocument();
    expect(reopened.getByText('Reopened Nov 22 by Opal Operator')).toBeInTheDocument();
    expect(reopened.queryByRole('button')).not.toBeInTheDocument();
    // The paid row has no action either.
    expect(within(row(1)).queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers the action on a refunded row only when can_reopen is true', async () => {
    serve({ canReopen: false });
    renderApp('/staff/payments');
    await screen.findByText('Refunded Team');
    expect(screen.queryByRole('button', { name: /Reopen payment/ })).not.toBeInTheDocument();
  });

  it('confirms in a dialog, calls the endpoint and refreshes the list', async () => {
    const state = serve({ canReopen: true });
    renderApp('/staff/payments');
    await screen.findByText('Refunded Team');
    expect(screen.getAllByRole('button', { name: /^Reopen payment for/ })).toHaveLength(1);
    const listsBefore = state.lists;

    await userEvent.click(screen.getByRole('button', { name: 'Reopen payment for Refunded Team' }));
    const dialog = await screen.findByRole('dialog', { name: t('staff.reopen.title') });
    expect(within(dialog).getByText(t('staff.reopen.effect'))).toBeInTheDocument();
    expect(within(dialog).getByText('Refunded Team: Cart Deposit, $50, refunded.')).toBeInTheDocument();
    // Cancel leaves everything alone.
    await userEvent.click(within(dialog).getByRole('button', { name: t('staff.reopen.cancel') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state.calls).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Reopen payment for Refunded Team' }));
    await userEvent.click(await screen.findByRole('button', { name: t('staff.reopen.confirm') }));
    await waitFor(() => expect(state.calls).toEqual(['2']));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(state.lists).toBeGreaterThan(listsBefore));
    await waitFor(() => expect(within(row(2)).getByText(t('staff.payments.reopened'))).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^Reopen payment for/ })).not.toBeInTheDocument();
  });

  it.each([
    ['not_refunded', 422, t('staff.reopen.error.not_refunded')],
    ['in_progress', 409, t('staff.reopen.error.in_progress')],
  ])('shows the %s error and keeps the dialog open', async (code, status, message) => {
    serve({
      canReopen: true,
      reopenResponse: () => HttpResponse.json({ error: 'server words', errors: {}, code }, { status }),
    });
    renderApp('/staff/payments');
    await screen.findByText('Refunded Team');
    await userEvent.click(screen.getByRole('button', { name: 'Reopen payment for Refunded Team' }));
    await userEvent.click(await screen.findByRole('button', { name: t('staff.reopen.confirm') }));
    const dialog = screen.getByRole('dialog', { name: t('staff.reopen.title') });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
  });

  it("falls back to the server's message for other errors", async () => {
    serve({
      canReopen: true,
      reopenResponse: () => HttpResponse.json({ error: 'You are not allowed to do that.', errors: {} }, { status: 403 }),
    });
    renderApp('/staff/payments');
    await screen.findByText('Refunded Team');
    await userEvent.click(screen.getByRole('button', { name: 'Reopen payment for Refunded Team' }));
    await userEvent.click(await screen.findByRole('button', { name: t('staff.reopen.confirm') }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You are not allowed to do that.');
  });

  it('Refund mode shows no Reopen action', async () => {
    serve({ canReopen: true });
    renderApp('/staff/payments');
    await screen.findByText('Refunded Team');
    await userEvent.click(screen.getByRole('button', { name: t('staff.payments.refundMode.enter') }));
    expect(screen.queryByRole('button', { name: /^Reopen payment for/ })).not.toBeInTheDocument();
    expect(within(row(3)).queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
