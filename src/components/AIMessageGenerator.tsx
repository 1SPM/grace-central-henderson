import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, Check, X } from 'lucide-react';
import {
  generateAIText,
  generateWelcomeMessage,
  generateDonationThankYou,
  generateBirthdayGreeting,
  generateFollowUpTalkingPoints,
} from '../lib/services/ai';

type MessageType = 'welcome' | 'donation' | 'birthday' | 'followup' | 'custom';

interface AIMessageGeneratorProps {
  type: MessageType;
  onAccept: (message: string) => void;
  onCancel?: () => void;
  // Context data for generation
  personName?: string;
  churchName?: string;
  // For donations
  amount?: number;
  fund?: string;
  isFirstTime?: boolean;
  // For follow-ups
  visitDate?: string;
  notes?: string;
  // For custom prompts
  customPrompt?: string;
}

export function AIMessageGenerator({
  type,
  onAccept,
  onCancel,
  personName = '',
  churchName = 'our church',
  amount,
  fund,
  isFirstTime,
  visitDate,
  notes,
  customPrompt,
}: AIMessageGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const firstName = personName.split(' ')[0] || 'friend';

  const generate = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedMessage(null);

    try {
      let result;

      switch (type) {
        case 'welcome':
          result = await generateWelcomeMessage(firstName, churchName);
          break;
        case 'donation':
          result = await generateDonationThankYou(
            firstName,
            amount || 0,
            fund || 'general',
            churchName,
            isFirstTime || false
          );
          break;
        case 'birthday':
          result = await generateBirthdayGreeting(firstName, churchName);
          break;
        case 'followup':
          result = await generateFollowUpTalkingPoints(
            personName,
            visitDate || new Date().toLocaleDateString(),
            notes
          );
          break;
        case 'custom':
          if (!customPrompt) {
            throw new Error('Custom prompt is required');
          }
          result = await generateAIText({ prompt: customPrompt });
          break;
        default:
          throw new Error('Invalid message type');
      }

      if (result.success && result.text) {
        setGeneratedMessage(result.text);
      } else {
        setError(result.error || 'Failed to generate message');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = () => {
    if (generatedMessage) {
      onAccept(generatedMessage);
      setGeneratedMessage(null);
    }
  };

  const handleCancel = () => {
    setGeneratedMessage(null);
    setError(null);
    onCancel?.();
  };

  // Initial state - show generate button
  if (!generatedMessage && !isGenerating && !error) {
    return (
      <button
        onClick={generate}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
      >
        <Sparkles size={16} />
        Generate with AI
      </button>
    );
  }

  // Loading state
  if (isGenerating) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-dark-400">
        <Loader2 size={16} className="animate-spin" />
        Generating...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-500">{error}</span>
        <button
          onClick={generate}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
          title="Try again"
        >
          <RefreshCw size={16} />
        </button>
        <button
          onClick={handleCancel}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
          title="Cancel"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  // Generated message preview
  return (
    <div className="border border-purple-200 dark:border-purple-500/30 rounded-lg p-4 bg-purple-50/50 dark:bg-purple-500/5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400">
          <Sparkles size={16} />
          AI Generated
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={generate}
            className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            title="Regenerate"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleAccept}
            className="p-1.5 text-green-500 hover:text-green-600 transition-colors"
            title="Accept"
          >
            <Check size={16} />
          </button>
          <button
            onClick={handleCancel}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-700 dark:text-dark-300 whitespace-pre-wrap">
        {generatedMessage}
      </p>
    </div>
  );
}

// Compact inline version for use in text areas
interface AIGenerateButtonProps {
  onGenerate: () => Promise<string | null>;
  onResult: (message: string) => void;
  disabled?: boolean;
}

export function AIGenerateButton({ onGenerate, onResult, disabled }: AIGenerateButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClick = async () => {
    if (disabled || isGenerating) return;

    setIsGenerating(true);
    try {
      const message = await onGenerate();
      if (message) {
        onResult(message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isGenerating}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 rounded hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Generate with AI"
    >
      {isGenerating ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Sparkles size={12} />
      )}
      {isGenerating ? 'Generating...' : 'AI'}
    </button>
  );
}
