import { useVideoControls } from 'hooks/useVideoControls';
import { useVisualizerMeasurements, UseVisualizerMeasurementsResult } from 'hooks/useVisualizerMeasurements';
import { cloneDeep, orderBy, sortBy } from 'lodash';
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { useLocalStorage, useToggle } from 'react-use';
import { Artist, Dictionary, Distribution, Song, UID } from 'types';
import { distributor, removeDuplicates } from 'utils';
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
  assigneesDict: Dictionary<Artist>;
  measurements: UseVisualizerMeasurementsResult;
  barSnapshots: Dictionary<Dictionary<AssigneeSnapshot>>;
  adlibsSnapshots: Dictionary<LyricSnapshot>;
  lyricsSnapshots: Dictionary<LyricSnapshot>;
  upNextSnapshots: Dictionary<string[]>;
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

  const barSnapshots = useMemo(() => buildBarSnapshots(distribution, song), [distribution, song]);

  const { adlibsSnapshots, lyricsSnapshots } = useMemo(
    () => buildLyricsSnapshots(distribution, song),
    [distribution, song]
  );

  const upNextSnapshots = useMemo(() => buildUpNextSnapshots(distribution, song), [distribution, song]);

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
        assigneesDict: distribution.assignees,
        barSnapshots,
        adlibsSnapshots,
        lyricsSnapshots,
        upNextSnapshots,
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
  fullDuration: number;
  fullPercentage: number;
  done?: boolean;
};

/**
 * The rate at which the visualizer updates (1 second)
 */
