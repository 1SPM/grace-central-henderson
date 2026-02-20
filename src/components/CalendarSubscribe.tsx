/**
 * Calendar Subscribe Component
 *
 * Provides links to subscribe to the church calendar in various apps.
 */

import { Calendar, Copy, Check, ExternalLink } from 'lucide-react';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

interface CalendarSubscribeProps {
  churchId: string;
  churchName: string;
}

export function CalendarSubscribe({ churchId, churchName }: CalendarSubscribeProps) {
  const { isCopied: copied, copy: copyToClipboard } = useCopyToClipboard();

  // Build the iCal subscription URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const icalUrl = `${baseUrl}/api/calendar/ical?churchId=${encodeURIComponent(churchId)}&churchName=${encodeURIComponent(churchName)}`;

  // webcal:// protocol for direct calendar subscription
  const webcalUrl = icalUrl.replace(/^https?:/, 'webcal:');

  // Google Calendar add URL
  const googleCalUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

  const handleCopy = () => {
    copyToClipboard(icalUrl);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
          <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Subscribe to Calendar</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add church events to your calendar app
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Subscription URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Subscription URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={icalUrl}
              readOnly
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400"
            />
            <button
              onClick={handleCopy}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Copy URL"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Add Buttons */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick Add
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Google Calendar */}
            <a
              href={googleCalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google Calendar
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>

            {/* Apple Calendar (webcal link) */}
            <a
              href={webcalUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Apple Calendar
            </a>

            {/* Outlook */}
            <a
              href={webcalUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#0078D4"
                  d="M24 7.387v10.478c0 .23-.08.424-.238.576-.157.157-.352.234-.58.234h-8.547v-6.95l1.56 1.14c.088.063.19.094.31.094.12 0 .222-.03.31-.094l6.95-5.093c.06-.04.125-.06.195-.06s.13.03.18.09c.053.054.08.12.08.2v.385z"
                />
                <path
                  fill="#0078D4"
                  d="M15.322 10.67l-5.038-3.672c-.16-.118-.34-.178-.54-.178-.197 0-.377.06-.537.178L4.17 10.67V4.5c0-.232.078-.428.234-.59.156-.16.35-.24.58-.24h9.58c.232 0 .43.08.59.24.16.162.24.358.24.59v6.17z"
                />
                <path
                  fill="#28A8EA"
                  d="M9.744 6.82L.234 13.676c-.156.112-.234.27-.234.474v4.35c0 .23.08.424.234.576.156.157.35.234.58.234h8.93v-6.95l-5.24 3.83c-.087.063-.19.094-.31.094-.118 0-.22-.03-.31-.094L.234 13.06V7.89l9.51 6.95 5.58-4.07V6.82h-5.58z"
                />
              </svg>
              Outlook
            </a>

            {/* Download .ics */}
            <a
              href={icalUrl}
              download={`${churchId}-calendar.ics`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Download .ics
            </a>
          </div>
        </div>

        {/* Instructions */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Subscribe to automatically receive updates when events are added or changed.
            The calendar will sync periodically with your calendar app.
          </p>
        </div>
      </div>
    </div>
  );
}
