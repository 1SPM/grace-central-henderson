interface PersonalityTraitSelectorProps {
  available: string[];
  selected: string[];
  onChange: (traits: string[]) => void;
  maxSelections?: number;
  label?: string;
}

export function PersonalityTraitSelector({
  available,
  selected,
  onChange,
  maxSelections = 6,
  label,
}: PersonalityTraitSelectorProps) {
  const toggleTrait = (trait: string) => {
    if (selected.includes(trait)) {
      onChange(selected.filter(t => t !== trait));
    } else if (selected.length < maxSelections) {
      onChange([...selected, trait]);
    }
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
          {label}
          {maxSelections < available.length && (
            <span className="text-xs font-normal text-gray-400 dark:text-dark-500 ml-2">
              ({selected.length}/{maxSelections})
            </span>
          )}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {available.map(trait => {
          const isSelected = selected.includes(trait);
          const isDisabled = !isSelected && selected.length >= maxSelections;

          return (
            <button
              key={trait}
              type="button"
              onClick={() => toggleTrait(trait)}
              disabled={isDisabled}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-violet-600 text-white shadow-sm'
                  : isDisabled
                    ? 'bg-gray-100 dark:bg-dark-700 text-gray-300 dark:text-dark-600 cursor-not-allowed'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300 hover:bg-violet-100 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-400'
              }`}
              aria-pressed={isSelected}
            >
              {trait}
            </button>
          );
        })}
      </div>
    </div>
  );
}
