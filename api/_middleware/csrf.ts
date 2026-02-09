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

/**
 * Generate a cryptographically random CSRF token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware to set CSRF cookie on all responses
 */
export function csrfCookie(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    const token = generateToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Client JS needs to read it
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }
  next();
}

/**
 * Middleware to validate CSRF token on state-changing requests.
 * Skips GET, HEAD, OPTIONS requests.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  // Require the header to be present and to be a valid-length hex string
  if (!headerToken || headerToken.length !== TOKEN_LENGTH || !/^[0-9a-f]+$/i.test(headerToken)) {
    res.status(403).json({ error: 'Invalid or missing CSRF token' });
    return;
  }

  next();
}
