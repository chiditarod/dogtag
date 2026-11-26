/** Plain words for each `SentEmail::KINDS` entry. A kind added on the server shows through `kindLabel`'s fallback. */
export const KIND_LABELS: Record<string, string> = {
  welcome: 'Welcome',
  team_finalized: 'Team finalized',
  team_waitlisted: 'Waitlisted',
  refund: 'Refund',
  email_changed: 'Email address changed',
  password_reset: 'Password reset',
  classy_fundraising: 'Fundraising page',
  registration_reminder: 'Registration reminder',
  feedback: 'Problem report',
};

/** The label, else the raw kind with underscores as spaces and capitalized; "Unknown" with no kind. */
export function kindLabel(kind: string | null): string {
  if (!kind) return 'Unknown';
  if (KIND_LABELS[kind]) return KIND_LABELS[kind];
  const words = kind.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** How long a queued email has waited: "for 2 min", "for 3 h", "for 2 days". */
export function queuedFor(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `for ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `for ${hours} h`;
  const days = Math.round(hours / 24);
  return `for ${days} ${days === 1 ? 'day' : 'days'}`;
}
