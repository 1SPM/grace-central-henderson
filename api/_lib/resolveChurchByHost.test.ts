import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveChurchIdForHost } from './resolveChurchByHost.js';

function fakeSupabase(hostsMatch: string[] | null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        contains: () => ({
          limit: () => ({
            maybeSingle: () =>
              Promise.resolve(
                hostsMatch ? { data: { id: 'custom-domain-church-id' }, error: null } : { data: null, error: null },
              ),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('resolveChurchIdForHost', () => {
  it('resolves a known shared/demo host without touching the database', async () => {
    const dbSpy = vi.fn();
    const supabase = { from: dbSpy } as unknown as SupabaseClient;
    const id = await resolveChurchIdForHost('gracecrm-centralhenderson.org', supabase);

    expect(id).toBe('11111111-1111-1111-1111-111111111111');
    expect(dbSpy).not.toHaveBeenCalled();
  });

  it('resolves the other known shared hosts to the Faithful demo church', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;
    expect(await resolveChurchIdForHost('grace-crm-two.vercel.app', supabase)).toBe('22222222-2222-2222-2222-222222222222');
    expect(await resolveChurchIdForHost('grace-crm.dev', supabase)).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('falls back to a dynamic churches.hosts lookup for an unmapped custom domain', async () => {
    const supabase = fakeSupabase(['members.example-church.org']);
    const id = await resolveChurchIdForHost('members.example-church.org', supabase);
    expect(id).toBe('custom-domain-church-id');
  });

  it('returns null when the host matches no known or custom church', async () => {
    const supabase = fakeSupabase(null);
    const id = await resolveChurchIdForHost('unknown-attacker-controlled.example', supabase);
    expect(id).toBeNull();
  });

  it('returns null when no Host header is present at all', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;
    const id = await resolveChurchIdForHost(undefined, supabase);
    expect(id).toBeNull();
  });
});
