import { Typography } from 'antd';
import { Content } from 'components/Content';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLocalStorage } from 'react-use';
import { ContestantBuilderStepper } from '../components/builder/ContestantBuilderStepper';
import { StepAppearance } from '../components/builder/StepAppearance';
import { StepBasicInfo } from '../components/builder/StepBasicInfo';
import { StepCoreSkills } from '../components/builder/StepCoreSkills';
import { StepPersonality } from '../components/builder/StepPersonality';
import { StepReview } from '../components/builder/StepReview';
import { StepSpecialties } from '../components/builder/StepSpecialties';
import { StepUtilitySkills } from '../components/builder/StepUtilitySkills';
import { useContestantsQuery, useSaveContestantMutation } from '../hooks/useContestants';
import type { Contestant } from '../types/contestant';
import { createContestant, generateContestantId } from '../utilities/contestant-factory';

const TEMP_CONTESTANT_DRAFT = 'TEMP_CONTESTANT_DRAFT';

export function ContestantBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contestantId = searchParams.get('id');

  const { data: contestantsData } = useContestantsQuery();
  const { mutate: saveContestant, isPending: isSaving } = useSaveContestantMutation();

  const [step, setStep] = useState<number>(0);
  const [draftContestant, setDraftContestant, removeDraft] = useLocalStorage<Partial<Contestant>>(
    TEMP_CONTESTANT_DRAFT,
    {},
  );

  // Store original contestant data for dirty checking
  const [originalContestant, setOriginalContestant] = useState<Partial<Contestant>>({});

  const [contestant, setContestant] = useState<Partial<Contestant>>(() => {
    // If editing existing contestant
    if (contestantId && contestantsData) {
      const existing = contestantsData[contestantId] || {};
      setOriginalContestant(existing);
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

  // Check if contestant data is dirty (has changes)
  const isDirty = !!contestantId && JSON.stringify(contestant) !== JSON.stringify(originalContestant);

  // Save draft to localStorage whenever contestant changes
  useEffect(() => {
    if (!contestantId && contestant.id) {
      setDraftContestant(contestant);
    }
  }, [contestant, contestantId, setDraftContestant]);

  const updateContestant = (data: Partial<Contestant>) => {
    setContestant((prev) => ({ ...prev, ...data }));
  };

  const handleSave = () => {
    const fullContestant = createContestant(contestant);
    saveContestant(fullContestant, {
      onSuccess: () => {
        removeDraft();
        // Update original contestant after save
        setOriginalContestant(fullContestant);
        // Only navigate away if not in edit mode
        if (!contestantId) {
          navigate('/the-search');
        }
      },
    });
  };

  const handleSaveAndFinish = () => {
    const fullContestant = createContestant(contestant);
    saveContestant(fullContestant, {
      onSuccess: () => {
        removeDraft();
        navigate('/the-search');
      },
    });
  };

  const existingIds = contestantsData ? Object.keys(contestantsData).filter((id) => id !== contestantId) : [];
  const existingContestants = contestantsData ? Object.values(contestantsData) : [];

  const isEditMode = !!contestantId;

  return (
    <Content>
      <Typography.Title level={2}>
        {contestantId ? `Edit Contestant: ${contestant.name}` : 'Create New Contestant'}
      </Typography.Title>

      <ContestantBuilderStepper currentStep={step} isEditMode={isEditMode} onStepChange={setStep} />

      {step === 0 && (
        <StepBasicInfo
          contestant={contestant}
          existingContestants={existingContestants}
          existingIds={existingIds}
          isDirty={isDirty}
          isEditMode={isEditMode}
          isSaving={isSaving}
          onSave={handleSave}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 1 && (
        <StepAppearance
          contestant={contestant}
          existingContestants={existingContestants}
          isDirty={isDirty}
          isEditMode={isEditMode}
          isSaving={isSaving}
          onSave={handleSave}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 2 && (
        <StepCoreSkills
          contestant={contestant}
          existingContestants={existingContestants}
          isDirty={isDirty}
          isEditMode={isEditMode}
          isSaving={isSaving}
          onSave={handleSave}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 3 && (
        <StepUtilitySkills
          contestant={contestant}
          existingContestants={existingContestants}
          isDirty={isDirty}
          isEditMode={isEditMode}
          isSaving={isSaving}
          onSave={handleSave}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 4 && (
        <StepPersonality
          contestant={contestant}
          existingContestants={existingContestants}
          isDirty={isDirty}
          isEditMode={isEditMode}
          isSaving={isSaving}
          onSave={handleSave}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 5 && (
        <StepSpecialties
          contestant={contestant}
          existingContestants={existingContestants}
          isDirty={isDirty}
          isEditMode={isEditMode}
          isSaving={isSaving}
          onSave={handleSave}
          setStep={setStep}
          updateContestant={updateContestant}
        />
      )}

      {step === 6 && (
        <StepReview
          contestant={contestant}
          existingContestants={existingContestants}
          isSaving={isSaving}
          onSave={handleSaveAndFinish}
          setStep={setStep}
        />
      )}
    </Content>
  );
}
