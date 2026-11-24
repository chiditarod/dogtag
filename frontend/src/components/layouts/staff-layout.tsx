import { Link, NavLink, Outlet } from 'react-router-dom';
import { useUnauthorizedRedirect } from '@/features/auth/api/use-unauthorized-redirect';
import { useMe } from '@/features/auth/api/use-me';
import { UserMenu } from '@/features/auth/components/user-menu';
import { isStaff } from '@/features/staff/utils';
import { t } from '@/locales/en';

const navLink =
  'rounded px-2 py-1 font-semibold text-link hover:underline aria-[current=page]:bg-flag/40 aria-[current=page]:text-navy';

export function StaffLayout() {
  useUnauthorizedRedirect();
  const { data: me } = useMe();

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b-4 border-flag bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
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
        {isStaff(me) && (
          <nav
            aria-label={t('staff.nav')}
            className="mx-auto flex max-w-6xl flex-wrap gap-x-2 gap-y-1 px-4 pb-2 text-sm"
          >
            <NavLink to="/staff/payments" className={navLink}>
              {t('staff.nav.payments')}
            </NavLink>
            <a href="/users" className={navLink}>
              {t('staff.nav.legacy')}
            </a>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
