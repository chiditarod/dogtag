import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { Fee, FeeResponse } from '../api/types';
import { feeResponse, feeTier, raceOverview, TIME_ZONES } from '../test-fixtures';

interface Sent {
  method: string;
  url: string;
  body: unknown;
}

/** Serves the fee page; price writes are recorded and answered by `reply` (default: 200 with the same fee). */
function serve(response: FeeResponse, roles: string[], reply?: (sent: Sent) => Response) {
  const sent: Sent[] = [];
  const write = async ({ request }: { request: Request }) => {
    const body = request.method === 'DELETE' ? null : await request.json();
    const record = { method: request.method, url: new URL(request.url).pathname, body };
    sent.push(record);
    return reply ? reply(record) : HttpResponse.json(response);
  };
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles } })),
    http.get(`/api/v1/staff/requirements/${response.requirement.id}`, () => HttpResponse.json(response)),
    http.post(`/api/v1/staff/requirements/${response.requirement.id}/tiers`, write),
    http.patch('/api/v1/staff/tiers/:id', write),
    http.delete('/api/v1/staff/tiers/:id', write),
    http.get(`/api/v1/staff/races/${response.race.id}`, () =>
      HttpResponse.json({ race: raceOverview(response.race.id), time_zones: TIME_ZONES }),
    ),
    http.get('/api/v1/staff/races', () => HttpResponse.json({ races: [] })),
  );
  return sent;
}

const fee = (overrides: Partial<Fee> = {}) => feeResponse({ id: 3, race_id: 7, ...overrides }, { id: 7 });

const NEXT = feeTier({ id: 2, price_cents: 14000, begin_at: '2027-02-01T06:00:00Z', status: 'next' });
const CURRENT = feeTier({ id: 1 });

async function open(response: FeeResponse, roles = ['admin'], reply?: (sent: Sent) => Response) {
  const sent = serve(response, roles, reply);
  const rendered = renderApp(`/staff/races/${response.race.id}/requirements/${response.requirement.id}`);
  await screen.findByRole('heading', { name: response.requirement.name, level: 1 });
  return { ...rendered, sent };
}

const table = () => screen.getByRole('table', { name: t('staff.fees.prices') });
const rowOf = (text: string) => within(table()).getByText(text).closest('[role=row]') as HTMLElement;
const priceInput = () => screen.getByLabelText('Price') as HTMLInputElement;
const startsInput = () => screen.getByLabelText('Starts') as HTMLInputElement;
const back = () => screen.getByRole('link', { name: '‹ CHIditarod 2027' });
const discard = () => screen.queryByRole('dialog', { name: t('staff.discard.title') });

async function typePrice(text: string) {
  await userEvent.clear(priceInput());
  if (text) await userEvent.type(priceInput(), text);
}

const startAt = (wall: string) => fireEvent.change(startsInput(), { target: { value: wall } });

describe('prices table', () => {
  it('lists the prices with their start in the race zone and a status', async () => {
    await open(fee());
    expect(screen.getByText('A team pays the price in effect when it pays, not when it registered.')).toBeInTheDocument();
    expect(screen.getByText("Changing a price only affects teams that haven't paid yet.")).toBeInTheDocument();

    const first = rowOf('$120');
    expect(within(first).getByText(/Mon, Dec 7, 2026, 12:00 AM CST/)).toBeInTheDocument();
    expect(within(first).getByText('Current')).toBeInTheDocument();
    const second = rowOf('$140');
    expect(within(second).getByText(/Mon, Feb 1, 2027, 12:00 AM CST/)).toBeInTheDocument();
    expect(within(second).getByText('Next')).toBeInTheDocument();
  });

  it('labels later and past prices', async () => {
    await open(
      fee({
        tiers: [
          feeTier({ id: 1, status: 'past' }),
          feeTier({ id: 2, price_cents: 13000, begin_at: '2027-01-01T06:00:00Z', status: 'current' }),
          NEXT,
          feeTier({ id: 3, price_cents: 15000, begin_at: '2027-03-01T06:00:00Z', status: 'later' }),
        ],
      }),
    );
    expect(within(rowOf('$120')).getByText('Past')).toBeInTheDocument();
    expect(within(rowOf('$150')).getByText('Later')).toBeInTheDocument();
  });

  it('says so when the fee has no prices yet', async () => {
    await open(fee({ tiers: [], current_tier: null, next_tier: null }));
    expect(screen.getByText('No prices yet.')).toBeInTheDocument();
  });
});

