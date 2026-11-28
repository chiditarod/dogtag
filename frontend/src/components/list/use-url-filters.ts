import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export type UrlChanges = Record<string, string | undefined>;

/**
 * A list page's filters live in the URL query, so a reload or a shared link keeps them.
 * `setParams` and `clearParams` keep one identity: useSearchParams hands back a new setter whenever the URL
 * changes, so they read it through a ref, and a filter click does not restart a search box's debounce.
 */
export function useUrlFilters() {
  const [params, setSearchParams] = useSearchParams();
  const setParamsRef = useRef(setSearchParams);
  setParamsRef.current = setSearchParams;

  /** undefined or '' deletes a key. A change to any key other than `page` also deletes `page`. */
  const setParams = useCallback((changes: UrlChanges) => {
    setParamsRef.current(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === '') next.delete(key);
          else next.set(key, value);
        }
        if (Object.keys(changes).some((key) => key !== 'page')) next.delete('page');
        return next;
      },
      { replace: true },
    );
  }, []);

  /** Deletes every key except those listed. */
  const clearParams = useCallback((keep: string[] = []) => {
    setParamsRef.current(
      (previous) => {
        const next = new URLSearchParams();
        for (const key of keep) {
          const value = previous.get(key);
          if (value) next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  }, []);

  return { params, setParams, clearParams };
}
