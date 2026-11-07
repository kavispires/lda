import { wait } from '@utils';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useEffectOnce } from 'react-use';
import type YouTube from 'react-youtube';
import type { YouTubeEvent } from 'react-youtube';

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
  const playerRef = useRef<YouTube | null>(null);
  const intervalId = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const [isPlaying, setPlaying] = useState(false);
  const [isEnd, setEnd] = useState(false);

  const startAt = options.startAt || 0;
  const [duration, setDuration] = useState(options.endAt);
  const [currentTime, setCurrentTime] = useState(options.startAt);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffectOnce(() => {
    if (!duration) {
      playerRef?.current?.internalPlayer?.getDuration().then((d: number) => {
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
    playerRef?.current?.internalPlayer?.seekTo(timestamp / 1000, true);
    setCurrentTime(timestamp);
    playerRef?.current?.internalPlayer?.playVideo();
    setPlaying(true);
  };

  const seekToStart = () => {
    playerRef?.current?.internalPlayer?.seekTo(startAt / 1000, true);
    setCurrentTime(startAt);
  };

  const seekToEnd = () => {
    pauseVideo();
    playerRef?.current?.internalPlayer?.seekTo(duration / 1000, true);
    setCurrentTime(duration);
  };

  const seekTo = (timestamp: number) => {
    const time = Math.max(startAt, Math.min(options.endAt || duration, timestamp));
    pauseVideo();
    playerRef?.current?.internalPlayer?.seekTo(time / 1000, true);
    setCurrentTime(time);
  };

  const onStateChange = (event: YouTubeEvent<number>) => {
    clearInterval(intervalId.current);
    if (event.data === 1) {
      setPlaying(true);
      intervalId.current = setInterval(async () => {
        const time = (await event.target.getCurrentTime()) * 1000;
        if (options.endAt && time >= options.endAt) {
          event.target.pauseVideo();
          setCurrentTime(options.endAt);
          setPlaying(false);
          setEnd(true);
          clearInterval(intervalId.current);
        } else {
          setCurrentTime(time);
        }
      }, 1000 / 30);
    } else {
      setPlaying(false);
      // Kill interval
      clearInterval(intervalId?.current);
    }
  };

  useEffect(() => {
    if (options.endAt) setDuration(options.endAt);
  }, [options.endAt]);

  useEffect(() => () => clearInterval(intervalId.current), []);

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
    seekTo,
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
