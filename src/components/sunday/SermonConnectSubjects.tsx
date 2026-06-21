import {
  browseAllLabels,
  connectColumnTitles,
  illustrationTopics,
  scriptureRefs,
  sermonTopics,
  type ConnectSubjectKind,
} from '../../config/sermonConnectSubjects';

interface SermonConnectSubjectsProps {
  onSelectTopic: (title: string) => void;
  onSelectScripture: (ref: string) => void;
  onSelectIllustration: (topic: string) => void;
  onBrowseAll: (kind: ConnectSubjectKind) => void;
}

function ConnectColumn({
  title,
  items,
  browseLabel,
  onSelect,
  onBrowseAll,
}: {
  title: string;
  items: readonly string[];
  browseLabel: string;
  onSelect: (item: string) => void;
  onBrowseAll: () => void;
}) {
  return (
    <div className="flex flex-col min-h-full">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-dark-100 mb-3">{title}</h3>
      <ul className="space-y-2 flex-1">
        {items.slice(0, 10).map(item => (
          <li key={item}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-left"
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onBrowseAll}
        className="mt-4 text-sm text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline text-left"
      >
        {browseLabel}
      </button>
    </div>
  );
}

export function SermonConnectSubjects({
  onSelectTopic,
  onSelectScripture,
  onSelectIllustration,
  onBrowseAll,
}: SermonConnectSubjectsProps) {
  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 no-print">
      <p className="text-xs text-gray-500 dark:text-dark-400 mb-4">
        Click a subject to add it to your sermon — topics, scripture, and illustrations in one place.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 md:divide-x md:divide-gray-200 dark:md:divide-dark-600">
        <div className="md:pr-6">
          <ConnectColumn
            title={connectColumnTitles.topics}
            items={sermonTopics}
            browseLabel={browseAllLabels.topics}
            onSelect={onSelectTopic}
            onBrowseAll={() => onBrowseAll('topics')}
          />
        </div>
        <div className="md:px-6">
          <ConnectColumn
            title={connectColumnTitles.scripture}
            items={scriptureRefs}
            browseLabel={browseAllLabels.scripture}
            onSelect={onSelectScripture}
            onBrowseAll={() => onBrowseAll('scripture')}
          />
        </div>
        <div className="md:pl-6">
          <ConnectColumn
            title={connectColumnTitles.illustrations}
            items={illustrationTopics}
            browseLabel={browseAllLabels.illustrations}
            onSelect={onSelectIllustration}
            onBrowseAll={() => onBrowseAll('illustrations')}
          />
        </div>
      </div>
    </div>
  );
}
