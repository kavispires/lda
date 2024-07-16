import { useVideoControls } from 'hooks/useVideoControls';
import { useVisualizerMeasurements, UseVisualizerMeasurementsResult } from 'hooks/useVisualizerMeasurements';
import { cloneDeep, orderBy } from 'lodash';
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { useLocalStorage, useToggle } from 'react-use';
import { Artist, Dictionary, Distribution, Song, UID } from 'types';
import { distributor } from 'utils';
import { ALL_ID, NONE_ID } from 'utils/constants';

type DistributionVisualizerContextType = {
  fullScreenMode: boolean;
  toggleFullScreenMode: (nextValue?: any) => void;
  displayMode: 'regular' | 'barsOnly' | 'lyricsOnly';
  setDisplayMode: React.Dispatch<React.SetStateAction<'regular' | 'barsOnly' | 'lyricsOnly'>>;
  fontRatio: number | undefined;
  setFontRatio: React.Dispatch<React.SetStateAction<number | undefined>>;
  showDismissibleLines: boolean;
  setShowDismissibleLines: (nextValue?: any) => void;
  videoControls: ReturnType<typeof useVideoControls>;
  song: Song;
  assignees: Artist[];
  measurements: UseVisualizerMeasurementsResult;
  barSnapshots: Dictionary<Dictionary<AssigneeSnapshot>>;
};

const DistributionVisualizerContext = createContext<DistributionVisualizerContextType | undefined>(undefined);

type DistributionVisualizerProviderProps = {
  children: ReactNode;
  song: Song;
  distribution: Distribution;
};

export const DistributionVisualizerProvider = ({
  song,
  distribution,
  children,
}: DistributionVisualizerProviderProps) => {
  // View controls
  const [fullScreenMode, toggleFullScreenMode] = useToggle(false);
  const [displayMode, setDisplayMode] = useState<'regular' | 'barsOnly' | 'lyricsOnly'>('regular');
  // UI Adjustments
  const [fontRatio, setFontRatio] = useLocalStorage('DISTRIBUTION_FONT_RATIO', 1);
  const [showDismissibleLines, setShowDismissibleLines] = useToggle(false);
  // Measurements
  const [ref, measurements] = useVisualizerMeasurements(fullScreenMode);

  const videoControls = useVideoControls({ startAt: song.startAt, endAt: song.endAt });

  const assignees = useMemo(() => {
    return orderBy(Object.values(distribution.assignees), 'name');
  }, [distribution]);

  const barSnapshots = useMemo(() => {
    return buildBarSnapshots(distribution, song);
  }, [distribution, song]);

  return (
    <DistributionVisualizerContext.Provider
      value={{
        fullScreenMode,
        toggleFullScreenMode,
        displayMode,
        setDisplayMode,
        fontRatio,
        setFontRatio,
        showDismissibleLines,
        setShowDismissibleLines,
        videoControls,
        song,
        measurements,
        assignees,
        barSnapshots,
      }}
    >
      <div ref={ref} style={{ height: measurements.container.height }}>
        {children}
      </div>
    </DistributionVisualizerContext.Provider>
  );
};

export const useDistributionVisualizerContext = () => {
  const context = useContext(DistributionVisualizerContext);

  if (!context) {
    throw new Error('useDistributionVisualizerContext must be used within a DistributionVisualizerProvider');
  }

  return context;
};

export type AssigneeSnapshot = {
  id: UID;
  rank: number;
  active: boolean;
  duration: number;
  percentage: number;
};

export const RATE = 100; // 1 second

/**
 * For each unit in the in the song, from startAt to endAt, create an AssigneeSnapshot snapshot for each assignee
 * @param distribution
 * @param song
 * @returns
 */
