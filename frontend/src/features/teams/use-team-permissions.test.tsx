import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { meQueryKey } from '@/features/auth/api/use-me';
import { teamQueryKey, useTeam } from './api/use-team';
import { queryConfig } from '@/lib/react-query';
import { buildRace, buildTeam, user } from '@/test/fixtures';
import { server } from '@/test/server';
import { buildStaffTeam, staffTeamBody } from '@/features/staff-teams/test-fixtures';
import { racerPermissions, READ_ONLY_PERMISSIONS, staffPermissions } from './permissions';
import { useTeamPermissions } from './use-team-permissions';

const team = buildTeam({ race: buildRace() });

function setup({ roles, id = 1 }: { roles: string[]; id?: number }) {
  const client = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, id, roles } })),
  );
  return { client, wrapper };
}

describe('useTeamPermissions', () => {
  it('never asks for the staff team for a racer and gives racer rules', async () => {
    const { client, wrapper } = setup({ roles: [] });
    let staffRequests = 0;
    server.use(
      http.get('/api/v1/staff/teams/:id', () => {
        staffRequests += 1;
        return HttpResponse.json(staffTeamBody());
      }),
    );
    const { result } = renderHook(() => useTeamPermissions(team, { teamUpdatedAt: 1 }), { wrapper });
    await waitFor(() => expect(client.getQueryData(meQueryKey)).toBeDefined());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.staffState).toBe('none');
    expect(result.current.permissions).toEqual(racerPermissions(team));
    expect(result.current.staffTeam).toBeUndefined();
    expect(staffRequests).toBe(0);
  });

  it('is read-only (no Pay at all) while loading, then uses staff rules', async () => {
    const { wrapper } = setup({ roles: ['operator'] });
    const staffTeam = buildStaffTeam({ add_racers: true, update_team: true, take_payment: true });
    server.use(
      http.get('/api/v1/staff/teams/:id', async () => {
        await delay(80);
        return HttpResponse.json({ staff_team: staffTeam });
      }),
    );
    const { result } = renderHook(() => useTeamPermissions(team, { teamUpdatedAt: 1 }), { wrapper });
    await waitFor(() => expect(result.current.staffState).toBe('loading'));
    expect(result.current.permissions).toEqual(READ_ONLY_PERMISSIONS);
    expect(result.current.permissions.pay).toBe(false);
    expect(result.current.permissions.staffPay).toBe(false);
    await waitFor(() => expect(result.current.staffState).toBe('ready'));
    expect(result.current.permissions).toEqual(staffPermissions(team, staffTeam, 1));
    expect(result.current.permissions.staffPay).toBe(true);
    expect(result.current.staffTeam).toEqual(staffTeam);
  });

  it.each([
    ['a staff member who does not own the team', 1],
    ['a staff member who owns the team', 7],
  ])('is read-only with no Pay when the staff request fails (%s)', async (_label, meId) => {
    const { wrapper } = setup({ roles: ['admin'], id: meId });
    server.use(
      http.get('/api/v1/staff/teams/:id', () =>
        HttpResponse.json({ error: 'boom', errors: {} }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useTeamPermissions(team, { teamUpdatedAt: 1 }), { wrapper });
    await waitFor(() => expect(result.current.staffState).toBe('error'));
    expect(result.current.permissions).toEqual(READ_ONLY_PERMISSIONS);
    expect(result.current.permissions.pay).toBe(false);
    expect(result.current.permissions.staffPay).toBe(false);
    expect(result.current.staffTeam).toBeUndefined();
  });

  it('gives a staff owner the owner-only shortcuts once the response arrives', async () => {
    const { wrapper } = setup({ roles: ['admin'], id: 7 });
    server.use(
      http.get('/api/v1/staff/teams/:id', () =>
        HttpResponse.json(staffTeamBody({ update_team: true, add_racers: true })),
      ),
    );
    const { result } = renderHook(() => useTeamPermissions(team, { teamUpdatedAt: 1 }), { wrapper });
    await waitFor(() => expect(result.current.staffState).toBe('ready'));
    expect(result.current.permissions.pastRacers).toBe(true);
    expect(result.current.permissions.addYourself).toBe(true);
  });

  it('refetches the staff team when the racer team query is rewritten', async () => {
    const { client, wrapper } = setup({ roles: ['operator'] });
    let staffRequests = 0;
    server.use(
      http.get('/api/v1/staff/teams/:id', () => {
        staffRequests += 1;
        return HttpResponse.json(staffTeamBody({ update_team: true }));
      }),
      http.get('/api/v1/teams/:id', () => HttpResponse.json({ team })),
    );
    const { result } = renderHook(
      () => {
        const teamQuery = useTeam(team.id);
        return useTeamPermissions(team, { teamUpdatedAt: teamQuery.dataUpdatedAt });
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.staffState).toBe('ready'));
    await new Promise((resolve) => setTimeout(resolve, 5));
    act(() => {
      client.setQueryData(teamQueryKey(team.id), { ...team, name: 'Renamed' });
    });
    await waitFor(() => expect(staffRequests).toBe(2));
  });

  it('leaves the shared team query able to refetch', async () => {
    const { client, wrapper } = setup({ roles: ['operator'] });
    let teamRequests = 0;
    server.use(
      http.get('/api/v1/staff/teams/:id', () => HttpResponse.json(staffTeamBody({ update_team: true }))),
      http.get('/api/v1/teams/:id', () => {
        teamRequests += 1;
        return HttpResponse.json({ team });
      }),
    );
    const { result, rerender } = renderHook(
      () => {
        const teamQuery = useTeam(team.id);
        return {
          permissions: useTeamPermissions(team, { teamUpdatedAt: teamQuery.dataUpdatedAt }),
          teamQuery,
        };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.permissions.staffState).toBe('ready'));
    expect(teamRequests).toBe(1);
    rerender();
    await act(async () => {
      await client.invalidateQueries({ queryKey: teamQueryKey(team.id) });
    });
    await waitFor(() => expect(teamRequests).toBe(2));
    expect(client.getQueryState(teamQueryKey(team.id))?.status).toBe('success');
    expect(result.current.teamQuery.isError).toBe(false);
  });
});
