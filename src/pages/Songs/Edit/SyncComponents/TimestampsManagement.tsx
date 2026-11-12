import { ASSIGNEES } from '@utils/constants';
import { Button, Flex, Popconfirm, Typography } from 'antd';
import clsx from 'clsx';
import { ClockIcon, EraserIcon, PlugIcon, TrashIcon } from 'lucide-react';

import type { RecordingTimestamp } from './KeyCapture';

type TimestampsManagementProps = {
  unassignedTimestamps: RecordingTimestamp[];
  activeTimestamp: RecordingTimestamp | null;
  setActiveTimestamp: React.Dispatch<React.SetStateAction<RecordingTimestamp | null>>;
  setUnassignedTimestamps: React.Dispatch<React.SetStateAction<RecordingTimestamp[]>>;
};

export function TimestampsManagement({
  unassignedTimestamps,
  activeTimestamp,
  setActiveTimestamp,
  setUnassignedTimestamps,
}: TimestampsManagementProps) {
  const onActivateTimestamp = (timestamp: RecordingTimestamp) => {
    setActiveTimestamp((prev) => {
      if (prev && prev.id === timestamp.id) {
        return null;
      }
      return timestamp;
    });
  };

  const onDeleteTimestamp = () => {
    if (activeTimestamp) {
      const id = activeTimestamp.id;
      setActiveTimestamp(null);
      setUnassignedTimestamps(unassignedTimestamps.filter((t) => t.id !== id));
    }
  };

  const onDeleteAllTimestamps = () => {
    setActiveTimestamp(null);
    setUnassignedTimestamps([]);
  };

  return (
    <div className="my-2">
      <div className="header mb-2">
        <Typography.Text strong>Unassigned Timestamps ({unassignedTimestamps.length})</Typography.Text>
        <Flex gap={6}>
          <Button disabled={!activeTimestamp} onClick={onDeleteTimestamp} size="small">
            <TrashIcon />
          </Button>
          <Popconfirm
            onConfirm={onDeleteAllTimestamps}
            title="Are you sure you want to delete all unassigned timestamps?"
          >
            <Button danger disabled={unassignedTimestamps.length === 0} size="small" type="primary">
              <EraserIcon />
            </Button>
          </Popconfirm>
        </Flex>
      </div>
      <div className="bordered surface">
        <Flex gap={3} wrap>
          {unassignedTimestamps.map((timestamp) => {
            const isActive = activeTimestamp?.id === timestamp.id;
            return (
              <Button
                className={clsx(isActive && 'pulse')}
                icon={isActive ? <PlugIcon /> : <ClockIcon />}
                key={timestamp.id}
                onClick={() => onActivateTimestamp(timestamp)}
                shape="round"
                size="small"
                style={{ backgroundColor: ASSIGNEES[timestamp.assignee].color }}
                type={isActive ? 'dashed' : 'default'}
              >
                {timestamp.startTime} ms
              </Button>
            );
          })}
          {unassignedTimestamps.length === 0 && <span>No unassigned timestamps</span>}
        </Flex>
      </div>
    </div>
  );
}
