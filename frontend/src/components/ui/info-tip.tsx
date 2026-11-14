import * as Popover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';

interface InfoTipProps {
  /** Accessible name for the trigger, e.g. "About the registration fee". */
  label: string;
  children: ReactNode;
}

export function InfoTip({ label, children }: InfoTipProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className="relative inline-flex h-6 w-6 before:absolute before:-inset-[10px] before:content-[''] items-center justify-center rounded-full text-base leading-none text-link focus:outline-none focus-visible:ring-2 focus-visible:ring-link"
        >
          <span aria-hidden="true">ⓘ</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          aria-label={label}
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-[min(20rem,calc(100vw-1.5rem))] rounded-md border border-flag bg-white p-3 font-sans text-sm text-navy shadow-md focus:outline-none"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
