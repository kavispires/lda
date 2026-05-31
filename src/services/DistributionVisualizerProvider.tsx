import { useVideoControls } from 'hooks/useVideoControls';
import {
  type UseVisualizerMeasurementsResult,
  useVisualizerMeasurements,
} from 'hooks/useVisualizerMeasurements';
import { keyBy, orderBy, sortBy } from 'lodash';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { useLocalStorage, useToggle } from 'react-use';
import type { Artist, Dictionary, Distribution, Song, UID } from 'types';
import { distributor, removeDuplicates } from 'utils';
import { ALL_ID, NONE_ID } from 'utils/constants';

/**
 * Tracks whether a distribution is in sync with its song's parts
 * Used to detect when song parts have been added/removed and distribution needs updating
 */
export type DistributionFreshness = {
  outdated: boolean; // Whether the distribution has missing or extra parts
  missingParts: UID[]; // Parts in the song that aren't mapped in the distribution
  extraParts: UID[]; // Parts in the distribution that no longer exist in the song
};

/**
 * Context type for the Distribution Visualizer
 * Provides all state and controls needed to render and interact with the distribution visualization
 */
type DistributionVisualizerContextType = {
  // View mode controls
  fullScreenMode: boolean;
  toggleFullScreenMode: (nextValue?: any) => void;
  displayMode: 'regular' | 'barsOnly' | 'lyricsOnly';
  setDisplayMode: React.Dispatch<React.SetStateAction<'regular' | 'barsOnly' | 'lyricsOnly'>>;
  // UI adjustments
  fontRatio: number | undefined;
  setFontRatio: React.Dispatch<React.SetStateAction<number | undefined>>;
  showDismissibleLines: boolean;
  setShowDismissibleLines: (nextValue?: any) => void;
  // Video playback controls
  videoControls: ReturnType<typeof useVideoControls>;
  // Core data
  song: Song;
  assignees: Artist[]; // Ordered list of artists
  assigneesDict: Dictionary<Artist>; // Artist lookup by ID
  // Layout measurements
  measurements: UseVisualizerMeasurementsResult;
  // Time-based snapshots for visualization (keyed by timestamp)
  barSnapshots: Dictionary<Dictionary<AssigneeSnapshot>>; // Artist activity and statistics per timestamp
  adlibsSnapshots: Dictionary<LyricSnapshot>; // Ad-lib lyrics per timestamp
  lyricsSnapshots: Dictionary<LyricSnapshot>; // Main lyrics per timestamp
  upNextSnapshots: Dictionary<string[]>; // Upcoming singers per timestamp
  // Distribution validation
  freshness: DistributionFreshness;
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
  // View mode controls for different visualization displays
  const [fullScreenMode, toggleFullScreenMode] = useToggle(false);
  const [displayMode, setDisplayMode] = useState<'regular' | 'barsOnly' | 'lyricsOnly'>('regular');

  // UI adjustments (font ratio is persisted to localStorage)
  const [fontRatio, setFontRatio] = useLocalStorage('DISTRIBUTION_FONT_RATIO', 1);
  const [showDismissibleLines, setShowDismissibleLines] = useToggle(false);

  // Container measurements for responsive layout
  const [ref, measurements] = useVisualizerMeasurements(fullScreenMode);

  const videoControls = useVideoControls({ startAt: song.startAt, endAt: song.endAt });

  // Compute all visualization data (memoized to prevent unnecessary recalculations)
  // This generates time-based snapshots for bars, lyrics, and upcoming singers
  const { assignees, barSnapshots, adlibsSnapshots, lyricsSnapshots, upNextSnapshots, freshness } =
    useMemo(() => {
      const { adlibsSnapshots, lyricsSnapshots } = buildLyricsSnapshots(distribution, song);

      return {
        assignees: orderBy(Object.values(distribution.assignees), 'name'),
        barSnapshots: buildBarSnapshots(distribution, song), // Artist activity over time
        adlibsSnapshots, // Ad-lib lyrics
        lyricsSnapshots, // Main lyrics
        upNextSnapshots: buildUpNextSnapshots(distribution, song), // Preview of upcoming singers
        freshness: verifyDistributionFreshness(song, distribution), // Validation status
      };
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
        assigneesDict: distribution.assignees,
        barSnapshots,
        adlibsSnapshots,
        lyricsSnapshots,
        upNextSnapshots,
        freshness,
      }}
    >
      <div ref={ref} style={{ height: measurements.container.height, fontSize: `${18}px` }}>
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

/**
 * Represents an artist's state at a specific moment in time
 * Used to render the distribution bars showing singing time and activity
 */
export type AssigneeSnapshot = {
  id: UID;
  rank: number; // Position in leaderboard (sorted by singing time)
  active: boolean; // Whether currently singing
  duration: number; // Singing time in units (excluding adlibs/dismissible)
  percentage: number; // Percentage of total song (excluding adlibs/dismissible)
  fullDuration: number; // Total singing time including all parts
  fullPercentage: number; // Percentage including all parts
  done?: boolean; // Whether this artist has finished all their parts
};

/**
 * The rate at which the visualizer updates in milliseconds (100ms = 0.1 seconds)
 * This determines the granularity of the timeline snapshots
 */
export const RATE = 100;

/**
 * Builds time-based snapshots of each artist's activity throughout the song
 * Creates a snapshot for each time unit showing who's singing, their accumulated time, and rankings
 * @param distribution - The distribution mapping parts to artists
 * @param song - The song with all its parts and timing information
 * @returns Dictionary of snapshots keyed by time unit, each containing a snapshot per artist
 */
const buildBarSnapshots = (distribution: Distribution, song: Song) => {
  // Step 1: Map each time unit to the parts that are active during that unit
  const partsInUnits: Dictionary<UID[]> = {};
  // For each part in the song, calculate which time units it spans
  distributor.getAllParts(song).forEach((part) => {
    const startUnit = Math.floor(part.startTime / RATE);
    const endUnit = Math.ceil(part.endTime / RATE);

    // Add this part's ID to every time unit it overlaps
    for (let i = startUnit; i < endUnit; i++) {
      if (!partsInUnits[i]) {
        partsInUnits[i] = [];
      }
      partsInUnits[i].push(part.id);
    }
  });

  // Step 2: Calculate the maximum duration for percentage calculations
  const maxAssigneeDuration = Math.round(distribution.maxAssigneeDuration / RATE) + 1;

  // Get list of all assignee IDs for iteration
  const assigneesIdsList = Object.keys(distribution.assignees);

  // Step 3: Initialize baseline snapshot with all artists at zero
  // This will be cloned and updated for each time unit
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
    {},
  );

  // Storage for all snapshots indexed by time unit
  const snapshotsPerUnit: Dictionary<Dictionary<AssigneeSnapshot>> = {
    0: structuredClone(previousAssigneeSnapshot),
  };

  // Step 4: Iterate through each time unit from song start to end
  for (let unit = Math.floor(song.startAt / RATE); unit < Math.ceil(song.endAt / RATE); unit++) {
    const partsIds = partsInUnits?.[unit] || [];

    // Start with previous snapshot as baseline
    snapshotsPerUnit[unit] = previousAssigneeSnapshot;

    // If no parts are active at this time unit, deactivate all artists
    if (partsIds.length === 0) {
      const isAnyActive = assigneesIdsList.some((assigneeId) => snapshotsPerUnit[unit][assigneeId].active);

      if (isAnyActive) {
        assigneesIdsList.forEach((assigneeId) => {
          if (snapshotsPerUnit[unit][assigneeId].active) {
            const snapshot = { ...snapshotsPerUnit[unit][assigneeId] };
            snapshot.active = false;
            snapshotsPerUnit[unit][assigneeId] = snapshot;
          }
        });
        previousAssigneeSnapshot = structuredClone(snapshotsPerUnit[unit]);
      }

      continue;
    }

    // Clone previous snapshot to build upon
    snapshotsPerUnit[unit] = structuredClone(previousAssigneeSnapshot);

    const assigneesInUnit: UID[] = [];

    // Process each active part at this time unit
    partsIds.forEach((partId) => {
      const assigneeIds = distribution.mapping[partId];
      // Filter out special IDs (ALL and NONE)
      const cleanupAssigneesIds = assigneeIds.filter((assigneeId) => ![ALL_ID, NONE_ID].includes(assigneeId));
      assigneesInUnit.push(...cleanupAssigneesIds);
      const part = distributor.getPart(partId, song);
      const line = distributor.getLine(part.lineId, song);

      // Update each assigned artist's snapshot
      cleanupAssigneesIds.forEach((assigneeId) => {
        const snapshot = { ...snapshotsPerUnit[unit][assigneeId] };

        // Only count non-adlib, non-dismissible lines in the main duration
        if (!line.adlib && !line.dismissible) {
          snapshot.duration += 1;
          snapshot.percentage = Math.floor((snapshot.duration / maxAssigneeDuration) * 100);
        }

        // Always count in full duration (includes all types of lines)
        snapshot.active = true;
        snapshot.fullDuration += 1;
        snapshot.fullPercentage = Math.floor((snapshot.fullDuration / maxAssigneeDuration) * 100);
        snapshotsPerUnit[unit][assigneeId] = snapshot;
      });
    });
    // Deactivate artists who are not singing in this time unit
    assigneesIdsList.forEach((assigneeId) => {
      if (!assigneesInUnit.includes(assigneeId)) {
        if (snapshotsPerUnit[unit][assigneeId].active) {
          const snapshot = { ...snapshotsPerUnit[unit][assigneeId] };
          snapshot.active = false;
          snapshotsPerUnit[unit][assigneeId] = snapshot;
        }
      }
    });

    // Calculate rankings based on accumulated singing time
    const sortedAssignees = orderBy(
      Object.values(snapshotsPerUnit[unit]),
      ['fullDuration'],
      ['desc'],
    ) as AssigneeSnapshot[];

    sortedAssignees.forEach((assignee, index) => {
      if (assignee.fullDuration > 0 && index !== snapshotsPerUnit[unit][assignee.id].rank) {
        const snapshot = { ...snapshotsPerUnit[unit][assignee.id] };
        snapshot.rank = index;
        snapshotsPerUnit[unit][assignee.id] = snapshot;
      }
    });

    previousAssigneeSnapshot = structuredClone(snapshotsPerUnit[unit]);
  }

  // Step 5: Walk backwards through time to mark when each artist finishes their parts
  // This helps visualize when each artist is "done" singing
  const reverseList = sortBy(Object.keys(snapshotsPerUnit).map((timestamp) => Number(timestamp))).reverse();
  const verifiedDone: UID[] = [];

  for (let i = 0; i < reverseList.length - 1; i++) {
    const currentTimestamp = reverseList[i];
    const nextTimestamp = reverseList[i + 1];
    assigneesIdsList.forEach((assigneeId) => {
      if (!verifiedDone.includes(assigneeId)) {
        // Mark as done at this timestamp
        snapshotsPerUnit[currentTimestamp][assigneeId].done = true;

        // If they're still active in the next (earlier) timestamp, they're permanently done
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

/**
 * Represents lyrics that should be displayed together at a specific time
 * Groups consecutive lines with the same singers for better readability
 */
export type LyricSnapshot = {
  id: UID; // ID of the first line in this snapshot
  assigneesIds: UID[]; // Artists singing these lines
  startTime: number; // Start time for this snapshot (in units)
  endTime: number; // End time for this snapshot
  lines: {
    parts: Array<{
      text: string;
      colors: string[];
      startTime: number;
      endTime: number;
    }>;
  }[];
};

/**
 * Builds snapshots of lyrics and adlibs over time
 * Groups consecutive lines with the same singers together for cleaner display
 * @param distribution - The distribution mapping parts to artists
 * @param song - The song with lyrics and timing
 * @returns Object with separate snapshots for main lyrics and adlibs
 */
const buildLyricsSnapshots = (distribution: Distribution, song: Song) => {
  const lyricsSnapshots: Dictionary<LyricSnapshot> = {};
  const adlibsSnapshots: Dictionary<LyricSnapshot> = {};

  let latestTimestamp = 0;
  let latestKey = ''; // Used to group consecutive lines with same singers

  // Process each line in the song
  distributor.getAllLines(song).forEach((line) => {
    // Skip dismissible lines (they won't be displayed)
    if (line.dismissible) {
      return;
    }

    const { startTime, endTime, section } = distributor.getLineSummary(line.id, song);
    const timestamp = Math.floor(startTime / RATE);

    // Collect all artists assigned to this line's parts
    const assigneesIds = removeDuplicates(line.partsIds.flatMap((partId) => distribution.mapping[partId]));

    // Handle ad-libs separately (they appear in parentheses)
    if (line.adlib) {
      const parts = line.partsIds.map((partId) => {
        const part = distributor.getPart(partId, song);
        const partText = part.text.replace(/^\(|\)$/g, '');
        const partColors = distribution.mapping[partId].map((assigneeId) =>
          [ALL_ID, NONE_ID].includes(assigneeId) ? '#f1f1f1' : distribution.assignees[assigneeId].color,
        );
        return {
          text: partText,
          colors: partColors,
          startTime: part.startTime / RATE,
          endTime: part.endTime / RATE,
        };
      });

      const newAdlibSnapshot: LyricSnapshot = {
        id: line.id,
        assigneesIds: assigneesIds,
        startTime: startTime / RATE,
        endTime: endTime / RATE,
        lines: [{ parts }],
      };

      adlibsSnapshots[timestamp] = newAdlibSnapshot;
      return;
    }

    // Create a unique key combining singers and section (to group consecutive lines)
    const key = `${sortBy(assigneesIds.filter((v) => v !== 'ALL')).join('::')}+${section.id}`;

    // If this line has the same singers as the previous line, append it to that snapshot
    if (latestKey === key) {
      const parts = line.partsIds.map((partId) => {
        const part = distributor.getPart(partId, song);
        const partText = part.text.replace(/^\(|\)$/g, '');
        const partColors = distribution.mapping[partId].map((assigneeId) =>
          [ALL_ID, NONE_ID].includes(assigneeId) ? '#f1f1f1' : distribution.assignees[assigneeId].color,
        );
        return {
          text: partText,
          colors: partColors,
          startTime: part.startTime / RATE,
          endTime: part.endTime / RATE,
        };
      });

      lyricsSnapshots[latestTimestamp].lines.push({ parts });
      return;
    }

    // Find next available timestamp to avoid collisions
    let adjustedTimestamp = timestamp;
    while (lyricsSnapshots[adjustedTimestamp]) {
      console.warn(
        `Timestamp collision at ${adjustedTimestamp * RATE}ms for line ${line.id}. Adjusting timestamp because it starts at the same time as ${lyricsSnapshots[adjustedTimestamp].id} ${lyricsSnapshots[adjustedTimestamp].lines[0].parts.map((part) => part.text).join(' ')}.`,
      );
      adjustedTimestamp++;
    }

    latestKey = key;
    latestTimestamp = adjustedTimestamp;

    const parts = line.partsIds.map((partId) => {
      const part = distributor.getPart(partId, song);
      const partText = part.text.replace(/^\(|\)$/g, '');
      const partColors = distribution.mapping[partId].map((assigneeId) =>
        [ALL_ID, NONE_ID].includes(assigneeId) ? '#f1f1f1' : distribution.assignees[assigneeId].color,
      );
      return {
        text: partText,
        colors: partColors,
        startTime: part.startTime / RATE,
        endTime: part.endTime / RATE,
      };
    });

    const newLyricSnapshot: LyricSnapshot = {
      id: line.id,
      assigneesIds: assigneesIds,
      startTime: startTime / RATE,
      endTime: endTime / RATE,
      lines: [{ parts }],
    };

    lyricsSnapshots[adjustedTimestamp] = newLyricSnapshot;
  });

  // Split overly long snapshots in half for better display
  // If a group of lines gets too long (6, 10, or 12 lines), split into two snapshots
  Object.keys(lyricsSnapshots).forEach((timestamp) => {
    const snapshot = lyricsSnapshots[timestamp];
    const textLength = snapshot.lines.length;

    if ([6, 10, 12].includes(textLength)) {
      const half = Math.floor(textLength / 2);

      const firstHalfLines = snapshot.lines.slice(0, half);
      const secondHalfLines = snapshot.lines.slice(half);

      const firstHalfSnapshot: LyricSnapshot = {
        id: snapshot.id,
        lines: firstHalfLines,
        assigneesIds: snapshot.assigneesIds,
        startTime: snapshot.startTime,
        endTime:
          firstHalfLines[firstHalfLines.length - 1].parts[
            firstHalfLines[firstHalfLines.length - 1].parts.length - 1
          ].endTime,
      };

      const secondHalfSnapshot: LyricSnapshot = {
        id: snapshot.id,
        lines: secondHalfLines,
        assigneesIds: snapshot.assigneesIds,
        startTime: secondHalfLines[0].parts[0].startTime,
        endTime:
          secondHalfLines[secondHalfLines.length - 1].parts[
            secondHalfLines[secondHalfLines.length - 1].parts.length - 1
          ].endTime,
      };

      lyricsSnapshots[timestamp] = firstHalfSnapshot;
      lyricsSnapshots[Math.floor(secondHalfSnapshot.startTime)] = secondHalfSnapshot;
    }
  });

  return {
    adlibsSnapshots,
    lyricsSnapshots,
  };
};

/**
 * Builds snapshots showing which artists are coming up next
 * Creates preview notifications before an artist starts singing
 * @param distribution - The distribution mapping parts to artists
 * @param song - The song with timing information
 * @returns Dictionary of artist names keyed by timestamp (when to show the preview)
 */
const buildUpNextSnapshots = (distribution: Distribution, song: Song) => {
  const upNextSnapshots: Dictionary<string[]> = {};
  let latestTimestamp = 0;
  let latestKey = '';
  // Show "up next" notification 1.2 seconds before artist starts singing (12 * 100ms)
  const THRESHOLD = RATE * 12;

  // Process each line to create "up next" notifications
  distributor.getAllLines(song).forEach((line) => {
    // Skip dismissible lines
    if (line.dismissible) {
      return;
    }

    const { startTime } = distributor.getLineSummary(line.id, song);
    // Calculate when to show the notification (THRESHOLD before the line starts)
    const timestamp = Math.floor(Math.max(startTime - THRESHOLD, 0) / RATE);

    // Get all artists for this line
    const assigneesIds = removeDuplicates(line.partsIds.flatMap((partId) => distribution.mapping[partId]));
    // Convert IDs to display names
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

    // Group consecutive lines with same singers to avoid duplicate notifications
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

/**
 * Validates that a distribution is in sync with its song
 * Detects when song parts have been added or removed but distribution hasn't been updated
 * @param song - The song to validate against
 * @param distribution - The distribution to check
 * @returns Freshness status with lists of missing and extra parts
 */
const verifyDistributionFreshness = (song: Song, distribution: Distribution) => {
  const allParts = distributor.getAllParts(song);

  const missingParts: UID[] = [];
  const extraParts: UID[] = [];

  // Check if all song parts are mapped in the distribution
  allParts.forEach((part) => {
    if (!distribution.mapping[part.id]) {
      missingParts.push(part.id);
    }
  });

  const partsDict = keyBy(allParts, 'id');

  // Check if all distribution mappings reference valid parts
  Object.keys(distribution.mapping).forEach((partId) => {
    if (!partsDict[partId]) {
      extraParts.push(partId);
    }
  });

  return {
    outdated: missingParts.length > 0 || extraParts.length > 0,
    missingParts,
    extraParts,
  };
};
