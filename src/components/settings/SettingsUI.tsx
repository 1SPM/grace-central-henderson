/**
 * Shared UI components for the Settings page
 */

import { useState } from 'react';
import { Check, X, ExternalLink, Eye, EyeOff } from 'lucide-react';

export interface IntegrationCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  isConfigured: boolean;
  setupUrl: string;
  onConfigure: () => void;
}

export function IntegrationCard({
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

export interface ConfigModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function ConfigModal({ title, isOpen, onClose, children }: ConfigModalProps) {
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

export function PasswordInput({
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
