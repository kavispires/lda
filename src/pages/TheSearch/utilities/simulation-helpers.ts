import type { Dictionary } from 'types/common';
import type { Contestant } from '../types/contestant';
import { GRADES, TRACKS } from './constants';

/**
 * Generate random track distribution for 50 contestants
 * VOCAL: 20-26, RAP: 12-18, DANCE: 12-18 (totaling 50)
 */
function generateRandomDistribution(): Record<string, number> {
  // Random VOCAL count between 20-26
  const vocalCount = 20 + Math.floor(Math.random() * 7); // 20, 21, 22, 23, 24, 25, or 26

  // Remaining slots for RAP and DANCE
  const remaining = 50 - vocalCount;

  // Random RAP count between 12-18, but not exceeding remaining
  const maxRap = Math.min(18, remaining - 12); // Ensure at least 12 for DANCE
  const minRap = Math.max(12, remaining - 18); // Ensure at most 18 for DANCE
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
 * Selects 50 diverse contestants from the Firestore contestants collection
 * Prioritizes track diversity and higher grades
 *
 * @param contestantsData - Dictionary of all contestants from Firestore
 * @param useBias - If true, force-include all contestants with bias=true
 * @returns Array of 50 selected contestant IDs
 */
export function selectDiverseContestants(contestantsData: Dictionary<Contestant>, useBias = false): string[] {
  const contestants = Object.values(contestantsData);

  if (contestants.length < 50) {
    throw new Error(`Not enough contestants in database. Found ${contestants.length}, need at least 50.`);
  }

  const selected: string[] = [];

  // If useBias is true, force-include all bias contestants
  if (useBias) {
    const biasContestants = contestants.filter((c) => c.bias === true);
    selected.push(...biasContestants.map((c) => c.id));

    if (selected.length > 50) {
      throw new Error(
        `Too many bias contestants (${selected.length}). Cannot fit all in 50 slots. Please reduce bias contestants.`,
      );
    }
  }

  // Filter out already selected contestants
  const availableContestants = contestants.filter((c) => !selected.includes(c.id));

  // Group available contestants by track
  const byTrack: Record<string, Contestant[]> = {
    [TRACKS.VOCAL]: [],
    [TRACKS.RAP]: [],
    [TRACKS.DANCE]: [],
  };

  for (const contestant of availableContestants) {
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

  // Generate random distribution for remaining slots
  const remainingSlots = 50 - selected.length;
  const distribution = generateRandomDistribution();

  // Adjust distribution proportionally if we have bias contestants
  if (useBias && selected.length > 0) {
    const scaleFactor = remainingSlots / 50;
    for (const track of Object.values(TRACKS)) {
      distribution[track] = Math.round(distribution[track] * scaleFactor);
    }
  }

  // Select contestants according to generated distribution

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

  // If we still don't have enough, fill remaining slots with best available
  if (selected.length < 50) {
    const remaining = availableContestants
      .filter((c) => !selected.includes(c.id))
      .sort((a, b) => {
        const priorityA = GRADE_PRIORITY[a.grade] || 0;
        const priorityB = GRADE_PRIORITY[b.grade] || 0;
        return priorityB - priorityA;
      });

    const needed = 50 - selected.length;
    for (let i = 0; i < needed && i < remaining.length; i++) {
      selected.push(remaining[i].id);
    }
  }

  // Final shuffle to randomize order while maintaining diversity
  return shuffleArray(selected).slice(0, 50);
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
