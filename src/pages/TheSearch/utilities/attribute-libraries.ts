import type { Dictionary } from 'types/common';
import type { AttributeCard } from '../types/common';

export const VOCAL_COLORS: Dictionary<AttributeCard> = {
  STANDARD: {
    id: 'STANDARD',
    name: 'Standard',
    type: 'vocalColor',
    group: 'vocal',
    description: 'A balanced and versatile voice that serves as the reliable backbone for any group harmony.',
    occurrence: 35,
    popularity: 50,
    influences: {},
  },
  SWEET: {
    id: 'SWEET',
    name: 'Sweet',
    type: 'vocalColor',
    group: 'vocal',
    description:
      "A light, 'honey-like' vocal tone that instantly captures the public's heart with its kindness.",
    occurrence: 15,
    popularity: 85,
    influences: { 'personality.gentleness': 3, 'personality.sensitivity': 2, 'state.audienceRatio': 0.05 },
  },
  HIGH_PITCH: {
    id: 'HIGH_PITCH',
    name: 'High Pitch',
    type: 'vocalColor',
    group: 'vocal',
    description:
      "The 'Power Vocal' archetype capable of hitting piercing high notes that define the climax of a song.",
    occurrence: 10,
    popularity: 90,
    influences: { 'coreSkills.vocals': 0.5, 'personality.ambition': 2, 'utilitySkills.stamina': -1 },
  },
  HUSKY: {
    id: 'HUSKY',
    name: 'Husky',
    type: 'vocalColor',
    group: 'vocal',
    description:
      "A textured, soulful rasp that adds a layer of maturity and 'expensive' character to a track.",
    occurrence: 10,
    popularity: 80,
    influences: { 'personality.maturity': 3, 'coreSkills.uniqueness': 0.3 },
  },
  VELVET: {
    id: 'VELVET',
    name: 'Velvet',
    type: 'vocalColor',
    group: 'vocal',
    description:
      'A smooth, R&B-leaning voice that feels intimate and sophisticated, often paired with a reserved persona.',
    occurrence: 10,
    popularity: 75,
    influences: { 'personality.extroversion': -2, 'personality.sincerity': 2 },
  },
  GRITTY: {
    id: 'GRITTY',
    name: 'Gritty',
    type: 'vocalColor',
    group: 'vocal',
    description:
      'A raw, rock-influenced edge that conveys high emotion and toughness, perfect for intense concepts.',
    occurrence: 10,
    popularity: 60,
    influences: { 'personality.gentleness': -3, 'personality.resilience': 3, 'coreSkills.vocals': 0.2 },
  },
  DEEP_BASS: {
    id: 'DEEP_BASS',
    name: 'Deep Bass',
    type: 'vocalColor',
    group: 'vocal',
    description:
      'A rare, resonant low range used for dramatic impact and providing a heavy foundation for the group.',
    occurrence: 10,
    popularity: 70,
    influences: { 'personality.extroversion': -3, 'coreSkills.uniqueness': 0.5 },
  },
};

export const DANCE_STYLES: Dictionary<AttributeCard> = {
  URBAN: {
    id: 'URBAN',
    name: 'Urban',
    occurrence: 50,
    type: 'danceStyle',
    group: 'dance',
    description:
      'The industry standard for synchronized choreography, focusing on clean execution and rhythm.',
    popularity: 60,
    influences: { 'utilitySkills.consistency': 1 },
  },
  SMOOTH: {
    id: 'SMOOTH',
    name: 'Smooth',
    type: 'danceStyle',
    group: 'dance',
    description:
      "A natural groover who makes difficult movement look effortless, possessing an innate 'cool' factor.",
    occurrence: 20,
    popularity: 80,
    influences: { 'coreSkills.stagePresence': 0.4, 'personality.discipline': -2 },
  },
  POPPING: {
    id: 'POPPING',
    name: 'Popping',
    type: 'danceStyle',
    group: 'dance',
    occurrence: 10,
    popularity: 70,
    influences: { 'utilitySkills.learning': 1, 'personality.discipline': 3 },
    description:
      'Technical mastery of isolations and sharp hits; usually found in the most disciplined practice-room addicts.',
  },
  B_BOY: {
    id: 'B_BOY',
    name: 'B Boy',
    type: 'danceStyle',
    group: 'dance',
    description:
      "Street-dance specialist focused on power moves and floor work; high-risk but high-reward for the 'wow' factor.",
    occurrence: 5,
    popularity: 85,
    influences: {
      'utilitySkills.acrobatics': 1,
      'personality.ambition': 3,
      'conditions.physicalCondition': -5,
    },
  },
  ACROBATIC: {
    id: 'ACROBATIC',
    name: 'Acrobatic',
    type: 'danceStyle',
    group: 'dance',
    description:
      "The peak 2010s 'Beast Idol' style featuring flips and stunts that drive a live crowd into a frenzy.",
    occurrence: 5,
    popularity: 95,
    influences: { 'utilitySkills.stamina': 1, 'utilitySkills.acrobatics': 2, 'personality.resilience': 4 },
  },
  LYRICAL: {
    id: 'LYRICAL',
    name: 'Lyrical',
    type: 'danceStyle',
    group: 'dance',
    description:
      'Focuses on storytelling through fluid, contemporary-influenced movement; deeply expressive and sensitive.',
    occurrence: 10,
    popularity: 65,
    influences: { 'personality.sensitivity': 5, 'personality.maturity': 2 },
  },
};

