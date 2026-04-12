import { Card, Flex, Form, Slider, Typography } from 'antd';
import type { Contestant, PersonalityTraits } from '../../types/contestant';
import { ContestantHeader } from './ContestantHeader';
import { StepControls } from './StepControls';

type StepPersonalityProps = {
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

const MARKS = {
  '-10': '-10',
  '-5': '-5',
  0: '0',
  5: '5',
  10: '10',
};

function getTraitAverage(contestants: Contestant[], trait: keyof PersonalityTraits): number {
  if (contestants.length === 0) return 0;
  const sum = contestants.reduce((acc, c) => acc + (c.personality?.[trait] || 0), 0);
  return Math.round((sum / contestants.length) * 10) / 10;
}

export function StepPersonality({
  contestant,
  updateContestant,
  setStep,
  existingContestants,
  isEditMode = false,
  isDirty = false,
  isSaving = false,
  onSave,
  allContestantIds = [],
  currentStep = 5,
  addParams,
}: StepPersonalityProps) {
  const [form] = Form.useForm();

  const onValuesChange = (_: Partial<PersonalityTraits>, allValues: PersonalityTraits) => {
    updateContestant({ personality: allValues });
  };

  const onFinish = (values: PersonalityTraits) => {
    updateContestant({ personality: values });
    setStep((prev) => prev + 1);
  };

  const handleSubmitForm = async (): Promise<boolean> => {
    try {
      const values = await form.validateFields();
      updateContestant({ personality: values });
      return true;
    } catch (_error) {
      return false;
    }
  };

  return (
    <>
      <Typography.Title level={3}>Personality Traits</Typography.Title>
      <Typography.Paragraph>
        Rate the contestant's personality traits on a scale of -10 to 10, where 0 is neutral. These traits
        influence interactions, relationships, and how they respond to stress and opportunities.
      </Typography.Paragraph>

      <ContestantHeader
        color={contestant.color}
        id={contestant.id}
        name={contestant.name}
        track={contestant.track}
      />

      <Form
        autoComplete="off"
        form={form}
        initialValues={
          contestant.personality || {
            discipline: 0,
            curiosity: 0,
            extroversion: 0,
            sensitivity: 0,
            gentleness: 0,
            sincerity: 0,
            ambition: 0,
            resilience: 0,
            maturity: 0,
          }
        }
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={onValuesChange}
      >
        <Flex gap={16}>
          <Flex style={{ flex: 1 }} vertical>
            <Form.Item
              help="Workaholic/Organized (10) ↔ Reckless/Lazy (-10)"
              label="Discipline"
              name="discipline"
            >
              <Slider marks={MARKS} max={10} min={-10} />
            </Form.Item>

            <Form.Item
              help="Creative/Experimental (10) ↔ Prosaic/Safe (-10)"
              label="Curiosity"
              name="curiosity"
            >
              <Slider marks={MARKS} max={10} min={-10} />
            </Form.Item>

            <Form.Item
              help="Assertive/Sociable (10) ↔ Reserved/Shy (-10)"
              label="Extroversion"
              name="extroversion"
            >
              <Slider marks={MARKS} max={10} min={-10} />
            </Form.Item>

            <Form.Item
              help="Empathetic/Anxious (10) ↔ Thick-skinned/Calm (-10)"
              label="Sensitivity"
              name="sensitivity"
            >
              <Slider marks={MARKS} max={10} min={-10} />
            </Form.Item>

            <Form.Item
              help="Cooperative/Peacekeeper (10) ↔ Antagonistic/Stubborn (-10)"
              label="Gentleness"
              name="gentleness"
            >
              <Slider marks={MARKS} max={10} min={-10} />
            </Form.Item>
          </Flex>

          <Flex style={{ flex: 1 }} vertical>
            <Form.Item
              help="Authentic/Modest (10) ↔ Calculative/Pretentious (-10)"
              label="Sincerity"
              name="sincerity"
            >
              <Slider marks={MARKS} max={10} min={-10} />
            </Form.Item>

            <Form.Item
              help="Ruthless/Competitive (10) ↔ Passive/Participatory (-10)"
              label="Ambition"
              name="ambition"
            >
              <Slider marks={MARKS} max={10} min={-10} />
            </Form.Item>

            <Form.Item
              help="Stoic/Unshakable (10) ↔ Fragile/Reactive (-10)"
              label="Resilience"
              name="resilience"
            >
              <Slider marks={MARKS} max={10} min={-10} />
            </Form.Item>

            <Form.Item
              help="Professional/Composed (10) ↔ Childish/Impulsive (-10)"
              label="Maturity"
              name="maturity"
            >
              <Slider marks={MARKS} max={10} min={-10} />
            </Form.Item>
          </Flex>

          <div style={{ width: 300 }}>
            <Card size="small" title="Personality Averages">
              {(
                [
                  'discipline',
                  'curiosity',
                  'extroversion',
                  'sensitivity',
                  'gentleness',
                  'sincerity',
                  'ambition',
                  'resilience',
                  'maturity',
                ] as Array<keyof PersonalityTraits>
              ).map((trait) => {
                const avg = getTraitAverage(existingContestants, trait);
                const current = contestant.personality?.[trait] || 0;
                const label = trait.charAt(0).toUpperCase() + trait.slice(1);
                return (
                  <div key={trait} style={{ marginBottom: '0.5rem' }}>
                    <Flex justify="space-between" style={{ fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: current !== 0 ? 'bold' : 'normal' }}>{label}</span>
                      <span>
                        Avg: {avg !== 0 ? avg.toFixed(1) : '0.0'} | You:{' '}
                        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                          {current > 0 ? '+' : ''}
                          {current}
                        </span>
                      </span>
                    </Flex>
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
