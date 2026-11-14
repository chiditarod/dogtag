import { Link, Outlet } from 'react-router-dom';
import { useUnauthorizedRedirect } from '@/features/auth/api/use-unauthorized-redirect';
import { UserMenu } from '@/features/auth/components/user-menu';
import { t } from '@/locales/en';

export function RegisterLayout() {
  useUnauthorizedRedirect();

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b-4 border-flag bg-white">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="min-w-0 shrink">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt={t('layout.logoAlt')}
              className="h-8 w-auto max-w-full sm:h-10"
            />
          </Link>
          <nav aria-label={t('layout.userMenu')} className="shrink-0 text-sm">
            <UserMenu />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
