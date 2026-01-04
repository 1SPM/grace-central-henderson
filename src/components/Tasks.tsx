import { useState } from 'react';
import { CheckSquare, Clock, Plus, User, AlertTriangle } from 'lucide-react';
import { Task, Person } from '../types';
import { PRIORITY_COLORS } from '../constants';

interface TasksProps {
  tasks: Task[];
  people: Person[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
}

type FilterType = 'all' | 'pending' | 'completed' | 'overdue';
type CategoryType = 'all' | 'follow-up' | 'care' | 'admin' | 'outreach';

export function Tasks({ tasks, people, onToggleTask, onAddTask }: TasksProps) {
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
  }>({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    category: 'follow-up',
    personId: ''
  });

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

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const handleAddTask = () => {
    if (!newTask.title.trim() || !newTask.dueDate) return;
    onAddTask({
      ...newTask,
      completed: false,
      personId: newTask.personId || undefined
    });
    setNewTask({
      title: '',
      description: '',
      dueDate: '',
      priority: 'medium',
      category: 'follow-up',
      personId: ''
    });
    setShowAdd(false);
  };

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => !t.completed).length,
    completed: tasks.filter(t => t.completed).length,
    overdue: tasks.filter(t => !t.completed && new Date(t.dueDate) < now).length
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-Ups</h1>
          <p className="text-gray-500 mt-1">Track and manage your care tasks</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          Add Task
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(['pending', 'all', 'completed', 'overdue'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {f === 'overdue' && <AlertTriangle size={14} className="inline mr-1" />}
                {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['all', 'follow-up', 'care', 'admin', 'outreach'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  categoryFilter === c
                    ? 'bg-gray-200 text-gray-800'
                    : 'text-gray-400 hover:bg-gray-100'
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">New Task</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Task title..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                placeholder="Description (optional)..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="follow-up">Follow-Up</option>
                  <option value="care">Care</option>
                  <option value="admin">Admin</option>
                  <option value="outreach">Outreach</option>
                </select>
                <select
                  value={newTask.personId}
                  onChange={(e) => setNewTask({ ...newTask, personId: e.target.value })}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">No person linked</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
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
          const person = people.find(p => p.id === task.personId);
          const isOverdue = !task.completed && new Date(task.dueDate) < now;

          return (
            <div
              key={task.id}
              className={`bg-white rounded-xl border p-4 transition-all ${
                task.completed 
                  ? 'border-gray-100 bg-gray-50' 
                  : isOverdue 
                    ? 'border-red-200 bg-red-50' 
                    : 'border-gray-200 hover:border-indigo-200'
              }`}
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => onToggleTask(task.id)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`font-medium ${task.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock size={14} className={isOverdue ? 'text-red-500' : ''} />
                      <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                        {isOverdue ? 'Overdue: ' : 'Due: '}
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    {person && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <User size={14} />
                        {person.firstName} {person.lastName}
                      </div>
                    )}
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      {task.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sortedTasks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <CheckSquare className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-400">No tasks found</p>
        </div>
      )}
    </div>
  );
}
