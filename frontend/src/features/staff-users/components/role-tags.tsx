import { Badge } from '@/components/ui/badge';
import { t } from '@/locales/en';

const LABELS: Record<string, Parameters<typeof t>[0]> = {
  admin: 'staff.users.role.admin',
  operator: 'staff.users.role.operator',
  refunder: 'staff.users.role.refunder',
};

/** One badge per role; a role this page does not know is shown as its raw name. */
export function RoleTags({ roles }: { roles: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role}>{LABELS[role] ? t(LABELS[role]) : role}</Badge>
      ))}
    </span>
  );
}
