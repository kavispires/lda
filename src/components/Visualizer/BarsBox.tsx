import { ArtistBar } from 'components/Artist';
import { useMeasure } from 'react-use';
import { AssigneeSnapshot, RATE } from 'services/DistributionVisualizerProvider';
import { Artist, Dictionary } from 'types';

type BarsBoxProps = {
  assignees: Artist[];
  snapshots: Dictionary<AssigneeSnapshot>;
};

const getTranslatePosition = (height: number, pos: number, assigneeCount: number) => {
  if (pos < 0) {
    return assigneeCount * height;
  }
  return Math.min(height, 40) * pos + 6;
};

export function BarsBox({ assignees, snapshots }: BarsBoxProps) {
  const [boxRef, { width }] = useMeasure<HTMLDivElement>();
  const [entryRef, { height }] = useMeasure<HTMLDivElement>();

  const barHeight = height || 48;

  return (
    <div className="bars-box" ref={boxRef}>
      {assignees.map((assignee, index, allAssignees) => {
        const { rank = -1, percentage = 0, active = false, duration = 0 } = snapshots?.[assignee.id] ?? {};

        return (
          <div key={assignee.id} ref={index === 0 ? entryRef : null}>
            <ArtistBar
              artist={assignee}
              active={active}
              idle={rank < 0}
              progress={percentage}
              value={`${(duration / (1000 / RATE)).toFixed(1)}s`}
              style={{
                width,
                top: 0,
                transform: `translateY(${getTranslatePosition(barHeight, rank, allAssignees.length)}px)`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
