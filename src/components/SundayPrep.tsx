import { useState, useEffect } from 'react';
import {
  Church,
  CheckCircle2,
  Circle,
  Mic,
  Newspaper,
  Sparkles,
  Gift,
  Heart,
  Users,
  Calendar,
  RefreshCw,
  ChevronRight,
  Lightbulb,
  BookOpen,
  MessageSquare,
} from 'lucide-react';
import { Person, PrayerRequest } from '../types';

interface SundayPrepProps {
  people: Person[];
  prayers: PrayerRequest[];
  onViewPerson?: (id: string) => void;
}

interface PrepTask {
  id: string;
  label: string;
  completed: boolean;
  category: 'before' | 'during' | 'after';
}

interface NewsTheme {
  headline: string;
  connection: string;
  category: string;
}

const defaultTasks: PrepTask[] = [
  { id: '1', label: 'Review prayer requests from this week', completed: false, category: 'before' },
  { id: '2', label: 'Check for birthdays & anniversaries to announce', completed: false, category: 'before' },
  { id: '3', label: 'Prepare welcome message for visitors', completed: false, category: 'before' },
  { id: '4', label: 'Review sermon notes and key points', completed: false, category: 'before' },
  { id: '5', label: 'Welcome first-time visitors by name', completed: false, category: 'during' },
  { id: '6', label: 'Acknowledge answered prayers', completed: false, category: 'during' },
  { id: '7', label: 'Make announcements', completed: false, category: 'during' },
  { id: '8', label: 'Follow up with visitors', completed: false, category: 'after' },
];

// Simulated trending themes - in production this could come from an API
const trendingThemes: NewsTheme[] = [
  {
    headline: 'Mental Health Awareness Rising',
    connection: 'Connect to messages of hope, community support, and "casting your anxieties" (1 Peter 5:7)',
    category: 'Health & Wellness',
  },
  {
    headline: 'Community Coming Together After Challenges',
    connection: 'Tie to the power of fellowship, Acts 2:42-47, and bearing one another\'s burdens',
    category: 'Community',
  },
  {
    headline: 'Finding Purpose in Uncertain Times',
    connection: 'Link to Jeremiah 29:11, Romans 8:28, and trusting God\'s plan',
    category: 'Faith & Purpose',
  },
];

