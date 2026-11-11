import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { teamQueryKey } from '@/features/teams/api/use-team';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';

interface TeamPageErrorContextValue {
  message: string | null;
  /**
   * Call from any mutation's `onError`. A 403 (e.g. registration closed)
   * shows the page-level banner with the server message and refetches the
   * team; returns true when it handled the error. Other errors return false
   * so the caller can render them inline.
   */
  reportError: (error: unknown) => boolean;
  dismiss: () => void;
  /**
   * Call from a mutation's `onSuccess`: a later success means the earlier 403
   * banner is stale, so it is cleared.
   */
  clearError: () => void;
}

const TeamPageErrorContext = createContext<TeamPageErrorContextValue | null>(
  null,
);

export function TeamPageErrorProvider({
  teamId,
  children,
}: {
  teamId: string | number;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const reportError = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError) || error.status !== 403) return false;
      setMessage(error.error || t('common.genericError'));
      void queryClient.invalidateQueries({ queryKey: teamQueryKey(teamId) });
      return true;
    },
    [queryClient, teamId],
  );
  const dismiss = useCallback(() => setMessage(null), []);
  const value = useMemo(
    () => ({ message, reportError, dismiss, clearError: dismiss }),
    [message, reportError, dismiss],
  );

  return (
    <TeamPageErrorContext.Provider value={value}>
      {children}
    </TeamPageErrorContext.Provider>
  );
}

export function useTeamPageError() {
  const context = useContext(TeamPageErrorContext);
  if (!context) {
    throw new Error('useTeamPageError must be used inside TeamPageErrorProvider');
  }
  return context;
}

export function TeamErrorBanner() {
  const { message, dismiss } = useTeamPageError();
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-md border border-star bg-white p-3 text-sm text-starText"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-link"
      >
        {t('team.dismiss')}
      </button>
    </div>
  );
}
