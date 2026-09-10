import { describe, it, expect } from 'vitest';
import { withTtsRetry, isRetriableTtsFailure, composeSpeechText, splitSpeechChunks, stripForSpeech } from './useGraceSpeech';

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

  it('drops ":00" from on-the-hour times before am/pm so TTS never says "oh-oh"', () => {
    expect(composeSpeechText('Your meeting with Bill is Tuesday at 2:00 p.m.')).toContain('at 2 p.m.');
    expect(composeSpeechText('Service starts at 10:00 AM sharp.')).toContain('at 10 AM sharp.');
  });

  it('says o\'clock for on-the-hour times with no meridiem', () => {
    expect(composeSpeechText('Doors open at 6:00 tonight.')).toContain("at 6 o'clock tonight.");
  });

  it('leaves non-zero minutes alone — TTS reads "2:45" naturally', () => {
    expect(composeSpeechText('Rehearsal runs until 2:45 p.m.')).toContain('until 2:45 p.m.');
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

describe('withTtsRetry — one transient chunk must not cost the whole answer', () => {
  const failWith = (status: number) => Object.assign(new Error(`TTS ${status}`), { status });
  const noSleep = { sleep: async () => {} };

  it('retries once on a 5xx and returns the second attempt', async () => {
    // The 2026-09-04 rehearsal: edge 503 on the first chunk, 200 a moment later.
    let calls = 0;
    const out = await withTtsRetry(async () => { calls++; if (calls === 1) throw failWith(503); return 'audio'; }, noSleep);
    expect(out).toBe('audio');
    expect(calls).toBe(2);
  });

  it('retries a network failure the same way', async () => {
    let calls = 0;
    const out = await withTtsRetry(async () => { calls++; if (calls === 1) throw new TypeError('Failed to fetch'); return 'audio'; }, noSleep);
    expect(out).toBe('audio');
    expect(calls).toBe(2);
  });

  it('does not retry a 4xx — 401 and 429 mean something', async () => {
    let calls = 0;
    await expect(withTtsRetry(async () => { calls++; throw failWith(429); }, noSleep)).rejects.toMatchObject({ status: 429 });
    expect(calls).toBe(1);
  });

  it('gives up after the configured attempts and rethrows the last error', async () => {
    let calls = 0;
    await expect(withTtsRetry(async () => { calls++; throw failWith(502); }, { ...noSleep, attempts: 2 })).rejects.toMatchObject({ status: 502 });
    expect(calls).toBe(2);
  });

  it('never retries an abort — the user pressed stop', async () => {
    let calls = 0;
    await expect(withTtsRetry(async () => { calls++; throw new DOMException('aborted', 'AbortError'); }, noSleep)).rejects.toThrow('aborted');
    expect(calls).toBe(1);
  });

  it('classifies failures', () => {
    expect(isRetriableTtsFailure(failWith(503))).toBe(true);
    expect(isRetriableTtsFailure(failWith(502))).toBe(true);
    expect(isRetriableTtsFailure(failWith(401))).toBe(false);
    expect(isRetriableTtsFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRetriableTtsFailure(new Error('TTS empty response'))).toBe(false);
  });
});
