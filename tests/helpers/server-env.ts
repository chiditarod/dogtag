/**
 * Single source of truth for the Rails server environment under test. Used by
 * playwright.config.ts (webServer), the seed helper, and specs that assert on
 * the host in emailed links.
 */
export const TEST_PORT = process.env.TEST_PORT || '3099';
export const APP_HOST = `localhost:${TEST_PORT}`;

// Mail goes over SMTP to Mailpit (docker compose up -d mailpit), jobs run
// inline (no Sidekiq process), and the homepage points at the built React SPA.
export const railsEnv: Record<string, string> = {
  APP_HOST,
  SIDEKIQ_INLINE: 'true',
  REGISTRATION_UI: 'spa',
  SMTP_HOST: process.env.SMTP_HOST || 'localhost',
  SMTP_PORT: process.env.SMTP_PORT || '1025',
};

/** Full environment for the webServer. VITE_DEV_SERVER must stay unset so Rails serves public/register. */
export function serverEnv(): Record<string, string> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>), ...railsEnv };
  delete env.VITE_DEV_SERVER;
  return env;
}
