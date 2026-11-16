import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/components/ui/use-focus-trap';
import { dockPopup, placePopup, RING_PAD } from '@/features/tour/placement';
import type { TourStop, TourStopId } from '@/features/tour/stops';
import { t } from '@/locales/en';

const WIDE = '(min-width: 1024px)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const targetOf = (id: TourStopId) => document.querySelector<HTMLElement>(`[data-tour="${id}"]`);

/** Without `matchMedia` (jsdom) the fallback applies. */
function mediaMatches(query: string, fallback: boolean) {
  if (typeof window.matchMedia !== 'function') return fallback;
  return window.matchMedia(query).matches;
}

const sameStops = (a: TourStop[], b: TourStop[]) =>
  a.length === b.length &&
  a.every((stop, i) => stop.id === b[i].id && stop.title === b[i].title && stop.body === b[i].body);

/** Targets are `[data-tour="<stop id>"]`. Stops whose target is missing are skipped. Renders nothing when no stop has a target. */
export function GuidedTour({ stops, onEnd }: { stops: TourStop[]; onEnd: () => void }) {
  const [shown, setShown] = useState<TourStop[]>([]);
  const [currentId, setCurrentId] = useState<TourStopId | null>(null);

  // Targets are only in the DOM after commit, so look for them in an effect.
  useLayoutEffect(() => {
    const present = stops.filter((stop) => targetOf(stop.id));
    setShown((prev) => (sameStops(prev, present) ? prev : present));
    setCurrentId((prev) =>
      present.some((stop) => stop.id === prev) ? prev : (present[0]?.id ?? null),
    );
  }, [stops]);

  const index = shown.findIndex((stop) => stop.id === currentId);
  if (index < 0) return null;
  const last = index === shown.length - 1;

  return (
    <TourPopup
      stop={shown[index]}
      index={index}
      total={shown.length}
      onPrev={() => setCurrentId(shown[index - 1].id)}
      onNext={() => (last ? onEnd() : setCurrentId(shown[index + 1].id))}
      onEnd={onEnd}
    />
  );
}

