import { useState } from 'react';

export type UseStep = {
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
};

/**
 * Custom hook for managing steps in a process.
 * @param startingStep - The initial step value (default: 0).
 * @returns An object containing the current step, functions to update the step, and functions to navigate to the next or previous step.
 */
export function useStep(startingStep = 0): UseStep {
  const [step, setStep] = useState<number>(startingStep);

  const goToNextStep = () => setStep((s) => s + 1);

  const goToPreviousStep = () => setStep((s) => (s - 1 < 0 ? 0 : s - 1));

  return {
    step,
    setStep,
    goToNextStep,
    goToPreviousStep,
  };
}
