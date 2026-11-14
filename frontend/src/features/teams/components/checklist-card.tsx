import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { t } from '@/locales/en';

interface ChecklistCardProps {
  number: number;
  title: string;
  status: 'done' | 'todo';
  /** Short status pill, e.g. "2 of 5", "$150", "Done". */
  pill: string;
  /** Muted, not-yet-available card (used by the final "You're in!" card). */
  locked?: boolean;
  children?: ReactNode;
}

export function ChecklistCard({
  number,
  title,
  status,
  pill,
  locked = false,
  children,
}: ChecklistCardProps) {
  const done = status === 'done';
  return (
    <Card
      role="group"
      aria-labelledby={`checklist-card-${number}`}
      className={`space-y-3 ${locked ? 'bg-page opacity-80' : ''}`}
      data-status={status}
      data-locked={locked || undefined}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-base font-semibold ${
            done
              ? 'bg-green-100 text-green-900'
              : locked
                ? 'bg-flag/50 text-navy'
                : 'bg-star text-white'
          }`}
        >
          {done ? '✓' : locked ? '🔒' : number}
        </span>
        <h2
          id={`checklist-card-${number}`}
          className="min-w-0 flex-1 font-display text-xl font-semibold"
        >
          {title}
        </h2>
        <Badge tone={done ? 'success' : 'neutral'}>
          {pill}
          <span className="sr-only">
            , {done ? t('team.srDone') : t('team.srTodo')}
          </span>
        </Badge>
      </div>
      {children}
    </Card>
  );
}
