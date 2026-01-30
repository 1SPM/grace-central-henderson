import { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  Users,
  User,
  Search,
  Check,
  ChevronDown,
  FileText,
  Sparkles,
  Loader2,
  Copy,
  Paperclip,
  Bold,
  Italic,
  Link,
  List,
  AlertCircle,
} from 'lucide-react';
import type { Person, SmallGroup } from '../types';

interface EmailSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  groups: SmallGroup[];
  preselectedRecipients?: string[]; // Person IDs
  preselectedGroup?: string; // Group ID
  onSendEmail?: (data: {
    recipients: string[];
    subject: string;
    body: string;
    replyTo?: string;
  }) => Promise<void>;
}

type RecipientType = 'individual' | 'group' | 'custom';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

// Sample templates
const QUICK_TEMPLATES: EmailTemplate[] = [
  {
    id: 'welcome',
    name: 'Welcome Message',
    subject: 'Welcome to {{church_name}}!',
    body: `Dear {{first_name}},

Welcome to our church family! We're so glad you've joined us.

We'd love to help you get connected. Here are a few ways to get involved:
- Join a small group
- Attend our newcomers lunch
- Explore volunteer opportunities

If you have any questions, please don't hesitate to reach out.

Blessings,
{{sender_name}}`,
  },
  {
    id: 'event-invite',
    name: 'Event Invitation',
    subject: 'You\'re Invited: {{event_name}}',
    body: `Hi {{first_name}},

You're invited to {{event_name}}!

📅 Date: [Event Date]
📍 Location: [Event Location]
⏰ Time: [Event Time]

We hope you can make it. Please let us know if you plan to attend.

See you there!
{{sender_name}}`,
  },
  {
    id: 'follow-up',
    name: 'Follow-Up',
    subject: 'Following up with you',
    body: `Hi {{first_name}},

I wanted to follow up after our conversation. It was great connecting with you!

[Add your personal note here]

Please let me know if you have any questions or if there's anything I can help with.

Blessings,
{{sender_name}}`,
  },
  {
    id: 'reminder',
    name: 'Gentle Reminder',
    subject: 'Friendly Reminder',
    body: `Hi {{first_name}},

Just a friendly reminder about [topic].

If you have any questions, feel free to reach out.

Best,
{{sender_name}}`,
  },
];

