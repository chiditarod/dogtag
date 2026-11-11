/** Returns `next` only when it is an in-app path (guards against open redirects). */
export function safeNext(next: string | null | undefined, fallback: string): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export function loginPath(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
