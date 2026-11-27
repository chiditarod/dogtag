import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { StaffRace } from '../api/types';
import { staffRaceKey } from '../api/use-staff-races';
import { TIME_ZONES, staffRace } from '../test-fixtures';

function serve(race: StaffRace, roles = ['operator']) {
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles } })),
    http.get(`/api/v1/staff/races/${race.id}`, () => HttpResponse.json({ race, time_zones: TIME_ZONES })),
    http.get('/api/v1/staff/races', () => HttpResponse.json({ races: [] })),
  );
}

async function open(race: StaffRace, roles?: string[]) {
  serve(race, roles);
  const rendered = renderApp(`/staff/races/${race.id}`);
  await screen.findByRole('heading', { name: race.name, level: 1 });
  return rendered;
}

const card = (name: string) => screen.getByRole('region', { name });

describe('staff race overview', () => {
  it('shows the header with the status, race day, and the actions', async () => {
    await open(staffRace({ id: 4 }));

    expect(screen.getByRole('link', { name: t('staff.race.back') })).toHaveAttribute('href', '/register/staff/races');
    expect(screen.getByText(t('races.open'))).toBeInTheDocument();
    expect(screen.getByText('Race day Sat, Mar 13, 2027 · America/Chicago')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('staff.race.registered') })).toHaveAttribute(
      'href',
      '/register/races/4/registrations',
    );
    expect(screen.getByRole('link', { name: t('staff.race.startTeam') })).toHaveAttribute(
      'href',
      '/register/races/4/teams/new',
    );
    expect(screen.getByRole('link', { name: t('staff.race.edit') })).toHaveAttribute(
      'href',
      '/register/staff/races/4/edit',
    );
  });

  it('shows team counts, the waitlist when full, and money with net as the headline', async () => {
    await open(staffRace({ max_teams: 100 }));
    expect(within(card(t('staff.race.teams'))).getByText('40 of 100 finalized')).toBeInTheDocument();
    expect(within(card(t('staff.race.teams'))).getByText('12 still registering')).toBeInTheDocument();
    const money = card(t('staff.race.money'));
    expect(within(money).getByText('$7,000')).toBeInTheDocument();
    expect(within(money).getByText(t('staff.race.moneyCaption'))).toBeInTheDocument();
    expect(within(money).getByText('Gross $7,100 · Refunded $100')).toBeInTheDocument();
  });

  it('shows the waitlist count instead when the race is full, and $0 money', async () => {
    await open(
      staffRace({
        full: true,
        teams: { finalized: 100, total: 103, registering: 3 },
        money: { gross_cents: 0, refunded_cents: 0, net_cents: 0 },
      }),
    );
    expect(within(card(t('staff.race.teams'))).getByText('3 on waitlist')).toBeInTheDocument();
    expect(within(card(t('staff.race.money'))).getByText('Gross $0 · Refunded $0')).toBeInTheDocument();
  });

  it('links the exports to the API and explains the name format', async () => {
    await open(staffRace({ id: 4 }));
    const exports = card(t('staff.race.export'));
    expect(within(exports).getByRole('link', { name: t('staff.race.exportRegistered') })).toHaveAttribute(
      'href',
      '/api/v1/staff/races/4/export.csv?finalized=true',
    );
    expect(within(exports).getByRole('link', { name: t('staff.race.exportAll') })).toHaveAttribute(
      'href',
      '/api/v1/staff/races/4/export.csv',
    );
    await userEvent.click(within(exports).getByRole('button', { name: t('staff.race.exportTip') }));
    expect(await screen.findByText(/Secret Gentlemen, The/)).toBeInTheDocument();
  });

  it('shows a midnight registration close as the previous evening, in the race zone', async () => {
    await open(staffRace({ registration_close: '2027-02-02T06:00:00Z' }));
    const dates = card(t('staff.race.dates'));
    expect(within(dates).getByText(t('staff.race.date.registrationClose')).parentElement).toHaveTextContent(
      'Mon, Feb 1, 2027',
    );
    expect(within(dates).getByText(t('staff.race.date.finalEditsClose')).parentElement).toHaveTextContent(
      'Mon, Mar 1, 2027',
    );
    expect(within(dates).getByText(t('staff.race.date.registrationOpen')).parentElement).toHaveTextContent(
      'Mon, Dec 7, 2026',
    );
    expect(within(dates).getByText(t('staff.race.date.raceDay')).parentElement).toHaveTextContent(
      'Sat, Mar 13, 2027',
    );
  });

  it('lists fees as links to the SPA fee pages', async () => {
    await open(
      staffRace({
        id: 7,
        payment_requirements: [
          { id: 3, name: 'Registration Fee', type: 'PaymentRequirement', enabled: true, current_price_cents: 11500, tier_count: 2 },
          { id: 10, name: 'Cart Deposit', type: 'PaymentRequirement', enabled: false, current_price_cents: null, tier_count: 1 },
        ],
      }),
    );
    const fees = card(t('staff.race.fees'));
    const registration = within(fees).getByRole('link', { name: /Registration Fee/ });
    expect(registration).toHaveAttribute('href', '/register/staff/races/7/requirements/3');
    expect(registration).toHaveTextContent(t('staff.race.feeEnabled'));
    expect(registration).toHaveTextContent('$115');
    expect(registration).toHaveTextContent('2 prices');
    const deposit = within(fees).getByRole('link', { name: /Cart Deposit/ });
    expect(deposit).toHaveAttribute('href', '/register/staff/races/7/requirements/10');
    expect(deposit).toHaveTextContent(t('staff.race.feeDisabled'));
    expect(deposit).toHaveTextContent(t('staff.race.feeNoPrice'));
    expect(deposit).toHaveTextContent('1 price');
    expect(within(fees).getByRole('link', { name: t('staff.race.addFee') })).toHaveAttribute(
      'href',
      '/register/staff/races/7/requirements/new',
    );
  });

  it('summarises questions, experience, fundraising and confirmation text', async () => {
    await open(staffRace({ confirmation_text: 'Hello' }));
    const setup = card(t('staff.race.questions'));
    expect(within(setup).getByText('5')).toBeInTheDocument();
    expect(within(setup).getByText('2')).toBeInTheDocument();
    expect(within(setup).getByText('racer-type')).toBeInTheDocument();
    expect(within(card(t('staff.race.experience'))).getByText('Veteran')).toBeInTheDocument();
    const fundraising = card(t('staff.race.fundraising'));
    expect(within(fundraising).getByText('12345')).toBeInTheDocument();
    expect(within(fundraising).getByText('$1,500')).toBeInTheDocument();
    expect(within(fundraising).getByText('Set (5 characters)')).toBeInTheDocument();
  });

  it('says not set for missing confirmation text, no questions and no campaign', async () => {
    await open(
      staffRace({ confirmation_text: null, jsonform: null, classy_campaign_id: null, classy_default_goal: null }),
    );
    const fundraising = card(t('staff.race.fundraising'));
    expect(within(fundraising).getAllByText(t('staff.race.notSet'))).toHaveLength(3);
    expect(within(card(t('staff.race.questions'))).getByText(t('staff.race.none'))).toBeInTheDocument();
  });

  it('offers a bcc mailto of the racer emails, hidden when there are none', async () => {
    const { unmount } = await open(staffRace());
    expect(screen.getByRole('link', { name: t('staff.race.emailRacers') })).toHaveAttribute(
      'href',
      'mailto:dogtag@chiditarod.org?bcc=ada@example.com,bo@example.com',
    );
    unmount();
    await open(staffRace({ racer_emails: [] }));
    expect(screen.queryByRole('link', { name: t('staff.race.emailRacers') })).not.toBeInTheDocument();
  });

  it('encodes each address in the mailto so odd characters cannot cut the list or add headers', async () => {
    await open(staffRace({ racer_emails: ['a&b#c@example.com', 'x?subject=hi@example.com', 'ok@example.com'] }));
    const href = screen.getByRole('link', { name: t('staff.race.emailRacers') }).getAttribute('href') ?? '';
    const [base, query] = href.split('?');
    expect(base).toBe('mailto:dogtag@chiditarod.org');
    expect(query).toBe('bcc=a%26b%23c@example.com,x%3Fsubject%3Dhi@example.com,ok@example.com');
    expect(query).not.toMatch(/[&#]/);
    expect(new URLSearchParams(query).keys().next().value).toBe('bcc');
  });

  it('copies the emails to the clipboard and says so briefly', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open(staffRace());
    await userEvent.click(screen.getByRole('button', { name: t('staff.race.copyEmails') }));
    expect(writeText).toHaveBeenCalledWith('ada@example.com, bo@example.com');
    expect(await screen.findByRole('status')).toHaveTextContent(t('staff.race.copied'));
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('hides the copy button when there are no racer emails', async () => {
    await open(staffRace({ racer_emails: [] }));
    expect(screen.queryByRole('button', { name: t('staff.race.copyEmails') })).not.toBeInTheDocument();
  });

  it('shows no Delete to an operator', async () => {
    await open(staffRace({ can_destroy: false, has_teams: false }));
    expect(screen.queryByRole('button', { name: t('staff.race.delete') })).not.toBeInTheDocument();
  });

  it('disables Delete with the reason when the race has teams', async () => {
    await open(staffRace({ can_destroy: true, has_teams: true }), ['admin']);
    expect(screen.getByRole('button', { name: t('staff.race.delete') })).toBeDisabled();
    expect(screen.getByText(t('staff.race.deleteBlocked'))).toBeInTheDocument();
  });

  it('confirms, deletes and lands on the list', async () => {
    let deleted = false;
    server.use(
      http.delete('/api/v1/staff/races/4', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'tok' })),
    );
    const { router } = await open(staffRace({ id: 4, can_destroy: true, has_teams: false }), ['admin']);

    await userEvent.click(screen.getByRole('button', { name: t('staff.race.delete') }));
    const dialog = await screen.findByRole('dialog');
    expect(deleted).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: t('staff.race.delete') }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/register/staff/races'));
    expect(deleted).toBe(true);
    expect(await screen.findByRole('heading', { name: t('staff.races.heading') })).toBeInTheDocument();
  });

  it('shows the API message when the server refuses the delete', async () => {
    server.use(
      http.delete('/api/v1/staff/races/4', () =>
        HttpResponse.json(
          { error: 'Race has teams and cannot be deleted', errors: {}, code: 'race_has_teams' },
          { status: 422 },
        ),
      ),
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'tok' })),
    );
    await open(staffRace({ id: 4, can_destroy: true, has_teams: false }), ['admin']);

    await userEvent.click(screen.getByRole('button', { name: t('staff.race.delete') }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: t('staff.race.delete') }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Race has teams and cannot be deleted');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keys the cached race the same for a number and a string id', () => {
    expect(staffRaceKey(7)).toEqual(staffRaceKey('7'));
  });

  it('offers a retry when the race fails to load', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['operator'] } })),
      http.get('/api/v1/staff/races/4', () => HttpResponse.json({ error: 'boom', errors: {} }, { status: 500 })),
    );
    renderApp('/staff/races/4');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
