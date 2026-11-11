import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, clearCsrfToken } from '@/lib/api-client';
import { meQueryKey, type User } from '@/features/auth/api/use-me';

export interface SignupInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: SignupInput) =>
      apiFetch<{ user: User }>('/users', { method: 'POST', json: { user } }),
    onSuccess: ({ user }) => {
      clearCsrfToken();
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}
