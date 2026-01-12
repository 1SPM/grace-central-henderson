import { useState } from 'react';
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
} from 'lucide-react';
import { useIntegrations } from '../contexts/IntegrationsContext';

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
  const { status, configure, saveConfigToDatabase } = useIntegrations();

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
    configure(emailConfig);
    await saveConfigToDatabase(emailConfig);
    setSaving(false);
    setShowEmailConfig(false);
  };

  const handleSaveSmsConfig = async () => {
    setSaving(true);
    configure(smsConfig);
    await saveConfigToDatabase(smsConfig);
    setSaving(false);
    setShowSmsConfig(false);
  };

  const handleSavePaymentConfig = async () => {
    setSaving(true);
    configure(paymentConfig);
    await saveConfigToDatabase(paymentConfig);
    setSaving(false);
    setShowPaymentConfig(false);
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <input
              type="text"
              placeholder="Church Name"
              defaultValue="Grace Community Church"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Address"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Phone"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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
