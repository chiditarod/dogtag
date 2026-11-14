const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const ALLOWED = new Set(['a', 'b', 'strong', 'i', 'em', 'br', 'p', 'ul', 'ol', 'li']);
/** Dropped together with their content (unwrapping would leak script/style text). */
const DROPPED = new Set([
  'script',
  'style',
  'template',
  'noscript',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'head',
  'title',
]);
const SAFE_HREF = /^(https?:|mailto:)/i;

function safeHref(href: string | null): string | null {
  const value = href?.trim() ?? '';
  return SAFE_HREF.test(value) ? value : null;
}

function copyChildren(from: Node, to: Node, doc: Document) {
  for (const child of Array.from(from.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      to.appendChild(doc.createTextNode(child.textContent ?? ''));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue; // comments etc.

    const source = child as Element;
    const tag = source.localName.toLowerCase();
    if (source.namespaceURI !== XHTML_NS || DROPPED.has(tag)) continue;
    if (!ALLOWED.has(tag)) {
      copyChildren(source, to, doc); // unwrap, keep the text
      continue;
    }

    let target: Element;
    if (tag === 'a') {
      const href = safeHref(source.getAttribute('href'));
      if (!href) {
        copyChildren(source, to, doc);
        continue;
      }
      target = doc.createElement('a');
      target.setAttribute('href', href);
      target.setAttribute('target', '_blank');
      target.setAttribute('rel', 'noopener noreferrer');
    } else {
      target = doc.createElement(tag);
    }
    if (tag !== 'br') copyChildren(source, target, doc);
    to.appendChild(target);
  }
}

/**
 * Allowlist sanitizer for the small amount of HTML that race content
 * (JSONForm titles, descriptions, help text) contains. Parses into an inert
 * document and rebuilds only allowed elements with only safe attributes.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = doc.createElement('div');
  copyChildren(doc.body, out, doc);
  return out.innerHTML;
}

/** Plain text of (sanitized) HTML, for places that cannot render markup. */
export function stripTags(html: string): string {
  const doc = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html');
  return doc.body.textContent ?? '';
}