export function EmailSidebar({
  isOpen,
  onClose,
  people,
  groups,
  preselectedRecipients = [],
  preselectedGroup,
  onSendEmail,
}: EmailSidebarProps) {
  const [recipientType, setRecipientType] = useState<RecipientType>(
    preselectedGroup ? 'group' : preselectedRecipients.length > 0 ? 'individual' : 'individual'
  );
  const [selectedPeople, setSelectedPeople] = useState<string[]>(preselectedRecipients);
  const [selectedGroup, setSelectedGroup] = useState<string>(preselectedGroup || '');
  const [customEmails, setCustomEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPeopleDropdown, setShowPeopleDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Reset form when sidebar opens with new preselections
  useEffect(() => {
    if (isOpen) {
      if (preselectedGroup) {
        setRecipientType('group');
        setSelectedGroup(preselectedGroup);
        setSelectedPeople([]);
      } else if (preselectedRecipients.length > 0) {
        setRecipientType('individual');
        setSelectedPeople(preselectedRecipients);
        setSelectedGroup('');
      }
    }
  }, [isOpen, preselectedRecipients, preselectedGroup]);

  // Filter people based on search
  const filteredPeople = people.filter((p) =>
    `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get recipients count and emails
  const getRecipientInfo = () => {
    if (recipientType === 'individual') {
      const selectedPersons = people.filter((p) => selectedPeople.includes(p.id));
      return {
        count: selectedPersons.length,
        emails: selectedPersons.map((p) => p.email).filter(Boolean),
      };
    } else if (recipientType === 'group') {
      const group = groups.find((g) => g.id === selectedGroup);
      if (group) {
        const groupMembers = people.filter((p) => group.members.includes(p.id));
        return {
          count: groupMembers.length,
          emails: groupMembers.map((p) => p.email).filter(Boolean),
        };
      }
      return { count: 0, emails: [] };
    } else {
      const emails = customEmails
        .split(/[,;\n]/)
        .map((e) => e.trim())
        .filter((e) => e && e.includes('@'));
      return { count: emails.length, emails };
    }
  };

  const recipientInfo = getRecipientInfo();

  const togglePerson = (personId: string) => {
    setSelectedPeople((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    );
  };

  const applyTemplate = (template: EmailTemplate) => {
    setSubject(template.subject);
    setBody(template.body);
    setShowTemplates(false);
  };

  const replaceMergeTags = (text: string) => {
    // Replace common merge tags with placeholders for preview
    return text
      .replace(/\{\{first_name\}\}/g, '[First Name]')
      .replace(/\{\{last_name\}\}/g, '[Last Name]')
      .replace(/\{\{church_name\}\}/g, 'Grace Community Church')
      .replace(/\{\{sender_name\}\}/g, 'Church Staff')
      .replace(/\{\{event_name\}\}/g, '[Event Name]');
  };

  const handleSend = async () => {
    if (recipientInfo.count === 0 || !subject.trim() || !body.trim()) {
      return;
    }

    setIsSending(true);
    try {
      if (onSendEmail) {
        await onSendEmail({
          recipients: recipientInfo.emails,
          subject,
          body,
        });
      } else {
        // Simulate sending
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Reset form after successful send
      setSubject('');
      setBody('');
      setSelectedPeople([]);
      setSelectedGroup('');
      setCustomEmails('');
      onClose();
    } catch (error) {
      console.error('Failed to send email:', error);
    } finally {
      setIsSending(false);
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    // Simulate AI generation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate based on prompt
    const generatedSubject = `${aiPrompt.split(' ').slice(0, 5).join(' ')}...`;
    const generatedBody = `Dear {{first_name}},

${aiPrompt}

We look forward to connecting with you soon.

Blessings,
{{sender_name}}`;

    setSubject(generatedSubject);
    setBody(generatedBody);
    setIsGenerating(false);
    setShowAiAssist(false);
    setAiPrompt('');
  };

  const insertFormatting = (format: 'bold' | 'italic' | 'link' | 'list') => {
    const formatMap = {
      bold: '**text**',
      italic: '_text_',
      link: '[link text](url)',
      list: '\n- Item 1\n- Item 2\n- Item 3',
    };
    setBody((prev) => prev + formatMap[format]);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-dark-900 shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-2">
            <Mail className="text-violet-600" size={20} />
            <h2 className="font-semibold text-gray-900 dark:text-dark-100">Compose Email</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Recipient Type Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-dark-800 rounded-xl">
            <button
              onClick={() => setRecipientType('individual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                recipientType === 'individual'
                  ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 shadow-sm'
                  : 'text-gray-500 dark:text-dark-400 hover:text-gray-700'
              }`}
            >
              <User size={16} />
              People
            </button>
            <button
              onClick={() => setRecipientType('group')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                recipientType === 'group'
                  ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 shadow-sm'
                  : 'text-gray-500 dark:text-dark-400 hover:text-gray-700'
              }`}
            >
              <Users size={16} />
              Groups
            </button>
            <button
              onClick={() => setRecipientType('custom')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                recipientType === 'custom'
                  ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 shadow-sm'
                  : 'text-gray-500 dark:text-dark-400 hover:text-gray-700'
              }`}
            >
              <Mail size={16} />
              Custom
            </button>
          </div>

          {/* Recipients Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
              To
            </label>

            {recipientType === 'individual' && (
              <div className="relative">
                <button
                  onClick={() => setShowPeopleDropdown(!showPeopleDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-left"
                >
                  <span className={selectedPeople.length === 0 ? 'text-gray-400' : 'text-gray-900 dark:text-dark-100'}>
                    {selectedPeople.length === 0
                      ? 'Select recipients...'
                      : `${selectedPeople.length} people selected`}
                  </span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>

                {showPeopleDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl shadow-lg max-h-64 overflow-hidden">
                    <div className="p-2 border-b border-gray-100 dark:border-dark-700">
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search people..."
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-dark-600 rounded-lg bg-gray-50 dark:bg-dark-700"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredPeople.filter(p => p.email).map((person) => (
                        <button
                          key={person.id}
                          onClick={() => togglePerson(person.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              selectedPeople.includes(person.id)
                                ? 'bg-violet-600 border-violet-600'
                                : 'border-gray-300 dark:border-dark-500'
                            }`}
                          >
                            {selectedPeople.includes(person.id) && (
                              <Check size={12} className="text-white" />
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                              {person.firstName} {person.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{person.email}</p>
                          </div>
                        </button>
                      ))}
                      {filteredPeople.filter(p => p.email).length === 0 && (
                        <p className="px-3 py-4 text-sm text-gray-500 text-center">
                          No people with email addresses found
                        </p>
                      )}
                    </div>
                    <div className="p-2 border-t border-gray-100 dark:border-dark-700 flex justify-end">
                      <button
                        onClick={() => setShowPeopleDropdown(false)}
                        className="px-3 py-1.5 text-sm font-medium text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}

                {/* Selected people pills */}
                {selectedPeople.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedPeople.slice(0, 5).map((id) => {
                      const person = people.find((p) => p.id === id);
                      if (!person) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs rounded-full"
                        >
                          {person.firstName} {person.lastName}
                          <button
                            onClick={() => togglePerson(id)}
                            className="hover:text-violet-900 dark:hover:text-violet-100"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                    {selectedPeople.length > 5 && (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300 text-xs rounded-full">
                        +{selectedPeople.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {recipientType === 'group' && (
              <div className="relative">
                <button
                  onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-left"
                >
                  <span className={!selectedGroup ? 'text-gray-400' : 'text-gray-900 dark:text-dark-100'}>
                    {selectedGroup
                      ? groups.find((g) => g.id === selectedGroup)?.name
                      : 'Select a group...'}
                  </span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>

                {showGroupDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {groups.filter(g => g.isActive).map((group) => {
                      const memberCount = group.members.length;
                      const emailCount = people.filter(
                        (p) => group.members.includes(p.id) && p.email
                      ).length;
                      return (
                        <button
                          key={group.id}
                          onClick={() => {
                            setSelectedGroup(group.id);
                            setShowGroupDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors ${
                            selectedGroup === group.id ? 'bg-violet-50 dark:bg-violet-500/10' : ''
                          }`}
                        >
                          <Users size={16} className="text-gray-400" />
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                              {group.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {emailCount} of {memberCount} members have email
                            </p>
                          </div>
                          {selectedGroup === group.id && (
                            <Check size={16} className="text-violet-600" />
                          )}
                        </button>
                      );
                    })}
                    {groups.filter(g => g.isActive).length === 0 && (
                      <p className="px-3 py-4 text-sm text-gray-500 text-center">
                        No active groups
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {recipientType === 'custom' && (
              <textarea
                value={customEmails}
                onChange={(e) => setCustomEmails(e.target.value)}
                placeholder="Enter email addresses (comma or line separated)"
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-sm resize-none h-24"
              />
            )}

            {/* Recipient count */}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-dark-400">
              {recipientInfo.count} recipient{recipientInfo.count !== 1 ? 's' : ''} will receive this email
            </p>
          </div>

          {/* Subject */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-dark-300">
                Subject
              </label>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
              >
                <FileText size={12} />
                Templates
              </button>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-sm"
            />

            {/* Templates dropdown */}
            {showTemplates && (
              <div className="mt-2 p-2 bg-gray-50 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
                <p className="text-xs font-medium text-gray-500 dark:text-dark-400 mb-2 px-1">
                  Quick Templates
                </p>
                <div className="space-y-1">
                  {QUICK_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="w-full flex items-center gap-2 px-2 py-2 text-sm text-left rounded-lg hover:bg-white dark:hover:bg-dark-700 transition-colors"
                    >
                      <FileText size={14} className="text-gray-400" />
                      <span className="text-gray-700 dark:text-dark-300">{template.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Message Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-dark-300">
                Message
              </label>
              <button
                onClick={() => setShowAiAssist(!showAiAssist)}
                className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
              >
                <Sparkles size={12} />
                AI Assist
              </button>
            </div>

            {/* AI Assist Panel */}
            {showAiAssist && (
              <div className="mb-2 p-3 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 rounded-xl border border-violet-200 dark:border-violet-500/20">
                <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-2">
                  Describe what you want to write:
                </p>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., A warm invitation to our upcoming Easter service..."
                  className="w-full px-3 py-2 text-sm border border-violet-200 dark:border-violet-500/30 rounded-lg bg-white dark:bg-dark-800 resize-none h-16"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={generateWithAI}
                    disabled={!aiPrompt.trim() || isGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Generate
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Formatting toolbar */}
            <div className="flex items-center gap-1 mb-1.5 p-1 bg-gray-50 dark:bg-dark-800 rounded-lg">
              <button
                onClick={() => insertFormatting('bold')}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-dark-700 rounded"
                title="Bold"
              >
                <Bold size={14} className="text-gray-500" />
              </button>
              <button
                onClick={() => insertFormatting('italic')}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-dark-700 rounded"
                title="Italic"
              >
                <Italic size={14} className="text-gray-500" />
              </button>
              <button
                onClick={() => insertFormatting('link')}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-dark-700 rounded"
                title="Link"
              >
                <Link size={14} className="text-gray-500" />
              </button>
              <button
                onClick={() => insertFormatting('list')}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-dark-700 rounded"
                title="List"
              >
                <List size={14} className="text-gray-500" />
              </button>
              <div className="flex-1" />
              <button
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-dark-700 rounded opacity-50 cursor-not-allowed"
                title="Attach file (coming soon)"
                disabled
              >
                <Paperclip size={14} className="text-gray-500" />
              </button>
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-sm resize-none h-48"
            />

            {/* Merge tags hint */}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-dark-400">
              Use merge tags: {'{{first_name}}'}, {'{{last_name}}'}, {'{{church_name}}'}
            </p>
          </div>

          {/* Preview */}
          {(subject || body) && (
            <div className="p-3 bg-gray-50 dark:bg-dark-800 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 dark:text-dark-400">Preview</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
                  }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <Copy size={12} />
                  Copy
                </button>
              </div>
              <p className="text-sm font-medium text-gray-800 dark:text-dark-200 mb-1">
                {replaceMergeTags(subject) || '(No subject)'}
              </p>
              <p className="text-sm text-gray-600 dark:text-dark-300 whitespace-pre-wrap line-clamp-4">
                {replaceMergeTags(body) || '(No message)'}
              </p>
            </div>
          )}

          {/* Warning if no recipients */}
          {recipientInfo.count === 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
              <AlertCircle size={16} className="text-amber-500 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Please select at least one recipient to send this email.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-dark-700 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={recipientInfo.count === 0 || !subject.trim() || !body.trim() || isSending}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={16} />
                Send Email
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
