import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Answers, Jsonform } from '@/features/questions/types';
import { setTeamChecklist } from '@/features/teams/api/use-team';
import { teamsQueryKey } from '@/features/teams/api/use-teams';
import { apiFetch } from '@/lib/api-client';
import type { Checklist } from '@/types/api';

interface QuestionsResponse {
  jsonform: Jsonform | null;
  answers: Answers;
  buddy_team_ids: number[];
  other_buddies: string | null;
}

export interface SaveAnswersInput {
  answers: Answers;
  buddy_team_ids: number[];
  other_buddies: string;
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
    mutationFn: (input: SaveAnswersInput) =>
      apiFetch<{
        answers: Answers;
        buddy_team_ids: number[];
        other_buddies: string | null;
        checklist: Checklist;
      }>(`/teams/${teamId}/questions`, { method: 'PUT', json: input }),
    onSuccess: ({ answers, buddy_team_ids, other_buddies, checklist }) => {
      queryClient.setQueryData<QuestionsResponse>(
        questionsQueryKey(teamId),
        (existing) =>
          existing ? { ...existing, answers, buddy_team_ids, other_buddies } : existing,
      );
      setTeamChecklist(queryClient, teamId, checklist);
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey });
    },
  });
}
