import { Suspense, useEffect } from 'react';
import { SignIn } from '@clerk/clerk-react';
import { PortalAuthProvider, usePortalAuth } from './PortalAuthContext';
import { PortalShell } from './PortalShell';

// Central Henderson gets its own branded page; every other church (today
// just Faithful, but any future one too — see marketing/tenants/faithful
// as the white-label template) gets the generic one. Mirrors
// api/_lib/authz.ts's HOST_CHURCH_IDS values — these are real church_id
// UUIDs, not slugs, because that's what's actually in the JWT claim.
const CENTRAL_HENDERSON_CHURCH_ID = '11111111-1111-1111-1111-111111111111';

function churchIdFromToken(token: string): string | null {
  try {
    const payloadSegment = token.split('.')[1];
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { app_metadata?: { church_id?: string }; church_id?: string };
    return payload.app_metadata?.church_id ?? payload.church_id ?? null;
  } catch {
    return null;
  }
}

/**
 * The real Member Portal is the static HTML built for it
 * (apps/member-web/public/tenants/<tenant>/member-portal.html, copied
 * from marketing/tenants/ — see the member-portal-scope decision this
 * replaces PortalShell for) — this app's job is proving a real,
 * provisioned member identity (Clerk auth + api/portal/_self-signup.ts +
 * the pending-review gating) and then handing off to it. No in-app
 * shell renders past this point for a real member.
 */
function StaticPortalHandoff() {
  const { getAuthToken } = usePortalAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getAuthToken();
      const churchId = token ? churchIdFromToken(token) : null;
      if (cancelled) return;
      const slug = churchId === CENTRAL_HENDERSON_CHURCH_ID ? 'central-henderson' : 'faithful';
      window.location.replace(`/tenants/${slug}/member-portal.html`);
    })();
    return () => { cancelled = true; };
  }, [getAuthToken]);

  return <PortalLoading />;
}

function PortalLoading() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
    </div>
  );
}

function PortalSignIn() {
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 h-12 w-12 rounded-full bg-rose-600" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-stone-900 mb-1">Welcome back</h1>
        <p className="text-sm text-stone-500 mb-6">Sign in to see your church home, events, groups, and more.</p>
        {clerkPubKey ? (
          <SignIn routing="virtual" />
        ) : (
          <p className="text-sm text-stone-500">
            Member sign-in isn't configured yet. Contact your church administrator.
          </p>
        )}
      </div>
    </div>
  );
}

function PreviewBanner({ personName }: { personName: string | null }) {
  return (
    <div className="bg-amber-500 text-amber-950 text-sm font-medium text-center py-2 px-4 sticky top-0 z-50">
      Staff Preview — viewing as {personName ?? 'this member'} (read-only)
    </div>
  );
}

function PortalProvisioningError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-stone-900 mb-2">We hit a snag</h1>
        <p className="text-sm text-stone-500">{message}</p>
      </div>
    </div>
  );
}

function PortalGate() {
  const { isLoaded, isSignedIn, isDemo, isPreview, previewPersonName, isProvisioning, provisioningError } = usePortalAuth();

  if (!isLoaded) return <PortalLoading />;
  if (!isSignedIn && !isDemo) return <PortalSignIn />;
  if (isProvisioning) return <PortalLoading />;
  if (provisioningError) return <PortalProvisioningError message={provisioningError} />;

  // Staff "preview as member" has no equivalent in the static pages yet
  // (no read-only mode, no banner) — keep it on the in-app shell. This is
  // a staff tool, not something real members ever see.
  if (isPreview) {
    return (
      <>
        <PreviewBanner personName={previewPersonName} />
        <PortalShell />
      </>
    );
  }

  return <StaticPortalHandoff />;
}

export function PortalRoot() {
  return (
    <PortalAuthProvider>
      <Suspense fallback={<PortalLoading />}>
        <PortalGate />
      </Suspense>
    </PortalAuthProvider>
  );
}
