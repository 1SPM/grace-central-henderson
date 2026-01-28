import { useMemo } from 'react';
import { Users, DollarSign, Calendar, QrCode, Clock, MapPin, Phone, Mail, Globe, ChevronRight, Heart } from 'lucide-react';
import type { CalendarEvent, MemberPortalTab } from '../../types';

interface MemberHomePageProps {
  churchName: string;
  events: CalendarEvent[];
  onNavigate: (tab: MemberPortalTab) => void;
}

export function MemberHomePage({ churchName, events, onNavigate }: MemberHomePageProps) {
  // Get upcoming events (next 3)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => new Date(e.startDate) >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3);
  }, [events]);

  const quickActions = [
    {
      id: 'directory' as MemberPortalTab,
      label: 'Directory',
      description: 'Find & connect',
      icon: Users,
      color: 'from-blue-500 to-indigo-600'
    },
    {
      id: 'events' as MemberPortalTab,
      label: 'Events',
      description: 'See what\'s happening',
      icon: Calendar,
      color: 'from-emerald-500 to-teal-600'
    },
    {
      id: 'giving' as MemberPortalTab,
      label: 'Give',
      description: 'Support our mission',
      icon: DollarSign,
      color: 'from-amber-500 to-orange-600'
    },
    {
      id: 'checkin' as MemberPortalTab,
      label: 'Check In',
      description: 'Sunday attendance',
      icon: QrCode,
      color: 'from-purple-500 to-violet-600'
    },
  ];

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const formatEventTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-2xl p-6 text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative">
          <p className="text-indigo-200 text-sm font-medium mb-1">Welcome to</p>
          <h1 className="text-2xl font-bold mb-2">{churchName}</h1>
          <p className="text-indigo-100 text-sm">
            We're so glad you're here. Explore, connect, and grow with us.
          </p>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-3 px-1">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(({ id, label, description, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="bg-white dark:bg-dark-800 rounded-xl p-4 border border-gray-100 dark:border-dark-700 text-left hover:shadow-md transition-shadow active:scale-[0.98]"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
                <Icon size={20} className="text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm">
                {label}
              </h3>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
                {description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider">
              Upcoming Events
            </h2>
            <button
              onClick={() => onNavigate('events')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1"
            >
              View All
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {upcomingEvents.map(event => (
              <div
                key={event.id}
                className="bg-white dark:bg-dark-800 rounded-xl p-4 border border-gray-100 dark:border-dark-700"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                      {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300 leading-none">
                      {new Date(event.startDate).getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm truncate">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-dark-400">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatEventDate(event.startDate)} · {formatEventTime(event.startDate)}
                      </span>
                    </div>
                    {event.location && (
                      <p className="text-xs text-gray-400 dark:text-dark-500 mt-1 flex items-center gap-1">
                        <MapPin size={12} />
                        {event.location}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Times */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-3 px-1">
          Service Times
        </h2>
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 divide-y divide-gray-100 dark:divide-dark-700">
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-dark-100 text-sm">Sunday Worship</h3>
              <p className="text-xs text-gray-500 dark:text-dark-400">9:00 AM & 11:00 AM</p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Heart size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-dark-100 text-sm">Wednesday Bible Study</h3>
              <p className="text-xs text-gray-500 dark:text-dark-400">7:00 PM</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-3 px-1">
          Contact Us
        </h2>
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 p-4 space-y-3">
          <a href="tel:+15551234567" className="flex items-center gap-3 text-sm text-gray-600 dark:text-dark-300 hover:text-indigo-600 dark:hover:text-indigo-400">
            <Phone size={16} className="text-gray-400" />
            (555) 123-4567
          </a>
          <a href="mailto:info@gracechurch.com" className="flex items-center gap-3 text-sm text-gray-600 dark:text-dark-300 hover:text-indigo-600 dark:hover:text-indigo-400">
            <Mail size={16} className="text-gray-400" />
            info@gracechurch.com
          </a>
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-dark-300">
            <MapPin size={16} className="text-gray-400 flex-shrink-0" />
            123 Faith Street, Graceville, GA 30301
          </div>
          <a href="https://gracechurch.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-gray-600 dark:text-dark-300 hover:text-indigo-600 dark:hover:text-indigo-400">
            <Globe size={16} className="text-gray-400" />
            www.gracechurch.com
          </a>
        </div>
      </div>

      {/* Footer spacing for bottom nav */}
      <div className="h-4" />
    </div>
  );
}
