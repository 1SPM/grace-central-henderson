/**
 * /claim — the phone side of the story handoff.
 *
 * The member scans a QR on the desktop portal and lands here. Three things
 * about this page are load-bearing:
 *
 * 1. THE TOKEN IS IN THE FRAGMENT. A fragment never leaves the browser, so the
 *    token is not in any access log, Referer or analytics payload. It is
 *    stripped from the address bar before any network call, so it also does
 *    not survive a screenshot, a shared link or the back button.
 *
 * 2. NOTHING IS REDEEMED UNTIL THE MEMBER TAPS. Scanners and link previews
 *    prefetch URLs; redeeming on load would burn tokens before anyone saw the
 *    page. The redeem is a POST behind an explicit confirmation.
 *
 * 3. IT NEVER FALLS BACK TO THE DEMO PERSONA. docs/MEMBER_MOBILE_HANDOFF.md:
 *    "Do not fall back to Maya while implying the member's story transferred."
 *    Every failure state here says plainly that nothing was carried over.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SignUp } from '@clerk/clerk-react';
import { usePortalAuth } from './PortalAuthContext';
import { savePendingStoryClaim } from './pendingStoryClaim';
import { readOriginTenant } from './originTenant';

type Phase = 'confirm' | 'redeeming' | 'ready' | 'signup' | 'failed' | 'no-token';

interface ClaimedStory {
  draft_id: string;
  attach_nonce: string;
  attach_expires_at: string | null;
  preferred_name: string | null;
  sections: Record<string, string[]>;
  segments: Record<string, string>;
}

const SECTION_LABELS: Record<string, string> = {
  church: 'My Church',
  leadership: 'My Leadership',
  connect: 'Connect',
  reflect: 'Reflect',
  wallet: 'Wallet',
  impact: 'Impact',
};

/**
 * Reads the token from the fragment and clears it immediately.
 *
 * MEMOIZED, AND THAT IS NOT OPTIONAL. This has a side effect — it rewrites the
 * address bar — so it must run exactly once per page load. React StrictMode
 * double-invokes state initializers in development, and the second call would
 * find the hash already stripped and return null, leaving a member who scanned
 * a perfectly good code staring at "this link is incomplete". Capturing into a
 * module-level slot makes the second call return the same answer as the first.
 */
let capturedToken: string | null | undefined;

