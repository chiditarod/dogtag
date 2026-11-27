import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BASENAME } from '@/app/router';
import { clearCsrfToken } from '@/lib/api-client';
import { queryConfig } from '@/lib/react-query';
import { t } from '@/locales/en';
import { buildTeam } from '@/test/fixtures';
import { server } from '@/test/server';
import { buildStaffTeam } from '../test-fixtures';
import type { StaffTeam, StaffTeamCan } from '../types';
import { StaffTeamPanel } from './staff-team-panel';

const operatorCan: Partial<StaffTeamCan> = {
  set_new_team: true,
  view_emails: true,
  view_payments: true,
};
const refunderCan: Partial<StaffTeamCan> = { view_payments: true };

const bea = {
  id: 2,
  first_name: 'Bea',
  last_name: 'Pusher',
  email: 'bea@example.com',
  phone: '(312) 555-0107',
};

function operatorTeam(overrides: Partial<StaffTeam> = {}) {
  return buildStaffTeam(operatorCan, {
    team_number: null,
    new_team: true,
    computed_new_team: true,
    years_raced: 0,
    collaborating: true,
    racing_with: ['Secret Gentlemen, The', 'Mush Hour'],
    captain: bea,
    account_holder: {
      id: 5,
      first_name: 'Ada',
      last_name: 'Racer',
      email: 'ada@example.com',
      phone: null,
    },
    sent_emails_count: 4,
    ...overrides,
  });
}

interface Props {
  staffTeam?: StaffTeam;
  query?: { isError: boolean; refetch: () => unknown };
}

function renderPanel({ staffTeam, query = { isError: false, refetch: vi.fn() } }: Props = {}) {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const team = buildTeam();
  const router = createMemoryRouter(
    [
      {
        path: '/teams/:id',
        element: <StaffTeamPanel team={team} staffTeam={staffTeam} query={query} />,
      },
    ],
    { basename: BASENAME, initialEntries: [`${BASENAME}/teams/9`] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

let patches: unknown[];

beforeEach(() => {
  patches = [];
  server.use(http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })));
});
afterEach(() => clearCsrfToken());

