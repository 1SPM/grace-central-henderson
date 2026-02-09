import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitizeHtml,
  sanitizeInput,
  sanitizePhone,
  isValidEmail,
  isValidUrl,
  isValidUUID,
  maskSensitiveData,
  sanitizeObject,
} from './security';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    );
  });

  it('returns empty string for non-string input', () => {
    expect(escapeHtml(null as unknown as string)).toBe('');
    expect(escapeHtml(undefined as unknown as string)).toBe('');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('does not modify safe strings', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('sanitizeHtml', () => {
  it('removes script tags and content', () => {
    expect(sanitizeHtml('<p>Hi</p><script>alert(1)</script>')).toBe('<p>Hi</p>');
  });

  it('removes event handlers', () => {
    const result = sanitizeHtml('<div onmouseover="steal()">text</div>');
    expect(result).not.toContain('onmouseover');
    expect(result).not.toContain('steal');
  });

  it('removes javascript: URIs', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).not.toContain('javascript');
  });

  it('removes iframe tags', () => {
    expect(sanitizeHtml('<iframe src="evil.com"></iframe>')).not.toContain('iframe');
  });

  it('removes form tags', () => {
    expect(sanitizeHtml('<form action="phish.com"><input></form>')).not.toContain('form');
  });

  it('removes style tags', () => {
    expect(sanitizeHtml('<style>body{background:url(evil)}</style>')).not.toContain('style');
  });

  it('strips non-allowlisted tags', () => {
    const result = sanitizeHtml('<marquee>text</marquee>');
    expect(result).not.toContain('marquee');
  });

  it('preserves allowlisted tags', () => {
    const result = sanitizeHtml('<p>paragraph</p><strong>bold</strong>');
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
  });

  it('preserves allowed attributes (class, style)', () => {
    const result = sanitizeHtml('<div class="test" style="color:red">hi</div>');
    expect(result).toContain('class=');
    expect(result).toContain('style=');
  });

  it('strips non-allowed attributes', () => {
    const result = sanitizeHtml('<div id="evil" data-x="y">hi</div>');
    expect(result).not.toContain('id=');
    expect(result).not.toContain('data-x');
  });

  it('strips expression() from style values', () => {
    const result = sanitizeHtml('<div style="width:expression(alert(1))">hi</div>');
    expect(result).not.toContain('expression');
  });

  it('strips url() from style values', () => {
    const result = sanitizeHtml('<div style="background:url(evil.js)">hi</div>');
    expect(result).not.toContain('url(');
  });

  it('removes svg and math tags', () => {
    expect(sanitizeHtml('<svg onload="alert(1)"></svg>')).not.toContain('svg');
    expect(sanitizeHtml('<math><mi>x</mi></math>')).not.toContain('math');
  });

  it('handles nested dangerous content', () => {
    const input = '<div><script>alert(1)</script><p>safe</p></div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('script');
    expect(result).toContain('<p>safe</p>');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeHtml(123 as unknown as string)).toBe('');
  });
});

describe('sanitizeInput', () => {
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('removes null bytes', () => {
    expect(sanitizeInput('hel\0lo')).toBe('hello');
  });

  it('removes newlines by default', () => {
    expect(sanitizeInput('line1\nline2')).toBe('line1 line2');
  });

  it('preserves newlines when allowed', () => {
    expect(sanitizeInput('line1\nline2', { allowNewlines: true })).toBe('line1\nline2');
  });

  it('enforces max length', () => {
    expect(sanitizeInput('abcdef', { maxLength: 3 })).toBe('abc');
  });

  it('returns empty string for non-string', () => {
    expect(sanitizeInput(null as unknown as string)).toBe('');
  });
});

describe('sanitizePhone', () => {
  it('strips non-digit characters except leading +', () => {
    expect(sanitizePhone('+1 (555) 123-4567')).toBe('+15551234567');
  });

  it('limits to 15 digits', () => {
    expect(sanitizePhone('1234567890123456789')).toBe('123456789012345');
  });

  it('returns empty string for non-string', () => {
    expect(sanitizePhone(null as unknown as string)).toBe('');
  });
});

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('first.last@domain.org')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidEmail(null as unknown as string)).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
  });

  it('rejects non-http protocols', () => {
    expect(isValidUrl('ftp://files.com')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('isValidUUID', () => {
  it('accepts valid UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects invalid UUIDs', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
  });
});

describe('maskSensitiveData', () => {
  it('masks data keeping first 4 chars visible', () => {
    expect(maskSensitiveData('sk_test_12345')).toBe('sk_t*********');
  });

  it('fully masks short strings', () => {
    expect(maskSensitiveData('abc')).toBe('***');
  });
});

describe('sanitizeObject', () => {
  it('escapes all string values in an object', () => {
    const result = sanitizeObject({ name: '<script>bad</script>', age: 25 });
    expect(result.name).toBe('&lt;script&gt;bad&lt;&#x2F;script&gt;');
    expect(result.age).toBe(25);
  });

  it('handles nested objects', () => {
    const result = sanitizeObject({ inner: { val: '<b>hi</b>' } });
    expect((result.inner as { val: string }).val).toContain('&lt;b&gt;');
  });
});
