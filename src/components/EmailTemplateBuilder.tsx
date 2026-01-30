import { useState, useMemo } from 'react';
import {
  Mail,
  Save,
  Eye,
  X,
  Type,
  Image,
  Columns,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Trash2,
  MoveUp,
  MoveDown,
  Copy,
  Settings,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface EmailBlock {
  id: string;
  type: 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns' | 'header' | 'footer';
  content: Record<string, any>;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  blocks: EmailBlock[];
  styles: {
    backgroundColor: string;
    fontFamily: string;
    contentWidth: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface EmailTemplateBuilderProps {
  onBack?: () => void;
  onSave?: (template: EmailTemplate) => void;
}

const DEFAULT_STYLES = {
  backgroundColor: '#f7f7f7',
  fontFamily: 'Arial, sans-serif',
  contentWidth: 600,
};

const BLOCK_TYPES = [
  { type: 'header', label: 'Header', icon: AlignCenter, description: 'Church logo and heading' },
  { type: 'text', label: 'Text', icon: Type, description: 'Paragraph text' },
  { type: 'image', label: 'Image', icon: Image, description: 'Image with optional caption' },
  { type: 'button', label: 'Button', icon: Link2, description: 'Call-to-action button' },
  { type: 'divider', label: 'Divider', icon: AlignCenter, description: 'Horizontal line' },
  { type: 'spacer', label: 'Spacer', icon: MoveDown, description: 'Empty space' },
  { type: 'columns', label: '2 Columns', icon: Columns, description: 'Two column layout' },
  { type: 'footer', label: 'Footer', icon: AlignCenter, description: 'Unsubscribe and contact' },
];

const COLOR_PRESETS = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#dc2626', // Red
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#ea580c', // Orange
];

// Template presets
const TEMPLATE_PRESETS: Partial<EmailTemplate>[] = [
  {
    name: 'Weekly Newsletter',
    subject: 'This Week at {{church_name}}',
    blocks: [
      { id: '1', type: 'header', content: { title: 'Weekly Update', subtitle: 'Stay Connected' } },
      { id: '2', type: 'text', content: { html: '<p>Dear {{first_name}},</p><p>Here\'s what\'s happening this week at our church...</p>' } },
      { id: '3', type: 'divider', content: {} },
      { id: '4', type: 'text', content: { html: '<h3>Upcoming Events</h3><p>Share upcoming events and activities here.</p>' } },
      { id: '5', type: 'button', content: { text: 'View Full Calendar', url: '{{calendar_link}}', color: '#4f46e5' } },
      { id: '6', type: 'footer', content: { showUnsubscribe: true } },
    ],
  },
  {
    name: 'Event Invitation',
    subject: 'You\'re Invited: {{event_name}}',
    blocks: [
      { id: '1', type: 'header', content: { title: 'You\'re Invited!', subtitle: '' } },
      { id: '2', type: 'image', content: { url: '', alt: 'Event image' } },
      { id: '3', type: 'text', content: { html: '<h2 style="text-align:center;">{{event_name}}</h2><p style="text-align:center;">{{event_date}} at {{event_time}}</p>' } },
      { id: '4', type: 'text', content: { html: '<p>Dear {{first_name}},</p><p>We would love to see you at this special event...</p>' } },
      { id: '5', type: 'button', content: { text: 'RSVP Now', url: '{{rsvp_link}}', color: '#059669' } },
      { id: '6', type: 'footer', content: { showUnsubscribe: true } },
    ],
  },
  {
    name: 'Welcome Email',
    subject: 'Welcome to {{church_name}}!',
    blocks: [
      { id: '1', type: 'header', content: { title: 'Welcome!', subtitle: 'We\'re glad you\'re here' } },
      { id: '2', type: 'text', content: { html: '<p>Dear {{first_name}},</p><p>Thank you for visiting us! We\'re so glad you came and we hope you felt welcomed.</p>' } },
      { id: '3', type: 'text', content: { html: '<h3>Next Steps</h3><ul><li>Connect with a small group</li><li>Learn about volunteer opportunities</li><li>Join us next Sunday</li></ul>' } },
      { id: '4', type: 'button', content: { text: 'Get Connected', url: '{{connect_link}}', color: '#4f46e5' } },
      { id: '5', type: 'footer', content: { showUnsubscribe: true } },
    ],
  },
];

// Available merge tags
const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{email}}', label: 'Email' },
  { tag: '{{church_name}}', label: 'Church Name' },
  { tag: '{{event_name}}', label: 'Event Name' },
  { tag: '{{event_date}}', label: 'Event Date' },
  { tag: '{{event_time}}', label: 'Event Time' },
];

