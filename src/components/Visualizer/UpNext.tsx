import type { UpNextItem } from '@services/DistributionVisualizerProvider';
import type { Dictionary } from '@types';
import { memo, useEffect, useMemo, useState } from 'react';

type UpNextProps = {
  upNext: Dictionary<UpNextItem[]>;
  adlibUpNext: Dictionary<UpNextItem[]>;
  timestamp: number;
};

export const UpNext = memo(function UpNext({ upNext, adlibUpNext, timestamp }: UpNextProps) {
  const [activeUpNext, setActiveUpNext] = useState<Record<string, number>>({});
  const [activeAdlibUpNext, setActiveAdlibUpNext] = useState<Record<string, number>>({});
  const [prevTimestamp, setPrevTimestamp] = useState<number>(timestamp);

  useEffect(() => {
    // Detect if we've gone backwards in time (scrubbing/seeking backwards)
    const wentBackwards = timestamp < prevTimestamp;

    if (wentBackwards) {
      // Clear all future snapshots when going backwards
      setActiveUpNext((prev) => {
        const copy = { ...prev };
        Object.keys(copy).forEach((key) => {
          if (Number(key) > timestamp) {
            delete copy[key];
          }
        });
        return copy;
      });

      setActiveAdlibUpNext((prev) => {
        const copy = { ...prev };
        Object.keys(copy).forEach((key) => {
          if (Number(key) > timestamp) {
            delete copy[key];
          }
        });
        return copy;
      });
    }

    // Add new regular up next snapshot
    if (upNext[timestamp]) {
      setActiveUpNext((prev) => {
        const copy = { ...prev };
        copy[timestamp] = 0;

        // Clean up expired snapshots
        Object.keys(copy).forEach((key) => {
          if (Number(key) + copy[key] < timestamp) {
            delete copy[key];
          }
        });
        return copy;
      });
    }

    // Add new adlib up next snapshot
    if (adlibUpNext[timestamp]) {
      setActiveAdlibUpNext((prev) => {
        const copy = { ...prev };
        copy[timestamp] = 0;

        // Clean up expired snapshots
        Object.keys(copy).forEach((key) => {
          if (Number(key) + copy[key] < timestamp) {
            delete copy[key];
          }
        });
        return copy;
      });
    }

    setPrevTimestamp(timestamp);
  }, [timestamp, prevTimestamp, upNext, adlibUpNext]);

  // Collect all active items (deduplicated by name)
  const uniqueItems = useMemo(() => {
    const activeItems = Object.keys(activeUpNext).flatMap((key) => upNext[key] || []);
    return activeItems.filter((item, index, self) => self.findIndex((t) => t.name === item.name) === index);
  }, [activeUpNext, upNext]);

  const uniqueAdlibItems = useMemo(() => {
    const activeAdlibItems = Object.keys(activeAdlibUpNext).flatMap((key) => adlibUpNext[key] || []);
    return activeAdlibItems.filter(
      (item, index, self) => self.findIndex((t) => t.name === item.name) === index,
    );
  }, [activeAdlibUpNext, adlibUpNext]);

  // Don't render if nothing to show
  if (uniqueItems.length === 0 && uniqueAdlibItems.length === 0) {
    return null;
  }

  return (
    <div className="visualizer__up-next">
      {uniqueItems.length > 0 && (
        <div className="visualizer__up-next-section">
          <span className="visualizer__up-next-label">Up Next:</span>
          {uniqueItems.map((item, index) => (
            <span
              className="visualizer__up-next-badge"
              key={`${item.name}-${index}`}
              style={{ backgroundColor: item.color }}
            >
              {item.name}
            </span>
          ))}
        </div>
      )}

      {uniqueAdlibItems.length > 0 && (
        <div className="visualizer__up-next-section">
          <span className="visualizer__up-next-label">Adlib:</span>
          {uniqueAdlibItems.map((item, index) => (
            <span
              className="visualizer__up-next-badge"
              key={`${item.name}-${index}`}
              style={{ backgroundColor: item.color }}
            >
              {item.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
