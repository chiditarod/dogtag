/** Set to "1" to stop the tour from starting by itself (tests set it). */
export const TOUR_OFF_KEY = 'dogtag:tour:off';

export const tourSeenKey = (userId: number) => `dogtag:tour:team:v1:${userId}`;

const PROBE_KEY = 'dogtag:tour:probe';

/** Users whose tour ended in this page session, kept even when the seen key cannot be written. */
const seenThisSession = new Set<number>();

/**
 * False when the tour already ended this session, the off key is "1", the seen
 * key exists, or localStorage cannot be read or written (a tour that could not
 * remember being seen would come back on every visit).
 */
export function shouldAutoStart(userId: number): boolean {
  if (seenThisSession.has(userId)) return false;
  try {
    if (localStorage.getItem(TOUR_OFF_KEY) === '1') return false;
    if (localStorage.getItem(tourSeenKey(userId)) !== null) return false;
    localStorage.setItem(PROBE_KEY, '1');
    localStorage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Remembers the tour as seen for this session and writes the seen key; swallows storage errors. */
export function markSeen(userId: number): void {
  seenThisSession.add(userId);
  try {
    localStorage.setItem(tourSeenKey(userId), '1');
  } catch {
    // Blocked site data: only this session remembers.
  }
}

/** Test-only: forgets the tours seen this session. */
export function resetSeenThisSession(): void {
  seenThisSession.clear();
}
