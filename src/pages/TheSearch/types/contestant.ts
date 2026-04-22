import type { ValuesOf } from 'types';
import type { ALIGNMENTS, GRADES, STATUSES, TRACKS } from '../utilities/constants';
import type { ChangeRecord } from './common';

/**
 * Squirrel Zone: The Search
 * Contestant Data Model - Era: 2008-2012
 */

/**
 * The Appearance of the contestant determined by its avatar.
 */
export interface Appearance {
  /**
   * The age of the contestant
   */
  age: number;
  /**
   * The height of the contestant
   */
  height: string;
  /**
   * The build of the contestant
   */
  build: string;
  /**
   * The hair style of the contestant
   */
  hairStyle: string;
  /**
   * The hair color of the contestant
   */
  hairColor: string;
  /**
   * The fur color of the contestant
   */
  furColor: string;
  /**
   * Other notable physical features (e.g., tattoos, piercings, scars).
   */
  other: string;
}

/**
 * Core Skills (1-5 scale, higher is better)
 * These are the primary performance attributes that directly affect stage performance and PD evaluations.
 */
export interface CoreSkills {
  /**
   * Vocal technical ability, pitch, and range.
   */
  vocals: number;
  /**
   * Flow, lyricism, and rhythmic accuracy.
   */
  rap: number;
  /**
   * Technique, execution, and body control.
   */
  dance: number;
  /**
   * Ability to command the camera and live audience.
   */
  stagePresence: number;
  /**
   * Alignment with era-specific beauty standards.
   */
  visual: number;
  /**
   * Distinctiveness of voice, face, or aura.
   */
  uniqueness: number;
  /**
   * Ability to organize peers and maintain group morale.
   */
  leadership: number;
}

/**
 * Utility Skills (1-5 scale, higher is better)
 * These are secondary attributes that influence growth, relationships, and narrative events.
 */
export interface UtilitySkills {
  /**
   * Modifier for "Breakthroughs" during high-stakes missions.
   */
  potential: number;
  /**
   * Speed of memorizing complex choreography and lyrics.
   */
  memory: number;
  /**
   * Resistance to physical/mental exhaustion over long filming days.
   */
  stamina: number;
  /**
   * Speed of permanent skill growth during training phases.
   */
  learning: number;
  /**
   * Capability for stunts/flips; increases stage score but adds injury risk.
   */
  acrobatics: number;
  /**
   * (1: Unpredictable, 5: Rock Solid) Affects performance score variance.
   */
  consistency: number;
  /**
   * Natural wit and "variety sense"; drives screen time and viral moments.
   */
  charisma: number;
}

/**
 * Personality Traits (-10 to 10 scale, where 0 is neutral)
 * These traits influence how the contestant interacts with others, how they are perceived by the audience, and how they respond to stress and opportunities.
 */
export interface PersonalityTraits {
  /**
   * Discipline spectrum
   * 10: Workaholic/Organized | -10: Reckless/Lazy. Affects growth speed.
   */
  discipline: number;
  /**
   * Creativity spectrum
   * 10: Creative/Experimental | -10: Prosaic/Safe. Affects concept fit.
   */
  curiosity: number;
  /**
   * Extroversion spectrum
   * 10: Assertive/Sociable | -10: Reserved/Shy. Affects screen time.
   */
  extroversion: number;
  /**
   * Sensitivity spectrum
   * 10: Empathetic/Anxious | -10: Thick-skinned/Calm. Affects relationship impact.
   */
  sensitivity: number;
  /**
   * Gentleness spectrum
   * 10: Cooperative/Peacekeeper | -10: Antagonistic/Stubborn. Affects synergy.
   */
  gentleness: number;
  /**
   * Sincerity spectrum
   * 10: Authentic/Modest | -10: Calculative/Pretentious. Affects fandom loyalty.
   */
  sincerity: number;
  /**
   * Ambition spectrum
   * 10: Ruthless/Competitive | -10: Passive/Participatory. Triggers role conflicts.
   */
  ambition: number;
  /**
   * Resilience spectrum
   * 10: Stoic/Unshakable | -10: Fragile/Reactive. Affects mentalCondition decay.
   */
  resilience: number;
  /**
   * Maturity spectrum
   * 10: Professional/Composed | -10: Childish/Impulsive. Affects drama triggers.
   */
  maturity: number;
  /**
   * Investment spectrum
   * 10: Devoted/Committed | -10: Opportunistic/Detached. Affects likelihood of quitting or burnout events.
   */
  investment: number;
}

export interface Specialties {
  /**
   * The type of voice
   */
  vocalColor: string;
  /**
   * The style of rap
   */
  danceStyle: string;
  /**
   * The style of dance
   */
  rapStyle: string;
  /**
   * The type of beauty
   */
  visualVibe: string;
  /**
   * The style of leadership
   */
  leadershipStyle: string;
}

/**
 * Mutable values that change over the course of the simulation, representing the contestant's current state in terms of popularity, experience, and screen presence.
 */
