/** Every http(s) URL in the given bodies, with HTML entities and trailing punctuation cleaned, de-duplicated. */
export function extractLinks(...bodies: string[]): string[] {
  const urls = bodies.flatMap((body) => body.match(/https?:\/\/[^\s"'<>)]+/g) ?? []);
  return [...new Set(urls.map((url) => url.replace(/&amp;/g, '&').replace(/[.,]+$/, '')))];
}
