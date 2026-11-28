import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { t } from '@/locales/en';

/** Asked before an in-app navigation drops unsaved changes. Keep editing is focused and is what Escape does. */
export function DiscardDialog({ body, onKeep, onDiscard }: { body: string; onKeep: () => void; onDiscard: () => void }) {
  const titleId = useId();
  return (
    <DialogSheet labelledBy={titleId} onClose={onKeep}>
      <div className="space-y-3 px-4 py-4">
        <h2 id={titleId} className="font-display text-xl font-semibold">
          {t('staff.discard.title')}
        </h2>
        <p className="text-sm">{body}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onDiscard}>
            {t('staff.discard.discard')}
          </Button>
          <Button autoFocus onClick={onKeep}>
            {t('staff.discard.keepEditing')}
          </Button>
        </div>
      </div>
    </DialogSheet>
  );
}
