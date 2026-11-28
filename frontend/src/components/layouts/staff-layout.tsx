import { NavLink, Outlet } from 'react-router-dom';
import { SiteHeader } from '@/components/layouts/site-header';
import { useUnauthorizedRedirect } from '@/features/auth/api/use-unauthorized-redirect';
import { useMe } from '@/features/auth/api/use-me';
import { staffNavItems } from '@/features/staff/nav';
import { isStaff } from '@/features/staff/utils';
import { t } from '@/locales/en';

const navLink =
  'rounded px-2 py-1 font-semibold text-link hover:underline aria-[current=page]:bg-flag/40 aria-[current=page]:text-navy';

export function StaffLayout() {
  useUnauthorizedRedirect();
  const { data: me } = useMe();

  return (
    <div className="min-h-screen bg-page">
      <SiteHeader width="max-w-6xl" staffLink={false}>
        {isStaff(me) && (
          <nav
            aria-label={t('staff.nav')}
            className="mx-auto flex max-w-6xl flex-wrap gap-x-2 gap-y-1 px-4 pb-2 text-sm"
          >
            {staffNavItems(me?.roles ?? []).map((item) => (
              <NavLink key={item.to} to={item.to} className={navLink}>
                {t(item.labelKey)}
              </NavLink>
            ))}
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
