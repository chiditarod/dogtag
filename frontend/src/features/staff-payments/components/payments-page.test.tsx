import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import { emptyPayments, payment } from '../test-fixtures';
import type { RegistrationStatus } from '@/types/api';
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
  afterEach(() => vi.restoreAllMocks());

  it('shows the progress line from summary', async () => {
    serve();
    await open();
    expect(screen.getByText('37 of 142 refunded · $1,850 of $7,100')).toBeInTheDocument();
  });

  it('Browse is read-only: no checkboxes, and no bottom bar', async () => {
    serve();
    await open();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('staff.payments.refundMode.enter') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Review and refund/ })).not.toBeInTheDocument();
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

  it('pages through the results and scrolls back to the top', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    serve();
    const { router } = await open();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('staff.payments.prev') })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: t('staff.payments.next') }));
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('page')).toBe('2'));
    expect(router.state.location.search).toContain('page=2');
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    // The arrows are decoration, so the buttons read just Prev and Next.
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
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

  it('the Filters button opens a sheet that sets the status', async () => {
    serve();
    await open();
    await userEvent.click(screen.getByRole('button', { name: t('staff.payments.filters.open') }));
    const dialog = await screen.findByRole('dialog', { name: t('staff.payments.filters.sheetTitle') });
    await userEvent.click(within(dialog).getByRole('radio', { name: t('staff.payments.filters.statusRefunded') }));
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('status')).toBe('refunded'));
    await userEvent.click(await within(dialog).findByRole('button', { name: t('staff.payments.filters.show_other', { n: 60 }) }));
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

  it('an unknown race id says the race was not found instead of All races', async () => {
    serve({ ...emptyPayments, filters: { ...emptyPayments.filters, race_id: null, payment_types: [] } });
    renderApp('/staff/payments?race_id=999');
    expect(await screen.findByText(t('staff.payments.raceNotFound'))).toBeInTheDocument();
    const select = screen.getByLabelText(t('staff.payments.filters.race'));
    expect(select).toHaveValue('999');
    expect(within(select).getByRole('option', { selected: true })).toHaveTextContent(
      t('staff.payments.filters.raceNotFound'),
    );
    expect(screen.queryByText(t('staff.payments.empty'))).not.toBeInTheDocument();
  });

  it('while a filter change loads, the list is busy and the sheet waits for the new count', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['refunder'] } })),
      http.get('/api/v1/staff/payments', async ({ request }) => {
        if (new URL(request.url).searchParams.get('status') === 'refunded') {
          await held;
          return HttpResponse.json({ ...page, meta: { ...page.meta, total_count: 1, total_pages: 1 } });
        }
        return HttpResponse.json(page);
      }),
    );
    renderApp('/staff/payments');
    await screen.findByText('The Secret Gents');
    const list = screen.getByRole('table', { name: t('staff.payments.list') }).closest('[aria-busy]')!;
    expect(list).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toHaveTextContent(t('staff.payments.count_other', { n: 60 }));

    await userEvent.click(screen.getByRole('button', { name: t('staff.payments.filters.open') }));
    const dialog = await screen.findByRole('dialog', { name: t('staff.payments.filters.sheetTitle') });
    await userEvent.click(within(dialog).getByRole('radio', { name: t('staff.payments.filters.statusRefunded') }));
    await waitFor(() => expect(list).toHaveAttribute('aria-busy', 'true'));
    expect(list).toHaveClass('opacity-60');
    expect(within(dialog).getByRole('button', { name: t('staff.payments.filters.showPending') })).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent('');

    release();
    expect(await within(dialog).findByRole('button', { name: t('staff.payments.filters.show_one', { n: 1 }) })).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent(t('staff.payments.count_one', { n: 1 }));
    expect(list).toHaveAttribute('aria-busy', 'false');
  });

  it('Clear all drops a search still waiting on the debounce', async () => {
    serve();
    const { router } = await open('/staff/payments?status=paid');
    await userEvent.type(screen.getByRole('searchbox'), 'ada');
    await userEvent.click(screen.getByRole('button', { name: t('staff.payments.filters.clearAll') }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(router.state.location.search).toBe('');
    expect(requests.some((url) => url.searchParams.has('q'))).toBe(false);
  });

  it('race options name the registration status, or show an unknown one as sent', async () => {
    const races = [
      ...emptyPayments.filters.races,
      { id: 2, name: 'CHIditarod 2024', registration_status: 'paused' as RegistrationStatus },
    ];
    serve({ ...page, filters: { ...page.filters, races } });
    await open();
    const select = screen.getByLabelText(t('staff.payments.filters.race'));
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      t('staff.payments.filters.allRaces'),
      'CHIditarod 2026 (open)',
      'CHIditarod 2025 (closed)',
      'CHIditarod 2024 (paused)',
    ]);
  });

  it('the search box follows a removed search chip', async () => {
    serve();
    const { router } = await open('/staff/payments?q=ada');
    expect(screen.getByRole('searchbox')).toHaveValue('ada');
    const chips = screen.getByRole('list', { name: t('staff.payments.filters.active') });
    await userEvent.click(
      within(chips).getByRole('button', {
        name: t('staff.payments.filters.remove', { label: t('staff.payments.filters.searchChip', { q: 'ada' }) }),
      }),
    );
    await waitFor(() => expect(router.state.location.search).not.toContain('q='));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('a whitespace-only search sends nothing and surrounding spaces are trimmed', async () => {
    serve();
    const { router } = await open();
    const before = requests.length;
    await userEvent.type(screen.getByRole('searchbox'), '   ');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(requests).toHaveLength(before);
    expect(router.state.location.search).toBe('');

    await userEvent.type(screen.getByRole('searchbox'), 'ada ');
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('q')).toBe('ada'), { timeout: 2000 });
    expect(screen.getByRole('searchbox')).toHaveValue('   ada ');
  });

  it('a refunded payment with no refund date reads Refunded', async () => {
    serve({ ...page, payments: [payment({ status: 'refunded', refunded_at: null })] });
    renderApp('/staff/payments');
    expect(await screen.findByText(t('staff.payments.status.refundedUndated'))).toBeInTheDocument();
  });
});

