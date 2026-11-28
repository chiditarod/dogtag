import type { RegistrationRow } from './types';

/** The distinct, non-blank answers for one filter field, sorted. */
export function filterOptions(rows: RegistrationRow[], key: string): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = row.answers[key];
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

/** Drops answer filters whose value is not among the options (the URL may name a stale value). */
export function activeAnswers(
  answers: Record<string, string>,
  options: Record<string, string[]>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(answers).filter(([key, value]) => options[key]?.includes(value)),
  );
}

/** `q` is a case-insensitive substring of the team name; each answer must match exactly (AND). */
export function filterRows(
  rows: RegistrationRow[],
  q: string,
  answers: Record<string, string>,
): RegistrationRow[] {
  const needle = q.trim().toLowerCase();
  const entries = Object.entries(answers);
  return rows.filter(
    (row) =>
      (!needle || row.name.toLowerCase().includes(needle)) &&
      entries.every(([key, value]) => row.answers[key] === value),
  );
}

export function mailtoHref(to: string, bcc: string[]): string {
  return `mailto:${to}?bcc=${encodeURIComponent(bcc.join(','))}`;
}
