import { useState } from 'react';
import { BadgeCheck, Clock, ThumbsUp } from 'lucide-react';
import { demoCauses, demoCauseStats, type CauseVerification } from './demoGivingHub';

const VERIFY_BADGE: Record<CauseVerification, { cls: string; label: string } | null> = {
  verified: {
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    label: '501(c)(3) verified',
  },
  pending: {
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    label: 'Verification pending',
  },
  none: null,
};

type CauseDecision = 'approved' | 'info-requested' | 'declined';

export function MemberCauses() {
  const [decisions, setDecisions] = useState<Record<string, CauseDecision>>({});
  const [policy, setPolicy] = useState({
    requireVerification: true,
    voteThreshold: true,
    escrowDisbursement: true,
    autoCloseStale: false,
  });

  const decide = (id: string, d: CauseDecision) => setDecisions(prev => ({ ...prev, [id]: d }));

  const policyRows: { key: keyof typeof policy; title: string; detail: string }[] = [
    { key: 'requireVerification', title: 'Require 501(c)(3) verification', detail: 'Causes must name a verified nonprofit recipient before launch' },
    { key: 'voteThreshold', title: 'Vote threshold: 50 votes', detail: 'Causes need 50 member votes before appearing for review' },
    { key: 'escrowDisbursement', title: 'Escrow until goal met', detail: 'Hold gifts in escrow; disburse only when the goal is reached' },
    { key: 'autoCloseStale', title: 'Auto-close after 60 days', detail: 'Stale causes refund donors and close automatically' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <p className="section-eyebrow">Awaiting review</p>
          <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">{demoCauseStats.awaitingReview}</p>
        </div>
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <p className="section-eyebrow">Approved &amp; live</p>
          <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">{demoCauseStats.approvedLive}</p>
          <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-0.5">{demoCauseStats.approvedLiveLabel}</p>
        </div>
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <p className="section-eyebrow">Member votes cast</p>
          <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">{demoCauseStats.totalVotes}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Submissions ranked by votes */}
        <div className="lg:col-span-2 space-y-3">
          {demoCauses.map(cause => {
            const badge = VERIFY_BADGE[cause.verification];
            const decision = decisions[cause.id];
            return (
              <div
                key={cause.id}
                className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-dark-300 flex-shrink-0">
                    {cause.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">{cause.title}</h3>
                      {badge && (
                        <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                          <BadgeCheck size={11} /> {badge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-0.5 flex items-center gap-2">
                      <span>by {cause.submitter}</span>
                      <span className="flex items-center gap-0.5"><Clock size={10} /> {cause.submitted}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-400 mt-1.5">{cause.description}</p>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div className="flex items-center gap-1 text-violet-700 dark:text-violet-300 font-semibold">
                      <ThumbsUp size={13} />
                      <span className="stat-number text-lg">{cause.votes}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-dark-500">votes</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-dark-700">
                  {decision ? (
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-md ${
                        decision === 'approved'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : decision === 'declined'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {decision === 'approved' && '✓ Approved & launched'}
                      {decision === 'info-requested' && 'Info requested from submitter'}
                      {decision === 'declined' && 'Declined'}
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => decide(cause.id, 'approved')}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-950 text-white text-xs font-medium rounded-md transition-colors"
                      >
                        Approve &amp; launch
                      </button>
                      <button
                        onClick={() => decide(cause.id, 'info-requested')}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-dark-300 border border-gray-200 dark:border-dark-600 rounded-md hover:bg-gray-50 dark:hover:bg-dark-850 transition-colors"
                      >
                        Request info
                      </button>
                      <button
                        onClick={() => decide(cause.id, 'declined')}
                        className="px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Policy settings */}
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 self-start">
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-1">Member cause policy</h2>
          <p className="text-xs text-gray-500 dark:text-dark-400 mb-4">Global rules for member-submitted campaigns</p>
          <div className="space-y-3">
            {policyRows.map(row => (
              <label key={row.key} className="flex items-start justify-between gap-3 cursor-pointer">
                <div>
                  <p className="text-sm text-gray-900 dark:text-dark-100">{row.title}</p>
                  <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-0.5">{row.detail}</p>
                </div>
                <input
                  type="checkbox"
                  checked={policy[row.key]}
                  onChange={e => setPolicy(prev => ({ ...prev, [row.key]: e.target.checked }))}
                  className="w-4 h-4 mt-0.5 accent-slate-900 flex-shrink-0"
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
