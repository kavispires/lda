import type { AuditionDice, AuditionGrade } from './audition';
import type {
  AudienceOutcome,
  DeferredConsequence,
  EpisodeScene,
  MoodChoices,
  MvpResult,
  SecretResult,
  ShowAudience,
} from './audition-episode';
import type { BattleCheck } from './battle-episode';
import type { PropertyChange } from './common';
import type { Contestant } from './contestant';
import type { EpisodePreparation, PreparationAction } from './narrative';

export interface MusicVideoCatalog {
  version: 1;
  theme: { id: 'squirrel-life'; title: 'Squirrel Life' };
  director: { id: 'vivienne-voss'; name: 'Vivienne Voss'; role: 'Guest Director' };
  soloSets: { id: string; name: string; description: string; difficulty: 3 }[];
  storyboardPrompts: { id: string; name: string; description: string }[];
}
export type MusicVideoAction =
  | PreparationAction
  | { type: 'start' }
  | { type: 'advance' }
  | { type: 'secret'; contestantId: string };
export type MusicVideoPhase =
  | 'briefing'
  | 'storyboards'
  | 'credits'
  | 'director'
  | 'solos'
  | 'takes'
  | 'premiere'
  | 'panel'
  | 'ranking'
  | 'elimination'
  | 'peer-mvp'
  | 'secret-choice'
  | 'secret-result'
  | 'farewell'
  | 'complete';
export interface MusicVideoStoryboard {
  contestantId: string;
  completed: boolean;
  promptId: string;
  proposal: string;
  coordinates: boolean;
  elaborate: boolean;
  overnightFatigue: 0 | 1;
}
export interface MusicVideoSolo {
  contestantId: string;
  setId: string;
  rawDice: AuditionDice;
  checks: { visual: BattleCheck; charisma: BattleCheck };
  baseScore: number;
  frozen: boolean;
  freezePenalty: 0 | -10;
  stalledSeconds: 0 | 20;
  finalScore: number;
  grade: AuditionGrade;
  oneTakeWonder: boolean;
  preferenceBefore: number;
  preferenceAfter: number;
  feedback: string;
}
export interface MusicVideoTakeEvaluation {
  contestantId: string;
  rawDice: AuditionDice;
  checks: { dance: BattleCheck; stagePresence: BattleCheck; consistency: BattleCheck };
  overnightFatigue: number;
  fatigue: number;
  baseScore: number;
  lowStaminaPenalty: 0 | 10;
  finalScore: number;
  grade: AuditionGrade;
  resetFailure: boolean;
  idolSmile: boolean;
  description: string;
}
export interface MusicVideoTake {
  id: string;
  scheduledTake: 1 | 2 | 3 | 4 | 5;
  actualOrdinal: number;
  isReset: boolean;
  evaluations: MusicVideoTakeEvaluation[];
  failureIds: string[];
  failureTieKeys: Record<string, number>;
}
export interface MusicVideoPanelAssessment {
  contestantId: string;
  performance: number;
  john: number;
  megan: number;
  michael: number;
  professionalism: number;
  director: number;
  finalScore: number;
  grade: AuditionGrade;
  comments: { judgeId: 'john' | 'megan' | 'michael' | 'vivienne-voss'; description: string }[];
}
export interface MusicVideoEvidence {
  contestantId: string;
  finalScore: number;
  observedScore: number;
  reception: number;
  category: string;
}
export interface MusicVideoCut {
  featuredIds: string[];
  quality: Record<string, number>;
  tieKeys: Record<string, number>;
  individualFocus: Record<string, number>;
  presence: Record<string, number>;
  exposure: Record<string, number>;
  shots: {
    id: string;
    kind: 'group' | 'solo';
    contestantIds: string[];
    sourceId: string;
    percent: number;
    reason: string;
  }[];
}
export interface MusicVideoEpisode {
  version: 1;
  randomStartState: number;
  revision: number;
  lastAction: { revision: number; action: MusicVideoAction };
  phase: MusicVideoPhase;
  participantIds: string[];
  startingContestants: Contestant[];
  startingShow: ShowAudience;
  previousRankedIds: string[];
  openingCast: string[];
  startingOpeningCast: string[];
  startingPreparation: EpisodePreparation;
  startingRevealedSecrets: { contestantId: string; cardId: string }[];
  startingDeferredConsequences: DeferredConsequence[];
  steps: { revision: number; action: MusicVideoAction; drawCount: number; endState: number }[];
  storyboards: MusicVideoStoryboard[];
  directorReactions: {
    contestantId: string;
    happinessBefore: number;
    happinessAfter: number;
    professionalPivot: boolean;
    description: string;
  }[];
  solos: MusicVideoSolo[];
  takes: MusicVideoTake[];
  reset: {
    takeId: string;
    causeId: string;
    criticId: string | null;
    supporterId: string | null;
    relationshipChanges: { fromId: string; toId: string; before: number; after: number }[];
  } | null;
  conditionChanges: { contestantId: string; before: string; after: 'EXHAUSTED'; restored: boolean }[];
  fatigue: Record<string, number>;
  heroSmileIds: string[];
  filmingCompleted: boolean;
  recovered: boolean;
  cut: MusicVideoCut | null;
  panel: MusicVideoPanelAssessment[];
  evidence: MusicVideoEvidence[];
  exposure: Record<string, number>;
  audience: AudienceOutcome | null;
  audienceContestants: Contestant[];
  audienceBefore: ShowAudience | null;
  audienceAfter: ShowAudience | null;
  audienceRandom: number[];
  audienceMood: MoodChoices | null;
  mvp: MvpResult | null;
  mvpContestants: Contestant[];
  mvpRandom: number[];
  secretCandidates: string[];
  investigationEligibleIds: string[];
  investigationContestants: Contestant[];
  investigationRandom: number[];
  secret: SecretResult | null;
  rankedIds: string[];
  survivorIds: string[];
  eliminatedId: string | null;
  rankRevealed: boolean;
  sealedRankingScores: Record<string, number>;
  rankingTieKeys: Record<string, number>;
  fanTransfers: { survivorIds: string[]; before: ShowAudience; after: ShowAudience; random: number[] }[];
  scenes: EpisodeScene[];
  changes: Record<string, PropertyChange[]>;
}
