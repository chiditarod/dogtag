import type { ComponentPropsWithRef } from 'react';
import { Input } from '@/components/ui/field';

type YearsInputProps = Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'onChange' | 'type'
> & {
  value: string;
  onChange: (value: string) => void;
};

/** Years racing, typed as digits. A text input so it has no spinner. */
export function YearsInput({ onChange, ...props }: YearsInputProps) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="off"
      maxLength={3}
      {...props}
      type="text"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
