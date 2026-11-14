/**
 * Minimal Mailpit (https://mailpit.axllent.org) client for end-to-end tests.
 * Rails delivers dev/e2e mail over SMTP to localhost:1025; this reads it back
 * over Mailpit's HTTP API.
 */
const MAILPIT_URL = process.env.MAILPIT_URL || 'http://localhost:8025';

export interface ReceivedEmail {
  id: string;
  subject: string;
  html: string;
  text: string;
  /** Every http(s) URL found in the HTML and text bodies, de-duplicated. */
  links: string[];
}

interface MailpitSummary {
  ID: string;
  Subject: string;
}

interface WaitOptions {
  to: string;
  subjectIncludes?: string;
}

async function mailpit(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${MAILPIT_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(`Mailpit ${init?.method ?? 'GET'} ${path} failed: ${response.status}`);
  }
  return response;
}

export async function clearInbox(): Promise<void> {
  await mailpit('/api/v1/messages', { method: 'DELETE' });
}

async function search({ to, subjectIncludes }: WaitOptions): Promise<MailpitSummary[]> {
  const query = encodeURIComponent(`to:"${to}"`);
  const response = await mailpit(`/api/v1/search?query=${query}`);
  const { messages = [] } = (await response.json()) as { messages?: MailpitSummary[] };
  const needle = subjectIncludes?.toLowerCase();
  return messages.filter((m) => !needle || m.Subject.toLowerCase().includes(needle));
}

/** How many messages to `to` (optionally with a subject fragment) are in the inbox now. */
export async function countEmails(options: WaitOptions): Promise<number> {
  return (await search(options)).length;
}

function extractLinks(...bodies: string[]): string[] {
  const urls = bodies.flatMap((body) => body.match(/https?:\/\/[^\s"'<>)]+/g) ?? []);
  return [...new Set(urls.map((url) => url.replace(/&amp;/g, '&').replace(/[.,]+$/, '')))];
}

/** Polls until a matching message arrives (newest first), or throws after `timeoutMs`. */
export async function waitForEmail({
  to,
  subjectIncludes,
  timeoutMs = 15000,
}: WaitOptions & { timeoutMs?: number }): Promise<ReceivedEmail> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const [match] = await search({ to, subjectIncludes });
    if (match) {
      const message = (await (await mailpit(`/api/v1/message/${match.ID}`)).json()) as {
        ID: string;
        Subject: string;
        HTML?: string;
        Text?: string;
      };
      const html = message.HTML ?? '';
      const text = message.Text ?? '';
      return { id: message.ID, subject: message.Subject, html, text, links: extractLinks(html, text) };
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `No email to ${to}${subjectIncludes ? ` with subject containing "${subjectIncludes}"` : ''} within ${timeoutMs}ms`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
