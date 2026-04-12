import { SaveOutlined, StepBackwardOutlined, StepForwardOutlined, TableOutlined } from '@ant-design/icons';
import { Button, Flex, Space } from 'antd';
import { useNavigate } from 'react-router-dom';

type StepControlsProps = {
  setStep: React.Dispatch<React.SetStateAction<number>>;
  isEditMode?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  hidePreviousButton?: boolean;
  currentContestantId?: string;
  allContestantIds?: string[];
  currentStep?: number;
  addParams?: (params: Record<string, unknown>) => void;
  onSubmitForm?: () => Promise<boolean>;
};

export function StepControls({
  hidePreviousButton,
  setStep,
  isEditMode,
  isDirty,
  isSaving,
  onSave,
  currentContestantId,
  allContestantIds = [],
  currentStep = 0,
  addParams,
  onSubmitForm,
}: StepControlsProps) {
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
          <Space.Compact>
            <Button
              disabled={!isDirty || !onSave}
              icon={<SaveOutlined />}
              loading={isSaving}
              onClick={onSave}
              size="large"
              type="default"
            >
              Save Changes
            </Button>
          </Space.Compact>
        </Flex>
      )}
    </Flex>
  );
}
