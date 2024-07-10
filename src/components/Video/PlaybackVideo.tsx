import { memo } from 'react';
import YouTube from 'react-youtube';

type PlaybackVideoProps = {
  videoId: string;
  width?: number;
};

function PlaybackVideoComponent({ videoId, width = 640 }: PlaybackVideoProps) {
  const w = Math.max(320, width);
  const h = (9 * w) / 16;
  if (w <= 0 || h <= 0) {
    console.log(w, h);
    alert('Invalid width or height');
  }
  return (
    <YouTube
      key={videoId}
      videoId={videoId}
      // TODO: App crashes upon setting width
      // opts={{ width: w, height: h, videoId }}
      opts={{
        width: w,
        height: h,
        playerVars: {
          autoplay: 0,
          controls: 1,
        },
      }}
    />
  );
}

const PlaybackVideo = memo(PlaybackVideoComponent);
export { PlaybackVideo };
