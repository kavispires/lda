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

export interface SpecialtiesCatalog {
  version: 1;
  songs: {
    id: string;
    name: string;
    description: string;
    arrangements: { VOCAL: string; RAP: string; DANCE: string };
    difficulty: 3;
  }[];
}
export type SpecialtiesAction =
  | PreparationAction
  | { type: 'start' }
  | { type: 'advance' }
  | { type: 'secret'; contestantId: string };
export type SpecialtiesPhase =
  | 'briefing'
  | 'credits'
  | 'friendship'
  | 'friendship-reactions'
  | 'songs'
  | 'rehearsals'
  | 'performances'
  | 'peer-rankings'
  | 'panel'
  | 'ranking'
  | 'elimination'
  | 'peer-mvp'
  | 'secret-choice'
  | 'secret-result'
  | 'farewell'
  | 'complete';
export interface SpecialtiesSong {
  contestantId: string;
  songId: string;
  name: string;
  description: string;
  track: Contestant['track'];
  specialtyId: string;
  specialtyDescription: string;
  visualVibeId: string;
  visualDescription: string;
  arrangement: string;
  difficulty: 3;
}
export interface SpecialtiesRehearsal {
  contestantId: string;
  session: 1 | 2;
  rawDice: AuditionDice;
  checks: BattleCheck[];
  weightedSum: number;
  sessionPractice: number;
  practiceBefore: number;
  practiceAfter: number;
  enduranceStruggle: boolean;
  readinessModifier: 0 | -5;
}
export interface SpecialtiesPerformance {
  contestantId: string;
  songId: string;
  rawDice: AuditionDice;
  checks: Record<
    'track' | 'stagePresence' | 'visual' | 'uniqueness' | 'potential' | 'consistency' | 'leadership',
    BattleCheck
  >;
  matchedTrack: number;
  matchedVisual: number;
  practice: number;
  readinessModifier: number;
  shrinking: boolean;
  adjustedStage: number;
  trainerAwe: boolean;
  technical: number;
  john: number;
  megan: number;
  michael: number;
  observedScore: number;
  comments: { judgeId: 'john' | 'megan' | 'michael'; description: string }[];
}
export interface SpecialtiesFriendship {
  snapshot: Contestant[];
  choices: { contestantId: string; targetId: string; affection: number; tieKeys: Record<string, number> }[];
  revealedIds: string[];
  pairs: [string, string][];
  rewards: {
    contestantId: string;
    happinessBefore: number;
    happinessAfter: number;
    audienceBefore: number;
    audienceAfter: number;
    fanbaseBefore: number;
    fanbaseAfter: number;
  }[];
  reactions: { contestantId: string; before: number; after: number }[];
  reactionsComplete: boolean;
}
export interface SpecialtiesPeer {
  snapshot: Contestant[];
  ballots: {
    voterId: string;
    profile: 'objective' | 'strategic' | 'blended';
    baselineIds: string[];
    threatIds: string[];
    rankedIds: string[];
    tieKeys: Record<string, number>;
    reasons: string[];
  }[];
  received: Record<string, { voterId: string; place: number; score: number }[]>;
  averages: Record<string, number>;
}
export interface SpecialtiesEpisode {
  version: 1;
  randomStartState: number;
  revision: number;
  lastAction: { revision: number; action: SpecialtiesAction };
  phase: SpecialtiesPhase;
  participantIds: string[];
  previousRankedIds: string[];
  startingContestants: Contestant[];
  startingShow: ShowAudience;
  openingCast: string[];
  startingOpeningCast: string[];
  startingPreparation: EpisodePreparation;
  startingRevealedSecrets: { contestantId: string; cardId: string }[];
  startingDeferredConsequences: DeferredConsequence[];
  steps: { revision: number; action: SpecialtiesAction; drawCount: number; endState: number }[];
  friendship: SpecialtiesFriendship | null;
  songs: SpecialtiesSong[];
  songOrder: string[];
  performanceOrder: string[];
  rehearsals: SpecialtiesRehearsal[];
  performances: SpecialtiesPerformance[];
  peer: SpecialtiesPeer | null;
  panel: {
    contestantId: string;
    performance: number;
    john: number;
    megan: number;
    michael: number;
    peer: number;
    finalScore: number;
    grade: AuditionGrade;
  }[];
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
