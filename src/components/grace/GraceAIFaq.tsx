import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { GRACE_AI_FAQ } from '../../config/centralHendersonLeaders';

interface GraceAIFaqProps {
  audience?: 'admin' | 'member' | 'both';
}

export function GraceAIFaq({ audience = 'admin' }: GraceAIFaqProps) {
  const items = GRACE_AI_FAQ.filter(
    item => !item.audience || item.audience === audience || item.audience === 'both',
  );
  const [openId, setOpenId] = useState<string>(items[0]?.id ?? '');

  return (
    <div className="space-y-3">
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-100">About GRACE & leader avatars</h2>
        <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
          Ways GRACE can help your church — and how verified leader avatars work for members.
        </p>
      </div>

      <div className="space-y-2">
        {items.map(item => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? '' : item.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50/80 dark:hover:bg-dark-850 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-dark-100">{item.question}</span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-sm text-gray-600 dark:text-dark-300 leading-relaxed border-t border-gray-100 dark:border-dark-700 pt-3">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
