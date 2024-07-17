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

export function AdlibsScroller({ assignees, timestamp, adlibsSnapshots, maxHeight }: AdlibsScrollerProps) {
  const [activeAdlibs, setActiveAdlibs] = useState<Record<string, number>>({});

  useEffect(() => {
    if (adlibsSnapshots[timestamp]) {
      console.log('THERE IS SNAPSHOT');
      setActiveAdlibs((prev) => {
        const copy = { ...prev };
        // copy[timestamp] = Math.ceil(adlibsSnapshots[timestamp]?.text.length / 2);
        copy[timestamp] = 40;
        console.log('COPY', copy);

        Object.keys(copy).forEach((key) => {
          if (Number(key) + copy[key] < timestamp) {
            console.log('deleting', key);
            delete copy[key];
          }
        });
        return copy;
      });
    }
  }, [timestamp]);

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