export interface Aggregations {
  /**
   * Current happiness level, influenced by narrative events and performance outcomes. High happiness can boost performance, while low happiness can lead to burnout or quitting events.
   * Range: 0-100, starts at 50 (neutral)
   */
  happiness: number;
  /**
   * Weighted average of how much other contestants like them.
   */
  contestantsLikeness: number;
  /**
   * General popularity with simulated voters.
   * Float ratio from -1.00 to 1.00 representing percentage modifiers (e.g., 0.05 = +5%, -0.10 = -10%).
   */
  audienceRatio: number;
  /**
   * "The Edit": How much the PDs want this contestant in the final group.
   * Float ratio from -1.00 to 1.00 representing percentage modifiers (e.g., 0.05 = +5%, -0.10 = -10%).
   */
  productionRatio: number;
  /**
   * The core fanbase's willingness to save them from elimination.
   * Float ratio from -1.00 to 1.00 representing percentage modifiers (e.g., 0.05 = +5%, -0.10 = -10%).
   */
  fanbaseRatio: number;
  /**
   * Total score points gained in the simulation.
   */
  score: number;
  /**
   * Baseline proficiency gained from historical training/work.
   */
  experience: number;
  /**
   * Visibility in the broadcast; acts as a multiplier for likeness gains.
   */
  screenTime: number;
  /**
   * Times assigned the "Center" or "Main" role.
   */
  center: number;
  /**
   * Times assigned the "Team Leader" role.
   */
  leader: number;
  /**
   * Times voted "Best Performer" of an episode.
   */
  mvp: number;
}

export interface Contestant {
  /**
   * Unique identifier
   */
  id: string;
  /**
   * The type of the entity
   */
  type: 'contestant';
  /**
   * The name of the contestant
   */
  name: string;
  /**
   * The track of the contestant where he specializes in
   */
  track: ValuesOf<typeof TRACKS>;
  /**
   * Brand color used for UI highlights.
   */
  color: string;
  /**
   * Stereotype (e.g., "The Underdog", "The Ice Queen").
   */
  persona: string;
  /**
   * Zodiac sign (astrological sign based on birthdate).
   * Values: ARIES, TAURUS, GEMINI, CANCER, LEO, VIRGO, LIBRA, SCORPIO, SAGITTARIUS, CAPRICORN, AQUARIUS, PISCES
   */
  zodiacSign: string;
  /**
   * Timestamp in milliseconds when the contestant was last updated
   */
  updatedAt: number;
  /**
   * The appearance of the contestant determined by its avatar.
   * These are all fixed values.
   */
  appearance: Appearance;
  /**
   * The grade given during auditions
   */
  grade: ValuesOf<typeof GRADES>;
  /**
   * The current status (ACTIVE, ELIMINATED, or WINNER)
   */
  status: ValuesOf<typeof STATUSES>;
  /**
   * The specialties types that the contestant has
   */
  specialties: Specialties;
  /**
   * Alignment on the D&D-style spectrum, influencing narrative and audience perception.
   * This is a fixed value determined at initialization based on personality traits and backstory.
   */
  alignment: ValuesOf<typeof ALIGNMENTS>;
  /**
   * Core Performance Skills
   */
  coreSkills: CoreSkills;
  /**
   * Utility Skills
   */
  utilitySkills: UtilitySkills;
  /**
   * Personality Traits
   */
  personality: PersonalityTraits;
  /**
   * List of attribute cards ids related to the contestant (History cards, Identity cards, etc.).
   * These are starting cards that influence the contests initial values.
   */
  attributes: string[];

  // MUTABLE VALUES
  /**
   * The current rank
   */
  rank: number;
  /**
   * Overall performance rating for the current episode (1-5)
   */
  missionRating: number;
  /**
   * Current mental/physical state. Can be: STABLE, HEALTHY, STRESSED, ANXIOUS, CONFIDENT, ELATED, DEPRESSED, TIRED, INJURED, RECOVERING, EXHAUSTED
   * Defaults to STABLE
   */
  condition: string;
  /**
   * Numbers and counts that change throughout the simulation
   */
  aggregations: Aggregations;
  /**
   * List of event cards ids that have been triggered for this contestant (e.g., "Betrayal", "Breakthrough", "Injury").
   * These will modify the values in the contestant object
   */
  events: string[];
  /**
   * Map of contestantId to 0-100 relationship score. (100 = Besties, 0 = Enemies). Updated after each episode based on interactions and narrative events.
   * All values are initialized to 50 (Neutral) at the start of the simulation.
   */
  relationships: Record<string, number[]>;
  /**
   * Historical record of the contestant's rank, status, statistics, conditions, and narrative events at the end of each episode. Used for generating survival graphs and retrospective analysis.
   */
  changeLog: ChangeLogEntry[];
  /**
   * Indicator if the contestant should always be included in the pool of contestants.
   */
  bias?: boolean;
}

/**
 * Represents a single entry in the contestant's change log, recording their state and events at the end of each episode. This allows for tracking the contestant's journey through the competition and analyzing how specific events and changes influenced their trajectory.
 */
export interface ChangeLogEntry {
  /**
   * The episode number for which the log entry is recorded.
   */
  episode: number;
  /**
   * The performance rating for the episode (1-5 scale, maps to grade A-F)
   */
  missionRating: number;
  /**
   * The rank of the contestant at the end of the episode.
   */
  rank: number;
  /**
   * The score of the contestant for that episode.
   */
  score: number;
  /**
   * The status of the contestant at the end of the episode.
   */
  status: ValuesOf<typeof STATUSES>;
  /**
   * A brief summary of the contestant's performance and events during the episode.
   */
  summary: string;
  /**
   * List of event cards that were triggered for the contestant during the episode.
   */
  events: string[];
  /**
   * A record of changes to the contestant's attributes, skills, or other properties during the episode.
   */
  change: ChangeRecord;
}
