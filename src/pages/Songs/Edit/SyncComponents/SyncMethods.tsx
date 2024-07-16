import { Button, Typography } from 'antd';
import { useSongActions } from 'hooks/useSongActions';
import { useSongEditContext } from 'services/SongEditProvider';

import { RecordingTimestamp } from './KeyCapture';
import { Dictionary, UpdateValue } from 'types';
import { DEFAULT_ASSIGNEE } from 'utils/constants';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

type StepSyncProps = {
  unassignedTimestamps: RecordingTimestamp[];
  setUnassignedTimestamps: React.Dispatch<React.SetStateAction<RecordingTimestamp[]>>;
  activeTimestamp: RecordingTimestamp | null;
  setActiveTimestamp: React.Dispatch<React.SetStateAction<RecordingTimestamp | null>>;
  isRecording: boolean;
};

export function SyncMethods({
  unassignedTimestamps,
  setUnassignedTimestamps,
  activeTimestamp,
  setActiveTimestamp,
  isRecording,
}: StepSyncProps) {
  const {
    selectionIdModel: { selection, onDeselectAll },
  } = useSongEditContext();
  const { onBatchUpdateSong } = useSongActions();
  const [sequentialMode, setSequentialMode] = useState(false);

  const onLinearSync = () => {
    if (selection.length === 0 || selection.length !== unassignedTimestamps.length) {
      return;
    }

    const updates: Dictionary<UpdateValue> = {};

    selection.forEach((partId, index) => {
      const timestamp = unassignedTimestamps[index];
      if (timestamp && timestamp.endTime) {
        updates[`content.${partId}.startTime`] = timestamp.startTime;
        updates[`content.${partId}.endTime`] = timestamp.endTime;
        if (timestamp.assignee !== DEFAULT_ASSIGNEE) {
          updates[`content.${partId}.recommendedAssignee`] = timestamp.assignee;
        }
      }
    });

    onBatchUpdateSong(updates);
    onDeselectAll();
    setUnassignedTimestamps([]);
    setActiveTimestamp(null);
  };

  useEffect(() => {
    if (sequentialMode) {
      if (unassignedTimestamps.length === 0) {
        setSequentialMode(false);
        return;
      }

      if (activeTimestamp === null) {
        setActiveTimestamp(unassignedTimestamps[0]);
        return;
      }
    }
  }, [sequentialMode, activeTimestamp, unassignedTimestamps]);

  return (
    <div className="my-2">
      <Typography.Text strong>Sync Options</Typography.Text>
      <Typography.Paragraph>
        You may click on a timestamp to activate it, then click on a part to attach it automatically or click
        on the trash can to delete it.
      </Typography.Paragraph>
      <div className="grid grid-cols-2 gap-8">
        <div className="px-2">
          <Button
            block
            type="primary"
            disabled={selection.length === 0 || selection.length !== unassignedTimestamps.length}
            onClick={onLinearSync}
          >
            One-time Linear Sync ({selection.length}/{unassignedTimestamps.length})
          </Button>
          Select Part checkboxes on the Lyrics on the right. All timestamps will be automatically synced in
          the order checkboxes were selected.
        </div>
        <div className="px-2">
          <Button
            block
            disabled={unassignedTimestamps.length === 0 || isRecording}
            className={clsx(sequentialMode && 'pulse')}
            onClick={() => setSequentialMode((prev) => !prev)}
          >
            Sequential Mode
          </Button>{' '}
          Engine will activate each timestamp in sequence and will select the next timestamp after you click
          on a part to attach it.
        </div>
      </div>
    </div>
  );
}
