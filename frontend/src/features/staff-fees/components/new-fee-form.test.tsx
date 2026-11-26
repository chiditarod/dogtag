import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { FeeResponse } from '../api/types';
import { feeRace, feeResponse, raceOverview, TIME_ZONES } from '../test-fixtures';

const race = feeRace({ id: 7 });
const created = (): FeeResponse => feeResponse({ id: 55, race_id: 7, name: 'Cart Deposit' }, { id: 7 });

function serve({
  roles = ['admin'],
  types = ['PaymentRequirement'],
  post,
}: { roles?: string[]; types?: string[]; post?: () => Response } = {}) {
  const bodies: unknown[] = [];
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles } })),
    http.get('/api/v1/staff/races/7/requirements', () => HttpResponse.json({ race, requirements: [], types })),
    http.post('/api/v1/staff/races/7/requirements', async ({ request }) => {
      bodies.push(await request.json());
      return post ? post() : HttpResponse.json(created(), { status: 201 });
    }),
    http.get('/api/v1/staff/requirements/55', () => HttpResponse.json(created())),
    http.get('/api/v1/staff/races/7', () =>
      HttpResponse.json({ race: raceOverview(7), time_zones: TIME_ZONES }),
    ),
    http.get('/api/v1/staff/races', () => HttpResponse.json({ races: [] })),
  );
  return bodies;
}

async function open(options?: Parameters<typeof serve>[0]) {
  const bodies = serve(options);
  const rendered = renderApp('/staff/races/7/requirements/new');
  await screen.findByRole('heading', { name: 'Add a fee', level: 1 });
  return { ...rendered, bodies };
}

const nameInput = () => screen.getByRole('textbox', { name: 'Name' });
const priceInput = () => screen.getByRole('textbox', { name: 'First price' });
const startsInput = () => screen.getByLabelText('Starts') as HTMLInputElement;
const dialog = () => screen.queryByRole('dialog', { name: t('staff.discard.title') });

describe('staff add-a-fee page', () => {
  it('shows Page not found for a race the server does not know', async () => {
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['admin'] } })),
      http.get('/api/v1/staff/races/99/requirements', () =>
        HttpResponse.json({ error: 'Not found', errors: {} }, { status: 404 }),
      ),
    );
    renderApp('/staff/races/99/requirements/new');
    expect(await screen.findByRole('heading', { name: t('notFound.heading') })).toBeInTheDocument();
  });

  it('prefills Starts from registration opening in the race zone and defaults to a card payment', async () => {
    await open();
    expect(startsInput().value).toBe('2026-12-07T12:00');
    expect(screen.getByText('CST')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveValue('PaymentRequirement');
    expect(screen.getByText('Prefilled with registration opening. You can add more prices after saving.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ CHIditarod 2027' })).toHaveAttribute('href', '/register/staff/races/7');
  });

  it('offers the test payment type, with its help, only when the server lists it', async () => {
    const { unmount } = await open();
    expect(screen.queryByText(/is offered on staging and local only/)).not.toBeInTheDocument();
    unmount();

    await open({ types: ['PaymentRequirement', 'MockPaymentRequirement'] });
    expect(screen.getByRole('option', { name: 'Test payment (no card)' })).toBeInTheDocument();
    expect(screen.getByText('"Test payment (no card)" is offered on staging and local only.')).toBeInTheDocument();
  });

  it('shows what racers pay once the price is valid', async () => {
    await open();
    await userEvent.type(priceInput(), '50');
    expect(screen.getByText('Racers pay $50 from Mon, Dec 7, 2026, 12:00 PM CST')).toBeInTheDocument();
  });

  it('refuses a blank name and a part-dollar price without posting', async () => {
    const { bodies } = await open();
    await userEvent.type(priceInput(), '1.50');
    await userEvent.click(screen.getByRole('button', { name: 'Add fee' }));
    expect(await screen.findByText('Whole dollars only, $1 or more.')).toBeInTheDocument();
    expect(screen.getByText(t('staff.fees.nameBlank'))).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('posts the fee with its first price and opens the new fee without asking to discard', async () => {
    const { bodies, router } = await open();
    await userEvent.type(nameInput(), 'Cart Deposit');
    await userEvent.type(priceInput(), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Add fee' }));

    expect(await screen.findByRole('heading', { name: 'Cart Deposit', level: 1 })).toBeInTheDocument();
    expect(bodies).toEqual([
      { requirement: { name: 'Cart Deposit', type: 'PaymentRequirement' }, tier: { price: 5000, begin_at: '2026-12-07T12:00' } },
    ]);
    expect(router.state.location.pathname).toBe('/register/staff/races/7/requirements/55');
    expect(dialog()).not.toBeInTheDocument();
  });

  it("shows the server's errors under their fields", async () => {
    await open({
      post: () =>
        HttpResponse.json(
          {
            error: 'Invalid',
            errors: {
              name: ['has already been taken'],
              'tier.price': ['must be a whole number of dollars'],
              'tier.begin_at': ['is invalid'],
              base: ['Race is closed'],
            },
          },
          { status: 422 },
        ),
    });
    await userEvent.type(nameInput(), 'Cart Deposit');
    await userEvent.type(priceInput(), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Add fee' }));

    expect(await screen.findByText('must be a whole number of dollars')).toBeInTheDocument();
    expect(priceInput()).toHaveAccessibleDescription('must be a whole number of dollars');
    expect(screen.getByText('has already been taken')).toBeInTheDocument();
    expect(screen.getByText('is invalid')).toBeInTheDocument();
    expect(screen.getByText(/Race is closed/)).toBeInTheDocument();
  });

  it('drops the error banner once the only errored field is edited', async () => {
    await open({
      post: () => HttpResponse.json({ error: 'Invalid', errors: { 'tier.price': ['is too low'] } }, { status: 422 }),
    });
    await userEvent.type(nameInput(), 'Cart Deposit');
    await userEvent.type(priceInput(), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Add fee' }));
    expect(await screen.findByText('is too low')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.type(priceInput(), '0');
    expect(screen.queryByText('is too low')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the generic error for a failure with no field errors', async () => {
    await open({ post: () => HttpResponse.json({ error: 'Boom', errors: {} }, { status: 500 }) });
    await userEvent.type(nameInput(), 'Cart Deposit');
    await userEvent.type(priceInput(), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Add fee' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
  });

  it('asks to discard when a field was changed, and Keep editing stays', async () => {
    const { router } = await open();
    await userEvent.type(nameInput(), 'Cart');
    await userEvent.click(screen.getByRole('link', { name: '‹ CHIditarod 2027' }));

    expect(await screen.findByRole('dialog', { name: t('staff.discard.title') })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t('staff.discard.keepEditing') }));
    await waitFor(() => expect(dialog()).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/register/staff/races/7/requirements/new');
    expect(nameInput()).toHaveValue('Cart');
  });

  it('leaves an untouched form without asking', async () => {
    const { router } = await open();
    await userEvent.click(screen.getByRole('link', { name: '‹ CHIditarod 2027' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/register/staff/races/7'));
    expect(dialog()).not.toBeInTheDocument();
  });

  it('is not allowed for a refunder', async () => {
    serve({ roles: ['refunder'] });
    renderApp('/staff/races/7/requirements/new');
    expect(await screen.findByRole('heading', { name: t('staff.notAllowed.heading') })).toBeInTheDocument();
  });
});
