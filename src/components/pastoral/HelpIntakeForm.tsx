import { useState } from 'react';
import {
  Heart,
  Link2,
  CloudRain,
  BookOpen,
  AlertTriangle,
  DollarSign,
  Brain,
  Baby,
  MessageCircle,
  Shield,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react';
import type { HelpCategory } from '../../types';

interface HelpIntakeFormProps {
  onSubmit: (request: {
    category: HelpCategory;
    description?: string;
    isAnonymous: boolean;
  }) => void;
  onBack?: () => void;
  churchName?: string;
}

const CATEGORIES: { id: HelpCategory; label: string; icon: typeof Heart; description: string; color: string }[] = [
  { id: 'marriage', label: 'Marriage & Relationships', icon: Heart, description: 'Relationship guidance & support', color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' },
  { id: 'addiction', label: 'Addiction & Recovery', icon: Link2, description: 'Freedom from substance & behavioral addiction', color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' },
  { id: 'grief', label: 'Grief & Loss', icon: CloudRain, description: 'Support through loss and mourning', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' },
  { id: 'faith-questions', label: 'Faith Questions', icon: BookOpen, description: 'Exploring faith, doubt, and spiritual growth', color: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20' },
  { id: 'crisis', label: 'Crisis / Urgent', icon: AlertTriangle, description: 'Immediate help for an urgent situation', color: 'text-red-600 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' },
  { id: 'financial', label: 'Financial Help', icon: DollarSign, description: 'Financial counseling & assistance', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' },
  { id: 'anxiety-depression', label: 'Anxiety & Depression', icon: Brain, description: 'Mental health support & encouragement', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20' },
  { id: 'parenting', label: 'Parenting', icon: Baby, description: 'Parenting guidance & family support', color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20' },
  { id: 'general', label: 'Something Else', icon: MessageCircle, description: 'General pastoral support & conversation', color: 'text-gray-500 bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20' },
];

export function HelpIntakeForm({ onSubmit, onBack, churchName = 'Our Church' }: HelpIntakeFormProps) {
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null);
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [step, setStep] = useState<'category' | 'details'>('category');

  const handleCategorySelect = (category: HelpCategory) => {
    setSelectedCategory(category);
    setStep('details');
  };

  const handleSubmit = () => {
    if (!selectedCategory) return;
    onSubmit({
      category: selectedCategory,
      description: description.trim() || undefined,
      isAnonymous,
    });
  };

  const selectedCategoryData = CATEGORIES.find(c => c.id === selectedCategory);

  if (step === 'details' && selectedCategoryData) {
    const Icon = selectedCategoryData.icon;
    return (
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => setStep('category')}
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
        >
          <ChevronLeft size={16} />
          Change category
        </button>

        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-6 border ${selectedCategoryData.color}`}>
          <Icon size={14} />
          {selectedCategoryData.label}
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tell us a bit more <span className="text-gray-400 dark:text-gray-500">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share as much or as little as you'd like. This helps us connect you with the right person..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-md border-2 transition-colors ${
                isAnonymous
                  ? 'bg-violet-600 border-violet-600'
                  : 'border-gray-300 dark:border-gray-600 group-hover:border-gray-400'
              }`}>
                {isAnonymous && (
                  <svg className="w-full h-full text-white p-0.5" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">I'd like to remain anonymous</span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                You'll receive a private ID so you can continue the conversation without sharing personal info.
              </p>
            </div>
          </label>

          <button
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl transition-colors shadow-sm"
          >
            Start Conversation
            <ArrowRight size={18} />
          </button>

          <div className="flex items-center gap-2 justify-center text-xs text-gray-400 dark:text-gray-500">
            <Shield size={12} />
            Private & confidential — you'll be connected with a trained care leader
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
        >
          <ChevronLeft size={16} />
          Back
        </button>
      )}

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          How Can We Help?
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          {churchName} is here for you — 24/7, confidential support. Select what best describes your situation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={`flex flex-col items-center text-center p-5 rounded-xl border-2 transition-all hover:scale-[1.02] hover:shadow-md ${cat.color} border-transparent hover:border-current`}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                <Icon size={22} />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{cat.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{cat.description}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center gap-2 justify-center text-xs text-gray-400 dark:text-gray-500">
        <Shield size={12} />
        All conversations are private and confidential
      </div>
    </div>
  );
}
