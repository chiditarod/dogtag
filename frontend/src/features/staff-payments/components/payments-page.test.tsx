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

const page: PaymentsResponse = {
  ...emptyPayments,
  payments: [
    payment({ id: 1, team: { id: 11, name: 'The Secret Gents' } }),
    payment({
      id: 2,
      team: { id: 12, name: 'Wheelie Good' },
      status: 'refunded',
      refunded_at: '2026-11-20T18:00:00Z',
      refunded_by: { name: 'Rae Refunder' },
    }),
  ],
  meta: {
    ...emptyPayments.meta,
    total_count: 60,
    total_pages: 3,
    summary: { count: 142, refunded_count: 37, total_cents: 710000, refunded_cents: 185000 },
  },
};

const requests: URL[] = [];

function serve(response: PaymentsResponse = page) {
  requests.length = 0;
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['refunder'] } })),
    http.get('/api/v1/staff/payments', ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(response);
    }),
  );
}

async function open(path = '/staff/payments') {
  const utils = renderApp(path);
  await screen.findByText('The Secret Gents');
  return utils;
}

describe('PaymentsPage', () => {
  it('shows the progress line from summary', async () => {
    serve();
    await open();
    expect(screen.getByText('37 of 142 refunded · $1,850 of $7,100')).toBeInTheDocument();
  });

  it('is read-only: no checkboxes and no refund button', async () => {
    serve();
    await open();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refund/i })).not.toBeInTheDocument();
  });

  it('payment type options follow the chosen race', async () => {
    serve();
    await open();
    const select = screen.getByLabelText(t('staff.payments.filters.type'));
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual([t('staff.payments.filters.allTypes'), 'Cart Deposit', 'Registration']);
    expect(screen.getByLabelText(t('staff.payments.filters.race'))).toHaveValue('4');
  });

  it('all races disables the payment type filter and sends race_id=all', async () => {
    serve({ ...emptyPayments, payments: [payment()], filters: { ...emptyPayments.filters, race_id: 'all', payment_types: [] } });
    await open('/staff/payments?race_id=all');
    expect(requests.at(-1)!.searchParams.get('race_id')).toBe('all');
    expect(screen.getByLabelText(t('staff.payments.filters.type'))).toBeDisabled();
  });

  it('status filter and chips update the URL', async () => {
    serve();
    const { router } = await open();
    await userEvent.click(screen.getByRole('radio', { name: t('staff.payments.filters.statusPaid') }));
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('status')).toBe('paid'));
    expect(router.state.location.search).toContain('status=paid');

    await userEvent.selectOptions(screen.getByLabelText(t('staff.payments.filters.type')), 'Cart Deposit');
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('payment_type')).toBe('7'));

    const chips = screen.getByRole('list', { name: t('staff.payments.filters.active') });
    expect(within(chips).getAllByRole('listitem')).toHaveLength(2);
    await userEvent.click(
      within(chips).getByRole('button', { name: t('staff.payments.filters.remove', { label: 'Paid' }) }),
    );
    await waitFor(() => expect(router.state.location.search).not.toContain('status='));
    await userEvent.click(screen.getByRole('button', { name: t('staff.payments.filters.clearAll') }));
    await waitFor(() => expect(router.state.location.search).not.toContain('payment_type'));
  });

  it('search is debounced', async () => {
    serve();
    await open();
    const before = requests.length;
    await userEvent.type(screen.getByRole('searchbox'), 'ada');
    expect(requests).toHaveLength(before);
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('q')).toBe('ada'), { timeout: 2000 });
    expect(requests).toHaveLength(before + 1);
  });

  it('refunded rows show their refund date', async () => {
    serve();
    await open();
    expect(screen.getByText('Refunded Nov 20')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').filter((row) => row.hasAttribute('data-payment-id'));
    const statusCell = within(rows[0]).getAllByRole('cell').at(-1)!;
    expect(within(statusCell).getByText(t('staff.payments.status.paid'))).toBeInTheDocument();
  });

  it('shows account holder email and the amount', async () => {
    serve();
    await open();
    expect(screen.getAllByText('ada@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$50').length).toBeGreaterThan(0);
  });

  it('pages through the results', async () => {
    serve();
    const { router } = await open();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('staff.payments.prev') })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: t('staff.payments.next') }));
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('page')).toBe('2'));
    expect(router.state.location.search).toContain('page=2');
  });

  it('empty list shows the empty state', async () => {
    serve(emptyPayments);
    renderApp('/staff/payments');
    expect(await screen.findByText(t('staff.payments.empty'))).toBeInTheDocument();
  });

  it('error shows QueryError with retry', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['refunder'] } })),
      http.get('/api/v1/staff/payments', () =>
        HttpResponse.json({ error: 'boom', errors: {} }, { status: 500 }),
      ),
    );
    renderApp('/staff/payments');
    const alert = await screen.findByRole('alert');
    server.use(http.get('/api/v1/staff/payments', () => HttpResponse.json(page)));
    await userEvent.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await screen.findByText('The Secret Gents')).toBeInTheDocument();
  });

  it('at 320px the Filters row opens a sheet', async () => {
    serve();
    await open();
    await userEvent.click(screen.getByRole('button', { name: t('staff.payments.filters.open') }));
    const dialog = await screen.findByRole('dialog', { name: t('staff.payments.filters.sheetTitle') });
    await userEvent.click(within(dialog).getByRole('radio', { name: t('staff.payments.filters.statusRefunded') }));
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('status')).toBe('refunded'));
    await userEvent.click(within(dialog).getByRole('button', { name: t('staff.payments.filters.show_other', { n: 60 }) }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a page past the last one moves to the last page', async () => {
    requests.length = 0;
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['refunder'] } })),
      http.get('/api/v1/staff/payments', ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        const requested = Number(url.searchParams.get('page'));
        return HttpResponse.json(
          requested > 3
            ? { ...page, payments: [], meta: { ...page.meta, page: requested } }
            : { ...page, meta: { ...page.meta, page: requested } },
        );
      }),
    );
    const { router } = renderApp('/staff/payments?page=9');
    expect(await screen.findByText('The Secret Gents')).toBeInTheDocument();
    expect(router.state.location.search).toContain('page=3');
    expect(requests.at(-1)!.searchParams.get('page')).toBe('3');
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
  });

  it('card labels are read with their values (sm:hidden hides them on the table)', async () => {
    serve();
    await open();
    const row = screen.getAllByRole('row').find((r) => r.getAttribute('data-payment-id') === '1')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells[1]).toHaveAccessibleName(`${t('staff.payments.col.owner')} Ada Owner ada@example.com`);
    expect(cells[2]).toHaveAccessibleName(`${t('staff.payments.col.type')} Cart Deposit`);
    expect(cells[3]).toHaveAccessibleName(`${t('staff.payments.col.amount')} $50`);
  });
});
