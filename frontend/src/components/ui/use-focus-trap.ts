import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href]';

const focusableIn = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));

/**
 * Keeps Tab inside a modal and calls `onEscape` on Escape. An Escape that a
 * control inside already handled (`preventDefault()`) or that ends an IME
 * composition is left alone. Does nothing while `ref` is not attached.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  onEscape: () => void,
): void {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const root = ref.current;
      if (!root) return;
      if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing) {
        onEscapeRef.current();
      }
      if (event.key !== 'Tab') return;
      const items = focusableIn(root);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // Focus can fall to <body> (a click on plain text, or any click in
      // Safari); Tab from there would walk the page behind the modal.
      if (!root.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      // The title takes focus but is not tabbable, so it counts as "before first".
      if (event.shiftKey && items.indexOf(active as HTMLElement) <= 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [ref]);
}
