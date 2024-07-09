import YouTube from 'react-youtube';

export type ControlledVideoProps = {
  videoId: string;
  playerRef: React.LegacyRef<YouTube>;
  onStateChange?: (event: any) => void;
  width?: number;
  setRecording: (value: boolean) => void;
  setPlaying: (value: boolean) => void;
  setEnd: (value: boolean) => void;
  className?: string;
};

export function ControlledVideo({
  videoId,
  width = 640,
  playerRef,
  className,
  onStateChange,
  setRecording,
  setPlaying,
  setEnd,
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
    setRecording(false);
    setPlaying(false);
  };

  return (
    <YouTube
      videoId={videoId}
      id={videoId}
      key={videoId}
      ref={playerRef}
      className="video"
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
          controls: 1,
          fs: 0,
        },
      }}
    />
  );
}
