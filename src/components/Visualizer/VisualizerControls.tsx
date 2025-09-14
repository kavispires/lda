import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Badge, Button, Popover, Typography } from 'antd';
import clsx from 'clsx';
import type { useVideoControls } from 'hooks/useVideoControls';
import { useNavigate, useParams } from 'react-router-dom';
import { useKeyPressEvent } from 'react-use';
import type { DistributionFreshness } from 'services/DistributionVisualizerProvider';

type VisualizerControlsProps = {
  isVisible: boolean;
  className?: string;
  videoControls: ReturnType<typeof useVideoControls>;
  songId: string;
  freshness: DistributionFreshness;
};

export function VisualizerControls({ videoControls, isVisible, songId, freshness }: VisualizerControlsProps) {
  const { isPlaying, pauseVideo, playVideo, seekToStart, seekToEnd, onRestart } = videoControls;
  const navigate = useNavigate();
  const { distributionId } = useParams();

  useKeyPressEvent(' ', () => {
    isPlaying ? pauseVideo() : playVideo();
  });

  return (
    <div className={clsx('visualizer-controls', isVisible && 'visualizer-controls--visible')}>
      <Button onClick={onRestart}>
        <UndoOutlined />
      </Button>
      <Button onClick={isPlaying ? pauseVideo : playVideo} ghost>
        {videoControls.isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
      </Button>
      <Button ghost onClick={seekToStart}>
        <StepBackwardOutlined />
      </Button>
      <Button ghost onClick={seekToEnd}>
        <StepForwardOutlined />
      </Button>
      <Button onClick={() => navigate(`/distributions/${distributionId}/edit`)}>Edit Distribution</Button>
      <Button onClick={() => navigate(`/songs/${songId}/edit`)}>Edit Song</Button>
      {freshness.outdated && (
        <Popover
          content={
            <div>
              <Typography.Title level={4}>Distribution is outdated</Typography.Title>
              {freshness.missingParts.length > 0 && (
                <Typography.Paragraph>
                  There are {freshness.missingParts.length} extra parts that need to be assigned. Edit the
                  song to do so.
                </Typography.Paragraph>
              )}
              {freshness.extraParts.length > 0 && (
                <Typography.Paragraph>
                  There are {freshness.extraParts.length} parts that are no longer in the song. Save the song
                  so they can be automatically removed.
                </Typography.Paragraph>
              )}
            </div>
          }
          trigger="click"
        >
          <Button type="text">
            <Badge status="error" size="default" />
          </Button>
        </Popover>
      )}
    </div>
  );
}
