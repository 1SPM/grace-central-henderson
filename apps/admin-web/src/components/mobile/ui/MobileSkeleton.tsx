import { surface } from './mobileTheme';

/** Shimmer placeholder rows shown while an API-backed section loads. */
export function MobileSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`${surface} p-3.5 flex items-center gap-3 animate-pulse`}>
          <span className="w-9 h-9 rounded-xl bg-white/[0.07] shrink-0" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-2/3 rounded bg-white/[0.08]" />
            <span className="block h-2.5 w-1/3 rounded bg-white/[0.05]" />
          </span>
        </div>
      ))}
    </div>
  );
}
