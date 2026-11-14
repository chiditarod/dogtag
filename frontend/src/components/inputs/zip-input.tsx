import type { ComponentPropsWithRef } from 'react';
import { Input } from '@/components/ui/field';
import { formatZipDisplay, zipDigitCount } from '@/components/inputs/format';

export interface ZipInputProps
  extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  /** Fires once when the value reaches 5 digits (before any +4 part). */
  onComplete?: () => void;
  invalid?: boolean;
}

export function ZipInput({
  value,
  onChange,
  onComplete,
  invalid,
  ...props
}: ZipInputProps) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="postal-code"
      maxLength={10}
      aria-invalid={invalid ? true : undefined}
      {...props}
      type="text"
      value={value}
      onChange={(event) => {
        const next = formatZipDisplay(event.target.value);
        onChange(next);
        if (zipDigitCount(next) >= 5 && zipDigitCount(value) < 5) onComplete?.();
      }}
    />
  );
}
