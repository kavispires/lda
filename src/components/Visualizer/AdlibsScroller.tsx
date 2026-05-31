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

// Calculate duration based on adlib text length
// Ensures adlibs are visible long enough to read
const calculateAdlibDuration = (snapshot: LyricSnapshot): number => {
  const totalTextLength = snapshot.lines.reduce((total, line) => {
    return total + line.parts.map((part) => part.text).join(' ').length;
  }, 0);

  // Base formula: 2 timestamps per character + minimum 20 timestamps
  // This gives roughly 0.2 seconds per character plus 2 seconds minimum
  const minDuration = 20;
  const charDurationMultiplier = 2;

  return Math.max(minDuration, totalTextLength * charDurationMultiplier);
};

/**
 * AdlibsScroller component is responsible for displaying adlib snapshots
 * within a scrollable container. It dynamically updates the active adlibs
 * based on the provided timestamp and adlibsSnapshots.
 * Uses motion for smooth GPU-accelerated animations.
 */
export function AdlibsScroller({ assignees, timestamp, adlibsSnapshots, maxHeight }: AdlibsScrollerProps) {
  const [activeAdlibs, setActiveAdlibs] = useState<Record<string, number>>({});

  /**
   * Effect hook that updates the `activeAdlibs` state based on the current `timestamp`.
   * Adds new adlibs when they appear and removes them after their calculated duration.
   */
  useEffect(() => {
    setActiveAdlibs((prev) => {
      const copy = { ...prev };

      // Add new adlib if one exists at this timestamp
      if (adlibsSnapshots[timestamp]) {
        const duration = calculateAdlibDuration(adlibsSnapshots[timestamp]);
        copy[timestamp] = duration;
      }

      // Remove expired adlibs (runs on every timestamp change)
      Object.keys(copy).forEach((key) => {
        if (Number(key) + copy[key] < timestamp) {
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
                y: -20,
                scale: 0.95,
              }}
              initial={{
                opacity: 0,
                y: 20,
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
