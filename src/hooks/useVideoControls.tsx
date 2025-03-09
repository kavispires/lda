import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useEffectOnce } from 'react-use';
import type { YouTubeEvent } from 'react-youtube';
import { wait } from 'utils';

type UseVideoControlsOptions = {
  /**
   * The start time of the video in milliseconds
   */
  startAt: number;
  /**
   * The end time of the video in milliseconds
   */
  endAt: number;
};

export function useVideoControls(
  options: UseVideoControlsOptions = {
    startAt: 0,
    endAt: 0,
  },
) {
  const playerRef = useRef<any>(null);
  const intervalId = useRef<any>(null);

  const [isPlaying, setPlaying] = useState(false);
  const [isEnd, setEnd] = useState(false);

  const startAt = options.startAt || 0;
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffectOnce(() => {
    if (!duration) {
      playerRef?.current?.internalPlayer.getDuration().then((d: number) => {
        setDuration(options.endAt || d * 1000);
      });
    }
  });

  const playVideo = () => {
    if (currentTime < startAt) {
      seekToStart();
    }
    if (currentTime >= duration) {
      seekToStart();
    }
    playerRef?.current?.internalPlayer?.playVideo();
    setPlaying(true);
  };

  const pauseVideo = () => {
    playerRef?.current?.internalPlayer?.pauseVideo();
    setPlaying(false);
  };

  const seekAndPlay = (timestamp: number) => {
    playerRef?.current?.internalPlayer?.seekTo(timestamp / 1000);
    playerRef?.current?.internalPlayer?.playVideo();
    setPlaying(true);
  };

  const seekToStart = () => {
    playerRef?.current?.internalPlayer?.seekTo(startAt / 1000);
  };

  const seekToEnd = () => {
    pauseVideo();
    playerRef?.current?.internalPlayer?.seekTo(duration / 1000);
  };

  const onStateChange = (event: YouTubeEvent<number>) => {
    if (event.data === 1) {
      intervalId.current = setInterval(async () => {
        setCurrentTime((await event.target.getCurrentTime()) * 1000);
      }, 1000 / 30);
    } else {
      // Kill interval
      clearInterval(intervalId?.current);
    }
  };

  const onRestart = async () => {
    flushSync(() => {
      pauseVideo();
      seekToStart();
      playVideo();
    });

    await wait(500);
    flushSync(() => pauseVideo());

    flushSync(() => setRefreshKey(Date.now()));

    await wait(3000);

    playVideo();
    setRefreshKey(Date.now());
  };

  useEffect(() => {
    if (duration && currentTime >= duration) {
      setPlaying(false);
      setEnd(true);
    }
  }, [currentTime, duration]);

  return {
    isPlaying,
    setPlaying,
    isEnd,
    setEnd,
    playerRef,
    playVideo,
    pauseVideo,
    seekAndPlay,
    onStateChange,
    currentTime,
    second: currentTime / 1000,
    duration,
    startAt: options.startAt,
    endAt: options.endAt || duration || 0,
    seekToStart,
    seekToEnd,
    onRestart,
    refreshKey,
  };
}
