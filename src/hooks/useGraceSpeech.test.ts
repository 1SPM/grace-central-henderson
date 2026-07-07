import { describe, it, expect } from 'vitest';
import { composeSpeechText, splitSpeechChunks, stripForSpeech } from './useGraceSpeech';

describe('composeSpeechText — the Anti-List Rule', () => {
  it('weaves short bullet items into a single comma-joined sentence', () => {
    const input = 'Three people need care:\n- Sarah Bennett\n- Marcus Cruz\n- Lily Tran';
    const out = composeSpeechText(input);
    expect(out).not.toContain('-');
    expect(out).toContain('Sarah Bennett, Marcus Cruz, and');
    expect(out.split('\n')).toHaveLength(1);
  });

  it('joins two short items with "and"', () => {
    const out = composeSpeechText('- Overdue tasks\n- New visitors');
    expect(out).toBe('Overdue tasks and new visitors.');
  });

  it('weaves longer items with soft connectors, never counting words', () => {
    const input = [
      '- Sarah Bennett has not attended in forty days and may appreciate a call from someone she trusts',
      '- The Riveras gave their first gift on Sunday, a moment worth celebrating personally',
      '- Wednesday night youth group still has no leader assigned for next week',
    ].join('\n');
    const out = composeSpeechText(input);
    expect(out).not.toMatch(/firstly|secondly|step one|number one/i);
    expect(out).toMatch(/Also, |And |Then there is /);
    expect(out).not.toMatch(/^- /m);
  });

  it('handles numbered lists the same as bullets', () => {
    const out = composeSpeechText('1. Check the roster\n2. Call the Bennetts');
    expect(out).not.toContain('1.');
    expect(out).not.toContain('2.');
    expect(out).toContain('and');
  });

  it('converts dashes to commas for a natural micro-pause', () => {
    const out = composeSpeechText('Giving is up — a strong month.');
    expect(out).not.toContain('—');
    expect(out).toContain('Giving is up, a strong month.');
  });

  it('expands & and w/ into spoken words', () => {
    const out = composeSpeechText('Care & giving are steady w/ no surprises.');
    expect(out).toContain('Care and giving');
    expect(out).toContain('with no surprises');
  });

  it('strips shouty label prefixes', () => {
    const out = composeSpeechText('STATUS: everything ran fine overnight.');
    expect(out).toBe('everything ran fine overnight.');
  });

  it('ensures terminal punctuation so pacing stays even', () => {
    const out = composeSpeechText('Good morning\nThe brief is ready');
    expect(out).toBe('Good morning. The brief is ready.');
  });

  it('keeps currency intact', () => {
    const out = composeSpeechText('- $4,200 from 18 gifts\n- Top giver at $900');
    expect(out).toContain('$4,200');
    expect(out).toContain('$900');
  });
});

describe('splitSpeechChunks', () => {
  it('returns single chunk for short text', () => {
    expect(splitSpeechChunks('Hello there.')).toEqual(['Hello there.']);
  });

  it('returns empty for blank text', () => {
    expect(splitSpeechChunks('   ')).toEqual([]);
  });

  it('splits at sentence boundaries under the limit', () => {
    const sentence = 'This is a sentence that carries some weight and length for testing purposes. ';
    const text = sentence.repeat(30); // ~2400 chars
    const chunks = splitSpeechChunks(text, 1200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1200);
      expect(chunk.trim().endsWith('.')).toBe(true);
    }
  });

  it('hard-splits a single run-on sentence longer than the limit', () => {
    const text = 'word '.repeat(400).trim(); // ~2000 chars, no punctuation
    const chunks = splitSpeechChunks(text, 500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(500);
    }
    expect(chunks.join(' ').split(/\s+/)).toHaveLength(400);
  });
});

describe('stripForSpeech + composeSpeechText together', () => {
  it('turns a markdown reply into flowing speech', () => {
    const reply = '**Monday Brief**\n\n- Giving: $4,200 last month\n- Visitors: 3 new this week\n\nSee [the dashboard](https://example.com/dash) for more.';
    const out = composeSpeechText(stripForSpeech(reply));
    expect(out).not.toContain('*');
    expect(out).not.toContain('[');
    expect(out).not.toContain('https://');
    expect(out).not.toMatch(/^- /m);
  });
});
