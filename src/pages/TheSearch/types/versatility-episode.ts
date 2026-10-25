import type { AuditionDice, AuditionGrade, AuditionLevel } from './audition';
import type {
  AudienceOutcome,
  EpisodeScene,
  MoodChoices,
  MvpResult,
  SecretResult,
  ShowAudience,
} from './audition-episode';
import type { BattleCheck, BattleConflictChoice, BattleTeam } from './battle-episode';
import type { PropertyChange } from './common';
import type { Contestant, CoreSkills, Specialties } from './contestant';
import type { PreparationAction } from './narrative';
import type { TrackSpecialElection } from './track-specials-episode';

export type VersatilityTrack = Contestant['track'];
export interface DoubtGirlsMember {
  id: string;
  name: string;
  role: string;
  favoredSpecialties: { field: keyof Specialties; value: string }[];
}
export interface VersatilitySong {
  id: string;
  title: string;
  concept: string;
  genre: string;
  parts: {
    id: string;
    name: string;
    alternatives: Record<VersatilityTrack, { difficulty: AuditionLevel; action: string }>;
  }[];
}
export type VersatilityAction =
  | PreparationAction
  | { type: 'start' }
  | { type: 'advance' }
  | { type: 'conflict'; choice: BattleConflictChoice }
  | { type: 'secret'; contestantId: string };
export type VersatilityPhase =
  | 'briefing'
  | 'credits'
  | 'draft'
  | 'practice'
  | 'intervention'
  | 'guest-reveal'
  | 'performances'
  | 'breakthroughs'
  | 'ranking'
  | 'holding'
  | 'expulsion'
  | 'peer-mvp'
  | 'secret-choice'
  | 'secret-result'
  | 'complete';
export interface VersatilitySlot {
  id: string;
  teamId: string;
  partId: string;
  track: VersatilityTrack;
}
export interface VersatilityDraftPick {
  contestantId: string;
  availableSlotIds: string[];
  slotId: string;
  tactic: 'professional' | 'gamble' | 'stronger';
  gamble: number;
  preferredTracks: VersatilityTrack[];
  affection: Record<string, number>;
}
export interface VersatilityTeam extends BattleTeam {
  leaderContestants: Contestant[];
  centerContestants: Contestant[];
  leaderElection: TrackSpecialElection | null;
  centerElection: TrackSpecialElection | null;
  intervention: { contestantIds: string[]; description: string; choice: BattleConflictChoice | null } | null;
}
export interface VersatilityEvaluation {
  contestantId: string;
  track: VersatilityTrack;
  partId: string;
  rawDice: AuditionDice;
  baseSkill: number;
  effectiveGuestSkill: number;
  matchedSpecialty: { field: keyof Specialties; value: string } | null;
  trackCheck: BattleCheck;
  guestTrackCheck: BattleCheck;
  stageCheck: BattleCheck;
  potentialCheck: BattleCheck;
  uniquenessCheck: BattleCheck;
  visualCheck: BattleCheck;
  consistencyCheck: BattleCheck;
  leadershipCheck: BattleCheck;
  john: number;
  megan: number;
  michael: number;
  guest: number;
  weightedScore: number;
  practice: number;
  coordination: number;
  refusalPenalty: 0 | -10;
  centerBonus: number;
  finalScore: number;
  grade: AuditionGrade;
  expressive: boolean;
  description: string;
}
export interface VersatilityBreakthrough {
  contestantId: string;
  skill: keyof CoreSkills;
  before: number;
  after: number;
  gateDie: number;
  potentialDie: number;
  potential: number;
  passed: boolean;
}
export interface VersatilityExpulsion {
  contestantId: string;
  cardId: string;
  assigned: boolean;
  result: SecretResult;
  survivorIds: string[];
  eligibleIds: string[];
  incomingTotals: Record<string, number>;
  relationships: Record<string, Record<string, number>>;
  tieKeys: Record<string, number>;
  fallbackPool: { cardId: string; weight: number }[];
  assignmentDraw: number | null;
  beforeContestants: Contestant[];
}
export interface VersatilityEpisode {
  version: 1;
  phase: VersatilityPhase;
  revision: number;
  lastAction: { revision: number; action: VersatilityAction };
  participantIds: string[];
  startingContestants: Contestant[];
  previousRankedIds: string[];
  openingCast: string[];
  teams: VersatilityTeam[];
  slots: VersatilitySlot[];
  draftOrder: string[];
  draftTieKeys: Record<string, number>;
  slotTieKeys: Record<string, Record<string, number>>;
  draftPicks: VersatilityDraftPick[];
  frozenRelationships: Record<string, Record<string, number>>;
  priorPractice: Record<string, number>;
  teamCursor: number;
  practiceCursor: number;
  performanceOrder: string[];
  conflict: { teamId: string; contestantIds: string[]; description: string } | null;
  refusals: { contestantId: string; teamId: string; leaderId: string; penalty: -10 }[];
  guestId: string | null;
  guestDraw: number | null;
  performances: {
    teamId: string;
    evaluations: VersatilityEvaluation[];
    meanScore: number;
    finalScore: number;
    comments: { judgeId: string; description: string }[];
  }[];
  breakthroughs: VersatilityBreakthrough[];
  evidence: {
    contestantId: string;
    finalScore: number;
    observedScore: number;
    reception: number;
    category: string;
  }[];
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
  fanTransfers: { survivorIds: string[]; before: ShowAudience; after: ShowAudience; random: number[] }[];
  secretCandidates: string[];
  investigationEligibleIds: string[];
  investigationContestants: Contestant[];
  secret: SecretResult | null;
  rankedIds: string[];
  survivorIds: string[];
  eliminatedIds: string[];
  expelledId: string | null;
  expulsion: VersatilityExpulsion | null;
  rankRevealed: boolean;
  sealedRankingScores: Record<string, number>;
  rankingTieKeys: Record<string, number>;
  scenes: EpisodeScene[];
  changes: Record<string, PropertyChange[]>;
}
