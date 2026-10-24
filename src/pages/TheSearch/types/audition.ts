import type { Contestant, CoreSkills, UtilitySkills } from './contestant';
import type { PanelJudging } from './narrative';

export type AuditionLevel = 1 | 2 | 3 | 4 | 5;
export type AuditionTrack = Contestant['track'];
export type AuditionTechnicalSkill = Exclude<keyof CoreSkills, 'stagePresence'>;
export type AuditionQuality = 'visual' | 'uniqueness' | 'potential' | 'charisma';
/** A genre library ID, validated against current or persisted genre definitions. */
export type AuditionGenre = string;
export type AuditionDice = readonly [number, number];
export type AuditionGrade = Contestant['grade'];

export interface AuditionSong {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly track: AuditionTrack;
  readonly genre: AuditionGenre;
  /** One fixed arrangement; the first tested skill has weight 2, all others weight 1. */
  readonly part: {
    readonly testedSkills: readonly {
      readonly skill: AuditionTechnicalSkill;
      readonly requiredLevel: AuditionLevel;
    }[];
  };
}

export interface AuditionPreferences {
  readonly visualOrUniqueness: 'visual' | 'uniqueness';
  readonly potentialOrCharisma: 'potential' | 'charisma';
}

export interface AuditionSkillCheck {
  readonly skill: keyof CoreSkills | keyof UtilitySkills;
  readonly skillLevel: AuditionLevel;
  readonly requiredLevel: AuditionLevel;
  readonly floor: AuditionLevel;
  readonly adjustedDice: AuditionDice;
  readonly deliveryFraction: number;
  readonly ceiling: number;
  readonly score: number;
}

export interface AuditionTechnicalCheck extends AuditionSkillCheck {
  readonly skill: AuditionTechnicalSkill;
  readonly weight: number;
}

export type AuditionPerformer = Pick<Contestant, 'id' | 'coreSkills' | 'utilitySkills'> & {
  readonly aggregations: Pick<Contestant['aggregations'], 'practice'>;
};

export interface ScoreAuditionInput {
  readonly contestant: AuditionPerformer;
  readonly song: AuditionSong;
  readonly preferences: AuditionPreferences;
  readonly rawDice: AuditionDice;
  /** Persist one seeded draw per contestant; lower keys win otherwise exact ties. */
  readonly tieBreakKey: number;
  /** Temporary readiness affects only stage presence, never saved skills. */
  readonly composure?: number;
}

export interface AuditionEvaluation {
  readonly panel?: PanelJudging;
  readonly contestantId: string;
  readonly songId: string;
  readonly rawDice: AuditionDice;
  readonly preferences: AuditionPreferences;
  readonly technical: {
    readonly score: number;
    readonly checks: readonly AuditionTechnicalCheck[];
  };
  readonly stagePresence: AuditionSkillCheck;
  readonly baseStagePresence: number;
  readonly composure: number;
  readonly impressions: Readonly<Record<AuditionQuality, AuditionSkillCheck>>;
  readonly finalScore: number;
  readonly grade: AuditionGrade;
  readonly tieBreakKey: number;
}

export interface AuditionQualityMemory {
  readonly mean: number;
  readonly highest: number;
  readonly satisfaction: number;
  readonly weight: number;
}

export interface AuditionBatchJudging {
  readonly preferences: AuditionPreferences;
  /** Null only for the first batch's independent equal choices. */
  readonly previousBatch: Readonly<Record<AuditionQuality, AuditionQualityMemory>> | null;
}
