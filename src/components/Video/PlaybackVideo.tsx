import YouTube from 'react-youtube';

type PlaybackVideoProps = {
  videoId: string;
  width?: number;
};
export function PlaybackVideo({ videoId, width = 640 }: PlaybackVideoProps) {
  return <YouTube key={videoId} videoId={videoId} opts={{ width, height: (9 * width) / 16 }} />;
}
