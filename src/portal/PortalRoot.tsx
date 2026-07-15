import { Suspense } from 'react';
import { SignIn } from '@clerk/clerk-react';
import { PortalAuthProvider, usePortalAuth } from './PortalAuthContext';
import { PortalShell } from './PortalShell';

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

function PortalGate() {
  const { isLoaded, isSignedIn, isDemo } = usePortalAuth();

  if (!isLoaded) return <PortalLoading />;
  if (!isSignedIn && !isDemo) return <PortalSignIn />;

  return <PortalShell />;
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
