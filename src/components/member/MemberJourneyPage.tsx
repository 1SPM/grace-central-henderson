/**
 * MemberJourneyPage — "My Journey" tab in the member portal.
 *
 * Tabs: Journal · Growth · Bible Study · Activity · Goals
 *
 * Data flows:
 *   Admin (DiscipleshipTimeline) → discipleship_milestones (Supabase)
 *                                         ↓
 *   Member (MemberJourneyPage) ← reads own rows (Growth tab)
 *
 * Portal activity events fired here:
 *   journey_view           — on mount
 *   journal_entry          — member saves a reflection
 *   mood_check             — member logs a mood
 *   bible_study            — member marks a study session
 *   milestone_step_request — member taps a next-step CTA (Growth tab)
 */

import { useEffect, useState, useMemo } from 'react';
import {
  BookOpen, Droplets, Users, Heart, Crown, DoorOpen,
  Check, ChevronRight, Star, MapPin,
  Smile, Frown, Meh, Sun, CloudRain, Zap,
  PenLine, Clock, Flame, BarChart3, Target, Gift,
  BookMarked, TrendingUp, Calendar, Activity,
} from 'lucide-react';
import type { DiscipleshipMilestone, MilestoneType, Person, Giving } from '../../types';
import { DEFAULT_MILESTONE_DEFINITIONS } from '../../types';
import { logMemberActivity } from '../../lib/services/memberActivity';

// ─── Types ─────────────────────────────────────────────────────────────────

interface JournalEntry {
  id: string;
  date: string;
  prompt: string;
  body: string;
  mood: string;
}

interface BibleStudy {
  id: string;
  title: string;
  description: string;
  sessions: number;
  completed: boolean;
  progress: number; // 0-100
}

type JourneyTab = 'journal' | 'growth' | 'bible' | 'activity' | 'goals';
type JournalMode = 'write' | 'history';

interface MemberJourneyPageProps {
  milestones: DiscipleshipMilestone[];
  member?: Person | null;
  personId?: string | null;
  churchId?: string;
  giving?: Giving[];
}

// ─── Static Data ───────────────────────────────────────────────────────────

const MILESTONE_ICONS: Record<MilestoneType, typeof DoorOpen> = {
  first_visit: DoorOpen,
  attended_class: BookOpen,
  baptized: Droplets,
  joined_group: Users,
  serving: Heart,
  leading: Crown,
};

const MILESTONE_GRADIENTS: Record<MilestoneType, string> = {
  first_visit: 'from-blue-500 to-blue-600',
  attended_class: 'from-slate-500 to-slate-600',
  baptized: 'from-cyan-500 to-cyan-600',
  joined_group: 'from-green-500 to-green-600',
  serving: 'from-amber-500 to-amber-600',
  leading: 'from-rose-500 to-rose-600',
};

const STEP_ENCOURAGEMENT: Record<MilestoneType, { description: string; cta: string }> = {
  first_visit: {
    description: 'Every great journey begins with a single step. Welcome!',
    cta: "I've attended",
  },
  attended_class: {
    description: 'Our membership class helps you connect, grow, and find your place in the GRACE family.',
    cta: "I'd like to attend a class",
  },
  baptized: {
    description: 'Baptism is a public declaration of your faith — a beautiful milestone in your walk with God.',
    cta: "I'm interested in baptism",
  },
  joined_group: {
    description: 'Small groups are where real community happens. Find your people.',
    cta: 'Help me find a group',
  },
  serving: {
    description: 'Using your gifts to serve is one of the most meaningful ways to grow.',
    cta: 'I want to serve',
  },
  leading: {
    description: 'As you lead others, you multiply the impact of everything God has done in your life.',
    cta: 'I feel called to lead',
  },
};

