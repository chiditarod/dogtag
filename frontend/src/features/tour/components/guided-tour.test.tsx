import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { GuidedTour } from '@/features/tour/components/guided-tour';
import { teamTourStops, type TourStop } from '@/features/tour/stops';
import { buildChecklist, buildTeam } from '@/test/fixtures';

const stops = (): TourStop[] =>
  teamTourStops(
    buildTeam({ checklist: buildChecklist({ questions: { required: true, done: false } }) }),
  );

let rects: Record<string, DOMRect>;
let popupRect: DOMRect;

function Page({
  targets,
  tourStops,
  onEnd,
}: {
  targets: string[];
  tourStops: TourStop[];
  onEnd: () => void;
}) {
  return (
    <>
      <button type="button">Page</button>
      {targets.map((id) => (
        <div key={id} data-tour={id}>
          {id}
        </div>
      ))}
      <GuidedTour stops={tourStops} onEnd={onEnd} />
    </>
  );
}

function renderTour(targets = ['flag', 'racers', 'fee']) {
  const onEnd = vi.fn();
  const user = userEvent.setup();
  const view = render(<Page targets={targets} tourStops={stops()} onEnd={onEnd} />);
  return { onEnd, user, view };
}

const ring = () => screen.getByTestId('tour-ring');

