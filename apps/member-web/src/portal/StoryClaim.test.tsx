/**
 * /claim behaviour. Three properties matter more than the rendering:
 *
 *   1. the token leaves the address bar before any network call happens
 *   2. nothing is redeemed until the member taps (scanners prefetch URLs)
 *   3. no failure path implies the story came over when it did not
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { StoryClaim, __resetCapturedTokenForTests } from './StoryClaim';
import { readPendingStoryClaim } from './pendingStoryClaim';

const TOKEN = 'a'.repeat(43);

// Only the Clerk COMPONENT is mocked. Auth state comes from the app's own
// PortalAuthProvider below — mocking Clerk's useAuth here is what hid a real
// crash: the provider has a demo variant with no <ClerkProvider>, and Clerk's
// hook throws outside one.
vi.mock('@clerk/clerk-react', () => ({
  SignUp: () => <div data-testid="clerk-signup" />,
}));

vi.mock('./PortalAuthContext', () => ({
  usePortalAuth: () => ({
    isLoaded: true, isSignedIn: false, isDemo: false, memberFirstName: null,
    getAuthToken: async () => null, isProvisioning: false, provisioningError: null,
  }),
}));

const fetchMock = vi.fn();

function setUrl(hash: string, search = '?tenant=faithful') {
  window.history.replaceState(null, '', `/claim${search}${hash}`);
}

function okResponse(body: Record<string, unknown>) {
  return { ok: true, json: async () => body };
}

beforeEach(() => {
  // stubEnv, not direct assignment: import.meta.env is typed read-only, so
  // assigning to it passes at runtime and fails `npm run typecheck`.
  vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_stub');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  window.sessionStorage.clear();
  __resetCapturedTokenForTests();
  fetchMock.mockResolvedValue(okResponse({
    ok: true,
    draft_id: '11111111-2222-3333-4444-555555555555',
    attach_nonce: 'n'.repeat(43),
    attach_expires_at: new Date(Date.now() + 60_000).toISOString(),
    preferred_name: 'Maya',
    sections: { church: ['Two years here'] },
    segments: {},
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('token handling', () => {
  it('strips the token from the address bar before any network call', async () => {
    setUrl(`#t=${TOKEN}`);
    render(<StoryClaim />);
    // Synchronously after mount — not after the fetch resolves.
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain(TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does NOT redeem on load — a scanner prefetch must not burn the token', async () => {
    setUrl(`#t=${TOKEN}`);
    render(<StoryClaim />);
    await waitFor(() => expect(screen.getByText(/Bring your story to this phone/i)).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redeems only once the member taps, and sends the tenant', async () => {
    setUrl(`#t=${TOKEN}`);
    render(<StoryClaim />);
    fireEvent.click(screen.getByRole('button', { name: /Yes, this is mine/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/story/claim');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ token: TOKEN, tenant: 'faithful' });
  });

  it('tells the member plainly when the link carries no token', () => {
    setUrl('');
    render(<StoryClaim />);
    expect(screen.getByText(/This link is incomplete/i)).toBeTruthy();
    expect(screen.getByText(/Nothing has been carried over yet/i)).toBeTruthy();
  });
});

describe('after redeeming', () => {
  it('shows the story and parks the attach handle for sign-up', async () => {
    setUrl(`#t=${TOKEN}`);
    render(<StoryClaim />);
    fireEvent.click(screen.getByRole('button', { name: /Yes, this is mine/i }));

    await waitFor(() => expect(screen.getByText(/Welcome, Maya/i)).toBeTruthy());
    expect(screen.getByText(/Two years here/i)).toBeTruthy();

    const pending = readPendingStoryClaim();
    expect(pending).toMatchObject({ draftId: '11111111-2222-3333-4444-555555555555', preferredName: 'Maya' });
  });

  it('never writes the story text to storage — only the handle', async () => {
    setUrl(`#t=${TOKEN}`);
    render(<StoryClaim />);
    fireEvent.click(screen.getByRole('button', { name: /Yes, this is mine/i }));
    await waitFor(() => expect(screen.getByText(/Welcome, Maya/i)).toBeTruthy());

    const everything = JSON.stringify(window.sessionStorage);
    expect(everything).not.toContain('Two years here');
  });

  it('offers sign-up, and shows Clerk only after an explicit tap', async () => {
    setUrl(`#t=${TOKEN}`);
    render(<StoryClaim />);
    fireEvent.click(screen.getByRole('button', { name: /Yes, this is mine/i }));
    await waitFor(() => expect(screen.getByText(/Welcome, Maya/i)).toBeTruthy());
    expect(screen.queryByTestId('clerk-signup')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Create my account/i }));
    await waitFor(() => expect(screen.getByTestId('clerk-signup')).toBeTruthy());
  });

  it('handles a code that worked but carried no answers, without pretending otherwise', async () => {
    fetchMock.mockResolvedValue(okResponse({
      ok: true, draft_id: '11111111-2222-3333-4444-555555555555',
      attach_nonce: 'n'.repeat(43), attach_expires_at: null,
      preferred_name: null, sections: {}, segments: {},
    }));
    setUrl(`#t=${TOKEN}`);
    render(<StoryClaim />);
    fireEvent.click(screen.getByRole('button', { name: /Yes, this is mine/i }));
    await waitFor(() => expect(screen.getByText(/no answers were shared/i)).toBeTruthy());
  });
});

describe('failures never imply a transfer', () => {
  it.each([
    ['expired', 'This code has expired. Open the portal again to create a new one.'],
    ['already_used', 'This story has already been brought onto a phone.'],
    ['cancelled', 'This code was cancelled on the other screen.'],
  ])('shows the server message for %s and says nothing transferred', async (error, message) => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error, message }) });
    setUrl(`#t=${TOKEN}`);
    render(<StoryClaim />);
    fireEvent.click(screen.getByRole('button', { name: /Yes, this is mine/i }));

    await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
    expect(screen.getByText(/Nothing was transferred/i)).toBeTruthy();
  });

  it('never falls back to the demo persona', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'unknown', message: "We couldn't find that code." }) });
    setUrl(`#t=${TOKEN}`);
    render(<StoryClaim />);
    fireEvent.click(screen.getByRole('button', { name: /Yes, this is mine/i }));
    await waitFor(() => expect(screen.getByText(/Nothing was transferred/i)).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/Maya/);
  });

  it('survives a network failure without claiming success', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    setUrl(`#t=${TOKEN}`);
    render(<StoryClaim />);
    fireEvent.click(screen.getByRole('button', { name: /Yes, this is mine/i }));
    await waitFor(() => expect(screen.getByText(/could not reach your church/i)).toBeTruthy());
    expect(readPendingStoryClaim()).toBeNull();
  });
});


describe('StrictMode safety', () => {
  it('survives a double-invoked initializer — the token is captured once, not lost', async () => {
    // React StrictMode calls state initializers twice in development. Before
    // this was memoized, the second call found the hash already stripped and
    // returned null, so a valid code rendered "this link is incomplete".
    setUrl(`#t=${TOKEN}`);
    const { StrictMode } = await import('react');
    render(<StrictMode><StoryClaim /></StrictMode>);
    expect(screen.getByText(/Bring your story to this phone/i)).toBeTruthy();
    expect(screen.queryByText(/This link is incomplete/i)).toBeNull();
  });
});
