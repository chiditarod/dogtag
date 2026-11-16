import { describe, expect, it } from 'vitest';
import { dockPopup, placePopup } from '@/features/tour/placement';

const viewport = { width: 1280, height: 800 };
const popup = { width: 360, height: 200 };
const rect = (left: number, top: number, width = 300, height = 60) =>
  new DOMRect(left, top, width, height);

describe('placePopup', () => {
  it('goes 12px below the target, aligned with its left edge, when it fits', () => {
    expect(placePopup(rect(200, 100), popup, viewport)).toEqual({ top: 172, left: 200 });
  });

  it('goes above a target near the bottom and stays inside the viewport', () => {
    const { top } = placePopup(rect(200, 700), popup, viewport);
    expect(top).toBe(700 - 200 - 12);
    expect(top + popup.height).toBeLessThanOrEqual(viewport.height - 16);
  });

  it('stays 16px inside the right edge', () => {
    expect(placePopup(rect(1100, 100, 150), popup, viewport).left).toBe(1280 - 360 - 16);
  });

  it('never puts the left edge below 16', () => {
    expect(placePopup(rect(0, 100), popup, viewport).left).toBe(16);
    expect(placePopup(rect(-40, 100), popup, viewport).left).toBe(16);
  });
});

describe('dockPopup', () => {
  const span = (top: number, height = 28) => ({ top, bottom: top + height });

  it('(a) docks a 390x745 card at the top for the last row of a page scrolled to the end', () => {
    expect(dockPopup(span(632), 199, { height: 745 }, { top: 900, max: 900 })).toEqual({
      dock: 'top',
      scrollTop: 900,
    });
  });

  it('(b) docks at the bottom mid-page and scrolls the target clear of the card', () => {
    const scroll = { top: 1000, max: 3000 };
    const target = span(450);
    const { dock, scrollTop } = dockPopup(target, 251, { height: 568 }, scroll);
    expect(dock).toBe('bottom');
    const bottomAfter = target.bottom - (scrollTop - scroll.top);
    expect(bottomAfter).toBeLessThanOrEqual(568 - 12 - 251 - 12 - 6);
    expect(target.top - (scrollTop - scroll.top) - 6).toBeGreaterThanOrEqual(0);
  });

  it('(c) keeps a target at the very top of the page where it is, card at the bottom', () => {
    expect(dockPopup({ top: 100, bottom: 128 }, 251, { height: 568 }, { top: 0, max: 2000 })).toEqual({
      dock: 'bottom',
      scrollTop: 0,
    });
  });

  it('(d) docks at the top for a row that cannot clear a bottom card even at the end of the page', () => {
    // At max scroll the row sits at 300-328: below the bottom card's free band (ends at 293).
    const result = dockPopup(span(300), 251, { height: 568 }, { top: 1200, max: 1200 });
    expect(result.dock).toBe('top');
    const top = 300 - (result.scrollTop - 1200);
    expect(top - 6).toBeGreaterThanOrEqual(12 + 251 + 12);
    expect(top + 28 + 6).toBeLessThanOrEqual(568);
  });

  it('(e) falls back to the bottom when the viewport is too short for either', () => {
    expect(dockPopup(span(400), 260, { height: 300 }, { top: 500, max: 1000 })).toEqual({
      dock: 'bottom',
      // Centers the row in the 16px band above the card: 500 + 414 - 8.
      scrollTop: 906,
    });
  });

  it('does not scroll when the target is already clear of the bottom card', () => {
    expect(dockPopup(span(200), 251, { height: 568 }, { top: 700, max: 2000 })).toEqual({
      dock: 'bottom',
      scrollTop: 700,
    });
  });
});