describe('GuidedTour', () => {
  beforeEach(() => {
    rects = {
      flag: new DOMRect(100, 50, 200, 40),
      racers: new DOMRect(100, 300, 400, 30),
      fee: new DOMRect(100, 600, 400, 30),
    };
    popupRect = new DOMRect(0, 0, 360, 200);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute('role') === 'dialog') return popupRect;
        return rects[this.dataset.tour ?? ''] ?? new DOMRect();
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens on the first stop that is on the page and skips the missing ones', () => {
    renderTour();
    const dialog = screen.getByRole('dialog', { name: 'Four stars to the start line' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('1 of 3');
    expect(screen.getByRole('heading', { name: 'Four stars to the start line' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Prev' })).not.toBeInTheDocument();
  });

  it('steps forward with Next and back with Prev', async () => {
    const { user } = renderTour();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Add your racers' })).toHaveTextContent('2 of 3');
    expect(screen.getByRole('heading', { name: 'Add your racers' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Prev' }));
    expect(screen.getByRole('dialog', { name: 'Four stars to the start line' })).toHaveTextContent(
      '1 of 3',
    );
  });

  it('reads Done on the last stop and ends the tour with it', async () => {
    const { onEnd, user } = renderTour();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Pay the registration fee' })).toHaveTextContent(
      '3 of 3',
    );
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('ends from any stop with End tour, and with Escape', async () => {
    const { onEnd, user } = renderTour();
    await user.click(screen.getByRole('button', { name: 'End tour' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'End tour' }));
    expect(onEnd).toHaveBeenCalledTimes(2);
    await user.keyboard('{Escape}');
    expect(onEnd).toHaveBeenCalledTimes(3);
  });

  it('keeps Tab inside the popup', async () => {
    const { user } = renderTour();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    const page = screen.getByRole('button', { name: 'Page' });

    screen.getByRole('button', { name: 'Next' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'End tour' })).toHaveFocus();
    expect(page).not.toHaveFocus();

    screen.getByRole('heading', { name: 'Add your racers' }).focus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    expect(page).not.toHaveFocus();
  });

  it('brings Tab back into the popup when focus has fallen to the page', async () => {
    const { user } = renderTour();
    (document.activeElement as HTMLElement).blur();
    expect(document.body).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'End tour' })).toHaveFocus();
  });

  it('renders nothing and does not end when no target is on the page', async () => {
    const { onEnd, user } = renderTour([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('moves the highlight when the window is resized', () => {
    renderTour();
    expect(ring().style.top).toBe('44px');
    expect(ring().style.left).toBe('94px');
    rects.flag = new DOMRect(300, 400, 200, 40);
    act(() => {
      fireEvent(window, new Event('resize'));
    });
    expect(ring().style.top).toBe('394px');
    expect(ring().style.left).toBe('294px');
  });

  it('keeps the highlight exactly on the target while the page scrolls', () => {
    renderTour();
    rects.flag = new DOMRect(120, 10, 200, 40);
    act(() => {
      fireEvent.scroll(window);
    });
    expect(ring().style.top).toBe('4px');
    expect(ring().style.left).toBe('114px');
    expect(ring().className).not.toMatch(/transition/);
    expect(screen.getByRole('dialog').className).not.toMatch(/transition/);
  });

  it('hides the highlight when the target leaves the page', () => {
    const tourStops = stops();
    const onEnd = vi.fn();
    const { rerender } = render(
      <Page targets={['flag', 'racers', 'fee']} tourStops={tourStops} onEnd={onEnd} />,
    );
    expect(ring()).toBeInTheDocument();
    // Same stops array, so the tour does not look for targets again.
    rerender(<Page targets={['racers', 'fee']} tourStops={tourStops} onEnd={onEnd} />);
    act(() => {
      fireEvent.scroll(window);
    });
    expect(screen.queryByTestId('tour-ring')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Four stars to the start line' })).toBeInTheDocument();
  });

  it('places the popup next to the target from lg and docks it to the bottom below', () => {
    const { view } = renderTour();
    // placePopup for the flag (100, 50-90) and a 360x200 popup in a 1024x768 window.
    expect(screen.getByRole('dialog').style.top).toBe('102px');
    expect(screen.getByRole('dialog').style.left).toBe('100px');
    view.unmount();

    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
    renderTour();
    expect(screen.getByRole('dialog').style.top).toBe('');
    expect(screen.getByRole('dialog')).toHaveClass('bottom-3');
  });

  describe('scrolling on desktop', () => {
    let scrollIntoView: Mock;
    beforeEach(() => {
      scrollIntoView = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoView;
    });
    afterEach(() => {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    });

    it('does not scroll when the target is in view and clear of the popup', async () => {
      const { user } = renderTour();
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('scrolls a target that is out of view to the middle', async () => {
      rects.racers = new DOMRect(100, 900, 400, 30);
      const { user } = renderTour();
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    });
  });

  describe('below lg', () => {
    let scrollTo: Mock;
    beforeEach(() => {
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
      vi.stubGlobal('innerHeight', 745);
      vi.stubGlobal('scrollY', 0);
      scrollTo = vi.fn();
      vi.stubGlobal('scrollTo', scrollTo);
      // 50px of page below the fold.
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        configurable: true,
        value: 795,
      });
      popupRect = new DOMRect(12, 534, 366, 199);
      rects.fee = new DOMRect(16, 200, 358, 28);
      rects.in = new DOMRect(16, 730, 358, 28);
    });
    afterEach(() => {
      Reflect.deleteProperty(document.documentElement, 'scrollHeight');
    });

    it('docks at the top for the last stop and scrolls it clear; Prev docks at the bottom again', async () => {
      const { user } = renderTour(['fee', 'in']);
      const dialog = () => screen.getByRole('dialog');
      expect(dialog()).toHaveClass('bottom-3');
      expect(scrollTo).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByRole('dialog', { name: "You're in" })).toHaveClass('top-3');
      expect(dialog()).not.toHaveClass('bottom-3');
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ top: 50, behavior: 'smooth' });

      await user.click(screen.getByRole('button', { name: 'Prev' }));
      expect(screen.getByRole('dialog', { name: 'Pay the registration fee' })).toHaveClass(
        'bottom-3',
      );
      expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    it('decides the dock again on resize, not on scroll', () => {
      renderTour(['fee', 'in']);
      expect(screen.getByRole('dialog')).toHaveClass('bottom-3');

      rects.fee = new DOMRect(16, 730, 358, 28);
      act(() => {
        fireEvent.scroll(window);
      });
      expect(screen.getByRole('dialog')).toHaveClass('bottom-3');

      act(() => {
        fireEvent(window, new Event('resize'));
      });
      expect(screen.getByRole('dialog')).toHaveClass('top-3');
      expect(scrollTo).toHaveBeenCalledWith({ top: 50, behavior: 'smooth' });
    });

    it('scrolls without animation under reduced motion', async () => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('reduce'),
        media: query,
      }));
      const { user } = renderTour(['fee', 'in']);
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(scrollTo).toHaveBeenCalledWith({ top: 50, behavior: 'auto' });
    });
  });

  it('follows a layout shift that neither scrolls nor resizes the window', () => {
    const observers: { callback: () => void; targets: Element[]; disconnected: boolean }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        entry: (typeof observers)[number];
        constructor(callback: () => void) {
          this.entry = { callback, targets: [], disconnected: false };
          observers.push(this.entry);
        }
        observe(target: Element) {
          this.entry.targets.push(target);
        }
        unobserve() {}
        disconnect() {
          this.entry.disconnected = true;
        }
      },
    );
    const { view } = renderTour();
    const live = observers.filter((observer) => !observer.disconnected);
    expect(live).toHaveLength(1);
    expect(live[0].targets).toContain(document.documentElement);
    expect(live[0].targets).toContain(document.querySelector('[data-tour="flag"]'));

    rects.flag = new DOMRect(100, 250, 200, 40);
    act(() => live[0].callback());
    expect(ring().style.top).toBe('244px');

    view.unmount();
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
  });

  it('stays on its stop when the parent re-renders with equal stops', async () => {
    const { onEnd, user, view } = renderTour();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    view.rerender(<Page targets={['flag', 'racers', 'fee']} tourStops={stops()} onEnd={onEnd} />);
    expect(screen.getByRole('dialog', { name: 'Add your racers' })).toBeInTheDocument();
  });

  it('returns focus to where it was when it closes', () => {
    const onEnd = vi.fn();
    const { rerender } = render(<button type="button">Opener</button>);
    screen.getByRole('button', { name: 'Opener' }).focus();
    rerender(
      <>
        <button type="button">Opener</button>
        <div data-tour="flag" />
        <GuidedTour stops={stops()} onEnd={onEnd} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Four stars to the start line' })).toHaveFocus();
    rerender(
      <>
        <button type="button">Opener</button>
        <div data-tour="flag" />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Opener' })).toHaveFocus();
  });
});
