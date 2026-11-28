import { useCallback, useMemo, useRef } from 'react';
import { useUrlFilters, type UrlChanges } from '@/components/list/use-url-filters';
import type { BrowseStatus, PaymentFilterValues } from './types';

/** Any other status in the URL (refunding, not_refundable, junk) falls back to all, so no chip mislabels it. */
const STATUSES: BrowseStatus[] = ['paid', 'refunded'];

function positiveInt(value: string | null): number | undefined {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : undefined;
}

type Key = keyof PaymentFilterValues;

const NAMES: Record<Key, string> = {
  raceId: 'race_id',
  paymentType: 'payment_type',
  teamId: 'team_id',
  status: 'status',
  q: 'q',
  page: 'page',
};

/** The page's filters live in the URL query, so a reload or a shared link keeps them. */
export function usePaymentFilters() {
  const { params, setParams, clearParams } = useUrlFilters();

  const values = useMemo<PaymentFilterValues>(() => {
    const race = params.get('race_id');
    const status = params.get('status');
    return {
      raceId: race === 'all' ? 'all' : positiveInt(race),
      paymentType: positiveInt(params.get('payment_type')),
      teamId: positiveInt(params.get('team_id')),
      status: STATUSES.includes(status as BrowseStatus) ? (status as BrowseStatus) : 'all',
      q: params.get('q') ?? '',
      page: positiveInt(params.get('page')) ?? 1,
    };
  }, [params]);

  const setFilter = useCallback(
    <K extends Key>(key: K, value: PaymentFilterValues[K]) => {
      const empty = value === undefined || value === '' || (key === 'status' && value === 'all');
      const changes: UrlChanges = {
        [NAMES[key]]: empty || (key === 'page' && value === 1) ? undefined : String(value),
      };
      // Another race has other payment types and other teams.
      if (key === 'raceId') {
        changes.payment_type = undefined;
        changes.team_id = undefined;
      }
      setParams(changes);
    },
    [setParams],
  );

  // Read when a callback runs, so the callbacks keep one identity.
  const paramsRef = useRef(params);
  paramsRef.current = params;

  /**
   * With no race_id in the URL, a team filter lists the team's race. Dropping the team names that race
   * (`teamRaceId`, the response's `filters.team.race_id`), so the list stays on it, every team, instead of
   * jumping to the default race with a payment_type from the team's race left over.
   */
  const pinTeamRace = useCallback((teamRaceId: number | undefined): UrlChanges => {
    const current = paramsRef.current;
    return !current.get('race_id') && current.get('team_id') && teamRaceId !== undefined
      ? { race_id: String(teamRaceId) }
      : {};
  }, []);

  /** Removes the Team chip; see pinTeamRace. */
  const removeTeam = useCallback(
    (teamRaceId: number | undefined) => setParams({ team_id: undefined, ...pinTeamRace(teamRaceId) }),
    [setParams, pinTeamRace],
  );

  /**
   * Drops every filter except the race (and the status, when `keepStatus`: Refund mode locks it). A team's
   * race with no race_id in the URL is kept too (see pinTeamRace).
   */
  const clearAll = useCallback(
    (keepStatus = false, teamRaceId?: number) =>
      clearParams(keepStatus ? ['race_id', 'status'] : ['race_id'], pinTeamRace(teamRaceId)),
    [clearParams, pinTeamRace],
  );

  return { values, setFilter, removeTeam, clearAll };
}
