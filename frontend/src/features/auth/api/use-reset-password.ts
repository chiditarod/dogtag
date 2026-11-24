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
      // The reset can replace another account's session in this browser, so drop what was cached for it.
      // The token query stays: the form still reads it until it navigates away.
      queryClient.removeQueries({
        predicate: ({ queryKey }) => queryKey[0] !== meQueryKey[0] && queryKey[0] !== 'password-reset',
      });
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}
