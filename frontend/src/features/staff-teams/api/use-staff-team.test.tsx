import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { teamQueryKey } from '@/features/teams/api/use-team';
import { queryConfig } from '@/lib/react-query';
import { buildTeam } from '@/test/fixtures';
import { server } from '@/test/server';
import { buildStaffTeam, staffTeamBody } from '../test-fixtures';
import { staffTeamQueryKey, useStaffTeam } from './use-staff-team';
import { useSetNewTeam } from './use-set-new-team';

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
    const { result } = renderHook(() => useStaffTeam(9, { enabled: true, teamUpdatedAt: 1 }), {
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
    renderHook(() => useStaffTeam(9, { enabled: false, teamUpdatedAt: 1 }), { wrapper });
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
    const { result } = renderHook(() => useStaffTeam(9, { enabled: true, teamUpdatedAt: 1 }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(requests).toBe(1);
  });

  it('refetches when the racer team query updates after the first load', async () => {
    const { wrapper } = makeClient();
    let requests = 0;
    server.use(
      http.get('/api/v1/staff/teams/:id', () => {
        requests += 1;
        return HttpResponse.json(staffTeamBody());
      }),
    );
    const { result, rerender } = renderHook(
      ({ updatedAt }) => useStaffTeam(9, { enabled: true, teamUpdatedAt: updatedAt }),
      { wrapper, initialProps: { updatedAt: 0 } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The racer team's first load (0 -> timestamp) is not a change worth a refetch.
    rerender({ updatedAt: 1000 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests).toBe(1);
    rerender({ updatedAt: 2000 });
    await waitFor(() => expect(requests).toBe(2));
    rerender({ updatedAt: 2000 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests).toBe(2);
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
    const staff = renderHook(() => useStaffTeam(9, { enabled: true, teamUpdatedAt: 1 }), {
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
