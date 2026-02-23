import { useMemo } from 'react';
import { Clock, CheckCircle2, AlertCircle, ChevronRight, User, Plus } from 'lucide-react';
import { Task, Person } from '../../types';
import { StatusBadge, priorityToVariant } from './StatusBadge';

interface KanbanBoardProps {
  tasks: Task[];
  people: Person[];
  onViewTask?: (taskId: string) => void;
  onViewPerson?: (personId: string) => void;
  onAddTask?: () => void;
}

type ColumnType = 'overdue' | 'today' | 'upcoming' | 'completed';

interface KanbanColumn {
  id: ColumnType;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
}

const columns: KanbanColumn[] = [
  {
    id: 'overdue',
    title: 'Overdue',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-200 dark:border-rose-800/30',
    icon: <AlertCircle size={16} className="text-rose-500" />,
  },
  {
    id: 'today',
    title: 'Due Today',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800/30',
    icon: <Clock size={16} className="text-amber-500" />,
  },
  {
    id: 'upcoming',
    title: 'Upcoming',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800/30',
    icon: <ChevronRight size={16} className="text-blue-500" />,
  },
  {
    id: 'completed',
    title: 'Completed',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800/30',
    icon: <CheckCircle2 size={16} className="text-emerald-500" />,
  },
];

function getColumnForTask(task: Task): ColumnType {
  if (task.completed) return 'completed';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate < today) return 'overdue';
  if (dueDate.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

interface TaskCardProps {
  task: Task;
  person?: Person;
  onViewTask?: (taskId: string) => void;
  onViewPerson?: (personId: string) => void;
}

function TaskCard({ task, person, onViewTask, onViewPerson }: TaskCardProps) {
  return (
    <div
      className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onViewTask?.(task.id)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
          {task.title}
        </h4>
        <StatusBadge variant={priorityToVariant(task.priority)} icon>
          {task.priority}
        </StatusBadge>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-dark-700">
        {person ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewPerson?.(person.id);
            }}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-medium">
              {person.firstName[0]}{person.lastName[0]}
            </div>
            <span className="truncate max-w-[80px]">{person.firstName}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <User size={12} />
            <span>Unassigned</span>
          </div>
        )}

        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

export function KanbanBoard({ tasks, people, onViewTask, onViewPerson, onAddTask }: KanbanBoardProps) {
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  const groupedTasks = useMemo(() => {
    const groups: Record<ColumnType, Task[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      completed: [],
    };

    tasks.forEach(task => {
      const column = getColumnForTask(task);
      groups[column].push(task);
    });

    // Sort each column by priority, then by due date
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    Object.keys(groups).forEach(key => {
      groups[key as ColumnType].sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    });

    return groups;
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {columns.map(column => (
        <div key={column.id} className="flex flex-col">
          {/* Column Header */}
          <div className={`${column.bgColor} rounded-t-xl p-3 border ${column.borderColor} border-b-0`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {column.icon}
                <h3 className={`font-medium text-sm ${column.color}`}>{column.title}</h3>
              </div>
              <span className={`text-xs font-semibold ${column.color} bg-white dark:bg-dark-800 px-2 py-0.5 rounded-full`}>
                {groupedTasks[column.id].length}
              </span>
            </div>
          </div>

          {/* Column Content */}
          <div className={`flex-1 ${column.bgColor} rounded-b-xl p-3 border ${column.borderColor} border-t-0 min-h-[200px]`}>
            <div className="space-y-3">
              {groupedTasks[column.id].length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">
                  No tasks
                </p>
              ) : (
                groupedTasks[column.id].map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    person={task.personId ? personMap.get(task.personId) : undefined}
                    onViewTask={onViewTask}
                    onViewPerson={onViewPerson}
                  />
                ))
              )}
              {onAddTask && column.id !== 'completed' && (
                <button
                  onClick={onAddTask}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-dark-800/50 rounded-lg transition-colors"
                >
                  <Plus size={14} />
                  Add task
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
