import clsx from 'clsx';
import { memo } from 'react';
import YouTube, { type YouTubeEvent } from 'react-youtube';

export type ControlledVideoProps = {
  videoId: string;
  playerRef: React.LegacyRef<YouTube>;
  onStateChange?: (event: YouTubeEvent<number>) => void;
  width?: number;
  setPlaying: (value: boolean) => void;
  setRecording?: (value: boolean) => void;
  setEnd: (value: boolean) => void;
  className?: string;
  hideControls?: boolean;
};

export function ControlledVideoComponent({
  videoId,
  width = 640,
  playerRef,
  className,
  onStateChange,
  setRecording,
  setPlaying,
  setEnd,
  hideControls = false,
}: ControlledVideoProps) {
  const w = Math.max(320, width);
  const h = (9 * w) / 16;
  if (w <= 0 || h <= 0) {
    console.log(w, h);
    alert('Invalid width or height');
  }

  const onReady = () => {
    setEnd(false);
  };

  const onPlay = () => {
    setEnd(false);
    setPlaying(true);
  };

  const onPause = () => {
    setPlaying(false);
  };

  const onEnd = () => {
    setEnd(true);
    setRecording?.(false);
    setPlaying(false);
  };

  return (
    <YouTube
      videoId={videoId}
      id={videoId}
      key={videoId}
      ref={playerRef}
      className={clsx('video', className)}
      iframeClassName="video__iframe"
      onReady={onReady}
      onPlay={onPlay}
      onPause={onPause}
      onEnd={onEnd}
      onStateChange={onStateChange}
      opts={{
        width: w,
        height: h,
        playerVars: {
          autoplay: 0,
          controls: hideControls ? 0 : 1,
          fs: 0,
        },
      }}
    />
  );
}

const ControlledVideo = memo(ControlledVideoComponent);
export { ControlledVideo };
