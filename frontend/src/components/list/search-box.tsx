import { useEffect, useId, useRef, useState } from 'react';

export const SEARCH_DEBOUNCE_MS = 300;

interface SearchBoxProps {
  /** The text the URL holds. When it changes from outside (Clear all, a chip), the box follows it. */
  value: string;
  onSearch: (q: string) => void;
  /** Screen-reader label; the box shows only the placeholder. */
  label: string;
  placeholder?: string;
  id?: string;
  /** Classes for the wrapping div. */
  className?: string;
}

/** A search box that waits for a pause in typing before it calls `onSearch` with the trimmed text. */
export function SearchBox({ value, onSearch, label, placeholder, id, className = '' }: SearchBoxProps) {
  const [text, setText] = useState(value);
  const sent = useRef(value);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  // A new onSearch identity must not restart the debounce.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    // The value changed from outside: follow it.
    if (value !== sent.current) {
      sent.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    // Only the trimmed text is sent, so spaces alone send nothing and the box keeps what was typed.
    const next = text.trim();
    if (next === sent.current) return;
    const timer = setTimeout(() => {
      sent.current = next;
      onSearchRef.current(next);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <div className={className}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        type="search"
        className="min-h-11 w-full rounded-md border border-flag bg-white px-3 text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link disabled:opacity-60"
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  );
}
