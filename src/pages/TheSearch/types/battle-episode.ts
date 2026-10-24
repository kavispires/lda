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
}

export interface BattlePerformance {
  teamId: string;
  evaluations: BattleEvaluation[];
  meanScore: number;
  coordination: number;
  finalScore: number;
}

export interface BattleEpisode {
  version: 1;
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
