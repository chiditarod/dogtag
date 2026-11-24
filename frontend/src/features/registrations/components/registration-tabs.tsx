import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { t } from '@/locales/en';
import type { RegistrationsTab } from '../types';

interface RegistrationTabsProps {
  tab: RegistrationsTab;
  onChange: (tab: RegistrationsTab) => void;
  counts: Record<RegistrationsTab, number>;
  /** The second tab reads "Waitlist" once the race is full. */
  kind: 'registering' | 'waitlist';
  children: ReactNode;
}

const ORDER: RegistrationsTab[] = ['registered', 'registering'];

/** Two tabs (with counts after search and filters) and the panel that holds the list for the chosen one. */
export function RegistrationTabs({ tab, onChange, counts, kind, children }: RegistrationTabsProps) {
  const id = useId();

  function label(key: RegistrationsTab) {
    const name = key === 'registering' && kind === 'waitlist' ? 'waitlist' : key;
    return t(`registrations.tab.${name}`, { n: counts[key] });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = ORDER[(ORDER.indexOf(tab) + step + ORDER.length) % ORDER.length];
    onChange(next);
    document.getElementById(`${id}-${next}`)?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={t('registrations.tabs')} className="flex border-b-2 border-flag">
        {ORDER.map((key) => {
          const selected = key === tab;
          return (
            <button
              key={key}
              id={`${id}-${key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(key)}
              onKeyDown={onKeyDown}
              className={`-mb-0.5 min-h-11 px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-link sm:px-4 ${
                selected ? 'border-b-4 border-star text-navy' : 'border-b-4 border-transparent text-navy/70 hover:text-navy'
              }`}
            >
              {label(key)}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="pt-3">
        {children}
      </div>
    </div>
  );
}
