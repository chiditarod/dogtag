import { useId, useState, type FormEvent } from 'react';
import { useMatches } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { useFeedback } from '@/features/feedback/api/use-feedback';
import { t } from '@/locales/en';

/** Footer link that opens a dialog for telling staff about a problem. */
export function FeedbackLink() {
  const [open, setOpen] = useState(false);
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = String(new FormData(event.currentTarget).get('message') ?? '').trim();
    if (!message) return;
    feedback.mutate({
      message,
      context: {
        path: window.location.pathname,
        team_id: teamId,
        user_agent: navigator.userAgent,
      },
    });
  }

  return (
    <DialogSheet labelledBy={titleId} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3 p-4">
        <h2 id={titleId} className="font-display text-xl font-medium">
          {t('feedback.title')}
        </h2>
        {feedback.isSuccess ? (
          <>
            <p role="status">{t('feedback.thanks')}</p>
            <Button type="button" onClick={onClose} className="w-full">
              {t('feedback.close')}
            </Button>
          </>
        ) : (
          <>
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
              className="block w-full rounded-md border border-flag bg-white px-3 py-2 text-base text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link"
            />
            {feedback.isError && (
              <p role="alert" className="text-sm text-starText">
                {t('common.genericError')}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" loading={feedback.isPending} className="flex-1">
                {t('feedback.send')}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                {t('feedback.cancel')}
              </Button>
            </div>
          </>
        )}
      </form>
    </DialogSheet>
  );
}
