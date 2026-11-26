import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DiscardDialog } from '@/components/ui/discard-dialog';
import { Field, Input } from '@/components/ui/field';
import { NotFound } from '@/components/ui/not-found';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { useLeaveGuard } from '@/components/ui/use-leave-guard';
import { formatDate } from '@/lib/dates';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import { FEE_TYPE_LABELS, type Fee, type FeeRace } from '../api/types';
import { useFee, useRenameFee } from '../api/use-staff-fees';
import { DeleteFee } from './delete-fee';
import { RightNowCard } from './right-now-card';

const link = 'font-semibold text-link hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-link';

function statusLine(fee: Fee, race: FeeRace) {
  if (fee.current_tier) return <Badge tone="success">{t('staff.fees.status.payNow')}</Badge>;
  if (fee.next_tier) {
    return (
      <Badge tone="warning">
        {t('staff.fees.status.payFrom', { date: formatDate(fee.next_tier.begin_at, race.time_zone) })}
      </Badge>
    );
  }
  return <Badge tone="danger">{t('staff.fees.status.noPrice')}</Badge>;
}

function NameCard({ fee, draft, onDraft }: { fee: Fee; draft: string | null; onDraft: (name: string | null) => void }) {
  const titleId = useId();
  const rename = useRenameFee(fee.id);
  const name = draft ?? fee.name;
  const errors = rename.error instanceof ApiError ? rename.error.errors.name : undefined;
  const failure =
    rename.isError && !errors?.length
      ? rename.error instanceof ApiError && rename.error.error
        ? rename.error.error
        : t('common.genericError')
      : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    rename.mutate(name.trim(), { onSuccess: () => onDraft(null) });
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="min-w-0 space-y-3">
      <h2 id={titleId} className="font-display text-lg font-semibold">
        {t('staff.fees.nameCard')}
      </h2>
      <form onSubmit={submit} className="space-y-3">
        <Field label={t('staff.fees.nameCard')} name="name" help={t('staff.fees.nameHelp')} error={errors}>
          <Input
            value={name}
            onChange={(event) => {
              onDraft(event.target.value);
              if (rename.isError) rename.reset();
            }}
          />
        </Field>
        {failure && (
          <p role="alert" className="text-sm font-semibold text-starText">
            {failure}
          </p>
        )}
        <Button type="submit" loading={rename.isPending} disabled={name.trim() === '' || name === fee.name}>
          {t('staff.fees.saveName')}
        </Button>
      </form>
    </Card>
  );
}

export function FeePage({ raceId, feeId }: { raceId: string | undefined; feeId: string | undefined }) {
  const { data, isPending, isError, error, refetch } = useFee(feeId);
  // `null` while the name is untouched; set by typing, cleared once saved.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  // Task 7's open price form reports its unsaved changes here.
  const [priceFormDirty] = useState(false);
  const nameDirty = nameDraft !== null && nameDraft !== data?.requirement.name;
  const { blocker, allowLeave } = useLeaveGuard(nameDirty || priceFormDirty);

  if (isPending) return <QueryLoading />;
  if (isError) {
    return error instanceof ApiError && error.status === 404 ? <NotFound /> : <QueryError onRetry={() => void refetch()} />;
  }
  const { requirement: fee, race } = data;
  // A fee under another race's URL is not found.
  if (String(fee.race_id) !== raceId) return <NotFound />;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Link to={`/staff/races/${race.id}`} className={`text-sm ${link}`}>
          {t('staff.fees.back', { name: race.name })}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 space-y-1">
            <h1 className="font-display text-2xl font-semibold [overflow-wrap:anywhere]">{fee.name}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-navy/70">
              <span>{FEE_TYPE_LABELS[fee.type] ?? fee.type}</span>
              <span aria-hidden="true">·</span>
              {statusLine(fee, race)}
            </p>
          </div>
          <DeleteFee fee={fee} onDeleted={allowLeave} />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <NameCard fee={fee} draft={nameDraft} onDraft={setNameDraft} />
        <RightNowCard fee={fee} race={race} />
      </div>

      {blocker.state === 'blocked' && (
        <DiscardDialog body={t('staff.fees.discardBody')} onKeep={() => blocker.reset()} onDiscard={() => blocker.proceed()} />
      )}
    </div>
  );
}
