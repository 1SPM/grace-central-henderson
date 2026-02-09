/**
 * Skeleton loading screens for different view types.
 * Shows placeholder shapes while real content is loading.
 */

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-dark-700 rounded-xl ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Pulse className="h-8 w-48" />
          <Pulse className="h-4 w-32" />
        </div>
        <Pulse className="h-10 w-32 rounded-xl" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 space-y-3">
            <Pulse className="h-4 w-20" />
            <Pulse className="h-8 w-16" />
            <Pulse className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Content cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 space-y-4">
            <Pulse className="h-5 w-36" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Pulse className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Pulse className="h-4 w-3/4" />
                  <Pulse className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <Pulse className="h-8 w-40" />
        <div className="flex gap-2">
          <Pulse className="h-10 w-28 rounded-xl" />
          <Pulse className="h-10 w-10 rounded-xl" />
        </div>
      </div>
      <Pulse className="h-10 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-4 flex items-center gap-4">
            <Pulse className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Pulse className="h-4 w-1/3" />
              <Pulse className="h-3 w-1/5" />
            </div>
            <Pulse className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <Pulse className="h-8 w-48" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Pulse className="h-4 w-24" />
          <Pulse className="h-10 w-full rounded-xl" />
        </div>
      ))}
      <Pulse className="h-10 w-32 rounded-xl" />
    </div>
  );
}
