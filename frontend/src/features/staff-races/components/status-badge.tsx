import { Badge } from '@/components/ui/badge';
import { t } from '@/locales/en';
import type { StaffRaceSummary } from '../api/types';

export function StatusBadge({ status }: { status: StaffRaceSummary['registration_status'] }) {
  switch (status) {
    case 'open':
      return <Badge tone="success">{t('races.open')}</Badge>;
    case 'waitlist':
      return <Badge tone="warning">{t('races.waitlist')}</Badge>;
    case 'closed':
      return <Badge>{t('races.closed')}</Badge>;
    case 'not_yet_open':
      return <Badge>{t('staff.races.notYetOpen')}</Badge>;
  }
}
