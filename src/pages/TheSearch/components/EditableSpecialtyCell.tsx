import { EditOutlined, RedoOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Popover, Radio, Typography } from 'antd';
import { useState } from 'react';
import type { Contestant } from '../types/contestant';
import {
  generateRandomSpecialty,
  getSpecialtyById,
  getSpecialtyUsageStats,
  type SpecialtyType,
} from '../utilities/helpers';

type EditableSpecialtyCellProps = {
  value: string;
  type: SpecialtyType;
  label: string;
  contestantName: string;
  contestants: Contestant[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function EditableSpecialtyCell({
  value,
  type,
  label,
  contestantName,
  contestants,
  onChange,
  disabled = false,
}: EditableSpecialtyCellProps) {
  const [open, setOpen] = useState(false);
  const specialty = value ? getSpecialtyById(type, value) : undefined;
  const usage = open ? getSpecialtyUsageStats(contestants, type, true) : [];

  const applyChange = (nextValue: string) => {
    if (nextValue !== value) onChange(nextValue);
    setOpen(false);
  };

  return (
    <Popover
      content={
        <Flex gap="small" style={{ width: 360, maxWidth: 'calc(100vw - 48px)' }} vertical>
          {value && !specialty && (
            <Alert
              showIcon
              title="This saved specialty is no longer in the library. Choose a replacement."
              type="warning"
            />
          )}
          <Flex gap="small">
            <Button
              disabled={disabled}
              icon={<RedoOutlined />}
              onClick={() => applyChange(generateRandomSpecialty(type, contestants, true))}
            >
              Random
            </Button>
            <Button disabled={disabled || !value} onClick={() => applyChange('')}>
              Clear
            </Button>
          </Flex>
          {specialty && <Typography.Text type="secondary">{specialty.description}</Typography.Text>}
          <Typography.Text strong>Specialty Usage Statistics</Typography.Text>
          <Typography.Text type="secondary">
            Across all {contestants.length} contestants, including those outside the current table filters.
          </Typography.Text>
          <Radio.Group
            aria-label={label}
            disabled={disabled}
            role="radiogroup"
            style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '40vh', overflowY: 'auto' }}
            value={value}
          >
            {usage.map((stat) => {
              const entry = getSpecialtyById(type, stat.id);
              const occurrence = entry?.occurrence ?? 0;
              const color =
                stat.percentage < occurrence - 5
                  ? '#faad14'
                  : stat.percentage > occurrence + 5
                    ? '#ff4d4f'
                    : 'inherit';
              return (
                <Radio
                  autoFocus={stat.id === value}
                  disabled={disabled || !entry}
                  key={stat.id}
                  onChange={() => applyChange(stat.id)}
                  style={{ display: 'flex', marginInlineEnd: 0 }}
                  styles={{ label: { flex: 1, minWidth: 0 } }}
                  value={stat.id}
                >
                  <Flex gap="small" justify="space-between">
                    <Typography.Text strong={stat.id === value}>{stat.name}</Typography.Text>
                    <Typography.Text style={{ textAlign: 'right' }}>
                      {stat.count} ({stat.percentage}%){' '}
                      <span style={{ color }}>
                        {entry
                          ? `| ${color === '#ff4d4f' ? '🛑' : '🎯'}: ${Math.round(occurrence)}%`
                          : '| Not in library'}
                      </span>
                    </Typography.Text>
                  </Flex>
                </Radio>
              );
            })}
          </Radio.Group>
        </Flex>
      }
      destroyOnHidden
      onOpenChange={setOpen}
      open={open}
      placement="bottomLeft"
      title={`${label} - ${contestantName}`}
      trigger="click"
    >
      <Button
        aria-label={`Edit ${label} for ${contestantName}`}
        disabled={disabled}
        icon={<EditOutlined />}
        size="small"
        style={{
          height: 'auto',
          whiteSpace: 'normal',
          textAlign: 'left',
          color: value ? undefined : '#fa8c16',
        }}
        type="text"
      >
        {specialty?.name || value || 'Not selected'}
      </Button>
    </Popover>
  );
}
