import { useState } from 'react';
import {
  Megaphone,
  Plus,
  Pin,
  Trash2,
  Pencil,
  X,
  AlertTriangle,
  Calendar,
  RefreshCw,
  PartyPopper,
  MessageCircle,
} from 'lucide-react';
import type { Announcement, AnnouncementCategory } from '../types';

const CATEGORY_CONFIG: Record<AnnouncementCategory, { label: string; icon: typeof Megaphone; bg: string; text: string }> = {
  general: { label: 'General', icon: Megaphone, bg: 'bg-blue-100 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  urgent: { label: 'Urgent', icon: AlertTriangle, bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  event: { label: 'Event', icon: Calendar, bg: 'bg-slate-100 dark:bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400' },
  update: { label: 'Update', icon: RefreshCw, bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  celebration: { label: 'Celebration', icon: PartyPopper, bg: 'bg-green-100 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400' },
};

interface AnnouncementManagerProps {
  announcements: Announcement[];
  onAdd: (data: { title: string; body?: string; category: AnnouncementCategory; pinned: boolean; expiresAt?: string }) => void;
  onUpdate: (id: string, data: Partial<Omit<Announcement, 'id' | 'churchId' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
}

export function AnnouncementManager({ announcements, onAdd, onUpdate, onDelete }: AnnouncementManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    body: '',
    category: 'general' as AnnouncementCategory,
    pinned: false,
    expiresAt: '',
  });

  const resetForm = () => {
    setForm({ title: '', body: '', category: 'general', pinned: false, expiresAt: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      body: a.body || '',
      category: a.category,
      pinned: a.pinned,
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 16) : '',
    });
    setEditingId(a.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    if (editingId) {
      onUpdate(editingId, {
        title: form.title,
        body: form.body || undefined,
        category: form.category,
        pinned: form.pinned,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      });
    } else {
      onAdd({
        title: form.title,
        body: form.body || undefined,
        category: form.category,
        pinned: form.pinned,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      });
    }
    resetForm();
  };

  const sorted = [...announcements].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center">
            <Megaphone className="text-indigo-600 dark:text-indigo-400" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Announcements</h1>
            <p className="text-sm text-gray-500 dark:text-dark-400">{announcements.length} announcement{announcements.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
        >
          <Plus size={16} />
          New Announcement
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              {editingId ? 'Edit Announcement' : 'New Announcement'}
            </h2>
            <button onClick={resetForm} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Announcement title..."
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl text-sm text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Body</label>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Announcement details..."
                rows={3}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl text-sm text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as AnnouncementCategory }))}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl text-sm text-gray-900 dark:text-dark-100"
                >
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Expires At</label>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl text-sm text-gray-900 dark:text-dark-100"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-dark-300 flex items-center gap-1">
                <Pin size={14} /> Pin to top
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-xl">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.title.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {editingId ? 'Save Changes' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {sorted.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-dark-600" />
          <p className="text-gray-500 dark:text-dark-400">No announcements yet</p>
          <p className="text-sm text-gray-400 dark:text-dark-500 mt-1">Create your first announcement to share with members</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(a => {
            const cfg = CATEGORY_CONFIG[a.category];
            const Icon = cfg.icon;
            const isExpired = a.expiresAt && new Date(a.expiresAt) < new Date();

            return (
              <div
                key={a.id}
                className={`bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-4 ${isExpired ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <Icon size={18} className={cfg.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-dark-100 truncate">{a.title}</h3>
                      {a.pinned && (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                          <Pin size={10} /> Pinned
                        </span>
                      )}
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      {isExpired && (
                        <span className="text-[10px] font-medium bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400 px-1.5 py-0.5 rounded-full">
                          Expired
                        </span>
                      )}
                    </div>
                    {a.body && (
                      <p className="text-sm text-gray-600 dark:text-dark-300 line-clamp-2">{a.body}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-dark-500">
                      <span>{new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      {a.createdBy && <span>by {a.createdBy}</span>}
                      {a.expiresAt && !isExpired && (
                        <span>Expires {new Date(a.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onUpdate(a.id, { pinned: !a.pinned })}
                      className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 ${a.pinned ? 'text-amber-500' : 'text-gray-400'}`}
                      title={a.pinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin size={16} />
                    </button>
                    <button
                      onClick={() => startEdit(a)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(a.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
