import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

interface DialogSheetProps {
  /** Id of the element that names the dialog. */
  labelledBy: string;
  onClose: () => void;
  /** The head, scrolling body and pinned foot, laid out as a flex column. */
  children: ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href]';

/**
 * Modal shell: a bottom sheet below `sm`, a centered dialog from `sm`.
 * Escape closes, Tab stays inside, and focus returns to whatever opened it.
 */
export function DialogSheet({ labelledBy, onClose, children }: DialogSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Read while rendering: children focus themselves in their own effects,
  // which run before this component's.
  const openerRef = useRef<HTMLElement | null>(null);
  if (openerRef.current === null) {
    openerRef.current = document.activeElement as HTMLElement | null;
  }

  useEffect(() => {
    const opener = openerRef.current;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // The opener may be gone (adding a racer replaces its row).
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return;
    const items = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    // The title takes focus but is not tabbable, so it counts as "before first".
    if (event.shiftKey && items.indexOf(active as HTMLElement) <= 0) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/50 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onKeyDown={trapTab}
        className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-lg sm:max-w-lg sm:rounded-xl"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