describe('adding a price', () => {
  it('blocks part dollars with "Whole dollars only" and sends nothing', async () => {
    const { sent } = await open(fee());
    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    await typePrice('0.50');
    startAt('2027-03-01T00:00');
    await userEvent.click(screen.getByRole('button', { name: 'Add price' }));

    expect(await screen.findByText('Whole dollars only, $1 or more.')).toBeInTheDocument();
    expect(priceInput()).toHaveAccessibleDescription(/Whole dollars only/);
    expect(sent).toEqual([]);
  });

  it('refuses a price the fee already has, without a request', async () => {
    const { sent } = await open(fee());
    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    await typePrice('$120');
    startAt('2027-03-01T00:00');
    await userEvent.click(screen.getByRole('button', { name: 'Add price' }));

    expect(await screen.findByText('This fee already has a $120 price.')).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('shows the problems on blur, before Save', async () => {
    await open(fee());
    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    await userEvent.type(priceInput(), '1.5');
    await userEvent.tab();
    expect(screen.getByText('Whole dollars only, $1 or more.')).toBeInTheDocument();
  });

  it('POSTs the dollars as cents and the wall clock as typed', async () => {
    const { sent } = await open(fee({ tiers: [CURRENT] }));
    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    await typePrice('140');
    startAt('2027-02-01T00:00');
    expect(screen.getByText('Racers pay $140 from Mon, Feb 1, 2027, 12:00 AM CST')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add price' }));

    await waitFor(() =>
      expect(sent).toEqual([
        {
          method: 'POST',
          url: '/api/v1/staff/requirements/3/tiers',
          body: { tier: { price: 14000, begin_at: '2027-02-01T00:00' } },
        },
      ]),
    );
    // The saved fee comes back and the form closes.
    await waitFor(() => expect(screen.queryByLabelText('Price')).not.toBeInTheDocument());
  });

  it('shows a server error under Starts and keeps the form open', async () => {
    await open(fee({ tiers: [CURRENT] }), ['admin'], () =>
      HttpResponse.json({ error: 'Invalid', errors: { begin_at: ['must be after registration opens'] } }, { status: 422 }),
    );
    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    await typePrice('140');
    startAt('2027-02-01T00:00');
    await userEvent.click(screen.getByRole('button', { name: 'Add price' }));

    expect(await screen.findByText('must be after registration opens')).toBeInTheDocument();
    expect(startsInput()).toHaveAccessibleDescription(/must be after registration opens/);
    expect(priceInput()).toHaveValue('140');
  });

  it('warns, without blocking Save, when the first price starts after registration opens', async () => {
    const { sent } = await open(
      fee({
        tiers: [feeTier({ id: 1, begin_at: '2027-01-01T06:00:00Z', status: 'next' })],
        current_tier: null,
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    expect(
      screen.getByText(
        "The first price starts Jan 1, after registration opens (Dec 7). Teams can't pay this fee from Dec 7 to Jan 1.",
      ),
    ).toBeInTheDocument();

    await typePrice('140');
    startAt('2027-02-01T00:00');
    await userEvent.click(screen.getByRole('button', { name: 'Add price' }));
    await waitFor(() => expect(sent).toHaveLength(1));
  });

  it('drops the warning once the new price starts early enough', async () => {
    await open(fee({ tiers: [feeTier({ id: 1, begin_at: '2027-01-01T06:00:00Z', status: 'next' })], current_tier: null }));
    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    await typePrice('90');
    startAt('2026-12-07T10:00');
    expect(screen.queryByText(/The first price starts/)).not.toBeInTheDocument();
  });

  it('opens one form at a time', async () => {
    await open(fee());
    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    expect(screen.getByRole('button', { name: '+ Add a price' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit $120 price' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Price')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit $120 price' }));
    expect(screen.getAllByLabelText('Price')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '+ Add a price' })).toBeDisabled();
  });
});

describe('editing a price', () => {
  it('shows the current values and sends only the price when only the price changed', async () => {
    const { sent } = await open(fee());
    await userEvent.click(screen.getByRole('button', { name: 'Edit $120 price' }));
    expect(priceInput()).toHaveValue('120');
    expect(startsInput()).toHaveValue('2026-12-07T00:00');

    await typePrice('125');
    await userEvent.click(screen.getByRole('button', { name: 'Save price' }));
    await waitFor(() =>
      expect(sent).toEqual([{ method: 'PATCH', url: '/api/v1/staff/tiers/1', body: { tier: { price: 12500 } } }]),
    );
  });

  it('sends only the start when only the start changed', async () => {
    const { sent } = await open(fee());
    await userEvent.click(screen.getByRole('button', { name: 'Edit $140 price' }));
    startAt('2027-02-15T12:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save price' }));
    await waitFor(() =>
      expect(sent).toEqual([{ method: 'PATCH', url: '/api/v1/staff/tiers/2', body: { tier: { begin_at: '2027-02-15T12:00' } } }]),
    );
  });

  it("does not report the edited price's own price or start as duplicates, but another's", async () => {
    await open(fee());
    await userEvent.click(screen.getByRole('button', { name: 'Edit $120 price' }));

    // Its own values, typed again: fine.
    await typePrice('120');
    await userEvent.tab();
    startAt('2026-12-07T00:00');
    await userEvent.click(priceInput());
    await userEvent.tab();
    expect(screen.queryByText(/already has a/)).not.toBeInTheDocument();
    expect(screen.queryByText(/already starts at this time/)).not.toBeInTheDocument();

    // The other price's values are duplicates.
    await typePrice('140');
    await userEvent.tab();
    expect(screen.getByText('This fee already has a $140 price.')).toBeInTheDocument();
    startAt('2027-02-01T00:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save price' }));
    expect(await screen.findByText('A price already starts at this time.')).toBeInTheDocument();
  });

  it('computes the first-price warning over the prices as they would be after the save', async () => {
    await open(fee());
    await userEvent.click(screen.getByRole('button', { name: 'Edit $120 price' }));
    expect(screen.queryByText(/The first price starts/)).not.toBeInTheDocument();
    // Moving the only early price past registration opening leaves a gap.
    startAt('2027-01-10T00:00');
    expect(screen.getByText(/The first price starts Jan 10, after registration opens \(Dec 7\)/)).toBeInTheDocument();
  });
});

describe('deleting a price', () => {
  it('offers no Delete to an operator', async () => {
    await open(fee({ tiers: [CURRENT, NEXT].map((tier) => ({ ...tier, can_destroy: false })) }), ['operator']);
    expect(screen.queryByRole('button', { name: /^Delete \$/ })).not.toBeInTheDocument();
  });

  it('disables Delete with the reason when the server blocks it', async () => {
    await open(
      fee({
        tiers: [
          { ...CURRENT, destroy_blocked_reason: 'Teams have paid this fee, so it keeps one price.' },
          NEXT,
        ],
      }),
    );
    const button = screen.getByRole('button', { name: 'Delete $120 price' });
    expect(button).toBeDisabled();
    expect(within(rowOf('$120')).getByText('Teams have paid this fee, so it keeps one price.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete $140 price' })).toBeEnabled();
  });

  it('confirms before deleting', async () => {
    const { sent } = await open(fee());
    await userEvent.click(screen.getByRole('button', { name: 'Delete $140 price' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete the $140 price?' });
    expect(sent).toEqual([]);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(sent).toEqual([{ method: 'DELETE', url: '/api/v1/staff/tiers/2', body: null }]));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("shows the server's reason when it refuses", async () => {
    await open(fee(), ['admin'], () =>
      HttpResponse.json({ error: 'A paid fee must keep one price.', errors: {}, code: 'only_price_of_paid_fee' }, { status: 422 }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete $140 price' }));
    const confirm = await screen.findByRole('dialog');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('A paid fee must keep one price.');
  });
});

describe('price form and the leave guard', () => {
  it('asks before leaving with a price typed into the add form', async () => {
    await open(fee());
    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    await typePrice('140');
    await userEvent.click(back());
    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
  });

  it('does not ask for an add form nobody typed into', async () => {
    const { router } = await open(fee());
    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    await userEvent.click(back());
    await waitFor(() => expect(router.state.location.pathname).toBe('/register/staff/races/7'));
    expect(discard()).not.toBeInTheDocument();
  });

  it('does not ask for an edit form with the same amount written another way', async () => {
    const { router } = await open(fee());
    await userEvent.click(screen.getByRole('button', { name: 'Edit $120 price' }));
    await typePrice('$120.00');
    await userEvent.click(back());
    await waitFor(() => expect(router.state.location.pathname).toBe('/register/staff/races/7'));
    expect(discard()).not.toBeInTheDocument();
  });

  it('asks once an edit form differs', async () => {
    await open(fee());
    await userEvent.click(screen.getByRole('button', { name: 'Edit $120 price' }));
    await typePrice('125');
    await userEvent.click(back());
    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
  });

  it('is clean after Cancel and after a saved price', async () => {
    const { router } = await open(fee({ tiers: [CURRENT] }));
    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    await typePrice('140');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: '+ Add a price' }));
    await typePrice('150');
    startAt('2027-03-01T00:00');
    await userEvent.click(screen.getByRole('button', { name: 'Add price' }));
    await waitFor(() => expect(screen.queryByLabelText('Price')).not.toBeInTheDocument());

    await userEvent.click(back());
    await waitFor(() => expect(router.state.location.pathname).toBe('/register/staff/races/7'));
    expect(discard()).not.toBeInTheDocument();
  });
});
