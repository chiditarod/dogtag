import { useCallback } from 'react';

const SKIPPED_TYPES = new Set(['hidden', 'button', 'reset', 'image']);

function isFocusable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (!/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName)) return false;
  if ((el as HTMLInputElement).disabled) return false;
  if (el.tabIndex < 0 || el.closest('[hidden]')) return false;
  // Skips InfoTip triggers and other `type="button"` controls.
  return !SKIPPED_TYPES.has((el as HTMLInputElement).type);
}

/**
 * Returns `(fromEl) => void`, which focuses the next focusable control after
 * `fromEl` in DOM order within the same `<form>`. It is a no-op when `fromEl`
 * is null, is not inside a form, or is already the last control.
 *
 * Typical use: `onComplete={() => advance(inputRef.current)}`.
 */
export function useAutoAdvance(): (fromEl: HTMLElement | null) => void {
  return useCallback((fromEl) => {
    const form = fromEl?.closest('form');
    if (!fromEl || !form) return;
    const controls = Array.from(form.elements).filter(isFocusable);
    const index = controls.indexOf(fromEl);
    controls[index + 1]?.focus();
  }, []);
}
