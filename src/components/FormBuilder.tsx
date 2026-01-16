import { useState } from 'react';
import {
  FormInput,
  Plus,
  Trash2,
  GripVertical,
  Copy,
  Eye,
  Save,
  ArrowLeft,
  Type,
  Mail,
  Phone,
  Calendar,
  List,
  CheckSquare,
  FileText,
  AlignLeft,
  Hash,
  Link as LinkIcon,
} from 'lucide-react';

interface FormBuilderProps {
  onBack?: () => void;
}

type FieldType = 'text' | 'email' | 'phone' | 'date' | 'select' | 'checkbox' | 'textarea' | 'number';

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For select fields
}

interface FormDefinition {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  createdAt: string;
  isPublished: boolean;
  responses: number;
}

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Text', icon: <Type className="w-4 h-4" /> },
  { type: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { type: 'phone', label: 'Phone', icon: <Phone className="w-4 h-4" /> },
  { type: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" /> },
  { type: 'number', label: 'Number', icon: <Hash className="w-4 h-4" /> },
  { type: 'select', label: 'Dropdown', icon: <List className="w-4 h-4" /> },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare className="w-4 h-4" /> },
  { type: 'textarea', label: 'Long Text', icon: <AlignLeft className="w-4 h-4" /> },
];

const FORM_TEMPLATES = [
  {
    name: 'Event Registration',
    description: 'Sign up for an event',
    fields: [
      { type: 'text' as FieldType, label: 'Full Name', required: true },
      { type: 'email' as FieldType, label: 'Email', required: true },
      { type: 'phone' as FieldType, label: 'Phone', required: false },
      { type: 'number' as FieldType, label: 'Number of Attendees', required: true },
      { type: 'checkbox' as FieldType, label: 'Need childcare?', required: false },
    ],
  },
  {
    name: 'Volunteer Application',
    description: 'Apply to serve in ministry',
    fields: [
      { type: 'text' as FieldType, label: 'Full Name', required: true },
      { type: 'email' as FieldType, label: 'Email', required: true },
      { type: 'phone' as FieldType, label: 'Phone', required: true },
      { type: 'select' as FieldType, label: 'Area of Interest', required: true, options: ['Worship', 'Kids Ministry', 'Hospitality', 'Tech', 'Other'] },
      { type: 'textarea' as FieldType, label: 'Why do you want to volunteer?', required: false },
    ],
  },
  {
    name: 'Prayer Request',
    description: 'Submit a prayer request',
    fields: [
      { type: 'text' as FieldType, label: 'Your Name', required: false },
      { type: 'email' as FieldType, label: 'Email (optional)', required: false },
      { type: 'textarea' as FieldType, label: 'Prayer Request', required: true },
      { type: 'checkbox' as FieldType, label: 'Share with prayer team only', required: false },
    ],
  },
];

