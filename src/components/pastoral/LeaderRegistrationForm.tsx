import { useState } from 'react';
import { ChevronLeft, Plus, X, Camera } from 'lucide-react';
import type { HelpCategory } from '../../types';
import { PersonalityTraitSelector } from './PersonalityTraitSelector';
import { AVAILABLE_TRAITS, SPIRITUAL_FOCUS_OPTIONS, SUITABLE_FOR_OPTIONS, generatePersonalityDescription } from '../../utils/personaFromTraits';

const EXPERTISE_OPTIONS: { value: HelpCategory; label: string }[] = [
  { value: 'marriage', label: 'Marriage' },
  { value: 'addiction', label: 'Recovery' },
  { value: 'grief', label: 'Grief' },
  { value: 'faith-questions', label: 'Faith' },
  { value: 'crisis', label: 'Crisis' },
  { value: 'financial', label: 'Financial' },
  { value: 'anxiety-depression', label: 'Mental Health' },
  { value: 'parenting', label: 'Parenting' },
  { value: 'general', label: 'General' },
];

export interface LeaderFormData {
  displayName: string;
  title: string;
  bio: string;
  photo?: string;
  expertiseAreas: HelpCategory[];
  credentials: string[];
  yearsOfPractice?: number;
  personalityTraits: string[];
  spiritualFocusAreas: string[];
  language: string;
  sessionType: 'one-time' | 'recurring';
  sessionFrequency: string;
  suitableFor: string[];
  anchors: string;
}

interface LeaderRegistrationFormProps {
  onSubmit: (data: LeaderFormData) => void;
  onBack: () => void;
  initialData?: Partial<LeaderFormData>;
}

