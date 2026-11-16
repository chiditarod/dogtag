import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/components/ui/use-focus-trap';

interface DialogSheetProps {
  /** Id of the element that names the dialog. */
  labelledBy: string;
  onClose: () => void;
  /** Extra classes for the dialog box, e.g. a fixed height. */
  className?: string;
  /** The head, scrolling body and pinned foot, laid out as a flex column. */
  children: ReactNode;
}

/**
 * Modal shell: a bottom sheet below `sm`, a centered dialog from `sm`.
 * Escape closes, Tab stays inside, and focus returns to whatever opened it.
 */
export function DialogSheet({
  labelledBy,
  onClose,
  className = '',
  children,
}: DialogSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, onClose);
  // Read while rendering: children focus themselves in their own effects,
  // which run before this component's.
  const openerRef = useRef<HTMLElement | null>(null);
  if (openerRef.current === null) {
    openerRef.current = document.activeElement as HTMLElement | null;
  }

  useEffect(() => {
    const opener = openerRef.current;
    // The opener may be gone (adding a racer replaces its row).
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/50 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-lg sm:max-w-lg sm:rounded-xl ${className}`.trim()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
