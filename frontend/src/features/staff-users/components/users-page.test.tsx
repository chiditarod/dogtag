import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { StaffUsersResponse } from '../api/types';
import { emptyUsers, staffUserRow } from '../test-fixtures';

const page: StaffUsersResponse = {
  users: [
    staffUserRow({
      id: 1,
      first_name: 'Ada',
      last_name: 'Racer',
      teams: [
        { id: 1, name: 'Doge Sled', race: { id: 9, name: 'CHIditarod 2027', year: 2027 } },
        { id: 2, name: "Ada's Second Try", race: { id: 9, name: 'CHIditarod 2027', year: 2027 } },
      ],
    }),
    staffUserRow({
      id: 2,
      first_name: 'Sam',
      last_name: 'Staffer',
      email: 'sam@example.com',
      phone: null,
      roles: ['operator', 'refunder'],
    }),
  ],
  meta: { page: 1, per_page: 35, total_count: 1284, total_pages: 37 },
};

const requests: URL[] = [];

function serve(response: StaffUsersResponse = page) {
  requests.length = 0;
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['refunder'] } })),
    http.get('/api/v1/staff/users', ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(response);
    }),
  );
}

describe('UsersPage', () => {
  it('lists people in API order with their teams, none, and role tags', async () => {
    serve();
    renderApp('/staff/users');
    expect(await screen.findByRole('link', { name: 'Ada Racer' })).toHaveAttribute('href', '/register/staff/users/1');

    const rows = screen.getAllByRole('row').filter((row) => within(row).queryAllByRole('cell').length > 0);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('link', { name: 'Doge Sled 2027' })).toHaveAttribute('href', '/teams/1');
    expect(within(rows[0]).getByRole('link', { name: "Ada's Second Try 2027" })).toHaveAttribute('href', '/teams/2');
    expect(within(rows[1]).getByText('none')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Operator')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Refunder')).toBeInTheDocument();
    expect(within(rows[0]).queryByText('Operator')).not.toBeInTheDocument();
  });

  it('announces the count with a thousands separator and shows the range', async () => {
    serve();
    renderApp('/staff/users');
    await screen.findByRole('link', { name: 'Ada Racer' });
    expect(screen.getByRole('status')).toHaveTextContent('1,284 users');
    expect(screen.getByText('1–35 of 1,284')).toBeInTheDocument();
    expect(screen.getByText(/One row per person/)).toBeInTheDocument();
  });

  it('sends the search once after the debounce, and a new search drops the page', async () => {
    serve();
    renderApp('/staff/users?page=2');
    await screen.findByRole('link', { name: 'Ada Racer' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search name, email or team' }), 'ada doge');
    await waitFor(() => expect(requests.some((url) => url.searchParams.get('q') === 'ada doge')).toBe(true));
    const searches = requests.filter((url) => url.searchParams.has('q'));
    expect(searches).toHaveLength(1);
    expect(searches[0].searchParams.get('page')).toBe('1');
  });

  it('Next asks for page 2', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    serve();
    renderApp('/staff/users');
    await screen.findByRole('link', { name: 'Ada Racer' });
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(requests.some((url) => url.searchParams.get('page') === '2')).toBe(true));
  });

  it('shows an empty state and no pagination when nothing matches', async () => {
    serve(emptyUsers);
    renderApp('/staff/users?q=zzz');
    expect(await screen.findByText('No users match this search.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 users');
  });
});
