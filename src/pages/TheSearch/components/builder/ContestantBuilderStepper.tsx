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
        { title: 'Specialties' },
        { title: 'Personality' },
        { title: 'Review' },
      ]}
      onChange={isEditMode ? onStepChange : undefined}
      style={{ marginBottom: '2rem', cursor: isEditMode ? 'pointer' : 'default' }}
    />
  );
}

import { CheckOutlined, StepBackwardOutlined, StepForwardOutlined, TableOutlined } from '@ant-design/icons';
import { Button, Flex, Space } from 'antd';
import { useNavigate } from 'react-router-dom';

type ContestantBuilderStepperControlsProps = {
  setStep: React.Dispatch<React.SetStateAction<number>>;
  isEditMode?: boolean;
  hidePreviousButton?: boolean;
  currentContestantId?: string;
  allContestantIds?: string[];
  currentStep?: number;
  addParams?: (params: Record<string, unknown>) => void;
  onSubmitForm?: () => Promise<boolean>;
  onApplyChanges?: () => void;
};

export function ContestantBuilderStepperControls({
  hidePreviousButton,
  setStep,
  isEditMode,
  currentContestantId,
  allContestantIds = [],
  currentStep = 0,
  addParams,
  onSubmitForm,
  onApplyChanges,
}: ContestantBuilderStepperControlsProps) {
  const navigate = useNavigate();

  const currentIndex = currentContestantId ? allContestantIds.indexOf(currentContestantId) : -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allContestantIds.length - 1;

  const navigateToPrevious = async () => {
    if (hasPrevious && addParams) {
      // Submit form to validate and update contestant state before navigating
      if (onSubmitForm) {
        const isValid = await onSubmitForm();
        if (!isValid) return; // Don't navigate if form is invalid
      }
      const previousId = allContestantIds[currentIndex - 1];
      addParams({ id: previousId, step: currentStep });
    }
  };

  const navigateToNext = async () => {
    if (hasNext && addParams) {
      // Submit form to validate and update contestant state before navigating
      if (onSubmitForm) {
        const isValid = await onSubmitForm();
        if (!isValid) return; // Don't navigate if form is invalid
      }
      const nextId = allContestantIds[currentIndex + 1];
      addParams({ id: nextId, step: currentStep });
    }
  };

  return (
    <Flex justify="space-between">
      <Space.Compact>
        {!hidePreviousButton && (
          <Button onClick={() => setStep((prev) => prev - 1)} size="large">
            Previous
          </Button>
        )}
        <Button htmlType="submit" size="large" type="primary">
          Next Step
        </Button>
      </Space.Compact>

      {isEditMode && (
        <Flex gap={12}>
          <Space.Compact>
            <Button
              disabled={!hasPrevious}
              icon={<StepBackwardOutlined />}
              onClick={navigateToPrevious}
              size="large"
              title="Previous Contestant"
            />
            <Button icon={<TableOutlined />} onClick={() => navigate('/the-search')} size="large">
              Listing
            </Button>
            <Button
              disabled={!hasNext}
              icon={<StepForwardOutlined />}
              onClick={navigateToNext}
              size="large"
              title="Next Contestant"
            />
          </Space.Compact>
          {onApplyChanges && (
            <Button icon={<CheckOutlined />} onClick={onApplyChanges} size="large" type="default">
              Apply Changes
            </Button>
          )}
        </Flex>
      )}
    </Flex>
  );
}
