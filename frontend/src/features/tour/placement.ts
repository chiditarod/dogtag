/** Space between the target and the popup. */
const GAP = 12;
/** The popup keeps this far from every viewport edge. */
const MARGIN = 16;
/** Below lg the card is this far from the screen edge (`top-3` / `bottom-3`). */
const DOCK_MARGIN = 12;
/** Below lg, space kept between the highlight ring and the card. */
const DOCK_GAP = 12;
/** Space between the target and the highlight ring. */
export const RING_PAD = 6;

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

type Dock = 'bottom' | 'top';

/**
 * Below lg: where to dock the card and where to scroll so the target is clear of it.
 *
 * Each dock leaves a free band (above a bottom card, below a top card, 12px from
 * the card). Bottom is tried first, then top: a dock wins when the target and its
 * ring fit its band at the current scroll (no scroll), or at the scroll that
 * centers the target in the band, clamped to `[0, max]`. If neither fits, the
 * card docks at the bottom with the bottom band's centering scroll.
 */
export function dockPopup(
  target: { top: number; bottom: number },
  popupHeight: number,
  viewport: { height: number },
  scroll: { top: number; max: number },
): { dock: Dock; scrollTop: number } {
  const bands: Record<Dock, { top: number; bottom: number }> = {
    bottom: { top: 0, bottom: viewport.height - DOCK_MARGIN - popupHeight - DOCK_GAP },
    top: { top: DOCK_MARGIN + popupHeight + DOCK_GAP, bottom: viewport.height },
  };
  const fits = (band: { top: number; bottom: number }, scrollTop: number) => {
    const shift = scrollTop - scroll.top;
    return target.top - shift - RING_PAD >= band.top && target.bottom - shift + RING_PAD <= band.bottom;
  };
  const centered = (band: { top: number; bottom: number }) =>
    clamp(
      Math.round(scroll.top + (target.top + target.bottom) / 2 - (band.top + band.bottom) / 2),
      0,
      Math.max(0, scroll.max),
    );

  for (const dock of ['bottom', 'top'] as const) {
    const band = bands[dock];
    if (fits(band, scroll.top)) return { dock, scrollTop: scroll.top };
    const scrollTop = centered(band);
    if (fits(band, scrollTop)) return { dock, scrollTop };
  }
  return { dock: 'bottom', scrollTop: centered(bands.bottom) };
}
