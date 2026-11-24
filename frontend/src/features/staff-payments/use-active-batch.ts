import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The refund batch whose results are on screen, kept in the URL (`?batch=<id>`). A reload (or a lost tab)
 * reopens the results and keeps polling, so a batch whose job died can still be retried once the server
 * reports its items as stalled. There is no endpoint that lists batches, so the id is the only way back.
 */
export function useActiveBatch() {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get('batch'));
  const batchId = Number.isInteger(raw) && raw > 0 ? raw : null;

  const setBatchId = useCallback(
    (id: number | null) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (id === null) next.delete('batch');
          else next.set('batch', String(id));
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { batchId, setBatchId };
}
