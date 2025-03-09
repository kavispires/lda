import { Button, Flex, Popconfirm, Typography } from 'antd';
import clsx from 'clsx';
import { ASSIGNEES } from 'utils/constants';

import { ApiOutlined, ClearOutlined, ClockCircleOutlined, DeleteOutlined } from '@ant-design/icons';

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
          <Button size="small" disabled={!activeTimestamp} onClick={onDeleteTimestamp}>
            <DeleteOutlined />
          </Button>
          <Popconfirm
            title="Are you sure you want to delete all unassigned timestamps?"
            onConfirm={onDeleteAllTimestamps}
          >
            <Button size="small" danger type="primary" disabled={unassignedTimestamps.length === 0}>
              <ClearOutlined />
            </Button>
          </Popconfirm>
        </Flex>
      </div>
      <div className="bordered surface">
        <Flex wrap gap={3}>
          {unassignedTimestamps.map((timestamp) => {
            const isActive = activeTimestamp?.id === timestamp.id;
            return (
              <Button
                key={timestamp.id}
                size="small"
                shape="round"
                type={isActive ? 'dashed' : 'default'}
                icon={isActive ? <ApiOutlined /> : <ClockCircleOutlined />}
                className={clsx(isActive && 'pulse')}
                onClick={() => onActivateTimestamp(timestamp)}
                style={{ backgroundColor: ASSIGNEES[timestamp.assignee].color }}
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
