import { useState } from 'react';
import { formatLocalDate } from '../utils/validation';
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
  Pencil,
  Smartphone,
  Loader2,
  Check,
  X,
  Users,
} from 'lucide-react';
import { Person, Interaction, Task, Giving, SmallGroup } from '../types';
import { STATUS_COLORS, PRIORITY_COLORS } from '../constants';
import { useIntegrations } from '../contexts/IntegrationsContext';
import { PersonGivingHistory } from './PersonGivingHistory';
import { escapeHtml } from '../utils/security';
import { AISuggestButton } from './AIAssistant';

interface PersonProfileProps {
  person: Person;
  interactions: Interaction[];
  tasks: Task[];
  giving?: Giving[];
  groups?: SmallGroup[];
  onBack: () => void;
  onAddInteraction: (interaction: Omit<Interaction, 'id' | 'createdAt'>) => void;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onToggleTask: (taskId: string) => void;
  onEditPerson?: (person: Person) => void;
  onViewAllGiving?: () => void;
  onAddToGroup?: (groupId: string, personId: string) => void;
  onRemoveFromGroup?: (groupId: string, personId: string) => void;
  onSendEmail?: () => void;
}

const interactionTypes = [
  { type: 'note', icon: <MessageSquare size={16} />, label: 'Note' },
  { type: 'call', icon: <PhoneCall size={16} />, label: 'Call' },
  { type: 'email', icon: <Send size={16} />, label: 'Email' },
  { type: 'text', icon: <Smartphone size={16} />, label: 'Text' },
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
  giving = [],
  groups = [],
  onBack,
  onAddInteraction,
  onAddTask,
  onToggleTask,
  onEditPerson,
  onViewAllGiving,
  onAddToGroup,
  onRemoveFromGroup,
  onSendEmail,
}: PersonProfileProps) {
  const { status: integrationStatus, sendEmail, sendSMS } = useIntegrations();

  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<Interaction['type']>('note');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState<{
    title: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
  }>({ title: '', dueDate: '', priority: 'medium' });

  // Communication states
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsMessage, setSmsMessage] = useState('');

  // Groups state
  const [showGroupSelector, setShowGroupSelector] = useState(false);

  // Compute person's groups
  const personGroups = groups.filter(g => g.members?.includes(person.id));
  const availableGroups = groups.filter(g => !g.members?.includes(person.id));

  const handleSendEmail = async () => {
    if (!person.email || !emailBody.trim()) return;

    setIsSending(true);
    setSendResult(null);

    try {
      const result = await sendEmail({
        to: { email: person.email, name: `${person.firstName} ${person.lastName}` },
        subject: emailSubject || `Message from Grace CRM`,
        html: `<div style="font-family: Arial, sans-serif;"><p>Hi ${escapeHtml(person.firstName)},</p><p>${escapeHtml(emailBody).replace(/\n/g, '<br/>')}</p></div>`,
        text: emailBody,
      });

      if (result.success) {
        // Log the interaction - mark as actually sent
        onAddInteraction({
          personId: person.id,
          type: 'email',
          content: `Subject: ${emailSubject}\n\n${emailBody}`,
          createdBy: 'You',
          sentVia: 'resend',
          messageId: result.messageId,
        });
        setSendResult({ success: true, message: 'Email sent successfully!' });
        setEmailSubject('');
        setEmailBody('');
        setTimeout(() => {
          setShowEmailModal(false);
          setSendResult(null);
        }, 2000);
      } else {
        setSendResult({ success: false, message: result.error || 'Failed to send email' });
      }
    } catch {
      setSendResult({ success: false, message: 'An error occurred while sending the email' });
    }

    setIsSending(false);
  };

  const handleSendSms = async () => {
    if (!person.phone || !smsMessage.trim()) return;

    setIsSending(true);
    setSendResult(null);

    try {
      const result = await sendSMS({
        to: person.phone,
        message: smsMessage,
      });

      if (result.success) {
        // Log the interaction - mark as actually sent
        onAddInteraction({
          personId: person.id,
          type: 'text',
          content: smsMessage,
          createdBy: 'You',
          sentVia: 'twilio',
          messageId: result.messageId,
        });
        setSendResult({ success: true, message: 'Text message sent successfully!' });
        setSmsMessage('');
        setTimeout(() => {
          setShowSmsModal(false);
          setSendResult(null);
        }, 2000);
      } else {
        setSendResult({ success: false, message: result.error || 'Failed to send text message' });
      }
    } catch {
      setSendResult({ success: false, message: 'An error occurred while sending the text' });
    }

    setIsSending(false);
  };

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
              <div className="relative">
                {person.photo ? (
                  <img
                    src={person.photo}
                    alt={`${person.firstName} ${person.lastName}`}
                    className="w-20 h-20 rounded-2xl object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl ${person.photo ? 'hidden' : ''}`}>
                  {person.firstName[0]}{person.lastName[0]}
                </div>
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
                {/* Quick Communication Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {person.email && onSendEmail && (
                    <button
                      onClick={onSendEmail}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20"
                      title="Compose email with templates"
                    >
                      <Mail size={16} />
                      Compose Email
                    </button>
                  )}
                  {person.email && integrationStatus.email && (
                    <button
                      onClick={() => setShowEmailModal(true)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                      title="Quick send email"
                    >
                      <Send size={16} />
                      Quick Send
                    </button>
                  )}
                  {person.phone && (
                    <button
                      onClick={() => setShowSmsModal(true)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        integrationStatus.sms
                          ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20'
                          : 'bg-gray-100 dark:bg-dark-800 text-gray-400 dark:text-dark-500 cursor-not-allowed'
                      }`}
                      disabled={!integrationStatus.sms}
                      title={integrationStatus.sms ? 'Send Text' : 'Configure SMS in Settings'}
                    >
                      <Smartphone size={16} />
                      Send Text
                    </button>
                  )}
                  {person.phone && (
                    <a
                      href={`tel:${person.phone}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                    >
                      <Phone size={16} />
                      Call
                    </a>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-dark-300">
                    <Mail size={16} className="text-gray-400 dark:text-dark-500" />
                    {person.email || <span className="text-gray-400">No email</span>}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-dark-300">
                    <Phone size={16} className="text-gray-400 dark:text-dark-500" />
                    {person.phone || <span className="text-gray-400">No phone</span>}
                  </div>
                  {person.joinDate && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-dark-300">
                      <Calendar size={16} className="text-gray-400 dark:text-dark-500" />
                      Joined {formatLocalDate(person.joinDate)}
                    </div>
                  )}
                  {person.firstVisit && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-dark-300">
                      <Calendar size={16} className="text-gray-400 dark:text-dark-500" />
                      First visit {formatLocalDate(person.firstVisit)}
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
                    const wasSent = !!interaction.sentVia;
                    const isEmailOrText = interaction.type === 'email' || interaction.type === 'text';

                    return (
                      <div
                        key={interaction.id}
                        className={`flex gap-4 pb-4 border-b border-gray-100 dark:border-dark-700 last:border-0 ${
                          wasSent ? 'bg-green-50/50 dark:bg-green-500/5 -mx-2 px-2 py-2 rounded-lg' : ''
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          wasSent
                            ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400'
                        }`}>
                          {typeConfig?.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {wasSent && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20 px-2 py-0.5 rounded-full">
                                <Check size={10} />
                                Sent via {interaction.sentVia === 'resend' ? 'Email' : 'SMS'}
                              </span>
                            )}
                            {isEmailOrText && !wasSent && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-dark-400 bg-gray-100 dark:bg-dark-700 px-2 py-0.5 rounded-full">
                                Logged
                              </span>
                            )}
                          </div>
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
          {/* Giving History */}
          <PersonGivingHistory
            personId={person.id}
            giving={giving}
            onViewAll={onViewAllGiving}
            compact
          />

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

          {/* Groups */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Groups</h2>
              {onAddToGroup && availableGroups.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowGroupSelector(!showGroupSelector)}
                    className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                  >
                    <Plus size={18} />
                  </button>
                  {showGroupSelector && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowGroupSelector(false)} />
                      <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 shadow-lg z-20 py-2 max-h-64 overflow-y-auto">
                        <p className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider border-b border-gray-100 dark:border-dark-700">
                          Add to Group
                        </p>
                        {availableGroups.map((group) => (
                          <button
                            key={group.id}
                            onClick={() => {
                              onAddToGroup(group.id, person.id);
                              setShowGroupSelector(false);
                            }}
                            className="w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                              <Users size={14} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                                {group.name}
                              </p>
                              {group.members && (
                                <p className="text-xs text-gray-500 dark:text-dark-400">
                                  {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {personGroups.length === 0 ? (
              <p className="text-gray-400 dark:text-dark-400 text-sm py-4 text-center">Not in any groups</p>
            ) : (
              <div className="space-y-2">
                {personGroups.map((group) => (
                  <div
                    key={group.id}
                    className="p-3 rounded-xl border border-gray-100 dark:border-dark-700 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Users size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                        {group.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        {group.members?.length || 0} member{(group.members?.length || 0) !== 1 ? 's' : ''}
                        {group.meetingDay && ` · ${group.meetingDay}`}
                      </p>
                    </div>
                    {onRemoveFromGroup && (
                      <button
                        onClick={() => onRemoveFromGroup(group.id, person.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remove from group"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                  Send Email to {person.firstName}
                </h2>
                <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setSendResult(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  To
                </label>
                <input
                  type="email"
                  value={person.email}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-800 text-gray-500 dark:text-dark-400 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Enter subject..."
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300">
                    Message
                  </label>
                  <AISuggestButton
                    context={{ type: 'email', person, purpose: emailSubject || 'check-in' }}
                    onGenerate={(text) => {
                      // Parse subject from AI response if present
                      const subjectMatch = text.match(/^Subject:\s*(.+?)(?:\n|$)/i);
                      if (subjectMatch) {
                        setEmailSubject(subjectMatch[1].trim());
                        setEmailBody(text.replace(/^Subject:\s*.+?\n+/i, '').trim());
                      } else {
                        setEmailBody(text);
                      }
                    }}
                  />
                </div>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Write your message..."
                  rows={5}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              {sendResult && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-2 ${
                    sendResult.success
                      ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                      : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                  }`}
                >
                  {sendResult.success ? <Check size={16} /> : <X size={16} />}
                  {sendResult.message}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setSendResult(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={isSending || !emailBody.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                  Send Text to {person.firstName}
                </h2>
                <button
                  onClick={() => {
                    setShowSmsModal(false);
                    setSendResult(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  To
                </label>
                <input
                  type="tel"
                  value={person.phone}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-800 text-gray-500 dark:text-dark-400 rounded-xl text-sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300">
                    Message
                  </label>
                  <AISuggestButton
                    context={{ type: 'sms', person, purpose: 'check-in' }}
                    onGenerate={(text) => setSmsMessage(text.slice(0, 160))}
                  />
                </div>
                <textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="Write your message..."
                  rows={4}
                  maxLength={160}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">
                  {smsMessage.length}/160 characters
                </p>
              </div>
              {sendResult && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-2 ${
                    sendResult.success
                      ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                      : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                  }`}
                >
                  {sendResult.success ? <Check size={16} /> : <X size={16} />}
                  {sendResult.message}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSmsModal(false);
                  setSendResult(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSendSms}
                disabled={isSending || !smsMessage.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Smartphone size={16} />
                    Send Text
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
