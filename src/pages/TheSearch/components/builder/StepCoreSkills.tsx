import { RedoOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Form, Rate, Typography } from 'antd';
import { useState } from 'react';
import type { Contestant, CoreSkills } from '../../types/contestant';
import { TRACKS } from '../../utilities/constants';
import { validateTrackSkills } from '../../utilities/contestant-factory';
import { ContestantBuilderStepperControls } from './ContestantBuilderStepper';
import { ContestantHeader } from './ContestantHeader';

type StepCoreSkillsProps = {
  contestant: Partial<Contestant>;
  updateContestant: (data: Partial<Contestant>) => void;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  existingContestants: Contestant[];
  isEditMode?: boolean;
  allContestantIds?: string[];
  currentStep?: number;
  addParams?: (params: Record<string, unknown>) => void;
  onApplyChanges?: () => void;
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
  allContestantIds = [],
  currentStep = 2,
  addParams,
  onApplyChanges,
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

  const handleRandomize = () => {
    // Total stars to distribute across vocals, rap, and dance (5-11)
    const totalStars = Math.floor(Math.random() * 7) + 5; // 5-11

    // Determine which skill should be highest based on track
    let trackSkill: 'vocals' | 'rap' | 'dance' = 'vocals';
    if (contestant.track === TRACKS.VOCAL) trackSkill = 'vocals';
    else if (contestant.track === TRACKS.RAP) trackSkill = 'rap';
    else if (contestant.track === TRACKS.DANCE) trackSkill = 'dance';

    // Determine track skill value (should be highest, minimum 2 to ensure it can be > others)
    // The track skill should get at least totalStars - 8 to ensure others can't exceed it
    const minTrackValue = Math.max(2, Math.ceil(totalStars / 2));
    const maxTrackValue = Math.min(5, totalStars - 2); // Leave at least 2 for the other two skills
    const trackValue = Math.floor(Math.random() * (maxTrackValue - minTrackValue + 1)) + minTrackValue;

    // Remaining stars for the other two skills
    const remaining = totalStars - trackValue;

    // Distribute remaining stars between the other two skills
    // Neither can exceed trackValue - 1
    const maxOtherValue = Math.min(trackValue - 1, 5);

    let otherSkill1 = Math.min(Math.floor(Math.random() * remaining) + 1, maxOtherValue);
    let otherSkill2 = remaining - otherSkill1;

    // Make sure otherSkill2 doesn't exceed the maximum
    if (otherSkill2 > maxOtherValue) {
      otherSkill1 = remaining - maxOtherValue;
      otherSkill2 = maxOtherValue;
    }

    // Ensure both are at least 1
    if (otherSkill1 < 1) otherSkill1 = 1;
    if (otherSkill2 < 1) otherSkill2 = 1;

    // Assign values based on track
    let vocals: number;
    let rap: number;
    let dance: number;
    if (trackSkill === 'vocals') {
      vocals = trackValue;
      rap = otherSkill1;
      dance = otherSkill2;
    } else if (trackSkill === 'rap') {
      vocals = otherSkill1;
      rap = trackValue;
      dance = otherSkill2;
    } else {
      vocals = otherSkill1;
      rap = otherSkill2;
      dance = trackValue;
    }

    // Generate random values for stage presence and leadership (1-5)
    const stagePresence = Math.floor(Math.random() * 5) + 1;
    const leadership = Math.floor(Math.random() * 5) + 1;

    const randomizedSkills: CoreSkills = {
      vocals,
      rap,
      dance,
      stagePresence,
      visual: 3,
      uniqueness: 3,
      leadership,
    };

    form.setFieldsValue(randomizedSkills);
    updateContestant({ coreSkills: randomizedSkills });
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

      <Button
        icon={<RedoOutlined />}
        onClick={handleRandomize}
        style={{ marginBottom: '1rem' }}
        type="default"
      >
        Randomize Core Skills
      </Button>

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
          <ContestantBuilderStepperControls
            addParams={addParams}
            allContestantIds={allContestantIds}
            currentContestantId={contestant.id}
            currentStep={currentStep}
            isEditMode={isEditMode}
            onApplyChanges={onApplyChanges}
            onSubmitForm={handleSubmitForm}
            setStep={setStep}
          />
        </Form.Item>
      </Form>
    </>
  );
}
