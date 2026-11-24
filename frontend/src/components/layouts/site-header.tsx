import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UserMenu } from '@/features/auth/components/user-menu';
import { t } from '@/locales/en';

interface SiteHeaderProps {
  /** Tailwind max-width class shared with the page's main column, e.g. `max-w-xl`. */
  width: string;
  /** Passed to UserMenu: false leaves out its Staff link. */
  staffLink?: boolean;
  /** Extra rows under the logo and user menu (e.g. the staff nav). */
  children?: ReactNode;
}

/**
 * Logo plus user menu, shared by the racer and staff layouts. The logo keeps its
 * size and the menu shrinks and wraps beside it, so a long first name cannot
 * squeeze the logo away or widen the page at 320px.
 */
export function SiteHeader({ width, staffLink, children }: SiteHeaderProps) {
  return (
    <header className="border-b-4 border-flag bg-white">
      <div className={`mx-auto flex ${width} items-center justify-between gap-2 px-4 py-3`}>
        <Link to="/" className="shrink-0">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt={t('layout.logoAlt')}
            width={640}
            height={389}
            className="h-16 w-auto max-w-full object-contain object-left min-[400px]:h-20 sm:h-24"
          />
        </Link>
        <nav aria-label={t('layout.userMenu')} className="min-w-0 text-sm">
          <UserMenu staffLink={staffLink} />
        </nav>
      </div>
      {children}
    </header>
  );
}
