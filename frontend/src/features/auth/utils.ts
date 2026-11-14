const AUTH_PAGES = ['/login', '/signup', '/forgot-password'];
const PROBE_ORIGIN = 'http://x';

function pathnameOf(path: string): string {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '');
  return pathname || '/';
}

export function isAuthPagePath(path: string): boolean {
  return AUTH_PAGES.includes(pathnameOf(path));
}

/**
 * Returns `next` only when it is an in-app path (guards against open
 * redirects and login loops); otherwise the fallback.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith('/')) return fallback;
  // Backslashes and control characters are normalised by browsers into other targets.
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    if (new URL(next, PROBE_ORIGIN).origin !== PROBE_ORIGIN) return fallback;
  } catch {
    return fallback;
  }
  return isAuthPagePath(next) ? fallback : next;
}

export function loginPath(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
