interface FilterChipsProps {
  chips: { key: string; label: string }[];
  onRemove: (key: string) => void;
  onClearAll?: () => void;
  /** Accessible name of the chip list. */
  label: string;
  removeLabel: (chipLabel: string) => string;
  clearAllLabel: string;
}

/** Removable chips for each active filter, plus Clear all. Renders nothing without chips. */
export function FilterChips({ chips, onRemove, onClearAll, label, removeLabel, clearAllLabel }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label={label} className="flex min-w-0 flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key} className="min-w-0">
            <button
              type="button"
              aria-label={removeLabel(chip.label)}
              onClick={() => onRemove(chip.key)}
              className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full bg-flag/50 px-3 text-sm font-semibold text-navy hover:bg-flag"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{chip.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>
      {onClearAll && (
        <button type="button" onClick={onClearAll} className="text-sm font-semibold text-link hover:underline">
          {clearAllLabel}
        </button>
      )}
    </div>
  );
}
