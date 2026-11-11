import { Link, Outlet } from 'react-router-dom';
import { t } from '@/locales/en';

export function RegisterLayout() {
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
            {/* Placeholder: replaced by the real user menu in a later task. */}
            <Link to="/login" className="font-semibold text-link hover:underline">
              {t('layout.login')}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