export function EmailTemplateBuilder({ onBack, onSave }: EmailTemplateBuilderProps) {
  const [template, setTemplate] = useState<EmailTemplate>({
    id: `tpl-${Date.now()}`,
    name: 'New Template',
    subject: '',
    blocks: [],
    styles: { ...DEFAULT_STYLES },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);

  const selectedBlock = useMemo(() => {
    return template.blocks.find(b => b.id === selectedBlockId);
  }, [template.blocks, selectedBlockId]);

  const addBlock = (type: EmailBlock['type']) => {
    const newBlock: EmailBlock = {
      id: `block-${Date.now()}`,
      type,
      content: getDefaultContent(type),
    };

    setTemplate(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
      updatedAt: new Date().toISOString(),
    }));
    setSelectedBlockId(newBlock.id);
    setShowTemplates(false);
  };

  const getDefaultContent = (type: EmailBlock['type']): Record<string, any> => {
    switch (type) {
      case 'header':
        return { title: 'Your Church Name', subtitle: 'Newsletter', logoUrl: '' };
      case 'text':
        return { html: '<p>Enter your text here...</p>' };
      case 'image':
        return { url: '', alt: '', caption: '', width: 100 };
      case 'button':
        return { text: 'Click Here', url: 'https://', color: '#4f46e5', align: 'center' };
      case 'divider':
        return { style: 'solid', color: '#e5e7eb' };
      case 'spacer':
        return { height: 20 };
      case 'columns':
        return { left: '<p>Left column</p>', right: '<p>Right column</p>' };
      case 'footer':
        return { showUnsubscribe: true, showAddress: true, text: '' };
      default:
        return {};
    }
  };

  const updateBlock = (blockId: string, content: Record<string, any>) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, content: { ...b.content, ...content } } : b
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  const deleteBlock = (blockId: string) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== blockId),
      updatedAt: new Date().toISOString(),
    }));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const index = template.blocks.findIndex(b => b.id === blockId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= template.blocks.length) return;

    const newBlocks = [...template.blocks];
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];

    setTemplate(prev => ({
      ...prev,
      blocks: newBlocks,
      updatedAt: new Date().toISOString(),
    }));
  };

  const duplicateBlock = (blockId: string) => {
    const block = template.blocks.find(b => b.id === blockId);
    if (!block) return;

    const index = template.blocks.findIndex(b => b.id === blockId);
    const newBlock: EmailBlock = {
      ...block,
      id: `block-${Date.now()}`,
      content: { ...block.content },
    };

    const newBlocks = [...template.blocks];
    newBlocks.splice(index + 1, 0, newBlock);

    setTemplate(prev => ({
      ...prev,
      blocks: newBlocks,
      updatedAt: new Date().toISOString(),
    }));
    setSelectedBlockId(newBlock.id);
  };

  const loadPreset = (preset: Partial<EmailTemplate>) => {
    setTemplate(prev => ({
      ...prev,
      name: preset.name || prev.name,
      subject: preset.subject || prev.subject,
      blocks: preset.blocks || [],
      updatedAt: new Date().toISOString(),
    }));
    setShowTemplates(false);
  };

  const handleSave = () => {
    const savedTemplates = JSON.parse(localStorage.getItem('email-templates') || '[]');
    const existingIndex = savedTemplates.findIndex((t: EmailTemplate) => t.id === template.id);

    if (existingIndex >= 0) {
      savedTemplates[existingIndex] = template;
    } else {
      savedTemplates.push(template);
    }

    localStorage.setItem('email-templates', JSON.stringify(savedTemplates));
    onSave?.(template);
    alert('Template saved!');
  };

  const renderBlockPreview = (block: EmailBlock) => {
    const { type, content } = block;
    const isSelected = selectedBlockId === block.id;

    const wrapperClass = `relative border-2 transition-colors cursor-pointer ${
      isSelected
        ? 'border-indigo-500'
        : 'border-transparent hover:border-gray-300 dark:hover:border-dark-600'
    }`;

    const contentRender = () => {
      switch (type) {
        case 'header':
          return (
            <div className="bg-indigo-600 text-white p-6 text-center">
              {content.logoUrl && (
                <img src={content.logoUrl} alt="Logo" className="h-12 mx-auto mb-2" />
              )}
              <h1 className="text-2xl font-bold">{content.title || 'Header Title'}</h1>
              {content.subtitle && <p className="text-indigo-200 mt-1">{content.subtitle}</p>}
            </div>
          );
        case 'text':
          return (
            <div
              className="p-4"
              dangerouslySetInnerHTML={{ __html: content.html || '<p>Enter text...</p>' }}
            />
          );
        case 'image':
          return (
            <div className="p-4 text-center">
              {content.url ? (
                <img
                  src={content.url}
                  alt={content.alt || ''}
                  style={{ width: `${content.width || 100}%` }}
                  className="mx-auto"
                />
              ) : (
                <div className="bg-gray-100 dark:bg-dark-700 h-32 flex items-center justify-center text-gray-400">
                  <Image size={32} />
                </div>
              )}
              {content.caption && (
                <p className="text-sm text-gray-500 mt-2">{content.caption}</p>
              )}
            </div>
          );
        case 'button':
          return (
            <div className={`p-4 text-${content.align || 'center'}`}>
              <button
                style={{ backgroundColor: content.color || '#4f46e5' }}
                className="px-6 py-3 text-white font-semibold rounded-lg"
              >
                {content.text || 'Button'}
              </button>
            </div>
          );
        case 'divider':
          return (
            <div className="py-4 px-6">
              <hr
                style={{
                  borderStyle: content.style || 'solid',
                  borderColor: content.color || '#e5e7eb',
                }}
              />
            </div>
          );
        case 'spacer':
          return <div style={{ height: content.height || 20 }} />;
        case 'columns':
          return (
            <div className="grid grid-cols-2 gap-4 p-4">
              <div dangerouslySetInnerHTML={{ __html: content.left || '' }} />
              <div dangerouslySetInnerHTML={{ __html: content.right || '' }} />
            </div>
          );
        case 'footer':
          return (
            <div className="bg-gray-100 dark:bg-dark-800 p-6 text-center text-sm text-gray-500 dark:text-dark-400">
              {content.text && <p>{content.text}</p>}
              {content.showAddress && <p className="mt-2">123 Church Street, City, State 12345</p>}
              {content.showUnsubscribe && (
                <p className="mt-2">
                  <a href="#" className="text-indigo-600 dark:text-indigo-400 underline">Unsubscribe</a>
                </p>
              )}
            </div>
          );
        default:
          return <div className="p-4 text-gray-400">Unknown block type</div>;
      }
    };

    return (
      <div
        key={block.id}
        className={wrapperClass}
        onClick={() => setSelectedBlockId(block.id)}
      >
        {contentRender()}
        {isSelected && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up'); }}
              className="p-1 bg-white dark:bg-dark-700 rounded shadow hover:bg-gray-100 dark:hover:bg-dark-600"
            >
              <MoveUp size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'down'); }}
              className="p-1 bg-white dark:bg-dark-700 rounded shadow hover:bg-gray-100 dark:hover:bg-dark-600"
            >
              <MoveDown size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }}
              className="p-1 bg-white dark:bg-dark-700 rounded shadow hover:bg-gray-100 dark:hover:bg-dark-600"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
              className="p-1 bg-white dark:bg-dark-700 rounded shadow hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderBlockEditor = () => {
    if (!selectedBlock) {
      return (
        <div className="text-center py-8 text-gray-400 dark:text-dark-500">
          <Settings size={32} className="mx-auto mb-2" />
          <p>Select a block to edit</p>
        </div>
      );
    }

    const { type, content } = selectedBlock;

    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-dark-100 capitalize">
          Edit {type}
        </h3>

        {type === 'header' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Title</label>
              <input
                type="text"
                value={content.title || ''}
                onChange={(e) => updateBlock(selectedBlock.id, { title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Subtitle</label>
              <input
                type="text"
                value={content.subtitle || ''}
                onChange={(e) => updateBlock(selectedBlock.id, { subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
          </>
        )}

        {type === 'text' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Content (HTML)</label>
            <textarea
              value={content.html || ''}
              onChange={(e) => updateBlock(selectedBlock.id, { html: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Use merge tags like {'{{'+'first_name'+'}}'}</p>
          </div>
        )}

        {type === 'image' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Image URL</label>
              <input
                type="url"
                value={content.url || ''}
                onChange={(e) => updateBlock(selectedBlock.id, { url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Alt Text</label>
              <input
                type="text"
                value={content.alt || ''}
                onChange={(e) => updateBlock(selectedBlock.id, { alt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Width (%)</label>
              <input
                type="number"
                value={content.width || 100}
                onChange={(e) => updateBlock(selectedBlock.id, { width: parseInt(e.target.value) })}
                min={10}
                max={100}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
          </>
        )}

        {type === 'button' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Button Text</label>
              <input
                type="text"
                value={content.text || ''}
                onChange={(e) => updateBlock(selectedBlock.id, { text: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">URL</label>
              <input
                type="url"
                value={content.url || ''}
                onChange={(e) => updateBlock(selectedBlock.id, { url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Button Color</label>
              <div className="flex gap-2">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    onClick={() => updateBlock(selectedBlock.id, { color })}
                    className={`w-8 h-8 rounded-lg border-2 ${
                      content.color === color ? 'border-gray-900 dark:border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Alignment</label>
              <div className="flex gap-2">
                {(['left', 'center', 'right'] as const).map(align => (
                  <button
                    key={align}
                    onClick={() => updateBlock(selectedBlock.id, { align })}
                    className={`p-2 rounded-lg border ${
                      content.align === align
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-gray-200 dark:border-dark-700'
                    }`}
                  >
                    {align === 'left' && <AlignLeft size={16} />}
                    {align === 'center' && <AlignCenter size={16} />}
                    {align === 'right' && <AlignRight size={16} />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {type === 'spacer' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Height (px)</label>
            <input
              type="number"
              value={content.height || 20}
              onChange={(e) => updateBlock(selectedBlock.id, { height: parseInt(e.target.value) })}
              min={10}
              max={200}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
            />
          </div>
        )}

        {type === 'footer' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Custom Text</label>
              <textarea
                value={content.text || ''}
                onChange={(e) => updateBlock(selectedBlock.id, { text: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={content.showUnsubscribe ?? true}
                onChange={(e) => updateBlock(selectedBlock.id, { showUnsubscribe: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-dark-300">Show unsubscribe link</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={content.showAddress ?? true}
                onChange={(e) => updateBlock(selectedBlock.id, { showAddress: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-dark-300">Show church address</span>
            </label>
          </>
        )}

        {/* Merge Tags Reference */}
        <div className="pt-4 border-t border-gray-200 dark:border-dark-700">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-400"
          >
            <Sparkles size={14} />
            Merge Tags
            {showSettings ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {showSettings && (
            <div className="mt-2 space-y-1">
              {MERGE_TAGS.map(({ tag, label }) => (
                <div key={tag} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-dark-400">{label}</span>
                  <code className="bg-gray-100 dark:bg-dark-700 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400">
                    {tag}
                  </code>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-100 dark:bg-dark-900">
      {/* Header */}
      <div className="bg-white dark:bg-dark-850 border-b border-gray-200 dark:border-dark-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
              >
                <X size={20} className="text-gray-400" />
              </button>
            )}
            <div>
              <input
                type="text"
                value={template.name}
                onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                className="text-lg font-semibold bg-transparent text-gray-900 dark:text-dark-100 border-none focus:outline-none focus:ring-0"
              />
              <input
                type="text"
                value={template.subject}
                onChange={(e) => setTemplate(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Email subject line..."
                className="block w-full text-sm bg-transparent text-gray-500 dark:text-dark-400 border-none focus:outline-none focus:ring-0 mt-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
            >
              <Eye size={18} />
              Preview
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Save size={18} />
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Block Library */}
        <div className="w-64 bg-white dark:bg-dark-850 border-r border-gray-200 dark:border-dark-700 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-300 mb-3">Add Blocks</h3>
            <div className="space-y-2">
              {BLOCK_TYPES.map(({ type, label, icon: Icon, description }) => (
                <button
                  key={type}
                  onClick={() => addBlock(type as EmailBlock['type'])}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-dark-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-gray-100 dark:bg-dark-700 rounded-lg flex items-center justify-center">
                    <Icon size={18} className="text-gray-600 dark:text-dark-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-dark-100">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-400">{description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Templates */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-300 mb-3">Templates</h3>
              <div className="space-y-2">
                {TEMPLATE_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => loadPreset(preset)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-dark-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors text-left"
                  >
                    <Mail size={18} className="text-indigo-600 dark:text-indigo-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 overflow-y-auto p-8">
          <div
            className="mx-auto bg-white dark:bg-dark-800 shadow-lg rounded-lg overflow-hidden"
            style={{
              maxWidth: template.styles.contentWidth,
              backgroundColor: '#ffffff',
            }}
          >
            {template.blocks.length === 0 && showTemplates ? (
              <div className="p-12 text-center">
                <Mail size={48} className="mx-auto text-gray-300 dark:text-dark-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-2">
                  Start building your email
                </h3>
                <p className="text-gray-500 dark:text-dark-400 mb-6">
                  Add blocks from the left panel or choose a template
                </p>
              </div>
            ) : (
              template.blocks.map(block => renderBlockPreview(block))
            )}
          </div>
        </div>

        {/* Right Panel - Block Editor */}
        <div className="w-80 bg-white dark:bg-dark-850 border-l border-gray-200 dark:border-dark-700 overflow-y-auto p-4">
          {renderBlockEditor()}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-dark-100">Email Preview</h2>
                <p className="text-sm text-gray-500 dark:text-dark-400">Subject: {template.subject || '(no subject)'}</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-dark-900">
              <div className="mx-auto bg-white rounded-lg shadow overflow-hidden" style={{ maxWidth: template.styles.contentWidth }}>
                {template.blocks.map(block => (
                  <div key={block.id}>{renderBlockPreview(block)}</div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => { setShowPreview(false); handleSave(); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Save size={18} />
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
