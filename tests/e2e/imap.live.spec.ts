/**
 * Live IMAP check against the real test mailbox. Talks only to the mailbox
 * (IMAP APPEND), never to staging, so it needs no SMTP. Credentials come from
 * target.imap, which is null (and the test skips) unless the staging target is
 * selected with E2E_IMAP_PASSWORD set:
 *
 *   E2E_TARGET=staging E2E_CHECK_EMAIL=1 npx playwright test --project=live
 */
import { test, expect } from '@playwright/test';
import { ImapFlow } from 'imapflow';
import { randomUUID } from 'crypto';
import { target } from './run';
import { imapClear, imapCount, imapWaitForEmail } from './imap';

const imap = target.imap;

function message(to: string, subject: string): string {
  return [
    `From: e2e-live@example.com`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@example.com>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    'e2e IMAP live check. Safe to delete.',
    '',
  ].join('\r\n');
}

test('finds only this run’s mail, reports Junk, and clears only its own', async () => {
  test.skip(!imap, 'IMAP credentials not available (needs E2E_TARGET=staging and E2E_IMAP_PASSWORD)');
  const { user } = imap!;
  const [local, domain] = user.split('@');
  const run = randomUUID().replace(/-/g, '').slice(0, 8);
  const A = `${local}+${run}@${domain}`;
  const B = `${local}+other-${run}@${domain}`;
  const C = `${local}+junk-${run}@${domain}`;

  const client = new ImapFlow({ host: imap!.host, port: imap!.port, secure: true, auth: { user, pass: imap!.password }, logger: false });
  await client.connect();
  let junkPath: string | undefined;
  try {
    const boxes = await client.list();
    junkPath = (boxes.find((b) => b.specialUse === '\\Junk') ?? boxes.find((b) => /^(junk|spam)$/i.test(b.name)))?.path;
    if (!junkPath) {
      try {
        await client.mailboxCreate('Junk');
        junkPath = 'Junk';
      } catch {
        test.info().annotations.push({ type: 'junk', description: 'No Junk/Spam folder and folders cannot be created; Junk sub-case skipped' });
      }
    }

    await client.append('INBOX', message(A, `e2e A ${run}`));
    await client.append('INBOX', message(B, `e2e B ${run}`));
    if (junkPath) await client.append(junkPath, message(C, `e2e C ${run}`));
  } finally {
    await client.logout();
  }

  try {
    expect((await imapWaitForEmail({ to: A, subjectIncludes: 'e2e A' })).subject).toContain('e2e A');
    if (junkPath) await expect(imapWaitForEmail({ to: C, timeoutMs: 3000 })).rejects.toThrow(/Junk|Spam/);
    await imapClear(A);
    expect(await imapCount({ to: A })).toBe(0);
    expect(await imapCount({ to: B })).toBe(1);
  } finally {
    await imapClear(A);
    await imapClear(B);
    if (junkPath) {
      const cleanup = new ImapFlow({ host: imap!.host, port: imap!.port, secure: true, auth: { user, pass: imap!.password }, logger: false });
      await cleanup.connect();
      try {
        const lock = await cleanup.getMailboxLock(junkPath);
        try {
          const uids = await cleanup.search({ to: C }, { uid: true });
          if (uids && uids.length > 0) await cleanup.messageDelete(uids, { uid: true });
        } finally {
          lock.release();
        }
      } finally {
        await cleanup.logout();
      }
    }
  }
});
