import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function load() { return import('./thirdPartyErase.js'); }

const OLD_FETCH = globalThis.fetch;
afterEach(() => { globalThis.fetch = OLD_FETCH; delete process.env.POSTHOG_PROJECT_ID; delete process.env.POSTHOG_PERSONAL_API_KEY; vi.resetModules(); });

describe('erasePostHogPerson', () => {
  beforeEach(() => vi.resetModules());

  it('not_configured when env is missing', async () => {
    delete process.env.POSTHOG_PROJECT_ID; delete process.env.POSTHOG_PERSONAL_API_KEY;
    const { erasePostHogPerson } = await load();
    expect(await erasePostHogPerson(['user_1'])).toBe('not_configured');
  });

  it('no_stored_identifier when there are no distinct ids', async () => {
    process.env.POSTHOG_PROJECT_ID = '1'; process.env.POSTHOG_PERSONAL_API_KEY = 'phx';
    const { erasePostHogPerson } = await load();
    expect(await erasePostHogPerson([])).toBe('no_stored_identifier');
  });

  it('deleted: looks up the person then DELETEs with delete_events=true', async () => {
    process.env.POSTHOG_PROJECT_ID = '42'; process.env.POSTHOG_PERSONAL_API_KEY = 'phx';
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url); calls.push(`${init?.method} ${u}`);
      if (u.includes('distinct_id=')) return new Response(JSON.stringify({ results: [{ id: 999 }] }), { status: 200 });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const { erasePostHogPerson } = await load();
    expect(await erasePostHogPerson(['user_clerk_1'])).toBe('deleted');
    expect(calls.some(c => c.startsWith('GET') && c.includes('distinct_id=user_clerk_1'))).toBe(true);
    expect(calls.some(c => c.startsWith('DELETE') && c.includes('/persons/999/') && c.includes('delete_events=true'))).toBe(true);
  });

  it('not_found when PostHog has no matching person', async () => {
    process.env.POSTHOG_PROJECT_ID = '42'; process.env.POSTHOG_PERSONAL_API_KEY = 'phx';
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 })) as unknown as typeof fetch;
    const { erasePostHogPerson } = await load();
    expect(await erasePostHogPerson(['nobody'])).toBe('not_found');
  });

  it('never throws — a network error is returned as an error string', async () => {
    process.env.POSTHOG_PROJECT_ID = '42'; process.env.POSTHOG_PERSONAL_API_KEY = 'phx';
    globalThis.fetch = vi.fn(async () => { throw new Error('down'); }) as unknown as typeof fetch;
    const { erasePostHogPerson } = await load();
    expect(await erasePostHogPerson(['x'])).toMatch(/^error:/);
  });
});