function generateId(): string {
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FormBuilder({ onBack }: FormBuilderProps) {
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [editingForm, setEditingForm] = useState<FormDefinition | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const createNewForm = (template?: typeof FORM_TEMPLATES[0]) => {
    const newForm: FormDefinition = {
      id: `form-${Date.now()}`,
      name: template?.name || 'Untitled Form',
      description: template?.description || '',
      fields: template?.fields.map(f => ({
        ...f,
        id: generateId(),
        placeholder: '',
      })) || [],
      createdAt: new Date().toISOString(),
      isPublished: false,
      responses: 0,
    };
    setForms(prev => [...prev, newForm]);
    setEditingForm(newForm);
    setShowTemplates(false);
  };

  const saveForm = () => {
    if (!editingForm) return;
    setForms(prev => prev.map(f => (f.id === editingForm.id ? editingForm : f)));
    setEditingForm(null);
  };

  const addField = (type: FieldType) => {
    if (!editingForm) return;
    const newField: FormField = {
      id: generateId(),
      type,
      label: `${FIELD_TYPES.find(t => t.type === type)?.label || 'Field'}`,
      required: false,
      options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    };
    setEditingForm({
      ...editingForm,
      fields: [...editingForm.fields, newField],
    });
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    if (!editingForm) return;
    setEditingForm({
      ...editingForm,
      fields: editingForm.fields.map(f =>
        f.id === fieldId ? { ...f, ...updates } : f
      ),
    });
  };

  const deleteField = (fieldId: string) => {
    if (!editingForm) return;
    setEditingForm({
      ...editingForm,
      fields: editingForm.fields.filter(f => f.id !== fieldId),
    });
  };

  const duplicateField = (field: FormField) => {
    if (!editingForm) return;
    const newField = { ...field, id: generateId() };
    setEditingForm({
      ...editingForm,
      fields: [...editingForm.fields, newField],
    });
  };

  const togglePublish = (formId: string) => {
    setForms(prev =>
      prev.map(f =>
        f.id === formId ? { ...f, isPublished: !f.isPublished } : f
      )
    );
  };

  const deleteForm = (formId: string) => {
    setForms(prev => prev.filter(f => f.id !== formId));
  };

  // Form list view
  if (!editingForm) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FormInput className="w-6 h-6 text-indigo-600" />
                Forms Builder
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Create custom forms for events, signups, and more
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            New Form
          </button>
        </div>

        {/* Forms List */}
        {forms.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <FormInput className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No forms yet</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first form to collect responses</p>
            <button
              onClick={() => setShowTemplates(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-5 h-5" />
              Create Form
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {forms.map(form => (
              <div
                key={form.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center justify-between"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{form.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{form.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-gray-500">{form.fields.length} fields</span>
                    <span className="text-gray-500">{form.responses} responses</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      form.isPublished
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {form.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {form.isPublished && (
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/forms/${form.id}`)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      title="Copy link"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditingForm(form)}
                    className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => togglePublish(form.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      form.isPublished
                        ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                        : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                    }`}
                  >
                    {form.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => deleteForm(form.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Template Modal */}
        {showTemplates && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Create New Form</h2>

              <button
                onClick={() => createNewForm()}
                className="w-full p-4 mb-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Plus className="w-8 h-8 text-gray-400" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Blank Form</p>
                    <p className="text-sm text-gray-500">Start from scratch</p>
                  </div>
                </div>
              </button>

              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Or start from a template:</p>

              <div className="space-y-3">
                {FORM_TEMPLATES.map((template, i) => (
                  <button
                    key={i}
                    onClick={() => createNewForm(template)}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <p className="font-semibold text-gray-900 dark:text-white">{template.name}</p>
                    <p className="text-sm text-gray-500">{template.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{template.fields.length} fields</p>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowTemplates(false)}
                className="w-full mt-4 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Form editor view
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Editor Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setEditingForm(null)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <input
              type="text"
              value={editingForm.name}
              onChange={e => setEditingForm({ ...editingForm, name: e.target.value })}
              className="text-xl font-bold text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1"
              placeholder="Form Name"
            />
            <input
              type="text"
              value={editingForm.description || ''}
              onChange={e => setEditingForm({ ...editingForm, description: e.target.value })}
              className="block text-sm text-gray-500 dark:text-gray-400 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1 mt-1"
              placeholder="Form description (optional)"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              showPreview
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={saveForm}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Field Types */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sticky top-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Add Field</h3>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_TYPES.map(ft => (
                <button
                  key={ft.type}
                  onClick={() => addField(ft.type)}
                  className="flex items-center gap-2 p-3 text-sm text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                >
                  <span className="text-gray-500">{ft.icon}</span>
                  <span className="text-gray-700 dark:text-gray-300">{ft.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Form Fields / Preview */}
        <div className="lg:col-span-2">
          {showPreview ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{editingForm.name}</h2>
              {editingForm.description && (
                <p className="text-gray-500 dark:text-gray-400 mb-6">{editingForm.description}</p>
              )}
              <div className="space-y-4">
                {editingForm.fields.map(field => (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
                        placeholder={field.placeholder}
                        rows={3}
                        disabled
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
                        disabled
                      >
                        <option>Select...</option>
                        {field.options?.map(opt => (
                          <option key={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2">
                        <input type="checkbox" disabled className="w-4 h-4 rounded" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{field.label}</span>
                      </label>
                    ) : (
                      <input
                        type={field.type}
                        className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
                        placeholder={field.placeholder}
                        disabled
                      />
                    )}
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold" disabled>
                Submit
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {editingForm.fields.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500">Add fields from the left panel</p>
                </div>
              ) : (
                editingForm.fields.map((field) => (
                  <div
                    key={field.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-1 text-gray-400 cursor-move">
                        <GripVertical className="w-5 h-5" />
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">
                            {FIELD_TYPES.find(t => t.type === field.type)?.icon}
                          </span>
                          <input
                            type="text"
                            value={field.label}
                            onChange={e => updateField(field.id, { label: e.target.value })}
                            className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            placeholder="Field label"
                          />
                          <label className="flex items-center gap-1 text-sm text-gray-500">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={e => updateField(field.id, { required: e.target.checked })}
                              className="rounded"
                            />
                            Required
                          </label>
                        </div>

                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={e => updateField(field.id, { placeholder: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                          placeholder="Placeholder text (optional)"
                        />

                        {field.type === 'select' && (
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Options (one per line)</label>
                            <textarea
                              value={field.options?.join('\n') || ''}
                              onChange={e =>
                                updateField(field.id, { options: e.target.value.split('\n').filter(Boolean) })
                              }
                              className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                              rows={3}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => duplicateField(field)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => deleteField(field.id)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
