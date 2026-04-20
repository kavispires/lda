/**
 * Key format uses dot notation to represent nested paths (e.g., 'aggregations.mvp', 'relationships.svc_1').
 * Values represent the new value after the change was applied.
 * @example { 'aggregations.mvp': 1, 'relationships.svc_1': 53, 'aggregations.screenTime': 42 }
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
   * A measure of how much this attribute contributes to a contestant's popularity and audience appeal, influencing voting patterns and fan engagement.
   * @deprecated Use "influences" for the contestant.aggregations.<(audienceRatio, productionRatio, fanbaseRatio)>
   */
  popularity?: number;
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
