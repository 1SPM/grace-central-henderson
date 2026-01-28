import { useState, useEffect, useRef } from 'react';
import {
  Church,
  Newspaper,
  Sparkles,
  Gift,
  Heart,
  Users,
  GripVertical,
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
  FileText,
  Loader2,
} from 'lucide-react';
import { Person, PrayerRequest } from '../types';
import { generateAIText } from '../lib/services/ai';

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

interface NewsItem {
  id: string;
  headline: string;
  connection: string;
  category: string;
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

// Simulated trending news - in production this would come from a news API
const defaultNewsItems: NewsItem[] = [
  {
    id: 'news-1',
    headline: 'Community Rallies Together After Local Tragedy',
    connection: 'Connect to bearing one another\'s burdens (Galatians 6:2) and the power of community in grief',
    category: 'Community',
  },
  {
    id: 'news-2',
    headline: 'Mental Health Awareness Month Highlights Growing Needs',
    connection: 'Link to casting anxieties on God (1 Peter 5:7) and finding peace that surpasses understanding',
    category: 'Health',
  },
  {
    id: 'news-3',
    headline: 'Economic Uncertainty Causes Widespread Anxiety',
    connection: 'Tie to Matthew 6:25-34 - do not worry about tomorrow, God provides',
    category: 'Economy',
  },
  {
    id: 'news-4',
    headline: 'Acts of Kindness Going Viral on Social Media',
    connection: 'Encourage congregation with examples of light in darkness (Matthew 5:14-16)',
    category: 'Inspiration',
  },
];

export function SundayPrep({ people, prayers }: SundayPrepProps) {
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

  const [newsItems, setNewsItems] = useState<NewsItem[]>(defaultNewsItems);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandingSection, setExpandingSection] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('sermon-title', sermonTitle);
  }, [sermonTitle]);

  useEffect(() => {
    localStorage.setItem('sermon-sections', JSON.stringify(sections));
  }, [sections]);

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

  const refreshNews = () => {
    setIsLoadingNews(true);
    setTimeout(() => {
      setNewsItems([...defaultNewsItems].sort(() => Math.random() - 0.5));
      setIsLoadingNews(false);
    }, 1000);
  };

  // Section drag handlers for reordering
  const handleSectionDragStart = (e: React.DragEvent, sectionId: string) => {
    setDraggingSectionId(sectionId);
    e.dataTransfer.setData('text/plain', sectionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleSectionDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (!draggingSectionId) return;

    const dragIndex = sections.findIndex(s => s.id === draggingSectionId);
    if (dragIndex === -1 || dragIndex === dropIndex) {
      setDraggingSectionId(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder sections
    const newSections = [...sections];
    const [draggedSection] = newSections.splice(dragIndex, 1);

    // Adjust drop index if we removed an item before it
    const adjustedIndex = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
    newSections.splice(adjustedIndex, 0, draggedSection);

    setSections(newSections);
    setDraggingSectionId(null);
    setDragOverIndex(null);
  };

  const handleSectionDragEnd = () => {
    setDraggingSectionId(null);
    setDragOverIndex(null);
  };

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
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">Trending Topics</span>
                  </div>
                  <button
                    onClick={refreshNews}
                    disabled={isLoadingNews}
                    className="p-1.5 hover:bg-cyan-100 dark:hover:bg-cyan-800/30 rounded-lg transition-colors"
                  >
                    <RefreshCw size={14} className={`text-cyan-600 dark:text-cyan-400 ${isLoadingNews ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                {newsItems.map(news => (
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
            {/* Sermon Title */}
            <div className="no-print">
              <input
                type="text"
                value={sermonTitle}
                onChange={(e) => setSermonTitle(e.target.value)}
                placeholder="Enter Sermon Title..."
                className="w-full px-4 py-3 text-xl font-semibold bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
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
            <div
              className={`space-y-3 min-h-[400px] p-4 bg-gray-50 dark:bg-dark-850 rounded-xl border-2 border-dashed transition-colors ${
                draggingSectionId ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-500/5' : 'border-gray-200 dark:border-dark-700'
              }`}
            >
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
                    <div key={section.id}>
                      {/* Drop zone before this section */}
                      <div
                        onDragOver={(e) => handleSectionDragOver(e, index)}
                        onDrop={(e) => handleSectionDrop(e, index)}
                        className={`h-2 -my-1 rounded transition-all ${
                          dragOverIndex === index && draggingSectionId !== section.id ? 'bg-violet-300 dark:bg-violet-500/50 h-8' : ''
                        }`}
                      />

                      <div
                        draggable
                        onDragStart={(e) => handleSectionDragStart(e, section.id)}
                        onDragEnd={handleSectionDragEnd}
                        className={`bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden shadow-sm hover:shadow-md transition-all ${
                          draggingSectionId === section.id ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Section Header */}
                        <div className={`${config.bgLight} ${config.bgDark} border-b ${config.borderLight} ${config.borderDark} px-4 py-2 flex items-center justify-between`}>
                          <div className="flex items-center gap-2">
                            <GripVertical size={14} className="text-gray-400 dark:text-dark-500 cursor-grab" />
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

                      {/* Drop zone after last section */}
                      {index === sections.length - 1 && (
                        <div
                          onDragOver={(e) => handleSectionDragOver(e, index + 1)}
                          onDrop={(e) => handleSectionDrop(e, index + 1)}
                          className={`h-2 mt-2 rounded transition-all ${
                            dragOverIndex === index + 1 ? 'bg-violet-300 dark:bg-violet-500/50 h-8' : ''
                          }`}
                        />
                      )}
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
