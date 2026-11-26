import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import { staffRace, TIME_ZONES } from '@/features/staff-races/test-fixtures';
import type { Fee, FeeResponse } from '../api/types';
import { feeResponse } from '../test-fixtures';

const here = (router: { state: { location: { pathname: string; search: string } } }) =>
  router.state.location.pathname;

function serve(response: FeeResponse, roles = ['admin']) {
  let current = response;
  const requests: { method: string; body: unknown }[] = [];
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles } })),
    http.get(`/api/v1/staff/requirements/${response.requirement.id}`, () => HttpResponse.json(current)),
    http.patch(`/api/v1/staff/requirements/${response.requirement.id}`, async ({ request }) => {
      const body = (await request.json()) as { requirement: { name: string } };
      requests.push({ method: 'PATCH', body });
      current = { ...current, requirement: { ...current.requirement, name: body.requirement.name } };
      return HttpResponse.json(current);
    }),
    http.delete(`/api/v1/staff/requirements/${response.requirement.id}`, () => {
      requests.push({ method: 'DELETE', body: null });
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`/api/v1/staff/races/${response.race.id}`, () =>
      HttpResponse.json({ race: staffRace({ id: response.race.id }), time_zones: TIME_ZONES }),
    ),
    http.get('/api/v1/staff/races', () => HttpResponse.json({ races: [] })),
  );
  return requests;
}

const fee = (overrides: Partial<Fee> = {}) => feeResponse({ id: 3, race_id: 7, ...overrides }, { id: 7 });

async function open(response: FeeResponse, roles?: string[]) {
  const requests = serve(response, roles);
  const rendered = renderApp(`/staff/races/${response.race.id}/requirements/${response.requirement.id}`);
  await screen.findByRole('heading', { name: response.requirement.name, level: 1 });
  return { ...rendered, requests };
}

const nameInput = () => screen.getByRole('textbox', { name: 'Name' });
const dialog = () => screen.queryByRole('dialog', { name: t('staff.discard.title') });

describe('staff fee page header and Right now', () => {
  it('shows the back link, the name, the type and that racers can pay', async () => {
    await open(fee());
    expect(screen.getByRole('link', { name: '‹ CHIditarod 2027' })).toHaveAttribute('href', '/register/staff/races/7');
    expect(screen.getByText(/^Card payment/)).toBeInTheDocument();
    expect(screen.getByText('Racers can pay')).toBeInTheDocument();
  });

  it('says when the only prices start later, and when there are none', async () => {
    const later = fee({ current_tier: null, next_tier: { price_cents: 14000, begin_at: '2027-02-01T06:00:00Z' } });
    const { unmount } = await open(later);
    expect(screen.getByText('Racers can pay from Mon, Feb 1, 2027')).toBeInTheDocument();
    unmount();

    await open(fee({ current_tier: null, next_tier: null, tiers: [] }));
    expect(screen.getByText("No price: racers can't pay")).toBeInTheDocument();
  });

  it('shows both prices in the race zone and the paid teams with a payments link', async () => {
    await open(fee({ paid_team_count: 112 }));
    const card = screen.getByRole('region', { name: 'Right now' });
    expect(within(card).getByText('$120 since Mon, Dec 7, 2026, 12:00 AM CST')).toBeInTheDocument();
    expect(within(card).getByText('$140 from Mon, Feb 1, 2027, 12:00 AM CST')).toBeInTheDocument();
    expect(within(card).getByText(/112 teams/)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'see payments' })).toHaveAttribute(
      'href',
      '/register/staff/payments?race_id=7&payment_type=3&status=paid',
    );
  });

  it('says so when there is no price in effect, no later price and no teams', async () => {
    await open(fee({ current_tier: null, next_tier: null, tiers: [], paid_team_count: 0 }));
    const card = screen.getByRole('region', { name: 'Right now' });
    expect(within(card).getByText('No price in effect')).toBeInTheDocument();
    expect(within(card).getByText('No later price')).toBeInTheDocument();
    expect(within(card).getByText('No teams yet')).toBeInTheDocument();
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows Page not found for a fee of another race', async () => {
    serve(fee({ race_id: 8 }));
    renderApp('/staff/races/7/requirements/3');
    expect(await screen.findByRole('heading', { name: t('notFound.heading') })).toBeInTheDocument();
  });
});

