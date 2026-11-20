import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { teamChip } from '@/features/teams/utils';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';

/** The racer's own teams for one race: a tappable row per team with a status chip. */
export function RaceTeams({ teams }: { teams: Team[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-navy/70">
        {t('races.yourTeams')}
      </p>
      <ul className="space-y-2">
        {teams.map((team) => {
          const chip = teamChip(team);
          return (
            <li key={team.id}>
              <Link
                to={`/teams/${team.id}`}
                className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-flag bg-white px-3 py-1.5 hover:bg-flag/20"
              >
                <span className="font-semibold [overflow-wrap:anywhere]">{team.name}</span>
                <Badge tone={chip.tone} className="shrink-0">
                  {chip.text}
                </Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
