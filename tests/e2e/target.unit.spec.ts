import { test, expect } from '@playwright/test';
import { assertHostAllowed, resolveTarget } from './target';
import type { Locator, Page } from '@playwright/test';
import { assertTestKey, payFee } from './payments';

const staging = {
  E2E_TARGET: 'staging',
  E2E_EMAIL_BASE: 'tests@mail.test',
  E2E_OPERATOR_EMAIL: 'a@x.test',
  E2E_OPERATOR_PASSWORD: 'pw',
};

test.describe('assertHostAllowed', () => {
  for (const url of [
    'https://dogtag.chiditarod.org',
    'https://DOGTAG.chiditarod.org./',
    'https://dogtag.herokuapp.com',
    'https://www.chiditarod.org',
    'https://dogtag-staging.herokuapp.com@dogtag.chiditarod.org/',
  ]) {
    test(`denies ${url}`, () => expect(() => assertHostAllowed(url)).toThrow(/denylist/));
  }
  test('refuses hosts not on the allowlist', () =>
    expect(() => assertHostAllowed('https://example.com')).toThrow(/allowlist/));
  test('allows staging, localhost and 127.0.0.1 with ports', () => {
    for (const url of ['https://dogtag-staging.herokuapp.com', 'http://localhost:3099', 'http://127.0.0.1:3099'])
      expect(() => assertHostAllowed(url)).not.toThrow();
  });
  test('refuses plain http to staging and non-http schemes', () => {
    expect(() => assertHostAllowed('http://dogtag-staging.herokuapp.com')).toThrow(/https/);
    expect(() => assertHostAllowed('ftp://localhost')).toThrow(/protocol/);
  });
  test('an unparseable URL is refused without echoing it', () => {
    expect(() => assertHostAllowed('not a url')).toThrow(/valid URL/);
    expect(() => assertHostAllowed('not a url')).not.toThrow(/not a url/);
  });
});