describe('staff fee page delete', () => {
  it('offers no Delete to an operator', async () => {
    await open(fee({ can_destroy: false }), ['operator']);
    expect(screen.queryByRole('button', { name: 'Delete fee' })).not.toBeInTheDocument();
  });

  it('disables Delete for an admin and says why when teams paid', async () => {
    await open(
      fee({ can_destroy: true, destroy_blocked_reason: "Can't delete: 112 teams have paid it.", paid_team_count: 112 }),
    );
    expect(screen.getByRole('button', { name: 'Delete fee' })).toBeDisabled();
    expect(screen.getByText("Can't delete: 112 teams have paid it.")).toBeInTheDocument();
  });

  it('confirms, deletes and lands on the race overview with no discard dialog, even with an edited name', async () => {
    const { router, requests } = await open(fee());
    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), 'Something else');

    await userEvent.click(screen.getByRole('button', { name: 'Delete fee' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete Registration Fee?' });
    expect(requests).toEqual([]);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete fee' }));

    await waitFor(() => expect(here(router)).toBe('/register/staff/races/7'));
    expect(requests).toEqual([{ method: 'DELETE', body: null }]);
    expect(dialog()).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'CHIditarod 2027', level: 1 })).toBeInTheDocument();
  });

  it('keeps the fee when the server refuses, and shows its message', async () => {
    const { router } = await open(fee());
    server.use(
      http.delete('/api/v1/staff/requirements/3', () =>
        HttpResponse.json({ error: 'Teams have paid this fee.', errors: {}, code: 'fee_has_payments' }, { status: 422 }),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete fee' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete Registration Fee?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete fee' }));

    expect(await within(confirm).findByRole('alert')).toHaveTextContent('Teams have paid this fee.');
    expect(here(router)).toBe('/register/staff/races/7/requirements/3');
  });
});

describe('staff fee page name', () => {
  it('sends only the name, then shows the saved one', async () => {
    const { requests } = await open(fee());
    const save = screen.getByRole('button', { name: 'Save name' });
    expect(save).toBeDisabled();
    expect(screen.getByText("Racers see this name on their team's fee card and receipt.")).toBeInTheDocument();

    await userEvent.clear(nameInput());
    expect(save).toBeDisabled();
    await userEvent.type(nameInput(), 'Cart Deposit');
    expect(save).toBeEnabled();
    await userEvent.click(save);

    expect(await screen.findByRole('heading', { name: 'Cart Deposit', level: 1 })).toBeInTheDocument();
    expect(requests).toEqual([{ method: 'PATCH', body: { requirement: { name: 'Cart Deposit' } } }]);
    expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled();
  });

  it('shows the server error under the name', async () => {
    await open(fee());
    server.use(
      http.patch('/api/v1/staff/requirements/3', () =>
        HttpResponse.json({ error: 'Invalid', errors: { name: ['has already been taken'] } }, { status: 422 }),
      ),
    );
    await userEvent.type(nameInput(), ' 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('has already been taken')).toBeInTheDocument();
    expect(nameInput()).toHaveAccessibleDescription(/has already been taken/);
  });
});

describe('staff fee page leave guard', () => {
  const back = () => screen.getByRole('link', { name: '‹ CHIditarod 2027' });

  it('asks before the back link drops an unsaved name; Keep editing stays with the name', async () => {
    const { router } = await open(fee());
    await userEvent.type(nameInput(), ' 2');
    await userEvent.click(back());

    const asked = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(within(asked).getByText("Your changes to this fee haven't been saved.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(dialog()).not.toBeInTheDocument();
    expect(here(router)).toBe('/register/staff/races/7/requirements/3');
    expect(nameInput()).toHaveValue('Registration Fee 2');
  });

  it('leaves on Discard changes', async () => {
    const { router } = await open(fee());
    await userEvent.type(nameInput(), ' 2');
    await userEvent.click(back());
    await userEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(here(router)).toBe('/register/staff/races/7'));
  });

  it('does not ask when the name is unchanged or was saved', async () => {
    const { router } = await open(fee());
    await userEvent.type(nameInput(), ' 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await screen.findByRole('heading', { name: 'Registration Fee 2', level: 1 });

    await userEvent.click(back());
    await waitFor(() => expect(here(router)).toBe('/register/staff/races/7'));
    expect(dialog()).not.toBeInTheDocument();
  });
});
