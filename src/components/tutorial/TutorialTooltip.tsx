import { useRef, useEffect, useState } from 'react';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface TutorialTooltipProps {
  targetElement: HTMLElement | null;
  title: string;
  description: string;
  currentStep: number;
  totalSteps: number;
  tutorialTitle: string;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onEnd: () => void;
}

export function TutorialTooltip({
  targetElement,
  title,
  description,
  currentStep,
  totalSteps,
  tutorialTitle,
  onNext,
  onPrev,
  onSkip,
  onEnd,
}: TutorialTooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const { refs, floatingStyles } = useFloating({
    elements: {
      reference: targetElement,
    },
    placement: 'bottom',
    middleware: [
      offset(16),
      flip({ padding: 16 }),
      shift({ padding: 16 }),
    ],
    whileElementsMounted: targetElement ? autoUpdate : undefined,
  });

  // Animate in
  useEffect(() => {
    if (targetElement) {
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [targetElement]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onEnd();
          break;
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault();
          onNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onPrev();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev, onEnd]);

  // Focus trap
  useEffect(() => {
    if (visible && tooltipRef.current) {
      tooltipRef.current.focus();
    }
  }, [visible]);

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div
      ref={(node) => {
        refs.setFloating(node);
        (tooltipRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      role="dialog"
      aria-label={`Tutorial step ${currentStep + 1} of ${totalSteps}: ${title}`}
      tabIndex={-1}
      className={`z-[70] w-80 bg-white dark:bg-dark-800 rounded-xl shadow-2xl border border-gray-200 dark:border-dark-700 outline-none transition-all duration-200 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={floatingStyles}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
          {tutorialTitle}
        </span>
        <button
          onClick={onEnd}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
          aria-label="Close tutorial"
        >
          <X size={14} className="text-gray-400 dark:text-dark-500" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-1">
          {title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-dark-400 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-dark-700/50 bg-gray-50 dark:bg-dark-850 rounded-b-xl">
        {/* Step dots */}
        <div className="flex items-center gap-1" aria-label={`Step ${currentStep + 1} of ${totalSteps}`}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === currentStep
                  ? 'bg-indigo-500 w-3'
                  : i < currentStep
                  ? 'bg-indigo-300 dark:bg-indigo-700'
                  : 'bg-gray-300 dark:bg-dark-600'
              }`}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSkip}
            className="text-xs text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-300 transition-colors"
          >
            Skip
          </button>

          {!isFirst && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-dark-300 bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-650 transition-colors"
            >
              <ChevronLeft size={12} />
              Back
            </button>
          )}

          <button
            onClick={onNext}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            {isLast ? 'Finish' : 'Next'}
            {!isLast && <ChevronRight size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}
