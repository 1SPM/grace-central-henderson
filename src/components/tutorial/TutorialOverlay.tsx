import { useTutorial } from '../../contexts/TutorialContext';
import { TutorialSpotlight } from './TutorialSpotlight';
import { TutorialTooltip } from './TutorialTooltip';

export function TutorialOverlay() {
  const {
    state,
    activeTutorial,
    currentStep,
    currentStepIndex,
    totalSteps,
    targetElement,
    nextStep,
    prevStep,
    skipTutorial,
    endAllTutorials,
  } = useTutorial();

  // Only render when active
  if (state === 'IDLE' || state === 'PICKER_OPEN' || !activeTutorial || !currentStep) {
    return null;
  }

  // While navigating/waiting, show just the overlay dimming
  if (state === 'NAVIGATING' || state === 'WAITING_FOR_ELEMENT') {
    return (
      <div className="fixed inset-0 z-[60] bg-black/30 transition-opacity duration-200" />
    );
  }

  return (
    <>
      <TutorialSpotlight targetElement={targetElement} />
      <TutorialTooltip
        targetElement={targetElement}
        title={currentStep.title}
        description={currentStep.description}
        currentStep={currentStepIndex}
        totalSteps={totalSteps}
        tutorialTitle={activeTutorial.title}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTutorial}
        onEnd={endAllTutorials}
      />
    </>
  );
}
