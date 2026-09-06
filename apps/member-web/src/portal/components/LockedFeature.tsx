/**
 * Grayed-out placeholder for a feature the backend has withheld pending
 * staff review (self-signup identity verification — see migration 078,
 * api/_lib/authz.ts's requireVerifiedIdentity). Shows the feature is
 * there and coming, rather than hiding it entirely — but never renders
 * real numbers underneath: the server never sent them to the client in
 * the first place, so there's nothing sensitive to blur here, only a
 * generic skeleton shape.
 */
import { Lock } from 'lucide-react';

export function LockedFeature({ message, skeletonRows = 2 }: { message: string; skeletonRows?: number }) {
  return (
    <div className="relative rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
      <div aria-hidden="true" className="p-4 space-y-2 opacity-40 select-none pointer-events-none">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-stone-300" style={{ width: `${70 - i * 15}%` }} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/60 px-4 text-center">
        <Lock size={15} className="text-stone-400" />
        <p className="text-xs text-stone-600 max-w-[220px]">{message}</p>
      </div>
    </div>
  );
}
