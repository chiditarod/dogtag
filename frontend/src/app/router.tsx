import {
  createBrowserRouter,
  Link,
  Outlet,
  type RouteObject,
} from 'react-router-dom';
import { RegisterLayout } from '@/components/layouts/register-layout';
import { ForgotPasswordRoute } from '@/app/routes/forgot-password';
import { NewTeamRoute } from '@/app/routes/new-team';
import { RacesRoute } from '@/app/routes/races';
import { LoginRoute } from '@/app/routes/login';
import { SignupRoute } from '@/app/routes/signup';
import { TeamsRoute } from '@/app/routes/teams';
import { RequireAuth } from '@/features/auth/components/require-auth';
import { t, type en } from '@/locales/en';

export const BASENAME = '/register';

function Placeholder({ heading }: { heading: keyof typeof en }) {
  return <h1 className="font-display text-2xl font-semibold">{t(heading)}</h1>;
}

function NotFound() {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-semibold">
        {t('notFound.heading')}
      </h1>
      <p>{t('notFound.body')}</p>
      <Link to="/" className="text-link underline">
        {t('notFound.home')}
      </Link>
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    element: <RegisterLayout />,
    children: [
      { path: '/', element: <RacesRoute /> },
      { path: '/login', element: <LoginRoute /> },
      { path: '/signup', element: <SignupRoute /> },
      { path: '/forgot-password', element: <ForgotPasswordRoute /> },
      {
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          {
            path: '/races/:raceId/teams/new',
            element: <NewTeamRoute />,
          },
          {
            path: '/teams',
            element: <TeamsRoute />,
          },
          {
            path: '/teams/:teamId',
            element: <Placeholder heading="teams.checklistHeading" />,
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes, { basename: BASENAME });
