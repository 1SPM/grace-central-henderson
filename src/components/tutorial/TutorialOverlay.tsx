import { useCallback, useEffect, useState } from 'react';
import { useTutorial } from '../../contexts/TutorialContext';
import { useGraceSpeech } from '../../hooks/useGraceSpeech';
import { useAISettings } from '../../hooks/useAISettings';
import { TutorialSpotlight } from './TutorialSpotlight';
import { TutorialTooltip } from './TutorialTooltip';

const TOUR_VOICE_MUTED_KEY = 'grace-tour-voice-muted';

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

  const { speak, stop, supported: speechSupported } = useGraceSpeech();
  const { settings: aiSettings } = useAISettings();
  const [voiceMuted, setVoiceMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(TOUR_VOICE_MUTED_KEY) === '1';
  });

  const narrationAvailable = aiSettings.voiceReadback && speechSupported;
  const narrationOn = narrationAvailable && !voiceMuted;

  const toggleVoice = useCallback(() => {
    setVoiceMuted(prev => {
      const next = !prev;
      window.sessionStorage.setItem(TOUR_VOICE_MUTED_KEY, next ? '1' : '0');
      if (next) stop();
      return next;
    });
  }, [stop]);

  // Narrate each step as the spotlight lands; stop on step change or tour end.
  const stepTitle = currentStep?.title;
  const stepDescription = currentStep?.description;
  useEffect(() => {
    if (state !== 'SHOWING_STEP' || !narrationOn || !stepTitle) return;
    speak(`${stepTitle}. ${stepDescription ?? ''}`);
    return () => stop();
  }, [state, currentStepIndex, activeTutorial?.id, narrationOn, stepTitle, stepDescription, speak, stop]);

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
        voiceAvailable={narrationAvailable}
        voiceMuted={voiceMuted}
        onToggleVoice={toggleVoice}
      />
    </>
  );
}
