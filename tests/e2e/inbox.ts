/**
 * One inbox interface for the e2e specs. Locally this is Mailpit; on staging
 * it is the shared IMAP test mailbox, where only this run's plus-address is
 * ever read or cleared.
 */
import * as mailpit from '../helpers/mailpit';
import type { ReceivedEmail } from '../helpers/mailpit';
import { imapClear, imapCount, imapWaitForEmail } from './imap';
import { runId, target } from './run';

export type { ReceivedEmail };

interface Match {
  to: string;
  subjectIncludes?: string;
}

const imap = () => target.inbox === 'imap';

/**
 * Mailpit: empties the inbox. IMAP: deletes only mail to one address, this
 * run's racer address unless another of this run's addresses is given.
 */
export async function clearInbox(address: string = target.racerEmail(runId())): Promise<void> {
  if (imap()) return imapClear(address);
  return mailpit.clearInbox();
}

export async function waitForEmail(o: Match & { timeoutMs?: number }): Promise<ReceivedEmail> {
  const timeoutMs = o.timeoutMs ?? (imap() ? 90000 : 15000);
  return imap() ? imapWaitForEmail({ ...o, timeoutMs }) : mailpit.waitForEmail({ ...o, timeoutMs });
}

export async function countEmails(o: Match): Promise<number> {
  return imap() ? imapCount(o) : mailpit.countEmails(o);
}
