import { useState } from 'react';
import { X } from 'lucide-react';

export interface NewWorkOrderInput {
  title: string;
  description?: string;
  priority?: string;
  ministry?: string;
  due_date?: string;
}

interface WorkOrderCreateModalProps {
  onClose: () => void;
  onCreate: (input: NewWorkOrderInput) => Promise<unknown>;
}

export function WorkOrderCreateModal({ onClose, onCreate }: WorkOrderCreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [ministry, setMinistry] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        ministry: ministry.trim() || undefined,
        due_date: dueDate || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create Work Order.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="New Work Order">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-dark-850 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-dark-100">New Work Order</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-200">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="wo-title" className="block text-xs font-medium text-gray-600 dark:text-dark-300 mb-1">Title</label>
            <input
              id="wo-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2 text-sm text-gray-900 dark:text-dark-100"
              placeholder="e.g. Spring outreach follow-up plan"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="wo-description" className="block text-xs font-medium text-gray-600 dark:text-dark-300 mb-1">Description</label>
            <textarea
              id="wo-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2 text-sm text-gray-900 dark:text-dark-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="wo-priority" className="block text-xs font-medium text-gray-600 dark:text-dark-300 mb-1">Priority</label>
              <select
                id="wo-priority"
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2 text-sm text-gray-900 dark:text-dark-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label htmlFor="wo-due" className="block text-xs font-medium text-gray-600 dark:text-dark-300 mb-1">Due date</label>
              <input
                id="wo-due"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2 text-sm text-gray-900 dark:text-dark-100"
              />
            </div>
          </div>
          <div>
            <label htmlFor="wo-ministry" className="block text-xs font-medium text-gray-600 dark:text-dark-300 mb-1">Ministry (optional)</label>
            <input
              id="wo-ministry"
              value={ministry}
              onChange={e => setMinistry(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2 text-sm text-gray-900 dark:text-dark-100"
              placeholder="e.g. Youth, Worship, Impact Card Operations"
            />
          </div>
          {error && <p className="text-sm text-brand-600 dark:text-brand-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? 'Creating…' : 'Create Work Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
