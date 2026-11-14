import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '@/lib/api-client';
import { openStripeCheckout } from '@/lib/stripe-checkout';
import { buildChecklist, buildRace, buildTeam, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { Checklist, FeeItem, PaymentRequirement, Race } from '@/types/api';

vi.mock('@/lib/stripe-checkout', () => ({ openStripeCheckout: vi.fn() }));
const checkout = vi.mocked(openStripeCheckout);

const requirement: PaymentRequirement = {
  id: 3,
  name: 'Registration fee',
  type: 'PaymentRequirement',
  current_price_cents: 30000,
  next_tier: null,
};

function item(overrides: Partial<FeeItem> = {}): FeeItem {
  return {
    requirement_id: 3,
    name: 'Registration fee',
    done: false,
    amount_due_cents: 30000,
    paid_cents: 0,
    next_tier: null,
    ...overrides,
  };
}

/** A fee summarising its items the way TeamChecklist does. */
function feeOf(items: FeeItem[], overrides: Partial<Checklist['fee']> = {}): Checklist['fee'] {
  const unpaid = items.filter((line) => !line.done && line.amount_due_cents !== null);
  return {
    done: unpaid.length === 0,
    amount_due_cents: unpaid.length
      ? unpaid.reduce((sum, line) => sum + line.amount_due_cents!, 0)
      : null,
    paid_cents: items.reduce((sum, line) => sum + line.paid_cents, 0),
    next_tier: null,
    requirement_id: unpaid[0]?.requirement_id ?? null,
    items,
    ...overrides,
  };
}

let posts: { path: string; body: unknown }[];
let teamGets: number;

function serve({
  checklist = {},
  race = {},
  paymentResponse,
  refetchedFee,
}: {
  checklist?: Partial<Checklist>;
  race?: Partial<Race>;
  paymentResponse?: () => Response | Promise<Response>;
  /** fee returned by every GET after the first. */
  refetchedFee?: Checklist['fee'];
} = {}) {
  const team = buildTeam({
    race: buildRace({ payment_requirements: [requirement], ...race }),
    checklist: buildChecklist({
      racers: { filled: 5, total: 5, done: true },
      fee: feeOf([item()]),
      ...checklist,
    }),
  });
  const paid = buildChecklist({
    fee: feeOf([item({ done: true, amount_due_cents: null, paid_cents: 30000 })]),
    finalized: true,
    team_number: 12,
  });
  const record = (path: string) => async ({ request }: { request: Request }) => {
    posts.push({ path, body: await request.json() });
    return paymentResponse ? paymentResponse() : HttpResponse.json({ checklist: paid }, { status: 201 });
  };
  server.use(
    http.get('/api/v1/teams/9', () => {
      teamGets += 1;
      if (refetchedFee !== undefined && teamGets > 1) {
        return HttpResponse.json({ team: { ...team, checklist: { ...team.checklist, fee: refetchedFee } } });
      }
      return HttpResponse.json({ team });
    }),
    http.post('/api/v1/teams/9/payments', record('payments')),
    http.post('/api/v1/teams/9/mock_payments', record('mock_payments')),
  );
}

beforeEach(() => {
  posts = [];
  teamGets = 0;
  checkout.mockReset();
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
    http.get('/api/v1/teams/9/past_racers', () => HttpResponse.json({ past_racers: [] })),
  );
});
afterEach(() => clearCsrfToken());

const card = async () => within(await screen.findByRole('group', { name: /Registration fee/ }));
const payButton = async () => (await card()).findByRole('button', { name: 'Pay $300' });

