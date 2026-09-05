import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from './auth';

describe('auth service security validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('rejects invalid invite email before network call', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const result = await authService.inviteUser({
      email: 'not-an-email',
      role: 'staff',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid email address');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid target user id for role updates', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const result = await authService.updateUserRole('invalid-id', 'admin');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid user identifier');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid target user id for removals', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const result = await authService.removeUser('invalid-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid user identifier');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
