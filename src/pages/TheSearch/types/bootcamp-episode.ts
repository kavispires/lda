import type { AuditionDice } from './audition';
import type { AudienceOutcome, EpisodeScene, MvpResult } from './audition-episode';
import type { PropertyChange } from './common';
import type { Contestant } from './contestant';
import type { PreparationAction } from './narrative';

export type BootcampAction = PreparationAction | { type: 'start' } | { type: 'advance' };
export type BootcampPhase =
  | 'dorms'
  | 'credits'
  | 'briefing'
  | 'groups'
  | 'ballots'
  | 'reveal'
  | 'performance'
  | 'winner'
  | 'relief'
  | 'mvp'
  | 'ranking'
  | 'complete';
export interface BootcampGroup {
  id: string;
  memberIds: string[];
  pairs: string[][];
  ballots: Record<string, Record<string, string[]>>;
  tieKeys: Record<string, Record<string, number>>;
}
export interface BootcampCheck {
  skillLevel: number;
  adjustedDice: AuditionDice;
  score: number;
}
export interface BootcampEvent {
  kind: string;
  narrative: string;
  contestantIds: string[];
  scoreDelta: number;
  spotlight: number;
  relationships: { observerId: string; targetId: string; delta: number }[];
}
export interface BootcampEvaluation {
  contestantId: string;
  round: number;
  rawDice: AuditionDice;
  checks: Record<string, BootcampCheck>;
  baseScore: number;
  finalScore: number;
  fatigue: number;
  tieBreakKey: number;
  events: BootcampEvent[];
}
export interface BootcampGroupResult {
  groupId: string;
  tieBreakKey: number;
  score: number;
  resets: number;
  assisted: boolean;
  staging: string[];
  attempts: { reset: number; timing: Record<string, number> }[];
}
export interface BootcampEpisode {
  version: 1;
  phase: BootcampPhase;
  revision: number;
  lastAction: { revision: number; action: BootcampAction };
  participantIds: string[];
  previousRankedIds: string[];
  groups: BootcampGroup[];
  round: number;
  roomCursor: number;
  groupCursor: number;
  evaluations: BootcampEvaluation[];
  groupResults: BootcampGroupResult[];
  winners: string[];
  winningGroupId: string | null;
  scoreAwardsApplied: boolean;
  exposure: Record<string, number>;
  audience: AudienceOutcome | null;
  mvp: MvpResult | null;
  rankedIds: string[];
  rankRevealed: boolean;
  initialState: Record<string, { condition: string; practice: number }>;
  startingContestants: Contestant[];
  scenes: EpisodeScene[];
  changes: Record<string, PropertyChange[]>;
}
