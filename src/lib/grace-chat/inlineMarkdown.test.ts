import { describe, it, expect } from 'vitest';
import { tokenizeInline, parseChatLine, chatPlainText } from './inlineMarkdown';

describe('inline markdown for chat bubbles', () => {
  it('renders the model\'s candidate list the way it meant it (leg 4a reply)', () => {
    const line = parseChatLine('- **Sarah Mitchell**');
    expect(line.bullet).toBe(true);
    expect(line.segments).toEqual([{ kind: 'bold', text: 'Sarah Mitchell' }]);
    expect(chatPlainText('- **Sarah Mitchell**\n- **Sarah Chen**')).toBe('• Sarah Mitchell\n• Sarah Chen');
  });

  it('keeps bare URLs as links and everything else as text', () => {
    expect(tokenizeInline('see https://example.org/x?y=1 now')).toEqual([
      { kind: 'text', text: 'see ' }, { kind: 'link', text: 'https://example.org/x?y=1' }, { kind: 'text', text: ' now' },
    ]);
  });

  it('does not mistake arithmetic or snake_case for italics', () => {
    expect(tokenizeInline('2*3*4 and first_name_only')).toEqual([{ kind: 'text', text: '2*3*4 and first_name_only' }]);
    expect(tokenizeInline('this is *quiet* emphasis')).toEqual([
      { kind: 'text', text: 'this is ' }, { kind: 'italic', text: 'quiet' }, { kind: 'text', text: ' emphasis' },
    ]);
  });

  it('inline code and headings', () => {
    expect(tokenizeInline('run `npm test` first')).toEqual([
      { kind: 'text', text: 'run ' }, { kind: 'code', text: 'npm test' }, { kind: 'text', text: ' first' },
    ]);
    const h = parseChatLine('## This week');
    expect(h.heading).toBe(true);
    expect(h.segments).toEqual([{ kind: 'text', text: 'This week' }]);
  });

  it('leaves a lone or unbalanced marker alone', () => {
    expect(chatPlainText('5 * 3 = 15')).toBe('5 * 3 = 15');
    expect(chatPlainText('**not closed')).toBe('**not closed');
    expect(chatPlainText('**')).toBe('**');
  });
});