describe('StaffTeamPanel', () => {
  it('shows every row for an operator', () => {
    renderPanel({ staffTeam: operatorTeam() });
    const card = within(screen.getByRole('region', { name: t('staff.team.heading') }));
    // One badge on the laptop heading and one on the phone toggle; CSS shows one of them.
    expect(card.getAllByText(t('staff.team.badge'))).toHaveLength(2);
    expect(card.getByText(t('staff.team.teamNumberNone'))).toBeInTheDocument();
    expect(card.getByLabelText(t('staff.team.newTeam'))).toBeInTheDocument();
    expect(card.getByText('Yes', { selector: 'dd' })).toBeInTheDocument();
    expect(card.getByText('Secret Gentlemen, The; Mush Hour')).toBeInTheDocument();
    expect(card.getByText('Bea Pusher')).toBeInTheDocument();
    expect(card.getByRole('link', { name: 'bea@example.com' })).toHaveAttribute(
      'href',
      'mailto:bea@example.com',
    );
    expect(card.getByRole('link', { name: '(312) 555-0107' })).toHaveAttribute(
      'href',
      'tel:3125550107',
    );
    expect(card.getByRole('link', { name: 'Ada Racer' })).toHaveAttribute(
      'href',
      '/register/staff/users/5',
    );
    expect(card.getByRole('link', { name: 'ada@example.com' })).toHaveAttribute(
      'href',
      'mailto:ada@example.com',
    );
    expect(card.getByRole('link', { name: 'Emails (4)' })).toHaveAttribute(
      'href',
      '/register/staff/emails?team_id=9',
    );
    expect(card.getByRole('link', { name: t('staff.team.payments') })).toHaveAttribute(
      'href',
      '/register/staff/payments?team_id=9',
    );
    expect(card.getByRole('link', { name: t('staff.team.registered') })).toHaveAttribute(
      'href',
      '/register/races/1/registrations',
    );
  });

  it('shows the placeholders for an empty team', () => {
    renderPanel({
      staffTeam: operatorTeam({
        team_number: 12,
        collaborating: null,
        racing_with: [],
        captain: null,
        account_holder: null,
        new_team: null,
        computed_new_team: null,
      }),
    });
    expect(screen.getByText('12', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText(t('staff.team.notAnswered'))).toBeInTheDocument();
    expect(screen.getByText(t('staff.team.none'))).toBeInTheDocument();
    expect(screen.getByText(t('staff.team.noCaptain'), { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText(t('staff.team.noAccountHolder'))).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Automatic (now No racers yet)' }),
    ).toBeInTheDocument();
  });

  it('offers the automatic option with the current years raced', () => {
    renderPanel({ staffTeam: operatorTeam({ computed_new_team: false, years_raced: 3 }) });
    expect(
      screen.getByRole('option', { name: 'Automatic (now No: 3 years raced)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Yes' })).toHaveValue('yes');
    expect(screen.getByRole('option', { name: 'No' })).toHaveValue('no');
  });

  it('saves New team on change and says Saved', async () => {
    let setting = 'auto';
    server.use(
      http.patch('/api/v1/teams/9', async ({ request }) => {
        patches.push(await request.json());
        setting = 'yes';
        return HttpResponse.json({ team: buildTeam() });
      }),
      http.get('/api/v1/staff/teams/9', () =>
        HttpResponse.json({ staff_team: operatorTeam({ new_team_setting: setting as 'yes' }) }),
      ),
    );
    renderPanel({ staffTeam: operatorTeam() });
    await userEvent.selectOptions(screen.getByLabelText(t('staff.team.newTeam')), 'yes');
    expect(await screen.findByText(t('staff.team.saved'))).toBeInTheDocument();
    expect(patches).toEqual([{ team: { new_team_setting: 'yes' } }]);
  });

  it('reverts the select and shows the error when the save is refused', async () => {
    server.use(
      http.patch('/api/v1/teams/9', () =>
        HttpResponse.json(
          { error: 'Not allowed', errors: { new_team_setting: ['is not allowed'] } },
          { status: 422 },
        ),
      ),
    );
    renderPanel({ staffTeam: operatorTeam() });
    const select = screen.getByLabelText(t('staff.team.newTeam'));
    await userEvent.selectOptions(select, 'no');
    expect(await screen.findByRole('alert')).toHaveTextContent('is not allowed');
    await waitFor(() => expect(select).toHaveValue('auto'));
    expect(select).toBeEnabled();
    expect(screen.queryByText(t('staff.team.saved'))).toBeNull();
  });

  it('is read-only for a refunder: label text, no Emails link, count as text', () => {
    renderPanel({
      staffTeam: buildStaffTeam(refunderCan, {
        new_team: true,
        new_team_overridden: true,
        computed_new_team: false,
        captain: bea,
        sent_emails_count: 4,
      }),
    });
    expect(screen.queryByLabelText(t('staff.team.newTeam'))).toBeNull();
    expect(screen.getByText('Yes (set by admin)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Emails/ })).toBeNull();
    expect(screen.getByText('Emails (4)', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('staff.team.payments') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('staff.team.registered') })).toBeInTheDocument();
  });

  it('hides Payments from a viewer who may not see payments', () => {
    renderPanel({ staffTeam: buildStaffTeam() });
    expect(screen.queryByRole('link', { name: t('staff.team.payments') })).toBeNull();
  });

  it('collapses on a phone, with a summary line, and expands on click', async () => {
    renderPanel({ staffTeam: operatorTeam() });
    const toggle = screen.getByRole('button', { name: new RegExp(t('staff.team.details')) });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Captain Bea Pusher · Emails (4) · Payments')).toBeInTheDocument();
    const body = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(body).toHaveClass('hidden', 'lg:block');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(body).not.toHaveClass('hidden');
    expect(screen.queryByText('Captain Bea Pusher · Emails (4) · Payments')).toBeNull();
  });

  it('leaves Emails out of the summary for a refunder and names a missing captain', () => {
    renderPanel({ staffTeam: buildStaffTeam(refunderCan) });
    expect(screen.getByText('No captain yet · Payments')).toBeInTheDocument();
  });

  it('shows one loading line while the staff details load', () => {
    renderPanel();
    expect(screen.getByText(t('staff.team.loading'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Staff details/ })).toBeNull();
  });

  it('offers a retry when the staff details fail', async () => {
    const refetch = vi.fn();
    renderPanel({ query: { isError: true, refetch } });
    await userEvent.click(screen.getByRole('button', { name: t('common.retry') }));
    expect(refetch).toHaveBeenCalled();
  });
});
