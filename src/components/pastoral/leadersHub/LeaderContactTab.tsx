import { useState } from 'react';
import { HeartHandshake, Loader2, MessageSquare, Phone, Send } from 'lucide-react';
import type { LeaderProfile, Person, View } from '../../../types';
import { resolveLeaderContact } from '../../../config/centralHendersonLeaders';
import { openCare } from '../../../lib/careNav';
import { useIntegrations } from '../../../contexts/IntegrationsContext';

interface LeaderContactTabProps {
  leader: LeaderProfile;
  people: Person[];
  onNavigate?: (view: View | string) => void;
}

export function LeaderContactTab({ leader, people, onNavigate }: LeaderContactTabProps) {
  const { sendSMS } = useIntegrations();
  const contact = resolveLeaderContact(leader, people);
  const [showSms, setShowSms] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendSms = async () => {
    if (!contact.phone || !smsMessage.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await sendSMS({ to: contact.phone, message: smsMessage.trim() });
      if (res.success) {
        setResult({ success: true, message: 'Message sent successfully.' });
        setSmsMessage('');
        setTimeout(() => {
          setShowSms(false);
          setResult(null);
        }, 2000);
      } else {
        setResult({ success: false, message: res.error || 'Failed to send message.' });
      }
    } catch {
      setResult({ success: false, message: 'An error occurred while sending.' });
    }
    setSending(false);
  };

  const openDispatch = () => {
    if (onNavigate) {
      openCare('dispatch', onNavigate as (view: View) => void, leader.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="p-4 bg-gray-50 dark:bg-dark-850 rounded-lg">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-dark-500 mb-1">Phone</p>
            <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
              {contact.phone || 'Not on file'}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-dark-850 rounded-lg">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-dark-500 mb-1">Email</p>
            <p
              className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate"
              title={contact.email || undefined}
            >
              {contact.email || 'Not on file'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {contact.phone ? (
            <a
              href={`tel:${contact.phone.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-950 text-white text-sm font-medium transition-colors"
            >
              <Phone size={14} /> Call
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-200 dark:bg-dark-700 text-gray-500 text-sm">
              <Phone size={14} /> No phone on file
            </span>
          )}
          <button
            type="button"
            disabled={!contact.phone}
            onClick={() => setShowSms(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-850 hover:bg-gray-50 dark:hover:bg-dark-800 text-sm font-medium text-gray-900 dark:text-dark-100 disabled:opacity-50"
          >
            <MessageSquare size={14} /> Send SMS / DM
          </button>
          {onNavigate && (
            <button
              type="button"
              onClick={openDispatch}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-brand-200 dark:border-brand-800/40 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/30 text-sm font-medium text-brand-800 dark:text-brand-300"
            >
              <HeartHandshake size={14} /> Open in Crisis Dispatch
            </button>
          )}
        </div>
      </div>

      {showSms && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <h4 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-2">Message {leader.displayName}</h4>
          <textarea
            value={smsMessage}
            onChange={e => setSmsMessage(e.target.value)}
            rows={4}
            placeholder={`Hi ${leader.displayName.split(' ')[0]}, …`}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-dark-100 resize-none"
          />
          {result && (
            <p className={`text-xs mt-2 ${result.success ? 'text-emerald-600' : 'text-brand-600'}`}>
              {result.message}
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleSendSms}
              disabled={sending || !smsMessage.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSms(false);
                setResult(null);
              }}
              className="px-4 py-2 text-sm text-gray-600 dark:text-dark-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
