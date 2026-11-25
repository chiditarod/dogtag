import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { t } from '@/locales/en';
import { useRaces } from '@/features/races/api/use-races';

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-star font-display font-bold text-white"
      >
        {n}
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

export function RegistrationIntro() {
  const { data: races } = useRaces();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const headingId = useId();
  const n = races?.find((race) => race.open_for_registration)?.people_per_team;
  const hasCount = n !== undefined;

  return (
    <Card role="region" aria-labelledby={headingId}>
      <h2 id={headingId} className="font-display text-xl font-bold">{t('intro.heading')}</h2>
      <p className="mt-1 hidden text-sm lg:block">{t('intro.tagline')}</p>
      <p className="mt-1 text-sm lg:hidden">
        {hasCount ? t(n === 1 ? 'intro.summary_one' : 'intro.summary_other', { n }) : t('intro.summaryNoCount')}
      </p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="mt-2 min-h-11 w-full border-t border-slate-200 pt-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-link text-sm font-semibold text-link lg:hidden"
      >
        <span aria-hidden="true">{open ? '▾ ' : '▸ '}</span>
        {t('intro.toggle')}
      </button>
      <div id={panelId} className={`${open ? '' : 'hidden'} lg:block`}>
        <ol className="mt-3 space-y-2">
          <Step n={1}>
            <b>{t('intro.step1Lead')}</b>
            {t('intro.step1Rest')}
          </Step>
          <Step n={2}>
            <b>
              {hasCount ? t(n === 1 ? 'intro.step2_one' : 'intro.step2_other', { n }) : t('intro.step2NoCount')}
            </b>
          </Step>
          <Step n={3}>
            <b>{t('intro.step3')}</b>
          </Step>
          <Step n={4}>
            <b>{t('intro.step4Lead')}</b>
            {t('intro.step4Rest')}
          </Step>
        </ol>
        <p className="mt-3 text-sm">{t('intro.waitlist')}</p>
      </div>
    </Card>
  );
}
