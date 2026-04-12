import { Alert, Button, Card, Flex, Form, Rate, Typography } from 'antd';
import { useState } from 'react';
import type { Contestant, CoreSkills } from '../../types/contestant';
import { TRACKS } from '../../utilities/constants';
import { validateTrackSkills } from '../../utilities/contestant-factory';
import { ContestantHeader } from './ContestantHeader';

type StepCoreSkillsProps = {
  contestant: Partial<Contestant>;
  updateContestant: (data: Partial<Contestant>) => void;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  existingContestants: Contestant[];
  isEditMode?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
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

export function StepCoreSkills({
  contestant,
  updateContestant,
  setStep,
  existingContestants,
  isEditMode = false,
  isDirty = false,
  isSaving = false,
  onSave,
}: StepCoreSkillsProps) {
  const [form] = Form.useForm();
  const [validationError, setValidationError] = useState<string | null>(null);

  const onValuesChange = (_changedValues: Partial<CoreSkills>, allValues: CoreSkills) => {
    updateContestant({ coreSkills: allValues });

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
          <Button.Group>
            <Button onClick={() => setStep((prev) => prev - 1)} size="large">
              Previous
            </Button>
            <Button disabled={!!validationError} htmlType="submit" size="large" type="primary">
              Next Step
            </Button>
            {isEditMode && isDirty && onSave && (
              <Button loading={isSaving} onClick={onSave} size="large" type="default">
                Save Changes
              </Button>
            )}
          </Button.Group>
        </Form.Item>
      </Form>
    </>
  );
}
