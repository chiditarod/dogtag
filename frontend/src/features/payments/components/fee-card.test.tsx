import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '@/lib/api-client';
import { openStripeCheckout } from '@/lib/stripe-checkout';
import { buildChecklist, buildRace, buildTeam, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { Checklist, PaymentRequirement, Race } from '@/types/api';

vi.mock('@/lib/stripe-checkout', () => ({ openStripeCheckout: vi.fn() }));
const checkout = vi.mocked(openStripeCheckout);

const requirement: PaymentRequirement = {
  id: 3,
  name: 'Registration fee',
  type: 'PaymentRequirement',
  current_price_cents: 30000,
  next_tier: null,
};

let posts: { path: string; body: unknown }[];
let teamGets: number;

function serve({
  checklist = {},
  race = {},
  paymentResponse,
}: {
  checklist?: Partial<Checklist>;
  race?: Partial<Race>;
  paymentResponse?: () => Response;
} = {}) {
  const team = buildTeam({
    race: buildRace({ payment_requirements: [requirement], ...race }),
    checklist: buildChecklist({
      racers: { filled: 5, total: 5, done: true },
      fee: {
        done: false,
        amount_due_cents: 30000,
        paid_cents: 0,
        next_tier: null,
        requirement_id: 3,
      },
      ...checklist,
    }),
  });
  const paid = buildChecklist({
    fee: { done: true, amount_due_cents: null, paid_cents: 30000, next_tier: null, requirement_id: 3 },
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
        fee: {
          done: false,
          amount_due_cents: 30000,
          paid_cents: 0,
          next_tier: { price_cents: 35050, begins_at: '2027-02-01T06:00:00.000Z' },
          requirement_id: 3,
        },
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
      description: 'Registration fee for Cart Pushers | CHIditarod 2027',
      name: 'CHIditarod 2027',
    });
    const busy = (await card()).getByRole('button', { name: 'Processing…' });
    expect(busy).toBeDisabled();

    resolve({ token: 'tok_1', email: 'pay@example.com' });
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      path: 'payments',
      body: { requirement_id: 3, stripe_token: 'tok_1', stripe_email: 'pay@example.com' },
    });
    expect(await (await card()).findByText('Paid $300')).toBeInTheDocument();
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
    expect(checkout).toHaveBeenCalledTimes(1);
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

  it('shows "Already paid" on a 409 and refetches the team', async () => {
    serve({
      paymentResponse: () =>
        HttpResponse.json({ error: 'duplicate', errors: {} }, { status: 409 }),
    });
    checkout.mockResolvedValue({ token: 'tok_1', email: 'a@example.com' });
    const click = userEvent.setup();
    renderApp('/teams/9');
    await click.click(await payButton());

    expect(await screen.findByText('Already paid')).toBeInTheDocument();
    await waitFor(() => expect(teamGets).toBe(2));
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
    expect(screen.queryByText('Already paid')).not.toBeInTheDocument();
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
        fee: {
          done: true,
          amount_due_cents: null,
          paid_cents: 0,
          next_tier: { price_cents: 30000, begins_at: '2026-12-01T06:00:00.000Z' },
          requirement_id: 3,
        },
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
        fee: { done: true, amount_due_cents: null, paid_cents: 30000, next_tier: null, requirement_id: 3 },
      },
    });
    renderApp('/teams/9');
    const fee = await card();
    expect(await fee.findByText('Paid $300')).toBeInTheDocument();
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
    expect(await (await card()).findByText('Paid $300')).toBeInTheDocument();
  });
});
