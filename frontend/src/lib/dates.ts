const TIME_ZONE = 'America/Chicago';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

/** e.g. "Sat, Mar 6, 2027", always in Chicago time (the race's home). */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
