/**
 * Input Validation Utilities for API Routes
 */

// Email validation regex (RFC 5322 simplified)
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Phone validation regex (E.164 format or common formats)
export const PHONE_REGEX = /^[\d\s\-().+]{7,20}$/;

// Validation limits
export const LIMITS = {
  EMAIL_MAX: 254,
  NAME_MAX: 100,
  SUBJECT_MAX: 200,
  MESSAGE_MAX: 5000,
  SMS_MAX: 1600,
  PHONE_MAX: 20,
  NOTE_MAX: 2000,
} as const;

// Validate email format
export function isValidEmail(email: string): boolean {
  return typeof email === 'string' &&
         email.length <= LIMITS.EMAIL_MAX &&
         EMAIL_REGEX.test(email);
}

// Validate phone number format
export function isValidPhone(phone: string): boolean {
  return typeof phone === 'string' &&
         phone.length <= LIMITS.PHONE_MAX &&
         PHONE_REGEX.test(phone);
}

// Sanitize string input (remove potential XSS/injection)
export function sanitizeString(input: unknown, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove HTML tags
    .trim();
}

// Sanitize HTML content (allow safe tags for emails)
export function sanitizeHtml(input: unknown, maxLength: number = 50000): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .trim();
}

// Validate array of emails
export function validateEmailArray(emails: unknown): string[] | null {
  if (!Array.isArray(emails)) return null;
  const validated: string[] = [];
  for (const email of emails) {
    if (typeof email === 'string' && isValidEmail(email)) {
      validated.push(email);
    } else if (typeof email === 'object' && email !== null) {
      // Handle { email: string, name?: string } format
      const emailObj = email as { email?: string; name?: string };
      if (emailObj.email && isValidEmail(emailObj.email)) {
        validated.push(emailObj.name ? `${sanitizeString(emailObj.name, LIMITS.NAME_MAX)} <${emailObj.email}>` : emailObj.email);
      }
    }
  }
  return validated.length > 0 ? validated : null;
}
