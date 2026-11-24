import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useMatches } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { useMe } from '@/features/auth/api/use-me';
import { useFeedback } from '@/features/feedback/api/use-feedback';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import { feedbackPath } from '@/features/feedback/utils';

/** Footer link that opens a dialog for telling staff about a problem. Only shown when logged in. */
export function FeedbackLink() {
  const { data: user } = useMe();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-semibold text-link hover:underline"
      >
        {t('feedback.open')}
      </button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const messageId = useId();
  const feedback = useFeedback();
  const teamId = useMatches()
    .map(({ params }) => params.teamId)
    .find(Boolean);
  const [draft, setDraft] = useState('');
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The Send button unmounts on success; move focus to the next control instead of losing it.
  useEffect(() => {
    if (feedback.isSuccess) closeRef.current?.focus();
  }, [feedback.isSuccess]);
  useEffect(() => {
    if (confirmingDiscard) keepRef.current?.focus();
  }, [confirmingDiscard]);

  // Cancel and Escape ask first when there is a typed message that would be lost.
  function requestClose() {
    if (confirmingDiscard) return keepWriting();
    if (draft.trim() && !feedback.isSuccess && !feedback.isPending) return setConfirmingDiscard(true);
    onClose();
  }

  function keepWriting() {
    setConfirmingDiscard(false);
    // The textarea is hidden, not unmounted, so it keeps what was typed.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const errorKey =
    feedback.error instanceof ApiError && feedback.error.status === 429
      ? 'feedback.rateLimited'
      : 'common.genericError';

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = String(new FormData(event.currentTarget).get('message') ?? '').trim();
    if (!message) return;
    feedback.mutate({
      message,
      context: {
        path: feedbackPath(window.location.pathname),
        team_id: teamId,
        user_agent: navigator.userAgent,
      },
    });
  }

  return (
    <DialogSheet labelledBy={titleId} onClose={requestClose}>
      <form onSubmit={onSubmit} className="space-y-3 p-4">
        <h2 id={titleId} className="font-display text-xl font-medium">
          {t('feedback.title')}
        </h2>
        {feedback.isSuccess ? (
          <>
            <p role="status">{t('feedback.thanks')}</p>
            <Button ref={closeRef} type="button" onClick={onClose} className="w-full">
              {t('feedback.close')}
            </Button>
          </>
        ) : (
          <>
            <div hidden={confirmingDiscard} className="space-y-3">
              <p className="text-sm text-navy/80">{t('feedback.intro')}</p>
              <label htmlFor={messageId} className="sr-only">
                {t('feedback.message')}
              </label>
              <textarea
                id={messageId}
                name="message"
                required
                maxLength={5000}
                rows={5}
                autoFocus
                ref={textareaRef}
                onChange={(event) => setDraft(event.target.value)}
                className="block w-full rounded-md border border-flag bg-white px-3 py-2 text-base text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link"
              />
              {feedback.isError && (
                <p role="alert" className="text-sm text-starText">
                  {t(errorKey)}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" loading={feedback.isPending} className="flex-1">
                  {t('feedback.send')}
                </Button>
                <Button type="button" variant="secondary" onClick={requestClose}>
                  {t('feedback.cancel')}
                </Button>
              </div>
            </div>
            {confirmingDiscard && (
              <div role="alertdialog" aria-label={t('feedback.discardPrompt')} className="space-y-3">
                <p className="text-sm text-navy">{t('feedback.discardPrompt')}</p>
                <div className="flex gap-2">
                  <Button ref={keepRef} type="button" onClick={keepWriting} className="flex-1">
                    {t('feedback.keepWriting')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={onClose}>
                    {t('feedback.discard')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </form>
    </DialogSheet>
  );
}
