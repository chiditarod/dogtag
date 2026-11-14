import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/features/auth/api/use-me';
import { usePay, type PayVariables } from '@/features/payments/api/use-pay';
import { fetchTeam, teamQueryKey } from '@/features/teams/api/use-team';
import { useTeamPageError } from '@/features/teams/components/team-page-error';
import { formatCents, isFeeOpensLater } from '@/features/teams/utils';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/dates';
import { openStripeCheckout } from '@/lib/stripe-checkout';
import { t } from '@/locales/en';
import type { FeeItem, Team } from '@/types/api';

type Phase = 'idle' | 'popup' | 'posting';

const MOCK_TYPE = 'MockPaymentRequirement';

/** A message shown on the row of the requirement it is about. */
interface RowMessage {
  requirementId: number;
  text: string;
}

export function FeeCard({ team }: { team: Team }) {
  const { checklist, race } = team;
  const { fee } = checklist;
  const queryClient = useQueryClient();
  const me = useMe();
  const pay = usePay(team.id);
  const { reportError, clearError } = useTeamPageError();

  const [phase, setPhase] = useState<Phase>('idle');
  // The requirement being paid; only one payment at a time across the card.
  const [activeId, setActiveId] = useState<number | null>(null);
  const [message, setMessage] = useState<RowMessage | null>(null);
  // Synchronous guard: state updates are async, so a fast double-click would
  // otherwise open two Checkout popups.
  const busy = useRef(false);
  // The requirement whose payment is in flight, so its paid text (or the card's
  // paid summary) takes focus when it appears.
  const focusPaid = useRef<number | null>(null);

  if (checklist.finalized || (fee.done && fee.paid_cents > 0)) {
    return (
      <p
        tabIndex={-1}
        ref={(element) => {
          if (element && focusPaid.current !== null) {
            focusPaid.current = null;
            element.focus();
          }
        }}
        className="text-base font-semibold text-navy focus:outline-none"
      >
        {fee.paid_cents > 0
          ? t('fee.paidTotal', { amount: formatCents(fee.paid_cents) })
          : t('fee.paidNoAmount')}
      </p>
    );
  }
  if (!race.open_for_registration) {
    return <p className="text-base text-navy">{t('fee.closed')}</p>;
  }
  if (isFeeOpensLater(fee)) {
    return (
      <p className="text-base text-navy">
        {t('fee.opensLater', {
          date: formatDate(fee.next_tier!.begins_at, race.time_zone),
        })}
      </p>
    );
  }
  if (race.full) {
    return <p className="text-base text-navy">{t('fee.waitlist')}</p>;
  }
  if (fee.done || fee.items.length === 0) {
    return (
      <p className="text-base text-navy">
        {fee.done ? t('fee.noneDue') : t('fee.notAvailable')}
      </p>
    );
  }

  const isMock = (item: FeeItem) =>
    race.payment_requirements.find(
      (requirement) => requirement.id === item.requirement_id,
    )?.type === MOCK_TYPE;

  function handleError(item: FeeItem, error: unknown) {
    if (reportError(error)) return; // 403: page banner, which also refetches.
    const card = error instanceof ApiError && error.status === 402;
    // Anything but a card decline may have been a lost success (or an
    // already-paid/in-progress conflict), so let the server's state settle.
    if (!card) {
      void queryClient.invalidateQueries({ queryKey: teamQueryKey(team.id) });
    }
    setMessage({
      requirementId: item.requirement_id,
      text:
        error instanceof ApiError && error.error
          ? error.error
          : t('common.genericError'),
    });
  }

  async function submit(item: FeeItem, variables: PayVariables) {
    setPhase('posting');
    focusPaid.current = item.requirement_id;
    try {
      await pay.mutateAsync(variables);
      clearError();
    } catch (error) {
      focusPaid.current = null;
      handleError(item, error);
    }
  }

  /**
   * The server charges the tier active right now, so confirm this row's
   * displayed price is still current before showing a Checkout popup for it.
   * Returns the amount to charge, or null when it changed and the user must review.
   */
  async function confirmedAmount(item: FeeItem, amountCents: number): Promise<number | null> {
    const fresh = await queryClient.fetchQuery({
      queryKey: teamQueryKey(team.id),
      queryFn: () => fetchTeam(team.id),
      staleTime: 0,
    });
    const next = fresh.checklist.fee.items.find(
      (line) => line.requirement_id === item.requirement_id,
    );
    if (!next || next.done) return null;
    if (next.amount_due_cents === amountCents) return amountCents;
    if (next.amount_due_cents !== null) {
      setMessage({
        requirementId: item.requirement_id,
        text: t('fee.changed', {
          name: item.name,
          amount: formatCents(next.amount_due_cents),
        }),
      });
    }
    return null;
  }

  async function handlePay(item: FeeItem) {
    const amountCents = item.amount_due_cents;
    if (busy.current || amountCents === null) return;
    busy.current = true;
    const mock = isMock(item);
    setMessage(null);
    setActiveId(item.requirement_id);
    setPhase(mock ? 'posting' : 'popup');
    try {
      if (mock) {
        await submit(item, { requirementId: item.requirement_id, mock: true });
        return;
      }
      if (!race.stripe_publishable_key) {
        setMessage({ requirementId: item.requirement_id, text: t('fee.unavailable') });
        return;
      }
      let current;
      try {
        current = await confirmedAmount(item, amountCents);
      } catch (error) {
        handleError(item, error);
        return;
      }
      if (current === null) return;

      let result;
      try {
        result = await openStripeCheckout({
          key: race.stripe_publishable_key,
          amountCents: current,
          email: me.data?.email ?? '',
          description: item.name,
          name: race.name,
        });
      } catch {
        setMessage({ requirementId: item.requirement_id, text: t('fee.unavailable') });
        return;
      }
      // Popup closed without paying: quietly allow another try.
      if (!result) return;
      await submit(item, {
        requirementId: item.requirement_id,
        stripeToken: result.token,
        stripeEmail: result.email,
        expectedAmountCents: current,
      });
    } finally {
      busy.current = false;
      setPhase('idle');
      setActiveId(null);
    }
  }

  const processing = phase !== 'idle';

  return (
    <ul className="divide-y divide-flag">
      {fee.items.map((item) => (
        <FeeRow
          key={item.requirement_id}
          item={item}
          mock={isMock(item)}
          disabled={processing}
          processing={processing && activeId === item.requirement_id}
          message={
            message?.requirementId === item.requirement_id ? message.text : null
          }
          focusPaid={focusPaid}
          timeZone={race.time_zone}
          onPay={() => void handlePay(item)}
        />
      ))}
    </ul>
  );
}

