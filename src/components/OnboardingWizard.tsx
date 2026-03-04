import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Church,
  MapPin,
  Clock,
  Users,
  Compass,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Upload,
  SkipForward,
  Sparkles,
  CalendarDays,
  Mail,
  Phone,
  Globe,
  Trash2,
} from 'lucide-react';
import type { ChurchSettings, ChurchProfile, ServiceTime } from '../hooks/useChurchSettings';

const STEPS = [
  { key: 'welcome', label: 'Welcome', icon: Church },
  { key: 'profile', label: 'Church Profile', icon: MapPin },
  { key: 'services', label: 'Service Times', icon: Clock },
  { key: 'people', label: 'Add People', icon: Users },
  { key: 'explore', label: 'Explore', icon: Compass },
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
  onOpenPersonForm,
  onSetView,
  onComplete,
  onDismiss,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<StepKey>('welcome');
  const [churchName, setChurchName] = useState(
    churchSettings.profile.name === 'Grace Community Church' ? '' : churchSettings.profile.name
  );
  const [address, setAddress] = useState(churchSettings.profile.address);
  const [city, setCity] = useState(churchSettings.profile.city);
  const [state, setState] = useState(churchSettings.profile.state);
  const [zip, setZip] = useState(churchSettings.profile.zip);
  const [phone, setPhone] = useState(churchSettings.profile.phone);
  const [email, setEmail] = useState(churchSettings.profile.email);
  const [website, setWebsite] = useState(churchSettings.profile.website);
  const [serviceTimes, setServiceTimes] = useState<ServiceTime[]>(
    churchSettings.profile.serviceTimes.length > 0
      ? churchSettings.profile.serviceTimes
      : [{ day: 'Sunday', time: '10:00 AM', name: 'Sunday Worship' }]
  );

  const currentIndex = STEPS.findIndex(s => s.key === currentStep);

  const saveCurrentProfile = useCallback(async () => {
    const profile: Partial<ChurchProfile> = {};
    if (churchName) profile.name = churchName;
    if (address) profile.address = address;
    if (city) profile.city = city;
    if (state) profile.state = state;
    if (zip) profile.zip = zip;
    if (phone) profile.phone = phone;
    if (email) profile.email = email;
    if (website) profile.website = website;
    if (serviceTimes.length > 0) profile.serviceTimes = serviceTimes;
    if (Object.keys(profile).length > 0) {
      await onSaveProfile(profile);
    }
  }, [churchName, address, city, state, zip, phone, email, website, serviceTimes, onSaveProfile]);

  const goNext = useCallback(async () => {
    // Auto-save on step transitions
    if (currentStep === 'welcome' || currentStep === 'profile' || currentStep === 'services') {
      await saveCurrentProfile();
    }
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].key);
    }
  }, [currentIndex, currentStep, saveCurrentProfile]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].key);
    }
  }, [currentIndex]);

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

  // Service time helpers
  const addServiceTime = () => {
    setServiceTimes([...serviceTimes, { day: 'Sunday', time: '10:00 AM', name: '' }]);
  };
  const removeServiceTime = (idx: number) => {
    setServiceTimes(serviceTimes.filter((_, i) => i !== idx));
  };
  const updateServiceTime = (idx: number, field: keyof ServiceTime, value: string) => {
    setServiceTimes(serviceTimes.map((st, i) => i === idx ? { ...st, [field]: value } : st));
  };

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
    const totalMinutes = 360 + i * 30; // 6:00 AM = 360 min
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  });

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
            <div className="w-8 h-8 bg-violet-100 dark:bg-violet-500/10 rounded-lg flex items-center justify-center">
              <Church className="text-violet-600 dark:text-violet-400" size={16} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Set Up Your Church</h2>
              <p className="text-xs text-gray-500 dark:text-dark-400">~2 minutes to get started</p>
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
                        ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300'
                        : isCompleted
                        ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/5'
                        : 'text-gray-400 dark:text-dark-500'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      isActive
                        ? 'bg-violet-600 text-white'
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
                <div className="w-16 h-16 bg-violet-100 dark:bg-violet-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="text-violet-600 dark:text-violet-400" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-dark-100 mb-2">Welcome to Grace CRM</h3>
                <p className="text-gray-500 dark:text-dark-400 max-w-md mx-auto">
                  Let's get your church set up in just a few steps. You can always change these later in Settings.
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 focus:border-transparent outline-none transition-all text-lg"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && canProceed() && goNext()}
                />
              </div>
            </div>
          )}

          {currentStep === 'profile' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-1">Church Profile</h3>
                <p className="text-sm text-gray-500 dark:text-dark-400">This info appears on your connect card and member portal.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  <MapPin size={14} className="inline mr-1" />Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="123 Main Street"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={e => setState(e.target.value)}
                    placeholder="State"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">ZIP</label>
                  <input
                    type="text"
                    value={zip}
                    onChange={e => setZip(e.target.value)}
                    placeholder="12345"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    <Phone size={14} className="inline mr-1" />Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    <Mail size={14} className="inline mr-1" />Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="office@church.org"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  <Globe size={14} className="inline mr-1" />Website
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://yourchurch.org"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm"
                />
              </div>
            </div>
          )}

          {currentStep === 'services' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-1">Service Times</h3>
                <p className="text-sm text-gray-500 dark:text-dark-400">When does your church meet? These show on your connect card and member portal.</p>
              </div>

              <div className="space-y-3">
                {serviceTimes.map((st, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-700">
                    <select
                      value={st.day}
                      onChange={e => updateServiceTime(idx, 'day', e.target.value)}
                      className="px-2 py-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-750 text-gray-900 dark:text-dark-100 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    >
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select
                      value={st.time}
                      onChange={e => updateServiceTime(idx, 'time', e.target.value)}
                      className="w-32 px-2 py-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-750 text-gray-900 dark:text-dark-100 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                      type="text"
                      value={st.name}
                      onChange={e => updateServiceTime(idx, 'name', e.target.value)}
                      placeholder="Service name"
                      className="flex-1 px-2 py-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-750 text-gray-900 dark:text-dark-100 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                    {serviceTimes.length > 1 && (
                      <button
                        onClick={() => removeServiceTime(idx)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        aria-label="Remove service time"
                      >
                        <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addServiceTime}
                className="flex items-center gap-2 px-3 py-2 text-sm text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/5 rounded-lg transition-colors"
              >
                <Plus size={14} />
                Add another service
              </button>
            </div>
          )}

          {currentStep === 'people' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-1">Add Your People</h3>
                <p className="text-sm text-gray-500 dark:text-dark-400">Start building your congregation directory. You can always add more later.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => { onOpenPersonForm(); handleDismiss(); }}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-600 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/5 transition-all group"
                >
                  <div className="w-12 h-12 bg-violet-100 dark:bg-violet-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="text-violet-600 dark:text-violet-400" size={24} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">Add Someone</p>
                    <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">One at a time</p>
                  </div>
                </button>

                <button
                  onClick={() => { onSetView('people'); handleDismiss(); }}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-600 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-all group"
                >
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="text-emerald-600 dark:text-emerald-400" size={24} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">Import CSV</p>
                    <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">Bulk import</p>
                  </div>
                </button>

                <button
                  onClick={goNext}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-600 hover:border-gray-400 dark:hover:border-dark-500 hover:bg-gray-50 dark:hover:bg-dark-800 transition-all group"
                >
                  <div className="w-12 h-12 bg-gray-100 dark:bg-dark-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <SkipForward className="text-gray-500 dark:text-dark-400" size={24} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">Skip for Now</p>
                    <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">Add people later</p>
                  </div>
                </button>
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
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/5 transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-gray-100 dark:bg-dark-700 rounded-lg flex items-center justify-center group-hover:bg-violet-100 dark:group-hover:bg-violet-500/10 transition-colors">
                      <item.icon size={18} className="text-gray-500 dark:text-dark-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/50">
          <div>
            {currentIndex > 0 && currentStep !== 'explore' && (
              <button
                onClick={goPrev}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-dark-100 transition-colors"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentStep !== 'explore' && (
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-sm text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-300 transition-colors"
              >
                Skip setup
              </button>
            )}
            {currentStep === 'explore' ? (
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
              >
                Go to Dashboard
                <ChevronRight size={16} />
              </button>
            ) : currentStep === 'people' ? (
              // People step uses its own CTA cards for navigation
              null
            ) : (
              <button
                onClick={goNext}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-dark-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
              >
                Continue
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
