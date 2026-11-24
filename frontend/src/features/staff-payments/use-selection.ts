import { useCallback, useState } from 'react';
import type { StaffPayment } from './types';

/**
 * The payments ticked for refund. Only paid rows can be ticked and never more than `limit` (the server's
 * `refund_batch_limit`). The map is keyed by payment id and keeps whole rows, so a selection that spans pages
 * still has its team, type and amount for the confirmation dialog.
 */
export function useSelection(limit: number) {
  const [selected, setSelected] = useState<Map<number, StaffPayment>>(() => new Map());

  const toggle = useCallback(
    (row: StaffPayment) => {
      setSelected((previous) => {
        const next = new Map(previous);
        if (next.has(row.id)) next.delete(row.id);
        else if (row.status === 'paid' && next.size < limit) next.set(row.id, row);
        else return previous;
        return next;
      });
    },
    [limit],
  );

  const selectNext = useCallback(
    (rows: StaffPayment[]) => {
      setSelected((previous) => {
        const next = new Map(previous);
        for (const row of rows) {
          if (next.size >= limit) break;
          if (row.status === 'paid' && !next.has(row.id)) next.set(row.id, row);
        }
        return next;
      });
    },
    [limit],
  );

  const clear = useCallback(() => setSelected(new Map()), []);

  return { selected, toggle, selectNext, clear, isFull: selected.size >= limit };
}
