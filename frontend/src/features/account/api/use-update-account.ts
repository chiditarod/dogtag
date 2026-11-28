import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, type ApiError } from '@/lib/api-client';
import { meQueryKey, type User } from '@/features/auth/api/use-me';

export interface UpdateAccountInput {
  user: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    password: string;
    password_confirmation: string;
  };
  current_password: string;
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation<{ user: User }, ApiError, UpdateAccountInput>({
    mutationFn: (input) => apiFetch<{ user: User }>('/me', { method: 'PATCH', json: input }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}
