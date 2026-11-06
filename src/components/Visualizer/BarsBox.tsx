import { ArtistBar } from '@components/Artist';
import { type AssigneeSnapshot, RATE } from '@services/DistributionVisualizerProvider';
import type { Artist, Dictionary } from '@types';
import clsx from 'clsx';
import { memo } from 'react';
import { useMeasure } from 'react-use';

type BarsBoxProps = {
  assignees: Artist[];
  snapshots: Dictionary<AssigneeSnapshot>;
  /** Smaller fixed-height rows (used on mobile to fit many singers) */
  compact?: boolean;
};

export const COMPACT_BAR_ROW_HEIGHT = 28;

const getTranslatePosition = (height: number, pos: number, assigneeCount: number) => {
  if (pos < 0) {
    return assigneeCount * height;
  }
  return Math.min(height, 40) * pos + 6;
};

export const BarsBox = memo(function BarsBox({ assignees, snapshots, compact = false }: BarsBoxProps) {
  const [boxRef, { width }] = useMeasure<HTMLDivElement>();
  const [entryRef, { height }] = useMeasure<HTMLDivElement>();

  const barHeight = height || 48;

  return (
    <div
      className={clsx('bars-box', compact && 'bars-box--compact')}
      ref={boxRef}
      style={{
        height: compact ? COMPACT_BAR_ROW_HEIGHT * assignees.length + 8 : (barHeight + 8) * assignees.length,
      }}
    >
      {assignees.map((assignee, index, allAssignees) => {
        const {
          rank = -1,
          percentage = 0,
          fullPercentage = 0,
          active = false,
          fullDuration = 0,
          done,
        } = snapshots?.[assignee.id] ?? {};

        return (
          <div key={assignee.id} ref={index === 0 ? entryRef : null}>
            <ArtistBar
              active={active}
              artist={assignee}
              done={done}
              fullProgress={fullPercentage}
              idle={rank < 0}
              progress={percentage}
              style={{
                width,
                top: 0,
                // TODO: Fix proportion
                transform: `translateY(${
                  compact
                    ? (rank < 0 ? allAssignees.length : rank) * COMPACT_BAR_ROW_HEIGHT
                    : getTranslatePosition(barHeight, rank, allAssignees.length) * 1.25
                }px)`,
              }}
              value={`${(fullDuration / (1000 / RATE)).toFixed(1)}s`}
            />
          </div>
        );
      })}
    </div>
  );
});
