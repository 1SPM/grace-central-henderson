import { FlaskConical } from 'lucide-react';

/**
 * Visible label for panels that render fabricated sample data rather
 * than a real query result — e.g. Leaders Hub panels and Giving Hub
 * campaign/cause showcases that don't yet have a real backing table.
 * Distinct from VITE_ENABLE_DEMO_MODE (which governs auth bypass): this
 * renders regardless of demo mode, because the underlying data is
 * synthetic either way and a viewer should never mistake it for a real
 * record. See TECH_DEBT.md.
 */
export function SampleDataNotice({ label = 'Sample data — not live' }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-1.5 mb-3"
      role="status"
    >
      <FlaskConical size={13} className="shrink-0" />
      {label}
    </div>
  );
}
