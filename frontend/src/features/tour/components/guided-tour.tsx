import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/components/ui/use-focus-trap';
import { placePopup } from '@/features/tour/placement';
import type { TourStop, TourStopId } from '@/features/tour/stops';
import { t } from '@/locales/en';

/** Space between the target and the highlight ring. */
const RING_PAD = 6;

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

interface Layout {
  /** Null while the target is not in the document. */
  ring: CSSProperties | null;
  /** Null below `lg`, where CSS pins the popup to the bottom. */
  popup: { top: number; left: number } | null;
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

  const measure = useCallback(() => {
    const target = targetOf(stop.id);
    const popup = popupRef.current;
    if (!target) {
      setLayout((prev) => prev && { ...prev, ring: null });
      return;
    }
    if (!popup) return;
    const rect = target.getBoundingClientRect();
    const size = popup.getBoundingClientRect();
    setLayout({
      ring: {
        top: rect.top - RING_PAD,
        left: rect.left - RING_PAD,
        width: rect.width + 2 * RING_PAD,
        height: rect.height + 2 * RING_PAD,
      },
      popup: mediaMatches('(min-width: 1024px)', true)
        ? placePopup(
            rect,
            { width: size.width, height: size.height },
            { width: window.innerWidth, height: window.innerHeight },
          )
        : null,
    });
  }, [stop.id]);

  useLayoutEffect(() => {
    const reduced = mediaMatches('(prefers-reduced-motion: reduce)', false);
    targetOf(stop.id)?.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    measure();
    titleRef.current?.focus({ preventScroll: true });
  }, [stop.id, measure]);

  useEffect(() => {
    window.addEventListener('scroll', measure, { capture: true, passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

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
        className="fixed inset-x-3 bottom-3 z-50 rounded-xl border border-flag bg-white p-4 font-sans text-navy shadow-lg lg:inset-x-auto lg:bottom-auto lg:w-[22.5rem]"
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
