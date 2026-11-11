import { useCallback } from 'react';

const SKIPPED_TYPES = new Set(['hidden', 'button', 'reset', 'image']);

// jsdom has no layout (getClientRects is always empty), so detect
// non-rendered controls through computed style instead.
function isNotRendered(el: HTMLElement) {
  if (/^(hidden|collapse)$/.test(getComputedStyle(el).visibility)) return true;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).display === 'none') return true;
  }
  return false;
}

function isFocusable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (!/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName)) return false;
  if ((el as HTMLInputElement).disabled) return false;
  if (el.tabIndex < 0 || el.closest('[hidden], [inert], fieldset:disabled')) {
    return false;
  }
  if (isNotRendered(el)) return false;
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
    const controls = Array.from(form.elements);
    const index = controls.indexOf(fromEl);
    if (index < 0) return;
    controls.slice(index + 1).find(isFocusable)?.focus();
  }, []);
}
