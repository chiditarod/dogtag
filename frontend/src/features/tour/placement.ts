/** Space between the target and the popup. */
const GAP = 12;
/** The popup keeps this far from every viewport edge. */
const MARGIN = 16;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Popup's top-left: below the target when it fits, else above; clamped 16px inside the viewport. */
export function placePopup(
  target: Pick<DOMRect, 'top' | 'bottom' | 'left'>,
  popup: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const below = target.bottom + GAP;
  const fitsBelow = below + popup.height <= viewport.height - MARGIN;
  const top = fitsBelow ? below : target.top - GAP - popup.height;
  return {
    top: clamp(top, MARGIN, viewport.height - MARGIN - popup.height),
    left: clamp(target.left, MARGIN, viewport.width - MARGIN - popup.width),
  };
}
