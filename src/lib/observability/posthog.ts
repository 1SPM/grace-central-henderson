/**
 * PostHog — client analytics + feature flags.
 *
 * Lazy-loaded: import dynamically so it is not in the initial bundle.
 * No-op if VITE_POSTHOG_KEY is not configured.
 */

import type { PostHog } from 'posthog-js';

let instance: PostHog | null = null;
let initPromise: Promise<PostHog | null> | null = null;

export async function initPosthog(): Promise<PostHog | null> {
  if (instance) return instance;
  if (initPromise) return initPromise;

  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return null;

  initPromise = (async () => {
    const mod = await import('posthog-js');
    const posthog = mod.default;
    posthog.init(key, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
      loaded: (ph) => {
        if (!import.meta.env.PROD) ph.opt_out_capturing();
      },
    });
    instance = posthog;
    return posthog;
  })();

  return initPromise;
}

export function identifyUser(userId: string, churchId?: string): void {
  if (!instance) return;
  instance.identify(userId, { church_id: churchId });
  if (churchId) {
    instance.group('church', churchId);
  }
}

export function resetUser(): void {
  if (!instance) return;
  instance.reset();
}

export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!instance) return;
  instance.capture(event, properties);
}

export function isFeatureEnabled(flag: string): boolean {
  if (!instance) return false;
  return Boolean(instance.isFeatureEnabled(flag));
}

export function getFeatureFlag(flag: string): string | boolean | undefined {
  if (!instance) return undefined;
  return instance.getFeatureFlag(flag);
}

export async function waitForFlags(timeoutMs = 1500): Promise<void> {
  if (!instance) return;
  await new Promise<void>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, timeoutMs);
    instance!.onFeatureFlags(() => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve();
      }
    });
  });
}
