import { useRef, useState } from 'react';

export function useVideoControls() {
  const [isPlaying, setPlaying] = useState(false);
  const [isEnd, setEnd] = useState(false);
  const playerRef = useRef<any>(null);
  const playVideo = () => {
    playerRef?.current?.internalPlayer?.playVideo();
  };

  const pauseVideo = () => {
    playerRef?.current?.internalPlayer?.pauseVideo();
  };

  const seekAndPlay = (timestamp: number) => {
    playerRef?.current?.internalPlayer?.seekTo(timestamp / 1000);
    playerRef?.current?.internalPlayer?.playVideo();
  };

  return {
    isPlaying,
    setPlaying,
    isEnd,
    setEnd,
    playerRef,
    playVideo,
    pauseVideo,
    seekAndPlay,
  };
}
