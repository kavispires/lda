import type { ChangeRecord, PerformanceSong } from '../types/common';
import type { ChangeLogEntry, Contestant } from '../types/contestant';
import { STATUSES } from '../utilities/constants';

/**
 * Track changes between original and modified contestant
 * Returns ChangeRecord with dot notation keys for all modifications
 */
export function trackChanges(original: Contestant, modified: Contestant): ChangeRecord {
  const changes: ChangeRecord = {};

  // Track missionRating
  if (original.missionRating !== modified.missionRating) {
    changes.missionRating = modified.missionRating - original.missionRating;
  }

  // Track grade (store as string, not arithmetic)
  if (original.grade !== modified.grade) {
    changes.grade = modified.grade;
  }

  // Track aggregations
  const aggKeys: Array<keyof typeof original.aggregations> = [
    'score',
    'screenTime',
    'productionRatio',
    'audienceRatio',
    'fanbaseRatio',
    'experience',
    'center',
    'leader',
    'mvp',
  ];

  for (const key of aggKeys) {
    const origVal = original.aggregations[key];
    const modVal = modified.aggregations[key];
    if (origVal !== modVal) {
      changes[`aggregations.${key}`] = modVal - origVal;
    }
  }

  // Track relationship changes (relationships are arrays)
  for (const [contestantId, newValues] of Object.entries(modified.relationships)) {
    const oldValues = original.relationships[contestantId] || [];
    const oldLatest = oldValues[oldValues.length - 1] || 50;
    const newLatest = newValues[newValues.length - 1] || 50;
    if (oldLatest !== newLatest) {
      changes[`relationships.${contestantId}`] = newLatest - oldLatest;
    }
  }

  return changes;
}

/**
 * Generate performance summary for a contestant
 * Format: [Entrance] + [Performance] + [Verdict]
 */
export function generatePerformanceSummary(
  contestant: Contestant,
  song: PerformanceSong,
  grade: string,
  rngRoll: number,
): string {
  const name = contestant.name;

  // ENTRANCE: Based on extroversion
  let entrance = '';
  if (contestant.personality.extroversion >= 7) {
    entrance = `${name} bursts into the audition room with explosive energy`;
  } else if (contestant.personality.extroversion >= 4) {
    entrance = `${name} enters the audition room with confidence`;
  } else if (contestant.personality.extroversion >= 1) {
    entrance = `${name} walks into the audition room calmly`;
  } else {
    entrance = `${name} quietly enters the audition room, barely making eye contact`;
  }

  // PERFORMANCE: Reference song + RNG result
  let performance = '';
  const songTitle = song.title;

  if (rngRoll > 0.05) {
    performance = `delivers a stellar performance of "${songTitle}"`;
  } else if (rngRoll > 0) {
    performance = `delivers a solid performance of "${songTitle}"`;
  } else if (rngRoll > -0.05) {
    performance = `gives a textbook performance of "${songTitle}"`;
  } else if (rngRoll > -0.15) {
    performance = `falters slightly during "${songTitle}"`;
  } else {
    performance = `struggles through "${songTitle}", clearly out of their element`;
  }

  // VERDICT: Grade result
  let verdict = '';
  if (grade === 'A' || grade === 'B') {
    verdict = `securing a well-deserved ${grade}`;
  } else if (grade === 'C') {
    verdict = `earning a ${grade} for a competent showing`;
  } else if (grade === 'D') {
    verdict = `receiving a ${grade}, leaving room for improvement`;
  } else {
    verdict = 'unfortunately receiving an F, disappointing the judges';
  }

  return `${entrance}, ${performance}, ${verdict}.`;
}

/**
 * Build a complete ChangeLogEntry for an episode
 */
export function buildChangeLogEntry(
  contestant: Contestant,
  episode: number,
  missionRating: number,
  rank: number,
  changes: ChangeRecord,
  summary: string,
  events: string[],
): ChangeLogEntry {
  return {
    episode,
    missionRating,
    rank,
    score: contestant.aggregations.score,
    status: contestant.status || STATUSES.ACTIVE,
    summary,
    events,
    change: changes,
  };
}
