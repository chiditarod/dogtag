/** Set to "1" to stop the tour from starting by itself (tests set it). */
export const TOUR_OFF_KEY = 'dogtag:tour:off';

export const tourSeenKey = (userId: number) => `dogtag:tour:team:v1:${userId}`;

/** False when the off key is "1", the seen key exists, or localStorage throws. */
export function shouldAutoStart(userId: number): boolean {
  try {
    return (
      localStorage.getItem(TOUR_OFF_KEY) !== '1' &&
      localStorage.getItem(tourSeenKey(userId)) === null
    );
  } catch {
    return false;
  }
}

/** Writes the seen key; swallows storage errors. */
export function markSeen(userId: number): void {
  try {
    localStorage.setItem(tourSeenKey(userId), '1');
  } catch {
    // Blocked site data: the tour simply does not remember.
  }
}
