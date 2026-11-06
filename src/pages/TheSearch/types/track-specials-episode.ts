import type { AuditionDice, AuditionGrade, AuditionLevel } from './audition';
import type { AudienceOutcome, EpisodeScene, MvpResult, SecretResult } from './audition-episode';
import type { BattleCheck, BattleConflictChoice, BattleTeam } from './battle-episode';
import type { PropertyChange } from './common';
import type { Contestant, PersonalityTraits } from './contestant';
import type { PreparationAction } from './narrative';

export type TrackSpecialTrack = Contestant['track'];
export interface TrackSpecialSong {
  id: string;
  title: string;
  description: string;
  track: TrackSpecialTrack;
  genre: string;
  favoredSpecialties: string[];
  arrangements: Record<
    '1' | '2' | '3' | '4',
    {
      id: string;
      name: string;
      requiredLevel: AuditionLevel;
    }[]
  >;
}
export type TrackSpecialsAction =
  | PreparationAction
  | { type: 'start' }
  | { type: 'advance' }
  | { type: 'conflict'; choice: BattleConflictChoice }
  | { type: 'secret'; contestantId: string };
export type TrackSpecialsPhase =
  | 're-lodging'
  | 'credits'
  | 'grouping'
  | 'practice'
  | 'intervention'
  | 'jury-reveal'
  | 'performances'
  | 'awards-best'
  | 'awards-worst'
  | 'finale'
  | 'secret-choice'
  | 'secret-result'
  | 'ranking'
  | 'complete';
export interface TrackSpecialElection {
  ballots: Record<string, string>;
  preferences: Record<string, Record<string, number>>;
  totals: Record<string, number>;
  tieKeys: Record<string, number>;
  winnerId: string;
  appointed: boolean;
}
export interface TrackSpecialTeam extends BattleTeam {
  track: TrackSpecialTrack;
  affinity: number;
  groupingTieKey: number;
  songPreferences: Record<string, { specialty: number; genre: number; tieKey: number }>;
  leaderElection: TrackSpecialElection | null;
  centerElection: TrackSpecialElection | null;
  partTieKeys: Record<string, number>;
  intervention: null | {
    contestantIds: string[];
    description: string;
    choice: BattleConflictChoice | null;
  };
}
export interface TrackSpecialEvaluation {
  contestantId: string;
  partId: string;
  rawDice: AuditionDice;
  trackCheck: BattleCheck;
  stageCheck: BattleCheck;
  visualCheck: BattleCheck;
  uniquenessCheck: BattleCheck;
  practice: number;
  coordination: number;
  revealReadiness: number;
  centerBonus: number;
  technicalScore: number;
  rawScore: number;
  finalScore: number;
  grade: AuditionGrade;
  description: string;
}
export interface TrackSpecialPerformance {
  teamId: string;
  evaluations: TrackSpecialEvaluation[];
  meanScore: number;
  finalScore: number;
  comments: { judgeId: 'john' | 'megan' | 'michael'; description: string }[];
  reactions: { jurorId: string; contestantId: string; relationship: number; description: string }[];
}
export type TrackSpecialCategory =
  | 'group'
  | 'overall'
  | 'vocalist'
  | 'rapper'
  | 'dancer'
  | 'visual'
  | 'uniqueness';
export interface TrackSpecialJuror {
  contestantId: string;
  profile: 'objective' | 'biased' | 'blended';
  traits: PersonalityTraits;
  relationships: Record<string, number>;
  departure: { rank: number; status: Contestant['status']; events: string[] };
}
export interface TrackSpecialAward {
  category: TrackSpecialCategory;
  status: 'contested' | 'uncontested' | 'not-contested';
  eligibleIds: string[];
  objectiveEvidence: Record<string, number>;
  preferences: Record<string, Record<string, number>>;
  tieKeys: Record<string, Record<string, number>>;
  tallyTieKeys: Record<string, number>;
  ballots: Record<string, { bestId: string; worstId: string | null }>;
  bestTotals: Record<string, number>;
  worstTotals: Record<string, number>;
  bestId: string | null;
  worstId: string | null;
}
export interface TrackSpecialsEpisode {
  version: 1;
  phase: TrackSpecialsPhase;
  revision: number;
  lastAction: { revision: number; action: TrackSpecialsAction };
  participantIds: string[];
  startingContestants: Contestant[];
  previousRankedIds: string[];
  rooms: { id: string; memberIds: string[] }[];
  roomMoves: { contestantId: string; fromRoomId: string | null; toRoomId: string }[];
  closedRoomIds: string[];
  teams: TrackSpecialTeam[];
  grouping: {
    track: TrackSpecialTrack;
    sizes: number[];
    affinity: number;
    tieKeys: Record<string, number>;
  }[];
  frozenRelationships: Record<string, Record<string, number>>;
  frozenTraits: Record<string, PersonalityTraits>;
  priorPractice: Record<string, number>;
  teamCursor: number;
  practiceCursor: number;
  performanceOrder: string[];
  performances: TrackSpecialPerformance[];
  conflict: { teamId: string; contestantIds: string[]; description: string } | null;
  juryIds: string[];
  juryProfiles: TrackSpecialJuror[];
  juryRevealed: boolean;
  revealEffects: Record<
    string,
    {
      readiness: 0 | -5;
      happinessBefore: number;
      happinessAfter: number;
      happinessDelta: number;
      conditionBefore: string;
      conditionAfter: string;
      description: string;
    }
  >;
  awards: TrackSpecialAward[];
  bestAnnounced: boolean;
  worstAnnounced: boolean;
  awardHappinessBaseline: Record<string, number>;
  awardEffects: Record<string, { factors: number[]; multiplier: number; happiness: number }>;
  evidence: {
    contestantId: string;
    finalScore: number;
    observedScore: number;
    reception: number;
    category: string;
  }[];
  exposure: Record<string, number>;
  audience: AudienceOutcome | null;
  mvp: MvpResult | null;
  sealedRankingScores: Record<string, number>;
  rankingTieKeys: Record<string, number>;
  secretCandidates: string[];
  secret: SecretResult | null;
  rankedIds: string[];
  survivorIds: string[];
  eliminatedId: string | null;
  rankRevealed: boolean;
  scenes: EpisodeScene[];
  changes: Record<string, PropertyChange[]>;
}
