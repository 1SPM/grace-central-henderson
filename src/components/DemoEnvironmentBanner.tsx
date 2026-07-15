import { FlaskConical } from 'lucide-react';
import { getTenant } from '../config/tenant';

/**
 * Full-width banner shown at the top of both the Admin and Portal shells
 * when the resolved tenant is the Faithful Church demo tenant — a
 * separate, fully-populated church used to demo GRACE without mixing
 * fabricated data into a real client's records. Renders nothing for the
 * real Central Henderson tenant.
 */
export function DemoEnvironmentBanner() {
  if (getTenant().id !== 'faithful') return null;

  return (
    <div
      className="flex items-center justify-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800/50 px-3 py-1.5"
      role="status"
    >
      <FlaskConical size={13} className="shrink-0" />
      Demo Environment — Faithful Church is a fully-populated demo tenant, not a live client.
    </div>
  );
}
