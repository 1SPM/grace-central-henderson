import {
  Mail,
  MessageSquare,
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { Person } from '../../types';

interface ComposeModalProps {
  type: 'email' | 'sms';
  person: Person;
  emailSubject: string;
  emailBody: string;
  smsMessage: string;
  isGenerating: boolean;
  isSending: boolean;
  sendResult: { success: boolean; message: string } | null;
  showAIButton: boolean;
  onEmailSubjectChange: (value: string) => void;
  onEmailBodyChange: (value: string) => void;
  onSmsMessageChange: (value: string) => void;
  onAIDraft: () => void;
  onSend: () => void;
  onMarkDone: () => void;
  onClose: () => void;
}

export function ComposeModal({
  type,
  person,
  emailSubject,
  emailBody,
  smsMessage,
  isGenerating,
  isSending,
  sendResult,
  showAIButton,
  onEmailSubjectChange,
  onEmailBodyChange,
  onSmsMessageChange,
  onAIDraft,
  onSend,
  onMarkDone,
  onClose,
}: ComposeModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                type === 'email'
                  ? 'bg-blue-100 dark:bg-blue-500/20'
                  : 'bg-purple-100 dark:bg-purple-500/20'
              }`}>
                {type === 'email'
                  ? <Mail size={20} className="text-blue-600 dark:text-blue-400" />
                  : <MessageSquare size={20} className="text-purple-600 dark:text-purple-400" />
                }
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-dark-100">
                  {type === 'email' ? 'Send Email' : 'Send Text'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-dark-400">
                  to {person.firstName} {person.lastName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {showAIButton && (
            <button
              onClick={onAIDraft}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate with AI
                </>
              )}
            </button>
          )}

          {type === 'email' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => onEmailSubjectChange(e.target.value)}
                  placeholder="Enter subject..."
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Message
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => onEmailBodyChange(e.target.value)}
                  placeholder="Write your message or click 'Generate with AI'..."
                  rows={6}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                Message
              </label>
              <textarea
                value={smsMessage}
                onChange={(e) => onSmsMessageChange(e.target.value.slice(0, 160))}
                placeholder="Write your message or click 'Generate with AI'..."
                rows={4}
                maxLength={160}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
              <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">
                {smsMessage.length}/160 characters
              </p>
            </div>
          )}

          {sendResult && (
            <div className={`p-3 rounded-xl flex items-center gap-2 ${
              sendResult.success
                ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
            }`}>
              {sendResult.success ? <CheckCircle2 size={16} /> : <X size={16} />}
              {sendResult.message}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
          {sendResult?.success ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                onClick={onMarkDone}
                className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 size={16} />
                Mark Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSend}
                disabled={isSending || (type === 'email' ? !emailBody.trim() : !smsMessage.trim())}
                className={`px-4 py-2 text-white rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors ${
                  type === 'email'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isSending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send {type === 'email' ? 'Email' : 'Text'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
