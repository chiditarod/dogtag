import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { teamQueryKey, useTeam } from '@/features/teams/api/use-team';
import { queryConfig } from '@/lib/react-query';
import { buildTeam } from '@/test/fixtures';
import { server } from '@/test/server';
import { buildStaffTeam, staffTeamBody } from '../test-fixtures';
import { staffTeamQueryKey, useStaffTeam } from './use-staff-team';
import { useSetNewTeam } from './use-set-new-team';

const racerTeam = buildTeam({ id: 9 });

function makeClient() {
  const client = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('staffTeamQueryKey', () => {
  it('normalises the id to a string', () => {
    expect(staffTeamQueryKey(9)).toEqual(['staff', 'team', '9']);
    expect(staffTeamQueryKey('9')).toEqual(['staff', 'team', '9']);
  });
});

describe('useStaffTeam', () => {
  it('loads the staff team when enabled', async () => {
    const { wrapper } = makeClient();
    server.use(
      http.get('/api/v1/staff/teams/:id', () => HttpResponse.json(staffTeamBody({ update_team: true }))),
    );
    const { result } = renderHook(() => useStaffTeam(9, { enabled: true, team: racerTeam }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(buildStaffTeam({ update_team: true }));
  });

  it('does not request anything when disabled', async () => {
    const { wrapper } = makeClient();
    let requests = 0;
    server.use(
      http.get('/api/v1/staff/teams/:id', () => {
        requests += 1;
        return HttpResponse.json(staffTeamBody());
      }),
    );
    renderHook(() => useStaffTeam(9, { enabled: false, team: racerTeam }), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests).toBe(0);
  });

  it('does not retry a 403', async () => {
    const { wrapper } = makeClient();
    let requests = 0;
    server.use(
      http.get('/api/v1/staff/teams/:id', () => {
        requests += 1;
        return HttpResponse.json({ error: 'no', errors: {} }, { status: 403 });
      }),
    );
    const { result } = renderHook(() => useStaffTeam(9, { enabled: true, team: racerTeam }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(requests).toBe(1);
  });

  it('refetches when the racer team data changes, not when a refetch returns the same team', async () => {
    const { client, wrapper } = makeClient();
    let staffRequests = 0;
    let teamRequests = 0;
    let served = racerTeam;
    server.use(
      http.get('/api/v1/staff/teams/:id', () => {
        staffRequests += 1;
        return HttpResponse.json(staffTeamBody());
      }),
      http.get('/api/v1/teams/:id', () => {
        teamRequests += 1;
        // A fresh copy each time, as the network would send it.
        return HttpResponse.json({ team: structuredClone(served) });
      }),
    );
    const { result } = renderHook(
      () => {
        const teamQuery = useTeam(9);
        return {
          teamQuery,
          staff: useStaffTeam(9, { enabled: true, team: teamQuery.data ?? racerTeam }),
        };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.staff.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.teamQuery.isSuccess).toBe(true));
    const settled = staffRequests;

    // A poll that brings back the same team (e.g. still waiting on the fundraising URL) asks for nothing.
    await act(async () => {
      await client.refetchQueries({ queryKey: teamQueryKey(9) });
    });
    expect(teamRequests).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(staffRequests).toBe(settled);

    // A changed team refreshes the staff details once.
    served = { ...racerTeam, name: 'Renamed' };
    await act(async () => {
      await client.refetchQueries({ queryKey: teamQueryKey(9) });
    });
    await waitFor(() => expect(staffRequests).toBe(settled + 1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(staffRequests).toBe(settled + 1);
  });

  it('refetches when a mutation writes a different team into the cache', async () => {
    const { client, wrapper } = makeClient();
    let staffRequests = 0;
    server.use(
      http.get('/api/v1/staff/teams/:id', () => {
        staffRequests += 1;
        return HttpResponse.json(staffTeamBody());
      }),
      http.get('/api/v1/teams/:id', () => HttpResponse.json({ team: racerTeam })),
    );
    const { result } = renderHook(
      () => {
        const teamQuery = useTeam(9);
        return useStaffTeam(9, { enabled: true, team: teamQuery.data ?? racerTeam });
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const settled = staffRequests;
    // The same content written again keeps the cached object: no refetch.
    act(() => {
      client.setQueryData(teamQueryKey(9), structuredClone(racerTeam));
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(staffRequests).toBe(settled);
    act(() => {
      client.setQueryData(teamQueryKey(9), { ...racerTeam, name: 'Renamed' });
    });
    await waitFor(() => expect(staffRequests).toBe(settled + 1));
  });
});

describe('useSetNewTeam', () => {
  it('PATCHes the setting, writes the team and invalidates the staff team', async () => {
    const { client, wrapper } = makeClient();
    const updated = buildTeam({ name: 'Updated by server' });
    let body: unknown;
    let staffRequests = 0;
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'tok' })),
      http.patch('/api/v1/teams/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ team: updated });
      }),
      http.get('/api/v1/staff/teams/:id', () => {
        staffRequests += 1;
        return HttpResponse.json(staffTeamBody());
      }),
    );
    const staff = renderHook(() => useStaffTeam(9, { enabled: true, team: racerTeam }), {
      wrapper,
    });
    await waitFor(() => expect(staff.result.current.isSuccess).toBe(true));
    const { result } = renderHook(() => useSetNewTeam(9), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('yes');
    });
    expect(body).toEqual({ team: { new_team_setting: 'yes' } });
    expect(client.getQueryData(teamQueryKey(9))).toEqual(updated);
    await waitFor(() => expect(staffRequests).toBe(2));
  });
});