test.describe('resolveTarget', () => {
  test('defaults to local with mock payments', () => {
    const t = resolveTarget({});
    expect(t).toMatchObject({ name: 'local', payments: 'mock', requirementType: 'MockPaymentRequirement', startServer: true, inbox: 'mailpit' });
    expect(t.racerEmail('ab12')).toBe('e2e+ab12@example.com');
    expect(t.staff).toEqual({ email: 'test+operator@example.com', password: 'password123' });
    expect(t.imap).toBeNull();
  });
  test('local can pay with Stripe test keys', () =>
    expect(resolveTarget({ E2E_PAYMENTS: 'stripe' })).toMatchObject({ payments: 'stripe', requirementType: 'PaymentRequirement' }));
  test('staging uses Stripe, no server, and plus-addressed racers', () => {
    const t = resolveTarget(staging);
    expect(t).toMatchObject({ name: 'staging', baseURL: 'https://dogtag-staging.herokuapp.com', payments: 'stripe', startServer: false, inbox: 'imap' });
    expect(t.racerEmail('ab12')).toBe('tests+ab12@mail.test');
    expect(t.staff).toEqual({ email: 'a@x.test', password: 'pw' });
  });
  test('staging refuses mock payments', () =>
    expect(() => resolveTarget({ ...staging, E2E_PAYMENTS: 'mock' })).toThrow(/E2E_PAYMENTS/));
  test('staging names each missing secret', () => {
    expect(() => resolveTarget({ E2E_TARGET: 'staging' })).toThrow(/E2E_EMAIL_BASE/);
    expect(() => resolveTarget({ ...staging, E2E_OPERATOR_PASSWORD: '' })).toThrow(/E2E_OPERATOR_PASSWORD/);
    expect(() => resolveTarget({ ...staging, E2E_CHECK_EMAIL: '1' })).toThrow(/E2E_IMAP_PASSWORD/);
  });
  test('staging builds the IMAP config when checking email', () => {
    const t = resolveTarget({ ...staging, E2E_CHECK_EMAIL: '1', E2E_IMAP_PASSWORD: 'imap-pw' });
    expect(t.checkEmail).toBe(true);
    expect(t.imap).toEqual({ host: 'monday.mxrouting.net', port: 993, user: 'tests@mail.test', password: 'imap-pw' });
  });
  test('BASE_URL may not leave the allowlist', () =>
    expect(() => resolveTarget({ ...staging, BASE_URL: 'https://dogtag.chiditarod.org' })).toThrow(/denylist/));
  test('BASE_URL with userinfo or a trailing dot cannot reach production', () => {
    expect(() => resolveTarget({ BASE_URL: 'https://dogtag-staging.herokuapp.com@dogtag.chiditarod.org/' })).toThrow(/denylist/);
    expect(() => resolveTarget({ ...staging, BASE_URL: 'https://DOGTAG.chiditarod.org./' })).toThrow(/denylist/);
  });
  test('BASE_URL must belong to the target host set, in both directions', () => {
    expect(() => resolveTarget({ BASE_URL: 'https://dogtag-staging.herokuapp.com' })).toThrow(/BASE_URL.*dogtag-staging\.herokuapp\.com/);
    expect(() => resolveTarget({ ...staging, BASE_URL: 'http://localhost:3099' })).toThrow(/BASE_URL.*localhost/);
    expect(resolveTarget({ BASE_URL: 'http://127.0.0.1:3099' }).baseURL).toBe('http://127.0.0.1:3099');
    expect(resolveTarget({ ...staging, BASE_URL: 'https://dogtag-staging.herokuapp.com' }).name).toBe('staging');
  });
  test('unknown target is an error', () =>
    expect(() => resolveTarget({ E2E_TARGET: 'production' })).toThrow(/E2E_TARGET/));
  const classyEnv = { CLASSY_CLIENT_ID: 'x', CLASSY_CLIENT_SECRET: 'y', E2E_CLASSY_CAMPAIGN_ID: '867400' };
  test('classy campaign must be on the allowlist', () =>
    expect(() => resolveTarget({ ...staging, ...classyEnv, E2E_CLASSY_CAMPAIGN_ID: '999' })).toThrow(/campaign/));
  test('classy is null unless fully configured', () => {
    expect(resolveTarget({ ...staging, CLASSY_CLIENT_ID: 'x' }).classy).toBeNull();
    expect(resolveTarget({ ...staging, ...classyEnv }).classy)
      .toEqual({ clientId: 'x', clientSecret: 'y', campaignId: 867400 });
  });
  test('classy is always null for the local target', () =>
    expect(resolveTarget(classyEnv).classy).toBeNull());
  test('error messages never contain secret values', () => {
    let message = '';
    try { resolveTarget({ ...staging, E2E_CHECK_EMAIL: '1', E2E_OPERATOR_PASSWORD: 'hunter2-secret' }); } catch (e) {
      message = String(e);
    }
    expect(message).toContain('E2E_IMAP_PASSWORD');
    expect(message).not.toContain('hunter2-secret');
  });
});

test('assertTestKey refuses live and missing keys', () => {
  expect(() => assertTestKey('pk_live_abc')).toThrow(/pk_live_/);
  expect(() => assertTestKey(undefined)).toThrow(/Refusing to pay/);
  expect(() => assertTestKey('pk_test_abc')).not.toThrow();
});

test('payFee refuses a live or missing key before touching the page', async () => {
  // Any use of the page or the fee item fails the test.
  const untouchable = <T extends object>() =>
    new Proxy({} as T, {
      get: (_target, prop) => {
        throw new Error(`payFee touched the page (${String(prop)})`);
      },
    });
  for (const mode of ['mock', 'stripe'] as const) {
    await expect(payFee(untouchable<Page>(), untouchable<Locator>(), '$88', mode, 'pk_live_abc')).rejects.toThrow(
      /Refusing to pay/,
    );
    await expect(payFee(untouchable<Page>(), untouchable<Locator>(), '$88', mode, undefined)).rejects.toThrow(
      /Refusing to pay/,
    );
  }
});
