import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface FeedbackInput {
  message: string;
  context: { path: string; team_id?: string; user_agent: string };
}

export function useFeedback() {
  return useMutation({
    mutationFn: (input: FeedbackInput) =>
      apiFetch<unknown>('/feedback', { method: 'POST', json: input }),
  });
}
