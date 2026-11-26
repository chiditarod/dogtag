import { useCallback, useEffect, useRef } from 'react';
import { useBlocker, type Blocker } from 'react-router-dom';

/**
 * Blocks an in-app navigation to another path or query while `dirty` (render a `DiscardDialog` while
 * `blocker.state === 'blocked'`), and asks the browser to confirm closing or reloading the tab.
 * Call `allowLeave()` right before your own navigation after a save so it is not asked about.
 */
export function useLeaveGuard(dirty: boolean): { blocker: Blocker; allowLeave: () => void } {
  // Read by the blocker when a navigation starts.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const leaving = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current &&
      !leaving.current &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need a return value to show the prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Stable, so a caller can list it in an effect's dependencies.
  const allowLeave = useCallback(() => {
    leaving.current = true;
  }, []);

  return { blocker, allowLeave };
}