interface TourPopupProps {
  stop: TourStop;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onEnd: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Layout {
  /** Null while the target is not in the document. */
  ring: Box | null;
  /** Null below `lg`, where CSS docks the popup to an edge. */
  popup: { top: number; left: number } | null;
  /** Below `lg`, the screen edge the card is docked to. */
  dock: 'bottom' | 'top';
}

const sameBox = (a: Partial<Box> | null, b: Partial<Box> | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height);

const ringAround = (rect: DOMRect): Box => ({
  top: rect.top - RING_PAD,
  left: rect.left - RING_PAD,
  width: rect.width + 2 * RING_PAD,
  height: rect.height + 2 * RING_PAD,
});

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

/** True when the target and its ring are on screen and the popup at `placed` does not cover them. */
function clearInView(rect: DOMRect, placed: { top: number; left: number }, size: DOMRect) {
  const ring = ringAround(rect);
  const inView = ring.top >= 0 && ring.top + ring.height <= window.innerHeight;
  const covered =
    placed.top < ring.top + ring.height &&
    placed.top + size.height > ring.top &&
    placed.left < ring.left + ring.width &&
    placed.left + size.width > ring.left;
  return inView && !covered;
}

function TourPopup({ stop, index, total, onPrev, onNext, onEnd }: TourPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const [layout, setLayout] = useState<Layout | null>(null);
  useFocusTrap(popupRef, onEnd);

  // Read while rendering, before the title takes focus.
  const openerRef = useRef<HTMLElement | null>(null);
  if (openerRef.current === null) {
    openerRef.current = document.activeElement as HTMLElement | null;
  }
  useEffect(() => {
    const opener = openerRef.current;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  /** Moves the ring (and the desktop popup) onto the target. Runs on every scroll. */
  const measure = useCallback(() => {
    const target = targetOf(stop.id);
    const popup = popupRef.current;
    if (!target) {
      setLayout((prev) => (prev?.ring ? { ...prev, ring: null } : prev));
      return;
    }
    if (!popup) return;
    const rect = target.getBoundingClientRect();
    const ring = ringAround(rect);
    const placed = mediaMatches(WIDE, true)
      ? placePopup(rect, popup.getBoundingClientRect(), viewport())
      : null;
    setLayout((prev) =>
      prev && sameBox(prev.ring, ring) && sameBox(prev.popup, placed)
        ? prev
        : { ring, popup: placed, dock: prev?.dock ?? 'bottom' },
    );
  }, [stop.id]);

  /**
   * Below lg: docks the card and scrolls the target clear of it. From lg, when
   * `scrollDesktop`: scrolls the target to the middle unless it is already in
   * view and clear of the popup. Runs when a stop opens and on resize, never on
   * scroll, so the card does not flip during the stop's own smooth scroll.
   */
  const decide = useCallback(
    (scrollDesktop: boolean) => {
      const target = targetOf(stop.id);
      const popup = popupRef.current;
      if (!target || !popup) return;
      const rect = target.getBoundingClientRect();
      const size = popup.getBoundingClientRect();
      const behavior = mediaMatches(REDUCED_MOTION, false) ? 'auto' : 'smooth';
      if (mediaMatches(WIDE, true)) {
        if (scrollDesktop && !clearInView(rect, placePopup(rect, size, viewport()), size)) {
          target.scrollIntoView?.({ block: 'center', behavior });
        }
        return;
      }
      const { dock, scrollTop } = dockPopup(
        rect,
        size.height,
        { height: window.innerHeight },
        {
          top: window.scrollY,
          max: document.documentElement.scrollHeight - window.innerHeight,
        },
      );
      setLayout((prev) =>
        prev?.dock === dock ? prev : { ring: prev?.ring ?? null, popup: prev?.popup ?? null, dock },
      );
      if (scrollTop !== window.scrollY && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: scrollTop, behavior });
      }
    },
    [stop.id],
  );

  useLayoutEffect(() => {
    decide(true);
    measure();
    titleRef.current?.focus({ preventScroll: true });
  }, [decide, measure]);

  useEffect(() => {
    const onResize = () => {
      decide(false);
      measure();
    };
    window.addEventListener('scroll', measure, { capture: true, passive: true });
    window.addEventListener('resize', onResize);
    // Layout shifts with no scroll or resize: content loading, a banner, a font swap.
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(() => measure());
      observer.observe(document.documentElement);
      const target = targetOf(stop.id);
      if (target) observer.observe(target);
    }
    return () => {
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [decide, measure, stop.id]);

  return createPortal(
    <>
      {/* Keeps clicks off the page behind the tour. */}
      <div aria-hidden="true" className="fixed inset-0 z-40" />
      {layout?.ring && (
        <div
          data-testid="tour-ring"
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-lg shadow-[0_0_0_3px_theme(colors.link),0_0_0_9999px_theme(colors.navy/50%)]"
          style={layout.ring}
        />
      )}
      <div
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={`fixed inset-x-3 z-50 rounded-xl border border-flag bg-white p-4 font-sans text-navy shadow-lg lg:inset-x-auto lg:w-[22.5rem] ${
          layout?.dock === 'top' ? 'top-3 lg:top-auto' : 'bottom-3 lg:bottom-auto'
        }`}
        style={layout?.popup ?? undefined}
      >
        <h2
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          className="font-display text-xl font-semibold leading-tight focus:outline-none"
        >
          {stop.title}
        </h2>
        <p id={bodyId} className="mt-2">
          {stop.body}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center justify-between gap-2">
            <span className="whitespace-nowrap text-sm text-navy/70">
              {t('tour.counter', { index: index + 1, total })}
            </span>
            <Button variant="ghost" onClick={onEnd}>
              {t('tour.end')}
            </Button>
          </div>
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <Button variant="secondary" onClick={onPrev}>
                {t('tour.prev')}
              </Button>
            )}
            <Button onClick={onNext}>{index === total - 1 ? t('tour.done') : t('tour.next')}</Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
