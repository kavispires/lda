import YouTube from 'react-youtube';

type PlaybackVideoProps = {
  videoId: string;
  width?: number;
};
export function PlaybackVideo({ videoId, width = 640 }: PlaybackVideoProps) {
  const w = Math.max(320, width);
  const h = (9 * w) / 16;
  console.log(w, h);
  return (
    <YouTube
      key={videoId}
      videoId={videoId}
      // TODO: App crashes upon setting width
      // opts={{ width: w, height: h, videoId }}
    />
  );
}
