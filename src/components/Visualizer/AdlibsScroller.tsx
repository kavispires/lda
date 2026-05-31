import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { LyricSnapshot } from 'services/DistributionVisualizerProvider';
import type { Dictionary, Distribution } from 'types';

import { AdlibBox } from './LyricBox';

type AdlibsScrollerProps = {
  assignees: Distribution['assignees'];
  adlibsSnapshots: Dictionary<LyricSnapshot>;
  timestamp: number;
  maxHeight: number;
};

/**
 * AdlibsScroller component is responsible for displaying adlib snapshots
 * within a scrollable container. It dynamically updates the active adlibs
 * based on the provided timestamp and adlibsSnapshots.
 * Uses motion for smooth GPU-accelerated animations.
 * Adlibs remain visible until 0.5 second (5 timestamps) after their endTime.
 */
export function AdlibsScroller({ assignees, timestamp, adlibsSnapshots, maxHeight }: AdlibsScrollerProps) {
  // Store expiry timestamp for each active adlib (keyed by appearance timestamp)
  const [activeAdlibs, setActiveAdlibs] = useState<Record<string, number>>({});

  /**
   * Effect hook that updates the `activeAdlibs` state based on the current `timestamp`.
   * Adds new adlibs when they appear and removes them 1 second after their endTime.
   */
  useEffect(() => {
    setActiveAdlibs((prev) => {
      const copy = { ...prev };

      // Add new adlib if one exists at this timestamp
      if (adlibsSnapshots[timestamp]) {
        const snapshot = adlibsSnapshots[timestamp];
        // Adlib expires 1 second (10 timestamps) after its endTime
        const expiryTime = snapshot.endTime + 5;
        copy[timestamp] = expiryTime;
      }

      // Remove expired adlibs (runs on every timestamp change)
      Object.keys(copy).forEach((key) => {
        if (copy[key] < timestamp) {
          delete copy[key];
        }
      });

      return copy;
    });
  }, [timestamp, adlibsSnapshots]);

  return (
    <div className="visualizer__adlibs" style={{ maxHeight }}>
      <AnimatePresence mode="popLayout">
        {Object.keys(activeAdlibs).map((key) => {
          const snapshot = adlibsSnapshots[key];

          // Skip if snapshot doesn't exist
          if (!snapshot) return null;

          return (
            <motion.div
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              className="adlib-box-container adlib-box-container--active"
              exit={{
                opacity: 0,
                y: -36,
                scale: 0.95,
              }}
              initial={{
                opacity: 0,
                y: 36,
                scale: 0.95,
              }}
              key={key}
              transition={{
                duration: 0.3,
                ease: 'easeOut',
              }}
            >
              <AdlibBox assignees={assignees} snapshot={snapshot} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