function FeeRow({
  item,
  mock,
  disabled,
  processing,
  message,
  focusPaid,
  timeZone,
  onPay,
}: {
  item: FeeItem;
  mock: boolean;
  disabled: boolean;
  processing: boolean;
  message: string | null;
  focusPaid: RefObject<number | null>;
  timeZone: string;
  onPay: () => void;
}) {
  let body;
  if (item.done) {
    body = (
      <p
        tabIndex={-1}
        ref={(element) => {
          if (element && focusPaid.current === item.requirement_id) {
            focusPaid.current = null;
            element.focus();
          }
        }}
        className="text-base font-semibold text-navy focus:outline-none"
      >
        {item.paid_cents > 0
          ? t('fee.paid', { amount: formatCents(item.paid_cents) })
          : t('team.pillPaid')}
      </p>
    );
  } else if (item.amount_due_cents === null) {
    body = (
      <p className="text-base text-navy">
        {item.next_tier
          ? t('fee.itemOpens', {
              date: formatDate(item.next_tier.begins_at, timeZone),
            })
          : t('fee.notAvailable')}
      </p>
    );
  } else {
    const amount = formatCents(item.amount_due_cents);
    body = (
      <>
        <p className="font-display text-3xl font-bold text-navy">{amount}</p>
        {item.next_tier && (
          <p className="text-sm text-navy/80">
            {t('fee.nextTier', {
              amount: formatCents(item.next_tier.price_cents),
              date: formatDate(item.next_tier.begins_at, timeZone),
            })}
          </p>
        )}
        <Button
          disabled={disabled}
          aria-busy={processing || undefined}
          onClick={onPay}
        >
          {processing
            ? t('fee.processing')
            : mock
              ? t('fee.mockPay')
              : t('fee.pay', { amount })}
        </Button>
      </>
    );
  }

  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <p className="font-semibold text-navy">{item.name}</p>
      {body}
      {message && (
        <p role="alert" className="text-sm text-starText">
          {message}
        </p>
      )}
    </li>
  );
}
