import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { ApiError } from '@/lib/api-client';
import { formatMoney } from '@/lib/money';
import { t } from '@/locales/en';
import type { Fee, FeeRace, FeeTier, FeeTierStatus, TierPayload } from '../api/types';
import { useAddPrice, useDeletePrice, useUpdatePrice } from '../api/use-staff-fees';
import { formatStart } from '../format';
import { PriceRowForm } from './price-row-form';

const TONES: Record<FeeTierStatus, 'success' | 'warning' | 'neutral'> = {
  current: 'success',
  next: 'warning',
  later: 'neutral',
  past: 'neutral',
};

const head = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-navy/70';
const cell = 'px-3 py-2 sm:table-cell sm:align-top';
const rowClass =
  'grid grid-cols-[minmax(0,1fr)_auto] rounded-lg border border-flag bg-white py-1 sm:table-row sm:rounded-none sm:border-0 sm:border-t';
const formRowClass =
  'grid grid-cols-[minmax(0,1fr)] rounded-lg border border-flag bg-page py-1 sm:table-row sm:rounded-none sm:border-0 sm:border-t';
const linkButton =
  'inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-link hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-link disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline';

function ConfirmDeletePrice({ tier, feeId, onClose }: { tier: FeeTier; feeId: number; onClose: () => void }) {
  const titleId = useId();
  const remove = useDeletePrice(tier.id, feeId);
  const pending = remove.isPending;
  const message =
    remove.error instanceof ApiError ? remove.error.error || t('common.genericError') : t('common.genericError');
  const price = formatMoney(tier.price_cents);

  return (
    // Escape and Cancel do nothing while the request is in flight.
    <DialogSheet labelledBy={titleId} onClose={() => !pending && onClose()}>
      <div className="space-y-3 px-4 py-4">
        <h2 id={titleId} className="font-display text-xl font-semibold">
          {t('staff.fees.deletePriceTitle', { price })}
        </h2>
        <p className="text-sm">{t('staff.fees.deletePriceBody')}</p>
        {remove.isError && (
          <p role="alert" className="text-sm font-semibold text-starText">
            {message}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {t('staff.fees.deleteCancel')}
          </Button>
          <Button loading={pending} onClick={() => remove.mutate(undefined, { onSuccess: onClose })}>
            {t('staff.fees.deletePrice')}
          </Button>
        </div>
      </div>
    </DialogSheet>
  );
}

/** Admins only (`can_destroy`); disabled with the server's reason when the price must stay. */
function DeletePrice({ tier, feeId, disabled }: { tier: FeeTier; feeId: number; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  if (!tier.can_destroy) return null;
  const blocked = tier.destroy_blocked_reason;
  const price = formatMoney(tier.price_cents);

  return (
    <>
      <button
        type="button"
        className={`${linkButton} !text-starText`}
        disabled={disabled || blocked !== null}
        aria-label={t('staff.fees.deletePriceLabel', { price })}
        aria-describedby={blocked ? reasonId : undefined}
        onClick={() => setOpen(true)}
      >
        {t('staff.fees.deletePrice')}
      </button>
      {blocked && (
        <p id={reasonId} className="text-sm text-navy/70 sm:max-w-48 sm:whitespace-normal">
          {blocked}
        </p>
      )}
      {open && <ConfirmDeletePrice tier={tier} feeId={feeId} onClose={() => setOpen(false)} />}
    </>
  );
}

type Open = { kind: 'add' } | { kind: 'edit'; id: number } | null;

function AddRow({ fee, race, onClose, onDirtyChange }: Pick<PricesTableProps, 'fee' | 'race'> & FormHooks) {
  const add = useAddPrice(fee.id);
  return (
    <div role="row" className={formRowClass}>
      <PriceRowForm
        others={fee.tiers}
        race={race}
        onSave={(payload: TierPayload) => add.mutateAsync(payload as Required<TierPayload>).then(onClose)}
        onCancel={onClose}
        onDirtyChange={onDirtyChange}
      />
    </div>
  );
}

function EditRow({ fee, tier, race, onClose, onDirtyChange }: Pick<PricesTableProps, 'fee' | 'race'> & FormHooks & { tier: FeeTier }) {
  const update = useUpdatePrice(tier.id, fee.id);
  return (
    <div role="row" className={formRowClass}>
      <PriceRowForm
        initial={tier}
        // The edited price is not a duplicate of itself.
        others={fee.tiers.filter((other) => other.id !== tier.id)}
        race={race}
        onSave={(payload) => update.mutateAsync(payload).then(onClose)}
        onCancel={onClose}
        onDirtyChange={onDirtyChange}
      />
    </div>
  );
}

interface FormHooks {
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

export interface PricesTableProps {
  fee: Fee;
  race: FeeRace;
  /** Told whether the open price form has unsaved changes (the page's leave guard). */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * A fee's prices by start date, with inline add, edit and (admins) delete. One markup: a table from
 * `sm`, stacked cards below it. Only one form is open at a time, and while it is, the other actions
 * are disabled so its changes are not dropped by accident.
 */
export function PricesTable({ fee, race, onDirtyChange }: PricesTableProps) {
  const titleId = useId();
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const report = (dirty: boolean) => onDirtyChange?.(dirty);
  const busy = open !== null;

  return (
    <Card role="region" aria-labelledby={titleId} className="min-w-0 space-y-3">
      <div className="space-y-1">
        <h2 id={titleId} className="font-display text-lg font-semibold">
          {t('staff.fees.prices')}
        </h2>
        <p className="text-sm text-navy/70">{t('staff.fees.pricesCaption')}</p>
      </div>

      <div role="table" aria-label={t('staff.fees.prices')} className="block w-full sm:table">
        <div role="rowgroup" className="hidden sm:table-header-group">
          <div role="row" className="sm:table-row">
            {(['price', 'starts', 'statusColumn'] as const).map((column) => (
              <div key={column} role="columnheader" className={`${head} sm:table-cell`}>
                {t(`staff.fees.${column}`)}
              </div>
            ))}
            <div role="columnheader" className={`${head} sm:table-cell`} />
          </div>
        </div>
        <div role="rowgroup" className="block space-y-3 sm:table-row-group sm:space-y-0">
          {fee.tiers.map((tier) =>
            open?.kind === 'edit' && open.id === tier.id ? (
              <EditRow key={tier.id} fee={fee} tier={tier} race={race} onClose={close} onDirtyChange={report} />
            ) : (
              <div key={tier.id} role="row" className={rowClass}>
                <div role="cell" className={`${cell} order-1 font-semibold`}>
                  {formatMoney(tier.price_cents)}
                </div>
                <div role="cell" className={`${cell} order-3 col-span-2 text-sm [overflow-wrap:anywhere]`}>
                  <span className="text-navy/70 sm:hidden">{t('staff.fees.from')} </span>
                  {formatStart(tier.begin_at, race.time_zone)}
                </div>
                <div role="cell" className={`${cell} order-2`}>
                  <Badge tone={TONES[tier.status]}>{t(`staff.fees.tierStatus.${tier.status}`)}</Badge>
                </div>
                <div role="cell" className={`${cell} order-4 col-span-2 sm:text-right`}>
                  <div className="flex flex-wrap items-center gap-x-2 sm:justify-end">
                    <button
                      type="button"
                      className={linkButton}
                      disabled={busy}
                      aria-label={t('staff.fees.editPriceLabel', { price: formatMoney(tier.price_cents) })}
                      onClick={() => setOpen({ kind: 'edit', id: tier.id })}
                    >
                      {t('staff.fees.editPrice')}
                    </button>
                    <DeletePrice tier={tier} feeId={fee.id} disabled={busy} />
                  </div>
                </div>
              </div>
            ),
          )}
          {open?.kind === 'add' && <AddRow fee={fee} race={race} onClose={close} onDirtyChange={report} />}
        </div>
      </div>

      {fee.tiers.length === 0 && open === null && <p className="text-sm text-navy/70">{t('staff.fees.noPrices')}</p>}

      <div>
        <button type="button" className={linkButton} disabled={busy} onClick={() => setOpen({ kind: 'add' })}>
          {t('staff.fees.addPriceLink')}
        </button>
      </div>
      <p className="text-sm text-navy/70">{t('staff.fees.pricesFooter')}</p>
    </Card>
  );
}
