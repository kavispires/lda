import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { LyricSnapshot } from 'services/DistributionVisualizerProvider';
import { Dictionary, Distribution } from 'types';

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
 * @param props - The properties object.
 * @param props.assignees - A record of assignees.
 * @param props.timestamp - The current timestamp used to determine active adlibs.
 * @param props.adlibsSnapshots - A record of adlib snapshots keyed by timestamp.
 * @param  props.maxHeight - The maximum height of the scrollable container.
 * @returns The rendered AdlibsScroller component.
 */
export function AdlibsScroller({ assignees, timestamp, adlibsSnapshots, maxHeight }: AdlibsScrollerProps) {
  const [activeAdlibs, setActiveAdlibs] = useState<Record<string, number>>({});

  /**
   * Effect hook that updates the `activeAdlibs` state based on the current `timestamp`.
   *
   * When the `timestamp` changes, this effect checks if there is a corresponding snapshot
   * in `adlibsSnapshots`. If a snapshot exists, it updates the `activeAdlibs` state by
   * adding the current `timestamp` with a fixed value of 40. It also removes any entries
   * from `activeAdlibs` where the sum of the key and its value is less than the current
   * `timestamp`.
   *
   * @param {number} timestamp - The current timestamp used to determine active adlibs.
   */
  useEffect(() => {
    if (adlibsSnapshots[timestamp]) {
      setActiveAdlibs((prev) => {
        const copy = { ...prev };
        // copy[timestamp] = Math.ceil(adlibsSnapshots[timestamp]?.text.length / 2);
        copy[timestamp] = 40;

        Object.keys(copy).forEach((key) => {
          if (Number(key) + copy[key] < timestamp) {
            delete copy[key];
          }
        });
        return copy;
      });
    }
  }, [timestamp]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="visualizer__adlibs" style={{ maxHeight }}>
      {Object.keys(activeAdlibs).map((key) => {
        const snapshot = adlibsSnapshots[key];

        return (
          <div key={key} className={clsx('adlib-box-container', 'adlib-box-container--active')}>
            <AdlibBox snapshot={snapshot} assignees={assignees} />
          </div>
        );
      })}
    </div>
  );
}
