import { Typography } from 'antd';
import { Content } from 'components/Content';
import { useQueryParams } from 'hooks/useQueryParams';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from 'react-use';
import { ContestantBuilderStepper } from '../components/builder/ContestantBuilderStepper';
import { StepAppearance } from '../components/builder/StepAppearance';
import { StepBasicInfo } from '../components/builder/StepBasicInfo';
import { StepCoreSkills } from '../components/builder/StepCoreSkills';
import { StepPersonality } from '../components/builder/StepPersonality';
import { StepReview } from '../components/builder/StepReview';
import { StepSpecialties } from '../components/builder/StepSpecialties';
import { StepUtilitySkills } from '../components/builder/StepUtilitySkills';
import { useContestantsContext } from '../services/ContestantsProvider';
import type { Contestant } from '../types/contestant';
import { createContestant, generateContestantId } from '../utilities/contestant-factory';

const TEMP_CONTESTANT_DRAFT = 'TEMP_CONTESTANT_DRAFT';

export function ContestantBuilderPage() {
  const navigate = useNavigate();
  const { queryParams, addParams } = useQueryParams();
  const contestantId = queryParams.get('id');
  const stepFromUrl = queryParams.get('step');

  const { contestants: contestantsData, updateLocalContestant } = useContestantsContext();

  const [step, setStep] = useState<number>(() => {
    const parsed = stepFromUrl ? Number.parseInt(stepFromUrl, 10) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  });
  const [draftContestant, setDraftContestant, removeDraft] = useLocalStorage<Partial<Contestant>>(
    TEMP_CONTESTANT_DRAFT,
    {},
  );

  const [contestant, setContestant] = useState<Partial<Contestant>>(() => {
    // If editing existing contestant
    if (contestantId && contestantsData) {
      const existing = contestantsData[contestantId] || {};
      return existing;
    }
    // If creating new contestant, restore from draft or create new
    if (draftContestant && Object.keys(draftContestant).length > 0) {
      return draftContestant;
    }
    const existingIds = contestantsData ? Object.keys(contestantsData) : [];
    const newId = generateContestantId(existingIds);
    return createContestant({ id: newId });
  });

  // Save draft to localStorage whenever contestant changes
  useEffect(() => {
    if (!contestantId && contestant.id) {
      setDraftContestant(contestant);
    }
  }, [contestant, contestantId, setDraftContestant]);

  // Update contestant data when contestant ID changes
  useEffect(() => {
    if (contestantId && contestantsData) {
      const existing = contestantsData[contestantId] || {};
      setContestant(existing);
    }
  }, [contestantId, contestantsData]);

  // Update step when URL step parameter changes
  useEffect(() => {
    const parsed = stepFromUrl ? Number.parseInt(stepFromUrl, 10) : 0;
    const newStep = Number.isNaN(parsed) ? 0 : parsed;
    setStep(newStep);
  }, [stepFromUrl]);

  const updateContestant = (data: Partial<Contestant>) => {
    setContestant((prev) => ({ ...prev, ...data }));
  };

  const handleAddContestant = () => {
    const fullContestant = createContestant({ ...contestant, updatedAt: Date.now() });
    updateLocalContestant(fullContestant);
    removeDraft();
    navigate('/the-search');
  };

  const handleApplyChanges = () => {
    const fullContestant = createContestant({ ...contestant, updatedAt: Date.now() });
    updateLocalContestant(fullContestant);
  };

  const handleApplyChangesAndReturn = () => {
    const fullContestant = createContestant({ ...contestant, updatedAt: Date.now() });
    updateLocalContestant(fullContestant);
    navigate('/the-search');
  };

  const existingIds = contestantsData ? Object.keys(contestantsData).filter((id) => id !== contestantId) : [];
  const existingContestants = contestantsData ? Object.values(contestantsData) : [];
  const allContestantIds = contestantsData ? Object.keys(contestantsData).sort() : [];

  const isEditMode = !!contestantId;

  return (
    <Content key={contestantId}>
      <Typography.Title level={2}>
        {contestantId ? `Edit Contestant: ${contestant.name}` : 'Create New Contestant'}
      </Typography.Title>

      <ContestantBuilderStepper currentStep={step} isEditMode={isEditMode} onStepChange={setStep} />

      {step === 0 && (
        <StepBasicInfo
          addParams={addParams}
          allContestantIds={allContestantIds}
          contestant={contestant}
          currentStep={step}
          existingContestants={existingContestants}
          existingIds={existingIds}
          isEditMode={isEditMode}
          key={contestant.id}
          onApplyChanges={isEditMode ? handleApplyChanges : undefined}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 1 && (
        <StepAppearance
          addParams={addParams}
          allContestantIds={allContestantIds}
          contestant={contestant}
          currentStep={step}
          existingContestants={existingContestants}
          isEditMode={isEditMode}
          key={contestant.id}
          onApplyChanges={isEditMode ? handleApplyChanges : undefined}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 2 && (
        <StepCoreSkills
          addParams={addParams}
          allContestantIds={allContestantIds}
          contestant={contestant}
          currentStep={step}
          existingContestants={existingContestants}
          isEditMode={isEditMode}
          key={contestant.id}
          onApplyChanges={isEditMode ? handleApplyChanges : undefined}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 3 && (
        <StepUtilitySkills
          addParams={addParams}
          allContestantIds={allContestantIds}
          contestant={contestant}
          currentStep={step}
          existingContestants={existingContestants}
          isEditMode={isEditMode}
          key={contestant.id}
          onApplyChanges={isEditMode ? handleApplyChanges : undefined}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 4 && (
        <StepSpecialties
          addParams={addParams}
          allContestantIds={allContestantIds}
          contestant={contestant}
          currentStep={step}
          existingContestants={existingContestants}
          isEditMode={isEditMode}
          key={contestant.id}
          onApplyChanges={isEditMode ? handleApplyChanges : undefined}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 5 && (
        <StepPersonality
          addParams={addParams}
          allContestantIds={allContestantIds}
          contestant={contestant}
          currentStep={step}
          existingContestants={existingContestants}
          isEditMode={isEditMode}
          key={contestant.id}
          onApplyChanges={isEditMode ? handleApplyChanges : undefined}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 6 && (
        <StepReview
          contestant={contestant}
          existingContestants={existingContestants}
          isEditMode={isEditMode}
          key={contestant.id}
          onSave={isEditMode ? handleApplyChangesAndReturn : handleAddContestant}
          setStep={setStep}
        />
      )}
    </Content>
  );
}
