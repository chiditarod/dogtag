import { ListCell, ListRow, ListTable } from '@/components/list/list-table';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_TIME_ZONE, formatDate, formatSince } from '@/lib/dates';
import { t } from '@/locales/en';
import type { SentEmail } from '../api/types';
import { kindLabel, queuedFor } from '../kinds';

const COLUMNS = ['sent', 'kind', 'to', 'subject', 'team', 'status', 'changed'] as const;

const TONES: Record<string, 'success' | 'warning' | 'danger'> = {
  sent: 'success',
  queued: 'warning',
  failed: 'danger',
};

/** The three statuses the page offers get their word; an older status shows as stored, capitalized. */
function statusLabel(status: string): string {
  if (status in TONES) return t(`staff.emails.filters.${status as 'sent' | 'queued' | 'failed'}`);
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatusCell({ email }: { email: SentEmail }) {
  return (
    <>
      <Badge tone={TONES[email.status] ?? 'neutral'}>{statusLabel(email.status)}</Badge>
      {email.status === 'failed' && email.error && (
        <div className="mt-1 text-xs text-starText [overflow-wrap:anywhere]">{email.error}</div>
      )}
      {email.status === 'queued' && <div className="mt-1 text-xs text-navy/70">{queuedFor(email.created_at)}</div>}
    </>
  );
}

/** One markup: a table from `sm`, stacked cards below it. */
export function EmailsTable({ emails }: { emails: SentEmail[] }) {
  return (
    <ListTable
      label={t('staff.emails.list')}
      columns={COLUMNS.map((column) => ({ key: column, label: t(`staff.emails.col.${column}`) }))}
    >
      {emails.map((email) => (
        <ListRow key={email.id} data-email-id={email.id} className="bg-white">
          <ListCell className="text-sm">{formatDate(email.created_at, DEFAULT_TIME_ZONE)}</ListCell>
          <ListCell className="text-sm font-semibold">{kindLabel(email.kind)}</ListCell>
          <ListCell className="text-sm [overflow-wrap:anywhere]">{email.recipient}</ListCell>
          <ListCell className="break-words text-sm">{email.subject}</ListCell>
          <ListCell className="break-words text-sm">
            {email.team && (
              // The legacy team page is Rails, outside the SPA router, so a plain anchor.
              <a href={`/teams/${email.team.id}`} className="text-link underline">
                {email.team.name}
              </a>
            )}
          </ListCell>
          <ListCell>
            <StatusCell email={email} />
          </ListCell>
          <ListCell className="text-sm text-navy/70">
            {email.status_changed_at ? formatSince(email.status_changed_at, DEFAULT_TIME_ZONE) : ''}
          </ListCell>
        </ListRow>
      ))}
    </ListTable>
  );
}