export const RATE = 100;

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
  const maxAssigneeDuration = Math.round(distribution.maxAssigneeDuration / RATE) + 1;
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
          fullDuration: 0,
          percentage: 0,
          fullPercentage: 0,
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

    // Just use the previousAssignee
    snapshotsPerUnit[unit] = previousAssigneeSnapshot;

    if (partsIds.length === 0) {
      // Deactivate all assignees, if necessary
      const isAnyActive = assigneesIdsList.some((assigneeId) => snapshotsPerUnit[unit][assigneeId].active);

      if (isAnyActive) {
        assigneesIdsList.forEach((assigneeId) => {
          if (snapshotsPerUnit[unit][assigneeId].active) {
            const snapshot = { ...snapshotsPerUnit[unit][assigneeId] };
            snapshot.active = false;
            snapshotsPerUnit[unit][assigneeId] = snapshot;
          }
        });
        previousAssigneeSnapshot = cloneDeep(snapshotsPerUnit[unit]);
      }

      continue;
    }

    snapshotsPerUnit[unit] = cloneDeep(previousAssigneeSnapshot);

    const assigneesInUnit: UID[] = [];

    // For each part, activate assignees
    partsIds.forEach((partId) => {
      const assigneeIds = distribution.mapping[partId];
      const cleanupAssigneesIds = assigneeIds.filter((assigneeId) => ![ALL_ID, NONE_ID].includes(assigneeId));
      assigneesInUnit.push(...cleanupAssigneesIds);
      const part = distributor.getPart(partId, song);
      const line = distributor.getLine(part.lineId, song);

      cleanupAssigneesIds.forEach((assigneeId) => {
        const snapshot = { ...snapshotsPerUnit[unit][assigneeId] };

        if (!line.adlib && !line.dismissible) {
          snapshot.duration += 1;
          snapshot.percentage = Math.floor((snapshot.duration / maxAssigneeDuration) * 100);
        }

        snapshot.active = true;
        snapshot.fullDuration += 1;
        snapshot.fullPercentage = Math.floor((snapshot.fullDuration / maxAssigneeDuration) * 100);
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
      ['fullDuration'],
      ['desc']
    ) as AssigneeSnapshot[];

    sortedAssignees.forEach((assignee, index) => {
      if (assignee.fullDuration > 0 && index !== snapshotsPerUnit[unit][assignee.id].rank) {
        const snapshot = { ...snapshotsPerUnit[unit][assignee.id] };
        snapshot.rank = index;
        snapshotsPerUnit[unit][assignee.id] = snapshot;
      }
    });

    previousAssigneeSnapshot = cloneDeep(snapshotsPerUnit[unit]);
  }

  const reverseList = sortBy(Object.keys(snapshotsPerUnit).map((timestamp) => Number(timestamp))).reverse();
  const verifiedDone: UID[] = [];

  for (let i = 0; i < reverseList.length - 1; i++) {
    const currentTimestamp = reverseList[i];
    const nextTimestamp = reverseList[i + 1];
    assigneesIdsList.forEach((assigneeId) => {
      if (!verifiedDone.includes(assigneeId)) {
        snapshotsPerUnit[currentTimestamp][assigneeId].done = true;

        if (snapshotsPerUnit[nextTimestamp][assigneeId].active) {
          verifiedDone.push(assigneeId);
        }
      }
    });

    if (verifiedDone.length === assigneesIdsList.length) {
      break;
    }
  }

  return snapshotsPerUnit;
};

export type LyricSnapshot = {
  id: UID;
  text: string[];
  assigneesIds: UID[];
  colors: string[];
  startTimes: number[];
};

const buildLyricsSnapshots = (distribution: Distribution, song: Song) => {
  const lyricsSnapshots: Dictionary<LyricSnapshot> = {};
  const adlibsSnapshots: Dictionary<LyricSnapshot> = {};

  let latestTimestamp = 0;
  let latestKey = '';
  // A snapshot is comprised of lines with the same assignees

  // If the line has same assignees as previous line, append

  distributor.getAllLines(song).forEach((line) => {
    if (line.dismissible) {
      return;
    }

    const { startTime, text, section } = distributor.getLineSummary(line.id, song);
    const timestamp = Math.floor(startTime / RATE);

    const assigneesIds = removeDuplicates(line.partsIds.map((partId) => distribution.mapping[partId]).flat());
    // TODO: Check if the parts have the exact same assignees

    const colors = assigneesIds
      .map((assigneeId) =>
        [ALL_ID, NONE_ID].includes(assigneeId) ? '#f1f1f1' : distribution.assignees[assigneeId].color
      )
      .join(', ');

    if (line.adlib) {
      const cleanedText = text.replace(/^\(|\)$/g, '');

      adlibsSnapshots[timestamp] = {
        id: line.id,
        text: [cleanedText],
        assigneesIds: assigneesIds,
        colors: [colors],
        startTimes: [startTime / RATE],
      };
      return;
    }

    if (lyricsSnapshots[timestamp]) {
      console.warn('Duplicate timestamp', timestamp);
    }

    const key = `${sortBy(assigneesIds.filter((v) => v !== 'ALL')).join('::')}+${section.id}`;

    if (latestKey === key) {
      lyricsSnapshots[latestTimestamp].text.push(text);
      lyricsSnapshots[latestTimestamp].colors.push(colors);
      lyricsSnapshots[latestTimestamp].startTimes.push(startTime / RATE);
      return;
    }

    latestKey = key;
    latestTimestamp = timestamp;
    lyricsSnapshots[timestamp] = {
      id: line.id,
      text: [text],
      assigneesIds: assigneesIds,
      colors: [colors],
      startTimes: [startTime / RATE],
    };
  });

  // For every lyric snapshot with text length of 8, 10, 12, split it in half
  Object.keys(lyricsSnapshots).forEach((timestamp) => {
    const snapshot = lyricsSnapshots[timestamp];
    const textLength = snapshot.text.length;

    if ([6, 10, 12].includes(textLength)) {
      const half = Math.floor(textLength / 2);

      const firstHalfSnapshot = {
        id: snapshot.id,
        text: snapshot.text.slice(0, half),
        assigneesIds: snapshot.assigneesIds,
        colors: snapshot.colors.slice(0, half),
        startTimes: snapshot.startTimes.slice(0, half),
      };

      const secondHalfSnapshot = {
        id: snapshot.id,
        text: snapshot.text.slice(half),
        assigneesIds: snapshot.assigneesIds,
        colors: snapshot.colors.slice(half),
        startTimes: snapshot.startTimes.slice(half),
      };

      lyricsSnapshots[timestamp] = firstHalfSnapshot;
      lyricsSnapshots[Math.floor(secondHalfSnapshot.startTimes[0])] = secondHalfSnapshot;
    }
  });

  return {
    adlibsSnapshots,
    lyricsSnapshots,
  };
};

const buildUpNextSnapshots = (distribution: Distribution, song: Song) => {
  const upNextSnapshots: Dictionary<string[]> = {};
  let latestTimestamp = 0;
  let latestKey = '';
  // A snapshot is comprised of members 2 seconds before they start singing
  const THRESHOLD = RATE * 12;

  distributor.getAllLines(song).forEach((line) => {
    if (line.dismissible) {
      return;
    }

    const { startTime } = distributor.getLineSummary(line.id, song);
    const timestamp = Math.floor(Math.max(startTime - THRESHOLD, 0) / RATE);

    const assigneesIds = removeDuplicates(line.partsIds.map((partId) => distribution.mapping[partId]).flat());
    const assigneesNames = assigneesIds
      .map((assigneeId) => {
        if ([ALL_ID, NONE_ID].includes(assigneeId)) {
          return '';
        }
        if (distribution.assignees[assigneeId]?.name) {
          return distribution.assignees[assigneeId].name;
        }
        console.log('Unknown assignee', assigneeId);
        return 'Unknown';
      })
      .filter(Boolean);

    const key = sortBy(assigneesIds).join('::');

    if (latestKey === key) {
      upNextSnapshots[latestTimestamp] = removeDuplicates([
        ...upNextSnapshots[latestTimestamp],
        ...assigneesNames,
      ]);
      return;
    }

    latestKey = key;
    latestTimestamp = timestamp;
    upNextSnapshots[latestTimestamp] = assigneesNames;
  });

  // console.log(upNextSnapshots);

  return upNextSnapshots;
};
