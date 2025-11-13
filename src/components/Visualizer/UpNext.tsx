import { useEffect, useMemo, useState } from 'react';
import type { Dictionary } from 'types';
import { removeDuplicates } from 'utils';

type UpNextProps = {
  upNextSnapshots: Dictionary<string[]>;
  timestamp: number;
};

export function UpNext({ upNextSnapshots, timestamp }: UpNextProps) {
  const [activeSnapshots, setActiveUpNext] = useState<Record<string, number>>({});

  useEffect(() => {
    if (upNextSnapshots[timestamp]) {
      setActiveUpNext((prev) => {
        const copy = { ...prev };

        copy[timestamp] = 0;

        Object.keys(copy).forEach((key) => {
          if (Number(key) + copy[key] < timestamp) {
            delete copy[key];
          }
        });
        return copy;
      });
    }
  }, [timestamp]);

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
