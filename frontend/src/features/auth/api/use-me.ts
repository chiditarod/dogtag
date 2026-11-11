import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

export const meQueryKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => {
      const { user } = await apiFetch<{ user: User }>('/me', {
        skipUnauthorized: true,
      });
      return user;
    },
    retry: false,
  });
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
