import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { ConfirmationText } from '@/features/teams/components/confirmation-text';
import { FundraisingStatus } from '@/features/teams/components/fundraising-status';
import { formatDeadline } from '@/lib/dates';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';

const HELP_EMAIL = 'dogtag@chiditarod.org';

interface CompletionDialogProps {
  team: Team;
  onClose: () => void;
}

/** One-time "you're fully registered" confirmation for the captain. */
export function CompletionDialog({ team, onClose }: CompletionDialogProps) {
  const titleId = useId();
  const { checklist, race } = team;
  return (
    <DialogSheet labelledBy={titleId} onClose={onClose}>
      <div className="px-4 pb-2.5 pt-3.5">
        <h2
          id={titleId}
          className="font-display text-[22px] font-semibold leading-tight [overflow-wrap:anywhere]"
        >
          {t('confirm.title')}
        </h2>
        <p className="mt-0.5 text-sm text-navy/70 [overflow-wrap:anywhere]">
          {t('confirm.team', { number: checklist.team_number ?? '', name: team.name })}
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 pb-3.5">
        <ConfirmationText html={checklist.confirmation_html} />
        <FundraisingStatus checklist={checklist} compact />
        <p className="text-sm">
          {t('confirm.editUntil', {
            date: formatDeadline(race.registration_close, race.time_zone),
          })}
        </p>
        {/* #311: the "add to calendar" link will go here. */}
        <p className="text-sm [overflow-wrap:anywhere]">
          {t('confirm.help')}{' '}
          <a href={`mailto:${HELP_EMAIL}`} className="text-link underline">
            {HELP_EMAIL}
          </a>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-flag px-4 pb-4 pt-3">
        <Button onClick={onClose}>{t('confirm.done')}</Button>
      </div>
    </DialogSheet>
  );
}
