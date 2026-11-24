import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, clearCsrfToken, type ApiError } from '@/lib/api-client';
import { meQueryKey, type User } from '@/features/auth/api/use-me';

export interface ResetPasswordInput {
  password: string;
  password_confirmation: string;
}

const path = (token: string) => `/password_resets/${encodeURIComponent(token)}`;

export function usePasswordResetToken(token: string) {
  return useQuery<{ email: string }, ApiError>({
    queryKey: ['password-reset', token],
    queryFn: () => apiFetch<{ email: string }>(path(token), { skipUnauthorized: true }),
    retry: false,
  });
}

export function useResetPassword(token: string) {
  const queryClient = useQueryClient();
  return useMutation<{ user: User }, ApiError, ResetPasswordInput>({
    mutationFn: (input) =>
      apiFetch<{ user: User }>(path(token), {
        method: 'PUT',
        json: input,
        skipUnauthorized: true,
      }),
    onSuccess: ({ user }) => {
      clearCsrfToken();
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}
