import { RedoOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Form, Rate, Typography } from 'antd';
import { useState } from 'react';
import type { Contestant, UtilitySkills } from '../../types/contestant';
import { TRACKS } from '../../utilities/constants';
import { ContestantBuilderStepperControls } from './ContestantBuilderStepper';
import { ContestantHeader } from './ContestantHeader';

type StepUtilitySkillsProps = {
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

function getSkillDistribution(contestants: Contestant[], skill: keyof UtilitySkills): Record<number, number> {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (contestants.length === 0) return distribution;

  for (const c of contestants) {
    const value = c.utilitySkills?.[skill] || 3;
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
 * Generate DNA/hash from utility skills
 * Format: p3m3s3l3a3c3c3 (potential, memory, stamina, learning, acrobatics, consistency, charisma)
 */
function generateUtilitySkillsHash(utilitySkills?: UtilitySkills): string {
  if (!utilitySkills) return '';

  return `p${utilitySkills.potential || 3}m${utilitySkills.memory || 3}s${utilitySkills.stamina || 3}l${utilitySkills.learning || 3}a${utilitySkills.acrobatics || 3}c${utilitySkills.consistency || 3}c${utilitySkills.charisma || 3}`;
}

export function StepUtilitySkills({
  contestant,
  updateContestant,
  setStep,
  existingContestants,
  isEditMode = false,
  allContestantIds = [],
  currentStep = 3,
  addParams,
  onApplyChanges,
}: StepUtilitySkillsProps) {
  const [form] = Form.useForm();
  const [validationError, setValidationError] = useState<string | null>(null);

  const onValuesChange = (_: Partial<UtilitySkills>, allValues: UtilitySkills) => {
    updateContestant({ utilitySkills: allValues });

    // Check for zero or undefined values
    const skillNames: Array<keyof UtilitySkills> = [
      'potential',
      'memory',
      'stamina',
      'learning',
      'acrobatics',
      'consistency',
      'charisma',
    ];

    const invalidSkills = skillNames.filter((skill) => !allValues[skill] || allValues[skill] === 0);

    if (invalidSkills.length > 0) {
      const skillLabels = invalidSkills.map((skill) => skill.charAt(0).toUpperCase() + skill.slice(1));
      setValidationError(
        `All skills must have a value of at least 1. Missing or zero values: ${skillLabels.join(', ')}`,
      );
    } else {
      setValidationError(null);
    }
  };

  const onFinish = (values: UtilitySkills) => {
    updateContestant({ utilitySkills: values });
    setStep((prev) => prev + 1);
  };

  const handleSubmitForm = async (): Promise<boolean> => {
    try {
      const values = await form.validateFields();
      updateContestant({ utilitySkills: values });
      return true;
    } catch (_error) {
      return false;
    }
  };

  const handleRandomDistribution = () => {
    const coreSkills = contestant.coreSkills;
    const track = contestant.track;
    if (!coreSkills || !track) return;

    /**
     * Generate random skill value with weighted distribution:
     * - 5% chance for 5
     * - 10% chance for 1
     * - 85% distributed among 2, 3, 4
     */
    const getRandomSkillValue = (): number => {
      const roll = Math.random() * 100;
      if (roll < 5) return 5; // 5% chance
      if (roll < 25) return 1; // 20% chance
      // 75% distributed among 2, 3, 4
      const midRoll = Math.random();
      if (midRoll < 0.45) return 2;
      if (midRoll < 0.85) return 3;
      return 4;
    };

    /**
     * Get skill value around a target (target -1, target, or target +1)
     */
    const getSkillAroundTarget = (targetSkill: number): number => {
      const offset = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
      const value = targetSkill + offset;
      return Math.max(1, Math.min(5, value)); // Clamp between 1 and 5
    };

    const values: UtilitySkills = {
      potential: getRandomSkillValue(),
      memory: 0, // Will be set based on track
      stamina: 0, // Will be set based on track
      learning: getRandomSkillValue(),
      acrobatics: 0, // Will be set based on track
      consistency: getRandomSkillValue(),
      charisma: 6 - (coreSkills.visual || 3), // Opposite of visual (5->1, 4->2, 3->3, 2->4, 1->5)
    };

    // Set Memory based on track
    if (track === TRACKS.RAP) {
      values.memory = getSkillAroundTarget(coreSkills.rap || 3);
    } else {
      values.memory = getRandomSkillValue();
    }

    // Set Stamina based on track
    if (track === TRACKS.DANCE) {
      values.stamina = getSkillAroundTarget(coreSkills.dance || 3);
    } else {
      values.stamina = getRandomSkillValue();
    }

    // Set Acrobatics: random for all, but only dancers can have > 2
    if (track === TRACKS.DANCE) {
      values.acrobatics = getRandomSkillValue();
    } else {
      values.acrobatics = 1; // Cap at 1 for non-dancers
    }

    // Update form and state
    form.setFieldsValue(values);
    updateContestant({ utilitySkills: values });
  };

  // Calculate totals
  const coreSkillsTotal =
    (contestant.coreSkills?.vocals || 3) +
    (contestant.coreSkills?.rap || 3) +
    (contestant.coreSkills?.dance || 3) +
    (contestant.coreSkills?.stagePresence || 3) +
    (contestant.coreSkills?.visual || 3) +
    (contestant.coreSkills?.uniqueness || 3) +
    (contestant.coreSkills?.leadership || 3);

  const utilitySkillsTotal =
    (contestant.utilitySkills?.potential || 3) +
    (contestant.utilitySkills?.memory || 3) +
    (contestant.utilitySkills?.stamina || 3) +
    (contestant.utilitySkills?.learning || 3) +
    (contestant.utilitySkills?.acrobatics || 3) +
    (contestant.utilitySkills?.consistency || 3) +
    (contestant.utilitySkills?.charisma || 3);

  // Generate DNA hash and check for duplicates
  const currentHash = generateUtilitySkillsHash(contestant.utilitySkills);
  const duplicateContestants = existingContestants.filter((c) => {
    // Don't compare with the same contestant when editing
    if (contestant.id && c.id === contestant.id) return false;
    return generateUtilitySkillsHash(c.utilitySkills) === currentHash;
  });

  return (
    <>
      <Typography.Title level={3}>Utility Skills</Typography.Title>
      <Typography.Paragraph>
        Rate the contestant's secondary skills that influence growth, relationships, and narrative events.
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
                The following contestant(s) have identical utility skills:{' '}
                <strong>{duplicateContestants.map((c) => c.name).join(', ')}</strong>
              </div>
            </>
          }
          message="Duplicate Utility Skills Detected"
          showIcon
          style={{ marginBottom: '1rem' }}
          type="warning"
        />
      )}

      <Flex align="center" gap={16} style={{ marginBottom: '1rem' }}>
        <Button icon={<RedoOutlined />} onClick={handleRandomDistribution} type="default">
          Randomize Utility Skills
        </Button>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <Typography.Text strong>
            Core Skills Total: <span style={{ color: '#1890ff', fontSize: '1.1rem' }}>{coreSkillsTotal}</span>
          </Typography.Text>
          <Typography.Text strong>
            Utility Skills Total:{' '}
            <span
              style={{
                color: utilitySkillsTotal === coreSkillsTotal ? '#52c41a' : '#1890ff',
                fontSize: '1.1rem',
              }}
            >
              {utilitySkillsTotal}
            </span>
            {utilitySkillsTotal === coreSkillsTotal && ' ✓'}
          </Typography.Text>
        </div>
      </Flex>

      <Form
        autoComplete="off"
        form={form}
        initialValues={
          contestant.utilitySkills || {
            potential: 3,
            memory: 3,
            stamina: 3,
            learning: 3,
            acrobatics: 3,
            consistency: 3,
            charisma: 3,
          }
        }
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={onValuesChange}
      >
        <Flex gap={16}>
          <Flex style={{ flex: 1 }} vertical>
            <Form.Item label="Potential" name="potential">
              <Rate allowHalf={false} />
            </Form.Item>

            <Form.Item label="Memory" name="memory">
              <Rate allowHalf={false} />
            </Form.Item>

            <Form.Item label="Stamina" name="stamina">
              <Rate allowHalf={false} />
            </Form.Item>

            <Form.Item label="Learning" name="learning">
              <Rate allowHalf={false} />
            </Form.Item>
          </Flex>

          <Flex style={{ flex: 1 }} vertical>
            <Form.Item label="Acrobatics" name="acrobatics">
              <Rate allowHalf={false} />
            </Form.Item>

            <Form.Item label="Consistency" name="consistency">
              <Rate allowHalf={false} />
            </Form.Item>

            <Form.Item label="Charisma" name="charisma">
              <Rate allowHalf={false} />
            </Form.Item>
          </Flex>

          <div style={{ width: 300 }}>
            <Card size="small" title="Utility Skills Distribution">
              {(
                [
                  'potential',
                  'memory',
                  'stamina',
                  'learning',
                  'acrobatics',
                  'consistency',
                  'charisma',
                ] as Array<keyof UtilitySkills>
              ).map((skill) => {
                const distribution = getSkillDistribution(existingContestants, skill);
                const current = contestant.utilitySkills?.[skill] || 3;
                const label = skill.charAt(0).toUpperCase() + skill.slice(1);
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
