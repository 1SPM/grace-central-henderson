import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { View } from '../types';
import { TUTORIALS, getTutorialById } from '../components/tutorial/tutorialDefinitions';
import type { TutorialDefinition, TutorialStep } from '../components/tutorial/tutorialDefinitions';
import type { OnboardingState } from '../hooks/useChurchSettings';

type TutorialState = 'IDLE' | 'PICKER_OPEN' | 'NAVIGATING' | 'WAITING_FOR_ELEMENT' | 'SHOWING_STEP' | 'TRANSITIONING';

interface TutorialContextValue {
  // State
  state: TutorialState;
  isPickerOpen: boolean;
  activeTutorial: TutorialDefinition | null;
  currentStepIndex: number;
  currentStep: TutorialStep | null;
  totalSteps: number;
  completedTutorials: string[];
  targetElement: HTMLElement | null;

  // Actions
  openPicker: () => void;
  closePicker: () => void;
  startTutorials: (ids: string[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  endAllTutorials: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

interface TutorialProviderProps {
  children: ReactNode;
  setView: (view: View) => void;
  currentView: View;
  onboarding?: OnboardingState;
  saveOnboarding: (state: Partial<OnboardingState>) => Promise<boolean>;
}

export function TutorialProvider({
  children,
  setView,
  currentView,
  onboarding,
  saveOnboarding,
}: TutorialProviderProps) {
  const [state, setState] = useState<TutorialState>('IDLE');
  const [activeTutorial, setActiveTutorial] = useState<TutorialDefinition | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedTutorials, setCompletedTutorials] = useState<string[]>(
    onboarding?.completedTutorials ?? []
  );
  const [selectedQueue, setSelectedQueue] = useState<string[]>([]);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  const observerRef = useRef<MutationObserver | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  // Sync completedTutorials from onboarding prop
  useEffect(() => {
    if (onboarding?.completedTutorials) {
      setCompletedTutorials(onboarding.completedTutorials);
    }
  }, [onboarding?.completedTutorials]);

  // Cleanup observers on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const findElement = useCallback((target: string): HTMLElement | null => {
    return document.querySelector(`[data-tutorial="${target}"]`);
  }, []);

  const waitForElement = useCallback((target: string) => {
    setState('WAITING_FOR_ELEMENT');
    setTargetElement(null);

    // Try immediately
    const existing = findElement(target);
    if (existing) {
      existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Small delay to let scroll complete
      setTimeout(() => {
        setTargetElement(existing);
        setState('SHOWING_STEP');
      }, 400);
      return;
    }

    // Set up MutationObserver + rAF polling
    const check = () => {
      const el = findElement(target);
      if (el) {
        cleanup();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          setTargetElement(el);
          setState('SHOWING_STEP');
        }, 400);
        return true;
      }
      return false;
    };

    const cleanup = () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    // MutationObserver for DOM changes
    observerRef.current = new MutationObserver(() => {
      check();
    });
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // rAF polling as fallback
    const poll = () => {
      if (!check()) {
        rafRef.current = requestAnimationFrame(poll);
      }
    };
    rafRef.current = requestAnimationFrame(poll);

    // Timeout: auto-advance after 5s
    timeoutRef.current = setTimeout(() => {
      cleanup();
      // Auto-advance if element never appeared
      setTargetElement(null);
      setState('SHOWING_STEP');
    }, 5000);
  }, [findElement]);

  const goToStep = useCallback((tutorial: TutorialDefinition, stepIndex: number) => {
    const step = tutorial.steps[stepIndex];
    if (!step) return;

    setState('TRANSITIONING');
    setCurrentStepIndex(stepIndex);

    // Navigate if needed
    if (step.view !== currentView) {
      setState('NAVIGATING');
      setView(step.view);
      // Wait a tick for the view to render, then look for element
      setTimeout(() => waitForElement(step.target), 150);
    } else {
      waitForElement(step.target);
    }
  }, [currentView, setView, waitForElement]);

  const openPicker = useCallback(() => {
    setState('PICKER_OPEN');
  }, []);

  const closePicker = useCallback(() => {
    setState('IDLE');
    saveOnboarding({ tutorialPickerShown: true });
  }, [saveOnboarding]);

  const startTutorials = useCallback((ids: string[]) => {
    if (ids.length === 0) return;

    const queue = [...ids];
    setSelectedQueue(queue);
    saveOnboarding({ tutorialPickerShown: true, selectedTutorials: queue });

    const firstId = queue[0];
    const tutorial = getTutorialById(firstId);
    if (!tutorial) return;

    setActiveTutorial(tutorial);
    setCurrentStepIndex(0);
    setState('TRANSITIONING');
    goToStep(tutorial, 0);
  }, [goToStep, saveOnboarding]);

  const nextStep = useCallback(() => {
    if (!activeTutorial) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeTutorial.steps.length) {
      goToStep(activeTutorial, nextIndex);
    } else {
      // Tutorial complete — mark it and move to next in queue
      const newCompleted = [...completedTutorials, activeTutorial.id];
      setCompletedTutorials(newCompleted);
      saveOnboarding({ completedTutorials: newCompleted });

      const currentQueueIndex = selectedQueue.indexOf(activeTutorial.id);
      const nextQueueId = selectedQueue[currentQueueIndex + 1];

      if (nextQueueId) {
        const nextTutorial = getTutorialById(nextQueueId);
        if (nextTutorial) {
          setActiveTutorial(nextTutorial);
          setCurrentStepIndex(0);
          goToStep(nextTutorial, 0);
          return;
        }
      }

      // All done
      setActiveTutorial(null);
      setTargetElement(null);
      setState('IDLE');
    }
  }, [activeTutorial, currentStepIndex, goToStep, completedTutorials, selectedQueue, saveOnboarding]);

  const prevStep = useCallback(() => {
    if (!activeTutorial || currentStepIndex <= 0) return;
    goToStep(activeTutorial, currentStepIndex - 1);
  }, [activeTutorial, currentStepIndex, goToStep]);

  const skipTutorial = useCallback(() => {
    if (!activeTutorial) return;

    // Move to next tutorial in queue
    const currentQueueIndex = selectedQueue.indexOf(activeTutorial.id);
    const nextQueueId = selectedQueue[currentQueueIndex + 1];

    if (nextQueueId) {
      const nextTutorial = getTutorialById(nextQueueId);
      if (nextTutorial) {
        setActiveTutorial(nextTutorial);
        setCurrentStepIndex(0);
        goToStep(nextTutorial, 0);
        return;
      }
    }

    // No more tutorials
    setActiveTutorial(null);
    setTargetElement(null);
    setState('IDLE');
  }, [activeTutorial, selectedQueue, goToStep]);

  const endAllTutorials = useCallback(() => {
    observerRef.current?.disconnect();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setActiveTutorial(null);
    setTargetElement(null);
    setCurrentStepIndex(0);
    setSelectedQueue([]);
    setState('IDLE');
  }, []);

  const currentStep = activeTutorial?.steps[currentStepIndex] ?? null;
  const totalSteps = activeTutorial?.steps.length ?? 0;

  const value: TutorialContextValue = {
    state,
    isPickerOpen: state === 'PICKER_OPEN',
    activeTutorial,
    currentStepIndex,
    currentStep,
    totalSteps,
    completedTutorials,
    targetElement,
    openPicker,
    closePicker,
    startTutorials,
    nextStep,
    prevStep,
    skipTutorial,
    endAllTutorials,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return ctx;
}

export { TUTORIALS };
