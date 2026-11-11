import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, clearCsrfToken } from '@/lib/api-client';
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
    mutationFn: () => apiFetch<void>('/session', { method: 'DELETE' }),
    onSuccess: () => {
      clearCsrfToken();
      queryClient.clear();
    },
  });
}
