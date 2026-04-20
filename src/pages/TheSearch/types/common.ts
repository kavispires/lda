import type { ValuesOf } from 'types';
import type { TRACKS } from '../utilities/constants';

/**
 * Key format uses dot notation to represent nested paths (e.g., 'aggregations.mvp', 'relationships.svc_1').
 * Values represent the new value after the change was applied.
 * @example { 'aggregations.mvp': 1, 'relationships.svc_1': 53 }
 */
export type ChangeRecord<T = number | string> = Record<string, T>;

export type AttributeCard = {
  /**
   * Unique identifier
   */
  id: string;
  /**
   * The type of attribute
   */
  type: string;
  /**
   * The group or category this attribute belongs to
   */
  group: string;
  /**
   * The display name
   */
  name: string;
  /**
   * A brief description
   */
  description: string;
  /**
   * How common this attribute should be among contestants
   */
  occurrence: number;
  /**
   * A record of the attribute's base values or initial settings. The keys represent the affected attribute (using dot notation for nested attributes), and the values represent the initial values and replace the original values. Sets are rare.
   */
  set?: ChangeRecord;
  /**
   * A record of how this attribute influences various aspects of a contestant's performance, relationships, and state. The keys represent the affected attribute (using dot notation for nested attributes), and the values represent the magnitude and direction of the influence.
   */
  influences: ChangeRecord;
  /**
   * A record of how this attribute affects the contestant over time or in response to events. The keys represent the affected attribute (using dot notation for nested attributes), and the values represent the magnitude and direction of the effect.
   * E.g. A secret got revealed so this happens to his stats.
   */
  consequence?: ChangeRecord;
};

/**
 * Represents a specific performable section or "line" within a song.
 * For auditions, a song will only have one of these. For team missions,
 * this array represents the complete line distribution.
 */
export interface PerformancePart {
  /**
   * The role type for this specific part of the song.
   */
  type: 'MVP' | 'CENTER' | 'NORMAL';
  /**
   * The percentage of the performance's duration this part yields (e.g., 0.25 for 25%).
   * Dictates how much aggregations.screenTime is awarded.
   */
  screenTime: number;
  /**
   * The primary track this part favors.
   */
  track: ValuesOf<typeof TRACKS>;
  /**
   * The specific specialties this part favors.
   * Used heavily in the Affinity Score calculation for song/part selection.
   */
  specialtyFavors: {
    vocalColor?: string;
    rapStyle?: string;
    danceStyle?: string;
    visualVibe?: string;
  };
  /**
   * The raw difficulty (1-5) to perform this part.
   * Checked against the contestant's coreSkills to calculate the Base Execution score.
   */
  difficulty: {
    vocal: number;
    rap: number;
    dance: number;
  };
  /**
   * Defines what non-core attributes give a percentage boost to the final score.
   * Key format: Dot notation path to the contestant's attribute (e.g., 'utilitySkills.acrobatics').
   * Value: Float representing the max percentage bonus (e.g., 0.15 = 15% bonus).
   */
  modifiersWeight: Record<string, number>;
  /**
   * The state changes awarded to the contestant upon completing this part.
   * Mostly impacts contestant.aggregations.
   * @example { 'aggregations.center': 1, 'aggregations.mvp': 1 }
   */
  influences: ChangeRecord;
}

/**
 * Squirrel Zone: The Search
 * The core data model for any performable song in the simulation.
 */
export interface PerformanceSong {
  /**
   * Unique identifier for the song.
   */
  id: string;
  /**
   * The title of the song.
   */
  title: string;
  /**
   * A brief description of the song's vibe, tempo, or concept.
   */
  description: string;
  /**
   * The base maximum amount of points given for this performance.
   * This acts as the raw point pool before multipliers are applied.
   */
  points: number;
  /**
   * The leader of the performance
   */
  leaderId?: string;
  /**
   * The distribution of the song into performable parts.
   */
  distribution: PerformancePart[];
}
