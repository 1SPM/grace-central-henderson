/**
 * Security Utilities
 *
 * Provides sanitization, validation, and security helper functions
 * to prevent XSS, injection attacks, and other security vulnerabilities.
 */

// HTML entities to escape for XSS prevention
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escapes HTML special characters to prevent XSS attacks
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitizes a string for safe display in HTML context.
 * Uses an allowlist approach: only permits safe tags and attributes.
 * Falls back to stripping dangerous patterns for broader compatibility.
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';

  // Allowlisted tags for report output
  const ALLOWED_TAGS = new Set([
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'ul', 'ol', 'li', 'br', 'strong', 'em', 'b', 'i',
  ]);

  // Allowlisted attributes
  const ALLOWED_ATTRS = new Set([
    'class', 'style', 'colspan', 'rowspan',
  ]);

  let result = html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove noscript tags
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    // Remove all event handlers (on*)
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')
    // Remove dangerous URI schemes
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    // Remove expression() CSS (IE)
    .replace(/expression\s*\(/gi, '')
    // Remove -moz-binding CSS
    .replace(/-moz-binding\s*:/gi, '')
    // Remove iframe, embed, object, form, input, link, meta, base, svg, math tags
    .replace(/<\/?(iframe|embed|object|frame|frameset|form|input|textarea|select|button|link|meta|base|svg|math)\b[^>]*>/gi, '')
    // Remove style tags (can contain expression() or @import attacks)
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Strip non-allowlisted attributes from remaining tags
  result = result.replace(/<(\w+)(\s[^>]*)?(\/?)>/gi, (_match, tag: string, attrs: string, selfClose: string) => {
    const tagLower = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(tagLower)) {
      return ''; // Strip non-allowlisted tags entirely
    }
    if (!attrs) return `<${tag}${selfClose}>`;

    // Filter attributes to only allowed ones
    const cleanAttrs: string[] = [];
    const attrRegex = /\s(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
      if (ALLOWED_ATTRS.has(attrName)) {
        // Ensure style values don't contain dangerous patterns
        if (attrName === 'style') {
          const safeStyle = attrValue
            .replace(/expression\s*\(/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/url\s*\(/gi, '');
          cleanAttrs.push(` ${attrName}="${safeStyle}"`);
        } else {
          cleanAttrs.push(` ${attrName}="${escapeHtml(attrValue)}"`);
        }
      }
    }
    return `<${tag}${cleanAttrs.join('')}${selfClose}>`;
  });

  // Also strip closing tags for non-allowlisted elements
  result = result.replace(/<\/(\w+)>/gi, (match, tag: string) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? match : '';
  });

  return result;
}

/**
 * Validates and sanitizes user input for text fields
 */
export function sanitizeInput(input: string, options?: {
  maxLength?: number;
  allowNewlines?: boolean;
}): string {
  if (typeof input !== 'string') return '';

  let result = input.trim();

  // Remove null bytes
  result = result.replace(/\0/g, '');

  // Optionally remove newlines
  if (!options?.allowNewlines) {
    result = result.replace(/[\r\n]/g, ' ');
  }

  // Limit length
  if (options?.maxLength && result.length > options.maxLength) {
    result = result.slice(0, options.maxLength);
  }

  return result;
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validates and formats phone number
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return '';
  // Remove all non-digit characters except + at start
  const cleaned = phone.replace(/(?!^\+)[^\d]/g, '');
  // Limit to reasonable phone number length
  return cleaned.slice(0, 15);
}

/**
 * Validates URL format
 */
export function isValidUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * CSRF Token Management
 */
class CSRFManager {
  private token: string | null = null;
  private readonly tokenKey = 'grace-csrf-token';

  generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    this.token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(this.tokenKey, this.token);
    return this.token;
  }

  getToken(): string {
    if (!this.token) {
      const stored = sessionStorage.getItem(this.tokenKey);
      if (stored) {
        this.token = stored;
      } else {
        return this.generateToken();
      }
    }
    return this.token;
  }

  validateToken(token: string): boolean {
    return this.token === token && token.length === 64;
  }

  getHeaders(): Record<string, string> {
    return {
      'X-CSRF-Token': this.getToken(),
    };
  }
}

export const csrfManager = new CSRFManager();

/**
 * Secure fetch wrapper with CSRF protection
 */
export async function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

  // Add CSRF token for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || '')) {
    headers.set('X-CSRF-Token', csrfManager.getToken());
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin', // Include cookies for same-origin requests
  });
}

/**
 * Rate limiter for client-side operations
 */
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  isAllowed(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < windowMs);

    if (validAttempts.length >= maxAttempts) {
      return false;
    }

    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (typeof data !== 'string' || data.length <= visibleChars) {
    return '*'.repeat(data?.length || 8);
  }
  return data.slice(0, visibleChars) + '*'.repeat(data.length - visibleChars);
}

/**
 * Validate that a value is a safe object ID (UUID format)
 */
export function isValidUUID(id: string): boolean {
  if (typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Sanitize object by escaping all string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key in result) {
    if (typeof result[key] === 'string') {
      (result as Record<string, unknown>)[key] = escapeHtml(result[key] as string);
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      (result as Record<string, unknown>)[key] = sanitizeObject(result[key] as Record<string, unknown>);
    }
  }
  return result;
}
