/**
 * IMAP side of the e2e inbox, used on staging. Every call opens its own
 * connection (imapflow, from Node: never Playwright's request fixture, so
 * nothing lands in traces) and logs out in `finally`.
 *
 * The mailbox may hold other mail, so every operation matches the recipient
 * exactly: IMAP's TO search is a substring match, so the envelope is checked
 * too. Error text never carries the full address (it is a secret); only the
 * plus-tag is shown.
 */
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { extractLinks } from '../helpers/links';
import type { ReceivedEmail } from '../helpers/mailpit';
import { target } from './run';

interface Match {
  to: string;
  subjectIncludes?: string;
}

const POLL_MS = 2000;

export async function parseMessage(raw: Buffer, id: string): Promise<ReceivedEmail> {
  const parsed = await simpleParser(raw);
  const html = typeof parsed.html === 'string' ? parsed.html : '';
  const text = parsed.text ?? '';
  return { id, subject: parsed.subject ?? '', html, text, links: extractLinks(html, text) };
}

/** "user+tag@domain" becomes "+tag@…" so the real address is never printed. */
function redact(address: string): string {
  const plus = address.indexOf('+');
  const at = address.indexOf('@');
  return plus >= 0 && at > plus ? `${address.slice(plus, at)}@…` : '<address>';
}

function describe({ to, subjectIncludes }: Match): string {
  return `${redact(to)}${subjectIncludes ? ` with subject containing "${subjectIncludes}"` : ''}`;
}

async function withClient<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const imap = target.imap;
  if (!imap) throw new Error('IMAP credentials are not configured (staging target with E2E_IMAP_PASSWORD)');
  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: true,
    auth: { user: imap.user, pass: imap.password },
    logger: false,
  });
  // Connection errors must not become unhandled 'error' events.
  client.on('error', () => {});
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

/** Runs `fn` with `path` selected. */
async function inMailbox<T>(client: ImapFlow, path: string, fn: () => Promise<T>): Promise<T> {
  const lock = await client.getMailboxLock(path);
  try {
    return await fn();
  } finally {
    lock.release();
  }
}

/** UIDs (ascending) in the selected mailbox addressed exactly to `to`, whose subject contains the fragment. */
async function findUids(client: ImapFlow, { to, subjectIncludes }: Match): Promise<number[]> {
  const found = await client.search(subjectIncludes ? { to, subject: subjectIncludes } : { to }, { uid: true });
  if (!found || found.length === 0) return [];
  const wanted = to.toLowerCase();
  const uids: number[] = [];
  for await (const message of client.fetch(found.join(','), { envelope: true }, { uid: true })) {
    if (message.envelope?.to?.some((a) => a.address?.toLowerCase() === wanted)) uids.push(message.uid);
  }
  return uids.sort((a, b) => a - b);
}

async function junkFolderPath(client: ImapFlow): Promise<string | undefined> {
  const boxes = await client.list();
  const junk = boxes.find((b) => b.specialUse === '\\Junk') ?? boxes.find((b) => /^(junk|spam)$/i.test(b.name));
  return junk?.path;
}

export async function imapWaitForEmail(options: Match & { timeoutMs?: number }): Promise<ReceivedEmail> {
  const { timeoutMs = 90000 } = options;
  return withClient(async (client) => {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const raw = await inMailbox(client, 'INBOX', async () => {
        const uids = await findUids(client, options);
        if (uids.length === 0) return undefined;
        const newest = uids[uids.length - 1];
        const message = await client.fetchOne(String(newest), { source: true }, { uid: true });
        return message ? { uid: newest, source: message.source } : undefined;
      });
      if (raw?.source) return parseMessage(raw.source, String(raw.uid));
      if (Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(POLL_MS, Math.max(0, deadline - Date.now()))));
    }
    const junk = await junkFolderPath(client);
    if (junk && (await inMailbox(client, junk, () => findUids(client, options))).length > 0) {
      throw new Error(`Email to ${describe(options)} found in ${junk}, not INBOX`);
    }
    throw new Error(`No email to ${describe(options)} within ${timeoutMs}ms`);
  });
}

export async function imapCount(options: Match): Promise<number> {
  return withClient((client) => inMailbox(client, 'INBOX', async () => (await findUids(client, options)).length));
}

/** Deletes (flag + expunge) only the INBOX messages addressed to `toAddress`. */
export async function imapClear(toAddress: string): Promise<void> {
  await withClient((client) =>
    inMailbox(client, 'INBOX', async () => {
      const uids = await findUids(client, { to: toAddress });
      if (uids.length > 0) await client.messageDelete(uids.join(','), { uid: true });
    }),
  );
}
