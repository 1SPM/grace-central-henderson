/**
 * Text-to-Give Setup Component
 *
 * Allows churches to configure their text-to-give settings,
 * including keywords, funds, and custom messages.
 */

import { useState } from 'react';
import {
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  Save,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import { createLogger } from '../utils/logger';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

const log = createLogger('text-to-give');

interface Fund {
  id: string;
  keyword: string;
  name: string;
}

interface TextToGiveConfig {
  enabled: boolean;
  twilioNumber?: string;
  givingPageUrl: string;
  funds: Fund[];
  defaultFundId: string;
  welcomeMessage: string;
  helpMessage: string;
}

interface TextToGiveSetupProps {
  config: TextToGiveConfig;
  webhookUrl: string;
  onSave: (config: TextToGiveConfig) => Promise<void>;
}

export function TextToGiveSetup({ config: initialConfig, webhookUrl, onSave }: TextToGiveSetupProps) {
  const [config, setConfig] = useState<TextToGiveConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const { copiedId: copied, copy: copyToClipboard } = useCopyToClipboard();
  const [newFund, setNewFund] = useState({ keyword: '', name: '' });
  const [showTestModal, setShowTestModal] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(config);
    } catch (err) {
      log.error('Failed to save config', err);
    }
    setSaving(false);
  };

  const handleCopy = (text: string, id: string) => {
    copyToClipboard(text, id);
  };

  const handleAddFund = () => {
    if (!newFund.keyword || !newFund.name) return;

    const fund: Fund = {
      id: newFund.keyword.toLowerCase().replace(/\s+/g, '-'),
      keyword: newFund.keyword.toLowerCase(),
      name: newFund.name,
    };

    setConfig({
      ...config,
      funds: [...config.funds, fund],
    });
    setNewFund({ keyword: '', name: '' });
  };

  const handleRemoveFund = (id: string) => {
    setConfig({
      ...config,
      funds: config.funds.filter((f) => f.id !== id),
      defaultFundId: config.defaultFundId === id ? (config.funds[0]?.id || '') : config.defaultFundId,
    });
  };

  // Simulate text-to-give response
  const simulateResponse = (message: string) => {
    const parts = message.trim().toUpperCase().split(/\s+/);
    const command = parts[0];

    if (command === 'HELP' || command === '?') {
      return config.helpMessage;
    }

    if (command === 'FUNDS' || command === 'FUND') {
      const fundList = config.funds
        .map((f) => `• ${f.keyword.toUpperCase()} - ${f.name}`)
        .join('\n');
      return `Available funds:\n${fundList}`;
    }

    if (command === 'GIVE' || command === 'G') {
      let amount: number | undefined;
      let fundName = config.funds.find((f) => f.id === config.defaultFundId)?.name || 'General Fund';

      if (parts[1]) {
        const parsed = parseFloat(parts[1].replace(/[$,]/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
        } else {
          const fund = config.funds.find((f) => f.keyword.toUpperCase() === parts[1]);
          if (fund) fundName = fund.name;
        }
      }

      if (parts[2]) {
        const fund = config.funds.find((f) => f.keyword.toUpperCase() === parts[2]);
        if (fund) fundName = fund.name;
      }

      let response = config.welcomeMessage + '\n\n';
      if (amount) response += `Amount: $${amount.toFixed(2)}\n`;
      response += `Fund: ${fundName}\n\n`;
      response += `${config.givingPageUrl}${amount ? `?amount=${amount}` : ''}`;
      return response;
    }

    return 'Text GIVE to get started, or HELP for more options.';
  };

  const handleTest = () => {
    setTestResult(simulateResponse(testInput));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Text-to-Give Setup</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Allow members to give via SMS text message
          </p>
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg mb-6">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Enable Text-to-Give</p>
          <p className="text-sm text-gray-500">Members can text donations to your number</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div className="space-y-6">
        {/* Twilio Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Phone className="w-4 h-4 inline mr-1" />
            Twilio Phone Number
          </label>
          <input
            type="tel"
            value={config.twilioNumber || ''}
            onChange={(e) => setConfig({ ...config, twilioNumber: e.target.value })}
            placeholder="+1 (555) 123-4567"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          />
          <p className="mt-1 text-xs text-gray-500">
            Get a number from{' '}
            <a
              href="https://www.twilio.com/console/phone-numbers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Twilio Console <ExternalLink className="w-3 h-3 inline" />
            </a>
          </p>
        </div>

        {/* Webhook URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Webhook URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={webhookUrl}
              readOnly
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400"
            />
            <button
              onClick={() => handleCopy(webhookUrl, 'webhook')}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              title="Copy webhook URL"
            >
              {copied === 'webhook' ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Paste this URL in your Twilio phone number's Messaging webhook settings
          </p>
        </div>

        {/* Giving Page URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Giving Page URL
          </label>
          <input
            type="url"
            value={config.givingPageUrl}
            onChange={(e) => setConfig({ ...config, givingPageUrl: e.target.value })}
            placeholder="https://give.yourchurch.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          />
        </div>

        {/* Funds */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Giving Funds & Keywords
          </label>
          <div className="space-y-2 mb-3">
            {config.funds.map((fund) => (
              <div
                key={fund.id}
                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-sm font-mono">
                  {fund.keyword.toUpperCase()}
                </span>
                <span className="flex-1 text-gray-700 dark:text-gray-300">{fund.name}</span>
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  <input
                    type="radio"
                    name="defaultFund"
                    checked={config.defaultFundId === fund.id}
                    onChange={() => setConfig({ ...config, defaultFundId: fund.id })}
                    className="text-blue-600"
                  />
                  Default
                </label>
                <button
                  onClick={() => handleRemoveFund(fund.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Remove fund"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add new fund */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newFund.keyword}
              onChange={(e) => setNewFund({ ...newFund, keyword: e.target.value })}
              placeholder="Keyword (e.g., missions)"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm"
            />
            <input
              type="text"
              value={newFund.name}
              onChange={(e) => setNewFund({ ...newFund, name: e.target.value })}
              placeholder="Fund Name"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm"
            />
            <button
              onClick={handleAddFund}
              disabled={!newFund.keyword || !newFund.name}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Custom Messages */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Welcome Message
          </label>
          <textarea
            value={config.welcomeMessage}
            onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm"
            placeholder="Thank you for giving!"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Help Message
          </label>
          <textarea
            value={config.helpMessage}
            onChange={(e) => setConfig({ ...config, helpMessage: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm font-mono"
            placeholder="Text GIVE to get started..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowTestModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <HelpCircle className="w-4 h-4" />
          Test Response
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Quick Reference */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Quick Reference for Members
        </h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">GIVE</code>
            <span className="text-gray-600 dark:text-gray-400">Get giving link</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">GIVE 50</code>
            <span className="text-gray-600 dark:text-gray-400">Give $50</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">GIVE 100 MISSIONS</code>
            <span className="text-gray-600 dark:text-gray-400">Give $100 to Missions</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">HELP</code>
            <span className="text-gray-600 dark:text-gray-400">Get help message</span>
          </div>
        </div>
      </div>

      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Test Text-to-Give</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Simulate incoming text
              </label>
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="e.g., GIVE 50"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
              />
            </div>

            <button
              onClick={handleTest}
              className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Simulate Response
            </button>

            {testResult && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Response:</p>
                <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {testResult}
                </pre>
              </div>
            )}

            <button
              onClick={() => {
                setShowTestModal(false);
                setTestInput('');
                setTestResult('');
              }}
              className="w-full mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
