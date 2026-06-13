import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import type { AdminCardData } from '../../lib/services/impactCard';
import type { View } from '../../types';

const DISMISS_KEY = 'impact-card-guide-dismissed-v1';

interface ImpactCardSetupGuideProps {
  adapterMode: AdminCardData['adapter_mode'];
  onNavigate?: (view: View) => void;
  onViewPortalActivity?: () => void;
}

export function ImpactCardSetupGuide({
  adapterMode,
  onNavigate,
  onViewPortalActivity,
}: ImpactCardSetupGuideProps) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [expanded, setExpanded] = useState(true);

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const isSandbox = adapterMode === 'mock';

  return (
    <div className="mb-6 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 rounded-xl overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3 min-w-0">
          <BookOpen size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Impact Card setup & testing</h3>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                isSandbox
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              }`}>
                {isSandbox ? 'i2c sandbox (mock)' : 'i2c live'}
              </span>
            </div>
            <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-1">
              {isSandbox
                ? 'Balances and transfers use the mock adapter until production credentials are configured.'
                : 'Live mode is active — card and account operations route through i2cInc merchant services.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg"
            aria-label={expanded ? 'Collapse guide' : 'Expand guide'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={dismiss}
            className="p-1.5 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg"
            aria-label="Dismiss guide"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-indigo-200/60 dark:border-indigo-500/20 pt-4">
          {isSandbox && (
            <div>
              <p className="text-xs font-medium text-indigo-900 dark:text-indigo-200 mb-2">Quick sandbox test</p>
              <ol className="text-xs text-indigo-800 dark:text-indigo-300 space-y-1.5 list-decimal list-inside">
                <li>Member submits KYC in the member portal (Impact Card page)</li>
                <li>Staff clicks <strong>Approve + Issue</strong> in the KYC queue below</li>
                <li>On an active card, click <strong>Simulate txn</strong> to exercise the webhook pipeline</li>
                <li>Open a member row to view balance, Card Impact MTD, deposit details, and transfers</li>
              </ol>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-indigo-900 dark:text-indigo-200 mb-1">Production cutover</p>
            <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
              Set <code className="px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 rounded text-[10px]">I2C_LIVE=true</code> and{' '}
              <code className="px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 rounded text-[10px]">I2C_API_KEY</code> on Vercel.
              The live HTTP client (TD-036) activates once i2c sandbox credentials are provisioned.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {onNavigate && (
              <button
                onClick={() => onNavigate('financial-hub')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-white dark:bg-dark-850 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              >
                Financial Hub <ExternalLink size={11} />
              </button>
            )}
            {onViewPortalActivity && (
              <button
                onClick={onViewPortalActivity}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-white dark:bg-dark-850 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              >
                Portal Activity <ExternalLink size={11} />
              </button>
            )}
            <span className="inline-flex items-center px-2.5 py-1.5 text-xs text-indigo-600/70 dark:text-indigo-400/70">
              Person Profile → Impact Card chip opens member account detail
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
