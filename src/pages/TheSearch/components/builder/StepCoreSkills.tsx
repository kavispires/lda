import { Alert, Card, Flex, Form, Rate, Typography } from 'antd';
import { useState } from 'react';
import type { Contestant, CoreSkills } from '../../types/contestant';
import { TRACKS } from '../../utilities/constants';
import { validateTrackSkills } from '../../utilities/contestant-factory';
import { ContestantHeader } from './ContestantHeader';
import { StepControls } from './StepControls';

type StepCoreSkillsProps = {
  contestant: Partial<Contestant>;
  updateContestant: (data: Partial<Contestant>) => void;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  existingContestants: Contestant[];
  isEditMode?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  allContestantIds?: string[];
  currentStep?: number;
  addParams?: (params: Record<string, unknown>) => void;
};

function getSkillDistribution(contestants: Contestant[], skill: keyof CoreSkills): Record<number, number> {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (contestants.length === 0) return distribution;

  for (const c of contestants) {
    const value = c.coreSkills?.[skill] || 3;
    distribution[value] = (distribution[value] || 0) + 1;
  }

  // Convert to percentages
  const total = contestants.length;
  return {
    1: Math.round((distribution[1] / total) * 100),
    2: Math.round((distribution[2] / total) * 100),
    3: Math.round((distribution[3] / total) * 100),
    4: Math.round((distribution[4] / total) * 100),
    5: Math.round((distribution[5] / total) * 100),
  };
}

/**
 * Generate DNA/hash from core skills
 * Format: v3r1d4s3v2u3l4 (vocals, rap, dance, stagePresence, visual, uniqueness, leadership)
 */
function generateCoreSkillsHash(coreSkills?: CoreSkills): string {
  if (!coreSkills) return '';

  return `v${coreSkills.vocals || 3}r${coreSkills.rap || 3}d${coreSkills.dance || 3}s${coreSkills.stagePresence || 3}v${coreSkills.visual || 3}u${coreSkills.uniqueness || 3}l${coreSkills.leadership || 3}`;
}