describe('FeeCard', () => {
  it('shows the price, the next tier and a Pay button', async () => {
    serve({
      checklist: {
        fee: feeOf([item({ next_tier: { price_cents: 35050, begins_at: '2027-02-01T06:00:00.000Z' } })]),
      },
    });
    renderApp('/teams/9');
    const fee = await card();
    expect(await fee.findByText('$300', { selector: 'p' })).toBeInTheDocument();
    expect(fee.getByText('Goes to $350.50 on Mon, Feb 1, 2027')).toBeInTheDocument();
    expect(fee.getByRole('button', { name: 'Pay $300' })).toBeEnabled();
  });

  it('opens Checkout once on a double click and posts the token', async () => {
    serve();
    let resolve!: (value: { token: string; email: string } | null) => void;
    checkout.mockReturnValue(new Promise((r) => (resolve = r)));
    const click = userEvent.setup();
    renderApp('/teams/9');
    const button = await payButton();

    await click.dblClick(button);
    expect(checkout).toHaveBeenCalledTimes(1);
    expect(checkout).toHaveBeenCalledWith({
      key: 'pk_test',
      amountCents: 30000,
      email: 'ada@example.com',
      description: 'Registration fee',
      name: 'CHIditarod 2027',
    });
    const busy = (await card()).getByRole('button', { name: 'Processing…' });
    expect(busy).toBeDisabled();

    resolve({ token: 'tok_1', email: 'pay@example.com' });
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      path: 'payments',
      body: {
        requirement_id: 3,
        stripe_token: 'tok_1',
        stripe_email: 'pay@example.com',
        expected_amount_cents: 30000,
      },
    });
    const paid = await (await card()).findByText('Paid $300 total');
    expect(paid).toHaveFocus();
    expect(screen.getByRole('heading', { name: /You're in/ })).toBeInTheDocument();
  });

  it('guards against two clicks landing before React re-renders', async () => {
    serve();
    checkout.mockReturnValue(new Promise(() => {}));
    renderApp('/teams/9');
    const button = await payButton();

    // Both clicks run inside one act(), so the button is still enabled for the second.
    act(() => {
      button.click();
      button.click();
    });
    await waitFor(() => expect(checkout).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50)); // let a (wrongly) second price check finish
    expect(checkout).toHaveBeenCalledTimes(1);
    expect(teamGets).toBe(2);
  });

  it('re-enables silently when the popup is closed without paying', async () => {
    serve();
    checkout.mockResolvedValue(null);
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());

    expect(await payButton()).toBeEnabled();
    expect(posts).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a friendly message when Stripe cannot be loaded', async () => {
    serve();
    checkout.mockRejectedValue(new Error('load failed'));
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());

    expect(
      await screen.findByText('Payment is temporarily unavailable. Please try again.'),
    ).toBeInTheDocument();
    expect(await payButton()).toBeEnabled();
    expect(posts).toHaveLength(0);
  });

  it('shows the server message on a 409 and refetches the team', async () => {
    const message = 'This requirement has already been paid for this team, so your card was not charged.';
    serve({
      paymentResponse: () => HttpResponse.json({ error: message, errors: {} }, { status: 409 }),
    });
    checkout.mockResolvedValue({ token: 'tok_1', email: 'a@example.com' });
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    // initial load, the pre-payment price check, then the invalidation.
    await waitFor(() => expect(teamGets).toBe(3));
  });

  it('shows the server message when a payment is still in progress', async () => {
    serve({
      paymentResponse: () =>
        HttpResponse.json(
          { error: 'A payment for this team is already being processed. Please wait.', errors: {} },
          { status: 409 },
        ),
    });
    checkout.mockResolvedValue({ token: 'tok_1', email: 'a@example.com' });
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());

    expect(await screen.findByText(/already being processed/)).toBeInTheDocument();
  });

  it('shows a card error inline on a 402 and allows a retry', async () => {
    serve({
      paymentResponse: () =>
        HttpResponse.json({ error: 'Your card was declined.', errors: {} }, { status: 402 }),
    });
    checkout.mockResolvedValue({ token: 'tok_1', email: 'a@example.com' });
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());

    const alert = await (await card()).findByRole('alert');
    expect(alert).toHaveTextContent('Your card was declined.');
    expect(await payButton()).toBeEnabled();
  });

  it('reports a 403 as the page banner', async () => {
    serve({
      paymentResponse: () =>
        HttpResponse.json({ error: 'Registration is closed.', errors: {} }, { status: 403 }),
    });
    checkout.mockResolvedValue({ token: 'tok_1', email: 'a@example.com' });
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());

    expect(await screen.findByText('Registration is closed.')).toBeInTheDocument();
    expect((await card()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows another error message inline on a 502', async () => {
    serve({
      paymentResponse: () =>
        HttpResponse.json({ error: 'Stripe is having trouble.', errors: {} }, { status: 502 }),
    });
    checkout.mockResolvedValue({ token: 'tok_1', email: 'a@example.com' });
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());

    expect(await (await card()).findByRole('alert')).toHaveTextContent('Stripe is having trouble.');
    // A lost success must be able to settle: the team is refetched after a non-card failure.
    await waitFor(() => expect(teamGets).toBe(3));
  });

  it('refetches the team after a network failure and shows a generic error', async () => {
    serve({ paymentResponse: () => HttpResponse.error() });
    checkout.mockResolvedValue({ token: 'tok_1', email: 'a@example.com' });
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());

    expect(await (await card()).findByRole('alert')).toHaveTextContent('Something went wrong');
    await waitFor(() => expect(teamGets).toBe(3));
  });

  it('does not refetch after a card decline', async () => {
    serve({
      paymentResponse: () =>
        HttpResponse.json({ error: 'Your card was declined.', errors: {} }, { status: 402 }),
    });
    checkout.mockResolvedValue({ token: 'tok_1', email: 'a@example.com' });
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());
    await (await card()).findByText('Your card was declined.');

    expect(teamGets).toBe(2); // initial load + the pre-payment price check only
  });

  it('does not open Checkout when the price changed; shows the new price and a notice', async () => {
    serve({ refetchedFee: feeOf([item({ amount_due_cents: 35000 })]) });
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());

    const fee = await card();
    expect(await fee.findByText('Registration fee is now $350. Please review and pay again.')).toBeInTheDocument();
    expect(await fee.findByRole('button', { name: 'Pay $350' })).toBeEnabled();
    expect(fee.getByText('$350', { selector: 'p' })).toBeInTheDocument();
    expect(checkout).not.toHaveBeenCalled();
    expect(posts).toHaveLength(0);
  });

  it('does not open Checkout without a publishable key', async () => {
    serve({ race: { stripe_publishable_key: null } });
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());

    expect(
      await screen.findByText('Payment is temporarily unavailable. Please try again.'),
    ).toBeInTheDocument();
    expect(checkout).not.toHaveBeenCalled();
  });

  it('shows a closed message with no button once registration has closed', async () => {
    serve({ race: { open_for_registration: false } });
    renderApp('/teams/9');
    const fee = await card();
    expect(await fee.findByText('Registration is closed.')).toBeInTheDocument();
    expect(fee.queryByRole('button')).not.toBeInTheDocument();
  });

  it('still shows the paid summary on a closed race', async () => {
    serve({
      race: { open_for_registration: false },
      checklist: {
        fee: feeOf([item({ done: true, amount_due_cents: null, paid_cents: 30000 })]),
      },
    });
    renderApp('/teams/9');
    expect(await (await card()).findByText('Paid $300 total')).toBeInTheDocument();
  });

  it("says payment isn't available when there is no amount due and the fee is not done", async () => {
    serve({
      checklist: {
        fee: feeOf([], { done: false }),
      },
    });
    renderApp('/teams/9');
    const fee = await card();
    expect(await fee.findByText("Payment isn't available right now.")).toBeInTheDocument();
    expect(fee.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides Pay and shows the waitlist message when the race is full', async () => {
    serve({ race: { full: true } });
    renderApp('/teams/9');
    const fee = await card();
    expect(await fee.findByText(/on the waitlist/)).toBeInTheDocument();
    expect(fee.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says when the fee opens later, with no button', async () => {
    serve({
      checklist: {
        fee: feeOf(
          [item({ amount_due_cents: null, next_tier: { price_cents: 30000, begins_at: '2026-12-01T06:00:00.000Z' } })],
          { done: true, next_tier: { price_cents: 30000, begins_at: '2026-12-01T06:00:00.000Z' } },
        ),
      },
    });
    renderApp('/teams/9');
    const fee = await card();
    expect(await fee.findByText('Registration fee opens Tue, Dec 1, 2026')).toBeInTheDocument();
    expect(fee.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a paid summary instead of Pay', async () => {
    serve({
      checklist: {
        fee: feeOf([item({ done: true, amount_due_cents: null, paid_cents: 30000 })]),
      },
    });
    renderApp('/teams/9');
    const fee = await card();
    expect(await fee.findByText('Paid $300 total')).toBeInTheDocument();
    expect(fee.queryByRole('button')).not.toBeInTheDocument();
  });

  it('pays with the mock requirement without opening Checkout', async () => {
    serve({
      race: {
        payment_requirements: [{ ...requirement, type: 'MockPaymentRequirement' }],
      },
    });
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await (await card()).findByRole('button', { name: 'Mock pay' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ path: 'mock_payments', body: { requirement_id: 3 } });
    expect(checkout).not.toHaveBeenCalled();
    expect(await (await card()).findByText('Paid $300 total')).toBeInTheDocument();
  });

  describe('with two requirements', () => {
    const deposit: PaymentRequirement = {
      id: 3,
      name: 'Cart Deposit',
      type: 'PaymentRequirement',
      current_price_cents: 8800,
      next_tier: null,
    };
    const registration: PaymentRequirement = {
      id: 4,
      name: 'Race Registration',
      type: 'PaymentRequirement',
      current_price_cents: 13000,
      next_tier: { price_cents: 15000, begins_at: '2027-01-15T06:00:00.000Z' },
    };
    const depositItem = (overrides: Partial<FeeItem> = {}) =>
      item({ requirement_id: 3, name: 'Cart Deposit', amount_due_cents: 8800, ...overrides });
    const registrationItem = (overrides: Partial<FeeItem> = {}) =>
      item({
        requirement_id: 4,
        name: 'Race Registration',
        amount_due_cents: 13000,
        next_tier: { price_cents: 15000, begins_at: '2027-01-15T06:00:00.000Z' },
        ...overrides,
      });
    const depositPaid = feeOf([depositItem({ done: true, amount_due_cents: null, paid_cents: 8800 }), registrationItem()]);
    const row = async (name: string) =>
      within((await (await card()).findByText(name)).closest('li') as HTMLElement);

    function serveTwo(options: Parameters<typeof serve>[0] = {}) {
      serve({
        race: { payment_requirements: [deposit, registration] },
        checklist: { fee: feeOf([depositItem(), registrationItem()]) },
        paymentResponse: () =>
          HttpResponse.json({ checklist: buildChecklist({ fee: depositPaid }) }, { status: 201 }),
        ...options,
      });
    }

    it('renders one row per requirement with its own price, next tier and Pay button', async () => {
      serveTwo();
      renderApp('/teams/9');
      const first = await row('Cart Deposit');
      expect(first.getByText('$88')).toBeInTheDocument();
      expect(first.getByRole('button', { name: 'Pay $88' })).toBeEnabled();
      expect(first.queryByText(/Goes to/)).not.toBeInTheDocument();
      const second = await row('Race Registration');
      expect(second.getByText('$130')).toBeInTheDocument();
      expect(second.getByText('Goes to $150 on Fri, Jan 15, 2027')).toBeInTheDocument();
      expect(second.getByRole('button', { name: 'Pay $130' })).toBeEnabled();
      expect(screen.getByText('$218')).toBeInTheDocument(); // the card pill
    });

    it("pays the first row with its own requirement and amount, then keeps the second payable", async () => {
      serveTwo();
      checkout.mockResolvedValue({ token: 'tok_1', email: 'pay@example.com' });
      const click = userEvent.setup();
      renderApp('/teams/9');
      await click.click((await row('Cart Deposit')).getByRole('button', { name: 'Pay $88' }));

      await waitFor(() => expect(posts).toHaveLength(1));
      expect(checkout).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 8800, description: 'Cart Deposit' }),
      );
      expect(posts[0]).toEqual({
        path: 'payments',
        body: {
          requirement_id: 3,
          stripe_token: 'tok_1',
          stripe_email: 'pay@example.com',
          expected_amount_cents: 8800,
        },
      });
      const paid = await (await row('Cart Deposit')).findByText('Paid $88');
      expect(paid).toHaveFocus();
      expect((await row('Cart Deposit')).queryByRole('button')).not.toBeInTheDocument();
      expect((await row('Race Registration')).getByRole('button', { name: 'Pay $130' })).toBeEnabled();
      expect(screen.getByText('$130', { selector: 'span' })).toBeInTheDocument(); // pill
    });

    it('disables every row while one payment is in progress', async () => {
      serveTwo();
      checkout.mockReturnValue(new Promise(() => {}));
      const click = userEvent.setup();
      renderApp('/teams/9');
      await click.click((await row('Race Registration')).getByRole('button', { name: 'Pay $130' }));

      expect(await (await row('Race Registration')).findByRole('button', { name: 'Processing…' })).toBeDisabled();
      expect((await row('Cart Deposit')).getByRole('button', { name: 'Pay $88' })).toBeDisabled();
    });

    it("aborts Checkout when that row's price changed", async () => {
      serveTwo({ refetchedFee: feeOf([depositItem(), registrationItem({ amount_due_cents: 15000 })]) });
      const click = userEvent.setup();
      renderApp('/teams/9');
      await click.click((await row('Race Registration')).getByRole('button', { name: 'Pay $130' }));

      const second = await row('Race Registration');
      expect(
        await second.findByText('Race Registration is now $150. Please review and pay again.'),
      ).toBeInTheDocument();
      expect(await second.findByRole('button', { name: 'Pay $150' })).toBeEnabled();
      expect(checkout).not.toHaveBeenCalled();
      expect(posts).toHaveLength(0);
    });

    it("still pays a row whose price is unchanged when another row's changed", async () => {
      serveTwo({ refetchedFee: feeOf([depositItem(), registrationItem({ amount_due_cents: 15000 })]) });
      checkout.mockResolvedValue({ token: 'tok_1', email: 'pay@example.com' });
      const click = userEvent.setup();
      renderApp('/teams/9');
      await click.click((await row('Cart Deposit')).getByRole('button', { name: 'Pay $88' }));

      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({ body: { requirement_id: 3, expected_amount_cents: 8800 } });
    });

    it('shows Mock pay on a mock requirement row', async () => {
      serveTwo({ race: { payment_requirements: [deposit, { ...registration, type: 'MockPaymentRequirement' }] } });
      const click = userEvent.setup();
      renderApp('/teams/9');
      expect((await row('Cart Deposit')).getByRole('button', { name: 'Pay $88' })).toBeInTheDocument();
      await click.click((await row('Race Registration')).getByRole('button', { name: 'Mock pay' }));

      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toEqual({ path: 'mock_payments', body: { requirement_id: 4 } });
    });

    it('says when a row opens later, with no button for it', async () => {
      serveTwo({
        checklist: {
          fee: feeOf([
            depositItem(),
            registrationItem({ amount_due_cents: null, next_tier: { price_cents: 13000, begins_at: '2026-12-01T06:00:00.000Z' } }),
          ]),
        },
      });
      renderApp('/teams/9');
      const second = await row('Race Registration');
      expect(second.getByText('Opens Tue, Dec 1, 2026')).toBeInTheDocument();
      expect(second.queryByRole('button')).not.toBeInTheDocument();
      expect((await row('Cart Deposit')).getByRole('button', { name: 'Pay $88' })).toBeEnabled();
    });

    it('shows a paid summary once every row is paid', async () => {
      serveTwo({
        checklist: {
          fee: feeOf([
            depositItem({ done: true, amount_due_cents: null, paid_cents: 8800 }),
            registrationItem({ done: true, amount_due_cents: null, next_tier: null, paid_cents: 13000 }),
          ]),
        },
      });
      renderApp('/teams/9');
      const box = await card();
      expect(await box.findByText('Paid $218 total')).toBeInTheDocument();
      expect(box.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
