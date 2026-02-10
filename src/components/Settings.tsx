import { useState, useEffect } from 'react';
import {
  Church,
  Users,
  Bell,
  Mail,
  MessageSquare,
  CreditCard,
  Shield,
  Check,
  Save,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  MapPin,
  ToggleLeft,
  ToggleRight,
  Accessibility,
} from 'lucide-react';
import { useAISettings, AI_FEATURES, AISettings } from '../hooks/useAISettings';
import { useIntegrations } from '../contexts/IntegrationsContext';
import { useAccessibility, FontSize } from '../contexts/AccessibilityContext';
import { useChurchSettings, ServiceTime } from '../hooks/useChurchSettings';
import { IntegrationCard, ConfigModal, PasswordInput } from './settings/SettingsUI';
import { SettingsDataExport } from './settings/SettingsDataExport';
import type { Person, Task, CalendarEvent, Giving, SmallGroup, PrayerRequest } from '../types';

const fontSizeOptions: { value: FontSize; label: string; preview: string }[] = [
  { value: 'small', label: 'Small', preview: 'Aa' },
  { value: 'medium', label: 'Medium', preview: 'Aa' },
  { value: 'large', label: 'Large', preview: 'Aa' },
  { value: 'x-large', label: 'X-Large', preview: 'Aa' },
];

interface SettingsProps {
  people?: Person[];
  tasks?: Task[];
  events?: CalendarEvent[];
  giving?: Giving[];
  groups?: SmallGroup[];
  prayers?: PrayerRequest[];
  onNavigate?: (view: 'reminders' | 'email-templates' | 'forms' | 'planning-center-import' | 'wedding-services' | 'funeral-services' | 'estate-planning') => void;
}

