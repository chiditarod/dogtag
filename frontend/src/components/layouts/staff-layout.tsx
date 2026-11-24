import { NavLink, Outlet } from 'react-router-dom';
import { SiteHeader } from '@/components/layouts/site-header';
import { useUnauthorizedRedirect } from '@/features/auth/api/use-unauthorized-redirect';
import { useMe } from '@/features/auth/api/use-me';
import { isStaff } from '@/features/staff/utils';
import { t } from '@/locales/en';

const navLink =
  'rounded px-2 py-1 font-semibold text-link hover:underline aria-[current=page]:bg-flag/40 aria-[current=page]:text-navy';

export function StaffLayout() {
  useUnauthorizedRedirect();
  const { data: me } = useMe();

  return (
    <div className="min-h-screen bg-page">
      <SiteHeader width="max-w-6xl">
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
      </SiteHeader>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
