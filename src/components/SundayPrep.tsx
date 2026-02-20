import { useState, useEffect, useRef, useCallback } from 'react';
import { createLogger } from '../utils/logger';

const log = createLogger('sunday-prep');
import {
  Church,
  Newspaper,
  Sparkles,
  Gift,
  Heart,
  Users,
  Plus,
  Trash2,
  Download,
  Printer,
  BookOpen,
  MessageSquare,
  Lightbulb,
  Quote,
  Target,
  Megaphone,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Person, PrayerRequest } from '../types';
import { generateAIText } from '../lib/services/ai';
import {
  fetchCuratedNews,
  hasNewsApiKey,
  fallbackNewsItems,
  CuratedNewsItem,
} from '../lib/services/news';
import { useAISettings } from '../hooks/useAISettings';

interface SundayPrepProps {
  people: Person[];
  prayers: PrayerRequest[];
  onViewPerson?: (id: string) => void;
}

interface SermonSection {
  id: string;
  type: 'opening' | 'scripture' | 'point' | 'illustration' | 'application' | 'announcement' | 'closing';
  title: string;
  content: string;
  sourceType?: 'news' | 'birthday' | 'visitor' | 'prayer' | 'manual';
  sourceId?: string;
}

interface DragItem {
  type: 'news' | 'birthday' | 'visitor' | 'prayer';
  id: string;
  title: string;
  content: string;
}

