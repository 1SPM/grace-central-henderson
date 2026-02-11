import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  X,
  Camera,
  User,
  BookOpen,
  Award,
  Users,
  FileCheck,
  Send,
} from 'lucide-react';
import { PersonalityTraitSelector } from './PersonalityTraitSelector';
import { AVAILABLE_TRAITS, SPIRITUAL_FOCUS_OPTIONS, SUITABLE_FOR_OPTIONS, generatePersonalityDescription } from '../../utils/personaFromTraits';
import type { HelpCategory, LeaderApplication, LeaderReference, OnboardingStep } from '../../types';
import { LEADER_APPLICATION_STEPS } from '../../types';

const EXPERTISE_OPTIONS: { value: HelpCategory; label: string; description: string }[] = [
  { value: 'marriage', label: 'Marriage', description: 'Couples counseling & family restoration' },
  { value: 'addiction', label: 'Recovery', description: 'Addiction recovery & support groups' },
  { value: 'grief', label: 'Grief', description: 'Bereavement & loss counseling' },
  { value: 'faith-questions', label: 'Faith', description: 'Spiritual growth & doubt navigation' },
  { value: 'crisis', label: 'Crisis', description: 'Emergency intervention & support' },
  { value: 'financial', label: 'Financial', description: 'Stewardship & financial counseling' },
  { value: 'anxiety-depression', label: 'Mental Health', description: 'Anxiety, depression & wellness' },
  { value: 'parenting', label: 'Parenting', description: 'Child-rearing & family dynamics' },
  { value: 'general', label: 'General', description: 'General pastoral guidance' },
];

export interface LeaderOnboardingData {
  displayName: string;
  title: string;
  bio: string;
  photo?: string;
  email: string;
  phone: string;
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
  references: LeaderReference[];
}

interface LeaderOnboardingWizardProps {
  onSubmit: (data: LeaderOnboardingData) => void;
  onBack: () => void;
  initialData?: Partial<LeaderOnboardingData>;
  existingApplication?: LeaderApplication;
}

const STEP_ICONS = {
  personal: User,
  expertise: BookOpen,
  credentials: Award,
  references: Users,
  review: FileCheck,
};

