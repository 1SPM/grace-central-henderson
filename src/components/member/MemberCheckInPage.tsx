import { useState, useMemo } from 'react';
import {
  QrCode,
  CheckCircle,
  Clock,
  MapPin,
  Calendar,
  Users,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { CalendarEvent, Attendance } from '../../types';

interface MemberCheckInPageProps {
  events: CalendarEvent[];
  attendance: Attendance[];
  personId?: string;
  personName?: string;
  onCheckIn?: (personId: string, eventType: Attendance['eventType'], eventName?: string) => void;
}

export function MemberCheckInPage({
  events,
  attendance,
  personId,
  personName,
  onCheckIn
}: MemberCheckInPageProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get today's events
  const todayEvents = useMemo(() => {
    const today = new Date().toDateString();
    return events.filter(e => new Date(e.startDate).toDateString() === today);
  }, [events]);

  // Check if already checked in today
  const todayCheckIns = useMemo(() => {
    if (!personId) return [];
    const today = new Date().toDateString();
    return attendance.filter(a =>
      a.personId === personId && new Date(a.date).toDateString() === today
    );
  }, [attendance, personId]);

  const isCheckedIn = (eventName?: string) => {
    return todayCheckIns.some(a => a.eventName === eventName);
  };

  // Recent attendance
  const recentAttendance = useMemo(() => {
    if (!personId) return [];
    return attendance
      .filter(a => a.personId === personId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [attendance, personId]);

  const handleCheckIn = async (eventType: Attendance['eventType'], eventName?: string) => {
    if (!personId || !onCheckIn) return;

    setIsChecking(true);
    setError(null);

    try {
      // Simulate slight delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));
      onCheckIn(personId, eventType, eventName);
      setCheckInSuccess(eventName || eventType);

      // Reset success message after 3 seconds
      setTimeout(() => setCheckInSuccess(null), 3000);
    } catch {
      setError('Check-in failed. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  // Map event category to attendance event type
  const getEventType = (category: CalendarEvent['category']): Attendance['eventType'] => {
    switch (category) {
      case 'service':
        return 'sunday';
      case 'small-group':
        return 'small-group';
      default:
        return 'special';
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-600" />
          Check In
        </h2>
        {personName && (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Welcome, {personName}!
          </p>
        )}
      </div>

      {/* Success Message */}
      {checkInSuccess && (
        <div className="mb-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0" size={24} />
          <div>
            <p className="font-medium text-green-800 dark:text-green-300">You're checked in!</p>
            <p className="text-sm text-green-600 dark:text-green-400">
              {checkInSuccess} - {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={24} />
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Today's Events */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-300 mb-3 flex items-center gap-2">
          <Calendar size={16} />
          Today's Events
        </h3>

        {todayEvents.length === 0 ? (
          <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-6 text-center">
            <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-dark-400">No events today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayEvents.map(event => {
              const checked = isCheckedIn(event.title);
              const eventTime = new Date(event.startDate);

              return (
                <div
                  key={event.id}
                  className={`bg-white dark:bg-dark-800 rounded-xl border p-4 ${
                    checked
                      ? 'border-green-300 dark:border-green-500/30'
                      : 'border-gray-200 dark:border-dark-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {event.title}
                        {checked && (
                          <CheckCircle className="text-green-500" size={18} />
                        )}
                      </h4>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-dark-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {eventTime.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {!checked && personId && onCheckIn && (
                      <button
                        onClick={() => handleCheckIn(getEventType(event.category), event.title)}
                        disabled={isChecking}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                      >
                        {isChecking ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <QrCode size={16} />
                        )}
                        Check In
                      </button>
                    )}

                    {checked && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium px-3 py-1.5 bg-green-50 dark:bg-green-500/10 rounded-lg">
                        Checked In
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Check-In Options */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-300 mb-3">
          Quick Check-In
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <QuickCheckInButton
            label="Sunday Service"
            icon={<Users size={20} />}
            eventType="sunday"
            checked={todayCheckIns.some(a => a.eventType === 'sunday')}
            onCheckIn={handleCheckIn}
            disabled={!personId || !onCheckIn || isChecking}
            isChecking={isChecking}
          />
          <QuickCheckInButton
            label="Wednesday"
            icon={<Calendar size={20} />}
            eventType="wednesday"
            checked={todayCheckIns.some(a => a.eventType === 'wednesday')}
            onCheckIn={handleCheckIn}
            disabled={!personId || !onCheckIn || isChecking}
            isChecking={isChecking}
          />
          <QuickCheckInButton
            label="Small Group"
            icon={<Users size={20} />}
            eventType="small-group"
            checked={todayCheckIns.some(a => a.eventType === 'small-group')}
            onCheckIn={handleCheckIn}
            disabled={!personId || !onCheckIn || isChecking}
            isChecking={isChecking}
          />
          <QuickCheckInButton
            label="Special Event"
            icon={<Calendar size={20} />}
            eventType="special"
            checked={todayCheckIns.some(a => a.eventType === 'special')}
            onCheckIn={handleCheckIn}
            disabled={!personId || !onCheckIn || isChecking}
            isChecking={isChecking}
          />
        </div>
      </div>

      {/* Recent Attendance */}
      {recentAttendance.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-300 mb-3 flex items-center gap-2">
            <Clock size={16} />
            Recent Attendance
          </h3>
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 divide-y divide-gray-100 dark:divide-dark-700">
            {recentAttendance.map(record => (
              <div key={record.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {record.eventName || record.eventType}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-dark-400">
                    {new Date(record.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <CheckCircle className="text-green-500" size={18} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not logged in message */}
      {!personId && (
        <div className="mt-6 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 text-center">
          <AlertCircle className="text-amber-600 dark:text-amber-400 mx-auto mb-2" size={24} />
          <p className="text-amber-800 dark:text-amber-300 font-medium">Please log in to check in</p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Sign in with your phone or email to track your attendance
          </p>
        </div>
      )}
    </div>
  );
}

function QuickCheckInButton({
  label,
  icon,
  eventType,
  checked,
  onCheckIn,
  disabled,
  isChecking
}: {
  label: string;
  icon: React.ReactNode;
  eventType: Attendance['eventType'];
  checked: boolean;
  onCheckIn: (eventType: Attendance['eventType'], eventName?: string) => void;
  disabled: boolean;
  isChecking: boolean;
}) {
  if (checked) {
    return (
      <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-4 text-center">
        <CheckCircle className="text-green-500 mx-auto mb-1" size={24} />
        <p className="text-sm font-medium text-green-700 dark:text-green-400">{label}</p>
        <p className="text-xs text-green-600 dark:text-green-500">Checked in</p>
      </div>
    );
  }

  return (
    <button
      onClick={() => onCheckIn(eventType)}
      disabled={disabled}
      className="bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl p-4 text-center active:scale-95 transition-transform disabled:opacity-50"
    >
      <div className="text-gray-500 dark:text-dark-400 mx-auto mb-1">
        {isChecking ? <Loader2 size={24} className="animate-spin mx-auto" /> : icon}
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-dark-300">{label}</p>
    </button>
  );
}