export function LeaderRegistrationForm({ onSubmit, onBack, initialData }: LeaderRegistrationFormProps) {
  const [form, setForm] = useState<LeaderFormData>({
    displayName: initialData?.displayName || '',
    title: initialData?.title || '',
    bio: initialData?.bio || '',
    photo: initialData?.photo,
    expertiseAreas: initialData?.expertiseAreas || [],
    credentials: initialData?.credentials || [],
    yearsOfPractice: initialData?.yearsOfPractice,
    personalityTraits: initialData?.personalityTraits || [],
    spiritualFocusAreas: initialData?.spiritualFocusAreas || [],
    language: initialData?.language || 'English',
    sessionType: initialData?.sessionType || 'one-time',
    sessionFrequency: initialData?.sessionFrequency || 'Weekly',
    suitableFor: initialData?.suitableFor || [],
    anchors: initialData?.anchors || '',
  });

  const [credentialInput, setCredentialInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim() || !form.title.trim()) return;
    onSubmit(form);
  };

  const addCredential = () => {
    if (credentialInput.trim() && !form.credentials.includes(credentialInput.trim())) {
      setForm(prev => ({ ...prev, credentials: [...prev.credentials, credentialInput.trim()] }));
      setCredentialInput('');
    }
  };

  const removeCredential = (cred: string) => {
    setForm(prev => ({ ...prev, credentials: prev.credentials.filter(c => c !== cred) }));
  };

  const toggleExpertise = (area: HelpCategory) => {
    setForm(prev => ({
      ...prev,
      expertiseAreas: prev.expertiseAreas.includes(area)
        ? prev.expertiseAreas.filter(a => a !== area)
        : [...prev.expertiseAreas, area],
    }));
  };

  const toggleSuitableFor = (group: string) => {
    setForm(prev => ({
      ...prev,
      suitableFor: prev.suitableFor.includes(group)
        ? prev.suitableFor.filter(g => g !== group)
        : [...prev.suitableFor, group],
    }));
  };

  const toggleSpiritualFocus = (area: string) => {
    setForm(prev => ({
      ...prev,
      spiritualFocusAreas: prev.spiritualFocusAreas.includes(area)
        ? prev.spiritualFocusAreas.filter(a => a !== area)
        : [...prev.spiritualFocusAreas, area],
    }));
  };

  const personalityPreview = generatePersonalityDescription(form.personalityTraits);

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 transition-colors"
      >
        <ChevronLeft size={16} />
        Back
      </button>

      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700/50">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Leader Profile Setup</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Set up your pastoral care profile and AI assistant preferences.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Photo & basic info */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {form.photo ? (
                <img src={form.photo} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
                  <Camera size={24} />
                </div>
              )}
              <input
                type="url"
                value={form.photo || ''}
                onChange={(e) => setForm(prev => ({ ...prev, photo: e.target.value || undefined }))}
                placeholder="Photo URL"
                className="mt-2 w-20 text-[10px] text-center px-1 py-0.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-500 dark:text-dark-400 rounded"
              />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm(prev => ({ ...prev, displayName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Pastor Marcus Daniels"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Senior Pastor — Marriage & Family"
                  required
                />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Theological Position / Approach</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              placeholder="Describe your counseling approach, background, and what drives your ministry..."
            />
          </div>

          {/* Expertise areas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">Areas of Expertise</label>
            <div className="flex flex-wrap gap-2">
              {EXPERTISE_OPTIONS.map(opt => {
                const isSelected = form.expertiseAreas.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleExpertise(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300 hover:bg-violet-100 dark:hover:bg-violet-500/10'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personality traits */}
          <PersonalityTraitSelector
            available={AVAILABLE_TRAITS}
            selected={form.personalityTraits}
            onChange={(traits) => setForm(prev => ({ ...prev, personalityTraits: traits }))}
            maxSelections={6}
            label="Personality Traits (select up to 6)"
          />
          {form.personalityTraits.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-dark-500 -mt-4">
              AI Personality: <span className="italic text-gray-500 dark:text-dark-400">&quot;{personalityPreview}&quot;</span>
            </p>
          )}

          {/* Spiritual focus areas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">Spiritual Focus Areas</label>
            <div className="flex flex-wrap gap-2">
              {SPIRITUAL_FOCUS_OPTIONS.map(area => {
                const isSelected = form.spiritualFocusAreas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleSpiritualFocus(area)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/10'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Anchor verse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Guiding Scripture / Anchor Verse</label>
            <input
              type="text"
              value={form.anchors}
              onChange={(e) => setForm(prev => ({ ...prev, anchors: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Bear one another's burdens — Galatians 6:2"
            />
          </div>

          {/* Suitable for */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">Suitable For</label>
            <div className="flex flex-wrap gap-2">
              {SUITABLE_FOR_OPTIONS.map(group => {
                const isSelected = form.suitableFor.includes(group);
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => toggleSuitableFor(group)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300 hover:bg-blue-100 dark:hover:bg-blue-500/10'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {group}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Session settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Session Type</label>
              <select
                value={form.sessionType}
                onChange={(e) => setForm(prev => ({ ...prev, sessionType: e.target.value as 'one-time' | 'recurring' }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="one-time">One-time</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Frequency</label>
              <select
                value={form.sessionFrequency}
                onChange={(e) => setForm(prev => ({ ...prev, sessionFrequency: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="Weekly">Weekly</option>
                <option value="Bi-weekly">Bi-weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="As needed">As needed</option>
              </select>
            </div>
          </div>

          {/* Language and years */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Language</label>
              <input
                type="text"
                value={form.language}
                onChange={(e) => setForm(prev => ({ ...prev, language: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="English"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Years of Practice</label>
              <input
                type="number"
                value={form.yearsOfPractice || ''}
                onChange={(e) => setForm(prev => ({ ...prev, yearsOfPractice: e.target.value ? parseInt(e.target.value) : undefined }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                min={0}
                placeholder="20"
              />
            </div>
          </div>

          {/* Credentials */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Education & Credentials</label>
            {form.credentials.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {form.credentials.map(cred => (
                  <span key={cred} className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-md">
                    {cred}
                    <button type="button" onClick={() => removeCredential(cred)} className="hover:text-amber-900 dark:hover:text-amber-300">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={credentialInput}
                onChange={(e) => setCredentialInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCredential())}
                placeholder="Add credential (e.g. M.Div, Certified Biblical Counselor)"
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="button"
                onClick={addCredential}
                className="px-3 py-2 bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-dark-600"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700/50">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-700 rounded-xl text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {initialData ? 'Save Changes' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
