import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/locales/en';
import type { EmailLists } from '../types';
import { mailtoHref } from '../utils';

const linkClass =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-flag bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-page focus:outline-none focus-visible:ring-2 focus-visible:ring-link';

const FEEDBACK_MS = 2000;

type CopyState = 'copied' | 'failed' | null;

/**
 * The bcc mail links for the tab on screen, each with a Copy addresses button (a full race's list
 * can be too long for some mail handlers' mailto). A link and its button are left out when the
 * list is empty.
 */
export function StaffEmailLinks({ to, lists }: { to: string; lists: EmailLists }) {
  const [copy, setCopy] = useState<CopyState>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copyAddresses(addresses: string[]) {
    let outcome: CopyState = 'copied';
    try {
      await navigator.clipboard.writeText(addresses.join(', '));
    } catch {
      outcome = 'failed';
    }
    setCopy(outcome);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopy(null), FEEDBACK_MS);
  }

  const groups = [
    { addresses: lists.racers, link: t('registrations.emailRacers'), copy: t('registrations.copyRacers') },
    { addresses: lists.owners, link: t('registrations.emailOwners'), copy: t('registrations.copyOwners') },
  ].filter((group) => group.addresses.length > 0);

  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((group) => (
        <div key={group.link} className="flex flex-wrap gap-2">
          <a href={mailtoHref(to, group.addresses)} className={linkClass}>
            {group.link}
          </a>
          <Button variant="secondary" onClick={() => void copyAddresses(group.addresses)}>
            {group.copy}
          </Button>
        </div>
      ))}
      {groups.length > 0 && (
        <span aria-live="polite" className="flex min-h-11 items-center text-sm text-navy/70">
          {copy && t(copy === 'copied' ? 'registrations.copied' : 'registrations.copyFailed')}
        </span>
      )}
    </div>
  );
}
