import { Fragment } from 'react';
import { parseChatMarkdown } from '../../lib/grace-chat/inlineMarkdown';

/**
 * Renders a chat bubble's text with the subset of markdown the model
 * actually uses — bold, italic, inline code, bullets, bare URLs. The
 * parsing lives in lib/grace-chat/inlineMarkdown.ts; this only maps
 * segments to elements. Bubbles keep `whitespace-pre-wrap`, so line
 * breaks come through as-is and a bullet is just the marker swapped for •.
 */
export function ChatMarkdown({ text }: { text: string }) {
  const lines = parseChatMarkdown(text);
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && '\n'}
          {line.bullet && <span aria-hidden="true">• </span>}
          {line.segments.map((seg, j) => {
            switch (seg.kind) {
              case 'bold': return <strong key={j} className="font-semibold">{seg.text}</strong>;
              case 'italic': return <em key={j}>{seg.text}</em>;
              case 'code': return <code key={j} className="px-1 rounded bg-black/5 dark:bg-white/10 font-mono text-[0.85em]">{seg.text}</code>;
              case 'link': return (
                <a key={j} href={seg.text} target="_blank" rel="noopener noreferrer"
                  className="underline text-blue-700 dark:text-blue-400 hover:text-blue-800 break-all">{seg.text}</a>
              );
              default: return line.heading ? <strong key={j} className="font-semibold">{seg.text}</strong> : <Fragment key={j}>{seg.text}</Fragment>;
            }
          })}
        </Fragment>
      ))}
    </>
  );
}
