import { describe, expect, it } from 'vitest';
import { sanitizeHtml, stripTags } from '@/lib/sanitize-html';

describe('sanitizeHtml', () => {
  it('keeps allowed formatting', () => {
    const html = '<p>Hi <b>there</b> <strong>x</strong> <i>y</i> <em>z</em><br></p><ul><li>one</li></ul><ol><li>two</li></ol>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('adds target and rel to http, https and mailto links and drops other attributes', () => {
    const out = sanitizeHtml(
      `<a href='https://example.com/x' onclick="alert(1)" style="color:red" class="c">A</a>` +
        `<a href="http://example.com">B</a><a href="mailto:a@b.org?subject=Hi">C</a>`,
    );
    const doc = new DOMParser().parseFromString(out, 'text/html');
    const links = [...doc.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://example.com/x',
      'http://example.com',
      'mailto:a@b.org?subject=Hi',
    ]);
    for (const a of links) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
      expect([...a.attributes].map((attr) => attr.name).sort()).toEqual(['href', 'rel', 'target']);
    }
  });

  it('removes script and style elements including their content', () => {
    const out = sanitizeHtml('before<script>alert(1)</script><style>p{}</style>after');
    expect(out).toBe('beforeafter');
  });

  it('removes event handler attributes and unknown elements but keeps their text', () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)"><div onclick="x()"><span>text</span></div><b onmouseover="y()">bold</b>');
    expect(out).toBe('text<b>bold</b>');
    expect(out).not.toMatch(/onerror|onclick|onmouseover|<img/);
  });

  it.each([
    "javascript:alert(1)",
    "  JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "&#106;avascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:x",
    "//evil.example/x",
    "/relative",
    "ftp://example.com",
  ])('drops the unsafe href %s but keeps the link text', (href) => {
    const out = sanitizeHtml(`<a href="${href}">click</a>`);
    expect(out).toBe('click');
  });

  it('escapes text so it cannot reintroduce markup', () => {
    expect(sanitizeHtml('1 &lt; 2 &amp; <b>3</b>')).toBe('1 &lt; 2 &amp; <b>3</b>');
    expect(sanitizeHtml('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('drops svg and math wrappers, leaving only safe text', () => {
    const out = sanitizeHtml('<svg><script>alert(1)</script><a href="javascript:x">t</a></svg><math><b>m</b></math>');
    expect(out).not.toMatch(/svg|math|script|javascript/i);
  });

  it('handles the real-world mismatched list tags in the fixture', () => {
    const out = sanitizeHtml('<ul><li>a</li></ol>tail');
    expect(out).toBe('<ul><li>a</li>tail</ul>');
  });
});

describe('stripTags', () => {
  it('returns plain text', () => {
    expect(stripTags(`Got <a href='https://x.test'>Instagram</a>?`)).toBe('Got Instagram?');
  });
});
