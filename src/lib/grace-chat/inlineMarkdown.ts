/**
 * The small, deliberate subset of markdown a chat bubble renders.
 *
 * The model writes `**Sarah Mitchell**` and `- ` bullets when it lists
 * candidates; the bubble was showing the asterisks literally (2026-09-04
 * browser rehearsal, leg 4a). This is not a markdown engine — no nesting,
 * no tables, no raw HTML — just what a reply to a pastor actually contains:
 * bold, italic, inline code, bullets, and bare URLs. Pure functions, so the
 * renderer is a thin map over segments and the behaviour is unit-tested here.
 */

export type InlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string };

export interface ChatLine {
  /** True when the line began with a list marker (- * •); the marker is removed. */
  bullet: boolean;
  /** True for `#` headings; rendered bold, hashes removed. */
  heading: boolean;
  segments: InlineSegment[];
}

// Bold, inline code and URLs are unambiguous. Single-asterisk / underscore
// italic only counts when it opens after a non-word character and closes
// before one, so "2*3*4" and snake_case_names stay literal.
const INLINE = /(\*\*[^*\n]+?\*\*|`[^`\n]+`|https?:\/\/[^\s)]+|(?<![\w*])\*[^*\n]+?\*(?![\w*])|(?<!\w)_[^_\n]+?_(?!\w))/g;

export function tokenizeInline(line: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  for (const part of line.split(INLINE)) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) out.push({ kind: 'bold', text: part.slice(2, -2) });
    else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) out.push({ kind: 'code', text: part.slice(1, -1) });
    else if (/^https?:\/\//.test(part)) out.push({ kind: 'link', text: part });
    else if ((part.startsWith('*') && part.endsWith('*') || part.startsWith('_') && part.endsWith('_')) && part.length > 2) out.push({ kind: 'italic', text: part.slice(1, -1) });
    else out.push({ kind: 'text', text: part });
  }
  return out;
}

export function parseChatLine(raw: string): ChatLine {
  const heading = /^\s{0,3}#{1,6}\s+/.test(raw);
  const bullet = !heading && /^\s*[-*•]\s+/.test(raw);
  const text = heading ? raw.replace(/^\s{0,3}#{1,6}\s+/, '') : bullet ? raw.replace(/^\s*[-*•]\s+/, '') : raw;
  return { bullet, heading, segments: tokenizeInline(text) };
}

export function parseChatMarkdown(content: string): ChatLine[] {
  return content.split('\n').map(parseChatLine);
}

/** The plain words, for anything that must not carry markup (tests, a11y, copy). */
export function chatPlainText(content: string): string {
  return parseChatMarkdown(content)
    .map(l => (l.bullet ? '• ' : '') + l.segments.map(s => s.text).join(''))
    .join('\n');
}
