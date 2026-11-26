import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { StaffUser, StaffUserBase, StaffUserPayload, StaffUsersResponse, UserFilterValues } from './types';

export const staffUsersKey = ['staff', 'users'] as const;

/** Only filters that are set go on the URL. */
export function staffUsersPath({ q, page }: UserFilterValues): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('page', String(page));
  return `/staff/users?${params.toString()}`;
}

export function useStaffUsers(values: UserFilterValues) {
  return useQuery({
    queryKey: [...staffUsersKey, values],
    queryFn: () => apiFetch<StaffUsersResponse>(staffUsersPath(values)),
    placeholderData: keepPreviousData,
  });
}

export function useStaffUser(id: number) {
  return useQuery({
    queryKey: [...staffUsersKey, id],
    queryFn: async () => (await apiFetch<{ user: StaffUser }>(`/staff/users/${id}`)).user,
  });
}

export function useUpdateStaffUser(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (user: StaffUserPayload) =>
      (await apiFetch<{ user: StaffUserBase }>(`/staff/users/${id}`, { method: 'PATCH', json: { user } })).user,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffUsersKey }),
  });
}

export function useDeleteStaffUser(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/staff/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffUsersKey }),
  });
}
