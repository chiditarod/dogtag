import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { formatDate, formatDeadline } from '@/lib/dates';
import { fromWallClock, zoneAbbreviation } from '@/lib/zoned-time';
import { t } from '@/locales/en';
import { DATE_FIELDS, DATE_LABELS, checkDates, wallDay, type DateField } from '../date-checks';

interface RaceDatesCardProps {
  /** The zone the dates are read in (a `datetime-local` wall clock each). */
  timeZone: string;
  /** The zone the race had when the form opened, to say when it was changed. */
  initialTimeZone: string;
  timeZones: string[];
  values: Record<DateField, string>;
  onChange: (field: DateField, wall: string) => void;
  onTimeZoneChange: (timeZone: string) => void;
  serverErrors: Partial<Record<DateField | 'time_zone', string[]>>;
  /** Show every field's problems now (the form sets this on Save); otherwise a field's own waits for its blur. */
  showAllErrors?: boolean;
  /** For tests. */
  now?: Date;
}

const select =
  'block min-h-11 w-full rounded-md border border-flag bg-white px-3 py-2 font-sans text-base text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link aria-[invalid=true]:border-star';

/** `opens Mon, Dec 7, 2026`: what racers read, which for a deadline at midnight is the day before. */
function racersSee(field: DateField, iso: string, timeZone: string): string {
  switch (field) {
    case 'registration_open':
      return t('staff.races.dates.seeOpens', { date: formatDate(iso, timeZone) });
    case 'registration_close':
      return t('staff.races.dates.seeCloses', { date: formatDeadline(iso, timeZone) });
    case 'final_edits_close':
      return t('staff.races.dates.seeFinalEdits', { date: formatDeadline(iso, timeZone) });
    case 'race_datetime':
      return t('staff.races.dates.seeRaceDay', { date: formatDate(iso, timeZone) });
  }
}

const DEADLINES: readonly DateField[] = ['registration_close', 'final_edits_close'];

export function RaceDatesCard({
  timeZone,
  initialTimeZone,
  timeZones,
  values,
  onChange,
  onTimeZoneChange,
  serverErrors,
  showAllErrors = false,
  now,
}: RaceDatesCardProps) {
  const [touched, setTouched] = useState<ReadonlySet<DateField>>(new Set());
  const { errors, warnings } = checkDates(values, timeZone, now);
  const zoneOptions = !timeZone || timeZones.includes(timeZone) ? timeZones : [timeZone, ...timeZones];
  const zoneChanged = !!timeZone && !!initialTimeZone && timeZone !== initialTimeZone;

  return (
    <Card role="region" aria-labelledby="race-dates-title" className="space-y-4">
      <h2 id="race-dates-title" className="font-display text-lg font-medium">
        {t('staff.races.dates.title')}
      </h2>

      <Field
        label={t('staff.races.dates.timeZone')}
        name="time_zone"
        help={t('staff.races.dates.timeZoneHelp')}
        error={serverErrors.time_zone}
        className="sm:max-w-sm"
      >
        {(control) => (
          <select
            {...control}
            className={select}
            value={timeZone}
            onChange={(event) => onTimeZoneChange(event.target.value)}
          >
            {zoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        )}
      </Field>

      {zoneChanged && (
        <p role="note" className="rounded-md border-l-4 border-link bg-flag/30 px-3 py-2 text-sm text-navy">
          {t('staff.races.dates.zoneChanged', { from: initialTimeZone, to: timeZone })}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        {DATE_FIELDS.map((name) => {
          const wall = values[name];
          const show = showAllErrors || touched.has(name);
          const problem = show ? errors[name] : undefined;
          const warning = show && !problem ? warnings[name] : undefined;
          const iso = fromWallClock(wall, timeZone);
          const messages = [...new Set([problem, ...(serverErrors[name] ?? [])].filter((m): m is string => !!m))];
          const midnight = DEADLINES.includes(name) && iso !== null && wall.endsWith('T00:00');

          return (
            <Field key={name} label={DATE_LABELS[name]} name={name} error={messages}>
              {(control) => (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      {...control}
                      type="datetime-local"
                      step={60}
                      className="min-w-0 flex-1"
                      value={wall}
                      onChange={(event) => onChange(name, event.target.value)}
                      onBlur={() => setTouched((current) => new Set(current).add(name))}
                    />
                    <span className="w-10 shrink-0 text-sm text-navy/70">{zoneAbbreviation(wall, timeZone)}</span>
                  </div>
                  {iso !== null && !problem && (
                    <p className="text-sm text-green-800">
                      {t('staff.races.dates.racersSee', { text: racersSee(name, iso, timeZone) })}
                    </p>
                  )}
                  {midnight && (
                    <p className="text-sm text-navy/70">
                      {t('staff.races.dates.midnight', {
                        day: wallDay(wall),
                        shown: formatDeadline(iso, timeZone),
                      })}
                    </p>
                  )}
                  {warning && <p className="text-sm text-amber-900">{warning}</p>}
                </>
              )}
            </Field>
          );
        })}
      </div>
    </Card>
  );
}
