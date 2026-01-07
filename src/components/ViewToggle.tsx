import { LayoutGrid, List } from 'lucide-react';

interface ViewToggleProps {
  view: 'card' | 'table';
  onViewChange: (view: 'card' | 'table') => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center bg-gray-100 dark:bg-dark-800 rounded-lg p-1">
      <button
        onClick={() => onViewChange('card')}
        className={`p-2 rounded-md transition-all ${
          view === 'card'
            ? 'bg-white dark:bg-dark-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
            : 'text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-300'
        }`}
        title="Card view"
      >
        <LayoutGrid size={18} />
      </button>
      <button
        onClick={() => onViewChange('table')}
        className={`p-2 rounded-md transition-all ${
          view === 'table'
            ? 'bg-white dark:bg-dark-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
            : 'text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-300'
        }`}
        title="Table view"
      >
        <List size={18} />
      </button>
    </div>
  );
}
