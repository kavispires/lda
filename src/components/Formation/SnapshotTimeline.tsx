import type { FormationSnapshot } from '@types';
import { formatFormationTime } from '@utils/formation';
import { useRef } from 'react';

export function SnapshotTimeline({
  snapshots,
  selectedId,
  startAt,
  endAt,
  currentTime,
  onSelect,
  onRetime,
  disabled,
}: {
  snapshots: FormationSnapshot[];
  selectedId: string;
  startAt: number;
  endAt: number;
  currentTime: number;
  onSelect: (id: string) => void;
  onRetime: (id: string, timestamp: number) => void;
  disabled?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; x: number } | null>(null);
  const duration = endAt - startAt;
  const percent = (time: number) =>
    duration > 0 ? Math.max(0, Math.min(100, ((time - startAt) / duration) * 100)) : 0;
  return (
    <div aria-label="Formation snapshot timeline" className="snapshot-timeline" ref={track} role="group">
      <span className="snapshot-timeline__playhead" style={{ left: `${percent(currentTime)}%` }} />
      {snapshots.map((snapshot, index) => (
        <button
          aria-label={`Snapshot ${index + 1} at ${formatFormationTime(snapshot.timestamp)}`}
          aria-pressed={selectedId === snapshot.id}
          className="snapshot-timeline__marker"
          disabled={disabled}
          key={snapshot.id}
          onClick={() => onSelect(snapshot.id)}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            drag.current = { id: snapshot.id, x: event.clientX };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            const current = drag.current;
            drag.current = null;
            const bounds = track.current?.getBoundingClientRect();
            if (
              current &&
              bounds &&
              Math.abs(event.clientX - current.x) > 3 &&
              bounds.width &&
              duration > 0
            ) {
              const time = Math.round(startAt + ((event.clientX - bounds.left) / bounds.width) * duration);
              onRetime(current.id, time);
            }
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          style={{ left: `${percent(snapshot.timestamp)}%` }}
          title={`${index + 1}: ${formatFormationTime(snapshot.timestamp)} (drag to retime)`}
          type="button"
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}
