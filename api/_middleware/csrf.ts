/**
 * CSRF Protection Middleware
 *
 * Validates X-CSRF-Token header on state-changing requests.
 * Uses the double-submit cookie pattern:
 * - Server sets a CSRF cookie on first request
 * - Client reads the cookie and sends it as a header
 * - Server verifies they match
 */

import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'grace-csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 64;
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, rawCookie) => {
    const [rawName, ...rest] = rawCookie.trim().split('=');
    if (!rawName || rest.length === 0) {
      return acc;
    }

    acc[rawName] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function isValidTokenFormat(token: string): boolean {
  return token.length === TOKEN_LENGTH && /^[0-9a-f]+$/i.test(token);
}

function hasTrustedOrigin(req: Request): boolean {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    return true;
  }

  const trustedOrigin = new URL(frontendUrl).origin;

  if (origin) {
    return origin === trustedOrigin;
  }

  if (referer) {
    try {
      return new URL(referer).origin === trustedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}

export function csrfCookie(req: Request, res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);

  if (!cookies[CSRF_COOKIE_NAME]) {
    const token = generateToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  next();
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.includes(req.method.toUpperCase())) {
    return next();
  }

  if (!hasTrustedOrigin(req)) {
    res.status(403).json({ error: 'Untrusted request origin' });
    return;
  }

  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
  const cookieToken = parseCookies(req.headers.cookie)[CSRF_COOKIE_NAME];

  if (!headerToken || !cookieToken || !isValidTokenFormat(headerToken) || !isValidTokenFormat(cookieToken)) {
    res.status(403).json({ error: 'Invalid or missing CSRF token' });
    return;
  }

  if (headerToken !== cookieToken) {
    res.status(403).json({ error: 'CSRF token mismatch' });
    return;
  }

  next();
}
