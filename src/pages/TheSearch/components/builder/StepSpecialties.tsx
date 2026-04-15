import { RedoOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Form, Select, Typography } from 'antd';
import { useQueryParams } from 'hooks/useQueryParams';
import { useEffect, useState } from 'react';
import type { Contestant, Specialties } from '../../types/contestant';
import {
  generateRandomSpecialty,
  getSpecialtyById,
  getSpecialtyOptions,
  type SpecialtyType,
} from '../../utilities/helpers';
import { ContestantBuilderStepperControls } from './ContestantBuilderStepper';
import { ContestantHeader } from './ContestantHeader';

type StepSpecialtiesProps = {
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

/**
 * Gets usage statistics for a specialty type
 */
function getSpecialtyUsageStats(
  contestants: Contestant[],
  field: keyof Specialties,
): Array<{ id: string; name: string; count: number; percentage: number }> {
  if (contestants.length === 0) return [];

  const usageMap = new Map<string, number>();

  for (const contestant of contestants) {
    const specialtyId = contestant.specialties?.[field];
    if (specialtyId) {
      usageMap.set(specialtyId, (usageMap.get(specialtyId) || 0) + 1);
    }
  }

  const total = contestants.length;
  return Array.from(usageMap.entries())
    .map(([id, count]) => ({
      id,
      name: id,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/**
 * Counts contestants with non-empty value for a specialty field
 */
function countContestantsWithSpecialty(contestants: Contestant[], field: keyof Specialties): number {
  return contestants.filter((c) => c.specialties?.[field]).length;
}

/**
 * Generate DNA/hash from specialties
 * Format: vc-SWEET_ds-SMOOTH_rs-SWAG_vv-CUTE_ls-COMMANDER
 */
function generateSpecialtiesHash(specialties?: Specialties): string {
  if (!specialties) return '';

  const vc = specialties.vocalColor || 'NONE';
  const ds = specialties.danceStyle || 'NONE';
  const rs = specialties.rapStyle || 'NONE';
  const vv = specialties.visualVibe || 'NONE';
  const ls = specialties.leadershipStyle || 'NONE';

  return `vc-${vc}_ds-${ds}_rs-${rs}_vv-${vv}_ls-${ls}`;
}

/**
 * All specialty keys in order
 */
const ALL_SPECIALTY_KEYS: Array<keyof Specialties> = [
  'vocalColor',
  'danceStyle',
  'rapStyle',
  'visualVibe',
  'leadershipStyle',
];

export function StepSpecialties({
  contestant,
  updateContestant,
  setStep,
  existingContestants,
  isEditMode = false,
  allContestantIds = [],
  currentStep = 4,
  addParams,
  onApplyChanges,
}: StepSpecialtiesProps) {
  const { queryParams, addParams: addParamsFromHook } = useQueryParams();
  const addParamsFunc = addParams || addParamsFromHook;

  const [form] = Form.useForm();
  const [selectedSpecialties, setSelectedSpecialties] = useState<Partial<Specialties>>(
    contestant.specialties || {},
  );

  const [visibleSpecialties, setVisibleSpecialties] = useState<Array<keyof Specialties>>(() => {
    const param = queryParams.get('visibleSpecialties');
    if (param) {
      const parsed = param.split(',') as Array<keyof Specialties>;
      return parsed.filter((key) => ALL_SPECIALTY_KEYS.includes(key));
    }
    return [];
  });

  const handleVisibleSpecialtiesChange = (values: Array<keyof Specialties>) => {
    setVisibleSpecialties(values);
    if (addParamsFunc) {
      addParamsFunc({ visibleSpecialties: values.join(',') });
    }
  };

  // Sync state with query params when they change
  useEffect(() => {
    const param = queryParams.get('visibleSpecialties');
    if (param) {
      const parsed = param.split(',') as Array<keyof Specialties>;
      const filtered = parsed.filter((key) => ALL_SPECIALTY_KEYS.includes(key));
      setVisibleSpecialties(filtered);
    } else {
      setVisibleSpecialties([]);
    }
  }, [queryParams]);

  const handleRandomSelection = (type: SpecialtyType, field: keyof Specialties) => {
    const randomId = generateRandomSpecialty(type, existingContestants, true);
    const updated = { ...selectedSpecialties, [field]: randomId };
    setSelectedSpecialties(updated);
    form.setFieldsValue({ [field]: randomId });
    updateContestant({ specialties: updated as Specialties });
  };

  const handleRandomizeAll = () => {
    const vocalColor = generateRandomSpecialty('vocalColor', existingContestants, true);
    const danceStyle = generateRandomSpecialty('danceStyle', existingContestants, true);
    const rapStyle = generateRandomSpecialty('rapStyle', existingContestants, true);
    const visualVibe = generateRandomSpecialty('visualVibe', existingContestants, true);
    const leadershipStyle = generateRandomSpecialty('leadershipStyle', existingContestants, true);

    const updated: Specialties = {
      vocalColor,
      danceStyle,
      rapStyle,
      visualVibe,
      leadershipStyle,
    };

    setSelectedSpecialties(updated);
    form.setFieldsValue(updated);
    updateContestant({ specialties: updated });
  };

  const onValuesChange = (_changedValues: Partial<Specialties>, allValues: Specialties) => {
    setSelectedSpecialties(allValues);
    updateContestant({ specialties: allValues });
  };

  const onFinish = (values: Specialties) => {
    updateContestant({ specialties: values });
    setStep((prev) => prev + 1);
  };

  const handleSubmitForm = async (): Promise<boolean> => {
    try {
      const values = await form.validateFields();
      updateContestant({ specialties: values });
      return true;
    } catch (_error) {
      return false;
    }
  };

  const renderSpecialtyField = (field: keyof Specialties, label: string, type: SpecialtyType) => {
    const selected = selectedSpecialties[field];
    const specialty = selected ? getSpecialtyById(type, selected) : null;

    return (
      <Card key={field} size="small" style={{ marginBottom: '1rem' }}>
        <Typography.Text strong>{label}</Typography.Text>
        <Flex gap={8} style={{ marginTop: '0.5rem' }} vertical>
          <Flex gap={8}>
            <Form.Item name={field} style={{ flex: 1, marginBottom: 0 }}>
              <Select
                allowClear
                options={getSpecialtyOptions(type)}
                placeholder={`Select ${label.toLowerCase()}`}
              />
            </Form.Item>
            <Button icon={<RedoOutlined />} onClick={() => handleRandomSelection(type, field)} type="default">
              Random
            </Button>
          </Flex>
          {specialty && (
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              <div>
                <strong>{specialty.name}</strong> (Popularity: {specialty.popularity})
              </div>
              <div style={{ marginTop: '0.25rem' }}>{specialty.description}</div>
              {Object.keys(specialty.influences).length > 0 && (
                <div style={{ marginTop: '0.25rem', fontStyle: 'italic' }}>
                  Influences: {JSON.stringify(specialty.influences)}
                </div>
              )}
            </div>
          )}
        </Flex>
      </Card>
    );
  };

  // Generate DNA hash and check for duplicates
  const currentHash = generateSpecialtiesHash(contestant.specialties);
  const duplicateContestants = existingContestants.filter((c) => {
    // Don't compare with the same contestant when editing
    if (contestant.id && c.id === contestant.id) return false;
    return generateSpecialtiesHash(c.specialties) === currentHash;
  });

  return (
    <>
      <Typography.Title level={3}>Specialties</Typography.Title>
      <Typography.Paragraph>
        Select the contestant's specialties or use the "Random" button to get weighted random selections based
        on occurrence rates.
      </Typography.Paragraph>

      <ContestantHeader
        color={contestant.color}
        id={contestant.id}
        name={contestant.name}
        track={contestant.track}
      />

      {duplicateContestants.length > 0 && (
        <Alert
          description={
            <>
              <div style={{ marginBottom: '0.5rem' }}>
                DNA Hash: <strong>{currentHash}</strong>
              </div>
              <div>
                The following contestant(s) have identical specialties:{' '}
                <strong>{duplicateContestants.map((c) => c.name).join(', ')}</strong>
              </div>
            </>
          }
          showIcon
          style={{ marginBottom: '1rem' }}
          title="Duplicate Specialties Detected"
          type="warning"
        />
      )}

      <Flex gap={16}>
        {/* Left Column: Form */}
        <div style={{ flex: 1 }}>
          <Flex align="center" gap={16} style={{ marginBottom: '1rem' }}>
            <Button icon={<RedoOutlined />} onClick={handleRandomizeAll} type="default">
              Randomize All Specialties
            </Button>
            <Select
              mode="multiple"
              onChange={handleVisibleSpecialtiesChange}
              options={[
                { value: 'vocalColor', label: 'Vocal Color' },
                { value: 'danceStyle', label: 'Dance Style' },
                { value: 'rapStyle', label: 'Rap Style' },
                { value: 'visualVibe', label: 'Visual Vibe' },
                { value: 'leadershipStyle', label: 'Leadership Style' },
              ]}
              placeholder="Select specialties to display"
              size="small"
              style={{ width: 300 }}
              value={visibleSpecialties}
            />
          </Flex>

          <Form
            autoComplete="off"
            form={form}
            initialValues={
              contestant.specialties || {
                vocalColor: '',
                danceStyle: '',
                rapStyle: '',
                visualVibe: '',
                leadershipStyle: '',
              }
            }
            layout="vertical"
            onFinish={onFinish}
            onValuesChange={onValuesChange}
          >
            {(visibleSpecialties.length === 0 || visibleSpecialties.includes('vocalColor')) &&
              renderSpecialtyField('vocalColor', 'Vocal Color', 'vocalColor')}
            {(visibleSpecialties.length === 0 || visibleSpecialties.includes('danceStyle')) &&
              renderSpecialtyField('danceStyle', 'Dance Style', 'danceStyle')}
            {(visibleSpecialties.length === 0 || visibleSpecialties.includes('rapStyle')) &&
              renderSpecialtyField('rapStyle', 'Rap Style', 'rapStyle')}
            {(visibleSpecialties.length === 0 || visibleSpecialties.includes('visualVibe')) &&
              renderSpecialtyField('visualVibe', 'Visual Vibe', 'visualVibe')}
            {(visibleSpecialties.length === 0 || visibleSpecialties.includes('leadershipStyle')) &&
              renderSpecialtyField('leadershipStyle', 'Leadership Style', 'leadershipStyle')}

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
        </div>

        {/* Right Column: Statistics */}
        <div style={{ width: 350 }}>
          <Card size="small" title="Specialty Usage Statistics">
            {/* Vocal Color Stats */}
            <div style={{ marginBottom: '1rem' }}>
              <Typography.Text strong style={{ fontSize: '0.875rem' }}>
                Vocal Color ({countContestantsWithSpecialty(existingContestants, 'vocalColor')})
              </Typography.Text>
              <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                {getSpecialtyUsageStats(existingContestants, 'vocalColor').length > 0 ? (
                  getSpecialtyUsageStats(existingContestants, 'vocalColor').map((stat) => {
                    const specialty = getSpecialtyById('vocalColor', stat.id);
                    const isCurrent = contestant.specialties?.vocalColor === stat.id;
                    const occurrence = specialty?.occurrence || 0;
                    let occurrenceColor = 'inherit';
                    if (stat.percentage < occurrence - 5) {
                      occurrenceColor = '#faad14'; // yellow - under by 5%+
                    } else if (stat.percentage > occurrence + 5) {
                      occurrenceColor = '#ff4d4f'; // red - over by 5%+
                    }
                    return (
                      <div
                        key={stat.id}
                        style={{
                          fontWeight: isCurrent ? 'bold' : 'normal',
                          color: isCurrent ? '#1890ff' : '#666',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {specialty?.name || stat.id}: {stat.count} ({stat.percentage}%){' '}
                        <span style={{ color: occurrenceColor }}>[🎯: {occurrence}%]</span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#999' }}>No data yet</div>
                )}
              </div>
            </div>

            {/* Dance Style Stats */}
            <div style={{ marginBottom: '1rem' }}>
              <Typography.Text strong style={{ fontSize: '0.875rem' }}>
                Dance Style ({countContestantsWithSpecialty(existingContestants, 'danceStyle')})
              </Typography.Text>
              <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                {getSpecialtyUsageStats(existingContestants, 'danceStyle').length > 0 ? (
                  getSpecialtyUsageStats(existingContestants, 'danceStyle').map((stat) => {
                    const specialty = getSpecialtyById('danceStyle', stat.id);
                    const isCurrent = contestant.specialties?.danceStyle === stat.id;
                    const occurrence = specialty?.occurrence || 0;
                    let occurrenceColor = 'inherit';
                    if (stat.percentage < occurrence - 5) {
                      occurrenceColor = '#faad14'; // yellow - under by 5%+
                    } else if (stat.percentage > occurrence + 5) {
                      occurrenceColor = '#ff4d4f'; // red - over by 5%+
                    }
                    return (
                      <div
                        key={stat.id}
                        style={{
                          fontWeight: isCurrent ? 'bold' : 'normal',
                          color: isCurrent ? '#1890ff' : '#666',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {specialty?.name || stat.id}: {stat.count} ({stat.percentage}%){' '}
                        <span style={{ color: occurrenceColor }}>[🎯: {occurrence}%]</span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#999' }}>No data yet</div>
                )}
              </div>
            </div>

            {/* Rap Style Stats */}
            <div style={{ marginBottom: '1rem' }}>
              <Typography.Text strong style={{ fontSize: '0.875rem' }}>
                Rap Style ({countContestantsWithSpecialty(existingContestants, 'rapStyle')})
              </Typography.Text>
              <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                {getSpecialtyUsageStats(existingContestants, 'rapStyle').length > 0 ? (
                  getSpecialtyUsageStats(existingContestants, 'rapStyle').map((stat) => {
                    const specialty = getSpecialtyById('rapStyle', stat.id);
                    const isCurrent = contestant.specialties?.rapStyle === stat.id;
                    const occurrence = specialty?.occurrence || 0;
                    let occurrenceColor = 'inherit';
                    if (stat.percentage < occurrence - 5) {
                      occurrenceColor = '#faad14'; // yellow - under by 5%+
                    } else if (stat.percentage > occurrence + 5) {
                      occurrenceColor = '#ff4d4f'; // red - over by 5%+
                    }
                    return (
                      <div
                        key={stat.id}
                        style={{
                          fontWeight: isCurrent ? 'bold' : 'normal',
                          color: isCurrent ? '#1890ff' : '#666',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {specialty?.name || stat.id}: {stat.count} ({stat.percentage}%){' '}
                        <span style={{ color: occurrenceColor }}>[🎯: {occurrence}%]</span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#999' }}>No data yet</div>
                )}
              </div>
            </div>

            {/* Visual Vibe Stats */}
            <div style={{ marginBottom: '1rem' }}>
              <Typography.Text strong style={{ fontSize: '0.875rem' }}>
                Visual Vibe ({countContestantsWithSpecialty(existingContestants, 'visualVibe')})
              </Typography.Text>
              <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                {getSpecialtyUsageStats(existingContestants, 'visualVibe').length > 0 ? (
                  getSpecialtyUsageStats(existingContestants, 'visualVibe').map((stat) => {
                    const specialty = getSpecialtyById('visualVibe', stat.id);
                    const isCurrent = contestant.specialties?.visualVibe === stat.id;
                    const occurrence = specialty?.occurrence || 0;
                    let occurrenceColor = 'inherit';
                    if (stat.percentage < occurrence - 5) {
                      occurrenceColor = '#faad14'; // yellow - under by 5%+
                    } else if (stat.percentage > occurrence + 5) {
                      occurrenceColor = '#ff4d4f'; // red - over by 5%+
                    }
                    return (
                      <div
                        key={stat.id}
                        style={{
                          fontWeight: isCurrent ? 'bold' : 'normal',
                          color: isCurrent ? '#1890ff' : '#666',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {specialty?.name || stat.id}: {stat.count} ({stat.percentage}%){' '}
                        <span style={{ color: occurrenceColor }}>[🎯: {occurrence}%]</span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#999' }}>No data yet</div>
                )}
              </div>
            </div>

            {/* Leadership Style Stats */}
            <div style={{ marginBottom: '1rem' }}>
              <Typography.Text strong style={{ fontSize: '0.875rem' }}>
                Leadership Style ({countContestantsWithSpecialty(existingContestants, 'leadershipStyle')})
              </Typography.Text>
              <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                {getSpecialtyUsageStats(existingContestants, 'leadershipStyle').length > 0 ? (
                  getSpecialtyUsageStats(existingContestants, 'leadershipStyle').map((stat) => {
                    const specialty = getSpecialtyById('leadershipStyle', stat.id);
                    const isCurrent = contestant.specialties?.leadershipStyle === stat.id;
                    const occurrence = specialty?.occurrence || 0;
                    let occurrenceColor = 'inherit';
                    if (stat.percentage < occurrence - 5) {
                      occurrenceColor = '#faad14'; // yellow - under by 5%+
                    } else if (stat.percentage > occurrence + 5) {
                      occurrenceColor = '#ff4d4f'; // red - over by 5%+
                    }
                    return (
                      <div
                        key={stat.id}
                        style={{
                          fontWeight: isCurrent ? 'bold' : 'normal',
                          color: isCurrent ? '#1890ff' : '#666',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {specialty?.name || stat.id}: {stat.count} ({stat.percentage}%){' '}
                        <span style={{ color: occurrenceColor }}>[🎯: {occurrence}%]</span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#999' }}>No data yet</div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </Flex>
    </>
  );
}
