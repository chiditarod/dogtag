import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setTeamChecklist, teamQueryKey } from '@/features/teams/api/use-team';
import { teamsQueryKey } from '@/features/teams/api/use-teams';
import { apiFetch } from '@/lib/api-client';
import type { Checklist, Person, Team } from '@/types/api';

export interface PersonPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  zipcode: string;
  experience: number | null;
  twitter: string;
}

interface PersonResponse {
  person: Person;
  checklist: Checklist;
}

/** Replaces the cached team's roster and checklist from a mutation response. */
function usePeopleCache(teamId: number) {
  const queryClient = useQueryClient();
  return (checklist: Checklist, update: (people: Person[]) => Person[]) => {
    queryClient.setQueryData<Team>(teamQueryKey(teamId), (team) =>
      team ? { ...team, people: update(team.people) } : team,
    );
    setTeamChecklist(queryClient, teamId, checklist);
    void queryClient.invalidateQueries({ queryKey: teamsQueryKey });
  };
}

export function useAddPerson(teamId: number) {
  const applyToCache = usePeopleCache(teamId);
  return useMutation({
    mutationFn: (person: PersonPayload) =>
      apiFetch<PersonResponse>(`/teams/${teamId}/people`, {
        method: 'POST',
        json: { person },
      }),
    onSuccess: ({ person, checklist }) =>
      applyToCache(checklist, (people) => [...people, person]),
  });
}

export function useUpdatePerson(teamId: number, personId: number | undefined) {
  const applyToCache = usePeopleCache(teamId);
  return useMutation({
    mutationFn: (person: PersonPayload) =>
      apiFetch<PersonResponse>(`/teams/${teamId}/people/${personId}`, {
        method: 'PATCH',
        json: { person },
      }),
    onSuccess: ({ person, checklist }) =>
      applyToCache(checklist, (people) =>
        people.map((existing) => (existing.id === person.id ? person : existing)),
      ),
  });
}

export function useRemovePerson(teamId: number) {
  const applyToCache = usePeopleCache(teamId);
  return useMutation({
    mutationFn: (personId: number) =>
      apiFetch<{ checklist: Checklist }>(
        `/teams/${teamId}/people/${personId}`,
        { method: 'DELETE' },
      ),
    onSuccess: ({ checklist }, personId) =>
      applyToCache(checklist, (people) =>
        people.filter((person) => person.id !== personId),
      ),
  });
}
