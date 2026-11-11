import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { meQueryKey } from '@/features/auth/api/use-me';
import { loginPath } from '@/features/auth/utils';
import { setUnauthorizedHandler } from '@/lib/api-client';

/** Sends the user to /login?next=<current path> when any API call returns 401. */
export function useUnauthorizedRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const current = location.pathname + location.search;

  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.invalidateQueries({ queryKey: meQueryKey });
      navigate(loginPath(current), { replace: true });
    });
    return () => setUnauthorizedHandler(() => {});
  }, [navigate, queryClient, current]);
}
