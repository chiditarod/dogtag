import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/features/auth/api/use-me';
import { usePay, type PayVariables } from '@/features/payments/api/use-pay';
import { teamQueryKey } from '@/features/teams/api/use-team';
import { useTeamPageError } from '@/features/teams/components/team-page-error';
import { formatCents, isFeeOpensLater } from '@/features/teams/utils';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/dates';
import { openStripeCheckout } from '@/lib/stripe-checkout';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';

type Phase = 'idle' | 'popup' | 'posting';

const MOCK_TYPE = 'MockPaymentRequirement';

export function FeeCard({ team }: { team: Team }) {
  const { checklist, race } = team;
  const { fee } = checklist;
  const queryClient = useQueryClient();
  const me = useMe();
  const pay = usePay(team.id);
  const { reportError, clearError } = useTeamPageError();

  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  // Synchronous guard: state updates are async, so a fast double-click would
  // otherwise open two Checkout popups.
  const busy = useRef(false);

  const requirement =
    race.payment_requirements.find((item) => item.id === fee.requirement_id) ??
    race.payment_requirements[0];
  const mock = requirement?.type === MOCK_TYPE;

  if (checklist.finalized || (fee.done && fee.paid_cents > 0)) {
    return (
      <p className="text-base font-semibold text-navy">
        {fee.paid_cents > 0
          ? t('fee.paid', { amount: formatCents(fee.paid_cents) })
          : t('fee.paidNoAmount')}
      </p>
    );
  }
  if (isFeeOpensLater(fee)) {
    return (
      <p className="text-base text-navy">
        {t('fee.opensLater', { date: formatDate(fee.next_tier!.begins_at) })}
      </p>
    );
  }
  if (race.full) {
    return <p className="text-base text-navy">{t('fee.waitlist')}</p>;
  }
  if (fee.amount_due_cents === null || !requirement) {
    return <p className="text-base text-navy">{t('fee.noneDue')}</p>;
  }

  const amountCents = fee.amount_due_cents;
  const amount = formatCents(amountCents);

  function handleError(error: unknown) {
    if (reportError(error)) return;
    if (error instanceof ApiError) {
      if (error.status === 409) {
        // Already paid, or another payment is still being processed.
        void queryClient.invalidateQueries({ queryKey: teamQueryKey(team.id) });
        setMessage(
          /process/i.test(error.error) ? error.error : t('fee.alreadyPaid'),
        );
        return;
      }
      setMessage(error.error || t('common.genericError'));
      return;
    }
    setMessage(t('common.genericError'));
  }

  async function submit(variables: PayVariables) {
    setPhase('posting');
    try {
      await pay.mutateAsync(variables);
      clearError();
    } catch (error) {
      handleError(error);
    }
  }

  async function handlePay() {
    if (busy.current || !requirement) return;
    busy.current = true;
    setMessage(null);
    setPhase(mock ? 'posting' : 'popup');
    try {
      if (mock) {
        await submit({ requirementId: requirement.id, mock: true });
        return;
      }
      let result;
      try {
        result = await openStripeCheckout({
          key: race.stripe_publishable_key ?? '',
          amountCents,
          email: me.data?.email ?? '',
          description: `${requirement.name} for ${team.name} | ${race.name}`,
          name: race.name,
        });
      } catch {
        setMessage(t('fee.unavailable'));
        return;
      }
      // Popup closed without paying: quietly allow another try.
      if (!result) return;
      await submit({
        requirementId: requirement.id,
        stripeToken: result.token,
        stripeEmail: result.email,
      });
    } finally {
      busy.current = false;
      setPhase('idle');
    }
  }

  const processing = phase !== 'idle';

  return (
    <div className="space-y-3">
      <p className="font-display text-3xl font-bold text-navy">{amount}</p>
      {fee.next_tier && (
        <p className="text-sm text-navy/80">
          {t('fee.nextTier', {
            amount: formatCents(fee.next_tier.price_cents),
            date: formatDate(fee.next_tier.begins_at),
          })}
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm text-starText">
          {message}
        </p>
      )}
      <Button
        disabled={processing}
        aria-busy={processing || undefined}
        onClick={() => void handlePay()}
      >
        {processing
          ? t('fee.processing')
          : mock
            ? t('fee.mockPay')
            : t('fee.pay', { amount })}
      </Button>
    </div>
  );
}
