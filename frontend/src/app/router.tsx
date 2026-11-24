import {
  createBrowserRouter,
  Link,
  Navigate,
  Outlet,
  type RouteObject,
} from 'react-router-dom';
import { StaffLayout } from '@/components/layouts/staff-layout';
import { RegisterLayout } from '@/components/layouts/register-layout';
import { AccountRoute } from '@/app/routes/account';
import { ForgotPasswordRoute } from '@/app/routes/forgot-password';
import { ResetPasswordRoute } from '@/app/routes/reset-password';
import { NewTeamRoute } from '@/app/routes/new-team';
import { RaceRegistrationsRoute } from '@/app/routes/race-registrations';
import { RacesRoute } from '@/app/routes/races';
import { LoginRoute } from '@/app/routes/login';
import { StaffPaymentsRoute } from '@/app/routes/staff-payments';
import { SignupRoute } from '@/app/routes/signup';
import { TeamRoute } from '@/app/routes/team';
import { TeamsRoute } from '@/app/routes/teams';
import { RequireAuth } from '@/features/auth/components/require-auth';
import { RequireStaff } from '@/features/staff/components/require-staff';
import { t } from '@/locales/en';

export const BASENAME = '/register';

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
      { path: '/', element: <RacesRoute />, handle: { wide: true } },
      { path: '/login', element: <LoginRoute /> },
      { path: '/signup', element: <SignupRoute /> },
      { path: '/forgot-password', element: <ForgotPasswordRoute /> },
      { path: '/reset-password/:token', element: <ResetPasswordRoute /> },
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
            path: '/races/:raceId/registrations',
            element: <RaceRegistrationsRoute />,
            handle: { wide: true },
          },
          {
            path: '/account',
            element: <AccountRoute />,
          },
          {
            path: '/teams',
            element: <TeamsRoute />,
          },
          {
            path: '/teams/:teamId',
            element: <TeamRoute />,
            handle: { wide: true },
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/staff',
    element: <StaffLayout />,
    children: [
      {
        element: (
          <RequireAuth>
            <RequireStaff>
              <Outlet />
            </RequireStaff>
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Navigate to="payments" replace /> },
          { path: 'payments', element: <StaffPaymentsRoute /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes, { basename: BASENAME });
