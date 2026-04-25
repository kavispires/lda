import { RedoOutlined } from '@ant-design/icons';
import { Button, Checkbox, ColorPicker, Flex, Form, Input, Progress, Select, Space, Typography } from 'antd';
import type { AggregationColor } from 'antd/es/color-picker/color';
import { useEffect, useState } from 'react';
import NAMES from '../../data/names.json';
import type { Contestant } from '../../types/contestant';
import { ALIGNMENTS, GRADES, TRACKS } from '../../utilities/constants';
import { generateContestantId } from '../../utilities/contestant-factory';
import { getZodiacSignOptions } from '../../utilities/helpers';
import { ContestantAvatar } from '../ContestantAvatar';
import { ContestantBuilderStepperControls } from './ContestantBuilderStepper';

/**
 * Gets a random name from the names list that hasn't been used yet
 */
function getRandomName(existingContestants: Contestant[]): string {
  const usedNames = new Set(existingContestants.map((c) => c.name));
  const availableNames = NAMES.filter((name) => !usedNames.has(name));

  // If all names are used, fall back to full list
  const namePool = availableNames.length > 0 ? availableNames : NAMES;

  return namePool[Math.floor(Math.random() * namePool.length)];
}

type StepBasicInfoProps = {
  contestant: Partial<Contestant>;
  updateContestant: (data: Partial<Contestant>) => void;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  existingIds: string[];
  existingContestants: Contestant[];
  isEditMode?: boolean;
  allContestantIds?: string[];
  currentStep?: number;
  addParams?: (params: Record<string, unknown>) => void;
  onApplyChanges?: () => void;
};

