import { useMemo } from 'react';
import { sanitizeHtml } from '@/lib/sanitize-html';

interface SafeHtmlProps {
  html: string;
  as?: 'span' | 'div';
  className?: string;
  id?: string;
}

/** The only place HTML strings become markup: always run through the allowlist sanitizer. */
export function SafeHtml({ html, as: Tag = 'span', className, id }: SafeHtmlProps) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  return <Tag id={id} className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
