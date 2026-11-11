import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError, clearCsrfToken } from '@/lib/api-client';
import { meQueryKey, type User } from '@/features/auth/api/use-me';

export interface LoginInput {
  email: string;
  password: string;
  remember_me: boolean;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<{ user: User }>('/session', { method: 'POST', json: input }),
    onSuccess: ({ user }) => {
      clearCsrfToken();
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await apiFetch<void>('/session', {
          method: 'DELETE',
          skipUnauthorized: true,
        });
      } catch (error) {
        // 401 means the session already expired: effectively logged out.
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
    },
    onSuccess: () => {
      clearCsrfToken();
      queryClient.clear();
    },
  });
}