export function StepBasicInfo({
  contestant,
  updateContestant,
  setStep,
  existingIds,
  existingContestants,
  isEditMode = false,
  allContestantIds = [],
  currentStep = 0,
  addParams,
  onApplyChanges,
}: StepBasicInfoProps) {
  const [form] = Form.useForm();
  const [colorValue, setColorValue] = useState<string>(contestant.color || '#FFFFFF');

  // Auto-generate ID if not present
  useEffect(() => {
    if (!contestant.id) {
      const newId = generateContestantId(existingIds);
      updateContestant({ id: newId });
      form.setFieldsValue({ id: newId });
    }
  }, [contestant.id, existingIds, updateContestant, form]);

  const onValuesChange = (changedValues: Partial<Contestant>) => {
    if (changedValues.color) {
      const color = changedValues.color as unknown as AggregationColor;
      setColorValue(color.toHexString());
      updateContestant({ color: color.toHexString() });
    } else {
      updateContestant(changedValues);
    }
  };

  const onFinish = (values: Partial<Contestant>) => {
    const color =
      typeof values.color === 'string'
        ? values.color
        : (values.color as unknown as AggregationColor).toHexString();
    updateContestant({ ...values, color });
    setStep((prev) => prev + 1);
  };

  const handleRandomName = () => {
    const randomName = getRandomName(existingContestants);
    form.setFieldsValue({ name: randomName });
    updateContestant({ name: randomName });
  };

  const handleSubmitForm = async (): Promise<boolean> => {
    try {
      const values = await form.validateFields();
      const color =
        typeof values.color === 'string'
          ? values.color
          : (values.color as unknown as AggregationColor).toHexString();
      updateContestant({ ...values, color });
      return true;
    } catch (_error) {
      return false;
    }
  };

  return (
    <>
      <Typography.Title level={3}>Basic Information</Typography.Title>
      <Typography.Paragraph>
        Start by providing the contestant's basic information. The ID will be automatically generated
        sequentially (szc-01, szc-02, etc.).
      </Typography.Paragraph>

      <Form
        autoComplete="off"
        form={form}
        initialValues={{
          id: contestant.id || '',
          name: contestant.name || '',
          track: contestant.track || TRACKS.VOCAL,
          grade: contestant.grade || GRADES.D,
          color: contestant.color || '#FFFFFF',
          persona: contestant.persona || '',
          alignment: contestant.alignment || ALIGNMENTS.TRUE_NEUTRAL,
          zodiacSign: contestant.zodiacSign || 'ARIES',
          bias: contestant.bias ?? false,
        }}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={onValuesChange}
      >
        {contestant.id && (
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ContestantAvatar id={contestant.id} name={contestant.name || 'Name'} size={96} />
            {contestant.name && (
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {contestant.name}
                </Typography.Title>
                <Typography.Text type="secondary">{contestant.id}</Typography.Text>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 grid-cols-3">
          <Form.Item label="Contestant ID" name="id" required>
            <Input disabled placeholder="Auto-generated" />
          </Form.Item>

          <Form.Item label="Audition Grade" name="grade" required>
            <Select
              disabled
              options={[
                { value: GRADES.A, label: 'A' },
                { value: GRADES.B, label: 'B' },
                { value: GRADES.C, label: 'C' },
                { value: GRADES.D, label: 'D' },
                { value: GRADES.F, label: 'F' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Alignment" name="alignment" required>
            <Select
              disabled
              options={[
                { value: ALIGNMENTS.LAWFUL_GOOD, label: 'Lawful Good' },
                { value: ALIGNMENTS.NEUTRAL_GOOD, label: 'Neutral Good' },
                { value: ALIGNMENTS.CHAOTIC_GOOD, label: 'Chaotic Good' },
                { value: ALIGNMENTS.LAWFUL_NEUTRAL, label: 'Lawful Neutral' },
                { value: ALIGNMENTS.TRUE_NEUTRAL, label: 'True Neutral' },
                { value: ALIGNMENTS.CHAOTIC_NEUTRAL, label: 'Chaotic Neutral' },
                { value: ALIGNMENTS.LAWFUL_EVIL, label: 'Lawful Evil' },
                { value: ALIGNMENTS.NEUTRAL_EVIL, label: 'Neutral Evil' },
                { value: ALIGNMENTS.CHAOTIC_EVIL, label: 'Chaotic Evil' },
              ]}
            />
          </Form.Item>
        </div>
        <div className="grid gap-4 grid-cols-3">
          <Form.Item
            label="Name"
            name="name"
            required
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="Contestant name" style={{ flex: 1 }} />
              <Button icon={<RedoOutlined />} onClick={handleRandomName} type="default">
                Random
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item label="Track" name="track" required>
            <Select
              options={[
                { value: TRACKS.VOCAL, label: 'Vocal' },
                { value: TRACKS.RAP, label: 'Rap' },
                { value: TRACKS.DANCE, label: 'Dance' },
              ]}
            />
          </Form.Item>

          <div>
            <Typography.Text strong style={{ fontSize: '0.875rem' }}>
              Track Distribution
            </Typography.Text>
            <div style={{ marginTop: '0.5rem' }}>
              {[TRACKS.VOCAL, TRACKS.RAP, TRACKS.DANCE].map((track) => {
                const count = existingContestants.filter((c) => c.track === track).length;
                const total = existingContestants.length || 1;
                const percentage = Math.round((count / total) * 100);
                const isCurrentTrack = contestant.track === track;
                return (
                  <div key={track} style={{ marginBottom: '0.5rem' }}>
                    <Flex justify="space-between" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: isCurrentTrack ? 'bold' : 'normal' }}>{track}</span>
                      <span style={{ fontWeight: isCurrentTrack ? 'bold' : 'normal' }}>
                        {count} ({percentage}%)
                      </span>
                    </Flex>
                    <Progress
                      percent={percentage}
                      showInfo={false}
                      size="small"
                      strokeColor={isCurrentTrack ? '#1890ff' : undefined}
                      style={{ backgroundColor: isCurrentTrack ? '#e6f4ff' : undefined }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-3">
          <Form.Item label="Persona (Optional)" name="persona">
            <Input placeholder="e.g., 'The Underdog', 'The Ice Queen'" />
          </Form.Item>

          <Form.Item label="Zodiac Sign" name="zodiacSign" required>
            <Select options={getZodiacSignOptions()} />
          </Form.Item>

          <Form.Item label="Brand Color" name="color" required>
            <Flex gap="middle" vertical>
              <div
                style={{
                  width: '100%',
                  height: '80px',
                  backgroundColor: colorValue,
                  border: '2px solid #d9d9d9',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography.Text
                  strong
                  style={{
                    color: colorValue.toLowerCase() === '#ffffff' ? '#000' : '#fff',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  {colorValue.toUpperCase()}
                </Typography.Text>
              </div>
              <ColorPicker
                disabledAlpha
                format="hex"
                onChange={(color) => {
                  const hexColor = color.toHexString();
                  setColorValue(hexColor);
                  form.setFieldValue('color', hexColor);
                  updateContestant({ color: hexColor });
                }}
                showText={(color) => <span>{color.toHexString()}</span>}
                style={{ width: '100%' }}
                value={colorValue}
              />
            </Flex>
          </Form.Item>
        </div>

        <Form.Item name="bias" valuePropName="checked">
          <Checkbox>
            <span style={{ fontWeight: 500 }}>Bias Contestant</span>
            <Typography.Text style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }} type="secondary">
              (Force-include in simulations when "Use Bias" is enabled)
            </Typography.Text>
          </Checkbox>
        </Form.Item>

        <Form.Item>
          <ContestantBuilderStepperControls
            addParams={addParams}
            allContestantIds={allContestantIds}
            currentContestantId={contestant.id}
            currentStep={currentStep}
            hidePreviousButton
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
