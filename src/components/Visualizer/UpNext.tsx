import { useEffect, useMemo, useState } from 'react';
import type { Dictionary } from 'types';
import { removeDuplicates } from 'utils';

type UpNextProps = {
  upNextSnapshots: Dictionary<string[]>;
  timestamp: number;
};

export function UpNext({ upNextSnapshots, timestamp }: UpNextProps) {
  const [activeSnapshots, setActiveUpNext] = useState<Record<string, number>>({});
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
    }

    if (upNextSnapshots[timestamp]) {
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

    setPrevTimestamp(timestamp);
  }, [timestamp, prevTimestamp, upNextSnapshots]);

  const names = useMemo(
    () => removeDuplicates(Object.keys(activeSnapshots).map((key) => upNextSnapshots[key])).join(', '),
    [activeSnapshots, upNextSnapshots],
  );

  return (
    <div className="visualizer__up-next">
      <span className="visualizer__up-next-names" key={names}>
        Up Next: {names}
      </span>
    </div>
  );
}
