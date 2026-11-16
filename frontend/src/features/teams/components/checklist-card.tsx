import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChicagoStar } from '@/components/ui/chicago-star';
import { t } from '@/locales/en';

interface ChecklistCardProps {
  /** DOM id of the section; the "What's left" links jump to it. */
  anchor: string;
  title: string;
  status: 'done' | 'todo';
  /** Short status pill, e.g. "2 of 5", "$150", "Done". Not shown while locked. */
  pill: string;
  /** Not-yet-available step (the final "You're in!" step): a quiet one-line note. */
  locked?: boolean;
  children?: ReactNode;
}

export function ChecklistCard({
  anchor,
  title,
  status,
  pill,
  locked = false,
  children,
}: ChecklistCardProps) {
  const done = status === 'done';
  const titleId = `${anchor}-title`;
  return (
    <section
      id={anchor}
      role="group"
      aria-labelledby={titleId}
      className={`scroll-mt-4 p-4 lg:p-6 ${locked ? '' : 'space-y-3'}`}
      data-status={status}
      data-locked={locked || undefined}
    >
      <div className="flex items-center gap-3">
        <ChicagoStar filled={done} className="h-6 w-6 shrink-0" />
        <h2
          id={titleId}
          className={`min-w-0 flex-1 font-display text-xl font-semibold ${
            locked ? 'text-navy/60' : ''
          }`}
        >
          {title}
        </h2>
        {!locked && (
          <Badge tone={done ? 'success' : 'neutral'}>
            {pill}
            <span className="sr-only">
              , {done ? t('team.srDone') : t('team.srTodo')}
            </span>
          </Badge>
        )}
      </div>
      {locked ? (
        <p className="ml-9 mt-1 text-sm text-navy/70">{children}</p>
      ) : (
        children
      )}
    </section>
  );
}
