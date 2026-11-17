import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseMessage } from './imap';

test('parseMessage returns subject, bodies and de-duplicated links', async () => {
  const raw = readFileSync(join(__dirname, 'fixtures/welcome.eml'));
  const email = await parseMessage(raw, '1');
  expect(email.id).toBe('1');
  expect(email.subject).toContain('Welcome to dogTag');
  expect(email.html).toContain('<a href');
  expect(email.text).toContain('Thanks for signing up');
  expect(email.links.length).toBeGreaterThan(0);
  expect(new Set(email.links).size).toBe(email.links.length);
});