export function takeTokenFromFragment(): string | null {
  if (capturedToken !== undefined) return capturedToken;
  try {
    const hash = window.location.hash ?? '';
    const match = /[#&]t=([A-Za-z0-9_-]{20,64})/.exec(hash);
    if (!match) {
      capturedToken = null;
      return null;
    }
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(null, '', url.toString());
    capturedToken = match[1];
    return capturedToken;
  } catch {
    capturedToken = null;
    return null;
  }
}

/** Test-only: the module-level capture would otherwise leak between cases. */
export function __resetCapturedTokenForTests(): void {
  capturedToken = undefined;
}

export function StoryClaim() {
  // usePortalAuth, NOT Clerk's useAuth: PortalAuthProvider has a demo variant
  // that never mounts <ClerkProvider>, and Clerk's hook throws outside one.
  // This context is the app's own abstraction and is present in both.
  const { isSignedIn } = usePortalAuth();
  // Captured once, on mount, before anything can navigate.
  const [token] = useState<string | null>(() => takeTokenFromFragment());
  const [phase, setPhase] = useState<Phase>(() => (token ? 'confirm' : 'no-token'));
  const [story, setStory] = useState<ClaimedStory | null>(null);
  const [failure, setFailure] = useState<string>('');

  const tenant = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('tenant') ?? readOriginTenant();
    } catch {
      return readOriginTenant();
    }
  }, []);

  const redeem = useCallback(async () => {
    if (!token) return;
    setPhase('redeeming');
    try {
      const resp = await fetch('/api/story/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenant ? { token, tenant } : { token }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        // The heading already says we couldn't bring it over; a generic
        // fallback that repeats it just prints the same sentence twice.
        setFailure(body.message || 'The code may have expired or already been used.');
        setPhase('failed');
        return;
      }
      setStory(body as ClaimedStory);
      savePendingStoryClaim({
        draftId: body.draft_id,
        attachNonce: body.attach_nonce,
        preferredName: body.preferred_name,
        attachExpiresAt: body.attach_expires_at,
      });
      setPhase('ready');
    } catch {
      setFailure('We could not reach your church right now. Please try again.');
      setPhase('failed');
    }
  }, [token, tenant]);

  // Once they finish signing up, PortalAuthContext provisions and attaches the
  // story; sending them on to the portal is the last step.
  useEffect(() => {
    if (isSignedIn && (phase === 'signup' || phase === 'ready')) {
      window.location.replace('/');
    }
  }, [isSignedIn, phase]);

  if (phase === 'no-token') {
    return (
      <Shell title="This link is incomplete">
        <p className="text-sm text-stone-600">
          Open the portal on the other screen and scan the code again. Nothing has been carried over yet.
        </p>
      </Shell>
    );
  }

  if (phase === 'failed') {
    return (
      <Shell title="We couldn't bring your story over">
        <p className="text-sm text-stone-600">{failure}</p>
        <p className="mt-3 text-sm text-stone-500">
          Nothing was transferred. You can start again from the portal, or create an account without it.
        </p>
      </Shell>
    );
  }

  if (phase === 'confirm' || phase === 'redeeming') {
    return (
      <Shell title="Bring your story to this phone?">
        <p className="text-sm text-stone-600">
          You filled some of this in on the other screen. Tapping below moves it here. This code works once.
        </p>
        <button
          type="button"
          onClick={redeem}
          disabled={phase === 'redeeming'}
          className="mt-5 w-full rounded-lg bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {phase === 'redeeming' ? 'Bringing it over…' : 'Yes, this is mine'}
        </button>
      </Shell>
    );
  }

  if (phase === 'signup') {
    // Guarded the same way PortalSignIn guards <SignIn/>: without a key the
    // Clerk component throws, and a crash here would lose a story the member
    // has already been shown.
    const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    return (
      <Shell title="Create your account">
        <p className="mb-4 text-sm text-stone-600">
          Your answers are held on this phone and will be added to your profile once you finish.
        </p>
        {clerkPubKey ? (
          <SignUp routing="virtual" />
        ) : (
          <p className="text-sm text-stone-500">
            Sign-up isn't configured yet. Your answers are still here on this phone.
          </p>
        )}
      </Shell>
    );
  }

  const entries = Object.entries(story?.sections ?? {});
  return (
    <Shell title={story?.preferred_name ? `Welcome, ${story.preferred_name}` : 'Your story'}>
      {entries.length === 0 ? (
        <p className="text-sm text-stone-600">
          Your code worked, but no answers were shared on the other screen.
        </p>
      ) : (
        <dl className="space-y-3 text-left">
          {entries.map(([key, values]) => (
            <div key={key} className="rounded-lg bg-white p-3 ring-1 ring-stone-200">
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {SECTION_LABELS[key] ?? key}
              </dt>
              <dd className="mt-1 text-sm text-stone-800">{values.join(' · ')}</dd>
            </div>
          ))}
        </dl>
      )}
      <button
        type="button"
        onClick={() => setPhase('signup')}
        className="mt-5 w-full rounded-lg bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
      >
        Create my account
      </button>
      <p className="mt-3 text-xs text-stone-500">
        You can create an account later instead — your answers stay on this phone until you do.
      </p>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm text-center">
        <div className="mx-auto mb-5 h-10 w-10 rounded-full bg-rose-600" aria-hidden="true" />
        <h1 className="mb-3 text-xl font-semibold text-stone-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}
