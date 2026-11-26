import {
  createBrowserRouter,
  Outlet,
  type RouteObject,
} from 'react-router-dom';
import { NotFound } from '@/components/ui/not-found';
import { StaffLayout } from '@/components/layouts/staff-layout';
import { RegisterLayout } from '@/components/layouts/register-layout';
import { ForgotPasswordRoute } from '@/app/routes/forgot-password';
import { NewTeamRoute } from '@/app/routes/new-team';
import { RacesRoute } from '@/app/routes/races';
import { LoginRoute } from '@/app/routes/login';
import { StaffPaymentsRoute } from '@/app/routes/staff-payments';
import { StaffFeeNewRoute } from '@/features/staff-fees/routes/staff-fee-new-route';
import { StaffFeeRoute } from '@/features/staff-fees/routes/staff-fee-route';
import { StaffRaceEditRoute } from '@/features/staff-races/routes/staff-race-edit-route';
import { StaffRaceNewRoute } from '@/features/staff-races/routes/staff-race-new-route';
import { StaffRaceRoute } from '@/features/staff-races/routes/staff-race-route';
import { StaffRacesRoute } from '@/features/staff-races/routes/staff-races-route';
import { SignupRoute } from '@/app/routes/signup';
import { TeamRoute } from '@/app/routes/team';
import { TeamsRoute } from '@/app/routes/teams';
import { RequireAuth } from '@/features/auth/components/require-auth';
import { RequireStaff } from '@/features/staff/components/require-staff';
import { rolesFor } from '@/features/staff/nav';
import { StaffIndexRedirect } from '@/features/staff/components/staff-index-redirect';

export const BASENAME = '/register';

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
          { index: true, element: <StaffIndexRedirect /> },
          {
            element: (
              <RequireStaff roles={rolesFor('/staff/races')}>
                <Outlet />
              </RequireStaff>
            ),
            children: [
              { path: 'races', element: <StaffRacesRoute /> },
              { path: 'races/new', element: <StaffRaceNewRoute /> },
              { path: 'races/:raceId', element: <StaffRaceRoute /> },
              { path: 'races/:raceId/edit', element: <StaffRaceEditRoute /> },
              { path: 'races/:raceId/requirements/new', element: <StaffFeeNewRoute /> },
              { path: 'races/:raceId/requirements/:requirementId', element: <StaffFeeRoute /> },
            ],
          },
          { path: 'payments', element: <StaffPaymentsRoute /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes, { basename: BASENAME });
