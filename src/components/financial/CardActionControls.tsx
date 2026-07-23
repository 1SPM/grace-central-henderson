/**
 * Shared freeze / unfreeze / issue-replacement / cancel controls for an
 * Impact Card, used by both the roster-level "Issued cards" widget
 * (CardProgramSection) and the per-member drill-down (MemberWalletDetail).
 * Both surfaces used to reimplement this independently, which let one of
 * them skip staff-reason capture entirely — see the audit trail this was
 * fixed for.
 */

import { useState } from 'react';
import { Ban, CreditCard, Play, Snowflake } from 'lucide-react';
import type { CardRecord } from '../../lib/services/impactCard';
import { cancelCard, freezeCard, issueReplacementCard, unfreezeCard } from '../../lib/services/impactCard';

type CardStaffActionType = 'freeze' | 'cancel' | 'replace';

export function StaffReasonModal({
  title,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  confirmLabel: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-5 w-full max-w-md shadow-xl">
        <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-2">{title}</h3>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Staff reason (required)…"
          rows={3}
          className="w-full text-sm border border-gray-200 dark:border-dark-600 rounded-lg px-3 py-2 dark:bg-dark-800"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
          <button
            onClick={() => reason.trim().length >= 3 && onConfirm(reason.trim())}
            disabled={reason.trim().length < 3}
            className="px-3 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-lg disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CardActionControlsProps {
  card: CardRecord;
  busyId: string | null;
  withBusy: (id: string, fn: () => Promise<unknown>) => Promise<void>;
  /** Icon-only buttons for tight table rows (CardProgramSection's roster). Labeled pills otherwise. */
  compact?: boolean;
}

export function CardActionControls({ card, busyId, withBusy, compact }: CardActionControlsProps) {
  const [staffAction, setStaffAction] = useState<{ type: CardStaffActionType } | null>(null);

  const handleStaffConfirm = async (reason: string) => {
    if (!staffAction) return;
    const { type } = staffAction;
    setStaffAction(null);
    if (type === 'freeze') {
      await withBusy(card.id, () => freezeCard(card.id, reason));
    } else if (type === 'cancel') {
      await withBusy(card.id, () => cancelCard(card.id, reason));
    } else if (type === 'replace') {
      await withBusy(`replace-${card.id}`, () => issueReplacementCard(card.id, reason));
    }
  };

  const modalTitle =
    staffAction?.type === 'freeze' ? 'Freeze card — staff reason required'
      : staffAction?.type === 'cancel' ? 'Cancel card — staff reason required'
        : 'Issue replacement card';
  const modalConfirmLabel =
    staffAction?.type === 'freeze' ? 'Freeze card'
      : staffAction?.type === 'cancel' ? 'Cancel card'
        : 'Issue replacement';

  if (compact) {
    return (
      <>
        {card.status === 'active' && (
          <button
            onClick={() => setStaffAction({ type: 'freeze' })}
            disabled={busyId === card.id}
            className="p-1.5 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg disabled:opacity-50"
            title="Freeze card"
          >
            <Snowflake size={14} />
          </button>
        )}
        {card.status === 'frozen' && (
          <button
            onClick={() => withBusy(card.id, () => unfreezeCard(card.id))}
            disabled={busyId === card.id}
            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg disabled:opacity-50"
            title="Unfreeze card"
          >
            <Play size={14} />
          </button>
        )}
        {(card.status === 'active' || card.status === 'frozen') && (
          <button
            onClick={() => setStaffAction({ type: 'replace' })}
            disabled={busyId === `replace-${card.id}`}
            className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg disabled:opacity-50"
            title="Issue replacement card"
          >
            <CreditCard size={14} />
          </button>
        )}
        {card.status !== 'cancelled' && (
          <button
            onClick={() => setStaffAction({ type: 'cancel' })}
            disabled={busyId === card.id}
            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg disabled:opacity-50"
            title="Cancel card"
          >
            <Ban size={14} />
          </button>
        )}
        {staffAction && (
          <StaffReasonModal
            title={modalTitle}
            confirmLabel={modalConfirmLabel}
            onConfirm={reason => void handleStaffConfirm(reason)}
            onCancel={() => setStaffAction(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      {card.status === 'active' && (
        <button
          onClick={() => setStaffAction({ type: 'freeze' })}
          disabled={busyId === card.id}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-cyan-300 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-400 rounded-lg disabled:opacity-50"
        >
          <Snowflake size={12} /> Freeze
        </button>
      )}
      {card.status === 'frozen' && (
        <button
          onClick={() => withBusy(card.id, () => unfreezeCard(card.id))}
          disabled={busyId === card.id}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 rounded-lg disabled:opacity-50"
        >
          <Play size={12} /> Unfreeze
        </button>
      )}
      {(card.status === 'active' || card.status === 'frozen') && (
        <button
          onClick={() => setStaffAction({ type: 'replace' })}
          disabled={busyId === `replace-${card.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-indigo-300 text-indigo-700 rounded-lg disabled:opacity-50"
        >
          <CreditCard size={12} /> Issue replacement
        </button>
      )}
      {card.status !== 'cancelled' && (
        <button
          onClick={() => setStaffAction({ type: 'cancel' })}
          disabled={busyId === card.id}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg disabled:opacity-50"
        >
          <Ban size={12} /> Cancel
        </button>
      )}
      {staffAction && (
        <StaffReasonModal
          title={modalTitle}
          confirmLabel={modalConfirmLabel}
          onConfirm={reason => void handleStaffConfirm(reason)}
          onCancel={() => setStaffAction(null)}
        />
      )}
    </>
  );
}
