/** The page path sent with feedback, minus anything secret in it (a reset link's token). */
export function feedbackPath(pathname: string): string {
  return pathname.replace(/(\/reset-password\/)[^/]+/, '$1[redacted]');
}
