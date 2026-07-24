import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRouteGuard } from './useRouteGuard';

const mockAuthContext = vi.hoisted(() => ({ current: { permissions: null as unknown, user: null as unknown } }));

vi.mock('../contexts/AuthContext', () => ({
  useAuthContext: () => mockAuthContext.current,
}));

describe('useRouteGuard — role-visibility test', () => {
  it('blocks a volunteer from the GRACE WorkOS view', () => {
    mockAuthContext.current = { permissions: null, user: { role: 'volunteer' } };
    const { result } = renderHook(() => useRouteGuard());

    expect(result.current.canAccess('workos')).toBe(false);
    expect(result.current.getBlockedMessage('workos')).toMatch(/staff-level access/i);
  });

  it('allows staff to open the GRACE WorkOS view', () => {
    mockAuthContext.current = { permissions: null, user: { role: 'staff' } };
    const { result } = renderHook(() => useRouteGuard());

    expect(result.current.canAccess('workos')).toBe(true);
    expect(result.current.getBlockedMessage('workos')).toBeNull();
  });

  it('allows admin and pastor to open the GRACE WorkOS view', () => {
    mockAuthContext.current = { permissions: null, user: { role: 'admin' } };
    expect(renderHook(() => useRouteGuard()).result.current.canAccess('workos')).toBe(true);

    mockAuthContext.current = { permissions: null, user: { role: 'pastor' } };
    expect(renderHook(() => useRouteGuard()).result.current.canAccess('workos')).toBe(true);
  });

  it('does not gate GRACE WorkOS behind settings-management permission (that is a separate, narrower check)', () => {
    mockAuthContext.current = { permissions: { canManageSettings: false }, user: { role: 'staff' } };
    const { result } = renderHook(() => useRouteGuard());

    expect(result.current.canAccess('workos')).toBe(true);
  });
});
