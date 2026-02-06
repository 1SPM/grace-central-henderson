import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Mail,
  MessageSquare,
  Users,
  Calendar,
  RefreshCw,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { Person } from '../types';
import { generateAIText } from '../lib/services/ai';
import { useAISettings } from '../hooks/useAISettings';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: AIAction[];
  isLoading?: boolean;
}

interface AIAction {
  type: 'draft_email' | 'draft_sms' | 'view_people' | 'create_task';
  label: string;
  data?: Record<string, unknown>;
}

interface AIAssistantProps {
  people: Person[];
  onClose: () => void;
  onSelectPerson?: (id: string) => void;
  onDraftEmail?: (to: Person, subject: string, body: string) => void;
  onDraftSMS?: (to: Person, message: string) => void;
}

// Quick action suggestions
const quickActions = [
  { icon: <Mail size={14} />, label: 'Draft email to visitors', prompt: 'Draft a welcome email for first-time visitors' },
  { icon: <Users size={14} />, label: 'Who needs follow-up?', prompt: 'Who needs follow-up?' },
  { icon: <Calendar size={14} />, label: 'Upcoming birthdays', prompt: 'Who has birthdays coming up this week?' },
  { icon: <MessageSquare size={14} />, label: 'Thank donors', prompt: 'Draft thank you messages for recent donors' },
];

