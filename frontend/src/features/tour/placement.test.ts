import { describe, expect, it } from 'vitest';
import { placePopup } from '@/features/tour/placement';

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
