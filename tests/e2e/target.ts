/**
 * Target resolution and the host guard for the e2e suite.
 *
 * Pure module: no file I/O, no dotenv, no Playwright. The caller loads the
 * environment and passes it to resolveTarget(). The allow and deny lists are
 * hard-coded; no environment variable can extend them. Error messages name
 * variables and hostnames, never values.
 */
import { TEST_PORT } from '../helpers/server-env';

export type TargetName = 'local' | 'staging';
export type PaymentMode = 'mock' | 'stripe';

export interface Target {
  name: TargetName;
  baseURL: string;
  startServer: boolean;
  payments: PaymentMode;
  requirementType: 'MockPaymentRequirement' | 'PaymentRequirement';
  staff: { email: string; password: string };
  racerEmail(runId: string): string;
  inbox: 'mailpit' | 'imap';
  checkEmail: boolean;
  imap: { host: string; port: number; user: string; password: string } | null;
  classy: { clientId: string; clientSecret: string; campaignId: number } | null;
}

const STAGING_HOST = 'dogtag-staging.herokuapp.com';
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

export const ALLOWED_HOSTS: readonly string[] = [...LOCAL_HOSTS, STAGING_HOST];
export const DENIED_HOSTS: readonly string[] = ['dogtag.chiditarod.org', 'dogtag.herokuapp.com'];
export const DENIED_SUFFIXES: readonly string[] = ['.chiditarod.org'];
export const ALLOWED_CLASSY_CAMPAIGNS: readonly number[] = [867400];

/** Throws unless the URL's host is on the allowlist and not on the denylist. */
export function assertHostAllowed(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Deliberately not echoing the input: it may carry credentials.
    throw new Error('Refusing target: value is not a valid URL');
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (DENIED_HOSTS.includes(host) || DENIED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new Error(`Refusing target: host ${host} is on the production denylist`);
  }
  if (!ALLOWED_HOSTS.includes(host)) {
    throw new Error(`Refusing target: host ${host} is not on the allowlist (${ALLOWED_HOSTS.join(', ')})`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Refusing target: unsupported protocol ${parsed.protocol} for host ${host}`);
  }
  if (!LOCAL_HOSTS.includes(host) && parsed.protocol !== 'https:') {
    throw new Error(`Refusing target: host ${host} must use https`);
  }
}

type Env = Record<string, string | undefined>;

/** Blank and whitespace-only values count as unset. */
const read = (env: Env, key: string): string | undefined => env[key]?.trim() || undefined;

function requireVars(env: Env, keys: string[]): Record<string, string> {
  const missing = keys.filter((key) => !read(env, key));
  if (missing.length > 0) throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  return Object.fromEntries(keys.map((key) => [key, read(env, key) as string]));
}

function resolveClassy(env: Env): Target['classy'] {
  const clientId = read(env, 'CLASSY_CLIENT_ID');
  const clientSecret = read(env, 'CLASSY_CLIENT_SECRET');
  const rawCampaign = read(env, 'E2E_CLASSY_CAMPAIGN_ID');
  if (!clientId || !clientSecret || !rawCampaign) return null;
  const campaignId = /^\d+$/.test(rawCampaign) ? Number(rawCampaign) : NaN;
  if (!ALLOWED_CLASSY_CAMPAIGNS.includes(campaignId)) {
    throw new Error('E2E_CLASSY_CAMPAIGN_ID is not on the Classy campaign allowlist');
  }
  return { clientId, clientSecret, campaignId };
}

function resolvePayments(env: Env, name: TargetName): PaymentMode {
  const raw = read(env, 'E2E_PAYMENTS');
  if (name === 'staging') {
    if (raw && raw !== 'stripe') throw new Error('E2E_PAYMENTS must be "stripe" (or unset) for the staging target');
    return 'stripe';
  }
  if (raw && raw !== 'mock' && raw !== 'stripe') throw new Error('E2E_PAYMENTS must be "mock" or "stripe"');
  return raw === 'stripe' ? 'stripe' : 'mock';
}

export function resolveTarget(env: Env): Target {
  const name = read(env, 'E2E_TARGET') ?? 'local';
  if (name !== 'local' && name !== 'staging') throw new Error('E2E_TARGET must be "local" or "staging"');

  const payments = resolvePayments(env, name);
  const checkEmail = env.E2E_CHECK_EMAIL === '1';
  const classy = resolveClassy(env);
  const requirementType = payments === 'stripe' ? 'PaymentRequirement' : 'MockPaymentRequirement';

  let target: Target;
  if (name === 'local') {
    target = {
      name,
      baseURL: `http://localhost:${TEST_PORT}`,
      startServer: true,
      payments,
      requirementType,
      staff: { email: 'test+operator@example.com', password: 'password123' },
      racerEmail: (runId) => `e2e+${runId}@example.com`,
      inbox: 'mailpit',
      checkEmail,
      imap: null,
      classy,
    };
  } else {
    const required = ['E2E_EMAIL_BASE', 'E2E_OPERATOR_EMAIL', 'E2E_OPERATOR_PASSWORD'];
    if (checkEmail) required.push('E2E_IMAP_PASSWORD');
    const vars = requireVars(env, required);
    const [user, domain, ...rest] = vars.E2E_EMAIL_BASE.split('@');
    if (!user || !domain || rest.length > 0) throw new Error('E2E_EMAIL_BASE must look like user@domain');
    target = {
      name,
      baseURL: `https://${STAGING_HOST}`,
      startServer: false,
      payments,
      requirementType,
      staff: { email: vars.E2E_OPERATOR_EMAIL, password: vars.E2E_OPERATOR_PASSWORD },
      racerEmail: (runId) => `${user}+${runId}@${domain}`,
      inbox: 'imap',
      checkEmail,
      imap: null,
      classy,
    };
    // The IMAP password is required only when checking email, but use it if given.
    const imapPassword = read(env, 'E2E_IMAP_PASSWORD');
    if (imapPassword) {
      target.imap = { host: 'monday.mxrouting.net', port: 993, user: vars.E2E_EMAIL_BASE, password: imapPassword };
    }
  }

  const override = read(env, 'BASE_URL');
  if (override) target.baseURL = override;
  assertHostAllowed(target.baseURL);
  return target;
}
