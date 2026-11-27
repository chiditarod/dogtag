import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { queryConfig } from '@/lib/react-query';
import { server } from '@/test/server';
import { staffUser } from '../test-fixtures';
import { UserRolesCard } from './user-roles-card';

function serve(status = 200, body: Record<string, unknown> = {}) {
  const bodies: unknown[] = [];
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.patch('/api/v1/staff/users/1', async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(status === 200 ? { user: staffUser({ roles: ['admin', 'refunder'] }) } : body, { status });
    }),
  );
  return bodies;
}

function renderCard(overrides: Parameters<typeof staffUser>[0] = {}, onDirtyChange = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: queryConfig })}>
      <UserRolesCard user={staffUser(overrides)} onDirtyChange={onDirtyChange} />
    </QueryClientProvider>,
  );
  return onDirtyChange;
}

describe('UserRolesCard', () => {
  it('locks a checked Admin box on yourself, and sends only roles when you tick Refunder', async () => {
    const bodies = serve();
    const onDirtyChange = renderCard({ is_self: true, roles: ['admin'] });

    const admin = screen.getByRole('checkbox', { name: 'Admin' });
    expect(admin).toBeChecked();
    expect(admin).toBeDisabled();
    expect(admin).toHaveAccessibleDescription("You can't remove your own Admin role.");
    expect(screen.getByText("You can't remove your own Admin role.")).toBeInTheDocument();
    expect(screen.getByText(/Admin: everything\. Operator: races/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Refunder' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }));

    await waitFor(() => expect(bodies).toEqual([{ user: { roles: ['admin', 'refunder'] } }]));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('does not offer Save roles until something is ticked, and un-ticking back is clean', async () => {
    const onDirtyChange = renderCard({ roles: ['operator'] });
    expect(screen.getByRole('button', { name: 'Save roles' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Operator' }));
    expect(screen.getByRole('button', { name: 'Save roles' })).toBeEnabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Operator' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('shows a roles error under the group', async () => {
    serve(422, { error: 'Invalid', errors: { roles: ["You can't remove your own Admin role"] } });
    renderCard({ roles: ['admin'] });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Operator' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }));
    expect(await screen.findByText("You can't remove your own Admin role")).toBeInTheDocument();
  });

  it("never swallows another field's error from a roles save", async () => {
    serve(422, { error: "Phone can't be blank", errors: { phone: ["can't be blank"] } });
    renderCard({ phone: null });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Operator' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Fix this user's details first: Phone can't be blank");
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });
});