export function AIAssistant({ people, onClose, onSelectPerson }: AIAssistantProps) {
  const { settings: aiSettings } = useAISettings();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m Grace AI. I can help you draft communications, find people, and suggest actions. What would you like to do?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show disabled state if AI assistant is turned off
  if (!aiSettings.aiAssistant) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Sparkles size={32} className="text-gray-300 dark:text-dark-600 mb-3" />
        <p className="text-gray-500 dark:text-dark-400 mb-2">AI Assistant is disabled</p>
        <p className="text-xs text-gray-400 dark:text-dark-500">Enable it in Settings → AI Features</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 text-sm text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
        >
          Close
        </button>
      </div>
    );
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const processQuery = async (query: string): Promise<{ content: string; actions?: AIAction[] }> => {
    const lowerQuery = query.toLowerCase();

    // Check for people queries
    if (lowerQuery.includes('who') || lowerQuery.includes('find') || lowerQuery.includes('list')) {
      // Birthday queries
      if (lowerQuery.includes('birthday')) {
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const upcomingBirthdays = people.filter(p => {
          if (!p.birthDate) return false;
          const bday = new Date(p.birthDate);
          const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
          return thisYearBday >= today && thisYearBday <= nextWeek;
        });

        if (upcomingBirthdays.length === 0) {
          return { content: 'No birthdays coming up in the next week.' };
        }

        const names = upcomingBirthdays.map(p => `• ${p.firstName} ${p.lastName}`).join('\n');
        return {
          content: `Found ${upcomingBirthdays.length} upcoming birthday${upcomingBirthdays.length > 1 ? 's' : ''} this week:\n\n${names}`,
          actions: upcomingBirthdays.map(p => ({
            type: 'view_people' as const,
            label: `View ${p.firstName}`,
            data: { personId: p.id },
          })),
        };
      }

      // Visitor queries
      if (lowerQuery.includes('visitor') || lowerQuery.includes('new')) {
        const visitors = people.filter(p => p.status === 'visitor');
        if (visitors.length === 0) {
          return { content: 'No visitors found in the system.' };
        }
        const names = visitors.slice(0, 5).map(p => `• ${p.firstName} ${p.lastName}`).join('\n');
        return {
          content: `Found ${visitors.length} visitor${visitors.length > 1 ? 's' : ''}:\n\n${names}${visitors.length > 5 ? `\n...and ${visitors.length - 5} more` : ''}`,
        };
      }

      // Follow-up queries - show visitors
      if (lowerQuery.includes('follow') || lowerQuery.includes('contact') || lowerQuery.includes('reach')) {
        const visitors = people.filter(p => p.status === 'visitor').slice(0, 5);

        if (visitors.length === 0) {
          return { content: 'No visitors currently need follow-up!' };
        }

        const names = visitors.map(p => `• ${p.firstName} ${p.lastName}`).join('\n');
        return {
          content: `Found ${visitors.length} visitor${visitors.length > 1 ? 's' : ''} who may need follow-up:\n\n${names}`,
          actions: visitors.map(p => ({
            type: 'view_people' as const,
            label: `View ${p.firstName}`,
            data: { personId: p.id },
          })),
        };
      }
    }

    // Draft email/message queries
    if (lowerQuery.includes('draft') || lowerQuery.includes('write') || lowerQuery.includes('email') || lowerQuery.includes('message')) {
      const context = `You are helping a church staff member. Generate a warm, professional message.

Church name: Grace Community Church
Available people in database: ${people.length}
Visitors: ${people.filter(p => p.status === 'visitor').length}
Members: ${people.filter(p => p.status === 'member').length}

User request: ${query}

Generate a message that is:
- Warm and welcoming
- Professional but not stuffy
- Appropriate for church communication
- Ready to send (include subject line if email)

Format as:
Subject: [subject line]

[message body]`;

      try {
        const result = await generateAIText({ prompt: context, maxTokens: 500 });
        const text = result.success && result.text ? result.text : 'Sorry, I couldn\'t generate the message.';
        return {
          content: text,
          actions: [
            { type: 'draft_email' as const, label: 'Use as Email', data: { content: text } },
          ],
        };
      } catch {
        return { content: 'Sorry, I couldn\'t generate the message. Please try again.' };
      }
    }

    // Thank you messages
    if (lowerQuery.includes('thank') && (lowerQuery.includes('donor') || lowerQuery.includes('giving') || lowerQuery.includes('donation'))) {
      const context = `Generate a heartfelt thank you message for church donors. Keep it warm, grateful, and under 150 words. Include a subject line.`;

      try {
        const result = await generateAIText({ prompt: context, maxTokens: 300 });
        const text = result.success && result.text ? result.text : 'Sorry, I couldn\'t generate the message.';
        return {
          content: text,
          actions: [
            { type: 'draft_email' as const, label: 'Use as Email', data: { content: text } },
          ],
        };
      } catch {
        return { content: 'Sorry, I couldn\'t generate the message. Please try again.' };
      }
    }

    // General AI query
    const context = `You are Grace AI, an assistant for a church CRM. Help the user with their request.

Church database has:
- ${people.length} total people
- ${people.filter(p => p.status === 'visitor').length} visitors
- ${people.filter(p => p.status === 'member').length} members
- ${people.filter(p => p.status === 'regular').length} regulars

User: ${query}

Provide a helpful, concise response. If they're asking for something you can't do, suggest what you CAN help with (drafting messages, finding people, suggesting follow-ups).`;

    try {
      const result = await generateAIText({ prompt: context, maxTokens: 400 });
      const text = result.success && result.text ? result.text : 'Sorry, I encountered an error. Please try again.';
      return { content: text };
    } catch {
      return { content: 'Sorry, I encountered an error. Please try again or rephrase your question.' };
    }
  };

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add loading message
    const loadingId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: loadingId, role: 'assistant', content: '', isLoading: true }]);

    const response = await processQuery(query);

    // Replace loading message with response
    setMessages(prev => prev.map(m =>
      m.id === loadingId
        ? { ...m, content: response.content, actions: response.actions, isLoading: false }
        : m
    ));

    setIsLoading(false);
  };

  const handleActionClick = (action: AIAction) => {
    if (action.type === 'view_people' && action.data?.personId && onSelectPerson) {
      onSelectPerson(action.data.personId as string);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-16 px-4">
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-dark-100">Grace AI</h2>
              <p className="text-xs text-gray-500 dark:text-dark-400">Draft messages, find people, get suggestions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 dark:bg-dark-800 text-gray-900 dark:text-dark-100'
                }`}
              >
                {message.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                    {/* Actions */}
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions.map((action, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleActionClick(action)}
                            className="text-xs px-3 py-1.5 bg-white/20 dark:bg-dark-700 hover:bg-white/30 dark:hover:bg-dark-600 rounded-lg transition-colors"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Copy button for assistant messages */}
                    {message.role === 'assistant' && message.content && !message.isLoading && (
                      <button
                        onClick={() => handleCopy(message.content, message.id)}
                        className="mt-2 text-xs flex items-center gap-1 text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200"
                      >
                        {copiedId === message.id ? (
                          <>
                            <Check size={12} />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            Copy
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-gray-500 dark:text-dark-400 mb-2">Try these:</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmit(action.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 dark:bg-dark-800 text-gray-700 dark:text-dark-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-dark-700">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(input);
            }}
            className="flex items-center gap-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything... (e.g., 'Draft a welcome email')"
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-gray-400 dark:placeholder:text-dark-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMessages([messages[0]])}
              className="p-3 bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-dark-400 rounded-xl hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors"
              title="Start over"
            >
              <RefreshCw size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Compact button to trigger AI suggestions (for use in other components)
interface AISuggestButtonProps {
  onGenerate: (text: string) => void;
  context: {
    type: 'email' | 'sms' | 'note';
    person: Person;
    purpose?: string;
  };
  className?: string;
}

export function AISuggestButton({ onGenerate, context, className = '' }: AISuggestButtonProps) {
  const { settings: aiSettings } = useAISettings();
  const [isLoading, setIsLoading] = useState(false);

  // Don't render if message composer is disabled
  if (!aiSettings.messageComposer) {
    return null;
  }

  const handleGenerate = async () => {
    setIsLoading(true);

    const prompts: Record<string, string> = {
      email: `Write a friendly, professional email for ${context.person.firstName} ${context.person.lastName}.
Status: ${context.person.status}
${context.purpose ? `Purpose: ${context.purpose}` : 'Purpose: General check-in'}
${context.person.notes ? `Notes about them: ${context.person.notes}` : ''}

Generate a warm, personalized email. Include a subject line. Keep it under 150 words.`,

      sms: `Write a brief, friendly text message for ${context.person.firstName}.
Status: ${context.person.status}
${context.purpose ? `Purpose: ${context.purpose}` : 'Purpose: Check-in'}

Keep it under 160 characters. Be warm but concise.`,

      note: `Suggest talking points for a conversation with ${context.person.firstName} ${context.person.lastName}.
Status: ${context.person.status}
${context.person.notes ? `Notes: ${context.person.notes}` : ''}

Give 3-4 bullet points for conversation topics.`,
    };

    try {
      const result = await generateAIText({
        prompt: prompts[context.type],
        maxTokens: context.type === 'sms' ? 100 : 300
      });
      if (result.success && result.text) {
        onGenerate(result.text);
      }
    } catch {
      // Silently fail - button will just stop loading
    }

    setIsLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={isLoading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-500/20 disabled:opacity-50 transition-colors ${className}`}
    >
      {isLoading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Sparkles size={12} />
      )}
      {isLoading ? 'Generating...' : 'AI Suggest'}
    </button>
  );
}
