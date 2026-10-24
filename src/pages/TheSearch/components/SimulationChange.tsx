import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Tooltip, Typography } from 'antd';
import type { PropertyChange } from '../types/common';

type ChangeMetric = 'happiness';

function changeColor(change: number, metric?: ChangeMetric): string | undefined {
  if (change === 0) return undefined;
  if (metric === 'happiness') return change > 0 ? '#1677ff' : '#fa8c16';
  return change > 0 ? '#52c41a' : '#ff4d4f';
}

export function ChangeDirection({ change, metric }: { change: number; metric?: ChangeMetric }) {
  if (change === 0) return null;
  return change > 0 ? (
    <ArrowUpOutlined aria-label="Increased" style={{ color: changeColor(change, metric) }} />
  ) : (
    <ArrowDownOutlined aria-label="Decreased" style={{ color: changeColor(change, metric) }} />
  );
}

export function ValueChange({
  before,
  after,
  metric,
}: {
  before: number;
  after: number;
  metric?: ChangeMetric;
}) {
  const change = after - before;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <ChangeDirection change={change} metric={metric} />
      <Typography.Text
        style={metric ? { color: changeColor(change, metric) } : undefined}
        type={metric ? undefined : change > 0 ? 'success' : change < 0 ? 'danger' : undefined}
      >
        {after}
      </Typography.Text>
    </span>
  );
}

export function PropertyChangeValue({ change }: { change: PropertyChange }) {
  const before =
    Array.isArray(change.before) && change.path.startsWith('relationships.')
      ? change.before.at(-1)
      : change.before;
  const after =
    Array.isArray(change.after) && change.path.startsWith('relationships.')
      ? change.after.at(-1)
      : change.after;
  const comparable = typeof before === 'number' && typeof after === 'number';
  const metric = change.path === 'aggregations.happiness' ? 'happiness' : undefined;
  return (
    <Tooltip
      title={
        change.before === undefined
          ? 'Previously not set'
          : `Previous value: ${JSON.stringify(change.before)}`
      }
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {comparable && <ChangeDirection change={after - before} metric={metric} />}
        <Typography.Text
          code
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: comparable && metric ? changeColor(after - before, metric) : undefined,
          }}
        >
          {comparable ? String(after) : change.after === undefined ? 'Not set' : JSON.stringify(change.after)}
        </Typography.Text>
      </span>
    </Tooltip>
  );
}
