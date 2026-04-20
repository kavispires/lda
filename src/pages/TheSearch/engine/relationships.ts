import type { Contestant, PersonalityTraits } from '../types/contestant';
import { ALIGNMENTS } from '../utilities/constants';

/**
 * 2D grid coordinates for alignments
 * Grid layout:
 *   LG(0,0)  NG(1,0)  CG(2,0)
 *   LN(0,1)  TN(1,1)  CN(2,1)
 *   LE(0,2)  NE(1,2)  CE(2,2)
 */
const ALIGNMENT_COORDS: Record<string, [number, number]> = {
  [ALIGNMENTS.LAWFUL_GOOD]: [0, 0],
  [ALIGNMENTS.NEUTRAL_GOOD]: [1, 0],
  [ALIGNMENTS.CHAOTIC_GOOD]: [2, 0],
  [ALIGNMENTS.LAWFUL_NEUTRAL]: [0, 1],
  [ALIGNMENTS.TRUE_NEUTRAL]: [1, 1],
  [ALIGNMENTS.CHAOTIC_NEUTRAL]: [2, 1],
  [ALIGNMENTS.LAWFUL_EVIL]: [0, 2],
  [ALIGNMENTS.NEUTRAL_EVIL]: [1, 2],
  [ALIGNMENTS.CHAOTIC_EVIL]: [2, 2],
};

/**
 * Calculate Manhattan distance between two alignments on 2D grid
 * Returns 0-4 (0 = exact match, 4 = opposite corners)
 */
export function calculateAlignmentDistance(alignment1: string, alignment2: string): number {
  const coord1 = ALIGNMENT_COORDS[alignment1];
  const coord2 = ALIGNMENT_COORDS[alignment2];

  if (!coord1 || !coord2) {
    return 2; // Default to neutral distance if unknown alignment
  }

  const distance = Math.abs(coord1[0] - coord2[0]) + Math.abs(coord1[1] - coord2[1]);

  return distance;
}

/**
 * Convert alignment distance to relationship score
 * 0→+2, 1→+1, 2→0, 3→-1, 4→-2
 */
export function calculateAlignmentScore(distance: number): number {
  const scoreMap: Record<number, number> = {
    0: 2,
    1: 1,
    2: 0,
    3: -1,
    4: -2,
  };

  return scoreMap[distance] ?? 0;
}

/**
 * Calculate total personality distance across all 10 traits
 * Returns 0-200 range (perfect match to complete opposite)
 */
export function calculatePersonalityDistance(p1: PersonalityTraits, p2: PersonalityTraits): number {
  const traits: Array<keyof PersonalityTraits> = [
    'discipline',
    'curiosity',
    'extroversion',
    'sensitivity',
    'gentleness',
    'sincerity',
    'ambition',
    'resilience',
    'maturity',
    'investment',
  ];

  let totalDistance = 0;

  for (const trait of traits) {
    totalDistance += Math.abs(p1[trait] - p2[trait]);
  }

  return totalDistance;
}

/**
 * Convert personality distance to relationship score
 * 0-40→+3, 41-70→+1, 71-100→0, 101-130→-1, 131+→-3
 */
export function calculatePersonalityScore(distance: number): number {
  if (distance <= 40) {
    return 3;
  }
  if (distance <= 70) {
    return 1;
  }
  if (distance <= 100) {
    return 0;
  }
  if (distance <= 130) {
    return -1;
  }
  return -3;
}

/**
 * Calculate first impression between observer and performer
 * Combines personality score (max ±3) and alignment score (max ±2)
 * Final result clamped to ±5
 */
export function calculateFirstImpression(observer: Contestant, performer: Contestant): number {
  // Calculate personality component
  const personalityDistance = calculatePersonalityDistance(observer.personality, performer.personality);
  const personalityScore = calculatePersonalityScore(personalityDistance);

  // Calculate alignment component
  const alignmentDistance = calculateAlignmentDistance(observer.alignment, performer.alignment);
  const alignmentScore = calculateAlignmentScore(alignmentDistance);

  // Combine scores
  const totalImpression = personalityScore + alignmentScore;

  // Clamp to ±5
  return Math.max(-5, Math.min(5, totalImpression));
}

/**
 * Update relationships for all contestants after performances
 * Each observer updates their relationship with each performer
 * Returns map of contestant ID → updated relationships object
 */
export function updateRelationshipsAfterPerformances(
  contestants: Contestant[],
): Map<string, Record<string, number[]>> {
  const updatedRelationships = new Map<string, Record<string, number[]>>();

  for (const observer of contestants) {
    const newRelationships: Record<string, number[]> = {};

    for (const performer of contestants) {
      // Calculate first impression
      const impression = calculateFirstImpression(observer, performer);

      // Get current relationship array and latest value
      const currentArray = observer.relationships[performer.id] || [50];
      const currentValue = currentArray[currentArray.length - 1] || 50;

      // Update relationship (add impression delta)
      const newValue = Math.max(0, Math.min(100, currentValue + impression));

      // Append new value to array
      newRelationships[performer.id] = [...currentArray, newValue];
    }

    updatedRelationships.set(observer.id, newRelationships);
  }

  return updatedRelationships;
}
