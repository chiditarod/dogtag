import { t } from '@/locales/en';
import type { EmailLists } from '../types';
import { mailtoHref } from '../utils';

const linkClass =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-flag bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-page focus:outline-none focus-visible:ring-2 focus-visible:ring-link';

/** The bcc mail links for the tab on screen. A link is left out when its list is empty. */
export function StaffEmailLinks({ to, lists }: { to: string; lists: EmailLists }) {
  return (
    <div className="flex flex-wrap gap-2">
      {lists.racers.length > 0 && (
        <a href={mailtoHref(to, lists.racers)} className={linkClass}>
          {t('registrations.emailRacers')}
        </a>
      )}
      {lists.owners.length > 0 && (
        <a href={mailtoHref(to, lists.owners)} className={linkClass}>
          {t('registrations.emailOwners')}
        </a>
      )}
    </div>
  );
}
