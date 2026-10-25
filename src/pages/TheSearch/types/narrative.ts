import type { AuditionEvaluation, AuditionSkillCheck, AuditionTechnicalCheck } from './audition';
import type { MoodChoices, MoodOptions } from './audition-episode';

export type JudgeId = 'john' | 'megan' | 'michael';
export interface PanelJudging {
  lead: JudgeId;
  scores: Record<JudgeId, number>;
  weights: Record<JudgeId, number>;
  /** Absent on saved evaluations from the earlier panel-only formula. */
  track?: AuditionTechnicalCheck;
  /** Unadjusted weighted panel result for the gentler audition scale. */
  rawFinalScore?: number;
  finalScore: number;
  comment: string;
  consistency: number;
  leadership: number;
  consistencyCheck: AuditionSkillCheck;
  leadershipCheck: AuditionSkillCheck;
}

export interface EpisodePreparation {
  episode: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  revision: number;
  lastAction: { revision: number; action: PreparationAction } | null;
  moodOptions: MoodOptions;
  mood: MoodChoices | null;
  randomizedMood: MoodChoices | null;
  shortlist: string[];
  slots: (string | null)[];
  requiredSelections: number;
  openingPlayed: boolean;
}

export type PreparationAction =
  | { type: 'opening-cast'; contestantIds: string[] }
  | { type: 'mood'; choices: MoodChoices }
  | { type: 'randomize-mood' };

export interface NarrativeAuditionStory {
  sequence: number;
  presentation: 'host' | 'credits' | 'judges' | 'introduction' | 'performance' | 'montage' | 'results';
  pendingPerformerId: string | null;
  exposure: Record<string, number>;
  creditedIds: string[];
  farewellBaseline: Record<string, Record<string, number>>;
  farewellAppliedIds: string[];
}

export const AUDITION_SEQUENCES = [
  { size: 3, featured: true },
  { size: 12, featured: false },
  { size: 5, featured: true },
  { size: 10, featured: false },
  { size: 5, featured: true },
  { size: 12, featured: false },
  { size: 3, featured: true },
] as const;

export function auditionSequence(position: number) {
  if (!Number.isInteger(position) || position < 0)
    throw new Error('Audition position must be between zero and forty-nine.');
  let start = 0;
  for (const [index, block] of AUDITION_SEQUENCES.entries()) {
    if (position < start + block.size) return { ...block, index, start };
    start += block.size;
  }
  throw new Error('Audition position must be between zero and forty-nine.');
}

export function isPanelEvaluation(evaluation: AuditionEvaluation): evaluation is AuditionEvaluation & {
  panel: PanelJudging;
} {
  return evaluation.panel !== undefined;
}
