import type { HTMLAttributes } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  neutral: 'bg-flag/50 text-navy',
  success: 'bg-green-100 text-green-900',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-starText',
};

export function Badge({
  tone = 'neutral',
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
