import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pastRacersQueryKey } from '@/features/roster/api/use-past-racers';
import { setTeamChecklist, teamQueryKey } from '@/features/teams/api/use-team';
import { teamsQueryKey } from '@/features/teams/api/use-teams';
import { apiFetch } from '@/lib/api-client';
import type { Checklist, Person, Team } from '@/types/api';

export interface PersonPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  experience: number | null;
  instagram: string;
  tiktok: string;
}

interface PersonResponse {
  person: Person;
  checklist: Checklist;
  captain_id: number | null;
}

interface RosterChange {
  checklist: Checklist;
  /** Adding the account holder can make them captain; removing the captain clears it. */
  captain_id: number | null;
}

/** Replaces the cached team's roster, captain and checklist from a mutation response. */
function usePeopleCache(teamId: number) {
  const queryClient = useQueryClient();
  return ({ checklist, captain_id }: RosterChange, update: (people: Person[]) => Person[]) => {
    queryClient.setQueryData<Team>(teamQueryKey(teamId), (team) =>
      team ? { ...team, captain_id, people: update(team.people) } : team,
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
    onSuccess: (response) =>
      applyToCache(response, (people) => [...people, response.person]),
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
    onSuccess: (response) =>
      applyToCache(response, (people) =>
        people.map((existing) => (existing.id === response.person.id ? response.person : existing)),
      ),
  });
}

export function useRemovePerson(teamId: number) {
  const queryClient = useQueryClient();
  const applyToCache = usePeopleCache(teamId);
  return useMutation({
    mutationFn: (personId: number) =>
      apiFetch<RosterChange>(
        `/teams/${teamId}/people/${personId}`,
        { method: 'DELETE' },
      ),
    onSuccess: (response, personId) => {
      applyToCache(response, (people) =>
        people.filter((person) => person.id !== personId),
      );
      // The removed person can be picked again.
      void queryClient.invalidateQueries({ queryKey: pastRacersQueryKey(teamId) });
    },
  });
}
