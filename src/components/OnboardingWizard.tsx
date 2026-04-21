import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Church,
  Users,
  ChevronRight,
  Check,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import type { ChurchSettings, ChurchProfile } from '../hooks/useChurchSettings';

// Radically simplified: one real step (church name) + a confirmation screen.
// Everything else — address, phones, service times, adding people — is handled
// progressively by the SetupChecklist on the dashboard after the wizard closes.
const STEPS = [
  { key: 'welcome', label: 'Welcome', icon: Church },
  { key: 'explore', label: 'Ready', icon: Sparkles },
] as const;

type StepKey = typeof STEPS[number]['key'];

interface OnboardingWizardProps {
  churchSettings: ChurchSettings;
  onSaveProfile: (profile: Partial<ChurchProfile>) => Promise<boolean>;
  onSaveSettings: (settings: Partial<ChurchSettings>) => Promise<boolean>;
  onOpenPersonForm: () => void;
  onSetView: (view: string) => void;
  onComplete: () => void;
  onDismiss: () => void;
}

export function OnboardingWizard({
  churchSettings,
  onSaveProfile,
  onSaveSettings,
  onSetView,
  onComplete,
  onDismiss,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<StepKey>('welcome');
  const [churchName, setChurchName] = useState(
    churchSettings.profile.name === 'Grace Community Church' ? '' : churchSettings.profile.name
  );

  const currentIndex = STEPS.findIndex(s => s.key === currentStep);

  const saveCurrentProfile = useCallback(async () => {
    if (churchName) {
      await onSaveProfile({ name: churchName });
    }
  }, [churchName, onSaveProfile]);

  const goNext = useCallback(async () => {
    if (currentStep === 'welcome') {
      await saveCurrentProfile();
    }
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].key);
    }
  }, [currentIndex, currentStep, saveCurrentProfile]);

  const handleFinish = useCallback(async () => {
    await saveCurrentProfile();
    await onSaveSettings({
      onboarding: {
        wizardCompleted: true,
        wizardCompletedAt: new Date().toISOString(),
        wizardDismissed: false,
        completedSteps: STEPS.map(s => s.key),
        checklistDismissed: false,
      },
    });
    onComplete();
  }, [saveCurrentProfile, onSaveSettings, onComplete]);

  const handleDismiss = useCallback(async () => {
    await onSaveSettings({
      onboarding: {
        ...churchSettings.onboarding,
        wizardCompleted: false,
        wizardDismissed: true,
        completedSteps: churchSettings.onboarding?.completedSteps || [],
        checklistDismissed: false,
      },
    });
    onDismiss();
  }, [onSaveSettings, onDismiss, churchSettings.onboarding]);

  // Escape to dismiss
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleDismiss]);

  const canProceed = () => {
    if (currentStep === 'welcome') return churchName.trim().length > 0;
    return true;
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Church setup wizard"
    >
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-500/10 rounded-lg flex items-center justify-center">
              <Church className="text-slate-600 dark:text-slate-400" size={16} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Set Up Your Church</h2>
              <p className="text-xs text-gray-500 dark:text-dark-400">Takes 15 seconds</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
            aria-label="Dismiss wizard"
          >
            <X size={18} className="text-gray-400 dark:text-dark-500" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-dark-700/50 bg-gray-50 dark:bg-dark-900/50">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isActive = idx === currentIndex;
              const isCompleted = idx < currentIndex;
              const StepIcon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-1 flex-1">
                  <button
                    onClick={() => idx <= currentIndex && setCurrentStep(step.key)}
                    disabled={idx > currentIndex}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-xs font-medium ${
                      isActive
                        ? 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-300'
                        : isCompleted
                        ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/5'
                        : 'text-gray-400 dark:text-dark-500'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      isActive
                        ? 'bg-slate-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-200 dark:bg-dark-700 text-gray-400 dark:text-dark-500'
                    }`}>
                      {isCompleted ? <Check size={12} /> : <StepIcon size={12} />}
                    </div>
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-1 ${
                      isCompleted ? 'bg-emerald-300 dark:bg-emerald-500/30' : 'bg-gray-200 dark:bg-dark-700'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 'welcome' && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="text-slate-600 dark:text-slate-400" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-dark-100 mb-2">Welcome to Grace CRM</h3>
                <p className="text-gray-500 dark:text-dark-400 max-w-md mx-auto">
                  Just one thing to get started — the rest can wait.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  What's your church called?
                </label>
                <input
                  type="text"
                  value={churchName}
                  onChange={e => setChurchName(e.target.value)}
                  placeholder="e.g. Grace Community Church"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-slate-500 dark:focus:ring-slate-400 focus:border-transparent outline-none transition-all text-lg"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && canProceed() && goNext()}
                />
                <p className="text-xs text-gray-400 dark:text-dark-500 mt-2">
                  You'll add service times, address, and people later — the dashboard will walk you through it.
                </p>
              </div>
            </div>
          )}

          {currentStep === 'explore' && (
            <div className="space-y-5">
              <div className="text-center py-2">
                <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Check className="text-emerald-600 dark:text-emerald-400" size={28} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-dark-100 mb-1">You're All Set!</h3>
                <p className="text-sm text-gray-500 dark:text-dark-400">
                  {churchName || 'Your church'} is ready to go. Here's what you can explore:
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'People', desc: 'Manage your congregation', icon: Users, view: 'people' },
                  { label: 'Calendar', desc: 'Events & scheduling', icon: CalendarDays, view: 'calendar' },
                  { label: 'Groups', desc: 'Small groups & teams', icon: Users, view: 'groups' },
                  { label: 'Settings', desc: 'Customize everything', icon: Church, view: 'settings' },
                ].map(item => (
                  <button
                    key={item.view}
                    onClick={() => { onSetView(item.view); handleFinish(); }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-500/5 transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-gray-100 dark:bg-dark-700 rounded-lg flex items-center justify-center group-hover:bg-slate-100 dark:group-hover:bg-slate-500/10 transition-colors">
                      <item.icon size={18} className="text-gray-500 dark:text-dark-400 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{item.label}</p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">{item.desc}</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 dark:text-dark-600" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/50 gap-2">
          {currentStep !== 'explore' && (
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-sm text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-300 transition-colors"
            >
              Skip for now
            </button>
          )}
          {currentStep === 'explore' ? (
            <button
              onClick={handleFinish}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              Go to Dashboard
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-300 dark:disabled:bg-dark-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
