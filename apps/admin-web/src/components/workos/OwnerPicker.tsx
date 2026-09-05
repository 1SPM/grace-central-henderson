/**
 * Who is accountable for this piece of work.
 *
 * `work_orders.owner_user_id` has existed since migration 034 and Verity has
 * been flagging unowned Work Orders all along — there was simply no way to
 * answer her. This is that control.
 *
 * Rules it keeps:
 *   - unowned is a real, selectable state, not an accident. Clearing the
 *     owner sends an explicit null.
 *   - it never invents a person: the options are active `users` rows for
 *     this church, and an empty list says so instead of showing placeholders.
 *   - read-only callers still see who owns the work; only the control hides.
 */
import { useState } from 'react';
import { UserCircle2 } from 'lucide-react';
import type { StaffMember } from '../../hooks/useChurchStaff';

interface OwnerPickerProps {
  ownerUserId: string | null;
  staff: StaffMember[];
  /** Falsy renders the current owner as plain text with no control. */
  canManage: boolean;
  /** `null` clears the owner. */
  onChange: (ownerUserId: string | null) => Promise<void> | void;
  label?: string;
  id?: string;
}

export function OwnerPicker({ ownerUserId, staff, canManage, onChange, label = 'Owner', id }: OwnerPickerProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = ownerUserId ? staff.find(s => s.user_id === ownerUserId) : undefined;

  async function handle(next: string) {
    setSaving(true);
    setError(null);
    try {
      await onChange(next || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the owner');
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <p className="text-xs text-gray-500 dark:text-dark-400 inline-flex items-center gap-1.5" data-testid="owner-readonly">
        <UserCircle2 size={13} className="text-gray-400 dark:text-dark-500" />
        {owner
          ? <span><span className="text-gray-700 dark:text-dark-200">{owner.name}</span>{owner.title && ` · ${owner.title}`}</span>
          : ownerUserId
            ? <span className="text-gray-500 dark:text-dark-400">Owned by someone outside the current staff list</span>
            : <span className="text-amber-700 dark:text-amber-400">Nobody owns this yet</span>}
      </p>
    );
  }

  return (
    <div data-testid="owner-picker">
      <label htmlFor={id ?? 'owner-picker'} className="block text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 mb-1">
        {label}
      </label>
      <select
        id={id ?? 'owner-picker'}
        className="text-xs rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-850 text-gray-800 dark:text-dark-100 px-2 py-1.5 w-full max-w-xs disabled:opacity-50"
        value={ownerUserId ?? ''}
        disabled={saving || staff.length === 0}
        onChange={e => void handle(e.target.value)}
      >
        <option value="">Nobody yet — unowned</option>
        {staff.map(s => (
          <option key={s.user_id} value={s.user_id}>
            {s.name}{s.title ? ` · ${s.title}` : ''}
          </option>
        ))}
        {/* An owner who is no longer active staff stays visible rather than
            silently reading as unowned. */}
        {ownerUserId && !owner && <option value={ownerUserId}>Former staff member</option>}
      </select>
      {staff.length === 0 && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
          No active staff accounts yet, so there is nobody to make accountable.
        </p>
      )}
      {error && <p className="text-[11px] text-brand-600 dark:text-brand-400 mt-1">{error}</p>}
    </div>
  );
}
