import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Tooltip, Typography } from 'antd';
import type { PropertyChange } from '../types/common';

export function ChangeDirection({ change }: { change: number }) {
  if (change === 0) return null;
  return change > 0 ? (
    <ArrowUpOutlined aria-label="Increased" style={{ color: '#52c41a' }} />
  ) : (
    <ArrowDownOutlined aria-label="Decreased" style={{ color: '#ff4d4f' }} />
  );
}

export function ValueChange({ before, after }: { before: number; after: number }) {
  const change = after - before;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <ChangeDirection change={change} />
      <Typography.Text type={change > 0 ? 'success' : change < 0 ? 'danger' : undefined}>
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
  return (
    <Tooltip
      title={
        change.before === undefined
          ? 'Previously not set'
          : `Previous value: ${JSON.stringify(change.before)}`
      }
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {comparable && <ChangeDirection change={after - before} />}
        <Typography.Text code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {comparable ? String(after) : change.after === undefined ? 'Not set' : JSON.stringify(change.after)}
        </Typography.Text>
      </span>
    </Tooltip>
  );
}
