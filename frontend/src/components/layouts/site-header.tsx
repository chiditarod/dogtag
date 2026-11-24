import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UserMenu } from '@/features/auth/components/user-menu';
import { t } from '@/locales/en';

interface SiteHeaderProps {
  /** Tailwind max-width class shared with the page's main column, e.g. `max-w-xl`. */
  width: string;
  /** Extra rows under the logo and user menu (e.g. the staff nav). */
  children?: ReactNode;
}

/** Logo plus user menu, shared by the racer and staff layouts. */
export function SiteHeader({ width, children }: SiteHeaderProps) {
  return (
    <header className="border-b-4 border-flag bg-white">
      <div className={`mx-auto flex ${width} items-center justify-between gap-2 px-4 py-3`}>
        <Link to="/" className="min-w-0 shrink">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt={t('layout.logoAlt')}
            width={640}
            height={389}
            className="h-16 w-auto max-w-full object-contain object-left min-[400px]:h-20 sm:h-24"
          />
        </Link>
        <nav aria-label={t('layout.userMenu')} className="shrink-0 text-sm">
          <UserMenu />
        </nav>
      </div>
      {children}
    </header>
  );
}
