import type { Dictionary } from 'types/common';
import type { Contestant } from '../types/contestant';
import { GRADES, TRACKS } from './constants';

/**
 * Generate random track distribution for 30 contestants
 * VOCAL: 12-16, RAP: 7-11, DANCE: 7-11 (totaling 30)
 */
function generateRandomDistribution(): Record<string, number> {
  // Random VOCAL count between 12-16
  const vocalCount = 12 + Math.floor(Math.random() * 5); // 12, 13, 14, 15, or 16

  // Remaining slots for RAP and DANCE
  const remaining = 30 - vocalCount;

  // Random RAP count between 7-11, but not exceeding remaining
  const maxRap = Math.min(11, remaining - 7); // Ensure at least 7 for DANCE
  const minRap = Math.max(7, remaining - 11); // Ensure at most 11 for DANCE
  const rapCount = minRap + Math.floor(Math.random() * (maxRap - minRap + 1));

  // DANCE gets the rest
  const danceCount = remaining - rapCount;

  return {
    [TRACKS.VOCAL]: vocalCount,
    [TRACKS.RAP]: rapCount,
    [TRACKS.DANCE]: danceCount,
  };
}

/**
 * Grade priority for selection (higher is better)
 */
const GRADE_PRIORITY = {
  [GRADES.A]: 5,
  [GRADES.B]: 4,
  [GRADES.C]: 3,
  [GRADES.D]: 2,
  [GRADES.F]: 1,
};

/**
 * Selects 30 diverse contestants from the Firestore contestants collection
 * Prioritizes track diversity and higher grades
 *
 * @param contestantsData - Dictionary of all contestants from Firestore
 * @returns Array of 30 selected contestant IDs
 */
export function selectDiverseContestants(contestantsData: Dictionary<Contestant>): string[] {
  const contestants = Object.values(contestantsData);

  if (contestants.length < 30) {
    throw new Error(`Not enough contestants in database. Found ${contestants.length}, need at least 30.`);
  }

  // Group contestants by track
  const byTrack: Record<string, Contestant[]> = {
    [TRACKS.VOCAL]: [],
    [TRACKS.RAP]: [],
    [TRACKS.DANCE]: [],
  };

  for (const contestant of contestants) {
    if (byTrack[contestant.track]) {
      byTrack[contestant.track].push(contestant);
    }
  }

  // Sort each track by grade priority
  for (const track of Object.values(TRACKS)) {
    byTrack[track].sort((a, b) => {
      const priorityA = GRADE_PRIORITY[a.grade] || 0;
      const priorityB = GRADE_PRIORITY[b.grade] || 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher grade first
      }
      // If same grade, randomize
      return Math.random() - 0.5;
    });
  }

  // Generate random distribution
  const distribution = generateRandomDistribution();

  // Select contestants according to generated distribution
  const selected: string[] = [];

  for (const track of Object.values(TRACKS)) {
    const target = distribution[track];
    const available = byTrack[track];

    if (available.length < target) {
      // Not enough contestants in this track - will fill from others
    }

    // Take up to target number from this track
    const toSelect = Math.min(target, available.length);
    for (let i = 0; i < toSelect; i++) {
      selected.push(available[i].id);
    }
  }

  // If we don't have 30 yet, fill remaining slots with best available
  if (selected.length < 30) {
    const remaining = contestants
      .filter((c) => !selected.includes(c.id))
      .sort((a, b) => {
        const priorityA = GRADE_PRIORITY[a.grade] || 0;
        const priorityB = GRADE_PRIORITY[b.grade] || 0;
        return priorityB - priorityA;
      });

    const needed = 30 - selected.length;
    for (let i = 0; i < needed && i < remaining.length; i++) {
      selected.push(remaining[i].id);
    }
  }

  // Final shuffle to randomize order while maintaining diversity
  return shuffleArray(selected).slice(0, 30);
}

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get statistics about the selected contestants
 */
export function getSelectionStats(
  selectedIds: string[],
  contestantsData: Dictionary<Contestant>,
): {
  total: number;
  byTrack: Record<string, number>;
  byGrade: Record<string, number>;
} {
  const stats = {
    total: selectedIds.length,
    byTrack: {
      [TRACKS.VOCAL]: 0,
      [TRACKS.RAP]: 0,
      [TRACKS.DANCE]: 0,
    },
    byGrade: {
      [GRADES.A]: 0,
      [GRADES.B]: 0,
      [GRADES.C]: 0,
      [GRADES.D]: 0,
      [GRADES.F]: 0,
    },
  };

  for (const id of selectedIds) {
    const contestant = contestantsData[id];
    if (contestant) {
      stats.byTrack[contestant.track]++;
      stats.byGrade[contestant.grade]++;
    }
  }

  return stats;
}
