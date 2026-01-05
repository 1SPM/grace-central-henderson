import { useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Tag,
  MessageSquare,
  PhoneCall,
  Send,
  Home,
  Heart,
  Plus,
  Clock,
  Pencil
} from 'lucide-react';
import { Person, Interaction, Task } from '../types';
import { STATUS_COLORS, PRIORITY_COLORS } from '../constants';

interface PersonProfileProps {
  person: Person;
  interactions: Interaction[];
  tasks: Task[];
  onBack: () => void;
  onAddInteraction: (interaction: Omit<Interaction, 'id' | 'createdAt'>) => void;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onToggleTask: (taskId: string) => void;
  onEditPerson?: (person: Person) => void;
}

const interactionTypes = [
  { type: 'note', icon: <MessageSquare size={16} />, label: 'Note' },
  { type: 'call', icon: <PhoneCall size={16} />, label: 'Call' },
  { type: 'email', icon: <Send size={16} />, label: 'Email' },
  { type: 'visit', icon: <Home size={16} />, label: 'Visit' },
  { type: 'prayer', icon: <Heart size={16} />, label: 'Prayer' },
] as const;

const statusLabels: Record<string, string> = {
  visitor: 'Visitor',
  regular: 'Regular',
  member: 'Member',
  leader: 'Leader',
  inactive: 'Inactive'
};

export function PersonProfile({
  person,
  interactions,
  tasks,
  onBack,
  onAddInteraction,
  onAddTask,
  onToggleTask,
  onEditPerson
}: PersonProfileProps) {
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<Interaction['type']>('note');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState<{
    title: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
  }>({ title: '', dueDate: '', priority: 'medium' });

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    onAddInteraction({
      personId: person.id,
      type: noteType,
      content: newNote,
      createdBy: 'You'
    });
    setNewNote('');
  };

  const handleAddTask = () => {
    if (!newTask.title.trim() || !newTask.dueDate) return;
    onAddTask({
      personId: person.id,
      title: newTask.title,
      dueDate: newTask.dueDate,
      priority: newTask.priority,
      completed: false,
      category: 'follow-up'
    });
    setNewTask({ title: '', dueDate: '', priority: 'medium' });
    setShowAddTask(false);
  };

  const personTasks = tasks.filter(t => t.personId === person.id);
  const personInteractions = interactions.filter(i => i.personId === person.id);

  return (
    <div className="p-8">
      {/* Header */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200 mb-6"
      >
        <ArrowLeft size={18} />
        Back to People
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl">
                {person.firstName[0]}{person.lastName[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                      {person.firstName} {person.lastName}
                    </h1>
                    <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[person.status]}`}>
                      {statusLabels[person.status]}
                    </span>
                  </div>
                  {onEditPerson && (
                    <button
                      onClick={() => onEditPerson(person)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
                    >
                      <Pencil size={16} />
                      Edit
                    </button>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-dark-300">
                    <Mail size={16} className="text-gray-400 dark:text-dark-500" />
                    {person.email}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-dark-300">
                    <Phone size={16} className="text-gray-400 dark:text-dark-500" />
                    {person.phone}
                  </div>
                  {person.joinDate && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-dark-300">
                      <Calendar size={16} className="text-gray-400 dark:text-dark-500" />
                      Joined {new Date(person.joinDate).toLocaleDateString()}
                    </div>
                  )}
                  {person.firstVisit && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-dark-300">
                      <Calendar size={16} className="text-gray-400 dark:text-dark-500" />
                      First visit {new Date(person.firstVisit).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {person.tags.length > 0 && (
                  <div className="flex items-center gap-2 mt-4">
                    <Tag size={14} className="text-gray-400 dark:text-dark-500" />
                    {person.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {person.notes && (
              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-dark-700">
                <p className="text-sm text-gray-600 dark:text-dark-300">{person.notes}</p>
              </div>
            )}
          </div>

          {/* Add Interaction */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">Log Interaction</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {interactionTypes.map(({ type, icon, label }) => (
                <button
                  key={type}
                  onClick={() => setNoteType(type)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    noteType === type
                      ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                      : 'bg-gray-50 dark:bg-dark-800 text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this interaction..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Interaction
              </button>
            </div>
          </div>

          {/* Interaction History */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">History</h2>
            {personInteractions.length === 0 ? (
              <p className="text-gray-400 dark:text-dark-400 text-sm py-4 text-center">No interactions recorded yet</p>
            ) : (
              <div className="space-y-4">
                {personInteractions
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((interaction) => {
                    const typeConfig = interactionTypes.find(t => t.type === interaction.type);
                    return (
                      <div key={interaction.id} className="flex gap-4 pb-4 border-b border-gray-100 dark:border-dark-700 last:border-0">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-dark-700 rounded-lg flex items-center justify-center text-gray-500 dark:text-dark-400">
                          {typeConfig?.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-700 dark:text-dark-200">{interaction.content}</p>
                          <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">
                            {interaction.createdBy} · {new Date(interaction.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tasks */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Tasks</h2>
              <button
                onClick={() => setShowAddTask(!showAddTask)}
                className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
              >
                <Plus size={18} />
              </button>
            </div>

            {showAddTask && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-dark-800 rounded-xl space-y-3">
                <input
                  type="text"
                  placeholder="Task title..."
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <button
                  onClick={handleAddTask}
                  className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Add Task
                </button>
              </div>
            )}

            {personTasks.length === 0 ? (
              <p className="text-gray-400 dark:text-dark-400 text-sm py-4 text-center">No tasks</p>
            ) : (
              <div className="space-y-2">
                {personTasks.map((task) => {
                  const isOverdue = !task.completed && new Date(task.dueDate) < new Date();
                  return (
                    <div
                      key={task.id}
                      className={`p-3 rounded-xl border ${
                        task.completed
                          ? 'bg-gray-50 dark:bg-dark-800/50 border-gray-100 dark:border-dark-700'
                          : isOverdue
                            ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
                            : 'border-gray-100 dark:border-dark-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => onToggleTask(task.id)}
                          className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${task.completed ? 'text-gray-400 dark:text-dark-500 line-through' : 'text-gray-900 dark:text-dark-100'}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock size={12} className={isOverdue ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-dark-500'} />
                            <span className={`text-xs ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-dark-500'}`}>
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
