import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import type { PastRacer } from '@/features/roster/api/use-past-racers';
import { fullName, racerChipLabel } from '@/features/roster/utils';
import { t } from '@/locales/en';

interface PastRacerListProps {
  racers: PastRacer[];
  onPick: (racer: PastRacer) => void;
  onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href]';

/** Modal, searchable list of past racers. Escape closes; Tab stays inside. */
export function PastRacerList({ racers, onPick, onClose }: PastRacerListProps) {
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    searchRef.current?.focus();
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // The opener may be gone (picking a racer replaces its slot).
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return;
    const items = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return racers;
    return racers.filter((racer) =>
      `${fullName(racer)} ${racer.email}`.toLowerCase().includes(needle),
    );
  }, [racers, query]);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/50 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapTab}
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 rounded-t-lg bg-white p-4 shadow-lg sm:rounded-lg"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {t('roster.pastRacers')}
          </h2>
          <Button variant="ghost" onClick={onClose}>
            {t('roster.close')}
          </Button>
        </div>
        <Input
          ref={searchRef}
          type="search"
          aria-label={t('roster.searchPastRacers')}
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {matches.map((racer) => (
            <li key={racer.email}>
              <button
                type="button"
                onClick={() => onPick(racer)}
                className="block min-h-11 w-full rounded-md px-3 py-2 text-left hover:bg-page focus:outline-none focus-visible:ring-2 focus-visible:ring-link"
              >
                <span className="block text-sm font-semibold">
                  {racerChipLabel(racer)}
                </span>
                <span className="block text-xs text-navy/70">{racer.email}</span>
              </button>
            </li>
          ))}
        </ul>
        {matches.length === 0 && (
          <p className="text-sm text-navy/70">{t('roster.noMatches')}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