export function SundayPrep({ people, prayers, onViewPerson }: SundayPrepProps) {
  const [tasks, setTasks] = useState<PrepTask[]>(() => {
    const saved = localStorage.getItem('sundayPrepTasks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return defaultTasks;
      }
    }
    return defaultTasks;
  });

  const [sermonTheme, setSermonTheme] = useState(() => {
    return localStorage.getItem('sermonTheme') || '';
  });

  const [talkingPoints, setTalkingPoints] = useState(() => {
    return localStorage.getItem('sermonTalkingPoints') || '';
  });

  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [newsThemes, setNewsThemes] = useState<NewsTheme[]>(trendingThemes);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('sundayPrepTasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('sermonTheme', sermonTheme);
  }, [sermonTheme]);

  useEffect(() => {
    localStorage.setItem('sermonTalkingPoints', talkingPoints);
  }, [talkingPoints]);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const resetTasks = () => {
    setTasks(defaultTasks);
    setSermonTheme('');
    setTalkingPoints('');
  };

  const refreshNews = () => {
    setIsLoadingNews(true);
    // Simulate API call - in production this would fetch real news
    setTimeout(() => {
      setNewsThemes([...trendingThemes].sort(() => Math.random() - 0.5));
      setIsLoadingNews(false);
    }, 1000);
  };

  // Get upcoming birthdays (next 7 days)
  const upcomingBirthdays = people.filter(p => {
    if (!p.birthDate) return false;
    const today = new Date();
    const birthday = new Date(p.birthDate);
    birthday.setFullYear(today.getFullYear());
    const diffDays = Math.ceil((birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  // Get recent visitors (last 30 days)
  const recentVisitors = people.filter(p => {
    if (p.status !== 'visitor') return false;
    if (!p.firstVisit) return false;
    const visitDate = new Date(p.firstVisit);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return visitDate >= thirtyDaysAgo;
  });

  // Get active prayer requests (not answered)
  const activePrayers = prayers.filter(p => !p.isAnswered).slice(0, 5);

  const beforeTasks = tasks.filter(t => t.category === 'before');
  const duringTasks = tasks.filter(t => t.category === 'during');
  const completedCount = tasks.filter(t => t.completed).length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header with Photo */}
      <div className="relative overflow-hidden rounded-xl h-40">
        <img
          src="https://images.unsplash.com/photo-1507692049790-de58290a4334?w=1200&h=400&fit=crop"
          alt="Church service preparation"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-800/70 to-slate-900/50" />
        <div className="relative h-full p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
              <Church className="text-white/90" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Sunday Prep</h2>
              <p className="text-white/60 text-sm">Get ready for service</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-semibold text-white">{progress}%</p>
              <p className="text-xs text-white/50">ready</p>
            </div>
            <button
              onClick={resetTasks}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/10"
              title="Reset for new week"
            >
              <RefreshCw size={18} className="text-white/80" />
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div
            className="h-full bg-white/80 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Checklist & Sermon */}
        <div className="space-y-6">
          {/* Pre-Service Checklist */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/30 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={18} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-dark-100">Before Service</h3>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Complete these first</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {beforeTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                    task.completed
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : 'bg-gray-50 dark:bg-dark-750 hover:bg-gray-100 dark:hover:bg-dark-700'
                  }`}
                >
                  {task.completed ? (
                    <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Circle size={18} className="text-gray-300 dark:text-dark-500 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${task.completed ? 'text-emerald-700 dark:text-emerald-400 line-through' : 'text-gray-700 dark:text-dark-200'}`}>
                    {task.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* During Service */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/30 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center shadow-sm">
                  <Mic className="text-indigo-600 dark:text-indigo-400" size={18} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-dark-100">During Service</h3>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Don't forget these</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {duringTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                    task.completed
                      ? 'bg-indigo-50 dark:bg-indigo-900/20'
                      : 'bg-gray-50 dark:bg-dark-750 hover:bg-gray-100 dark:hover:bg-dark-700'
                  }`}
                >
                  {task.completed ? (
                    <CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  ) : (
                    <Circle size={18} className="text-gray-300 dark:text-dark-500 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${task.completed ? 'text-indigo-700 dark:text-indigo-400 line-through' : 'text-gray-700 dark:text-dark-200'}`}>
                    {task.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sermon Notes */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/30 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center shadow-sm">
                  <BookOpen className="text-blue-600 dark:text-blue-400" size={18} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-dark-100">Sermon Highlights</h3>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Key points to remember</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Today's Theme
                </label>
                <input
                  type="text"
                  value={sermonTheme}
                  onChange={(e) => setSermonTheme(e.target.value)}
                  placeholder="e.g., Finding Peace in the Storm"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-750 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Talking Points
                </label>
                <textarea
                  value={talkingPoints}
                  onChange={(e) => setTalkingPoints(e.target.value)}
                  placeholder="• Main scripture reference&#10;• Key message&#10;• Call to action&#10;• Closing thought"
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-750 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Context & Connections */}
        <div className="space-y-6">
          {/* What to Address */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="bg-rose-50 dark:bg-rose-900/20 border-b border-rose-100 dark:border-rose-800/30 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center shadow-sm">
                  <MessageSquare className="text-rose-600 dark:text-rose-400" size={18} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-dark-100">What to Address</h3>
                  <p className="text-xs text-gray-500 dark:text-dark-400">Personalize your message</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Birthdays */}
              {upcomingBirthdays.length > 0 && (
                <div className="p-3 bg-pink-50 dark:bg-pink-500/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift size={16} className="text-pink-500" />
                    <span className="text-sm font-medium text-pink-700 dark:text-pink-400">Birthdays This Week</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {upcomingBirthdays.slice(0, 5).map((person) => (
                      <button
                        key={person.id}
                        onClick={() => onViewPerson?.(person.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-xs font-medium text-gray-700 dark:text-dark-300 hover:bg-pink-100 dark:hover:bg-pink-500/20 transition-colors"
                      >
                        {person.firstName} {person.lastName}
                        <ChevronRight size={12} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Visitors to Welcome */}
              {recentVisitors.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={16} className="text-amber-500" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Welcome These Visitors</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentVisitors.slice(0, 5).map((person) => (
                      <button
                        key={person.id}
                        onClick={() => onViewPerson?.(person.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-xs font-medium text-gray-700 dark:text-dark-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                      >
                        {person.firstName} {person.lastName}
                        <ChevronRight size={12} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Prayer Requests */}
              {activePrayers.length > 0 && (
                <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart size={16} className="text-purple-500" />
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-400">Pray For</span>
                  </div>
                  <div className="space-y-2">
                    {activePrayers.map((prayer) => {
                      const person = people.find(p => p.id === prayer.personId);
                      return (
                        <div key={prayer.id} className="text-sm text-gray-600 dark:text-dark-400">
                          <span className="font-medium text-gray-900 dark:text-dark-200">
                            {person ? `${person.firstName} ${person.lastName}` : 'Anonymous'}:
                          </span>{' '}
                          {prayer.content.length > 60 ? prayer.content.substring(0, 60) + '...' : prayer.content}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {upcomingBirthdays.length === 0 && recentVisitors.length === 0 && activePrayers.length === 0 && (
                <div className="text-center py-6 text-gray-400 dark:text-dark-500">
                  <Calendar size={24} className="mx-auto mb-2" />
                  <p className="text-sm">No specific items to address this week</p>
                </div>
              )}
            </div>
          </div>

          {/* News & Themes Connection */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border-b border-cyan-100 dark:border-cyan-800/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center shadow-sm">
                    <Newspaper className="text-cyan-600 dark:text-cyan-400" size={18} />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-dark-100">Connect the Theme</h3>
                    <p className="text-xs text-gray-500 dark:text-dark-400">Relevant world topics</p>
                  </div>
                </div>
                <button
                  onClick={refreshNews}
                  disabled={isLoadingNews}
                  className="p-2 bg-white dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-600 rounded-lg transition-colors disabled:opacity-50 border border-gray-200 dark:border-dark-600"
                >
                  <RefreshCw size={14} className={`text-gray-500 dark:text-dark-400 ${isLoadingNews ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {newsThemes.map((theme, index) => (
                <div key={index} className="p-3 bg-gray-50 dark:bg-dark-750 rounded-lg border border-gray-100 dark:border-dark-600">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Lightbulb size={14} className="text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <span className="inline-block px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 text-[10px] font-medium rounded-full mb-1">
                        {theme.category}
                      </span>
                      <h4 className="font-medium text-gray-900 dark:text-dark-100 text-sm">{theme.headline}</h4>
                      <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">{theme.connection}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Sermon Helper */}
          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center shadow-sm">
                <Sparkles className="text-slate-600 dark:text-slate-400" size={18} />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-dark-100">AI Sermon Helper</h3>
                <p className="text-xs text-gray-500 dark:text-dark-400">Get AI-powered suggestions</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-dark-400 mb-3">
              Need help crafting your message? Use the AI Assistant to generate sermon illustrations and scripture connections.
            </p>
            <button className="w-full py-2.5 bg-slate-800 dark:bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors">
              Open AI Assistant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
