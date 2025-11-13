import { PlayCircleOutlined } from '@ant-design/icons';
import { Button, Flex, Progress, Typography } from 'antd';
import clsx from 'clsx';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { useSongActions } from 'hooks/useSongActions';
import { useVideoControls } from 'hooks/useVideoControls';
import { useMemo, useState } from 'react';
import type YouTube from 'react-youtube';
import { useSongEditContext } from 'services/SongEditProvider';
import type { Dictionary, UpdateValue } from 'types';
import { distributor } from 'utils';
import { DEFAULT_ASSIGNEE } from 'utils/constants';
import { KeyCapture, type RecordingTimestamp } from './SyncComponents/KeyCapture';
import { SyncLog } from './SyncComponents/SyncLog';
import { SyncMethods } from './SyncComponents/SyncMethods';
import { TimestampsManagement } from './SyncComponents/TimestampsManagement';

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
        <SyncLog activeTimestamp={activeTimestamp} handleConnect={handleConnect} seekAndPlay={seekAndPlay} />

        <div>
          <Flex className="surface" justify="center">
            <ControlledVideo
              playerRef={playerRef as React.LegacyRef<YouTube>}
              setEnd={setEnd}
              setPlaying={setPlaying}
              setRecording={setRecording}
              videoId={song.videoId}
              width={Math.min(videoWidth, 480)}
            />
          </Flex>

          <div className="mt-4 surface">
            <Button
              block
              className={clsx('mb-4', isRecording && 'recording')}
              danger={true}
              icon={<PlayCircleOutlined />}
              onClick={toggleRecording}
              type={isRecording ? 'primary' : 'default'}
            >
              {isRecording ? 'Recording' : 'Record'}
            </Button>

            <KeyCapture
              isPlaying={isPlaying}
              isRecording={isRecording}
              playerRef={playerRef}
              setUnassignedTimestamps={setUnassignedTimestamps}
            />

            <TimestampsManagement
              activeTimestamp={activeTimestamp}
              setActiveTimestamp={setActiveTimestamp}
              setUnassignedTimestamps={setUnassignedTimestamps}
              unassignedTimestamps={unassignedTimestamps}
            />

            <SyncMethods
              activeTimestamp={activeTimestamp}
              isRecording={isRecording}
              setActiveTimestamp={setActiveTimestamp}
              setUnassignedTimestamps={setUnassignedTimestamps}
              unassignedTimestamps={unassignedTimestamps}
            />
          </div>
        </div>
      </div>
    </>
  );
}