const sectionTypeConfig = {
  opening: {
    label: 'Opening',
    icon: Megaphone,
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-500/10',
    borderLight: 'border-amber-100',
    borderDark: 'dark:border-amber-500/20',
    textLight: 'text-amber-700',
    textDark: 'dark:text-amber-400',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  scripture: {
    label: 'Scripture',
    icon: BookOpen,
    bgLight: 'bg-blue-50',
    bgDark: 'dark:bg-blue-500/10',
    borderLight: 'border-blue-100',
    borderDark: 'dark:border-blue-500/20',
    textLight: 'text-blue-700',
    textDark: 'dark:text-blue-400',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  point: {
    label: 'Main Point',
    icon: Target,
    bgLight: 'bg-violet-50',
    bgDark: 'dark:bg-violet-500/10',
    borderLight: 'border-violet-100',
    borderDark: 'dark:border-violet-500/20',
    textLight: 'text-violet-700',
    textDark: 'dark:text-violet-400',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  illustration: {
    label: 'Illustration',
    icon: Lightbulb,
    bgLight: 'bg-cyan-50',
    bgDark: 'dark:bg-cyan-500/10',
    borderLight: 'border-cyan-100',
    borderDark: 'dark:border-cyan-500/20',
    textLight: 'text-cyan-700',
    textDark: 'dark:text-cyan-400',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
  },
  application: {
    label: 'Application',
    icon: MessageSquare,
    bgLight: 'bg-green-50',
    bgDark: 'dark:bg-green-500/10',
    borderLight: 'border-green-100',
    borderDark: 'dark:border-green-500/20',
    textLight: 'text-green-700',
    textDark: 'dark:text-green-400',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  announcement: {
    label: 'Announcement',
    icon: Users,
    bgLight: 'bg-pink-50',
    bgDark: 'dark:bg-pink-500/10',
    borderLight: 'border-pink-100',
    borderDark: 'dark:border-pink-500/20',
    textLight: 'text-pink-700',
    textDark: 'dark:text-pink-400',
    iconColor: 'text-pink-600 dark:text-pink-400',
  },
  closing: {
    label: 'Closing',
    icon: Quote,
    bgLight: 'bg-slate-50',
    bgDark: 'dark:bg-slate-500/10',
    borderLight: 'border-slate-100',
    borderDark: 'dark:border-slate-500/20',
    textLight: 'text-slate-700',
    textDark: 'dark:text-slate-400',
    iconColor: 'text-slate-600 dark:text-slate-400',
  },
};

export function SundayPrep({ people, prayers }: SundayPrepProps) {
  const { settings: aiSettings } = useAISettings();
  const [sermonTitle, setSermonTitle] = useState(() =>
    localStorage.getItem('sermon-title') || ''
  );
  const [sections, setSections] = useState<SermonSection[]>(() => {
    const saved = localStorage.getItem('sermon-sections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [newsItems, setNewsItems] = useState<CuratedNewsItem[]>(fallbackNewsItems);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [expandingSection, setExpandingSection] = useState<string | null>(null);
  const [isGeneratingFullSermon, setIsGeneratingFullSermon] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('sermon-title', sermonTitle);
  }, [sermonTitle]);

  useEffect(() => {
    localStorage.setItem('sermon-sections', JSON.stringify(sections));
  }, [sections]);

  const refreshNews = useCallback(async () => {
    // Skip AI news curation if disabled
    if (!aiSettings.newsCuration) {
      setNewsItems([...fallbackNewsItems].sort(() => Math.random() - 0.5));
      return;
    }

    setIsLoadingNews(true);
    setNewsError(null);

    if (!hasNewsApiKey()) {
      // Use fallback if no API key
      setNewsItems([...fallbackNewsItems].sort(() => Math.random() - 0.5));
      setIsLoadingNews(false);
      return;
    }

    try {
      const curatedNews = await fetchCuratedNews(5);
      setNewsItems(curatedNews);
    } catch (error) {
      log.error('Failed to fetch news', error);
      setNewsError(error instanceof Error ? error.message : 'Failed to fetch news');
      // Fall back to default items
      setNewsItems(fallbackNewsItems);
    }

    setIsLoadingNews(false);
  }, [aiSettings.newsCuration]);

  // Load news on mount and when AI settings change
  useEffect(() => {
    refreshNews();
  }, [refreshNews]);

  // Get upcoming birthdays (next 7 days)
  const upcomingBirthdays = people.filter(p => {
    if (!p.birthDate) return false;
    const today = new Date();
    const birthday = new Date(p.birthDate);
    birthday.setFullYear(today.getFullYear());
    const diffDays = Math.ceil((birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  // Get recent visitors
  const recentVisitors = people.filter(p => {
    if (p.status !== 'visitor') return false;
    if (!p.firstVisit) return false;
    const visitDate = new Date(p.firstVisit);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return visitDate >= thirtyDaysAgo;
  });

  // Get active prayer requests
  const activePrayers = prayers.filter(p => !p.isAnswered).slice(0, 5);

  // Add item from sidebar to sermon builder
  const addItemAsSection = (item: DragItem) => {
    const newSection: SermonSection = {
      id: `section-${Date.now()}`,
      type: item.type === 'news' ? 'illustration' : 'announcement',
      title: item.title,
      content: item.content,
      sourceType: item.type,
      sourceId: item.id,
    };
    setSections([...sections, newSection]);
  };

  const addSection = (type: SermonSection['type']) => {
    const newSection: SermonSection = {
      id: `section-${Date.now()}`,
      type,
      title: sectionTypeConfig[type].label,
      content: '',
      sourceType: 'manual',
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (id: string, updates: Partial<SermonSection>) => {
    setSections(sections.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const index = sections.findIndex(s => s.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;

    const newSections = [...sections];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    setSections(newSections);
  };

  const expandWithAI = async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    setExpandingSection(sectionId);

    const prompt = `Expand this ${section.type} section for a church sermon.
Title: ${section.title}
Current content: ${section.content || 'None yet'}

Write 2-3 paragraphs that would work well in a sermon. Be warm, engaging, and include relevant scripture if appropriate. Keep it under 200 words.`;

    try {
      const result = await generateAIText({ prompt, maxTokens: 400 });
      if (result.success && result.text) {
        updateSection(sectionId, {
          content: section.content ? `${section.content}\n\n${result.text}` : result.text
        });
      }
    } catch {
      // Silent fail
    }

    setExpandingSection(null);
  };

  const generateFullSermon = async () => {
    setIsGeneratingFullSermon(true);

    // Gather context from the congregation
    const birthdayContext = upcomingBirthdays.length > 0
      ? `Birthdays this week: ${upcomingBirthdays.map(p => p.firstName).join(', ')}`
      : '';
    const visitorContext = recentVisitors.length > 0
      ? `New visitors to welcome: ${recentVisitors.map(p => p.firstName).join(', ')}`
      : '';
    const prayerContext = activePrayers.length > 0
      ? `Prayer needs: ${activePrayers.map(p => p.content.substring(0, 50)).join('; ')}`
      : '';

    const topicInstruction = sermonTitle.trim()
      ? `Generate a complete church sermon outline for the topic: "${sermonTitle}"`
      : `Generate a complete church sermon outline. Choose an uplifting, relevant topic for this Sunday's service - something that will resonate with the congregation and provide hope and guidance.`;

    const prompt = `${topicInstruction}

Context about the congregation:
${birthdayContext}
${visitorContext}
${prayerContext}

Create a warm, engaging sermon with the following sections. For each section, write 2-3 paragraphs of actual sermon content (not just bullet points). Total should be around 800-1000 words.

Format your response EXACTLY like this, with these exact headers:

[TITLE]
(${sermonTitle.trim() ? 'Use: ' + sermonTitle : 'Create a compelling sermon title'})

[OPENING]
(Write an engaging opening that draws people in, maybe referencing current events or relatable experiences)

[SCRIPTURE]
(Include a relevant Bible passage with the reference, and explain its context)

[POINT1]
(First main teaching point with explanation and examples)

[POINT2]
(Second main teaching point with explanation and examples)

[APPLICATION]
(Practical ways the congregation can apply this message in their daily lives)

[CLOSING]
(A powerful closing with a call to action or prayer)

${upcomingBirthdays.length > 0 ? '\n[ANNOUNCEMENTS]\n(Mention the birthdays and any visitors to welcome)' : ''}

Make the tone warm, pastoral, and engaging. Include relevant scripture references throughout.`;

    try {
      const result = await generateAIText({ prompt, maxTokens: 2000 });

      if (result.success && result.text) {
        const text = result.text;

        // Extract title if AI generated one
        const titleMatch = text.match(/\[TITLE\]\s*([\s\S]*?)(?=\[|$)/i);
        if (titleMatch && titleMatch[1]?.trim() && !sermonTitle.trim()) {
          setSermonTitle(titleMatch[1].trim());
        }

        // Parse the sections from the response
        const newSections: SermonSection[] = [];

        const sectionPatterns = [
          { pattern: /\[OPENING\]\s*([\s\S]*?)(?=\[|$)/i, type: 'opening' as const, title: 'Opening' },
          { pattern: /\[SCRIPTURE\]\s*([\s\S]*?)(?=\[|$)/i, type: 'scripture' as const, title: 'Scripture Reading' },
          { pattern: /\[POINT1\]\s*([\s\S]*?)(?=\[|$)/i, type: 'point' as const, title: 'Main Point 1' },
          { pattern: /\[POINT2\]\s*([\s\S]*?)(?=\[|$)/i, type: 'point' as const, title: 'Main Point 2' },
          { pattern: /\[APPLICATION\]\s*([\s\S]*?)(?=\[|$)/i, type: 'application' as const, title: 'Application' },
          { pattern: /\[CLOSING\]\s*([\s\S]*?)(?=\[|$)/i, type: 'closing' as const, title: 'Closing' },
          { pattern: /\[ANNOUNCEMENTS\]\s*([\s\S]*?)(?=\[|$)/i, type: 'announcement' as const, title: 'Announcements' },
        ];

        for (const { pattern, type, title } of sectionPatterns) {
          const match = text.match(pattern);
          if (match && match[1]?.trim()) {
            newSections.push({
              id: `section-${Date.now()}-${type}-${Math.random().toString(36).substr(2, 9)}`,
              type,
              title,
              content: match[1].trim(),
              sourceType: 'manual',
            });
          }
        }

        if (newSections.length > 0) {
          setSections(newSections);
        }
      }
    } catch (error) {
      log.error('Failed to generate sermon', error);
    }

    setIsGeneratingFullSermon(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const generatePDF = () => {
    // For now, use print dialog which allows Save as PDF
    handlePrint();
  };

  const clearSermon = () => {
    if (confirm('Clear all sermon content? This cannot be undone.')) {
      setSermonTitle('');
      setSections([]);
    }
  };

  // Color style mappings for draggable items
  const dragItemStyles = {
    cyan: {
      bg: 'bg-cyan-50 dark:bg-cyan-500/10',
      border: 'border-cyan-100 dark:border-cyan-500/20',
      icon: 'text-cyan-500',
      text: 'text-cyan-700 dark:text-cyan-400',
    },
    pink: {
      bg: 'bg-pink-50 dark:bg-pink-500/10',
      border: 'border-pink-100 dark:border-pink-500/20',
      icon: 'text-pink-500',
      text: 'text-pink-700 dark:text-pink-400',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-100 dark:border-amber-500/20',
      icon: 'text-amber-500',
      text: 'text-amber-700 dark:text-amber-400',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-500/10',
      border: 'border-purple-100 dark:border-purple-500/20',
      icon: 'text-purple-500',
      text: 'text-purple-700 dark:text-purple-400',
    },
  };

  // Clickable item component for sidebar
  const ClickableItem = ({ item, icon: Icon, color }: { item: DragItem; icon: React.ElementType; color: keyof typeof dragItemStyles }) => {
    const styles = dragItemStyles[color];
    return (
      <button
        onClick={() => addItemAsSection(item)}
        className={`w-full text-left p-3 ${styles.bg} rounded-lg cursor-pointer border ${styles.border} hover:shadow-md hover:scale-[1.02] transition-all group`}
      >
        <div className="flex items-start gap-2">
          <Icon size={16} className={`${styles.icon} mt-0.5 flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${styles.text} line-clamp-2`}>
              {item.title}
            </p>
            {item.content && (
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1 line-clamp-2">
                {item.content}
              </p>
            )}
          </div>
          <Plus size={14} className="text-gray-400 dark:text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>
    );
  };

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 40px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl h-32 no-print">
          <img
            src="https://images.unsplash.com/photo-1507692049790-de58290a4334?w=1200&h=400&fit=crop"
            alt="Church service preparation"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-800/80 to-slate-900/70" />
          <div className="relative h-full p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <Church className="text-white/90" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Sermon Builder</h2>
                <p className="text-white/60 text-sm">Click content to build your message</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={generatePDF}
                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/10 text-white text-sm"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Export PDF</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/10 text-white text-sm"
              >
                <Printer size={16} />
                <span className="hidden sm:inline">Print</span>
              </button>
              <button
                onClick={clearSermon}
                className="p-2 bg-white/10 hover:bg-red-500/20 rounded-lg transition-colors border border-white/10 text-white/70 hover:text-red-400"
                title="Clear all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Content Sources */}
          <div className="lg:col-span-1 space-y-4 no-print">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider">
              Click to Add
            </h3>

            {/* News & Trending */}
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
              <div className="bg-cyan-50 dark:bg-cyan-900/20 border-b border-cyan-100 dark:border-cyan-800/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Newspaper size={16} className="text-cyan-600 dark:text-cyan-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      {aiSettings.newsCuration && hasNewsApiKey() ? 'Curated News' : 'Sermon Topics'}
                    </span>
                    {aiSettings.newsCuration && hasNewsApiKey() && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full font-medium">
                        AI
                      </span>
                    )}
                  </div>
                  {aiSettings.newsCuration && (
                    <button
                      onClick={refreshNews}
                      disabled={isLoadingNews}
                      className="p-1.5 hover:bg-cyan-100 dark:hover:bg-cyan-800/30 rounded-lg transition-colors"
                      title="Refresh news"
                    >
                      <RefreshCw size={14} className={`text-cyan-600 dark:text-cyan-400 ${isLoadingNews ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Error message */}
              {newsError && (
                <div className="px-3 py-2 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20">
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {newsError}
                  </p>
                </div>
              )}

              <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                {isLoadingNews ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-dark-500">
                    <Loader2 size={24} className="animate-spin mb-2" />
                    <p className="text-xs">Fetching & curating news...</p>
                  </div>
                ) : newsItems.map(news => (
                  <ClickableItem
                    key={news.id}
                    item={{
                      type: 'news',
                      id: news.id,
                      title: news.headline,
                      content: news.connection,
                    }}
                    icon={Lightbulb}
                    color="cyan"
                  />
                ))}
              </div>
            </div>

            {/* Birthdays */}
            {upcomingBirthdays.length > 0 && (
              <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
                <div className="bg-pink-50 dark:bg-pink-900/20 border-b border-pink-100 dark:border-pink-800/30 p-3">
                  <div className="flex items-center gap-2">
                    <Gift size={16} className="text-pink-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">Birthdays This Week</span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {upcomingBirthdays.slice(0, 5).map(person => (
                    <ClickableItem
                      key={person.id}
                      item={{
                        type: 'birthday',
                        id: person.id,
                        title: `🎂 ${person.firstName} ${person.lastName}'s Birthday`,
                        content: `Celebrate ${person.firstName}'s special day with the congregation`,
                      }}
                      icon={Gift}
                      color="pink"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Visitors */}
            {recentVisitors.length > 0 && (
              <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
                <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30 p-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-amber-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">Welcome Visitors</span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {recentVisitors.slice(0, 5).map(person => (
                    <ClickableItem
                      key={person.id}
                      item={{
                        type: 'visitor',
                        id: person.id,
                        title: `Welcome ${person.firstName} ${person.lastName}`,
                        content: 'Extend a warm welcome to our visitor',
                      }}
                      icon={Users}
                      color="amber"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Prayer Requests */}
            {activePrayers.length > 0 && (
              <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
                <div className="bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800/30 p-3">
                  <div className="flex items-center gap-2">
                    <Heart size={16} className="text-purple-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">Prayer Requests</span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {activePrayers.map(prayer => {
                    const person = people.find(p => p.id === prayer.personId);
                    return (
                      <ClickableItem
                        key={prayer.id}
                        item={{
                          type: 'prayer',
                          id: prayer.id,
                          title: `Pray for ${person ? `${person.firstName} ${person.lastName}` : 'Anonymous'}`,
                          content: prayer.content.length > 100 ? prayer.content.substring(0, 100) + '...' : prayer.content,
                        }}
                        icon={Heart}
                        color="purple"
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Sermon Builder Canvas */}
          <div className="lg:col-span-2 space-y-4">
            {/* Sermon Title & Generate Button */}
            <div className="no-print space-y-3">
              <input
                type="text"
                value={sermonTitle}
                onChange={(e) => setSermonTitle(e.target.value)}
                placeholder="Enter Sermon Title..."
                className="w-full px-4 py-3 text-xl font-semibold bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              {aiSettings.sermonGenerator && (
                <>
                  <button
                    onClick={generateFullSermon}
                    disabled={isGeneratingFullSermon}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-lg shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isGeneratingFullSermon ? (
                      <>
                        <Loader2 size={22} className="animate-spin" />
                        Generating Your Sermon...
                      </>
                    ) : (
                      <>
                        <Sparkles size={22} />
                        Generate Full Sermon with AI
                      </>
                    )}
                  </button>
                  {!sermonTitle.trim() && (
                    <p className="text-xs text-center text-gray-400 dark:text-dark-500">
                      Or leave blank and AI will choose a topic for you
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Section Type Buttons */}
            <div className="flex flex-wrap gap-2 no-print">
              {Object.entries(sectionTypeConfig).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => addSection(type as SermonSection['type'])}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${config.bgLight} ${config.bgDark} ${config.textLight} ${config.textDark} rounded-lg hover:opacity-80 transition-colors border ${config.borderLight} ${config.borderDark}`}
                  >
                    <Plus size={12} />
                    <Icon size={12} />
                    {config.label}
                  </button>
                );
              })}
            </div>

            {/* Sermon Sections */}
            <div className="space-y-3 min-h-[400px] p-4 bg-gray-50 dark:bg-dark-850 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-700">
              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 dark:text-dark-500 pointer-events-none">
                  <FileText size={48} className="mb-4 opacity-50" />
                  <p className="text-lg font-medium">Start building your sermon</p>
                  <p className="text-sm mt-1">Click items from the left or use the buttons above</p>
                </div>
              ) : (
                sections.map((section, index) => {
                  const config = sectionTypeConfig[section.type];
                  const Icon = config.icon;

                  return (
                    <div
                      key={section.id}
                      className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden shadow-sm hover:shadow-md transition-all"
                    >
                      {/* Section Header */}
                      <div className={`${config.bgLight} ${config.bgDark} border-b ${config.borderLight} ${config.borderDark} px-4 py-2 flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            <Icon size={16} className={config.iconColor} />
                            <input
                              type="text"
                              value={section.title}
                              onChange={(e) => updateSection(section.id, { title: e.target.value })}
                              className={`bg-transparent font-medium text-sm ${config.textLight} ${config.textDark} focus:outline-none`}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveSection(section.id, 'up')}
                              disabled={index === 0}
                              className="p-1.5 hover:bg-white/50 dark:hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-30"
                              title="Move up"
                            >
                              <ChevronUp size={14} className="text-gray-500 dark:text-dark-400" />
                            </button>
                            <button
                              onClick={() => moveSection(section.id, 'down')}
                              disabled={index === sections.length - 1}
                              className="p-1.5 hover:bg-white/50 dark:hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-30"
                              title="Move down"
                            >
                              <ChevronDown size={14} className="text-gray-500 dark:text-dark-400" />
                            </button>
                            {aiSettings.sectionExpander && (
                              <button
                                onClick={() => expandWithAI(section.id)}
                                disabled={expandingSection === section.id}
                                className="p-1.5 hover:bg-white/50 dark:hover:bg-dark-700 rounded-lg transition-colors"
                                title="Expand with AI"
                              >
                                {expandingSection === section.id ? (
                                  <Loader2 size={14} className="text-violet-500 animate-spin" />
                                ) : (
                                  <Sparkles size={14} className="text-violet-500" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => deleteSection(section.id)}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} className="text-red-500" />
                            </button>
                          </div>
                        </div>

                      {/* Section Content */}
                      <div className="p-4">
                        <textarea
                          value={section.content}
                          onChange={(e) => updateSection(section.id, { content: e.target.value })}
                          placeholder={`Enter ${config.label.toLowerCase()} content...`}
                          rows={4}
                          className="w-full bg-transparent text-gray-700 dark:text-dark-200 placeholder-gray-400 dark:placeholder-dark-500 focus:outline-none resize-none text-sm leading-relaxed"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print Preview Content (hidden until print) */}
      <div ref={printRef} className="print-content hidden print:block">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">{sermonTitle || 'Untitled Sermon'}</h1>
          <p className="text-center text-gray-500 mb-8">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

          {sections.map((section, index) => {
            const config = sectionTypeConfig[section.type];
            return (
              <div key={section.id} className="mb-6">
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <span className="text-gray-400">{index + 1}.</span>
                  {section.title}
                  <span className="text-xs font-normal text-gray-400 uppercase">({config.label})</span>
                </h2>
                <div className="pl-6 text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {section.content || '(No content)'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </>
  );
}