export const RAP_STYLES: Dictionary<AttributeCard> = {
  BASIC: {
    id: 'BASIC',
    name: 'Basic',
    type: 'rapStyle',
    group: 'rap',
    description:
      'Standard rhythmic delivery often assigned to members who are primarily vocalists or dancers.',
    occurrence: 40,
    popularity: 40,
    influences: {},
  },
  SWAG: {
    id: 'SWAG',
    name: 'Swag',
    type: 'rapStyle',
    group: 'rap',
    description:
      "Emphasis on aura, tone, and 'effortless cool'; the type of rapper production loves to put at the center.",
    occurrence: 15,
    popularity: 85,
    influences: {
      'personality.gentleness': -4,
      'personality.extroversion': 4,
      'state.productionRatio': 0.1,
    },
  },
  TECHNICAL: {
    id: 'TECHNICAL',
    name: 'Technical',
    type: 'rapStyle',
    group: 'rap',
    description:
      "The 'Fast-Tongue' specialist of the early 2010s, proving skill through speed and intricate diction.",
    occurrence: 10,
    popularity: 90,
    influences: { 'personality.discipline': 4, 'utilitySkills.memory': 1 },
  },
  FLOW: {
    id: 'FLOW',
    name: 'Flow',
    type: 'rapStyle',
    group: 'rap',
    description:
      'Focuses on rhythmic complexity and internal rhymes, always looking for unconventional ways to ride the beat.',
    occurrence: 10,
    popularity: 75,
    influences: { 'personality.curiosity': 3, 'coreSkills.rap': 0.3 },
  },
  MELODIC: {
    id: 'MELODIC',
    name: 'Melodic',
    type: 'rapStyle',
    group: 'rap',
    description:
      "The 'soft' rapper who blends singing and rhyming, a staple for era-appropriate radio ballads.",
    occurrence: 10,
    popularity: 80,
    influences: { 'personality.gentleness': 3, 'personality.sensitivity': 3, 'coreSkills.vocals': 0.2 },
  },
  CLASSIC: {
    id: 'CLASSIC',
    name: 'Classic',
    type: 'rapStyle',
    group: 'rap',
    description:
      "A student of 'old-school' boom-bap, valuing clarity, lyricism, and hip-hop tradition over trends.",
    occurrence: 10,
    popularity: 60,
    influences: { 'personality.maturity': 4, 'personality.sincerity': 3 },
  },
  GRITTY: {
    id: 'GRITTY',
    name: 'Gritty',
    type: 'rapStyle',
    group: 'rap',
    description:
      "Aggressive, underground-inspired delivery that builds a small but fiercely loyal 'hardcore' fanbase.",
    occurrence: 5,
    popularity: 55,
    influences: { 'personality.gentleness': -5, 'personality.resilience': 5, 'state.fanbaseRatio': 0.1 },
  },
};