export function Settings({
  people = [],
  tasks = [],
  events = [],
  giving = [],
  groups = [],
  prayers = [],
  onNavigate,
}: SettingsProps) {
  const { status, saveIntegrations } = useIntegrations();
  const { settings: accessibilitySettings, setFontSize, setHighContrast, setReduceMotion } = useAccessibility();
  const { settings: churchSettings, saveProfile, isLoading: settingsLoading } = useChurchSettings();
  const { settings: aiSettings, toggleSetting, enableAll, disableAll } = useAISettings();

  // Church profile state
  const [churchProfile, setChurchProfile] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    website: '',
    serviceTimes: [] as ServiceTime[],
  });
  const [profileSaved, setProfileSaved] = useState(false);

  // Load church profile from settings
  useEffect(() => {
    if (churchSettings?.profile) {
      setChurchProfile({
        name: churchSettings.profile.name || '',
        address: churchSettings.profile.address || '',
        city: churchSettings.profile.city || '',
        state: churchSettings.profile.state || '',
        zip: churchSettings.profile.zip || '',
        phone: churchSettings.profile.phone || '',
        email: churchSettings.profile.email || '',
        website: churchSettings.profile.website || '',
        serviceTimes: churchSettings.profile.serviceTimes || [],
      });
    }
  }, [churchSettings]);

  // Modal states
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [showSmsConfig, setShowSmsConfig] = useState(false);
  const [showPaymentConfig, setShowPaymentConfig] = useState(false);
  const [showAuthConfig, setShowAuthConfig] = useState(false);

  // Form states (only non-secret config; API keys managed via backend env vars)
  const [emailConfig, setEmailConfig] = useState({
    emailFromAddress: '',
    emailFromName: '',
  });

  const [smsConfig, setSmsConfig] = useState({
    twilioPhoneNumber: '',
  });

  const [paymentConfig, setPaymentConfig] = useState({
    stripePublishableKey: '',
  });

  const [saving, setSaving] = useState(false);

  const handleSaveEmailConfig = async () => {
    setSaving(true);
    const success = await saveIntegrations(emailConfig);
    setSaving(false);
    if (success) {
      setShowEmailConfig(false);
      setEmailConfig({ emailFromAddress: '', emailFromName: '' });
    }
  };

  const handleSaveSmsConfig = async () => {
    setSaving(true);
    const success = await saveIntegrations(smsConfig);
    setSaving(false);
    if (success) {
      setShowSmsConfig(false);
      setSmsConfig({ twilioPhoneNumber: '' });
    }
  };

  const handleSavePaymentConfig = async () => {
    setSaving(true);
    const success = await saveIntegrations(paymentConfig);
    setSaving(false);
    if (success) {
      setShowPaymentConfig(false);
      // Clear form for security
      setPaymentConfig({ stripePublishableKey: '' });
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const success = await saveProfile(churchProfile);
    setSaving(false);
    if (success) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Settings</h1>
        <p className="text-gray-500 dark:text-dark-400 mt-1">Manage your GRACE CRM configuration</p>
      </div>

      {/* Life Services Section - Quick Access */}
      {onNavigate && (
        <div className="bg-gradient-to-r from-rose-50 to-emerald-50 dark:from-rose-900/20 dark:to-emerald-900/20 rounded-2xl border border-rose-200 dark:border-rose-800 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-rose-100 dark:bg-rose-500/10 rounded-xl flex items-center justify-center">
              <Heart className="text-rose-600 dark:text-rose-400" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-dark-100">Life Services</h2>
              <p className="text-sm text-gray-500 dark:text-dark-400">Weddings, funerals, and legacy giving</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => onNavigate('wedding-services')}
              className="flex items-center gap-3 p-4 bg-white dark:bg-dark-800 border border-pink-200 dark:border-pink-800 rounded-xl hover:bg-pink-50 dark:hover:bg-pink-500/10 transition-colors text-left shadow-sm"
            >
              <div className="w-12 h-12 bg-pink-100 dark:bg-pink-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <Heart className="text-pink-600 dark:text-pink-400" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-dark-100">Weddings</h3>
                <p className="text-xs text-gray-500 dark:text-dark-400">Manage ceremonies & planning</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate('funeral-services')}
              className="flex items-center gap-3 p-4 bg-white dark:bg-dark-800 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-500/10 transition-colors text-left shadow-sm"
            >
              <div className="w-12 h-12 bg-stone-100 dark:bg-stone-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="text-stone-600 dark:text-stone-400" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-dark-100">Funerals</h3>
                <p className="text-xs text-gray-500 dark:text-dark-400">Memorial service planning</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate('estate-planning')}
              className="flex items-center gap-3 p-4 bg-white dark:bg-dark-800 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors text-left shadow-sm"
            >
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="text-emerald-600 dark:text-emerald-400" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-dark-100">Estate Planning</h3>
                <p className="text-xs text-gray-500 dark:text-dark-400">Legacy giving & wills</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Integrations Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">
          Integrations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <IntegrationCard
            title="Email (Resend)"
            description="Send automated emails"
            icon={<Mail className="text-blue-600 dark:text-blue-400" size={20} />}
            iconBg="bg-blue-100 dark:bg-blue-500/10"
            isConfigured={status.email}
            setupUrl="https://resend.com/docs"
            onConfigure={() => setShowEmailConfig(true)}
          />

          <IntegrationCard
            title="SMS (Twilio)"
            description="Send text messages"
            icon={<MessageSquare className="text-green-600 dark:text-green-400" size={20} />}
            iconBg="bg-green-100 dark:bg-green-500/10"
            isConfigured={status.sms}
            setupUrl="https://www.twilio.com/docs"
            onConfigure={() => setShowSmsConfig(true)}
          />

          <IntegrationCard
            title="Payments (Stripe)"
            description="Online giving & donations"
            icon={<CreditCard className="text-purple-600 dark:text-purple-400" size={20} />}
            iconBg="bg-purple-100 dark:bg-purple-500/10"
            isConfigured={status.payments}
            setupUrl="https://stripe.com/docs"
            onConfigure={() => setShowPaymentConfig(true)}
          />

          <IntegrationCard
            title="Authentication (Clerk)"
            description="User login & teams"
            icon={<Shield className="text-amber-600 dark:text-amber-400" size={20} />}
            iconBg="bg-amber-100 dark:bg-amber-500/10"
            isConfigured={!!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
            setupUrl="https://clerk.com/docs"
            onConfigure={() => setShowAuthConfig(true)}
          />
        </div>
      </div>

      {/* AI Features Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-2">
              <Sparkles className="text-violet-500" size={20} />
              AI Features
            </h2>
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-0.5">
              Control which AI-powered features are enabled
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={enableAll}
              className="px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
            >
              Enable All
            </button>
            <button
              onClick={disableAll}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-dark-800 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700"
            >
              Disable All
            </button>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 divide-y divide-gray-100 dark:divide-dark-700">
          {AI_FEATURES.map((feature) => {
            const isEnabled = aiSettings[feature.id as keyof AISettings];
            return (
              <div
                key={feature.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-dark-100">
                      {feature.name}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 rounded-full">
                      <MapPin size={10} />
                      {feature.location}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-dark-400 mt-0.5">
                    {feature.description}
                  </p>
                </div>
                <button
                  onClick={() => toggleSetting(feature.id as keyof AISettings)}
                  className={`flex-shrink-0 transition-colors ${
                    isEnabled
                      ? 'text-emerald-500 hover:text-emerald-600'
                      : 'text-gray-300 dark:text-dark-600 hover:text-gray-400 dark:hover:text-dark-500'
                  }`}
                  aria-label={`Toggle ${feature.name}`}
                >
                  {isEnabled ? (
                    <ToggleRight size={32} strokeWidth={1.5} />
                  ) : (
                    <ToggleLeft size={32} strokeWidth={1.5} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 dark:text-dark-500 mt-2">
          AI features require a configured Gemini API key. Disabling features will hide their UI elements.
        </p>
      </div>

      {/* Accessibility Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">
          Accessibility
        </h2>
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-500/10 rounded-xl flex items-center justify-center">
              <Accessibility className="text-cyan-600 dark:text-cyan-400" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-dark-100">Display Settings</h3>
              <p className="text-sm text-gray-500 dark:text-dark-400">Customize text size and visual preferences</p>
            </div>
          </div>

          {/* Font Size */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-3">
              Font Size
            </label>
            <div className="grid grid-cols-4 gap-2">
              {fontSizeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFontSize(option.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    accessibilitySettings.fontSize === option.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                  }`}
                >
                  <span
                    className={`font-semibold text-gray-900 dark:text-dark-100 ${
                      option.value === 'small' ? 'text-sm' :
                      option.value === 'medium' ? 'text-base' :
                      option.value === 'large' ? 'text-lg' : 'text-xl'
                    }`}
                  >
                    {option.preview}
                  </span>
                  <span className={`text-xs ${
                    accessibilitySettings.fontSize === option.value
                      ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                      : 'text-gray-500 dark:text-dark-400'
                  }`}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-gray-500 dark:text-dark-400">
              Preview: The quick brown fox jumps over the lazy dog.
            </p>
          </div>

          {/* Other accessibility options */}
          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-dark-700">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-dark-300">High Contrast</span>
                <p className="text-xs text-gray-500 dark:text-dark-400">Increase contrast for better visibility</p>
              </div>
              <input
                type="checkbox"
                checked={accessibilitySettings.highContrast}
                onChange={(e) => setHighContrast(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-indigo-600"
              />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-dark-300">Reduce Motion</span>
                <p className="text-xs text-gray-500 dark:text-dark-400">Minimize animations and transitions</p>
              </div>
              <input
                type="checkbox"
                checked={accessibilitySettings.reduceMotion}
                onChange={(e) => setReduceMotion(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-indigo-600"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Church Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Church Profile */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center">
              <Church className="text-indigo-600 dark:text-indigo-400" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-dark-100">Church Profile</h2>
              <p className="text-sm text-gray-500 dark:text-dark-400">Basic information about your church</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">
                Church Name
              </label>
              <input
                type="text"
                placeholder="Your Church Name"
                value={churchProfile.name}
                onChange={(e) => setChurchProfile({ ...churchProfile, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">
                Street Address
              </label>
              <input
                type="text"
                placeholder="123 Main Street"
                value={churchProfile.address}
                onChange={(e) => setChurchProfile({ ...churchProfile, address: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">
                  City
                </label>
                <input
                  type="text"
                  placeholder="City"
                  value={churchProfile.city}
                  onChange={(e) => setChurchProfile({ ...churchProfile, city: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">
                  State
                </label>
                <input
                  type="text"
                  placeholder="CA"
                  value={churchProfile.state}
                  onChange={(e) => setChurchProfile({ ...churchProfile, state: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">
                  ZIP
                </label>
                <input
                  type="text"
                  placeholder="90210"
                  value={churchProfile.zip}
                  onChange={(e) => setChurchProfile({ ...churchProfile, zip: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  placeholder="(555) 123-4567"
                  value={churchProfile.phone}
                  onChange={(e) => setChurchProfile({ ...churchProfile, phone: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="info@church.org"
                  value={churchProfile.email}
                  onChange={(e) => setChurchProfile({ ...churchProfile, email: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">
                Website
              </label>
              <input
                type="url"
                placeholder="https://yourchurch.org"
                value={churchProfile.website}
                onChange={(e) => setChurchProfile({ ...churchProfile, website: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={saving || settingsLoading}
              className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {profileSaved ? (
                <>
                  <Check size={16} />
                  Saved!
                </>
              ) : saving ? (
                'Saving...'
              ) : (
                <>
                  <Save size={16} />
                  Save Profile
                </>
              )}
            </button>
          </div>
        </div>

        {/* Service Times */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <Clock className="text-emerald-600 dark:text-emerald-400" size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-dark-100">Service Times</h2>
                <p className="text-sm text-gray-500 dark:text-dark-400">Shown on member portal</p>
              </div>
            </div>
            <button
              onClick={() => {
                setChurchProfile({
                  ...churchProfile,
                  serviceTimes: [...churchProfile.serviceTimes, { day: 'Sunday', time: '10:00 AM', name: 'Worship Service' }]
                });
              }}
              className="w-8 h-8 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="space-y-3">
            {churchProfile.serviceTimes.length === 0 ? (
              <p className="text-gray-400 dark:text-dark-500 text-sm text-center py-6">
                No service times configured. Click + to add one.
              </p>
            ) : (
              churchProfile.serviceTimes.map((service, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-dark-800 rounded-xl">
                  <select
                    value={service.day}
                    onChange={(e) => {
                      const newTimes = [...churchProfile.serviceTimes];
                      newTimes[index] = { ...newTimes[index], day: e.target.value };
                      setChurchProfile({ ...churchProfile, serviceTimes: newTimes });
                    }}
                    className="px-2 py-1.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={service.time}
                    onChange={(e) => {
                      const newTimes = [...churchProfile.serviceTimes];
                      newTimes[index] = { ...newTimes[index], time: e.target.value };
                      setChurchProfile({ ...churchProfile, serviceTimes: newTimes });
                    }}
                    placeholder="10:00 AM"
                    className="w-24 px-2 py-1.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    value={service.name}
                    onChange={(e) => {
                      const newTimes = [...churchProfile.serviceTimes];
                      newTimes[index] = { ...newTimes[index], name: e.target.value };
                      setChurchProfile({ ...churchProfile, serviceTimes: newTimes });
                    }}
                    placeholder="Service name"
                    className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      const newTimes = churchProfile.serviceTimes.filter((_, i) => i !== index);
                      setChurchProfile({ ...churchProfile, serviceTimes: newTimes });
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
            <button
              onClick={handleSaveProfile}
              disabled={saving || settingsLoading}
              className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {profileSaved ? (
                <>
                  <Check size={16} />
                  Saved!
                </>
              ) : saving ? (
                'Saving...'
              ) : (
                <>
                  <Save size={16} />
                  Save Service Times
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/10 rounded-xl flex items-center justify-center">
              <Users className="text-purple-600 dark:text-purple-400" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-dark-100">Team Members</h2>
              <p className="text-sm text-gray-500 dark:text-dark-400">Manage staff access</p>
            </div>
          </div>
          {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? (
            <div className="space-y-2">
              <button className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
                Invite Team Member
              </button>
              <button className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 rounded-xl text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800">
                Manage Roles
              </button>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 dark:text-dark-400 text-sm">
              Configure Clerk authentication to manage team members
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/10 rounded-xl flex items-center justify-center">
              <Bell className="text-amber-600 dark:text-amber-400" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-dark-100">Notifications</h2>
              <p className="text-sm text-gray-500 dark:text-dark-400">Email and alert preferences</p>
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-dark-300">New visitor alerts</span>
              <input
                type="checkbox"
                defaultChecked
                disabled={!status.email && !status.sms}
                className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-indigo-600 disabled:opacity-50"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-dark-300">Task reminders</span>
              <input
                type="checkbox"
                defaultChecked
                disabled={!status.email && !status.sms}
                className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-indigo-600 disabled:opacity-50"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-dark-300">Prayer request notifications</span>
              <input
                type="checkbox"
                disabled={!status.email && !status.sms}
                className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-indigo-600 disabled:opacity-50"
              />
            </label>
            {onNavigate && (
              <button
                onClick={() => onNavigate('reminders')}
                className="w-full mt-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-xl text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-500/20 flex items-center justify-center gap-2"
              >
                <Clock size={16} />
                Manage Automated Reminders
              </button>
            )}
            {!status.email && !status.sms && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                Configure Email or SMS to enable notifications
              </p>
            )}
          </div>
        </div>

        <SettingsDataExport
          people={people}
          tasks={tasks}
          events={events}
          giving={giving}
          groups={groups}
          prayers={prayers}
          onNavigate={onNavigate}
        />
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">GRACE CRM</h2>
            <p className="text-sm opacity-80">Growth · Relationships · Attendance · Community · Engagement</p>
            <p className="text-xs opacity-60 mt-2">Version 1.1.0 - Professional Edition</p>
          </div>
          <Church size={48} className="opacity-20" />
        </div>
      </div>
      </div>

      {/* Email Config Modal */}
      <ConfigModal
        title="Configure Email (Resend)"
        isOpen={showEmailConfig}
        onClose={() => setShowEmailConfig(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-dark-400">
            The Resend API key is configured as a backend environment variable (RESEND_API_KEY).
            Configure the sender details below.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              From Email Address
            </label>
            <input
              type="email"
              value={emailConfig.emailFromAddress}
              onChange={(e) => setEmailConfig({ ...emailConfig, emailFromAddress: e.target.value })}
              placeholder="noreply@yourdomain.com"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              From Name
            </label>
            <input
              type="text"
              value={emailConfig.emailFromName}
              onChange={(e) => setEmailConfig({ ...emailConfig, emailFromName: e.target.value })}
              placeholder="Grace Community Church"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleSaveEmailConfig}
            disabled={saving}
            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </ConfigModal>

      {/* SMS Config Modal */}
      <ConfigModal
        title="Configure SMS (Twilio)"
        isOpen={showSmsConfig}
        onClose={() => setShowSmsConfig(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-dark-400">
            Twilio Account SID and Auth Token are configured as backend environment variables
            (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN). Configure the phone number below.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Twilio Phone Number
            </label>
            <input
              type="tel"
              value={smsConfig.twilioPhoneNumber}
              onChange={(e) => setSmsConfig({ ...smsConfig, twilioPhoneNumber: e.target.value })}
              placeholder="+1234567890"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleSaveSmsConfig}
            disabled={saving || !smsConfig.twilioPhoneNumber}
            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </ConfigModal>

      {/* Payment Config Modal */}
      <ConfigModal
        title="Configure Payments (Stripe)"
        isOpen={showPaymentConfig}
        onClose={() => setShowPaymentConfig(false)}
      >
        <div className="space-y-4">
          <PasswordInput
            label="Stripe Publishable Key"
            value={paymentConfig.stripePublishableKey}
            onChange={(v) => setPaymentConfig({ ...paymentConfig, stripePublishableKey: v })}
            placeholder="pk_test_..."
          />
          <p className="text-xs text-gray-500 dark:text-dark-400">
            Note: For production use, you'll also need to set up a backend server to handle Stripe webhooks and secret key operations securely.
          </p>
          <button
            onClick={handleSavePaymentConfig}
            disabled={saving || !paymentConfig.stripePublishableKey}
            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </ConfigModal>

      {/* Auth Config Modal */}
      <ConfigModal
        title="Configure Authentication (Clerk)"
        isOpen={showAuthConfig}
        onClose={() => setShowAuthConfig(false)}
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
            <p className="text-sm text-amber-800 dark:text-amber-400">
              Clerk authentication requires setting the <code className="bg-amber-100 dark:bg-amber-500/20 px-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code> environment variable.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-dark-300">To set up Clerk:</p>
            <ol className="text-sm text-gray-600 dark:text-dark-300 list-decimal list-inside space-y-1">
              <li>Create an account at clerk.com</li>
              <li>Create a new application</li>
              <li>Copy your publishable key</li>
              <li>Add it to your .env.local file</li>
              <li>Restart the development server</li>
            </ol>
          </div>
          <a
            href="https://clerk.com/docs/quickstarts/react"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 text-center"
          >
            View Clerk Setup Guide
          </a>
        </div>
      </ConfigModal>
    </div>
  );
}