const eight = (from = 1) =>
  Array.from({ length: 8 }, (_, i) =>
    payment({ id: from + i, team: { id: 100 + from + i, name: `Team ${from + i}` } }),
  );

const refundPage: PaymentsResponse = {
  ...emptyPayments,
  payments: [...eight(), payment({ id: 20, team: { id: 120, name: 'Already Refunded' }, status: 'refunded', refunded_at: '2026-11-20T18:00:00Z' })],
  meta: { ...emptyPayments.meta, total_count: 60, total_pages: 3, refund_batch_limit: 5 },
};

async function openRefundMode(path = '/staff/payments', response = refundPage) {
  serve(response);
  const utils = renderApp(path);
  await screen.findByText('Team 1');
  await userEvent.click(screen.getByRole('button', { name: t('staff.payments.refundMode.enter') }));
  return utils;
}

const boxes = () => screen.getAllByRole('checkbox') as HTMLInputElement[];

describe('PaymentsPage Refund mode', () => {
  it('only paid rows have enabled checkboxes', async () => {
    await openRefundMode();
    expect(boxes()).toHaveLength(8);
    expect(boxes().every((box) => !box.disabled)).toBe(true);
    const refundedRow = screen.getAllByRole('row').find((row) => row.getAttribute('data-payment-id') === '20')!;
    expect(within(refundedRow).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('stops at refund_batch_limit and disables the rest with the cap note', async () => {
    await openRefundMode();
    for (const box of boxes().slice(0, 5)) await userEvent.click(box);
    const unticked = boxes().filter((box) => !box.checked);
    expect(unticked).toHaveLength(3);
    expect(unticked.every((box) => box.disabled)).toBe(true);
    const note = screen.getByText(t('staff.payments.capReached', { limit: 5 }));
    expect(unticked[0]).toHaveAccessibleDescription(note.textContent!);
    // Unticking one frees the others.
    await userEvent.click(boxes()[0]);
    expect(boxes().filter((box) => !box.checked).every((box) => !box.disabled)).toBe(true);
  });

  it('Select next N ticks the first paid rows up to the cap', async () => {
    await openRefundMode();
    await userEvent.click(screen.getByRole('button', { name: 'Select next 5' }));
    expect(boxes().filter((box) => box.checked)).toHaveLength(5);
    expect(boxes().slice(0, 5).every((box) => box.checked)).toBe(true);
    expect(screen.getByRole('button', { name: 'Select next 5' })).toBeDisabled();
  });

  it('selection survives moving to page 2', async () => {
    await openRefundMode();
    await userEvent.click(boxes()[0]);
    await userEvent.click(boxes()[1]);
    serve({ ...refundPage, payments: eight(30), meta: { ...refundPage.meta, page: 2 } });
    await userEvent.click(screen.getByRole('button', { name: t('staff.payments.next') }));
    await screen.findByText('Team 30');
    expect(screen.getByText('2 of 5 selected · $100')).toBeInTheDocument();
    await userEvent.click(boxes()[0]);
    expect(screen.getByText('3 of 5 selected · $150')).toBeInTheDocument();
  });

  it('changing race clears the selection', async () => {
    await openRefundMode();
    await userEvent.click(boxes()[0]);
    expect(screen.getByText('1 of 5 selected · $50')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(t('staff.payments.filters.race')), '3');
    await waitFor(() => expect(screen.getByText('0 of 5 selected · $0')).toBeInTheDocument());
  });

  it('entering refund mode locks status to Paid and Cancel returns to Browse', async () => {
    const { router } = await openRefundMode();
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('status')).toBe('paid'));
    expect(router.state.location.search).toContain('status=paid');
    expect(screen.getByRole('heading', { name: t('staff.payments.refundMode.title') })).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByText(t('staff.payments.refundMode.banner', { limit: 5 }))).toBeInTheDocument();

    await userEvent.click(boxes()[0]);
    await userEvent.click(screen.getByRole('button', { name: t('staff.payments.refundMode.cancel') }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t('staff.payments.heading') })).toBeInTheDocument();
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeEnabled();
    // Selection was cleared: re-entering starts empty.
    await userEvent.click(screen.getByRole('button', { name: t('staff.payments.refundMode.enter') }));
    expect(screen.getByText('0 of 5 selected · $0')).toBeInTheDocument();
  });

  it('Clear all keeps the Paid status in Refund mode', async () => {
    const { router } = await openRefundMode('/staff/payments?q=ada');
    await waitFor(() => expect(router.state.location.search).toContain('status=paid'));
    await userEvent.click(screen.getAllByRole('button', { name: t('staff.payments.filters.clearAll') })[0]);
    await waitFor(() => expect(router.state.location.search).not.toContain('q='));
    expect(router.state.location.search).toContain('status=paid');
  });

  it('the bottom bar shows count and total', async () => {
    await openRefundMode();
    const review = screen.getByRole('button', { name: 'Review and refund 0…' });
    expect(review).toBeDisabled();
    await userEvent.click(boxes()[0]);
    await userEvent.click(boxes()[1]);
    expect(screen.getByText('2 of 5 selected · $100')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review and refund 2…' })).toBeEnabled();
  });
});
