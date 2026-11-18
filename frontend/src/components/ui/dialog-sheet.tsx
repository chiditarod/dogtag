import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/components/ui/use-focus-trap';

interface DialogSheetProps {
  /** Id of the element that names the dialog. */
  labelledBy: string;
  onClose: () => void;
  /** Extra classes for the dialog box, e.g. a fixed height. */
  className?: string;
  /** Clicking the dimmed area outside the dialog also calls `onClose`. */
  closeOnBackdrop?: boolean;
  /** The head, scrolling body and pinned foot, laid out as a flex column. */
  children: ReactNode;
}

/**
 * Modal shell: a bottom sheet below `sm`, a centered dialog from `sm`.
 * Escape closes, Tab stays inside, and focus returns to whatever opened it.
 * A control inside that handles Escape itself (clearing a search, cancelling
 * an edit) calls `preventDefault()`, and the dialog stays open.
 */
export function DialogSheet({
  labelledBy,
  onClose,
  className = '',
  closeOnBackdrop = false,
  children,
}: DialogSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // A drag that starts inside the dialog and ends on the dimmed area also
  // fires a click there; only a press that began on the backdrop closes.
  const pressStartedOnBackdrop = useRef(false);
  useFocusTrap(dialogRef, onClose);
  // Read while rendering: children focus themselves in their own effects,
  // which run before this component's.
  const openerRef = useRef<HTMLElement | null>(null);
  if (openerRef.current === null) {
    openerRef.current = document.activeElement as HTMLElement | null;
  }

  useEffect(() => {
    const opener = openerRef.current;
    return () => {
      // The opener may be gone (adding a racer replaces its row) or may never
      // have been a control; fall back to the page's main heading so focus
      // does not drop to <body>.
      if (opener?.isConnected && opener !== document.body) {
        opener.focus();
        return;
      }
      const heading = document.querySelector<HTMLElement>('h1');
      if (!heading) return;
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
      heading.focus();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-navy/50 sm:items-center sm:p-4"
      onPointerDown={
        closeOnBackdrop
          ? (event) => {
              pressStartedOnBackdrop.current = event.target === event.currentTarget;
            }
          : undefined
      }
      onClick={
        closeOnBackdrop
          ? (event) => {
              if (event.target === event.currentTarget && pressStartedOnBackdrop.current) {
                onClose();
              }
              pressStartedOnBackdrop.current = false;
            }
          : undefined
      }
    >
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
