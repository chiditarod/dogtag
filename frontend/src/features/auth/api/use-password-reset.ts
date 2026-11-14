import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export function usePasswordReset() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<unknown>('/password_resets', { method: 'POST', json: { email } }),
  });
}
