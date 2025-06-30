import type React from 'react';
import { useState } from 'react';
import './Stage.scss'; // Create CSS file for styling
import { motion } from 'framer-motion'; // For animations

type Dancer = {
  id: string;
  name: string;
  position: { x: number; y: number };
};

type Snapshot = {
  time: number; // in seconds
  dancers: Dancer[];
};

type Props = {
  initialTimeline: Snapshot[];
};

const DancePerformance: React.FC<Props> = ({ initialTimeline }) => {
  const [timeline, setTimeline] = useState<Snapshot[]>(initialTimeline);
  const [currentSnapshotIndex, setCurrentSnapshotIndex] = useState(0);

  const currentSnapshot = timeline[currentSnapshotIndex];
  const key = JSON.stringify(currentSnapshot);

  const handleNext = () => {
    if (currentSnapshotIndex < timeline.length - 1) {
      setCurrentSnapshotIndex(currentSnapshotIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSnapshotIndex > 0) {
      setCurrentSnapshotIndex(currentSnapshotIndex - 1);
    }
  };

  const handleDragEnd = (
    e: MouseEvent | TouchEvent | PointerEvent,
    dancerId: string,
    gridX: number,
    gridY: number,
  ) => {
    const updatedSnapshot = {
      ...currentSnapshot,
      dancers: currentSnapshot.dancers.map((dancer) =>
        dancer.id === dancerId ? { ...dancer, position: { x: gridX, y: gridY } } : dancer,
      ),
    };

    const updatedTimeline = [...timeline];
    updatedTimeline[currentSnapshotIndex] = updatedSnapshot;
    setTimeline(updatedTimeline);
  };

  return (
    <div className="dance-performance">
      {/* Stage Grid */}
      <div className="stage" key={key}>
        {Array.from({ length: 27 }).map((_, x) =>
          Array.from({ length: 19 }).map((_, y) => (
            <div
              key={`${x}-${y}`}
              className="grid-cell"
              style={{
                gridColumn: x + 1,
                gridRow: y + 1,
              }}
            >
              {/* Render Dancers */}
              {currentSnapshot.dancers
                .filter((dancer) => dancer.position.x === x && dancer.position.y === y)
                .map((dancer) => (
                  <motion.div
                    key={dancer.id}
                    className="dancer"
                    drag
                    dragMomentum={false}
                    onDragEnd={(e, info) => handleDragEnd(e, dancer.id, x, y)}
                    animate={{
                      x: dancer.position.x * 30, // Assuming each grid cell is 30px wide
                      y: dancer.position.y * 30, // Assuming each grid cell is 30px tall
                    }}
                    transition={{
                      duration: 0.5,
                    }}
                  >
                    {dancer.name}
                  </motion.div>
                ))}
            </div>
          )),
        )}
      </div>

      {/* Timeline */}
      <div className="timeline">
        {timeline.map((snapshot, index) => (
          <button
            type="button"
            key={snapshot.time}
            onClick={() => setCurrentSnapshotIndex(index)}
            className={index === currentSnapshotIndex ? 'active' : ''}
          >
            {snapshot.time}s
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="controls">
        <button type="button" onClick={handlePrevious} disabled={currentSnapshotIndex === 0}>
          Previous
        </button>
        <button type="button" onClick={handleNext} disabled={currentSnapshotIndex === timeline.length - 1}>
          Next
        </button>
      </div>
    </div>
  );
};

export function Demo() {
  const initialTimeline = [
    {
      time: 0,
      dancers: [
        { id: '1', name: 'Alice', position: { x: 0, y: 0 } },
        { id: '2', name: 'Bob', position: { x: 5, y: 5 } },
        { id: '3', name: 'Charlie', position: { x: 10, y: 10 } },
      ],
    },
    {
      time: 5,
      dancers: [
        { id: '1', name: 'Alice', position: { x: 2, y: 2 } },
        { id: '2', name: 'Bob', position: { x: 7, y: 7 } },
        { id: '3', name: 'Charlie', position: { x: 12, y: 12 } },
      ],
    },
    {
      time: 10,
      dancers: [
        { id: '1', name: 'Alice', position: { x: 4, y: 4 } },
        { id: '2', name: 'Bob', position: { x: 9, y: 9 } },
        { id: '3', name: 'Charlie', position: { x: 14, y: 14 } },
      ],
    },
  ];

  return (
    <div>
      <h1>Dance Performance</h1>
      <DancePerformance initialTimeline={initialTimeline} />
    </div>
  );
}
