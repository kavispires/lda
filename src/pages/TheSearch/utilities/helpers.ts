import type { Dictionary } from 'types/common';
import type { AttributeCard } from '../types/common';
import type { Contestant } from '../types/contestant';
import { DANCE_STYLES, RAP_STYLES, VISUAL_VIBES, VOCAL_COLORS } from './specialties';

/**
 * Type for specialty groups
 */
export type SpecialtyType = 'vocalColor' | 'danceStyle' | 'rapStyle' | 'visualVibe';

/**
 * Gets the specialty dictionary for a given type
 */
function getSpecialtyDictionary(type: SpecialtyType): Dictionary<AttributeCard> {
  switch (type) {
    case 'vocalColor':
      return VOCAL_COLORS;
    case 'danceStyle':
      return DANCE_STYLES;
    case 'rapStyle':
      return RAP_STYLES;
    case 'visualVibe':
      return VISUAL_VIBES;
  }
}

/**
 * Selects a random specialty based on weighted occurrence values
 * @param type - The type of specialty to select (vocalColor, danceStyle, rapStyle, visualVibe)
 * @param existingContestants - Array of existing contestants to avoid duplicates
 * @param preferDiversity - If true, reduces weight of already-used specialties
 * @returns The ID of the selected specialty
 */
export function generateRandomSpecialty(
  type: SpecialtyType,
  existingContestants: Contestant[] = [],
  preferDiversity = true,
): string {
  const specialties = getSpecialtyDictionary(type);
  const entries = Object.values(specialties);

  if (entries.length === 0) {
    return '';
  }

  // Count how many times each specialty has been used
  const usageCounts: Record<string, number> = {};
  if (preferDiversity && existingContestants.length > 0) {
    for (const contestant of existingContestants) {
      const specialtyValue = contestant.specialties[type];
      if (specialtyValue) {
        usageCounts[specialtyValue] = (usageCounts[specialtyValue] || 0) + 1;
      }
    }
  }

  // Calculate weights, reducing weight for already-used specialties
  const weights: number[] = [];
  let totalWeight = 0;

  for (const specialty of entries) {
    const usageCount = usageCounts[specialty.id] || 0;
    // Reduce weight by 50% for each time it's been used (but never below 1)
    const adjustedWeight = Math.max(1, specialty.occurrence * 0.5 ** usageCount);
    weights.push(adjustedWeight);
    totalWeight += adjustedWeight;
  }

  // Select random specialty based on weights
  let random = Math.random() * totalWeight;
  for (let i = 0; i < entries.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return entries[i].id;
    }
  }

  // Fallback to last entry (should rarely happen)
  return entries[entries.length - 1].id;
}

/**
 * Gets all available options for a specialty type in a format suitable for Select component
 */
export function getSpecialtyOptions(type: SpecialtyType): Array<{ value: string; label: string }> {
  const specialties = getSpecialtyDictionary(type);
  return Object.values(specialties).map((specialty) => ({
    value: specialty.id,
    label: specialty.name,
  }));
}

/**
 * Gets a specialty by ID and type
 */
export function getSpecialtyById(type: SpecialtyType, id: string): AttributeCard | undefined {
  const specialties = getSpecialtyDictionary(type);
  return specialties[id];
}
