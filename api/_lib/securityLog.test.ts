import { describe, it, expect, vi } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import { logSecurityEvent, securityContext } from './securityLog.js';

function supabaseWith(insertImpl: (row: unknown) => Promise<{ error: unknown }>) {
  const inserted: unknown[] = [];
  const client = { from: () => ({ insert: (row: unknown) => { inserted.push(row); return insertImpl(row); } }) };
  return { client: client as never, inserted };
}

describe('logSecurityEvent', () => {
  it('inserts a normalized row into security_events', async () => {
    const { client, inserted } = supabaseWith(async () => ({ error: null }));
    await logSecurityEvent(client, {
      eventType: 'authz.denied', severity: 'elevated',
      churchId: 'ch-1', actorClerkId: 'user_x', ip: '1.2.3.4', route: '/api/team/set-role',
      detail: { required: 'admin.manage_roles', actor_role: 'staff' },
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      event_type: 'authz.denied', severity: 'elevated', church_id: 'ch-1',
      actor_clerk_id: 'user_x', ip: '1.2.3.4', route: '/api/team/set-role',
      detail: { required: 'admin.manage_roles', actor_role: 'staff' },
    });
  });

  it('defaults nullable fields and empty detail', async () => {
    const { client, inserted } = supabaseWith(async () => ({ error: null }));
    await logSecurityEvent(client, { eventType: 'auth.failed', severity: 'elevated' });
    expect(inserted[0]).toMatchObject({ church_id: null, actor_clerk_id: null, ip: null, route: null, detail: {} });
  });

  it('never throws when the insert returns an error (best-effort)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = supabaseWith(async () => ({ error: { message: 'db down' } }));
    await expect(logSecurityEvent(client, { eventType: 'x', severity: 'info' })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('never throws when the insert itself throws (best-effort)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = supabaseWith(async () => { throw new Error('network'); });
    await expect(logSecurityEvent(client, { eventType: 'x', severity: 'info' })).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe('securityContext', () => {
  it('pulls the spoof-resistant client IP and strips the query string', () => {
    const req = { headers: { 'x-real-ip': '203.0.113.7' }, url: '/api/consents/erase?jobId=1' } as unknown as VercelRequest;
    expect(securityContext(req)).toEqual({ ip: '203.0.113.7', route: '/api/consents/erase' });
  });
  it('handles a missing url', () => {
    const req = { headers: {} } as unknown as VercelRequest;
    expect(securityContext(req)).toEqual({ ip: 'unknown', route: null });
  });
});
