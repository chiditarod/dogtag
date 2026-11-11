import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Answers, Jsonform } from '@/features/questions/types';
import { setTeamChecklist } from '@/features/teams/api/use-team';
import { teamsQueryKey } from '@/features/teams/api/use-teams';
import { apiFetch } from '@/lib/api-client';
import type { Checklist } from '@/types/api';

interface QuestionsResponse {
  jsonform: Jsonform | null;
  answers: Answers;
}

export const questionsQueryKey = (teamId: string | number) =>
  ['team-questions', String(teamId)] as const;

export function useQuestions(teamId: string | number) {
  return useQuery({
    queryKey: questionsQueryKey(teamId),
    queryFn: () => apiFetch<QuestionsResponse>(`/teams/${teamId}/questions`),
  });
}

export function useSaveAnswers(teamId: string | number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers: Answers) =>
      apiFetch<{ answers: Answers; checklist: Checklist }>(
        `/teams/${teamId}/questions`,
        { method: 'PUT', json: { answers } },
      ),
    onSuccess: ({ answers, checklist }) => {
      queryClient.setQueryData<QuestionsResponse>(
        questionsQueryKey(teamId),
        (existing) => (existing ? { ...existing, answers } : existing),
      );
      setTeamChecklist(queryClient, teamId, checklist);
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey });
    },
  });
}
