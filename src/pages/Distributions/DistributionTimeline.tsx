import type { Distribution, Song } from '@types';
import { Alert } from 'antd';
import { memo, useMemo } from 'react';
import { buildDistributionTimeline } from './distribution-timeline';

type DistributionTimelineProps = {
  song: Song;
  mapping: Distribution['mapping'];
  assignees: Distribution['assignees'];
};

export const DistributionTimeline = memo(function DistributionTimeline({
  song,
  mapping,
  assignees,
}: DistributionTimelineProps) {
  const { segments, error } = useMemo(
    () => buildDistributionTimeline(song, mapping, assignees),
    [song, mapping, assignees],
  );

  if (error) return <Alert showIcon title={error} type="warning" />;

  return (
    <div aria-label="Distribution timeline" className="distribution-timeline" role="group">
      {segments.map((segment) => {
        const label = `${segment.names.join(', ') || 'Unassigned / instrumental'}: ${(
          segment.startTime / 1000
        ).toFixed(2)}-${(segment.endTime / 1000).toFixed(2)}s`;
        return (
          <div
            aria-label={label}
            className="distribution-timeline__segment"
            key={segment.startTime}
            role="img"
            style={{
              left: `${segment.startPercent}%`,
              width: `${segment.widthPercent}%`,
            }}
            title={label}
          >
            {segment.colors.map((color, index) => (
              <span
                aria-hidden="true"
                className="distribution-timeline__singer"
                key={segment.assigneeIds[index]}
                style={{ background: color }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
});
