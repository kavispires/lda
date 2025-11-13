import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import { Button, Slider, type SliderSingleProps } from 'antd';
import clsx from 'clsx';
import type { useVideoControls } from 'hooks/useVideoControls';
import './VideoControls.scss';

type VideoControlsProps = {
  className?: string;
  videoControls: ReturnType<typeof useVideoControls>;
};

export function VideoControls({ className, videoControls }: VideoControlsProps) {
  const {
    isPlaying,
    pauseVideo,
    playVideo,
    seekAndPlay,
    seekToStart,
    seekToEnd,
    startAt,
    endAt,
    currentTime,
  } = videoControls;

  return (
    <div className={clsx('video-controls', className)}>
      <Button ghost onClick={isPlaying ? pauseVideo : playVideo}>
        {videoControls.isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
      </Button>
      <Button ghost onClick={seekToStart}>
        <StepBackwardOutlined />
      </Button>
      <Button ghost onClick={seekToEnd}>
        <StepForwardOutlined />
      </Button>
      <div className="video-controls__slider">
        <Slider
          max={endAt}
          min={startAt}
          onChange={(value) => {
            seekAndPlay(value);
          }}
          tooltip={{ formatter }}
          value={currentTime}
        />
      </div>
    </div>
  );
}

const formatter: NonNullable<SliderSingleProps['tooltip']>['formatter'] = (value) => {
  if (!value) return 0;
  const minutes = Math.floor(value / 60000);
  const seconds = Math.floor((value / 1000) % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};
