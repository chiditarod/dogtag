import { useMemo, type MouseEvent } from 'react';
import { sanitizeHtml } from '@/lib/sanitize-html';

interface SafeHtmlProps {
  html: string;
  as?: 'span' | 'div';
  className?: string;
  id?: string;
}

/** Tailwind's preflight strips link styling, so anchors are restyled in every context. */
const linkClass =
  '[&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:no-underline [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-link';

/** A link click must neither toggle an enclosing label's control nor bubble to its handlers. */
function keepLinkClicksLocal(event: MouseEvent) {
  if ((event.target as Element).closest('a')) event.stopPropagation();
}

/** The only place HTML strings become markup: always run through the allowlist sanitizer. */
export function SafeHtml({ html, as: Tag = 'span', className = '', id }: SafeHtmlProps) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  return (
    <Tag
      id={id}
      className={`safe-html ${linkClass} ${className}`.trim()}
      onClick={keepLinkClicksLocal}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
