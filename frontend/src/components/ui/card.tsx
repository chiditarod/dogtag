import type { HTMLAttributes } from 'react';

export function Card({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-flag bg-white p-4 shadow-sm ${className}`}
      {...props}
    />
  );
}
