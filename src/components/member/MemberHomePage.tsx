import { useMemo } from 'react';
import { Users, QrCode, Clock, MapPin, Phone, Mail, Globe, ChevronRight, ShoppingBag, Shield } from 'lucide-react';
import type { CalendarEvent, MemberPortalTab } from '../../types';
import type { ChurchProfile } from '../../hooks/useChurchSettings';

interface MemberHomePageProps {
  churchName: string;
  churchProfile?: ChurchProfile;
  events: CalendarEvent[];
  onNavigate: (tab: MemberPortalTab) => void;
}

export function MemberHomePage({ churchName, churchProfile, events, onNavigate }: MemberHomePageProps) {
  // Get upcoming events (next 2)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => new Date(e.startDate) >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 2);
  }, [events]);

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
    <div className="p-4 space-y-5">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative">
          <p className="text-indigo-200 text-xs font-medium mb-0.5">Welcome to</p>
          <h1 className="text-xl font-bold mb-1">{churchName}</h1>
          <p className="text-indigo-100 text-xs">
            Explore, connect, and grow with us.
          </p>
        </div>
      </div>

      {/* Check In — prominent standalone action */}
      <button
        onClick={() => onNavigate('checkin')}
        className="w-full bg-white dark:bg-dark-800 rounded-xl p-4 border border-gray-100 dark:border-dark-700 text-left hover:shadow-md transition-shadow active:scale-[0.98] flex items-center gap-4"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0">
          <QrCode size={24} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm">Check In</h3>
          <p className="text-xs text-gray-500 dark:text-dark-400">Mark your attendance for today's service</p>
        </div>
        <ChevronRight size={16} className="text-gray-400" />
      </button>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider">
              Upcoming
            </h2>
            <button
              onClick={() => onNavigate('events')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5"
            >
              All Events
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {upcomingEvents.map(event => (
              <div
                key={event.id}
                className="bg-white dark:bg-dark-800 rounded-xl p-3.5 border border-gray-100 dark:border-dark-700"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-11 h-11 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex flex-col items-center justify-center">
                    <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                      {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-base font-bold text-indigo-700 dark:text-indigo-300 leading-none">
                      {new Date(event.startDate).getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm truncate">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-dark-400">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatEventDate(event.startDate)} · {formatEventTime(event.startDate)}
                      </span>
                    </div>
                    {event.location && (
                      <p className="text-xs text-gray-400 dark:text-dark-500 mt-0.5 flex items-center gap-1">
                        <MapPin size={11} />
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
      {(churchProfile?.serviceTimes?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2 px-1">
            Service Times
          </h2>
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 divide-y divide-gray-100 dark:divide-dark-700">
            {churchProfile?.serviceTimes.map((service, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 dark:bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <Clock size={16} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-dark-100 text-sm">{service.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-dark-400">{service.day} · {service.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* More — features moved from nav */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2 px-1">
          More
        </h2>
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 divide-y divide-gray-100 dark:divide-dark-700">
          {[
            { id: 'directory' as MemberPortalTab, label: 'Member Directory', desc: 'Find & connect with members', icon: Users, iconColor: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-500/20' },
            { id: 'shop' as MemberPortalTab, label: 'Church Shop', desc: 'Merch & resources', icon: ShoppingBag, iconColor: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-500/20' },
            { id: 'legacy' as MemberPortalTab, label: 'Legacy Planning', desc: 'Estate & planned giving', icon: Shield, iconColor: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-500/20' },
            { id: 'my-ministry' as MemberPortalTab, label: 'My Ministry', desc: 'Serve & volunteer', icon: Shield, iconColor: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-100 dark:bg-violet-500/20' },
          ].map(({ id, label, desc, icon: Icon, iconColor, bgColor }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors"
            >
              <div className={`w-9 h-9 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className={iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-dark-100 text-sm">{label}</h3>
                <p className="text-xs text-gray-500 dark:text-dark-400">{desc}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 dark:text-dark-600 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Contact Info */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2 px-1">
          Contact Us
        </h2>
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 p-4 space-y-2.5">
          {churchProfile?.phone && (
            <a href={`tel:${churchProfile.phone}`} className="flex items-center gap-3 text-sm text-gray-600 dark:text-dark-300 hover:text-indigo-600 dark:hover:text-indigo-400">
              <Phone size={15} className="text-gray-400" />
              {churchProfile.phone}
            </a>
          )}
          {churchProfile?.email && (
            <a href={`mailto:${churchProfile.email}`} className="flex items-center gap-3 text-sm text-gray-600 dark:text-dark-300 hover:text-indigo-600 dark:hover:text-indigo-400">
              <Mail size={15} className="text-gray-400" />
              {churchProfile.email}
            </a>
          )}
          {(churchProfile?.address || churchProfile?.city) && (
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-dark-300">
              <MapPin size={15} className="text-gray-400 flex-shrink-0" />
              {[churchProfile.address, churchProfile.city, churchProfile.state, churchProfile.zip].filter(Boolean).join(', ')}
            </div>
          )}
          {churchProfile?.website && (
            <a href={churchProfile.website.startsWith('http') ? churchProfile.website : `https://${churchProfile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-gray-600 dark:text-dark-300 hover:text-indigo-600 dark:hover:text-indigo-400">
              <Globe size={15} className="text-gray-400" />
              {churchProfile.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          {!churchProfile?.phone && !churchProfile?.email && !churchProfile?.address && !churchProfile?.website && (
            <p className="text-sm text-gray-400 dark:text-dark-500 text-center py-2">
              Contact info not configured yet
            </p>
          )}
        </div>
      </div>

      {/* Footer spacing for bottom nav */}
      <div className="h-4" />
    </div>
  );
}
