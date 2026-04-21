import {
  Church,
  Users,
  Calendar,
  BookOpen,
  BarChart3,
  GraduationCap,
  X,
  ArrowRight,
  Settings,
} from 'lucide-react';
import { useTutorial, TUTORIALS } from '../../contexts/TutorialContext';

const ICON_MAP: Record<string, typeof Church> = {
  Church,
  Users,
  Calendar,
  BookOpen,
  BarChart: BarChart3,
};

export function TutorialPickerModal() {
  const { isPickerOpen, closePicker, startTutorials } = useTutorial();

  if (!isPickerOpen) return null;

  const handleStart = (id: string) => {
    startTutorials([id]);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closePicker}
      />

      {/* Modal */}
      <div className="relative bg-stone-100 dark:bg-dark-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-700 w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 dark:border-dark-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
              <GraduationCap className="text-indigo-600 dark:text-indigo-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Quick Tours
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-400">
                Pick a workflow to walk through
              </p>
            </div>
          </div>
          <button
            onClick={closePicker}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Tutorial buttons */}
        <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(90vh-220px)]">
          {TUTORIALS.map(tutorial => {
            const Icon = ICON_MAP[tutorial.icon] ?? BookOpen;

            return (
              <button
                key={tutorial.id}
                onClick={() => handleStart(tutorial.id)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 text-left transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-dark-750 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Icon size={18} className="text-gray-500 dark:text-dark-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">
                    {tutorial.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-dark-400">
                    {tutorial.description}
                  </p>
                </div>
                <ArrowRight size={16} className="text-gray-300 dark:text-dark-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 flex-shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>

        {/* Footer — tells user where to find this later */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-dark-700/50 bg-gray-50 dark:bg-dark-850">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-dark-500">
              <Settings size={12} />
              You can find these anytime in Settings
            </p>
            <button
              onClick={closePicker}
              className="text-xs font-medium text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200 transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