export function StepCoreSkills({
  contestant,
  updateContestant,
  setStep,
  existingContestants,
  isEditMode = false,
  isDirty = false,
  isSaving = false,
  onSave,
  allContestantIds = [],
  currentStep = 2,
  addParams,
}: StepCoreSkillsProps) {
  const [form] = Form.useForm();
  const [validationError, setValidationError] = useState<string | null>(null);

  const onValuesChange = (_changedValues: Partial<CoreSkills>, allValues: CoreSkills) => {
    updateContestant({ coreSkills: allValues });

    // Check for zero or undefined values
    const skillNames: Array<keyof CoreSkills> = [
      'vocals',
      'rap',
      'dance',
      'stagePresence',
      'visual',
      'uniqueness',
      'leadership',
    ];

    const invalidSkills = skillNames.filter((skill) => !allValues[skill] || allValues[skill] === 0);

    if (invalidSkills.length > 0) {
      const skillLabels = invalidSkills.map((skill) => {
        if (skill === 'stagePresence') return 'Stage Presence';
        return skill.charAt(0).toUpperCase() + skill.slice(1);
      });
      setValidationError(
        `All skills must have a value of at least 1. Missing or zero values: ${skillLabels.join(', ')}`,
      );
      return;
    }

    // Validate track skills
    if (contestant.track) {
      const validation = validateTrackSkills({
        ...contestant,
        coreSkills: allValues,
      } as Contestant);
      setValidationError(validation.isValid ? null : validation.error || null);
    }
  };

  const onFinish = (values: CoreSkills) => {
    updateContestant({ coreSkills: values });
    setStep((prev) => prev + 1);
  };

  const handleSubmitForm = async (): Promise<boolean> => {
    try {
      const values = await form.validateFields();
      updateContestant({ coreSkills: values });
      return true;
    } catch (_error) {
      return false;
    }
  };

  const getTrackLabel = (skill: 'vocals' | 'rap' | 'dance') => {
    const labels = {
      vocals: contestant.track === TRACKS.VOCAL ? 'Vocals ★' : 'Vocals',
      rap: contestant.track === TRACKS.RAP ? 'Rap ★' : 'Rap',
      dance: contestant.track === TRACKS.DANCE ? 'Dance ★' : 'Dance',
    };
    return labels[skill];
  };

  // Calculate core skills total
  const coreSkillsTotal =
    (contestant.coreSkills?.vocals || 3) +
    (contestant.coreSkills?.rap || 3) +
    (contestant.coreSkills?.dance || 3) +
    (contestant.coreSkills?.stagePresence || 3) +
    (contestant.coreSkills?.visual || 3) +
    (contestant.coreSkills?.uniqueness || 3) +
    (contestant.coreSkills?.leadership || 3);

  // Generate DNA hash and check for duplicates
  const currentHash = generateCoreSkillsHash(contestant.coreSkills);
  const duplicateContestants = existingContestants.filter((c) => {
    // Don't compare with the same contestant when editing
    if (contestant.id && c.id === contestant.id) return false;
    return generateCoreSkillsHash(c.coreSkills) === currentHash;
  });

  return (
    <>
      <Typography.Title level={3}>Core Skills</Typography.Title>
      <Typography.Paragraph>
        Rate the contestant's core performance skills on a scale of 1-5. The primary skill for their track (
        {contestant.track}) must be equal to or higher than the other two basic skills.
      </Typography.Paragraph>

      <ContestantHeader
        color={contestant.color}
        id={contestant.id}
        name={contestant.name}
        track={contestant.track}
      />

      {validationError && (
        <Alert description={validationError} message="Validation Error" showIcon type="error" />
      )}

      {duplicateContestants.length > 0 && (
        <Alert
          description={
            <>
              <div style={{ marginBottom: '0.5rem' }}>
                DNA Hash: <strong>{currentHash}</strong>
              </div>
              <div>
                The following contestant(s) have identical core skills:{' '}
                <strong>{duplicateContestants.map((c) => c.name).join(', ')}</strong>
              </div>
            </>
          }
          message="Duplicate Core Skills Detected"
          showIcon
          style={{ marginBottom: '1rem' }}
          type="warning"
        />
      )}

      <div style={{ marginBottom: '1rem' }}>
        <Typography.Text strong>
          Core Skills Total: <span style={{ color: '#1890ff', fontSize: '1.1rem' }}>{coreSkillsTotal}</span>
        </Typography.Text>
      </div>

      <Form
        autoComplete="off"
        form={form}
        initialValues={
          contestant.coreSkills || {
            vocals: 3,
            rap: 3,
            dance: 3,
            stagePresence: 3,
            visual: 3,
            uniqueness: 3,
            leadership: 3,
          }
        }
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={onValuesChange}
      >
        <Flex gap={16}>
          <Flex style={{ flex: 1 }} vertical>
            <Form.Item label={getTrackLabel('vocals')} name="vocals">
              <Rate allowHalf={false} />
            </Form.Item>

            <Form.Item label={getTrackLabel('rap')} name="rap">
              <Rate allowHalf={false} />
            </Form.Item>

            <Form.Item label={getTrackLabel('dance')} name="dance">
              <Rate allowHalf={false} />
            </Form.Item>

            <Form.Item label="Stage Presence" name="stagePresence">
              <Rate allowHalf={false} />
            </Form.Item>
          </Flex>

          <Flex style={{ flex: 1 }} vertical>
            <Form.Item label="Visual" name="visual">
              <Rate allowHalf={false} />
            </Form.Item>

            <Form.Item label="Uniqueness" name="uniqueness">
              <Rate allowHalf={false} />
            </Form.Item>

            <Form.Item label="Leadership" name="leadership">
              <Rate allowHalf={false} />
            </Form.Item>
          </Flex>

          <div style={{ width: 300 }}>
            <Card size="small" title="Core Skills Distribution">
              {(
                ['vocals', 'rap', 'dance', 'stagePresence', 'visual', 'uniqueness', 'leadership'] as Array<
                  keyof CoreSkills
                >
              ).map((skill) => {
                const distribution = getSkillDistribution(existingContestants, skill);
                const current = contestant.coreSkills?.[skill] || 3;
                const label =
                  skill === 'stagePresence'
                    ? 'Stage Presence'
                    : skill.charAt(0).toUpperCase() + skill.slice(1);
                return (
                  <div key={skill} style={{ marginBottom: '0.75rem' }}>
                    <Typography.Text strong style={{ fontSize: '0.75rem' }}>
                      {label}
                    </Typography.Text>
                    <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                      {[5, 4, 3, 2, 1].map((value) => (
                        <span
                          key={value}
                          style={{
                            fontWeight: current === value ? 'bold' : 'normal',
                            color: current === value ? '#1890ff' : '#666',
                          }}
                        >
                          {value}: {distribution[value]}%
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        </Flex>

        <Form.Item>
          <StepControls
            addParams={addParams}
            allContestantIds={allContestantIds}
            currentContestantId={contestant.id}
            currentStep={currentStep}
            isDirty={isDirty}
            isEditMode={isEditMode}
            isSaving={isSaving}
            onSave={onSave}
            onSubmitForm={handleSubmitForm}
            setStep={setStep}
          />
        </Form.Item>
      </Form>
    </>
  );
}
