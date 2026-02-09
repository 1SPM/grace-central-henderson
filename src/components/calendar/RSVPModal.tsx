import { Check, X, HelpCircle } from 'lucide-react';
import { CalendarEvent, Person } from '../../types';
import { RSVP } from './CalendarConstants';

interface RSVPModalProps {
  selectedEvent: CalendarEvent;
  people: Person[];
  rsvpPersonId: string;
  rsvpStatus: RSVP['status'];
  rsvpGuests: number;
  onPersonChange: (personId: string) => void;
  onStatusChange: (status: RSVP['status']) => void;
  onGuestsChange: (guests: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function RSVPModal({
  selectedEvent,
  people,
  rsvpPersonId,
  rsvpStatus,
  rsvpGuests,
  onPersonChange,
  onStatusChange,
  onGuestsChange,
  onSubmit,
  onClose,
}: RSVPModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
            RSVP: {selectedEvent.title}
          </h2>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Select Person
            </label>
            <select
              value={rsvpPersonId}
              onChange={(e) => onPersonChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
            >
              <option value="">Choose a person...</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
              Response
            </label>
            <div className="flex gap-2">
              {[
                { status: 'yes' as const, icon: <Check size={16} />, label: 'Yes' },
                { status: 'no' as const, icon: <X size={16} />, label: 'No' },
                { status: 'maybe' as const, icon: <HelpCircle size={16} />, label: 'Maybe' },
              ].map(({ status, icon, label }) => (
                <button
                  key={status}
                  onClick={() => onStatusChange(status)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium ${
                    rsvpStatus === status
                      ? status === 'yes'
                        ? 'bg-emerald-500 text-white'
                        : status === 'no'
                        ? 'bg-red-500 text-white'
                        : 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {rsvpStatus === 'yes' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                Additional Guests
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={rsvpGuests}
                onChange={(e) => onGuestsChange(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!rsvpPersonId}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            Submit RSVP
          </button>
        </div>
      </div>
    </div>
  );
}
