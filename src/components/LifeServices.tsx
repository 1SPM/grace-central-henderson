import { useState } from 'react';
import {
  Heart,
  Calendar,
  Users,
  FileText,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Flower2,
  Gift,
  Baby,
  Sparkles,
} from 'lucide-react';
import type { View, CalendarEvent } from '../types';

interface LifeServicesProps {
  onNavigate: (view: View) => void;
  events?: CalendarEvent[];
}

// Mock data for demonstration
const mockUpcomingEvents = [
  { id: '1', type: 'wedding', title: 'Johnson & Smith Wedding', date: '2026-02-14', location: 'Main Sanctuary' },
  { id: '2', type: 'funeral', title: 'Memorial Service - Margaret Williams', date: '2026-02-08', location: 'Chapel' },
  { id: '3', type: 'baptism', title: 'Baptism Service', date: '2026-02-15', location: 'Main Sanctuary' },
  { id: '4', type: 'dedication', title: 'Baby Dedication - Garcia Family', date: '2026-02-22', location: 'Main Sanctuary' },
];

const mockStats = {
  upcomingWeddings: 3,
  upcomingFunerals: 1,
  plannedGifts: 12,
  thisMonthEvents: 5,
};

const serviceCards = [
  {
    id: 'wedding-services',
    title: 'Weddings & Ceremonies',
    description: 'Plan and manage wedding ceremonies, rehearsals, and pre-marital counseling',
    icon: Heart,
    color: 'rose',
    stats: { label: 'Upcoming', value: 3 },
  },
  {
    id: 'funeral-services',
    title: 'Funerals & Memorials',
    description: 'Coordinate funeral services, memorial planning, and family support',
    icon: Flower2,
    color: 'purple',
    stats: { label: 'This Month', value: 1 },
  },
  {
    id: 'estate-planning',
    title: 'Legacy Giving',
    description: 'Estate planning, planned gifts, and legacy donation management',
    icon: Gift,
    color: 'amber',
    stats: { label: 'Planned Gifts', value: 12 },
  },
];

const quickActions = [
  { label: 'Schedule Wedding Consultation', icon: Heart, view: 'wedding-services' as View },
  { label: 'Plan Memorial Service', icon: Flower2, view: 'funeral-services' as View },
  { label: 'Record Planned Gift', icon: Gift, view: 'estate-planning' as View },
  { label: 'Schedule Baptism', icon: Sparkles, view: 'calendar' as View },
  { label: 'Baby Dedication', icon: Baby, view: 'calendar' as View },
];

const getEventIcon = (type: string) => {
  switch (type) {
    case 'wedding': return Heart;
    case 'funeral': return Flower2;
    case 'baptism': return Sparkles;
    case 'dedication': return Baby;
    default: return Calendar;
  }
};

const getEventColor = (type: string) => {
  switch (type) {
    case 'wedding': return 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20';
    case 'funeral': return 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20';
    case 'baptism': return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20';
    case 'dedication': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20';
    default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20';
  }
};

export function LifeServices({ onNavigate }: LifeServicesProps) {
  const [_stats] = useState(mockStats);
  const [upcomingEvents] = useState(mockUpcomingEvents);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Life Services</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            Manage weddings, funerals, baptisms, and legacy giving
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
          <Plus size={18} />
          <span>New Request</span>
        </button>
      </div>

      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {serviceCards.map((card) => {
          const Icon = card.icon;
          const colorClasses = {
            rose: 'from-rose-500 to-pink-600',
            purple: 'from-purple-500 to-violet-600',
            amber: 'from-amber-500 to-orange-600',
          }[card.color];

          return (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id as View)}
              className="group bg-white dark:bg-dark-850 rounded-xl p-5 text-left shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-dark-700 hover:border-gray-200 dark:hover:border-dark-600"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses} flex items-center justify-center shadow-sm`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900 dark:text-dark-100">{card.stats.value}</div>
                  <div className="text-xs text-gray-500 dark:text-dark-400">{card.stats.label}</div>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                {card.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-dark-400 mb-3">
                {card.description}
              </p>
              <div className="flex items-center text-sm text-violet-600 dark:text-violet-400 font-medium">
                <span>Manage</span>
                <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Events */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-850 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
          <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-2">
              <Calendar size={18} className="text-violet-600" />
              Upcoming Life Events
            </h2>
            <button
              onClick={() => onNavigate('calendar')}
              className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
            >
              View Calendar
            </button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {upcomingEvents.map((event) => {
              const Icon = getEventIcon(event.type);
              const colorClass = getEventColor(event.type);

              return (
                <div
                  key={event.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-dark-100 truncate">
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-dark-400">
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {new Date(event.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {event.location}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-400 dark:text-dark-500" />
                  </div>
                </div>
              );
            })}
          </div>
          {upcomingEvents.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-dark-400">
              No upcoming life events scheduled
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-dark-850 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
          <div className="p-4 border-b border-gray-100 dark:border-dark-700">
            <h2 className="font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-2">
              <Sparkles size={18} className="text-violet-600" />
              Quick Actions
            </h2>
          </div>
          <div className="p-2">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={() => onNavigate(action.view)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                    <Icon size={16} className="text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-dark-300">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resources & Forms */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-violet-100 dark:border-violet-800/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white dark:bg-dark-800 rounded-xl flex items-center justify-center shadow-sm">
            <FileText className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-1">
              Forms & Resources
            </h3>
            <p className="text-sm text-gray-600 dark:text-dark-400 mb-4">
              Access wedding applications, funeral planning guides, and legacy giving information packets.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors shadow-sm">
                Wedding Application
              </button>
              <button className="px-3 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors shadow-sm">
                Funeral Planning Guide
              </button>
              <button className="px-3 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors shadow-sm">
                Legacy Giving Packet
              </button>
              <button className="px-3 py-1.5 bg-white dark:bg-dark-800 rounded-lg text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors shadow-sm">
                Baptism Request
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-850 rounded-xl p-4 border border-gray-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
              <Heart size={18} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-dark-100">24</div>
              <div className="text-xs text-gray-500 dark:text-dark-400">Weddings This Year</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl p-4 border border-gray-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <Flower2 size={18} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-dark-100">8</div>
              <div className="text-xs text-gray-500 dark:text-dark-400">Memorial Services</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl p-4 border border-gray-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Users size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-dark-100">45</div>
              <div className="text-xs text-gray-500 dark:text-dark-400">Baptisms</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl p-4 border border-gray-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Gift size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-dark-100">$125K</div>
              <div className="text-xs text-gray-500 dark:text-dark-400">Planned Gifts</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
