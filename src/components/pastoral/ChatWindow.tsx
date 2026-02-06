import { useState, useRef, useEffect } from 'react';
import {
  Send,
  ArrowLeft,
  Shield,
  User,
  Bot,
  UserCheck,
  MoreVertical,
  Phone,
  Flag,
  CheckCircle,
} from 'lucide-react';
import type { PastoralConversation, PastoralMessage, LeaderProfile, MessageSender } from '../../types';

interface ChatWindowProps {
  conversation: PastoralConversation;
  leader?: LeaderProfile;
  onSendMessage: (conversationId: string, content: string) => void;
  onBack: () => void;
  onResolve?: (conversationId: string) => void;
  onEscalate?: (conversationId: string) => void;
  isLeaderView?: boolean;
}

const SENDER_CONFIG: Record<MessageSender, { icon: typeof User; label: string; color: string }> = {
  user: { icon: User, label: 'You', color: 'bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-gray-100' },
  ai: { icon: Bot, label: 'AI Assistant', color: 'bg-violet-50 dark:bg-violet-500/10 text-violet-900 dark:text-violet-100' },
  leader: { icon: UserCheck, label: 'Pastor', color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-100' },
};

function MessageBubble({ message, isOwn }: { message: PastoralMessage; isOwn: boolean }) {
  const config = SENDER_CONFIG[message.sender];
  const Icon = config.icon;
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        message.sender === 'ai'
          ? 'bg-violet-100 dark:bg-violet-500/20'
          : message.sender === 'leader'
          ? 'bg-emerald-100 dark:bg-emerald-500/20'
          : 'bg-gray-200 dark:bg-dark-600'
      }`}>
        <Icon size={14} className={
          message.sender === 'ai'
            ? 'text-violet-600 dark:text-violet-400'
            : message.sender === 'leader'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-gray-500 dark:text-gray-400'
        } />
      </div>
      <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
        <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'justify-end' : ''}`}>
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {message.senderName}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{time}</span>
        </div>
        <div className={`inline-block px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${config.color} ${
          isOwn ? 'rounded-tr-md' : 'rounded-tl-md'
        }`}>
          {message.content}
        </div>
        {message.aiConfidence !== undefined && message.aiConfidence < 0.7 && (
          <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
            <Flag size={10} />
            Low confidence — may need human review
          </p>
        )}
      </div>
    </div>
  );
}

export function ChatWindow({
  conversation,
  leader,
  onSendMessage,
  onBack,
  onResolve,
  onEscalate,
  isLeaderView = false,
}: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [showActions, setShowActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onSendMessage(conversation.id, trimmed);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const categoryLabels: Record<string, string> = {
    'marriage': 'Marriage & Relationships',
    'addiction': 'Addiction & Recovery',
    'grief': 'Grief & Loss',
    'faith-questions': 'Faith Questions',
    'crisis': 'Crisis / Urgent',
    'financial': 'Financial Help',
    'anxiety-depression': 'Anxiety & Depression',
    'parenting': 'Parenting',
    'general': 'General',
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
    crisis: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[700px] bg-white dark:bg-dark-900 rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} className="text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {conversation.isAnonymous ? 'Anonymous' : leader?.displayName || 'Conversation'}
              </h3>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${priorityColors[conversation.priority]}`}>
                {conversation.priority}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {categoryLabels[conversation.category] || conversation.category}
              {leader?.isAvailable && (
                <span className="ml-2 text-emerald-500">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  {leader.displayName} is online
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isLeaderView && onEscalate && conversation.status !== 'escalated' && (
            <button
              onClick={() => onEscalate(conversation.id)}
              className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
              title="Escalate"
            >
              <Phone size={16} />
            </button>
          )}
          {onResolve && conversation.status !== 'resolved' && (
            <button
              onClick={() => onResolve(conversation.id)}
              className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
              title="Mark resolved"
            >
              <CheckCircle size={16} />
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              <MoreVertical size={16} />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-10 py-1">
                {onResolve && (
                  <button
                    onClick={() => { onResolve(conversation.id); setShowActions(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700"
                  >
                    Mark as Resolved
                  </button>
                )}
                {isLeaderView && onEscalate && (
                  <button
                    onClick={() => { onEscalate(conversation.id); setShowActions(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700"
                  >
                    Escalate
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Privacy notice */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 py-2">
          <Shield size={12} />
          This conversation is private and confidential
        </div>

        {conversation.messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender === 'user'}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {conversation.status !== 'resolved' && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700/50 bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-dark-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none max-h-32"
              style={{ minHeight: '40px' }}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="p-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:hover:bg-violet-600 text-white rounded-xl transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {conversation.status === 'resolved' && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700/50 bg-emerald-50 dark:bg-emerald-500/5 text-center">
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1.5">
            <CheckCircle size={14} />
            This conversation has been resolved
          </p>
        </div>
      )}
    </div>
  );
}
