/**
 * Minimal Classy client for the optional fundraising-team check. Mirrors the
 * auth in lib/classy_client.rb (OAuth client credentials).
 *
 * Uses Node fetch, never Playwright's request fixture, so calls never land in
 * traces. Credentials come only from target.classy. The token is cached in
 * module memory for the process lifetime and is never written to disk or logs;
 * error messages carry status codes and paths, never tokens or credentials.
 */
import { ALLOWED_CLASSY_CAMPAIGNS } from './target';
import { target } from './run';

const API_HOST = 'https://api.classy.org';
const API_BASE = `${API_HOST}/2.0`;
const AUTH_ENDPOINT = `${API_HOST}/oauth2/auth`;
const TEAM_NAME_PREFIX = 'Test Team E2E ';

export interface FundraisingTeam {
  id: number;
  name: string;
}

let cachedAuthHeader: { value: string; expiresAt: number } | null = null;

async function authHeader(): Promise<string> {
  const creds = target.classy;
  if (!creds) throw new Error('Classy credentials are not configured for this target');
  // Refresh a minute early so a token never expires mid-request.
  if (cachedAuthHeader && Date.now() < cachedAuthHeader.expiresAt - 60_000) return cachedAuthHeader.value;

  const response = await fetch(AUTH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  });
  if (!response.ok) throw new Error(`Classy auth failed with status ${response.status}`);
  const json = (await response.json()) as { access_token?: string; token_type?: string; expires_in?: number };
  if (!json.access_token) throw new Error('Classy auth response had no access_token');
  cachedAuthHeader = {
    value: `${json.token_type ?? 'bearer'} ${json.access_token}`,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedAuthHeader.value;
}

async function classyFetch(path: string, init: { method?: string; query?: Record<string, string> } = {}): Promise<Response> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
  return fetch(url, {
    method: init.method ?? 'GET',
    headers: { Authorization: await authHeader(), 'User-Agent': 'dogtag-e2e', Accept: 'application/json' },
  });
}

/** Teams in the campaign whose name matches exactly (the API filter's semantics are unverified). */
export async function findFundraisingTeamsByName(campaignId: number, name: string): Promise<FundraisingTeam[]> {
  const path = `/campaigns/${campaignId}/fundraising-teams`;
  const response = await classyFetch(path, { query: { filter: `name=${name}`, per_page: '100' } });
  if (!response.ok) throw new Error(`Classy GET ${path} failed with status ${response.status}`);
  const json = (await response.json()) as { data?: Array<{ id: number; name: string }> };
  return (json.data ?? []).filter((team) => team.name === name).map(({ id, name: teamName }) => ({ id, name: teamName }));
}

/**
 * Deletes a fundraising team. Throws before any request (including the token
 * fetch) unless the team is an e2e team on an allowlisted campaign.
 */
export async function deleteFundraisingTeam(team: FundraisingTeam, campaignId: number): Promise<'deleted' | 'unsupported'> {
  if (!team.name.startsWith(TEAM_NAME_PREFIX)) {
    throw new Error(`Refusing to delete Classy team ${team.id}: name must start with "${TEAM_NAME_PREFIX}"`);
  }
  if (!ALLOWED_CLASSY_CAMPAIGNS.includes(campaignId)) {
    throw new Error(`Refusing to delete Classy team ${team.id}: campaign ${campaignId} is not on the allowlist`);
  }
  // Classy refuses (400) to delete a team that still has active fundraising pages,
  // and the server creates the captain's page with the team, so remove the pages first.
  const pagesPath = `/fundraising-teams/${team.id}/fundraising-pages`;
  const pages = await classyFetch(pagesPath, { query: { per_page: '100' } });
  if (!pages.ok) throw new Error(`Classy GET ${pagesPath} failed with status ${pages.status}`);
  for (const page of ((await pages.json()) as { data?: Array<{ id: number }> }).data ?? []) {
    const pagePath = `/fundraising-pages/${page.id}`;
    const removed = await classyFetch(pagePath, { method: 'DELETE' });
    if ([403, 404, 405].includes(removed.status)) return 'unsupported';
    if (!removed.ok) throw new Error(`Classy DELETE ${pagePath} failed with status ${removed.status}`);
  }

  const path = `/fundraising-teams/${team.id}`;
  const response = await classyFetch(path, { method: 'DELETE' });
  if ([403, 404, 405].includes(response.status)) return 'unsupported';
  if (!response.ok) {
    // Classy's error body names the reason (e.g. the team still has members); it carries no credentials.
    const detail = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
    throw new Error(`Classy DELETE ${path} failed with status ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return 'deleted';
}