export function LeaderOnboardingWizard({ onSubmit, onBack, initialData, existingApplication }: LeaderOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('personal');
  const [form, setForm] = useState<LeaderOnboardingData>({
    displayName: initialData?.displayName || existingApplication?.displayName || '',
    title: initialData?.title || existingApplication?.title || '',
    bio: initialData?.bio || existingApplication?.bio || '',
    photo: initialData?.photo || existingApplication?.photo,
    email: initialData?.email || existingApplication?.email || '',
    phone: initialData?.phone || existingApplication?.phone || '',
    expertiseAreas: initialData?.expertiseAreas || existingApplication?.expertiseAreas || [],
    credentials: initialData?.credentials || existingApplication?.credentials || [],
    yearsOfPractice: initialData?.yearsOfPractice || existingApplication?.yearsOfPractice,
    personalityTraits: initialData?.personalityTraits || existingApplication?.personalityTraits || [],
    spiritualFocusAreas: initialData?.spiritualFocusAreas || existingApplication?.spiritualFocusAreas || [],
    language: initialData?.language || existingApplication?.language || 'English',
    sessionType: initialData?.sessionType || existingApplication?.sessionType || 'one-time',
    sessionFrequency: initialData?.sessionFrequency || existingApplication?.sessionFrequency || 'Weekly',
    suitableFor: initialData?.suitableFor || existingApplication?.suitableFor || [],
    anchors: initialData?.anchors || existingApplication?.anchorVerse || '',
    references: initialData?.references || existingApplication?.references || [],
  });

  const [credentialInput, setCredentialInput] = useState('');
  const [refForm, setRefForm] = useState<LeaderReference>({ name: '', relationship: '', phone: '', email: '' });
  const [showRefForm, setShowRefForm] = useState(false);

  const currentStepIndex = LEADER_APPLICATION_STEPS.findIndex(s => s.key === currentStep);

  const goNext = () => {
    if (currentStepIndex < LEADER_APPLICATION_STEPS.length - 1) {
      setCurrentStep(LEADER_APPLICATION_STEPS[currentStepIndex + 1].key);
    }
  };

  const goPrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(LEADER_APPLICATION_STEPS[currentStepIndex - 1].key);
    } else {
      onBack();
    }
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

  const addReference = () => {
    if (refForm.name.trim() && refForm.relationship.trim()) {
      setForm(prev => ({ ...prev, references: [...prev.references, { ...refForm }] }));
      setRefForm({ name: '', relationship: '', phone: '', email: '' });
      setShowRefForm(false);
    }
  };

  const removeReference = (index: number) => {
    setForm(prev => ({ ...prev, references: prev.references.filter((_, i) => i !== index) }));
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

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'personal': return !!form.displayName.trim() && !!form.title.trim();
      case 'expertise': return form.expertiseAreas.length > 0;
      case 'credentials': return true;
      case 'references': return true;
      case 'review': return !!form.displayName.trim() && !!form.title.trim() && form.expertiseAreas.length > 0;
      default: return false;
    }
  };

  const handleSubmit = () => {
    if (canProceed()) {
      onSubmit(form);
    }
  };

  const personalityPreview = generatePersonalityDescription(form.personalityTraits);

  const renderStepContent = () => {
    switch (currentStep) {
      case 'personal':
        return (
          <div className="space-y-5">
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Full Name *</label>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Ministry Title *</label>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="pastor@church.org"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

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
          </div>
        );

      case 'expertise':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-3">Areas of Expertise *</label>
              <div className="grid grid-cols-3 gap-2">
                {EXPERTISE_OPTIONS.map(opt => {
                  const isSelected = form.expertiseAreas.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleExpertise(opt.value)}
                      className={`p-3 rounded-xl text-left transition-all border ${
                        isSelected
                          ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-300 dark:border-violet-500/30'
                          : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 hover:border-violet-200 dark:hover:border-violet-500/20'
                      }`}
                    >
                      <span className={`text-sm font-medium ${isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-gray-700 dark:text-dark-300'}`}>
                        {opt.label}
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-dark-500 mt-0.5">{opt.description}</p>
                      {isSelected && (
                        <Check size={14} className="text-violet-600 dark:text-violet-400 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

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
                    >
                      {area}
                    </button>
                  );
                })}
              </div>
            </div>

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
                    >
                      {group}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'credentials':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
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
            </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Education & Credentials</label>
              {form.credentials.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {form.credentials.map(cred => (
                    <span key={cred} className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1.5 rounded-lg">
                      <Award size={12} />
                      {cred}
                      <button type="button" onClick={() => removeCredential(cred)} className="hover:text-amber-900 dark:hover:text-amber-300 ml-1">
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
          </div>
        );

      case 'references':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-dark-400">
              Add references who can vouch for your character and ministry fitness. At least 2 references are recommended.
            </p>

            {form.references.map((ref, idx) => (
              <div key={idx} className="p-4 bg-gray-50 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{ref.name}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-400">{ref.relationship}</p>
                    <div className="flex gap-3 mt-1">
                      {ref.email && <span className="text-xs text-gray-400 dark:text-dark-500">{ref.email}</span>}
                      {ref.phone && <span className="text-xs text-gray-400 dark:text-dark-500">{ref.phone}</span>}
                    </div>
                  </div>
                  <button onClick={() => removeReference(idx)} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}

            {showRefForm ? (
              <div className="p-4 bg-violet-50 dark:bg-violet-500/5 rounded-xl border border-violet-200 dark:border-violet-500/20 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-dark-400 mb-1">Name *</label>
                    <input
                      type="text"
                      value={refForm.name}
                      onChange={(e) => setRefForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-dark-400 mb-1">Relationship *</label>
                    <input
                      type="text"
                      value={refForm.relationship}
                      onChange={(e) => setRefForm(prev => ({ ...prev, relationship: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="Senior Pastor, Former Mentor"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-dark-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={refForm.email || ''}
                      onChange={(e) => setRefForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="john@church.org"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-dark-400 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={refForm.phone || ''}
                      onChange={(e) => setRefForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={addReference}
                    disabled={!refForm.name.trim() || !refForm.relationship.trim()}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Add Reference
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowRefForm(false); setRefForm({ name: '', relationship: '', phone: '', email: '' }); }}
                    className="px-4 py-2 text-gray-600 dark:text-dark-400 hover:text-gray-800 dark:hover:text-dark-200 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowRefForm(true)}
                className="w-full p-3 border-2 border-dashed border-gray-200 dark:border-dark-700 rounded-xl text-sm text-gray-500 dark:text-dark-400 hover:border-violet-300 dark:hover:border-violet-500/30 hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add Reference
              </button>
            )}
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4">
              <h4 className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-1">Ready to submit your application</h4>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Review your information below. After submission, the pastoral team will review your application.
              </p>
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-dark-800 rounded-xl">
                {form.photo ? (
                  <img src={form.photo} alt="Profile" className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold">
                    {form.displayName.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900 dark:text-dark-100">{form.displayName}</p>
                  <p className="text-sm text-gray-500 dark:text-dark-400">{form.title}</p>
                  {form.email && <p className="text-xs text-gray-400 dark:text-dark-500 mt-0.5">{form.email}</p>}
                </div>
              </div>

              {form.bio && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-1">About</h5>
                  <p className="text-sm text-gray-700 dark:text-dark-300">{form.bio}</p>
                </div>
              )}

              <div>
                <h5 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2">Expertise</h5>
                <div className="flex flex-wrap gap-1.5">
                  {form.expertiseAreas.map(area => (
                    <span key={area} className="px-2.5 py-1 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 rounded-full text-xs font-medium">
                      {EXPERTISE_OPTIONS.find(o => o.value === area)?.label || area}
                    </span>
                  ))}
                </div>
              </div>

              {form.credentials.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2">Credentials</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {form.credentials.map(cred => (
                      <span key={cred} className="px-2.5 py-1 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
                        {cred}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {form.yearsOfPractice && (
                <p className="text-sm text-gray-600 dark:text-dark-300">
                  <span className="font-medium">{form.yearsOfPractice}</span> years of ministry practice
                </p>
              )}

              {form.references.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2">References ({form.references.length})</h5>
                  <div className="space-y-1.5">
                    {form.references.map((ref, idx) => (
                      <p key={idx} className="text-sm text-gray-600 dark:text-dark-300">
                        {ref.name} <span className="text-gray-400 dark:text-dark-500">({ref.relationship})</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

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
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700/50">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Leader Application</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Apply to become a verified pastoral care leader.</p>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-dark-700/50 bg-gray-50 dark:bg-dark-850">
          <div className="flex items-center justify-between">
            {LEADER_APPLICATION_STEPS.map((step, idx) => {
              const StepIcon = STEP_ICONS[step.key];
              const isActive = step.key === currentStep;
              const isCompleted = idx < currentStepIndex;
              return (
                <div key={step.key} className="flex items-center">
                  <button
                    onClick={() => idx <= currentStepIndex && setCurrentStep(step.key)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                      isActive
                        ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300'
                        : isCompleted
                        ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/5'
                        : 'text-gray-400 dark:text-dark-500'
                    }`}
                    disabled={idx > currentStepIndex}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isActive
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-200 dark:bg-dark-700 text-gray-400 dark:text-dark-500'
                    }`}>
                      {isCompleted ? <Check size={12} /> : <StepIcon size={12} />}
                    </div>
                    <span className="text-xs font-medium hidden sm:inline">{step.label}</span>
                  </button>
                  {idx < LEADER_APPLICATION_STEPS.length - 1 && (
                    <div className={`w-6 h-px mx-1 ${
                      isCompleted ? 'bg-emerald-300 dark:bg-emerald-500/30' : 'bg-gray-200 dark:bg-dark-700'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">
              {LEADER_APPLICATION_STEPS[currentStepIndex].label}
            </h3>
            <p className="text-xs text-gray-500 dark:text-dark-400">
              {LEADER_APPLICATION_STEPS[currentStepIndex].description}
            </p>
          </div>

          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700/50 flex justify-between">
          <button
            type="button"
            onClick={goPrev}
            className="px-4 py-2.5 border border-gray-200 dark:border-dark-700 rounded-xl text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-2"
          >
            <ChevronLeft size={16} />
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </button>

          {currentStep === 'review' ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed()}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Send size={16} />
              Submit Application
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!canProceed()}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
