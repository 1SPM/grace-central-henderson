import { useState, useMemo } from 'react';
import { CheckSquare, Clock, Plus, User, AlertTriangle, Download, Repeat, RefreshCw } from 'lucide-react';
import { Task, Person, RecurrenceType } from '../types';
import { PRIORITY_COLORS } from '../constants';
import { exportTasksToCSV } from '../utils/exportCsv';
import { useToast } from './Toast';

interface TasksProps {
  tasks: Task[];
  people: Person[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
}

const recurrenceLabels: Record<RecurrenceType, string> = {
  none: 'No Repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

// Calculate next due date based on recurrence
function getNextDueDate(currentDueDate: string, recurrence: RecurrenceType): string {
  const date = new Date(currentDueDate);
  switch (recurrence) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    default:
      break;
  }
  return date.toISOString().split('T')[0];
}

type FilterType = 'all' | 'pending' | 'completed' | 'overdue';
type CategoryType = 'all' | 'follow-up' | 'care' | 'admin' | 'outreach';

export function Tasks({ tasks, people, onToggleTask, onAddTask }: TasksProps) {
  const toast = useToast();
  const [filter, setFilter] = useState<FilterType>('pending');
  const [categoryFilter, setCategoryFilter] = useState<CategoryType>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState<{
    title: string;
    description: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    category: 'follow-up' | 'care' | 'admin' | 'outreach';
    personId: string;
    recurrence: RecurrenceType;
  }>({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    category: 'follow-up',
    personId: '',
    recurrence: 'none'
  });

  // Memoize filtered and sorted tasks
  const sortedTasks = useMemo(() => {
    const now = new Date();
    const filteredTasks = tasks.filter((task) => {
      const isOverdue = !task.completed && new Date(task.dueDate) < now;

      let matchesFilter = true;
      if (filter === 'pending') matchesFilter = !task.completed;
      if (filter === 'completed') matchesFilter = task.completed;
      if (filter === 'overdue') matchesFilter = isOverdue;

      let matchesCategory = true;
      if (categoryFilter !== 'all') matchesCategory = task.category === categoryFilter;

      return matchesFilter && matchesCategory;
    });

    return [...filteredTasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks, filter, categoryFilter]);

  const handleAddTask = () => {
    if (!newTask.title.trim() || !newTask.dueDate) return;
    onAddTask({
      ...newTask,
      completed: false,
      personId: newTask.personId || undefined,
      recurrence: newTask.recurrence === 'none' ? undefined : newTask.recurrence
    });
    if (newTask.recurrence !== 'none') {
      toast.success(`Created recurring task: ${recurrenceLabels[newTask.recurrence]}`);
    }
    setNewTask({
      title: '',
      description: '',
      dueDate: '',
      priority: 'medium',
      category: 'follow-up',
      personId: '',
      recurrence: 'none'
    });
    setShowAdd(false);
  };

  // Handle completing a recurring task - create the next instance
  const handleToggleRecurringTask = (task: Task) => {
    onToggleTask(task.id);

    // If completing a recurring task, create the next instance
    if (!task.completed && task.recurrence && task.recurrence !== 'none') {
      const nextDueDate = getNextDueDate(task.dueDate, task.recurrence);
      onAddTask({
        title: task.title,
        description: task.description,
        dueDate: nextDueDate,
        completed: false,
        priority: task.priority,
        category: task.category,
        personId: task.personId,
        recurrence: task.recurrence,
        originalTaskId: task.originalTaskId || task.id,
      });
      toast.success(`Next "${task.title}" scheduled for ${new Date(nextDueDate).toLocaleDateString()}`);
    }
  };

  // Memoize counts (single pass)
  const counts = useMemo(() => {
    const now = new Date();
    const result = { all: tasks.length, pending: 0, completed: 0, overdue: 0 };
    tasks.forEach(t => {
      if (t.completed) {
        result.completed++;
      } else {
        result.pending++;
        if (new Date(t.dueDate) < now) {
          result.overdue++;
        }
      }
    });
    return result;
  }, [tasks]);

  // Memoize person lookup map for O(1) access
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Follow-Ups</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">Track and manage your care tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportTasksToCSV(tasks, people)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
          >
            <Download size={18} />
            Export
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            Add Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {(['pending', 'all', 'completed', 'overdue'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800'
                }`}
              >
                {f === 'overdue' && <AlertTriangle size={14} className="inline mr-1" />}
                {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'follow-up', 'care', 'admin', 'outreach'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  categoryFilter === c
                    ? 'bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-dark-200'
                    : 'text-gray-400 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800'
                }`}
              >
                {c === 'all' ? 'All Types' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-850 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">New Task</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Task title..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                placeholder="Description (optional)..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                  className="px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={newTask.category}
                  onChange={(e) => setNewTask({ ...newTask, category: e.target.value as Task['category'] })}
                  className="px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="follow-up">Follow-Up</option>
                  <option value="care">Care</option>
                  <option value="admin">Admin</option>
                  <option value="outreach">Outreach</option>
                </select>
                <select
                  value={newTask.personId}
                  onChange={(e) => setNewTask({ ...newTask, personId: e.target.value })}
                  className="px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">No person linked</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-400 mb-2">
                  <Repeat size={14} />
                  Recurrence
                </label>
                <select
                  value={newTask.recurrence}
                  onChange={(e) => setNewTask({ ...newTask, recurrence: e.target.value as RecurrenceType })}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {(Object.keys(recurrenceLabels) as RecurrenceType[]).map((key) => (
                    <option key={key} value={key}>{recurrenceLabels[key]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-700 rounded-xl text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                disabled={!newTask.title.trim() || !newTask.dueDate}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-3">
        {sortedTasks.map((task) => {
          const person = task.personId ? personMap.get(task.personId) : undefined;
          const isOverdue = !task.completed && new Date(task.dueDate) < new Date();

          return (
            <div
              key={task.id}
              className={`bg-white dark:bg-dark-850 rounded-xl border p-4 transition-all ${
                task.completed
                  ? 'border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-800/50'
                  : isOverdue
                    ? 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10'
                    : 'border-gray-200 dark:border-dark-700 hover:border-indigo-200 dark:hover:border-indigo-500/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggleRecurringTask(task)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 dark:border-dark-600 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`font-medium ${task.completed ? 'text-gray-400 dark:text-dark-500 line-through' : 'text-gray-900 dark:text-dark-100'}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">{task.description}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-dark-400">
                      <Clock size={14} className={isOverdue ? 'text-red-500 dark:text-red-400' : ''} />
                      <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                        {isOverdue ? 'Overdue: ' : 'Due: '}
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    {person && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-dark-400">
                        <User size={14} />
                        {person.firstName} {person.lastName}
                      </div>
                    )}
                    <span className="text-xs bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-300 px-2 py-0.5 rounded">
                      {task.category}
                    </span>
                    {task.recurrence && task.recurrence !== 'none' && (
                      <span className="flex items-center gap-1 text-xs bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded">
                        <RefreshCw size={10} />
                        {recurrenceLabels[task.recurrence]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sortedTasks.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700">
          <CheckSquare className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={48} />
          <p className="text-gray-400 dark:text-dark-400">No tasks found</p>
        </div>
      )}
    </div>
  );
}
