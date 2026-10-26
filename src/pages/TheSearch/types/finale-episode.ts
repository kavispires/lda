import type { AuditionDice, AuditionGrade } from './audition';
import type {
  AudienceOutcome,
  DeferredConsequence,
  EpisodeScene,
  MoodChoices,
  ShowAudience,
} from './audition-episode';
import type { BattleCheck } from './battle-episode';
import type { PropertyChange } from './common';
import type { Contestant } from './contestant';
import type { EpisodePreparation, PreparationAction } from './narrative';

export interface FinaleCatalog {
  version: 1;
  originals: {
    id: string;
    name: string;
    description: string;
    difficulty: 4;
    parts: { id: string; name: string; staging: string; arrangements: Record<Contestant['track'], string> }[];
  }[];
  theme: { id: 'squirrel-life'; title: 'Squirrel Life'; difficulty: 3; staging: string };
}
export type FinaleAction =
  | PreparationAction
  | { type: 'start' }
  | { type: 'advance' }
  | { type: 'executive'; contestantIds: string[] };
export type FinalePhase =
  | 'briefing'
  | 'draft'
  | 'credits'
  | 'rehearsals'
  | 'executive-choice'
  | 'panel-return'
  | 'originals'
  | 'theme'
  | 'panel'
  | 'tally'
  | 'winner-reveal'
  | 'celebration'
  | 'complete';
export interface FinaleDraftPick {
  captainId: string;
  contestantId: string;
  eligible: {
    contestantId: string;
    stage: number;
    consistency: number;
    ability: number;
    affection: number;
    tieKey: number;
  }[];
}
export interface FinaleTeam {
  captainId: string;
  memberIds: string[];
  songId: string;
  parts: {
    contestantId: string;
    partId: string;
    track: Contestant['track'];
    arrangement: string;
    staging: string;
    tieKey: number;
  }[];
}
export interface FinaleRehearsal {
  contestantId: string;
  session: 1 | 2;
  rawDice: AuditionDice;
  checks: BattleCheck[];
  weightedSum: number;
  sessionPractice: number;
  readinessBefore: number;
  readinessAfter: number;
}
export type FinaleCheckKey =
  | 'track'
  | 'dance'
  | 'stagePresence'
  | 'visual'
  | 'uniqueness'
  | 'potential'
  | 'stamina'
  | 'consistency'
  | 'charisma'
  | 'leadership';
export interface FinalePerformance {
  contestantId: string;
  songId: string;
  rawDice: AuditionDice;
  checks: Record<FinaleCheckKey, BattleCheck>;
  readiness: number;
  base: number;
  breakdownPenalty: number;
  technical: number;
  emotionalPraise: boolean;
}
export type FinaleJudgeId = 'john' | 'megan' | 'michael' | 'jane' | 'doubt-girls' | 'roxana' | 'vivienne';
export interface FinaleAssessment {
  contestantId: string;
  original: number;
  theme: number;
  performance: number;
  judges: Record<FinaleJudgeId, { original: number; theme: number; score: number }>;
  judgeMean: number;
  finalScore: number;
  grade: AuditionGrade;
}
export interface FinaleEpisode {
  version: 1;
  randomStartState: number;
  revision: number;
  lastAction: { revision: number; action: FinaleAction };
  phase: FinalePhase;
  participantIds: string[];
  previousRankedIds: string[];
  startingContestants: Contestant[];
  startingShow: ShowAudience;
  startingOpeningCast: string[];
  startingPreparation: EpisodePreparation;
  startingRevealedSecrets: { contestantId: string; cardId: string }[];
  startingDeferredConsequences: DeferredConsequence[];
  startingGuestId: string;
  openingCast: string[];
  steps: { revision: number; action: FinaleAction; drawCount: number; endState: number }[];
  teams: FinaleTeam[];
  songOrder: string[];
  draftPicks: FinaleDraftPick[];
  rehearsalOrder: string[];
  rehearsals: FinaleRehearsal[];
  supports: {
    captainId: string;
    helperId: string;
    strugglingId: string;
    session: 1 | 2;
    tieKeys: Record<string, number>;
    happinessBefore: number;
    happinessAfter: number;
    towardHelperBefore: number;
    towardHelperAfter: number;
    towardMemberBefore: number;
    towardMemberAfter: number;
  }[];
  executive: {
    contestantIds: string[];
    effects: { contestantId: string; before: number; after: number; rankingBonus: 50 }[];
  } | null;
  personnel: { id: FinaleJudgeId; name: string; role: string }[];
  nerves: { contestantId: string; before: string; after: string }[];
  originalPerformances: FinalePerformance[];
  themePerformances: FinalePerformance[];
  panel: FinaleAssessment[];
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
  sealedRankingScores: Record<string, number>;
  rankingComponents: Record<
    string,
    {
      prior: number;
      performance: number;
      publicVotes: number;
      production: number;
      executive: number;
      total: number;
    }
  >;
  rankingTieKeys: Record<string, number>;
  rankedIds: string[];
  winnerIds: string[];
  revealedWinnerIds: string[];
  centerId: string | null;
  resultsPublished: boolean;
  fanTransfers: { survivorIds: string[]; before: ShowAudience; after: ShowAudience; random: number[] }[];
  postSeason: {
    audience: number;
    satisfaction: number;
    retainedGroupFans: number;
    retainedShare: number;
    nonRetainedViewers: number;
  } | null;
  scenes: EpisodeScene[];
  changes: Record<string, PropertyChange[]>;
}