const DAILY_PROMPTS = [
  { tag: 'Gratitude', text: 'What is one thing that challenged your faith this week, and how did you respond?' },
  { tag: 'Reflection', text: 'Where did you notice God\'s presence in an unexpected place today?' },
  { tag: 'Growth', text: 'What is one area of your life where you sense God calling you to step forward?' },
  { tag: 'Community', text: 'Who in your circle needs encouragement right now? How can you reach out?' },
  { tag: 'Purpose', text: 'How have your unique gifts been used to serve others this month?' },
];

const MOODS = [
  { id: 'joyful', label: 'Joyful', icon: Sun, color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' },
  { id: 'peaceful', label: 'Peaceful', icon: Smile, color: 'text-green-500 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30' },
  { id: 'hopeful', label: 'Hopeful', icon: Zap, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30' },
  { id: 'neutral', label: 'Neutral', icon: Meh, color: 'text-gray-500 bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/30' },
  { id: 'struggling', label: 'Struggling', icon: CloudRain, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30' },
  { id: 'weary', label: 'Weary', icon: Frown, color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30' },
];

const DEMO_REFLECTIONS: JournalEntry[] = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (i + 1));
  const prompts = DAILY_PROMPTS;
  const moods = ['Joyful', 'Peaceful', 'Hopeful', 'Neutral', 'Peaceful', 'Hopeful', 'Joyful'];
  const bodies = [
    'Today I was reminded that patience isn\'t passive — it\'s an active trust in God\'s timing. Small group was amazing.',
    'Feeling at rest after a long week. Prayed for my family and felt covered.',
    'The sermon really hit different today. Been thinking about what it means to truly serve.',
    'Ordinary day. Found peace in the quiet moments — morning coffee and a few verses.',
    'Connected with a few friends from women\'s ministry. Grateful for community.',
    'Feeling called to step up in the worship team. Praying about it.',
    'Woke up with a sense of joy I can\'t quite explain. Going to lean into that today.',
  ];
  return {
    id: `demo-r${i}`,
    date: d.toISOString(),
    prompt: prompts[i % prompts.length].text,
    body: bodies[i],
    mood: moods[i],
  };
});

const BIBLE_STUDIES: BibleStudy[] = [
  {
    id: 'bs-1', title: 'Foundations of Faith', description: '8-session study covering the core beliefs of the Christian faith.',
    sessions: 8, completed: true, progress: 100,
  },
  {
    id: 'bs-2', title: 'Women of the Bible', description: 'Explore the stories of 6 remarkable women who shaped history.',
    sessions: 6, completed: false, progress: 17,
  },
  {
    id: 'bs-3', title: 'Psalms: Songs of the Heart', description: 'A 4-week journey through the Psalms for daily rhythm.',
    sessions: 4, completed: false, progress: 0,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function getJourneyStage(completedCount: number): string {
  if (completedCount === 0) return 'Beginning';
  if (completedCount <= 2) return 'Growing';
  if (completedCount <= 4) return 'Established';
  return 'Leading';
}

function getMemberSinceYear(member?: Person | null): string {
  const date = member?.joinDate ?? member?.firstVisit;
  if (!date) return '';
  return new Date(date).getFullYear().toString();
}

function getGivingTier(giving: Giving[], personId: string): { tier: string; pct: number } | null {
  const recent = giving.filter(g => g.personId === personId);
  if (recent.length === 0) return null;
  const monthlyTotal = recent
    .filter(g => {
      const d = new Date(g.date);
      const now = new Date();
      return now.getTime() - d.getTime() < 31 * 24 * 60 * 60 * 1000;
    })
    .reduce((sum, g) => sum + g.amount, 0);
  if (monthlyTotal >= 500) return { tier: 'Legacy Partner', pct: 100 };
  if (monthlyTotal >= 150) return { tier: 'Partner', pct: Math.round((monthlyTotal / 500) * 100) };
  if (monthlyTotal >= 50) return { tier: 'Sustainer', pct: Math.round((monthlyTotal / 150) * 100) };
  return { tier: 'Seed', pct: Math.round((monthlyTotal / 50) * 100) };
}

function todayPrompt(): { tag: string; text: string } {
  const idx = new Date().getDay();
  return DAILY_PROMPTS[idx % DAILY_PROMPTS.length];
}

// ─── Sub-components ────────────────────────────────────────────────────────

function HeroSection({
  member, stage, journalCount, reflectionDays, studiesCompleted,
}: {
  member?: Person | null;
  stage: string;
  journalCount: number;
  reflectionDays: number;
  studiesCompleted: number;
}) {
  const sinceYear = getMemberSinceYear(member);
  const displayName = member ? `${member.firstName} ${member.lastName}` : 'Your Journey';

  return (
    <div className="relative overflow-hidden rounded-b-3xl" style={{ minHeight: 220 }}>
      {/* Background landscape */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1501854140801-50d01698950b?w=900&q=70')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/70 via-gray-900/60 to-gray-900/90" />

      {/* Content */}
      <div className="relative px-5 pt-6 pb-4">
        {/* Church + Since line */}
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin size={11} className="text-indigo-300" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
            Central Henderson{sinceYear && ` · Member Since ${sinceYear}`}
          </span>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-3 mb-4">
          {member?.photo ? (
            <img
              src={member.photo}
              alt={displayName}
              className="w-14 h-14 rounded-full ring-2 ring-white/30 object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full ring-2 ring-white/30 bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xl">
                {member?.firstName?.[0] ?? 'M'}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">
              {member?.firstName ? `${member.firstName}'s Journey` : 'My Journey'}
            </h1>
            <p className="text-sm text-gray-300 leading-snug mt-0.5">
              Reflect, set goals, and notice your daily rhythm.
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Journey Stage', value: stage },
            { label: 'Journal Entries', value: journalCount.toString() },
            { label: 'Reflection Days', value: reflectionDays.toString() },
            { label: 'Studies Completed', value: studiesCompleted.toString() },
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-2 text-center"
            >
              <p className="text-base font-bold text-white">{stat.value}</p>
              <p className="text-[9px] font-medium text-gray-300 leading-tight mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PartnerStrip({ tier, pct, onGiving, onGrowth }: {
  tier: string; pct: number;
  onGiving: () => void;
  onGrowth: () => void;
}) {
  return (
    <div className="mx-4 mt-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-slate-50 dark:from-indigo-500/10 dark:to-slate-500/10 border border-indigo-100 dark:border-indigo-500/20 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">{tier}</span>
            <span className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full">
              {pct}%
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-dark-400">· Review your giving goal</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onGrowth}
            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
          >
            View growth <ChevronRight size={11} />
          </button>
          <button
            onClick={onGiving}
            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
          >
            Review giving <ChevronRight size={11} />
          </button>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-2 h-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function TabBar({ active, onChange }: { active: JourneyTab; onChange: (t: JourneyTab) => void }) {
  const tabs: { id: JourneyTab; label: string; icon: typeof PenLine }[] = [
    { id: 'journal', label: 'Journal', icon: PenLine },
    { id: 'growth', label: 'Growth', icon: TrendingUp },
    { id: 'bible', label: 'Bible Study', icon: BookMarked },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'goals', label: 'Goals', icon: Target },
  ];

  return (
    <div className="mx-4 mt-3 flex gap-1 bg-gray-100 dark:bg-dark-800 rounded-2xl p-1 overflow-x-auto no-scrollbar">
      {tabs.map(t => {
        const Icon = t.icon;
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              isActive
                ? 'bg-gray-900 dark:bg-dark-100 text-white dark:text-dark-900 shadow-sm'
                : 'text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200'
            }`}
          >
            <Icon size={12} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Journal Tab ───────────────────────────────────────────────────────────

function JournalTab({
  personId, churchId, entries, onEntrySaved, reflectionDays,
}: {
  personId?: string | null;
  churchId?: string;
  entries: JournalEntry[];
  onEntrySaved: (entry: JournalEntry) => void;
  reflectionDays: number;
}) {
  const [mode, setMode] = useState<JournalMode>('write');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [saved, setSaved] = useState(false);
  const prompt = useMemo(() => todayPrompt(), []);

  const handleMood = (moodId: string) => {
    setSelectedMood(moodId);
    if (personId && churchId) {
      logMemberActivity({
        churchId, personId, eventType: 'mood_check',
        entityType: 'journal', metadata: { mood: moodId },
      });
    }
  };

  const handleSave = () => {
    if (!reflectionText.trim()) return;
    const entry: JournalEntry = {
      id: `entry-${Date.now()}`,
      date: new Date().toISOString(),
      prompt: prompt.text,
      body: reflectionText.trim(),
      mood: selectedMood ?? 'neutral',
    };
    onEntrySaved(entry);
    if (personId && churchId) {
      logMemberActivity({
        churchId, personId, eventType: 'journal_entry',
        entityType: 'journal', metadata: { mood: selectedMood, prompt_tag: prompt.tag },
      });
    }
    setReflectionText('');
    setSelectedMood(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const allEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="px-4 pb-6 space-y-4">
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-indigo-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-dark-100">Prayer Journal</h2>
        </div>
        <div className="flex bg-gray-100 dark:bg-dark-800 rounded-lg p-0.5">
          {(['write', 'history'] as JournalMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                mode === m
                  ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 shadow-sm'
                  : 'text-gray-500 dark:text-dark-400'
              }`}
            >
              {m === 'write' ? 'Write' : 'History'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'write' ? (
        <>
          {/* Daily Prompt */}
          <div className="rounded-2xl bg-gray-50 dark:bg-dark-800 border border-gray-100 dark:border-dark-700 p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Today's prompt</p>
              <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                {prompt.tag}
              </span>
            </div>
            <p className="text-sm text-gray-700 dark:text-dark-200 leading-relaxed">
              {prompt.text}
            </p>

            {/* Mood picker */}
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-dark-500 mb-2">How are you feeling?</p>
              <div className="grid grid-cols-6 gap-1.5">
                {MOODS.map(m => {
                  const Icon = m.icon;
                  const isSelected = selectedMood === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleMood(m.id)}
                      title={m.label}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl border transition-all ${
                        isSelected
                          ? m.color + ' ring-2 ring-offset-1 ring-current'
                          : 'bg-white dark:bg-dark-700 border-gray-200 dark:border-dark-600 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="text-[8px] font-medium leading-none">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Reflection textarea */}
          <div className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-dark-500 mb-2">Your reflection</p>
            <textarea
              value={reflectionText}
              onChange={e => setReflectionText(e.target.value)}
              placeholder="Write freely — this is just for you..."
              maxLength={500}
              rows={5}
              className="w-full text-sm text-gray-800 dark:text-dark-100 bg-transparent resize-none outline-none placeholder-gray-300 dark:placeholder-dark-600 leading-relaxed"
            />
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-dark-700">
              <span className="text-[10px] text-gray-300 dark:text-dark-600">{reflectionText.length}/500</span>
              {saved ? (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-semibold">
                  <Check size={13} /> Saved!
                </div>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={!reflectionText.trim()}
                  className="px-4 py-1.5 bg-gray-900 dark:bg-dark-100 text-white dark:text-dark-900 text-xs font-semibold rounded-lg disabled:opacity-40 transition-all hover:bg-gray-700 dark:hover:bg-dark-200"
                >
                  Save reflection
                </button>
              )}
            </div>
          </div>

          {/* Reflection rhythm */}
          <div className="rounded-2xl border border-gray-200 dark:border-dark-700 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Flame size={18} className="text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-dark-100">Reflection rhythm</p>
              <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-0.5">
                {reflectionDays > 0
                  ? `${reflectionDays} days · Keep the streak going!`
                  : 'Write today to start your streak'}
              </p>
            </div>
            <div className="ml-auto flex gap-1">
              {Array.from({ length: 7 }, (_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full ${
                    i < Math.min(reflectionDays, 7)
                      ? 'bg-amber-400'
                      : 'bg-gray-200 dark:bg-dark-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        /* History */
        <div className="space-y-3">
          {allEntries.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-dark-600">
              <PenLine size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No entries yet — start writing!</p>
            </div>
          ) : (
            allEntries.map(entry => {
              const mood = MOODS.find(m => m.id === entry.mood || m.label.toLowerCase() === entry.mood.toLowerCase());
              const MoodIcon = mood?.icon ?? Meh;
              return (
                <div key={entry.id} className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MoodIcon size={14} className={mood ? mood.color.split(' ')[0] : 'text-gray-400'} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-dark-500">
                        {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400 px-2 py-0.5 rounded-full capitalize">
                      {entry.mood}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-dark-500 italic mb-1.5 line-clamp-1">"{entry.prompt}"</p>
                  <p className="text-sm text-gray-700 dark:text-dark-200 leading-relaxed">{entry.body}</p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Growth Tab ────────────────────────────────────────────────────────────

function GrowthTab({
  milestones, personId, churchId,
}: {
  milestones: DiscipleshipMilestone[];
  personId?: string | null;
  churchId?: string;
}) {
  const [requestedSteps, setRequestedSteps] = useState<Set<MilestoneType>>(new Set());
  const milestoneMap = new Map(milestones.map(m => [m.milestoneType, m]));
  const completedCount = DEFAULT_MILESTONE_DEFINITIONS.filter(d => milestoneMap.has(d.type)).length;
  const totalCount = DEFAULT_MILESTONE_DEFINITIONS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  const nextStep = DEFAULT_MILESTONE_DEFINITIONS.find(d => !milestoneMap.has(d.type));

  const handleStepRequest = (type: MilestoneType) => {
    if (requestedSteps.has(type)) return;
    setRequestedSteps(prev => new Set([...prev, type]));
    if (churchId && personId) {
      logMemberActivity({
        churchId, personId, eventType: 'milestone_step_request',
        entityType: 'milestone', metadata: { milestone_type: type },
      });
    }
  };

  return (
    <div className="px-4 pb-6 space-y-4">
      {/* Progress summary */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-slate-700 p-4 flex items-center gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" strokeWidth="6" className="stroke-white/20" />
            <circle cx="36" cy="36" r="30" fill="none" strokeWidth="6"
              strokeDasharray={2 * Math.PI * 30}
              strokeDashoffset={2 * Math.PI * 30 * (1 - progressPct / 100)}
              strokeLinecap="round"
              className="stroke-white transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-white">{progressPct}%</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-200">Spiritual Journey</p>
          <p className="text-base font-bold text-white mt-0.5">{completedCount} of {totalCount} Milestones</p>
          <p className="text-xs text-indigo-200 mt-0.5">
            {nextStep ? `Next: ${nextStep.label}` : 'All milestones complete!'}
          </p>
          {/* Dots */}
          <div className="flex gap-1 mt-2">
            {DEFAULT_MILESTONE_DEFINITIONS.map(def => (
              <div key={def.type}
                className={`h-1.5 w-5 rounded-full transition-all ${milestoneMap.has(def.type) ? 'bg-white' : 'bg-white/25'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Milestone cards */}
      {DEFAULT_MILESTONE_DEFINITIONS.map((def, idx) => {
        const milestone = milestoneMap.get(def.type);
        const isCompleted = !!milestone;
        const isNext = !isCompleted && def.type === nextStep?.type;
        const Icon = MILESTONE_ICONS[def.type];
        const requested = requestedSteps.has(def.type);

        return (
          <div
            key={def.type}
            className={`rounded-2xl border p-4 transition-all ${
              isCompleted
                ? 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-600'
                : isNext
                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                : 'bg-gray-50 dark:bg-dark-850 border-gray-200 dark:border-dark-700 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isCompleted
                  ? `bg-gradient-to-br ${MILESTONE_GRADIENTS[def.type]} shadow-sm`
                  : isNext
                  ? 'bg-amber-400'
                  : 'bg-gray-200 dark:bg-dark-700'
              }`}>
                {isCompleted
                  ? <Check size={18} className="text-white" />
                  : isNext
                  ? <Icon size={16} className="text-white" />
                  : <span className="text-sm font-bold text-gray-400 dark:text-dark-500">{idx + 1}</span>
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-semibold ${
                    isCompleted ? 'text-gray-900 dark:text-dark-100' : 'text-gray-500 dark:text-dark-500'
                  }`}>
                    {def.label}
                  </span>
                  {isNext && (
                    <span className="text-[10px] font-bold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full">Next</span>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] font-bold bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">Done</span>
                  )}
                </div>

                {isCompleted && milestone ? (
                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-500 dark:text-dark-400">
                      Completed {new Date(milestone.completedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    {milestone.notes && (
                      <p className="text-xs text-gray-600 dark:text-dark-300 italic leading-relaxed">"{milestone.notes}"</p>
                    )}
                    {milestone.verifiedBy && (
                      <p className="text-[11px] text-gray-400 dark:text-dark-500 flex items-center gap-1">
                        <Star size={10} /> Noted by {milestone.verifiedBy}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-dark-600 leading-relaxed">
                      {STEP_ENCOURAGEMENT[def.type].description}
                    </p>
                    {(isNext || true) && (
                      requested ? (
                        <p className="mt-1.5 text-[11px] font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                          <Check size={11} /> Request sent — we'll follow up soon
                        </p>
                      ) : (
                        <button
                          onClick={() => handleStepRequest(def.type)}
                          className="mt-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                        >
                          {STEP_ENCOURAGEMENT[def.type].cta} <ChevronRight size={11} />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {completedCount === totalCount && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/30 p-5 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-1">All milestones complete!</h3>
          <p className="text-sm text-gray-500 dark:text-dark-400 leading-relaxed">
            Your faithfulness is an inspiration. Thank you for being a vital part of our GRACE family.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Bible Study Tab ───────────────────────────────────────────────────────

function BibleStudyTab({ personId, churchId }: { personId?: string | null; churchId?: string }) {
  const [studies, setStudies] = useState<BibleStudy[]>(BIBLE_STUDIES);

  const handleProgress = (id: string) => {
    setStudies(prev => prev.map(s => {
      if (s.id !== id) return s;
      const nextProgress = Math.min(s.progress + Math.round(100 / s.sessions), 100);
      const completed = nextProgress >= 100;
      if (personId && churchId) {
        logMemberActivity({
          churchId, personId, eventType: 'bible_study',
          entityType: 'study', entityId: id,
          metadata: { study_id: id, progress: nextProgress, completed },
        });
      }
      return { ...s, progress: nextProgress, completed };
    }));
  };

  return (
    <div className="px-4 pb-6 space-y-3">
      <div className="flex items-center gap-2 pt-1">
        <BookMarked size={16} className="text-indigo-500" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-dark-100">Bible Studies</h2>
        <span className="ml-auto text-[10px] font-semibold bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400 px-2 py-0.5 rounded-full">
          {studies.filter(s => s.completed).length}/{studies.length} Complete
        </span>
      </div>

      {studies.map(study => (
        <div key={study.id} className={`rounded-2xl border p-4 ${
          study.completed
            ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'
            : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm font-bold ${study.completed ? 'text-green-800 dark:text-green-300' : 'text-gray-900 dark:text-dark-100'}`}>
                  {study.title}
                </span>
                {study.completed && (
                  <div className="flex items-center gap-0.5 text-[10px] font-bold text-green-700 dark:text-green-400">
                    <Check size={11} /> Done
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-dark-400 leading-relaxed mb-2">{study.description}</p>

              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-dark-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${study.completed ? 'bg-green-500' : 'bg-indigo-500'}`}
                    style={{ width: `${study.progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-dark-500 tabular-nums">{study.progress}%</span>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-dark-600 mt-1">{study.sessions} sessions</p>
            </div>

            {!study.completed && (
              <button
                onClick={() => handleProgress(study.id)}
                className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                {study.progress > 0 ? 'Continue' : 'Start'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Activity Tab ──────────────────────────────────────────────────────────

function ActivityTab({ entries, reflectionDays }: { entries: JournalEntry[]; reflectionDays: number }) {
  const recentActivity = [
    ...entries.slice(0, 5).map(e => ({
      id: e.id,
      icon: PenLine,
      label: 'Saved a reflection',
      sub: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10',
    })),
    {
      id: 'a-study', icon: BookMarked, label: 'Started Foundations of Faith',
      sub: 'Bible Study', color: 'text-green-500 bg-green-50 dark:bg-green-500/10',
    },
    {
      id: 'a-journey', icon: MapPin, label: 'Opened My Journey',
      sub: 'Today', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
    },
  ];

  return (
    <div className="px-4 pb-6 space-y-3">
      <div className="flex items-center gap-2 pt-1">
        <Activity size={16} className="text-indigo-500" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-dark-100">Recent Activity</h2>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Reflections', value: entries.length, icon: PenLine, color: 'text-indigo-500' },
          { label: 'Day Streak', value: reflectionDays, icon: Flame, color: 'text-amber-500' },
          { label: 'Studies', value: BIBLE_STUDIES.filter(s => s.completed || s.progress > 0).length, icon: BookMarked, color: 'text-green-500' },
        ].map(chip => {
          const Icon = chip.icon;
          return (
            <div key={chip.label} className="rounded-2xl bg-gray-50 dark:bg-dark-800 border border-gray-100 dark:border-dark-700 p-3 text-center">
              <Icon size={16} className={`${chip.color} mx-auto mb-1`} />
              <p className="text-base font-bold text-gray-900 dark:text-dark-100">{chip.value}</p>
              <p className="text-[9px] text-gray-400 dark:text-dark-500 font-medium">{chip.label}</p>
            </div>
          );
        })}
      </div>

      {/* Activity feed */}
      <div className="space-y-2">
        {recentActivity.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 p-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 dark:text-dark-100">{item.label}</p>
                <p className="text-[10px] text-gray-400 dark:text-dark-500">{item.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Goals Tab ─────────────────────────────────────────────────────────────

function GoalsTab({ giving, personId, givingTier }: {
  giving?: Giving[];
  personId?: string | null;
  givingTier: { tier: string; pct: number } | null;
}) {
  const monthlyGiving = giving?.filter(g =>
    g.personId === personId && new Date().getTime() - new Date(g.date).getTime() < 31 * 24 * 60 * 60 * 1000
  ).reduce((sum, g) => sum + g.amount, 0) ?? 0;

  const goals = [
    {
      id: 'g-giving', icon: Gift, label: 'Giving Goal', color: 'bg-indigo-500',
      value: Math.round(monthlyGiving), target: 300, unit: '$', prefix: true,
      description: 'Monthly giving toward your tithe goal',
    },
    {
      id: 'g-attendance', icon: Calendar, label: 'Attendance Goal', color: 'bg-green-500',
      value: 3, target: 4, unit: 'services', prefix: false,
      description: 'Services attended this month',
    },
    {
      id: 'g-journal', icon: PenLine, label: 'Journal Goal', color: 'bg-amber-500',
      value: 7, target: 20, unit: 'days', prefix: false,
      description: 'Reflection days this month',
    },
    {
      id: 'g-bible', icon: BookMarked, label: 'Bible Study Goal', color: 'bg-rose-500',
      value: 1, target: 2, unit: 'studies', prefix: false,
      description: 'Completed studies this year',
    },
  ];

  return (
    <div className="px-4 pb-6 space-y-3">
      <div className="flex items-center gap-2 pt-1">
        <Target size={16} className="text-indigo-500" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-dark-100">My Goals</h2>
        {givingTier && (
          <span className="ml-auto text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
            {givingTier.tier}
          </span>
        )}
      </div>

      {goals.map(goal => {
        const Icon = goal.icon;
        const pct = Math.min(Math.round((goal.value / goal.target) * 100), 100);
        return (
          <div key={goal.id} className="rounded-2xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 p-4">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 ${goal.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-dark-100">{goal.label}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-dark-100">
                    {goal.prefix ? '$' : ''}{goal.value}{!goal.prefix ? ` / ${goal.target} ${goal.unit}` : ` / $${goal.target}`}
                  </p>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-dark-500 mb-2">{goal.description}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-dark-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${goal.color} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-dark-500 tabular-nums">{pct}%</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Card impact note */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 dark:from-dark-900 dark:to-dark-800 p-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={14} className="text-indigo-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Card Impact — This Month</p>
        </div>
        <p className="text-xl font-bold text-white">$18.42</p>
        <p className="text-[11px] text-gray-400 mt-0.5">Card-generated · routed this month via GRACE Impact Card</p>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function MemberJourneyPage({
  milestones, member, personId, churchId, giving = [],
}: MemberJourneyPageProps) {
  const [activeTab, setActiveTab] = useState<JourneyTab>('journal');
  const [entries, setEntries] = useState<JournalEntry[]>(DEMO_REFLECTIONS);

  // Log portal engagement on mount
  useEffect(() => {
    if (!churchId || !personId) return;
    logMemberActivity({
      churchId, personId, eventType: 'journey_view', entityType: 'page',
    });
  }, [churchId, personId]);

  const milestoneMap = new Map(milestones.map(m => [m.milestoneType, m]));
  const completedCount = DEFAULT_MILESTONE_DEFINITIONS.filter(d => milestoneMap.has(d.type)).length;
  const stage = getJourneyStage(completedCount);
  const studiesCompleted = BIBLE_STUDIES.filter(s => s.completed).length;
  const reflectionDays = 7; // demo streak; in production read distinct days from Supabase
  const givingTier = getGivingTier(giving, personId ?? '');

  const handleEntrySaved = (entry: JournalEntry) => {
    setEntries(prev => [entry, ...prev]);
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50 dark:bg-dark-900">
      {/* Hero */}
      <HeroSection
        member={member}
        stage={stage}
        journalCount={entries.length}
        reflectionDays={reflectionDays}
        studiesCompleted={studiesCompleted}
      />

      {/* Partner strip */}
      {givingTier && (
        <PartnerStrip
          tier={givingTier.tier}
          pct={givingTier.pct}
          onGrowth={() => setActiveTab('growth')}
          onGiving={() => setActiveTab('goals')}
        />
      )}

      {/* Tabs */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Content */}
      <div className="mt-3 flex-1">
        {activeTab === 'journal' && (
          <JournalTab
            personId={personId}
            churchId={churchId}
            entries={entries}
            onEntrySaved={handleEntrySaved}
            reflectionDays={reflectionDays}
          />
        )}
        {activeTab === 'growth' && (
          <GrowthTab
            milestones={milestones}
            personId={personId}
            churchId={churchId}
          />
        )}
        {activeTab === 'bible' && (
          <BibleStudyTab personId={personId} churchId={churchId} />
        )}
        {activeTab === 'activity' && (
          <ActivityTab entries={entries} reflectionDays={reflectionDays} />
        )}
        {activeTab === 'goals' && (
          <GoalsTab giving={giving} personId={personId} givingTier={givingTier} />
        )}
      </div>
    </div>
  );
}
