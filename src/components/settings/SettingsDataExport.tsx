/**
 * Settings - Data Export Section
 */

import {
  Database,
  Download,
  Users,
  DollarSign,
  Calendar,
  CheckSquare,
  Heart,
  Upload,
} from 'lucide-react';
import { UsersIcon } from 'lucide-react';
import {
  exportPeopleToCSV,
  exportGivingToCSV,
  exportEventsToCSV,
  exportTasksToCSV,
  exportGroupsToCSV,
  exportPrayerRequestsToCSV,
  exportAllDataToCSV,
} from '../../utils/csvExport';
import type { Person, Task, CalendarEvent, Giving, SmallGroup, PrayerRequest } from '../../types';

interface SettingsDataExportProps {
  people: Person[];
  tasks: Task[];
  events: CalendarEvent[];
  giving: Giving[];
  groups: SmallGroup[];
  prayers: PrayerRequest[];
  onNavigate?: (view: 'reminders' | 'email-templates' | 'forms' | 'planning-center-import') => void;
}

export function SettingsDataExport({
  people,
  tasks,
  events,
  giving,
  groups,
  prayers,
  onNavigate,
}: SettingsDataExportProps) {
  return (
    <>
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-500/10 rounded-xl flex items-center justify-center">
            <Database className="text-green-600 dark:text-green-400" size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-dark-100">Data Export</h2>
            <p className="text-sm text-gray-500 dark:text-dark-400">Export data to CSV files</p>
          </div>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => exportAllDataToCSV({ people, giving, events, tasks, groups, prayers })}
            disabled={people.length === 0}
            className="w-full px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Export All Data
          </button>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => exportPeopleToCSV(people)}
              disabled={people.length === 0}
              className="px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg text-xs font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Users size={14} />
              People ({people.length})
            </button>
            <button
              onClick={() => exportGivingToCSV(giving, people)}
              disabled={giving.length === 0}
              className="px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg text-xs font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <DollarSign size={14} />
              Giving ({giving.length})
            </button>
            <button
              onClick={() => exportEventsToCSV(events)}
              disabled={events.length === 0}
              className="px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg text-xs font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Calendar size={14} />
              Events ({events.length})
            </button>
            <button
              onClick={() => exportTasksToCSV(tasks, people)}
              disabled={tasks.length === 0}
              className="px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg text-xs font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <CheckSquare size={14} />
              Tasks ({tasks.length})
            </button>
            <button
              onClick={() => exportGroupsToCSV(groups, people)}
              disabled={groups.length === 0}
              className="px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg text-xs font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <UsersIcon size={14} />
              Groups ({groups.length})
            </button>
            <button
              onClick={() => exportPrayerRequestsToCSV(prayers, people)}
              disabled={prayers.length === 0}
              className="px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg text-xs font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Heart size={14} />
              Prayers ({prayers.length})
            </button>
          </div>
        </div>
      </div>

      {/* Data Import */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/10 rounded-xl flex items-center justify-center">
            <Upload size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-dark-100">Data Import</h2>
            <p className="text-sm text-gray-500 dark:text-dark-400">Import from other systems</p>
          </div>
        </div>
        <div className="space-y-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('planning-center-import')}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              Import from Planning Center
            </button>
          )}
          <p className="text-xs text-gray-400 dark:text-dark-500 text-center pt-2">
            Import people, groups, and other data from Planning Center exports
          </p>
        </div>
      </div>
    </>
  );
}
