import { test, expect } from '@playwright/test';
import { assertHostAllowed, resolveTarget } from './target';

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
  test('unknown target is an error', () =>
    expect(() => resolveTarget({ E2E_TARGET: 'production' })).toThrow(/E2E_TARGET/));
  test('classy campaign must be on the allowlist', () =>
    expect(() => resolveTarget({ CLASSY_CLIENT_ID: 'x', CLASSY_CLIENT_SECRET: 'y', E2E_CLASSY_CAMPAIGN_ID: '999' })).toThrow(/campaign/));
  test('classy is null unless fully configured', () => {
    expect(resolveTarget({ CLASSY_CLIENT_ID: 'x' }).classy).toBeNull();
    expect(resolveTarget({ CLASSY_CLIENT_ID: 'x', CLASSY_CLIENT_SECRET: 'y', E2E_CLASSY_CAMPAIGN_ID: '867400' }).classy)
      .toEqual({ clientId: 'x', clientSecret: 'y', campaignId: 867400 });
  });
  test('error messages never contain secret values', () => {
    let message = '';
    try { resolveTarget({ ...staging, E2E_CHECK_EMAIL: '1', E2E_OPERATOR_PASSWORD: 'hunter2-secret' }); } catch (e) {
      message = String(e);
    }
    expect(message).toContain('E2E_IMAP_PASSWORD');
    expect(message).not.toContain('hunter2-secret');
  });
});
