import { Outlet, useMatches } from 'react-router-dom';
import { SiteHeader } from '@/components/layouts/site-header';
import { useUnauthorizedRedirect } from '@/features/auth/api/use-unauthorized-redirect';
import { FeedbackLink } from '@/features/feedback/components/feedback-link';

export function RegisterLayout() {
  useUnauthorizedRedirect();
  const wide = useMatches().some(
    ({ handle }) => (handle as { wide?: boolean } | undefined)?.wide,
  );
  const width = wide ? 'max-w-5xl' : 'max-w-xl';

  return (
    <div className="min-h-screen bg-page">
      <SiteHeader width={width} />
      <main className={`mx-auto w-full ${width} px-4 py-6`}>
        <Outlet />
      </main>
      <footer className={`mx-auto w-full ${width} px-4 pb-8 text-sm`}>
        <FeedbackLink />
      </footer>
    </div>
  );
}
