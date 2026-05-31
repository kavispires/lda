import clsx from 'clsx';
import { orderBy } from 'lodash';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import type { LyricSnapshot } from 'services/DistributionVisualizerProvider';
import type { Dictionary, Distribution } from 'types';

import { LyricBox } from './LyricBox';

type LyricsScrollerProps = {
  assignees: Distribution['assignees'];
  lyricsSnapshots: Dictionary<LyricSnapshot>;
  timestamp: number;
  maxHeight: number;
  songTitle: string;
};

// Estimated height per lyric box in pixels (used before measurement)
const ESTIMATED_LYRIC_HEIGHT = 180;

export function LyricsScroller({
  assignees,
  timestamp,
  lyricsSnapshots,
  maxHeight,
  songTitle,
}: LyricsScrollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lyricHeights, setLyricHeights] = useState<Map<string, number>>(new Map());

  // Memoize ordered lyric keys
  const orderedLyricsKeys = useMemo(() => {
    return orderBy(Object.keys(lyricsSnapshots), (key) => Number(key));
  }, [lyricsSnapshots]);

  // Find current lyric index
  const currentIndex = useMemo(() => {
    // Find the index of the lyric that should be active at this timestamp
    // This is the last lyric that started at or before the current timestamp
    let activeIndex = -1;
    for (let i = 0; i < orderedLyricsKeys.length; i++) {
      const key = Number(orderedLyricsKeys[i]);
      if (key <= timestamp) {
        activeIndex = i;
      } else {
        break;
      }
    }
    // Return -1 if no lyric has started yet (title screen)
    return activeIndex;
  }, [orderedLyricsKeys, timestamp]);

  // Calculate translateY to keep active lyric fully visible
  const translateY = useMemo(() => {
    // If no lyric is active yet (currentIndex = -1), show title at top
    if (currentIndex === -1) {
      return 0;
    }

    const bottomOffset = maxHeight * 0.85; // Position bottom of active lyric at 85% from top
    const titleHeight = maxHeight; // Title takes full viewport height

    // Calculate total offset from start to bottom of current lyric (including title)
    let totalOffset = titleHeight;
    for (let i = 0; i < currentIndex && i < orderedLyricsKeys.length; i++) {
      const key = orderedLyricsKeys[i];
      totalOffset += lyricHeights.get(key) || ESTIMATED_LYRIC_HEIGHT;
    }

    // Add current lyric height to get to the bottom
    if (currentIndex < orderedLyricsKeys.length && currentIndex >= 0) {
      const currentKey = orderedLyricsKeys[currentIndex];
      totalOffset += lyricHeights.get(currentKey) || ESTIMATED_LYRIC_HEIGHT;
    }

    // Move container up so bottom of current lyric appears at bottomOffset
    return bottomOffset - totalOffset;
  }, [currentIndex, orderedLyricsKeys, lyricHeights, maxHeight]);

  // Measure lyric heights as they render
  const measureLyric = (key: string, element: HTMLDivElement | null) => {
    if (element && !lyricHeights.has(key)) {
      const height = element.getBoundingClientRect().height;
      setLyricHeights((prev) => new Map(prev).set(key, height));
    }
  };

  return (
    <div className="visualizer__lyrics" ref={containerRef} style={{ maxHeight, overflow: 'hidden' }}>
      {/* Animated lyrics container */}
      <motion.div animate={{ y: translateY }} initial={false} transition={{ duration: 0.4, ease: 'easeOut' }}>
        <AnimatePresence mode="popLayout">
          <motion.div
            animate={{ opacity: currentIndex === -1 ? 1 : 0.05 }}
            className="lyric-box-container lyric-box-song-title"
            initial={{ opacity: 1 }}
            style={{
              height: containerRef.current ? containerRef.current.getBoundingClientRect().height : maxHeight,
            }}
            transition={{ duration: 0.5 }}
          >
            <h1>{songTitle}</h1>
          </motion.div>

          {orderedLyricsKeys.map((key, index) => {
            const snapshot = lyricsSnapshots[key];
            const isActive = index === currentIndex;
            const isPast = index < currentIndex;

            return (
              <motion.div
                animate={{ opacity: isActive ? 1 : isPast ? 0.5 : 0.05 }}
                className={clsx(
                  'lyric-box-container',
                  isActive && 'lyric-box-container--active',
                  isPast && 'lyric-box-container--past',
                )}
                exit={{ opacity: 0 }}
                initial={{ opacity: 0.05 }}
                key={key}
                ref={(el) => measureLyric(key, el)}
                transition={{ duration: 0.3 }}
              >
                <LyricBox assignees={assignees} snapshot={snapshot} timestamp={timestamp} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
