import { useState } from 'react';
import { Plus, UserPlus, CheckSquare, Heart, X } from 'lucide-react';

interface QuickActionsProps {
  onAddPerson: () => void;
  onAddTask: () => void;
  onAddPrayer: () => void;
}

export function QuickActions({ onAddPerson, onAddTask, onAddPrayer }: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      label: 'Add Person',
      icon: <UserPlus size={20} />,
      onClick: onAddPerson,
      color: 'bg-indigo-500 hover:bg-indigo-600 text-white'
    },
    {
      label: 'Add Task',
      icon: <CheckSquare size={20} />,
      onClick: onAddTask,
      color: 'bg-amber-500 hover:bg-amber-600 text-white'
    },
    {
      label: 'Add Prayer',
      icon: <Heart size={20} />,
      onClick: onAddPrayer,
      color: 'bg-rose-500 hover:bg-rose-600 text-white'
    },
  ];

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Action buttons */}
      <div className={`flex flex-col-reverse gap-3 mb-3 transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        {actions.map((action, index) => (
          <div
            key={action.label}
            className="flex items-center gap-3 justify-end"
            style={{
              transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
              transform: isOpen ? 'scale(1)' : 'scale(0.8)',
              opacity: isOpen ? 1 : 0,
              transition: 'all 0.2s ease-out'
            }}
          >
            <span className="px-3 py-1.5 bg-gray-900 dark:bg-dark-700 text-white text-sm font-medium rounded-lg shadow-lg whitespace-nowrap">
              {action.label}
            </span>
            <button
              onClick={() => handleAction(action.onClick)}
              className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 ${action.color}`}
            >
              {action.icon}
            </button>
          </div>
        ))}
      </div>

      {/* Main FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-gray-700 dark:bg-dark-600 rotate-45'
            : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 hover:scale-110'
        }`}
      >
        {isOpen ? (
          <X size={24} className="text-white" />
        ) : (
          <Plus size={24} className="text-white" />
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
