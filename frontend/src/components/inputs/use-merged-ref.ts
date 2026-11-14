import { useCallback, type Ref } from 'react';

/** Combines a local ref with a forwarded one (React 19 ref-as-prop). */
export function useMergedRef<T>(local: { current: T | null }, forwarded?: Ref<T>) {
  return useCallback(
    (node: T | null) => {
      local.current = node;
      if (typeof forwarded === 'function') forwarded(node);
      else if (forwarded) forwarded.current = node;
    },
    [local, forwarded],
  );
}
