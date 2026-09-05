/** Horizontally scrollable single-select chips, with optional count badges. */
export interface ChipOption<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

export function Chips<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: ChipOption<T>[];
  selected: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5 [scrollbar-width:none]">
      {options.map((option) => {
        const active = option.id === selected;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
              active ? 'bg-violet-600 text-white' : 'bg-white/[0.05] text-slate-400 hover:text-slate-200'
            }`}
          >
            {option.label}
            {option.badge != null && option.badge > 0 && (
              <span
                className={`min-w-[16px] h-4 px-1 rounded-full grid place-items-center text-[10px] font-semibold ${
                  active ? 'bg-white/25 text-white' : 'bg-violet-500/25 text-violet-200'
                }`}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
