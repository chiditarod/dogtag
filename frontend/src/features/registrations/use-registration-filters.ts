import { useCallback, useMemo } from 'react';
import { useUrlFilters } from '@/components/list/use-url-filters';
import type { RegistrationsTab } from './types';

const ANSWER_PREFIX = 'f_';

/**
 * The Who's registered filters live in the URL: `tab` (absent = registered), `q` (team name) and
 * `f_<key>` per answer filter. Only keys in `fields` are read, so a stray `f_` param is ignored.
 */
export function useRegistrationFilters(fields: { key: string }[]) {
  const { params, setParams, clearParams } = useUrlFilters();

  const tab: RegistrationsTab = params.get('tab') === 'registering' ? 'registering' : 'registered';
  const q = params.get('q') ?? '';

  const fieldKeys = fields.map((field) => field.key).join('\n');
  const answers = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of fieldKeys ? fieldKeys.split('\n') : []) {
      const value = params.get(`${ANSWER_PREFIX}${key}`);
      if (value) result[key] = value;
    }
    return result;
  }, [params, fieldKeys]);

  const setTab = useCallback(
    (next: RegistrationsTab) => setParams({ tab: next === 'registering' ? 'registering' : undefined }),
    [setParams],
  );
  const setQ = useCallback((next: string) => setParams({ q: next }), [setParams]);
  const setAnswer = useCallback(
    (key: string, value: string | undefined) => setParams({ [`${ANSWER_PREFIX}${key}`]: value }),
    [setParams],
  );
  const clearFilters = useCallback(() => clearParams(['tab', 'q']), [clearParams]);

  return { tab, q, answers, setTab, setQ, setAnswer, clearFilters };
}
