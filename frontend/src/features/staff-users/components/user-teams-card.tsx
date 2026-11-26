import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ListCell, ListRow, ListTable } from '@/components/list/list-table';
import { t } from '@/locales/en';
import type { StaffUserTeam } from '../api/types';

function status(team: StaffUserTeam) {
  if (!team.finalized) return t('staff.users.teamPercent', { percent: team.percent_complete });
  return (
    <Badge tone="success">
      {team.assigned_team_number === null
        ? t('staff.users.teamRegistered')
        : t('staff.users.teamRegisteredNumber', { number: team.assigned_team_number })}
    </Badge>
  );
}

const link = 'text-link underline';

export function UserTeamsCard({ teams }: { teams: StaffUserTeam[] }) {
  const titleId = useId();
  return (
    <Card role="region" aria-labelledby={titleId} className="min-w-0 space-y-3">
      <h2 id={titleId} className="font-display text-lg font-semibold">
        {t('staff.users.teams')}
      </h2>
      {teams.length === 0 ? (
        <p className="text-sm text-navy/70">{t('staff.users.noTeamsList')}</p>
      ) : (
        <ListTable
          label={t('staff.users.teams')}
          columns={[
            { key: 'team', label: t('staff.users.col.team') },
            { key: 'race', label: t('staff.users.col.race') },
            { key: 'status', label: t('staff.users.col.status') },
            { key: 'actions', label: <span className="sr-only">{t('staff.users.col.actions')}</span> },
          ]}
        >
          {teams.map((team) => (
            <ListRow key={team.id} data-team-id={team.id}>
              <ListCell className="break-words font-semibold">
                {/* The legacy team page is Rails, outside the SPA router, so a plain anchor. */}
                <a href={`/teams/${team.id}`} className={link}>
                  {team.name}
                </a>
              </ListCell>
              <ListCell className="text-sm [overflow-wrap:anywhere]">{team.race.name}</ListCell>
              <ListCell className="text-sm">{status(team)}</ListCell>
              <ListCell className="text-sm">
                <Link
                  to={`/staff/emails?team_id=${team.id}`}
                  aria-label={t('staff.users.teamEmailsFor', { name: team.name })}
                  className={link}
                >
                  {t('staff.users.teamEmails')}
                </Link>
              </ListCell>
            </ListRow>
          ))}
        </ListTable>
      )}
    </Card>
  );
}
