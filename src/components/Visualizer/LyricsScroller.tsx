import clsx from 'clsx';
import { orderBy } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';
import { LyricSnapshot } from 'services/DistributionVisualizerProvider';
import { Dictionary, Distribution } from 'types';

import { LyricBox } from './LyricBox';

type LyricsScrollerProps = {
  assignees: Distribution['assignees'];
  lyricsSnapshots: Dictionary<LyricSnapshot>;
  timestamp: number;
  maxHeight: number;
  songTitle: string;
};

export function LyricsScroller({
  assignees,
  timestamp,
  lyricsSnapshots,
  maxHeight,
  songTitle,
}: LyricsScrollerProps) {
  const lyricsRef = useRef<(HTMLDivElement | null)[]>([]);
  const previousTimestampKey = useRef<string>('0');

  const orderedLyricsKeys = useMemo(() => {
    return orderBy(Object.keys(lyricsSnapshots), (key) => Number(key));
  }, [lyricsSnapshots]);

  useEffect(() => {
    const currentLyric = lyricsRef.current[timestamp];
    if (currentLyric) {
      currentLyric.scrollIntoView({
        behavior: timestamp > Number(previousTimestampKey.current ?? 0) ? 'smooth' : 'auto',
        block: 'end',
      });
      previousTimestampKey.current = String(timestamp);
    } else {
      const newCurrent = lyricsRef.current[Number(previousTimestampKey.current)];
      if (newCurrent) {
        newCurrent.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
      }
    }
  }, [timestamp]);

  return (
    <div className="visualizer__lyrics" style={{ maxHeight }}>
      <div className="lyric-box-container" style={{ height: '100svh' }}>
        <h1>{songTitle}</h1>
      </div>

      {orderedLyricsKeys.map((key) => {
        const snapshot = lyricsSnapshots[key];
        const isActive = key === previousTimestampKey.current;
        const isPast = Number(key) <= timestamp;

        return (
          <div
            key={key}
            className={clsx(
              'lyric-box-container',
              isActive && 'lyric-box-container--active',
              isPast && 'lyric-box-container--past'
            )}
            ref={(el) => (lyricsRef.current[Number(key)] = el)}
          >
            <LyricBox snapshot={snapshot} assignees={assignees} />
          </div>
        );
      })}
    </div>
  );
}
