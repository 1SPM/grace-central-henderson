/**
 * Authentication Middleware
 *
 * Verifies Clerk JWT tokens for API route protection.
 * Supports demo mode bypass for development/testing.
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';

// Environment configuration
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const DEMO_MODE = process.env.VITE_ENABLE_DEMO_MODE === 'true';

// Extended request type with auth info
export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    sessionId: string;
    role?: string;
  };
}

/**
 * Middleware to require authentication
 * - In demo mode: allows all requests with a mock user
 * - In production: verifies Clerk JWT token
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Demo mode bypass
  if (DEMO_MODE) {
    req.auth = {
      userId: 'demo-user',
      sessionId: 'demo-session',
      role: 'admin',
    };
    return next();
  }

  // Check for authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // If Clerk is not configured, reject in production
  if (!CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY not configured');
    res.status(503).json({ error: 'Authentication service not configured' });
    return;
  }

  // Verify the token
  verifyToken(token, {
    secretKey: CLERK_SECRET_KEY,
  })
    .then((payload) => {
      req.auth = {
        userId: payload.sub,
        sessionId: payload.sid || '',
        role: (payload as Record<string, unknown>).role as string | undefined,
      };
      next();
    })
    .catch((error) => {
      console.error('Token verification failed:', error.message);
      res.status(401).json({ error: 'Invalid or expired token' });
    });
}

/**
 * Middleware to optionally authenticate
 * - Attaches auth info if token is present and valid
 * - Allows request to proceed even without auth
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Demo mode - attach demo user
  if (DEMO_MODE) {
    req.auth = {
      userId: 'demo-user',
      sessionId: 'demo-session',
      role: 'admin',
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ') || !CLERK_SECRET_KEY) {
    // No auth provided, continue without
    return next();
  }

  const token = authHeader.substring(7);

  verifyToken(token, {
    secretKey: CLERK_SECRET_KEY,
  })
    .then((payload) => {
      req.auth = {
        userId: payload.sub,
        sessionId: payload.sid || '',
        role: (payload as Record<string, unknown>).role as string | undefined,
      };
      next();
    })
    .catch(() => {
      // Token invalid, continue without auth
      next();
    });
}

/**
 * Middleware to require a specific role
 * Must be used after requireAuth
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Demo mode always has admin role
    if (DEMO_MODE) {
      return next();
    }

    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.auth.role || 'member';

    // Admin always has access
    if (userRole === 'admin' || allowedRoles.includes(userRole)) {
      return next();
    }

    res.status(403).json({ error: 'Insufficient permissions' });
  };
}

/**
 * Get auth status for health checks
 */
export function getAuthStatus(): {
  configured: boolean;
  demoMode: boolean;
} {
  return {
    configured: !!CLERK_SECRET_KEY,
    demoMode: DEMO_MODE,
  };
}
