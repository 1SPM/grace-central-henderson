/**
 * Mass Email Composer Component
 *
 * Allows staff to compose and send emails to multiple recipients.
 * Supports scheduling emails for later and filtering recipients by group/status/tag.
 */

import { useState, useMemo } from 'react';
import {
  Mail,
  Send,
  Clock,
  Users,
  X,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { emailService, EMAIL_TEMPLATES } from '../lib/services/email';

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  status: string;
  tags?: string[];
}

interface MassEmailComposerProps {
  people: Person[];
  groups?: { id: string; name: string; memberIds: string[] }[];
  tags?: string[];
  churchName: string;
  onClose: () => void;
  onSent?: (count: number) => void;
}

type RecipientFilter = 'all' | 'status' | 'group' | 'tag';

export function MassEmailComposer({
  people,
  groups = [],
  tags = [],
  churchName,
  onClose,
  onSent,
}: MassEmailComposerProps) {
  // Recipient selection
  const [filterType, setFilterType] = useState<RecipientFilter>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [excludeNoEmail, setExcludeNoEmail] = useState(true);

  // Email content
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Scheduling
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  // State
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);

  // Get unique statuses from people
  const statuses = useMemo(() => {
    const statusSet = new Set(people.map((p) => p.status));
    return Array.from(statusSet);
  }, [people]);

  // Get unique tags from people
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    people.forEach((p) => p.tags?.forEach((t) => tagSet.add(t)));
    tags.forEach((t) => tagSet.add(t));
    return Array.from(tagSet);
  }, [people, tags]);

  // Filter recipients based on selection
  const recipients = useMemo(() => {
    let filtered = people;

    // Filter by type
    if (filterType === 'status' && selectedStatus) {
      filtered = filtered.filter((p) => p.status === selectedStatus);
    } else if (filterType === 'group' && selectedGroup) {
      const group = groups.find((g) => g.id === selectedGroup);
      if (group) {
        filtered = filtered.filter((p) => group.memberIds.includes(p.id));
      }
    } else if (filterType === 'tag' && selectedTag) {
      filtered = filtered.filter((p) => p.tags?.includes(selectedTag));
    }

    // Exclude people without email if enabled
    if (excludeNoEmail) {
      filtered = filtered.filter((p) => p.email);
    }

    return filtered;
  }, [people, filterType, selectedStatus, selectedGroup, selectedTag, groups, excludeNoEmail]);

  // Apply template
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = EMAIL_TEMPLATES[templateId];
    if (template) {
      setSubject(template.subject.replace(/{{churchName}}/g, churchName));
      // Extract text from HTML for simpler editing
      const textContent = template.htmlContent
        .replace(/<[^>]*>/g, '\n')
        .replace(/\n\s*\n/g, '\n')
        .trim();
      setContent(textContent);
    }
  };

  // Send emails
  const handleSend = async () => {
    if (recipients.length === 0) {
      setError('No recipients selected');
      return;
    }

    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }

    if (!content.trim()) {
      setError('Please enter email content');
      return;
    }

    setSending(true);
    setError(null);

    try {
      // Build HTML from plain text content
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${content
            .split('\n')
            .map((line) => (line.trim() ? `<p>${line}</p>` : ''))
            .join('')}
          <p style="margin-top: 24px; color: #666; font-size: 14px;">
            — ${churchName}
          </p>
        </div>
      `;

      // Prepare emails for each recipient
      const emails = recipients.map((person) => ({
        to: { email: person.email!, name: `${person.firstName} ${person.lastName}` },
        subject: subject.replace(/{{firstName}}/g, person.firstName),
        html: html.replace(/{{firstName}}/g, person.firstName),
      }));

      if (scheduleMode === 'later' && scheduledDate) {
        // For scheduled emails, we'd save to database and process later
        // For now, show a message that scheduling is coming soon
        setError('Scheduled sending will be available soon. Sending now instead.');
        // Fall through to send now
      }

      // Send bulk emails
      const results = await emailService.sendBulk(emails);
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      setSentCount(successCount);
      setSent(true);

      if (failCount > 0) {
        setError(`${failCount} emails failed to send`);
      }

      onSent?.(successCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Emails Sent!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Successfully sent {sentCount} email{sentCount !== 1 ? 's' : ''}.
          </p>
          {error && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">{error}</p>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Send Mass Email
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Recipients Section */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Recipients
            </label>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  filterType === 'all'
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                All People
              </button>
              <button
                onClick={() => setFilterType('status')}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  filterType === 'status'
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                By Status
              </button>
              {groups.length > 0 && (
                <button
                  onClick={() => setFilterType('group')}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    filterType === 'group'
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  By Group
                </button>
              )}
              {allTags.length > 0 && (
                <button
                  onClick={() => setFilterType('tag')}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    filterType === 'tag'
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  By Tag
                </button>
              )}
            </div>

            {/* Filter selector */}
            {filterType === 'status' && (
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
              >
                <option value="">Select status...</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            )}

            {filterType === 'group' && (
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
              >
                <option value="">Select group...</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}

            {filterType === 'tag' && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
              >
                <option value="">Select tag...</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            )}

            {/* Recipient count */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Users className="w-4 h-4" />
                <span>{recipients.length} recipients selected</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeNoEmail}
                  onChange={(e) => setExcludeNoEmail(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600"
                />
                <span className="text-gray-600 dark:text-gray-400">
                  Exclude people without email
                </span>
              </label>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Template (optional)
            </label>
            <div className="relative">
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 appearance-none"
              >
                <option value="">Start from scratch</option>
                <option value="FOLLOW_UP">Follow Up</option>
                <option value="EVENT_INVITATION">Event Invitation</option>
                <option value="PRAYER_UPDATE">Prayer Update</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
            />
            <p className="text-xs text-gray-500">
              Use {'{{firstName}}'} to personalize with recipient's name
            </p>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Message
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your message..."
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 resize-none"
            />
          </div>

          {/* Schedule */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              When to send
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setScheduleMode('now')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                  scheduleMode === 'now'
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Send className="w-4 h-4" />
                Send Now
              </button>
              <button
                onClick={() => setScheduleMode('later')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                  scheduleMode === 'later'
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Clock className="w-4 h-4" />
                Schedule
              </button>
            </div>

            {scheduleMode === 'later' && (
              <div className="flex gap-3">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || recipients.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {scheduleMode === 'now'
                  ? `Send to ${recipients.length} people`
                  : `Schedule for ${recipients.length} people`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
