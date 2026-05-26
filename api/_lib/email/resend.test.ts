import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { htmlToText, sendViaResend } from './resend';

describe('htmlToText', () => {
  it('strips HTML tags', () => {
    expect(htmlToText('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('translates <br> to newline', () => {
    expect(htmlToText('A<br/>B<br>C')).toBe('A\nB\nC');
  });

  it('translates block elements to double-newline', () => {
    expect(htmlToText('<p>One</p><p>Two</p>')).toBe('One\n\nTwo');
  });

  it('strips style + script tags entirely', () => {
    expect(htmlToText('<style>body{}</style>Visible<script>alert(1)</script>')).toBe('Visible');
  });

  it('decodes common entities (whitespace collapses to single space)', () => {
    expect(htmlToText('&lt;tag&gt; &amp; &quot;Q&quot; &nbsp;X')).toBe('<tag> & "Q" X');
  });

  it('collapses excessive whitespace', () => {
    expect(htmlToText('A     B\n\n\n\nC')).toBe('A B\n\nC');
  });
});

describe('sendViaResend (no API key)', () => {
  const originalKey = process.env.RESEND_API_KEY;
  beforeEach(() => { delete process.env.RESEND_API_KEY; });
  afterEach(() => { if (originalKey) process.env.RESEND_API_KEY = originalKey; });

  it('skips with reason=no_api_key when key absent', async () => {
    const result = await sendViaResend({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.skipped) {
      expect(result.reason).toBe('no_api_key');
    }
  });
});

describe('sendViaResend (with API key)', () => {
  const originalKey = process.env.RESEND_API_KEY;
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_xxxxx';
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    if (originalKey) process.env.RESEND_API_KEY = originalKey;
    else delete process.env.RESEND_API_KEY;
    vi.unstubAllGlobals();
  });

  it('skips with invalid_recipient when to is missing @', async () => {
    const result = await sendViaResend({
      to: 'not-an-email',
      subject: 'X',
      html: '<p>x</p>',
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.skipped) {
      expect(result.reason).toBe('invalid_recipient');
    }
  });

  it('returns ok with message_id on 200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'em_xxx' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const result = await sendViaResend({
      to: 'pastor@example.com',
      subject: 'Welcome',
      html: '<p>Hi</p>',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('resend');
      expect(result.message_id).toBe('em_xxx');
    }
  });

  it('returns failure on non-200 with error message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'invalid_from' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    }));
    const result = await sendViaResend({
      to: 'pastor@example.com',
      subject: 'Welcome',
      html: '<p>Hi</p>',
    });
    expect(result.ok).toBe(false);
    if (!result.ok && !result.skipped) {
      expect(result.status).toBe(422);
      expect(result.error).toBe('invalid_from');
    }
  });

  it('returns failure on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await sendViaResend({
      to: 'pastor@example.com',
      subject: 'Welcome',
      html: '<p>Hi</p>',
    });
    expect(result.ok).toBe(false);
    if (!result.ok && !result.skipped) {
      expect(result.error).toMatch(/ECONNREFUSED/);
    }
  });
});
