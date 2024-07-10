import { Avatar } from 'antd';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
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
  const [barHeight, setHeight] = useState(0);
  const [boxRef, { width }] = useMeasure<HTMLDivElement>();

  const entryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (entryRef.current) {
      setHeight(entryRef.current.offsetHeight);
    }
  }, [entryRef]);

  return (
    <div className="bars-box" ref={boxRef}>
      {assignees.map((assignee, index, allAssignees) => {
        const { rank = -1, percentage = 0, active = false, duration = 0 } = snapshots?.[assignee.id] ?? {};

        return (
          <div
            key={assignee.id}
            className={clsx('bar', active && 'bar--active', rank < 0 && 'bar--not-started')}
            ref={index === 0 ? entryRef : null}
            style={{
              width,
              top: 0,
              transform: `translateY(${getTranslatePosition(barHeight, rank, allAssignees.length)}px)`,
            }}
          >
            <div className="bar__avatar">
              <Avatar
                src={assignee.id}
                style={{
                  border: `3px solid ${assignee.color}`,
                }}
              >
                {assignee.name[0]}
              </Avatar>
            </div>

            <div className="bar__data">
              <div className="bar__artist">
                <span className="bar__name">{assignee.name}</span>•
                <span className="bar__track">{assignee.track}</span>
              </div>
              <div className="bar__bar">
                <span
                  className="bar__progress"
                  style={{ width: `${percentage}%`, backgroundColor: assignee.color }}
                />
                <span className="bar__progress-gutter" />
              </div>
            </div>

            <pre className="bar__timestamp">{(duration / (1000 / RATE)).toFixed(1)}s</pre>
          </div>
        );
      })}
    </div>
  );
}
