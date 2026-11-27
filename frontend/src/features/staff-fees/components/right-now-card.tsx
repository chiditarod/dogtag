import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { formatMoney } from '@/lib/money';
import { t } from '@/locales/en';
import type { Fee, FeeRace } from '../api/types';
import { formatStart } from '../format';

/** Where the Payments page lists this fee's paid teams: the same rows the count is made of. */
export function paymentsHref(race: FeeRace, fee: Fee): string {
  return `/staff/payments?race_id=${race.id}&payment_type=${fee.id}&status=paid`;
}

/** What racers pay now, what comes next, and how many teams paid. */
export function RightNowCard({ fee, race }: { fee: Fee; race: FeeRace }) {
  const titleId = useId();
  const { current_tier: current, next_tier: next, paid_team_count: paid } = fee;
  const rows: [string, React.ReactNode][] = [
    [
      t('staff.fees.price'),
      current
        ? t('staff.fees.priceSince', {
            price: formatMoney(current.price_cents),
            when: formatStart(current.begin_at, race.time_zone),
          })
        : t('staff.fees.noPriceNow'),
    ],
    [
      t('staff.fees.next'),
      next
        ? t('staff.fees.priceFrom', {
            price: formatMoney(next.price_cents),
            when: formatStart(next.begin_at, race.time_zone),
          })
        : t('staff.fees.noNextPrice'),
    ],
    [
      t('staff.fees.paid'),
      paid > 0 ? (
        <>
          {t(paid === 1 ? 'staff.fees.paidTeams_one' : 'staff.fees.paidTeams_other', { n: paid })}
          {' · '}
          <Link
            to={paymentsHref(race, fee)}
            className="text-link hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-link"
          >
            {t('staff.fees.seePayments')}
          </Link>
        </>
      ) : (
        t('staff.fees.noPaidTeams')
      ),
    ],
  ];

  return (
    <Card role="region" aria-labelledby={titleId} className="min-w-0 space-y-3">
      <h2 id={titleId} className="font-display text-lg font-semibold">
        {t('staff.fees.rightNow')}
      </h2>
      <dl className="grid grid-cols-[minmax(0,1fr)] gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,1fr)]">
            <dt className="text-navy/70">{label}</dt>
            <dd className="font-semibold [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
