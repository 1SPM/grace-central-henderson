import { CalendarEvent } from '../../types';
import { EventCategory, getDateSuggestions, timeSuggestions } from './CalendarConstants';

interface EventFormState {
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  location: string;
  category: EventCategory;
}

interface EventFormModalProps {
  eventForm: EventFormState;
  editingEvent: CalendarEvent | null;
  onFormChange: (updater: (prev: EventFormState) => EventFormState) => void;
  onSave: () => void;
  onClose: () => void;
}

export type { EventFormState };

export function EventFormModal({ eventForm, editingEvent, onFormChange, onSave, onClose }: EventFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="event-form-title" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-dark-700">
          <h2 id="event-form-title" className="text-lg font-semibold text-gray-900 dark:text-dark-100">
            {editingEvent ? 'Edit Event' : 'Create Event'}
          </h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Quick Templates */}
          {!editingEvent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                Quick Add
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { title: 'Sunday Service', category: 'service' as EventCategory, time: '10:00', location: 'Main Sanctuary' },
                  { title: 'Wednesday Bible Study', category: 'meeting' as EventCategory, time: '19:00', location: 'Fellowship Hall' },
                  { title: 'Youth Group', category: 'small-group' as EventCategory, time: '18:00', location: 'Youth Room' },
                  { title: 'Prayer Meeting', category: 'meeting' as EventCategory, time: '07:00', location: 'Chapel' },
                  { title: 'Leadership Meeting', category: 'meeting' as EventCategory, time: '18:30', location: 'Conference Room' },
                  { title: 'Potluck Dinner', category: 'event' as EventCategory, time: '17:00', location: 'Fellowship Hall' },
                ].map((template) => (
                  <button
                    key={template.title}
                    type="button"
                    onClick={() => onFormChange(prev => ({
                      ...prev,
                      title: template.title,
                      category: template.category,
                      startTime: template.time,
                      location: template.location,
                    }))}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                  >
                    {template.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              value={eventForm.title}
              onChange={(e) => onFormChange(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter event title"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'service', label: 'Service', activeClass: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30' },
                { value: 'meeting', label: 'Meeting', activeClass: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30' },
                { value: 'event', label: 'Event', activeClass: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30' },
                { value: 'small-group', label: 'Small Group', activeClass: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-500/30' },
                { value: 'holiday', label: 'Holiday', activeClass: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30' },
                { value: 'other', label: 'Other', activeClass: 'bg-gray-100 dark:bg-dark-600 text-gray-700 dark:text-dark-300 border-gray-300 dark:border-dark-500' },
              ].map(({ value, label, activeClass }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onFormChange(prev => ({ ...prev, category: value as EventCategory }))}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    eventForm.category === value
                      ? activeClass
                      : 'bg-gray-50 dark:bg-dark-800 text-gray-600 dark:text-dark-400 border-gray-200 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-dark-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={eventForm.allDay}
              onChange={(e) => onFormChange(prev => ({ ...prev, allDay: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-indigo-600"
            />
            <label htmlFor="allDay" className="text-sm text-gray-700 dark:text-dark-300">
              All day event
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={eventForm.startDate}
                onChange={(e) => onFormChange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
              {!editingEvent && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {getDateSuggestions().map(({ label, date }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onFormChange(prev => ({ ...prev, startDate: date }))}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        eventForm.startDate === date
                          ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400'
                          : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!eventForm.allDay && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={eventForm.startTime}
                  onChange={(e) => onFormChange(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
                {!editingEvent && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {timeSuggestions.map(({ label, time }) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => onFormChange(prev => ({ ...prev, startTime: time }))}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          eventForm.startTime === time
                            ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400'
                            : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={eventForm.endDate}
                onChange={(e) => onFormChange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
            {!eventForm.allDay && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={eventForm.endTime}
                  onChange={(e) => onFormChange(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Location
            </label>
            <input
              type="text"
              value={eventForm.location}
              onChange={(e) => onFormChange(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Enter location"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!eventForm.title || !eventForm.startDate}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {editingEvent ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
