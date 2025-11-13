import { ApiOutlined, ClearOutlined, ClockCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { Button, Flex, Popconfirm, Typography } from 'antd';
import clsx from 'clsx';
import { ASSIGNEES } from 'utils/constants';

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
            <DeleteOutlined />
          </Button>
          <Popconfirm
            onConfirm={onDeleteAllTimestamps}
            title="Are you sure you want to delete all unassigned timestamps?"
          >
            <Button danger disabled={unassignedTimestamps.length === 0} size="small" type="primary">
              <ClearOutlined />
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
                icon={isActive ? <ApiOutlined /> : <ClockCircleOutlined />}
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
