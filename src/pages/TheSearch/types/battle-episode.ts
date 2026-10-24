import type { AuditionDice, AuditionLevel, AuditionTechnicalSkill } from './audition';
import type {
  AudienceOutcome,
  BroadcastCut,
  EpisodeScene,
  MvpResult,
  SecretResult,
} from './audition-episode';
import type { PropertyChange } from './common';
import type { Contestant, UtilitySkills } from './contestant';
import type { PreparationAction } from './narrative';

export interface BattleSong {
  id: string;
  title: string;
  description: string;
  genre: string;
  difficulty: AuditionLevel;
  parts: {
    id: string;
    name: string;
    testedSkills: { skill: AuditionTechnicalSkill; requiredLevel: AuditionLevel }[];
  }[];
}

export type BattleConflictChoice = 'support' | 'mediate' | 'push';
export type BattlePhase =
  | 'dorms'
  | 'ranking'
  | 'draft'
  | 'pairings'
  | 'preparation'
  | 'conflict'
  | 'performance'
  | 'broadcast'
  | 'audience'
  | 'saves'
  | 'results'
  | 'mvp'
  | 'secret'
  | 'complete';

export type BattleAction =
  | PreparationAction
  | { type: 'start' }
  | { type: 'advance' }
  | { type: 'conflict'; choice: BattleConflictChoice }
  | { type: 'broadcast'; cutId: BroadcastCut['id'] }
  | { type: 'production-save'; contestantId: string }
  | { type: 'secret'; contestantId: string };

export interface BattleCheck {
  skill: string;
  skillLevel: number;
  requiredLevel: number;
  floor: number;
  adjustedDice: AuditionDice;
  score: number;
  weight: number;
}

export interface BattlePractice {
  session: number;
  title: string;
  leaderDice: AuditionDice;
  leadershipCheck: BattleCheck & { successThreshold: number };
  leadershipSuccess: boolean;
  coordinationChange: number;
  coordinationBefore: number;
  coordinationAfter: number;
  contestants: {
    contestantId: string;
    rawDice: AuditionDice;
    checks: {
      skill: keyof UtilitySkills;
      skillLevel: number;
      floor: number;
      weight: number;
      adjustedDice: AuditionDice;
      requiredLevel: AuditionLevel;
    }[];
    practiceBefore: number;
    practiceAfter: number;
    weightedSum: number;
    sessionPractice: number;
    improved: boolean;
  }[];
}

export interface BattleTeam {
  id: string;
  name: string;
  captainId: string;
  memberIds: string[];
  songId: string | null;
  centerId: string | null;
  centerBallots: Record<string, string>;
  partAssignments: Record<string, string>;
  partReactions: Record<string, 'happy' | 'neutral' | 'unhappy'>;
  coordination: number;
  practice: BattlePractice[];
}

export interface BattleEvaluation {
  contestantId: string;
  partId: string;
  rawDice: AuditionDice;
  technicalChecks: BattleCheck[];
  stageCheck: BattleCheck;
  impressionChecks: BattleCheck[];
  technicalScore: number;
  stageScore: number;
  impressionScore: number;
  composure: number;
  finalScore: number;
  grade: Contestant['grade'];
  tieBreakKey: number;
  centerBonus?: number;
}

export interface BattlePerformance {
  teamId: string;
  evaluations: BattleEvaluation[];
  meanScore: number;
  coordination: number;
  finalScore: number;
  baseScore?: number;
  judging?: Record<
    'john' | 'megan' | 'michael',
    { score: number; bonus: number; comment: string; checks: BattleCheck[] }
  >;
}

export type BattleStoryStage =
  | 'dorms'
  | 'credits'
  | 'challenge'
  | 'captains'
  | 'draft'
  | 'pairings'
  | 'rehearsal'
  | 'leadership'
  | 'center'
  | 'intervention'
  | 'intervention-result'
  | 'performance'
  | 'opponent-reaction'
  | 'reviews'
  | 'winners'
  | 'twist'
  | 'judge-save'
  | 'audience-save'
  | 'production-save'
  | 'save-result'
  | 'departures'
  | 'mvp'
  | 'secret-choice'
  | 'secret-result'
  | 'ranking-rule'
  | 'ranking'
  | 'rank-reactions'
  | 'complete';

export interface BattleStoryReaction {
  observerId: string;
  targetId: string | null;
  before: number;
  after: number;
  emotion: string;
}

export interface BattleStory {
  stage: BattleStoryStage;
  sequence: number;
  draftPick: number;
  pairingCursor: number;
  reviewCursor: number;
  departureCursor: number;
  interventions: Record<string, BattleConflictChoice>;
  exposure: Record<string, number>;
  creditedTeamIds: string[];
  matchupReactions: BattleStoryReaction[];
  rankReactions: BattleStoryReaction[];
  rankRevealed: boolean;
  backlashApplied: boolean;
}

export interface BattleEpisode {
  version: 1 | 2;
  story?: BattleStory;
  phase: BattlePhase;
  revision: number;
  lastAction: { revision: number; action: BattleAction };
  participantIds: string[];
  rankedIds: string[];
  finalRankedIds: string[];
  rooms: { id: string; memberIds: string[] }[];
  roomCursor: number;
  teams: BattleTeam[];
  draftRound: number;
  pairings: { id: string; teamIds: [string, string]; winnerId: string | null }[];
  teamCursor: number;
  performances: BattlePerformance[];
  composure: Record<string, number>;
  conflict: { teamId: string; contestantIds: string[]; description: string } | null;
  conflictChoice: BattleConflictChoice | null;
  scenes: EpisodeScene[];
  changes: Record<string, PropertyChange[]>;
  cuts: BroadcastCut[];
  selectedCutId: BroadcastCut['id'] | null;
  audience: AudienceOutcome | null;
  judgeSaveId: string | null;
  audienceSaveId: string | null;
  productionShortlist: string[];
  productionSaveId: string | null;
  survivorIds: string[];
  eliminatedIds: string[];
  revealedResults: number;
  mvp: MvpResult | null;
  secretCandidates: string[];
  secret: SecretResult | null;
}