const buildBarSnapshots = (distribution: Distribution, song: Song) => {
  // For every unit on each part duration, create an entry
  const partsInUnits: Dictionary<UID[]> = {};
  distributor.getAllParts(song).forEach((part) => {
    const startUnit = Math.floor(part.startTime / RATE);
    const endUnit = Math.ceil(part.endTime / RATE);

    for (let i = startUnit; i < endUnit; i++) {
      if (!partsInUnits[i]) {
        partsInUnits[i] = [];
      }
      partsInUnits[i].push(part.id);
    }
  });

  // Max value for assignee duration to use in percentage calculation
  const maxAssigneeDuration = Math.round(distribution.maxAssigneeDuration / RATE);
  // List of all assignees
  const assigneesIdsList = Object.keys(distribution.assignees);

  // Create a reference snapshot for each assignee
  let previousAssigneeSnapshot: Dictionary<AssigneeSnapshot> = Object.values(distribution.assignees).reduce(
    (acc: Dictionary<AssigneeSnapshot>, assignee) => {
      if (![ALL_ID, NONE_ID].includes(assignee.id)) {
        acc[assignee.id] = {
          id: assignee.id,
          rank: -1,
          active: false,
          duration: 0,
          percentage: 0,
        };
      }
      return acc;
    },
    {}
  );

  const snapshotsPerUnit: Dictionary<Dictionary<AssigneeSnapshot>> = {
    0: cloneDeep(previousAssigneeSnapshot),
  };

  for (let unit = Math.floor(song.startAt / RATE); unit < Math.ceil(song.endAt / RATE); unit++) {
    const partsIds = partsInUnits?.[unit] || [];

    snapshotsPerUnit[unit] = previousAssigneeSnapshot;

    if (partsIds.length === 0) {
      assigneesIdsList.forEach((assigneeId) => {
        if (snapshotsPerUnit[unit][assigneeId].active) {
          const snapshot = { ...snapshotsPerUnit[unit][assigneeId] };
          snapshot.active = false;
          snapshotsPerUnit[unit][assigneeId] = snapshot;
        }
      });
      continue;
    }

    const assigneesInUnit: UID[] = [];

    // For each part, activate assignees
    partsIds.forEach((partId) => {
      const assigneeIds = distribution.mapping[partId];
      const cleanupAssigneesIds = assigneeIds.filter((assigneeId) => ![ALL_ID, NONE_ID].includes(assigneeId));
      assigneesInUnit.push(...cleanupAssigneesIds);

      cleanupAssigneesIds.forEach((assigneeId) => {
        const snapshot = { ...snapshotsPerUnit[unit][assigneeId] };

        snapshot.active = true;
        snapshot.duration += 1;
        snapshot.percentage = Math.floor((snapshot.duration / maxAssigneeDuration) * 100);
        snapshotsPerUnit[unit][assigneeId] = snapshot;
      });
    });
    // Also deactivate assignees that are not in the unit
    assigneesIdsList.forEach((assigneeId) => {
      if (!assigneesInUnit.includes(assigneeId)) {
        if (snapshotsPerUnit[unit][assigneeId].active) {
          const snapshot = { ...snapshotsPerUnit[unit][assigneeId] };
          snapshot.active = false;
          snapshotsPerUnit[unit][assigneeId] = snapshot;
        }
      }
    });

    // Sort assignees by duration (determining their rank)
    const sortedAssignees = orderBy(
      Object.values(snapshotsPerUnit[unit]),
      ['duration'],
      ['desc']
    ) as AssigneeSnapshot[];

    sortedAssignees.forEach((assignee, index) => {
      if (assignee.duration > 0 && index !== snapshotsPerUnit[unit][assignee.id].rank) {
        const snapshot = { ...snapshotsPerUnit[unit][assignee.id] };
        snapshot.rank = index;
        snapshotsPerUnit[unit][assignee.id] = snapshot;
      }
    });

    previousAssigneeSnapshot = cloneDeep(snapshotsPerUnit[unit]);
  }

  return snapshotsPerUnit;
};
