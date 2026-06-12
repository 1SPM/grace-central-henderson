/**
 * Member portal sign-in gate.
 *
 * Shown at /portal when Clerk is configured and the visitor has no session.
 * Uses hash routing so Clerk's flow stays on /portal (no /sign-in redirect).
 * Branding (church name, color, logo) comes from church settings so the
 * white-labeled tenant (e.g. Central Henderson) sees their own identity.
 */

import { SignIn } from '@clerk/clerk-react';

interface MemberSignInProps {
  churchName?: string;
  primaryColor?: string;
  logoUrl?: string;
}

export function MemberSignIn({
  churchName = 'Grace Church',
  primaryColor = '#4f46e5',
  logoUrl,
}: MemberSignInProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex flex-col items-center justify-center px-4 py-10">
      <div className="flex flex-col items-center mb-8">
        {logoUrl ? (
          <img src={logoUrl} alt={churchName} className="w-14 h-14 rounded-xl object-cover mb-3" />
        ) : (
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
            style={{ backgroundColor: primaryColor }}
          >
            <span className="text-white font-bold text-xl">
              {churchName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <h1 className="text-xl font-semibold text-gray-900 dark:text-dark-100">{churchName}</h1>
        <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">Member Portal</p>
      </div>
      <SignIn
        routing="hash"
        appearance={{
          variables: { colorPrimary: primaryColor },
        }}
      />
      <p className="mt-8 text-xs text-gray-400 dark:text-dark-500 text-center max-w-xs">
        Sign in with the account from your invitation email. Need access?
        Contact your church office.
      </p>
    </div>
  );
}
