import NAMES from '../data/names.json';
import type { Contestant } from '../types/contestant';
import { ALIGNMENTS, GRADES, STATUSES, TRACKS } from './constants';

/**
 * Gets a random name from the names list
 */
function getRandomName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

/**
 * Generates a new contestant ID in the format szc-XX (e.g., szc-01, szc-02, etc.)
 * @param existingIds - Array of existing contestant IDs to determine the next available number
 * @returns A new contestant ID
 */
export function generateContestantId(existingIds: string[] = []): string {
  if (existingIds.length === 0) {
    return 'szc-01';
  }

  // Extract numbers from existing IDs and find the max
  const numbers = existingIds
    .filter((id) => id.startsWith('szc-'))
    .map((id) => Number.parseInt(id.replace('szc-', ''), 10))
    .filter((num) => !Number.isNaN(num));

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  const nextNumber = maxNumber + 1;

  // Zero-pad to 2 digits
  return `szc-${String(nextNumber).padStart(2, '0')}`;
}

/**
 * Creates a new contestant with default values
 * @param partial - Optional partial contestant data to override defaults
 * @returns A new Contestant object with all required fields
 */
export function createContestant(partial: Partial<Contestant> = {}): Contestant {
  const id = partial.id || 'szc-01';

  return {
    id,
    type: 'contestant',
    name: partial.name || getRandomName(),
    track: partial.track || TRACKS.VOCAL,
    color: partial.color || '#FFFFFF',
    persona: partial.persona || '',
    zodiacSign: partial.zodiacSign || 'ARIES',
    updatedAt: partial.updatedAt || Date.now(),
    appearance: partial.appearance || {
      age: 18,
      height: '',
      build: '',
      hairStyle: '',
      hairColor: '',
      furColor: '',
      other: '',
    },
    grade: partial.grade || GRADES.D,
    rank: partial.rank ?? 0,
    status: partial.status || STATUSES.ACTIVE,
    specialties: partial.specialties || {
      vocalColor: '',
      danceStyle: '',
      rapStyle: '',
      visualVibe: '',
      leadershipStyle: '',
    },
    alignment: partial.alignment || ALIGNMENTS.TRUE_NEUTRAL,
    coreSkills: partial.coreSkills || {
      vocals: 3,
      rap: 3,
      dance: 3,
      stagePresence: 3,
      visual: 3,
      uniqueness: 3,
      leadership: 3,
    },
    utilitySkills: partial.utilitySkills || {
      potential: 3,
      memory: 3,
      stamina: 3,
      learning: 3,
      acrobatics: 3,
      consistency: 3,
      charisma: 3,
    },
    personality: partial.personality || {
      discipline: 0,
      curiosity: 0,
      extroversion: 0,
      sensitivity: 0,
      gentleness: 0,
      sincerity: 0,
      ambition: 0,
      resilience: 0,
      maturity: 0,
      investment: 0,
    },
    attributes: partial.attributes || [],
    missionRating: partial.missionRating || 0,
    aggregations: partial.aggregations || {
      audienceRatio: 0,
      contestantsLikeness: 50,
      productionRatio: 0,
      fanbaseRatio: 0,
      score: 0,
      experience: 0,
      screenTime: 0,
      center: 0,
      leader: 0,
      mvp: 0,
    },
    conditions: partial.conditions || {
      mentalCondition: 'STABLE',
      physicalCondition: 'HEALTHY',
    },
    events: partial.events || [],
    relationships: partial.relationships || {},
    changeLog: partial.changeLog || [],
  };
}

/**
 * Validates that the track's primary skill is >= the other two basic skills
 * @param contestant - The contestant to validate
 * @returns An object with isValid flag and error message if invalid
 */
export function validateTrackSkills(contestant: Contestant): { isValid: boolean; error?: string } {
  const { track, coreSkills } = contestant;
  const { vocals, rap, dance } = coreSkills;

  switch (track) {
    case TRACKS.VOCAL:
      if (vocals < rap || vocals < dance) {
        return {
          isValid: false,
          error: `Vocals (${vocals}) must be ≥ Rap (${rap}) and Dance (${dance}) for VOCAL track`,
        };
      }
      break;
    case TRACKS.RAP:
      if (rap < vocals || rap < dance) {
        return {
          isValid: false,
          error: `Rap (${rap}) must be ≥ Vocals (${vocals}) and Dance (${dance}) for RAP track`,
        };
      }
      break;
    case TRACKS.DANCE:
      if (dance < vocals || dance < rap) {
        return {
          isValid: false,
          error: `Dance (${dance}) must be ≥ Vocals (${vocals}) and Rap (${rap}) for DANCE track`,
        };
      }
      break;
  }

  return { isValid: true };
}
