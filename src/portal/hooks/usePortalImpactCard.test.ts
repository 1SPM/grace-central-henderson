import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePortalImpactCard } from './usePortalImpactCard';

const mockPortalAuth = vi.hoisted(() => ({ isPreview: false }));

vi.mock('../PortalAuthContext', () => ({
  usePortalAuth: () => mockPortalAuth,
}));

const fetchMyCardMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/services/impactCard', () => ({
  fetchMyCard: fetchMyCardMock,
  setImpactRoute: vi.fn(),
  NeobankFetchError: class NeobankFetchError extends Error {},
}));

describe('usePortalImpactCard — staff preview mode', () => {
  beforeEach(() => {
    fetchMyCardMock.mockReset();
    mockPortalAuth.isPreview = false;
  });

  it('resolves to the preview state without calling fetchMyCard when isPreview is true', async () => {
    mockPortalAuth.isPreview = true;

    const { result } = renderHook(() => usePortalImpactCard());

    await waitFor(() => expect(result.current.state).toBe('preview'));
    expect(result.current.data).toBeNull();
    expect(fetchMyCardMock).not.toHaveBeenCalled();
  });

  it('calls fetchMyCard normally when not in preview mode', async () => {
    fetchMyCardMock.mockResolvedValue({ kyc: null, cards: [], account: null, person_id: 'p-1' });

    const { result } = renderHook(() => usePortalImpactCard());

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(fetchMyCardMock).toHaveBeenCalledTimes(1);
  });
});