export const VISUAL_VIBES: Dictionary<AttributeCard> = {
  WARM: {
    id: 'WARM',
    name: 'Warm',
    type: 'visualVibe',
    group: 'visual',
    occurrence: 20,
    popularity: 75,
    influences: { 'personality.gentleness': 4, 'state.contestantsLikeness': 10 },
    description:
      "The 'Neighborhood Oppa' visual—approachable, kind, and universally liked by both staff and peers.",
  },
  CUTE: {
    id: 'CUTE',
    name: 'Cute',
    type: 'visualVibe',
    group: 'visual',
    occurrence: 20,
    popularity: 90,
    influences: { 'personality.maturity': -5, 'personality.extroversion': 5, 'state.audienceRatio': 0.15 },
    description:
      "The 'Aegyo' machine; a youthful and bright look that secures the 'Maknae-on-top' voting demographic.",
  },
  MASCULINE: {
    id: 'MASCULINE',
    name: 'Masculine',
    type: 'visualVibe',
    group: 'visual',
    occurrence: 20,
    popularity: 85,
    influences: { 'personality.ambition': 3, 'utilitySkills.stamina': 1 },
    description:
      'Sharp features and an athletic build; the cornerstone of the beast-idol aesthetic favored in the late 2000s.',
  },
  CHIC: {
    id: 'CHIC',
    name: 'Chic',
    type: 'visualVibe',
    group: 'visual',
    occurrence: 20,
    popularity: 70,
    influences: { 'personality.extroversion': -4, 'personality.sincerity': -2, 'coreSkills.visual': 0.5 },
    description:
      "The distant 'Ice Prince' vibe; high-fashion and striking, though often edited as being cold or pretentious.",
  },
  MYSTERIOUS: {
    id: 'MYSTERIOUS',
    name: 'Mysterious',
    type: 'visualVibe',
    group: 'visual',
    occurrence: 20,
    popularity: 65,
    influences: { 'personality.extroversion': -8, 'coreSkills.uniqueness': 0.8, 'state.screenTime': -10 },
    description:
      'A quiet, intense aura that draws people in through enigma, though it risks being ignored by the cameras.',
  },
};

export const LEADERSHIP_STYLES: Dictionary<AttributeCard> = {
  COMMANDER: {
    id: 'COMMANDER',
    name: 'Commander',
    type: 'leadershipStyle',
    group: 'leadership',
    description:
      'A strict, results-oriented leader who demands perfection and absolute discipline from the team.',
    occurrence: 15,
    popularity: 60,
    influences: {
      'personality.discipline': 6,
      'personality.gentleness': -4,
      'coreSkills.leadership': 0.8,
      'state.productionRatio': 0.1, // Production loves the tension
    },
  },
  CARETAKER: {
    id: 'CARETAKER',
    name: 'Caretaker',
    type: 'leadershipStyle',
    group: 'leadership',
    description:
      'Leads through empathy and emotional support, focusing on the team’s mental well-being and harmony.',
    occurrence: 15,
    popularity: 85,
    influences: {
      'personality.gentleness': 6,
      'personality.sensitivity': 4,
      'state.contestantsLikeness': 15,
      'conditions.mentalCondition': 10,
    },
  },
  VISIONARY: {
    id: 'VISIONARY',
    name: 'Visionary',
    type: 'leadershipStyle',
    group: 'leadership',
    description:
      'An inspiring leader who leads by example on stage, driving the team forward through sheer charisma and star power.',
    occurrence: 15,
    popularity: 90,
    influences: {
      'utilitySkills.charisma': 1,
      'coreSkills.stagePresence': 0.5,
      'state.audienceRatio': 0.1,
      'state.screenTime': 10,
    },
  },
  DIPLOMAT: {
    id: 'DIPLOMAT',
    name: 'Diplomat',
    type: 'leadershipStyle',
    group: 'leadership',
    description:
      'A democratic leader who seeks consensus and ensures every member’s voice is heard during practice.',
    occurrence: 20,
    popularity: 80,
    influences: {
      'personality.sincerity': 5,
      'personality.maturity': 4,
      'state.contestantsLikeness': 10,
      'coreSkills.leadership': 1,
    },
  },
  TACTICIAN: {
    id: 'TACTICIAN',
    name: 'Tactician',
    type: 'leadershipStyle',
    group: 'leadership',
    description:
      'Strategic and analytical; they assign parts based strictly on stats and efficiency rather than feelings.',
    occurrence: 15,
    popularity: 50,
    influences: {
      'personality.ambition': 5,
      'personality.sincerity': -3,
      'utilitySkills.learning': 1,
      'personality.maturity': 3,
    },
  },
  QUIET_ACE: {
    id: 'QUIET_ACE',
    name: 'Quiet Ace',
    type: 'leadershipStyle',
    group: 'leadership',
    description:
      'A reluctant leader who doesn’t say much but sets a high standard through tireless hard work.',
    occurrence: 20,
    popularity: 75,
    influences: {
      'personality.extroversion': -4,
      'personality.discipline': 1,
      'state.audienceRatio': -0.05,
      'utilitySkills.consistency': -1,
    },
  },
};

