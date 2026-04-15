import type { Dictionary } from 'types/common';
import type { AttributeCard } from '../types/common';
import type { Contestant } from '../types/contestant';
import {
  DANCE_STYLES,
  LEADERSHIP_STYLES,
  RAP_STYLES,
  VISUAL_VIBES,
  VOCAL_COLORS,
  ZODIAC_SIGNS,
} from './attribute-libraries';

/**
 * Type for specialty groups
 */
export type SpecialtyType = 'vocalColor' | 'danceStyle' | 'rapStyle' | 'visualVibe' | 'leadershipStyle';

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
    case 'leadershipStyle':
      return LEADERSHIP_STYLES;
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

  if (!preferDiversity) {
    return entries[Math.floor(Math.random() * entries.length)].id;
  }

  // Count how many times each specialty has been used
  const usageCounts: Record<string, number> = {};
  if (existingContestants.length > 0) {
    for (const contestant of existingContestants) {
      const specialtyValue = contestant.specialties[type];
      if (specialtyValue) {
        usageCounts[specialtyValue] = (usageCounts[specialtyValue] || 0) + 1;
      }
    }
  }

  // Calculate weights, reducing weight for already-used specialties
  const weights: Record<string, number> = {};
  for (const specialty of entries) {
    const value = Math.max(specialty.occurrence - (usageCounts[specialty.id] || 0), 0);
    weights[specialty.id] = value;
  }

  const options = Object.entries(weights).flatMap(([id, weight]) => Array(weight).fill(id));

  if (options.length === 0) {
    // If all weights are zero, fallback to equal probability
    return entries[Math.floor(Math.random() * entries.length)].id;
  }

  const randomIndex = Math.floor(Math.random() * options.length);
  return options[randomIndex];
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

/**
 * Gets all zodiac sign options in a format suitable for Select component
 */
export function getZodiacSignOptions(): Array<{ value: string; label: string }> {
  return Object.values(ZODIAC_SIGNS).map((sign) => ({
    value: sign.id,
    label: sign.name,
  }));
}
