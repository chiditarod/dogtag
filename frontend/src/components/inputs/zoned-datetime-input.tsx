import type { ComponentPropsWithRef } from 'react';
import { Input } from '@/components/ui/field';
import { zoneAbbreviation } from '@/lib/zoned-time';

export interface ZonedDateTimeInputProps
  extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'type'> {
  /** A `datetime-local` wall clock (YYYY-MM-DDTHH:mm), read in `timeZone`. */
  value: string;
  /** The IANA zone the wall clock is read in; its abbreviation (CST, CDT) is shown beside the input. */
  timeZone: string;
  onValueChange: (wall: string) => void;
}

/** A `datetime-local` input with the zone abbreviation for the date shown beside it. Takes `Field` control props. */
export function ZonedDateTimeInput({ value, timeZone, onValueChange, ...props }: ZonedDateTimeInputProps) {
  return (
    <div className="flex items-center gap-2">
      <Input
        {...props}
        type="datetime-local"
        step={60}
        className="min-w-0 flex-1"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <span className="min-w-10 shrink-0 whitespace-nowrap text-sm text-navy/70">{zoneAbbreviation(value, timeZone)}</span>
    </div>
  );
}
