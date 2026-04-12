import { Steps } from 'antd';

type ContestantBuilderStepperProps = {
  currentStep: number;
  isEditMode?: boolean;
  onStepChange?: (step: number) => void;
};

export function ContestantBuilderStepper({
  currentStep,
  isEditMode = false,
  onStepChange,
}: ContestantBuilderStepperProps) {
  return (
    <Steps
      current={currentStep}
      items={[
        { title: 'Basic Info' },
        { title: 'Appearance' },
        { title: 'Core Skills' },
        { title: 'Utility Skills' },
        { title: 'Personality' },
        { title: 'Specialties' },
        { title: 'Review' },
      ]}
      onChange={isEditMode ? onStepChange : undefined}
      style={{ marginBottom: '2rem', cursor: isEditMode ? 'pointer' : 'default' }}
    />
  );
}
