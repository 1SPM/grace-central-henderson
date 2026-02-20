import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-14 h-14 bg-gray-100 dark:bg-dark-750 rounded-xl flex items-center justify-center mb-4 text-gray-400 dark:text-dark-500">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-600 dark:text-dark-300 text-center">{title}</p>
      {description && (
        <p className="text-xs text-gray-400 dark:text-dark-500 mt-1 text-center max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
