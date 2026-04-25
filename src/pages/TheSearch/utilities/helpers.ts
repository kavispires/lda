import type { Dictionary } from 'types/common';
import type { AttributeCard } from '../types/common';
import type { Contestant, PersonalityTraits } from '../types/contestant';
import {
  DANCE_STYLES,
  LEADERSHIP_STYLES,
  RAP_STYLES,
  VISUAL_VIBES,
  VOCAL_COLORS,
  ZODIAC_SIGNS,
} from './attribute-libraries';
import { ALIGNMENTS } from './constants';

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

export function getAlignment(traits: PersonalityTraits): keyof typeof ALIGNMENTS {
  // Calculate Ethical Score (Lawful vs Chaotic)
  // High discipline and maturity pull toward Lawful.
  // High curiosity pulls slightly toward Chaotic.
  const ethicalScore = traits.discipline * 0.5 + traits.maturity * 0.5 - traits.curiosity * 0.2;

  // Calculate Moral Score (Good vs Evil)
  // High gentleness, sincerity, and sensitivity pull toward Good.
  // High ambition (ruthlessness) pulls toward Evil.
  const moralScore =
    traits.gentleness * 0.4 + traits.sincerity * 0.4 + traits.sensitivity * 0.2 - traits.ambition * 0.3;

  let ethics: 'LAWFUL' | 'NEUTRAL' | 'CHAOTIC';
  if (ethicalScore > 3) ethics = 'LAWFUL';
  else if (ethicalScore < -3) ethics = 'CHAOTIC';
  else ethics = 'NEUTRAL';

  let morality: 'GOOD' | 'NEUTRAL' | 'EVIL';
  if (moralScore > 3) morality = 'GOOD';
  else if (moralScore < -3) morality = 'EVIL';
  else morality = 'NEUTRAL';

  // Special case for True Neutral
  if (ethics === 'NEUTRAL' && morality === 'NEUTRAL') return ALIGNMENTS.TRUE_NEUTRAL;

  const alignmentKey = `${ethics}_${morality}` as keyof typeof ALIGNMENTS;
  return ALIGNMENTS[alignmentKey];
}
