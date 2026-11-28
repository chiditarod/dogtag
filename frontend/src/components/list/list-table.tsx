import type { HTMLAttributes, ReactNode } from 'react';

const headCell = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-navy/70';
const cell = 'block min-w-0 px-3 py-0.5 sm:table-cell sm:py-2 sm:align-top';

interface ListTableProps {
  label: string;
  /** The header row, shown from `sm`; below it each row is a card with no column header. */
  columns: { key: string; label: ReactNode; className?: string }[];
  children: ReactNode;
  className?: string;
}

/** One markup: a real table from `sm`, stacked cards below it. Rows are `ListRow`s of `ListCell`s. */
export function ListTable({ label, columns, children, className = '' }: ListTableProps) {
  return (
    <div role="table" aria-label={label} className={`block w-full sm:table ${className}`.trim()}>
      <div role="rowgroup" className="hidden sm:table-header-group">
        <div role="row" className="sm:table-row">
          {columns.map((column) => (
            <div key={column.key} role="columnheader" className={`${column.className ?? headCell} sm:table-cell`}>
              {column.label}
            </div>
          ))}
        </div>
      </div>
      <div role="rowgroup" className="block space-y-3 sm:table-row-group sm:space-y-0">
        {children}
      </div>
    </div>
  );
}

/** A card below `sm`, a table row from it. `grid-cols-[minmax(0,1fr)]` keeps one long value from widening the card. */
export function ListRow({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="row"
      className={`grid grid-cols-[minmax(0,1fr)] rounded-lg border border-flag py-2 sm:table-row sm:rounded-none sm:border-0 sm:border-t sm:py-0 ${className}`.trim()}
      {...props}
    />
  );
}

/**
 * `label` is a card-only caption: shown below `sm`, where there is no column header, so screen readers read it
 * too. `sm:hidden` takes it out of the table (and the accessibility tree) from `sm`.
 */
export function ListCell({ label, className = '', children }: { label?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div role="cell" className={`${cell} ${className}`.trim()}>
      {label !== undefined && (
        <span className="mr-1 text-xs font-semibold uppercase text-navy/60 sm:hidden">{label} </span>
      )}
      {children}
    </div>
  );
}
