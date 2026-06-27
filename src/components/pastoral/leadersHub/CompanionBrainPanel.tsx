import { useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  Globe,
  Image,
  Info,
  LayoutGrid,
  Mic,
  Plus,
  RefreshCw,
  Settings2,
  Upload,
  X,
} from 'lucide-react';
import type { LeaderProfile } from '../../../types';
import {
  GROUNDING_OPTIONS,
  LLM_OPTIONS,
  PERSONALITY_OPTIONS,
  type CompanionBrainState,
} from './companionBrainState';

interface CompanionBrainPanelProps {
  value: CompanionBrainState;
  onChange: (next: CompanionBrainState) => void;
  leader: LeaderProfile;
}

function Section({
  title,
  optional,
  description,
  children,
}: {
  title: string;
  optional?: boolean;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 space-y-3">
      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">
          {title}
          {optional && <span className="text-gray-400 dark:text-dark-500 font-normal"> (Optional)</span>}
        </h3>
        {description && <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-850 px-3 py-2 text-sm text-gray-900 dark:text-dark-100 placeholder:text-gray-400 dark:placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30';

const selectClass =
  'w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-850 px-3 py-2 text-sm text-gray-900 dark:text-dark-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30';

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
      <span className="sr-only">{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900 dark:peer-checked:bg-dark-100" />
    </label>
  );
}

export function CompanionBrainPanel({ value, onChange, leader }: CompanionBrainPanelProps) {
  const [topicInput, setTopicInput] = useState('');
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const patch = (partial: Partial<CompanionBrainState>) => onChange({ ...value, ...partial });

  const updateGreeting = (index: number, text: string) => {
    const greetings = [...value.greetings];
    greetings[index] = text;
    patch({ greetings });
  };

  const addGreeting = () => patch({ greetings: [...value.greetings, ''] });

  const updateStarter = (index: number, text: string) => {
    const conversationStarters = [...value.conversationStarters];
    conversationStarters[index] = text;
    patch({ conversationStarters });
  };

  const addStarter = () => {
    if (value.conversationStarters.length >= 4) return;
    patch({ conversationStarters: [...value.conversationStarters, ''] });
  };

  const removeStarter = (index: number) => {
    patch({ conversationStarters: value.conversationStarters.filter((_, i) => i !== index) });
  };

  const addTopic = (raw: string) => {
    const topic = raw.trim().replace(/,$/, '');
    if (!topic || value.topicsToAvoid.includes(topic)) return;
    patch({ topicsToAvoid: [...value.topicsToAvoid, topic] });
    setTopicInput('');
  };

  const onTopicKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTopic(topicInput);
    }
  };

  const removeTopic = (topic: string) => {
    patch({ topicsToAvoid: value.topicsToAvoid.filter(t => t !== topic) });
  };

  const showUploadPlaceholder = (label: string) => {
    setUploadNotice(`${label} — coming soon`);
    window.setTimeout(() => setUploadNotice(null), 2500);
  };

  const groundingMeta = GROUNDING_OPTIONS.find(o => o.value === value.knowledgeGrounding);

  return (
    <div className="space-y-4">
      {uploadNotice && (
        <p className="text-xs text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 rounded-lg px-3 py-2">
          {uploadNotice}
        </p>
      )}

      <Section
        title="Agent greeting"
        description="Set a friendly message to greet users when they first interact with your avatar."
      >
        {value.greetings.map((greeting, i) => (
          <input
            key={i}
            type="text"
            value={greeting}
            onChange={e => updateGreeting(i, e.target.value)}
            className={inputClass}
            placeholder={`Greeting ${i + 1}`}
          />
        ))}
        <button
          type="button"
          onClick={addGreeting}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-dark-100 transition-colors"
        >
          <RefreshCw size={12} /> Add greeting to randomize
        </button>
      </Section>

      <Section
        title="Conversation starters"
        optional
        description="Add up to 4 starter options to help your user start the conversation"
      >
        {value.conversationStarters.length === 0 ? (
          <div className="border-y border-gray-200 dark:border-dark-600 py-4">
            <button
              type="button"
              onClick={addStarter}
              className="text-xs text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-dark-100"
            >
              + Add question
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {value.conversationStarters.map((starter, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={starter}
                  onChange={e => updateStarter(i, e.target.value)}
                  className={inputClass}
                  placeholder="Starter question"
                />
                <button
                  type="button"
                  onClick={() => removeStarter(i)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
                  aria-label="Remove starter"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {value.conversationStarters.length < 4 && (
              <button
                type="button"
                onClick={addStarter}
                className="text-xs text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-dark-100"
              >
                + Add question
              </button>
            )}
          </div>
        )}
      </Section>

      <Section title="Topics to avoid" optional>
        <div className="rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-850 p-3 space-y-3">
          <input
            type="text"
            value={topicInput}
            onChange={e => setTopicInput(e.target.value)}
            onKeyDown={onTopicKeyDown}
            onBlur={() => topicInput.trim() && addTopic(topicInput)}
            className="w-full border-0 bg-transparent px-0 py-1 text-sm text-gray-900 dark:text-dark-100 placeholder:text-gray-400 focus:outline-none focus:ring-0"
            placeholder="Type a topic..."
          />
          {value.topicsToAvoid.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.topicsToAvoid.map(topic => (
                <span
                  key={topic}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-200"
                >
                  {topic}
                  <button
                    type="button"
                    onClick={() => removeTopic(topic)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-100"
                    aria-label={`Remove ${topic}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </Section>

      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">
              Max response length <span className="text-gray-400 dark:text-dark-500 font-normal">(Optional)</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
              Specify the maximum amount of words in the response
            </p>
            {value.maxResponseLength.enabled && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min={25}
                  max={2000}
                  value={value.maxResponseLength.words}
                  onChange={e =>
                    patch({
                      maxResponseLength: {
                        ...value.maxResponseLength,
                        words: Number(e.target.value) || 150,
                      },
                    })
                  }
                  className="w-24 rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-850 px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-500 dark:text-dark-400">words</span>
              </div>
            )}
          </div>
          <ToggleSwitch
            checked={value.maxResponseLength.enabled}
            onChange={enabled =>
              patch({ maxResponseLength: { ...value.maxResponseLength, enabled } })
            }
            label="Enable max response length"
          />
        </div>
      </div>

      <Section title="Set your agent behavior" description="Describe the desired tone, tool usage, response style">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-dark-200 mb-1.5">
              Agent role <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={value.agentRole}
              onChange={e => patch({ agentRole: e.target.value })}
              className={inputClass}
              placeholder="i.e. Senior Pastor"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-dark-200 mb-1.5">Personality</label>
            <select
              value={value.personality}
              onChange={e => patch({ personality: e.target.value })}
              className={selectClass}
            >
              {PERSONALITY_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-dark-200 mb-1.5">
              Agent prompt <Info size={12} className="text-gray-400" />
            </label>
            <textarea
              value={value.agentPrompt}
              onChange={e => patch({ agentPrompt: e.target.value })}
              maxLength={20000}
              rows={6}
              className={`${inputClass} resize-y min-h-[120px]`}
              placeholder="What does your agent do? How should it behave? What should it not do?"
            />
            <p className="text-[11px] text-gray-400 dark:text-dark-500 text-right mt-1">
              {value.agentPrompt.length}/20000
            </p>
          </div>

          <div>
            <label className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-dark-200 mb-1.5">
              End of conversation <Info size={12} className="text-gray-400" />
            </label>
            <div className="rounded-lg border border-gray-200 dark:border-dark-600 divide-y divide-gray-200 dark:divide-dark-600">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-dark-200">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-700">
                    <LayoutGrid size={14} />
                  </span>
                  Add a tool
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Settings2 size={14} />
                  <button type="button" onClick={() => showUploadPlaceholder('Tools')} aria-label="Add tool">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-dark-200">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-700">
                    <Globe size={14} />
                  </span>
                  Add a webhook
                </div>
                <button type="button" onClick={() => showUploadPlaceholder('Webhooks')} aria-label="Add webhook">
                  <Plus size={14} className="text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-dark-200 mb-1.5">LLM</label>
            <select value={value.llm} onChange={e => patch({ llm: e.target.value })} className={selectClass}>
              {LLM_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section
        title="Knowledge settings"
        description="Choose whether the agent sticks to provided info or includes broader insights"
      >
        <div className="space-y-4">
          <div>
            <select
              value={value.knowledgeGrounding}
              onChange={e =>
                patch({ knowledgeGrounding: e.target.value as CompanionBrainState['knowledgeGrounding'] })
              }
              className={selectClass}
            >
              {GROUNDING_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
            {groundingMeta && (
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1.5">{groundingMeta.description}</p>
            )}
          </div>

          <div>
            <label className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-dark-200 mb-2">
              Adjust creativity level <Info size={12} className="text-gray-400" />
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={value.creativity}
              onChange={e => patch({ creativity: Number(e.target.value) })}
              className="w-full accent-slate-900 dark:accent-dark-100"
            />
            <div className="flex justify-between text-[11px] text-gray-500 dark:text-dark-400 mt-1">
              <span>More predictable and focused</span>
              <span>More diverse and creative</span>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Knowledge base"
        description="Use knowledge snippets to add quick context for your avatar, or upload files to provide a broader knowledge base for its responses."
      >
        <p className="text-xs text-gray-600 dark:text-dark-300">How would you like to upload your data?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['text', 'files'] as const).map(source => (
            <button
              key={source}
              type="button"
              onClick={() => patch({ knowledgeSource: source })}
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm text-left transition-colors ${
                value.knowledgeSource === source
                  ? 'border-slate-900 dark:border-dark-100 bg-white dark:bg-dark-850'
                  : 'border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-850'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  value.knowledgeSource === source
                    ? 'border-slate-900 dark:border-dark-100 bg-slate-900 dark:bg-dark-100'
                    : 'border-gray-300 dark:border-dark-500'
                }`}
              />
              {source === 'text' ? 'Input text' : 'Upload files'}
            </button>
          ))}
        </div>

        {value.knowledgeSource === 'text' ? (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-700 dark:text-dark-200">Knowledge</label>
            <textarea
              value={value.knowledgeText}
              onChange={e => patch({ knowledgeText: e.target.value })}
              maxLength={80000}
              rows={6}
              className={`${inputClass} resize-y min-h-[140px]`}
              placeholder="Add key details and context your avatar should know, such as important facts, examples, or specific guidelines."
            />
            <p className="text-[11px] text-gray-400 dark:text-dark-500 text-right">
              {value.knowledgeText.length}/80000
            </p>
            {value.knowledgeTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {value.knowledgeTags.map(tag => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-dark-600 p-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400">
              <Image size={16} /> Drop files here
            </div>
            <button
              type="button"
              onClick={() => showUploadPlaceholder('File upload')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-dark-100 text-white dark:text-dark-900 text-sm font-medium"
            >
              <Upload size={14} /> Upload
            </button>
          </div>
        )}
      </Section>

      <Section
        title="Media"
        description="Add images or videos your Agent can show in conversation. Useful for product images or screenshots of steps the user should follow."
      >
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-dark-600 p-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400">
            <Image size={16} /> Drop an image or video here
          </div>
          <button
            type="button"
            onClick={() => showUploadPlaceholder('Media upload')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-dark-100 text-white dark:text-dark-900 text-sm font-medium"
          >
            <Upload size={14} /> Upload
          </button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-dark-500">PNG, JPG, GIF, MP4, WEBM, MKV</p>
      </Section>

      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
        <div className="p-3 bg-gray-50 dark:bg-dark-850 rounded-lg flex items-center gap-2.5">
          <Mic size={14} className="text-gray-400 flex-shrink-0" />
          <p className="text-[11px] text-gray-500 dark:text-dark-400">
            {value.voiceModel} · {leader.displayName}
          </p>
        </div>
      </div>
    </div>
  );
}
