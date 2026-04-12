import { AutoComplete, Button, Card, Flex, Form, InputNumber, Typography } from 'antd';
import type { Contestant } from '../../types/contestant';
import { ContestantHeader } from './ContestantHeader';

type StepAppearanceProps = {
  contestant: Partial<Contestant>;
  updateContestant: (data: Partial<Contestant>) => void;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  existingContestants: Contestant[];
  isEditMode?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
};

/**
 * Extracts unique values for a specific appearance field from existing contestants
 */
function getUniqueValues(contestants: Contestant[], field: keyof Contestant['appearance']): string[] {
  const values = contestants
    .map((c) => c.appearance?.[field])
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  return Array.from(new Set(values)).sort();
}

/**
 * Gets the distribution of values for an appearance field
 */
function getFieldDistribution(
  contestants: Contestant[],
  field: keyof Contestant['appearance'],
): Array<{ value: string; count: number; percentage: number }> {
  const valueMap = new Map<string, number>();

  for (const contestant of contestants) {
    const value = contestant.appearance?.[field];
    if (typeof value === 'string' && value.trim() !== '') {
      valueMap.set(value, (valueMap.get(value) || 0) + 1);
    }
  }

  const total = contestants.length || 1;
  return Array.from(valueMap.entries())
    .map(([value, count]) => ({
      value,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Gets the distribution of ages from existing contestants
 */
function getAgeDistribution(
  contestants: Contestant[],
): Array<{ age: number; count: number; percentage: number }> {
  if (contestants.length === 0) return [];

  const ageMap = new Map<number, number>();

  for (const contestant of contestants) {
    const age = contestant.appearance?.age;
    if (age) {
      ageMap.set(age, (ageMap.get(age) || 0) + 1);
    }
  }

  const total = contestants.length;
  return Array.from(ageMap.entries())
    .map(([age, count]) => ({
      age,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => a.age - b.age);
}

export function StepAppearance({
  contestant,
  updateContestant,
  setStep,
  existingContestants,
  isEditMode = false,
  isDirty = false,
  isSaving = false,
  onSave,
}: StepAppearanceProps) {
  const [form] = Form.useForm();

  // Get unique values for autocomplete
  const heightOptions = getUniqueValues(existingContestants, 'height').map((v) => ({ value: v }));
  const buildOptions = getUniqueValues(existingContestants, 'build').map((v) => ({ value: v }));
  const hairStyleOptions = getUniqueValues(existingContestants, 'hairStyle').map((v) => ({ value: v }));
  const hairColorOptions = getUniqueValues(existingContestants, 'hairColor').map((v) => ({ value: v }));
  const furColorOptions = getUniqueValues(existingContestants, 'furColor').map((v) => ({ value: v }));
  const otherOptions = getUniqueValues(existingContestants, 'other').map((v) => ({ value: v }));

  const onValuesChange = (changedValues: Record<string, unknown>) => {
    updateContestant({
      appearance: { ...contestant.appearance, ...changedValues } as Contestant['appearance'],
    });
  };

  const onFinish = (values: Record<string, unknown>) => {
    updateContestant({ appearance: { ...contestant.appearance, ...values } as Contestant['appearance'] });
    setStep((prev) => prev + 1);
  };

  return (
    <>
      <Typography.Title level={3}>Appearance</Typography.Title>
      <Typography.Paragraph>
        Describe the contestant's physical appearance. These details will help characterize them in the
        simulation.
      </Typography.Paragraph>

      <ContestantHeader
        color={contestant.color}
        id={contestant.id}
        name={contestant.name}
        track={contestant.track}
      />

      <Flex gap={16}>
        {/* Left Column: Form Fields */}
        <div style={{ flex: 1 }}>
          <Form
            autoComplete="off"
            form={form}
            initialValues={{
              age: contestant.appearance?.age || 18,
              height: contestant.appearance?.height || '',
              build: contestant.appearance?.build || '',
              hairStyle: contestant.appearance?.hairStyle || '',
              hairColor: contestant.appearance?.hairColor || '',
              furColor: contestant.appearance?.furColor || '',
              other: contestant.appearance?.other || '',
            }}
            layout="vertical"
            onFinish={onFinish}
            onValuesChange={onValuesChange}
          >
            <Form.Item label="Age" name="age" required rules={[{ required: true }]}>
              <InputNumber max={30} min={16} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="Height" name="height">
              <AutoComplete options={heightOptions} placeholder="e.g., 175cm, 5'9''" />
            </Form.Item>

            <Form.Item label="Build" name="build">
              <AutoComplete options={buildOptions} placeholder="e.g., Athletic, Slim, Muscular" />
            </Form.Item>

            <Form.Item label="Hair Style" name="hairStyle">
              <AutoComplete options={hairStyleOptions} placeholder="e.g., Short, Long, Wavy" />
            </Form.Item>

            <Form.Item label="Hair Color" name="hairColor">
              <AutoComplete options={hairColorOptions} placeholder="e.g., Black, Brown, Dyed Blonde" />
            </Form.Item>

            <Form.Item label="Fur Color" name="furColor">
              <AutoComplete options={furColorOptions} placeholder="e.g., Gray, Brown, White" />
            </Form.Item>

            <Form.Item label="Other Notable Features" name="other">
              <AutoComplete
                options={otherOptions}
                placeholder="e.g., Tattoos, piercings, scars, distinctive marks"
              />
            </Form.Item>

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
        </div>

        {/* Right Column: Statistics */}
        <div style={{ width: 350 }}>
          <Card size="small" title="Appearance Statistics">
            {/* Age Distribution */}
            <div style={{ marginBottom: '1rem' }}>
              <Typography.Text strong style={{ fontSize: '0.875rem' }}>
                Age Distribution
              </Typography.Text>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {getAgeDistribution(existingContestants).length > 0 ? (
                  getAgeDistribution(existingContestants).map((item) => (
                    <div
                      key={item.age}
                      style={{
                        fontWeight: contestant.appearance?.age === item.age ? 'bold' : 'normal',
                        color: contestant.appearance?.age === item.age ? '#1890ff' : undefined,
                      }}
                    >
                      {item.age} years ({item.count}, {item.percentage}%)
                    </div>
                  ))
                ) : (
                  <div>No data yet</div>
                )}
              </div>
            </div>

            {/* Height Distribution */}
            <div style={{ marginBottom: '1rem' }}>
              <Typography.Text strong style={{ fontSize: '0.875rem' }}>
                Common Heights
              </Typography.Text>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {getFieldDistribution(existingContestants, 'height').length > 0 ? (
                  getFieldDistribution(existingContestants, 'height').map((item) => (
                    <div
                      key={item.value}
                      style={{
                        fontWeight: contestant.appearance?.height === item.value ? 'bold' : 'normal',
                        color: contestant.appearance?.height === item.value ? '#1890ff' : undefined,
                      }}
                    >
                      {item.value} ({item.count}, {item.percentage}%)
                    </div>
                  ))
                ) : (
                  <div>No data yet</div>
                )}
              </div>
            </div>

            {/* Build Distribution */}
            <div style={{ marginBottom: '1rem' }}>
              <Typography.Text strong style={{ fontSize: '0.875rem' }}>
                Common Builds
              </Typography.Text>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {getFieldDistribution(existingContestants, 'build').length > 0 ? (
                  getFieldDistribution(existingContestants, 'build').map((item) => (
                    <div
                      key={item.value}
                      style={{
                        fontWeight: contestant.appearance?.build === item.value ? 'bold' : 'normal',
                        color: contestant.appearance?.build === item.value ? '#1890ff' : undefined,
                      }}
                    >
                      {item.value} ({item.count}, {item.percentage}%)
                    </div>
                  ))
                ) : (
                  <div>No data yet</div>
                )}
              </div>
            </div>

            {/* Hair Style Distribution */}
            <div style={{ marginBottom: '1rem' }}>
              <Typography.Text strong style={{ fontSize: '0.875rem' }}>
                Common Hair Styles
              </Typography.Text>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {getFieldDistribution(existingContestants, 'hairStyle').length > 0 ? (
                  getFieldDistribution(existingContestants, 'hairStyle').map((item) => (
                    <div
                      key={item.value}
                      style={{
                        fontWeight: contestant.appearance?.hairStyle === item.value ? 'bold' : 'normal',
                        color: contestant.appearance?.hairStyle === item.value ? '#1890ff' : undefined,
                      }}
                    >
                      {item.value} ({item.count}, {item.percentage}%)
                    </div>
                  ))
                ) : (
                  <div>No data yet</div>
                )}
              </div>
            </div>

            {/* Hair Color Distribution */}
            <div style={{ marginBottom: '1rem' }}>
              <Typography.Text strong style={{ fontSize: '0.875rem' }}>
                Common Hair Colors
              </Typography.Text>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {getFieldDistribution(existingContestants, 'hairColor').length > 0 ? (
                  getFieldDistribution(existingContestants, 'hairColor').map((item) => (
                    <div
                      key={item.value}
                      style={{
                        fontWeight: contestant.appearance?.hairColor === item.value ? 'bold' : 'normal',
                        color: contestant.appearance?.hairColor === item.value ? '#1890ff' : undefined,
                      }}
                    >
                      {item.value} ({item.count}, {item.percentage}%)
                    </div>
                  ))
                ) : (
                  <div>No data yet</div>
                )}
              </div>
            </div>

            {/* Fur Color Distribution */}
            <div style={{ marginBottom: '1rem' }}>
              <Typography.Text strong style={{ fontSize: '0.875rem' }}>
                Common Fur Colors
              </Typography.Text>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {getFieldDistribution(existingContestants, 'furColor').length > 0 ? (
                  getFieldDistribution(existingContestants, 'furColor').map((item) => (
                    <div
                      key={item.value}
                      style={{
                        fontWeight: contestant.appearance?.furColor === item.value ? 'bold' : 'normal',
                        color: contestant.appearance?.furColor === item.value ? '#1890ff' : undefined,
                      }}
                    >
                      {item.value} ({item.count}, {item.percentage}%)
                    </div>
                  ))
                ) : (
                  <div>No data yet</div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </Flex>
    </>
  );
}