export const ZODIAC_SIGNS: Dictionary<AttributeCard> = {
  ARIES: {
    id: 'ARIES',
    name: 'Aries',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The fiery Aries is a natural-born leader, known for their courage and determination. They thrive in competitive environments and are not afraid to take risks.',
    occurrence: 8,
    popularity: 70,
    influences: { 'personality.ambition': 3, 'personality.extroversion': 2 },
  },
  TAURUS: {
    id: 'TAURUS',
    name: 'Taurus',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The dependable Taurus values stability and comfort. They are patient and practical, often serving as the rock of the group.',
    occurrence: 8,
    popularity: 65,
    influences: { 'personality.discipline': 3, 'personality.gentleness': 2 },
  },
  GEMINI: {
    id: 'GEMINI',
    name: 'Gemini',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The adaptable Gemini is a social butterfly, known for their quick wit and versatility. They excel in communication and can easily connect with others.',
    occurrence: 8,
    popularity: 75,
    influences: { 'personality.curiosity': 3, 'personality.extroversion': 3 },
  },
  CANCER: {
    id: 'CANCER',
    name: 'Cancer',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The nurturing Cancer is deeply intuitive and emotional. They are fiercely loyal to their loved ones and often take on a caregiving role within the group.',
    occurrence: 8,
    popularity: 80,
    influences: { 'personality.sensitivity': 4, 'personality.gentleness': 3 },
  },
  LEO: {
    id: 'LEO',
    name: 'Leo',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The charismatic Leo loves the spotlight and is a natural performer. They are confident and ambitious, often inspiring others with their passion.',
    occurrence: 8,
    popularity: 85,
    influences: { 'personality.extroversion': 4, 'personality.ambition': 4 },
  },
  VIRGO: {
    id: 'VIRGO',
    name: 'Virgo',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The meticulous Virgo is a perfectionist who pays great attention to detail. They are analytical and practical, often helping to keep the group organized.',
    occurrence: 8,
    popularity: 60,
    influences: { 'personality.discipline': 4, 'personality.sincerity': 3 },
  },
  LIBRA: {
    id: 'LIBRA',
    name: 'Libra',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The charming Libra values harmony and balance. They are diplomatic and sociable, often acting as the peacemaker within the group.',
    occurrence: 8,
    popularity: 70,
    influences: { 'personality.sincerity': 4, 'personality.extroversion': 2 },
  },
  SCORPIO: {
    id: 'SCORPIO',
    name: 'Scorpio',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The intense Scorpio is passionate and resourceful. They are known for their determination and can be quite mysterious.',
    occurrence: 8,
    popularity: 75,
    influences: { 'personality.ambition': 4, 'personality.sensitivity': 2 },
  },
  SAGITTARIUS: {
    id: 'SAGITTARIUS',
    name: 'Sagittarius',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The adventurous Sagittarius is optimistic and loves freedom. They are enthusiastic and often bring a sense of fun to the group.',
    occurrence: 8,
    popularity: 80,
    influences: { 'personality.extroversion': 3, 'personality.curiosity': 4 },
  },
  CAPRICORN: {
    id: 'CAPRICORN',
    name: 'Capricorn',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The disciplined Capricorn is ambitious and responsible. They are hardworking and often take on a leadership role within the group.',
    occurrence: 8,
    popularity: 65,
    influences: { 'personality.discipline': 5, 'personality.ambition': 3 },
  },
  AQUARIUS: {
    id: 'AQUARIUS',
    name: 'Aquarius',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The innovative Aquarius is independent and intellectual. They are often seen as unconventional and are not afraid to challenge the status quo.',
    occurrence: 8,
    popularity: 70,
    influences: { 'personality.curiosity': 5, 'personality.extroversion': -2 },
  },
  PISCES: {
    id: 'PISCES',
    name: 'Pisces',
    type: 'zodiacSign',
    group: 'zodiac',
    description:
      'The empathetic Pisces is artistic and intuitive. They are deeply emotional and often have a strong connection to music and creativity.',
    occurrence: 8,
    popularity: 75,
    influences: { 'personality.sensitivity': 5, 'personality.gentleness': 4 },
  },
};
