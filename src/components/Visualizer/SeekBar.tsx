import { Slider, SliderSingleProps } from 'antd';
import clsx from 'clsx';
import { useVideoControls } from 'hooks/useVideoControls';
import { useKeyPressEvent } from 'react-use';

type SeekBarProps = {
  className?: string;
  videoControls: ReturnType<typeof useVideoControls>;
};

export function SeekBar({ className, videoControls }: SeekBarProps) {
  const { seekAndPlay, startAt, endAt, currentTime } = videoControls;

  useKeyPressEvent('j', () => {
    seekAndPlay(currentTime - 10000);
  });

  useKeyPressEvent('l', () => {
    seekAndPlay(currentTime + 10000);
  });

  return (
    <div className={clsx('visualizer-seek-bar', className)}>
      <div className="visualizer-seek-bar__slider">
        <Slider
          min={startAt}
          max={endAt}
          value={currentTime}
          onChange={(value) => {
            seekAndPlay(value);
          }}
          tooltip={{ formatter }}
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
