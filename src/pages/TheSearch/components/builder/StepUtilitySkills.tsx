import { Button, Card, Flex, Form, Rate, Typography } from 'antd';
import type { Contestant, UtilitySkills } from '../../types/contestant';
import { ContestantHeader } from './ContestantHeader';

type StepUtilitySkillsProps = {
  contestant: Partial<Contestant>;
  updateContestant: (data: Partial<Contestant>) => void;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  existingContestants: Contestant[];
  isEditMode?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
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

export function StepUtilitySkills({
  contestant,
  updateContestant,
  setStep,
  existingContestants,
  isEditMode = false,
  isDirty = false,
  isSaving = false,
  onSave,
}: StepUtilitySkillsProps) {
  const [form] = Form.useForm();

  const onValuesChange = (_: Partial<UtilitySkills>, allValues: UtilitySkills) => {
    updateContestant({ utilitySkills: allValues });
  };

  const onFinish = (values: UtilitySkills) => {
    updateContestant({ utilitySkills: values });
    setStep((prev) => prev + 1);
  };

  const handleRandomDistribution = () => {
    // Calculate total from core skills
    const coreSkills = contestant.coreSkills;
    if (!coreSkills) return;

    const coreTotal =
      (coreSkills.vocals || 3) +
      (coreSkills.rap || 3) +
      (coreSkills.dance || 3) +
      (coreSkills.stagePresence || 3) +
      (coreSkills.visual || 3) +
      (coreSkills.uniqueness || 3) +
      (coreSkills.leadership || 3);

    // Distribute the same total across utility skills randomly
    const skillNames: Array<keyof UtilitySkills> = [
      'potential',
      'memory',
      'stamina',
      'learning',
      'acrobatics',
      'consistency',
      'charisma',
    ];

    // Start with minimum value for each (1)
    const values: UtilitySkills = {
      potential: 1,
      memory: 1,
      stamina: 1,
      learning: 1,
      acrobatics: 1,
      consistency: 1,
      charisma: 1,
    };

    // Distribute remaining stars
    let remaining = coreTotal - skillNames.length; // Total minus 1 per skill

    while (remaining > 0) {
      // Pick a random skill
      const randomSkill = skillNames[Math.floor(Math.random() * skillNames.length)];

      // Only add if we haven't reached max (5)
      if (values[randomSkill] < 5) {
        values[randomSkill]++;
        remaining--;
      }
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

      <Flex align="center" gap={16} style={{ marginBottom: '1rem' }}>
        <Button onClick={handleRandomDistribution} type="default">
          Random Distribution (Based on Core Skills Total)
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
          <Button.Group>
            <Button onClick={() => setStep((prev) => prev - 1)} size="large">
              Previous
            </Button>
            <Button htmlType="submit" size="large" type="primary">
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
