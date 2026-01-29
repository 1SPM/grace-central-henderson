import { useState, useEffect } from 'react';
import {
  Church,
  Users,
  Bell,
  Database,
  Mail,
  MessageSquare,
  CreditCard,
  Shield,
  Check,
  X,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Plus,
  Trash2,
  Clock,
} from 'lucide-react';
import { useIntegrations } from '../contexts/IntegrationsContext';
import { useChurchSettings, ServiceTime } from '../hooks/useChurchSettings';

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  isConfigured: boolean;
  setupUrl: string;
  onConfigure: () => void;
}

function IntegrationCard({
  title,
  description,
  icon,
  iconBg,
  isConfigured,
  setupUrl,
  onConfigure,
}: IntegrationCardProps) {
  return (
    <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-dark-100">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-dark-400">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-full">
              <Check size={14} />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-dark-400 bg-gray-100 dark:bg-dark-800 px-2 py-1 rounded-full">
              <X size={14} />
              Not configured
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={onConfigure}
          className="flex-1 px-4 py-2 text-sm font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
        >
          {isConfigured ? 'Update Settings' : 'Configure'}
        </button>
        <a
          href={setupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300 bg-gray-50 dark:bg-dark-800 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 flex items-center gap-1"
        >
          Docs <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

interface ConfigModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function ConfigModal({ title, isOpen, onClose, children }: ConfigModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">{title}</h2>
        </div>
        <div className="p-6">{children}</div>
        <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 pr-10 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export function Settings() {
  const { status, saveIntegrations } = useIntegrations();
  const { settings: churchSettings, saveProfile, isLoading: settingsLoading } = useChurchSettings();

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

  // Form states
  const [emailConfig, setEmailConfig] = useState({
    resendApiKey: '',
    emailFromAddress: '',
    emailFromName: '',
  });

  const [smsConfig, setSmsConfig] = useState({
    twilioAccountSid: '',
    twilioAuthToken: '',
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
      // Clear form for security
      setEmailConfig({ resendApiKey: '', emailFromAddress: '', emailFromName: '' });
    }
  };

  const handleSaveSmsConfig = async () => {
    setSaving(true);
    const success = await saveIntegrations(smsConfig);
    setSaving(false);
    if (success) {
      setShowSmsConfig(false);
      // Clear form for security
      setSmsConfig({ twilioAccountSid: '', twilioAuthToken: '', twilioPhoneNumber: '' });
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Settings</h1>
        <p className="text-gray-500 dark:text-dark-400 mt-1">Manage your GRACE CRM configuration</p>
      </div>

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
            {!status.email && !status.sms && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                Configure Email or SMS to enable notifications
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-500/10 rounded-xl flex items-center justify-center">
              <Database className="text-green-600 dark:text-green-400" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-dark-100">Data & Backup</h2>
              <p className="text-sm text-gray-500 dark:text-dark-400">Export and backup options</p>
            </div>
          </div>
          <div className="space-y-2">
            <button className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 rounded-xl text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800">
              Export All Data (CSV)
            </button>
            <button className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 rounded-xl text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800">
              Import Data
            </button>
          </div>
        </div>
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

      {/* Email Config Modal */}
      <ConfigModal
        title="Configure Email (Resend)"
        isOpen={showEmailConfig}
        onClose={() => setShowEmailConfig(false)}
      >
        <div className="space-y-4">
          <PasswordInput
            label="Resend API Key"
            value={emailConfig.resendApiKey}
            onChange={(v) => setEmailConfig({ ...emailConfig, resendApiKey: v })}
            placeholder="re_..."
          />
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
            disabled={saving || !emailConfig.resendApiKey}
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
          <PasswordInput
            label="Account SID"
            value={smsConfig.twilioAccountSid}
            onChange={(v) => setSmsConfig({ ...smsConfig, twilioAccountSid: v })}
            placeholder="AC..."
          />
          <PasswordInput
            label="Auth Token"
            value={smsConfig.twilioAuthToken}
            onChange={(v) => setSmsConfig({ ...smsConfig, twilioAuthToken: v })}
            placeholder="Your auth token"
          />
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
            disabled={saving || !smsConfig.twilioAccountSid || !smsConfig.twilioAuthToken || !smsConfig.twilioPhoneNumber}
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
