import { Button, Flex, Progress, Typography } from 'antd';
import clsx from 'clsx';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { useSongActions } from 'hooks/useSongActions';
import { useVideoControls } from 'hooks/useVideoControls';
import { useMemo, useState } from 'react';
import type YouTube from 'react-youtube';
import { useSongEditContext } from 'services/SongEditProvider';
import { distributor } from 'utils';

import { PlayCircleOutlined } from '@ant-design/icons';

import { KeyCapture, type RecordingTimestamp } from './SyncComponents/KeyCapture';
import { TimestampsManagement } from './SyncComponents/TimestampsManagement';
import { SyncLog } from './SyncComponents/SyncLog';
import { SyncMethods } from './SyncComponents/SyncMethods';
import type { Dictionary, UpdateValue } from 'types';
import { DEFAULT_ASSIGNEE } from 'utils/constants';

type StepSyncProps = {
  videoWidth: number;
};

export function StepSync({ videoWidth }: StepSyncProps) {
  const { song } = useSongEditContext();

  const { onBatchUpdateSong } = useSongActions();
  const { isPlaying, setPlaying, setEnd, playerRef, playVideo, pauseVideo, seekAndPlay } = useVideoControls();
  const [isRecording, setRecording] = useState(false);

  const toggleRecording = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isRecording) {
      pauseVideo();
      setRecording(false);
    } else {
      playVideo();
      setRecording(true);
      e.currentTarget.blur();
    }
  };

  const [unassignedTimestamps, setUnassignedTimestamps] = useState<RecordingTimestamp[]>([]);
  const [activeTimestamp, setActiveTimestamp] = useState<RecordingTimestamp | null>(null);

  const handleConnect = (partId: string) => {
    if (!activeTimestamp) return;
    const timestamp = activeTimestamp;
    if (timestamp?.endTime) {
      const updates: Dictionary<UpdateValue> = {};
      updates[`content.${partId}.startTime`] = timestamp.startTime;
      updates[`content.${partId}.endTime`] = timestamp.endTime;
      if (timestamp.assignee !== DEFAULT_ASSIGNEE) {
        updates[`content.${partId}.recommendedAssignee`] = timestamp.assignee;
      }
      onBatchUpdateSong(updates);
    }
    setActiveTimestamp(null);
    setUnassignedTimestamps(unassignedTimestamps.filter((t) => t.id !== timestamp.id));
  };

  const timeStampProgress = useMemo(() => {
    return distributor.getPartsWithDurationCompletion(song);
  }, [song]);

  return (
    <>
      <Typography.Title level={3}>Sync</Typography.Title>
      <Typography.Paragraph>
        Press the Record button and use the keyboard numbers (1-9) press and hold while the video is playing
        to create timestamps. Then, assign the timestamps to their parts.
      </Typography.Paragraph>
      <Progress percent={timeStampProgress} strokeColor={isRecording ? 'red' : undefined} />

      <div className="grid grid-cols-2 gap-2">
        <SyncLog activeTimestamp={activeTimestamp} seekAndPlay={seekAndPlay} handleConnect={handleConnect} />

        <div>
          <Flex justify="center" className="surface">
            <ControlledVideo
              videoId={song.videoId}
              width={Math.min(videoWidth, 480)}
              playerRef={playerRef as React.LegacyRef<YouTube>}
              setRecording={setRecording}
              setPlaying={setPlaying}
              setEnd={setEnd}
            />
          </Flex>

          <div className="mt-4 surface">
            <Button
              icon={<PlayCircleOutlined />}
              danger={true}
              type={isRecording ? 'primary' : 'default'}
              onClick={toggleRecording}
              block
              className={clsx('mb-4', isRecording && 'recording')}
            >
              {isRecording ? 'Recording' : 'Record'}
            </Button>

            <KeyCapture
              playerRef={playerRef}
              isPlaying={isPlaying}
              isRecording={isRecording}
              setUnassignedTimestamps={setUnassignedTimestamps}
            />

            <TimestampsManagement
              unassignedTimestamps={unassignedTimestamps}
              setUnassignedTimestamps={setUnassignedTimestamps}
              activeTimestamp={activeTimestamp}
              setActiveTimestamp={setActiveTimestamp}
            />

            <SyncMethods
              unassignedTimestamps={unassignedTimestamps}
              setUnassignedTimestamps={setUnassignedTimestamps}
              activeTimestamp={activeTimestamp}
              setActiveTimestamp={setActiveTimestamp}
              isRecording={isRecording}
            />
          </div>
        </div>
      </div>
    </>
  );
}
