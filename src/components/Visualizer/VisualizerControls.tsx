import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import clsx from 'clsx';
import { useVideoControls } from 'hooks/useVideoControls';
import { useNavigate, useParams } from 'react-router-dom';
import { useKeyPressEvent } from 'react-use';

type VisualizerControlsProps = {
  isVisible: boolean;
  className?: string;
  videoControls: ReturnType<typeof useVideoControls>;
  songId: string;
};

export function VisualizerControls({ videoControls, isVisible, songId }: VisualizerControlsProps) {
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
    </div>
  );
}
