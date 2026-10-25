import type { AuditionDice, AuditionGrade } from './audition';
import type {
  AudienceOutcome,
  EpisodeScene,
  MoodChoices,
  MvpResult,
  SecretResult,
  ShowAudience,
} from './audition-episode';
import type { BattleCheck, BattleConflictChoice } from './battle-episode';
import type { PropertyChange } from './common';
import type { Contestant } from './contestant';
import type { PreparationAction } from './narrative';
import type { TrackSpecialElection } from './track-specials-episode';

export interface VarietyShowChallenge {
  id: string;
  name: string;
  description: string;
  difficulty: 3;
}
export interface VarietyShowCatalog {
  version: 1;
  physicalGames: VarietyShowChallenge[];
  interviewPrompts: VarietyShowChallenge[];
  improvScenes: VarietyShowChallenge[];
  propBoxes: VarietyShowChallenge[];
  guest: { id: 'roxana'; name: 'Roxana Michaels'; role: 'Actress' };
}
export type VarietyShowAction =
  | PreparationAction
  | { type: 'start' }
  | { type: 'advance' }
  | { type: 'conflict'; choice: BattleConflictChoice }
  | { type: 'secret'; contestantId: string };
export type VarietyShowPhase =
  | 'briefing'
  | 'credits'
  | 'icebreaker'
  | 'team-draw'
  | 'physical'
  | 'interviews'
  | 'improv-preparation'
  | 'intervention'
  | 'improv'
  | 'panel'
  | 'peer-mvp'
  | 'secret-choice'
  | 'secret-result'
  | 'ranking'
  | 'elimination'
  | 'complete';
export type VarietyShowSegmentKind = 'physical' | 'interview' | 'improv';
export interface VarietyShowEvent {
  kind:
    | 'hype'
    | 'stiff'
    | 'thoughtful'
    | 'calculated-fumble'
    | 'sensitive-fumble'
    | 'shy-recovery'
    | 'recovery';
  description: string;
  personal: number;
  reception: number;
  spotlight: number;
  comic: number;
}
export interface VarietyShowEvaluation {
  contestantId: string;
  rawDice: AuditionDice;
  checks: { charisma: BattleCheck; stamina: BattleCheck | null; acrobatics: BattleCheck | null };
  normalizedTraits: { sincerity: number; maturity: number; curiosity: number; extroversion: number };
  baseScore: number;
  events: VarietyShowEvent[];
  modifier: number;
  receptionModifier: number;
  personalScore: number;
  finalScore: number | null;
  grade: AuditionGrade | null;
  description: string;
}
export interface VarietyShowSegment {
  kind: VarietyShowSegmentKind;
  teamId: string;
  challengeId: string;
  challengeDraw: number | null;
  promptIds: Record<string, string>;
  promptDraws: Record<string, number>;
  evaluations: VarietyShowEvaluation[];
  teamScore: number | null;
  cohesion: number;
  coordination: number;
  chaosPenalty: 0 | -15;
  frozenContestants: Contestant[];
}
export interface VarietyShowTeam {
  id: string;
  name: string;
  memberIds: string[];
  leaderId: string | null;
  leaderElection: TrackSpecialElection | null;
  leaderContestants: Contestant[];
  ambitionClash: { contestantIds: [string, string]; gap: number } | null;
  preparation: {
    completed: boolean;
    minutes: 5;
    sceneId: string;
    propBoxId: string;
    sceneDraw: number;
    propDraw: number;
    coordination: number;
    ideas: { contestantId: string; description: string }[];
    conflict: {
      contestantIds: [string, string];
      description: string;
      choice: BattleConflictChoice | null;
    } | null;
  } | null;
}
export interface VarietyShowIceCategory {
  id: string;
  label: string;
  statValues: Record<string, number>;
  shortlistIds: string[];
  ballots: Record<string, string>;
  totals: Record<string, number>;
  winnerId: string;
  ties: {
    shortlist: Record<string, number>;
    ballots: Record<string, Record<string, number>>;
    result: Record<string, number>;
  };
  revealed: boolean;
}
export interface VarietyShowIcebreaker {
  frozenContestants: Contestant[];
  categories: VarietyShowIceCategory[];
  revealCursor: number;
}
export interface VarietyShowPanelAssessment {
  contestantId: string;
  variety: number;
  john: number;
  megan: number;
  michael: number;
  roxana: number;
  finalScore: number;
  grade: AuditionGrade;
  comments: { judgeId: 'john' | 'megan' | 'michael' | 'roxana'; description: string }[];
}
export interface VarietyShowEvidence {
  contestantId: string;
  finalScore: number;
  observedScore: number;
  reception: number;
  category: string;
}
export interface VarietyShowEpisode {
  version: 1;
  randomStartState: number;
  revision: number;
  lastAction: { revision: number; action: VarietyShowAction };
  phase: VarietyShowPhase;
  participantIds: string[];
  startingContestants: Contestant[];
  startingShow: ShowAudience;
  previousRankedIds: string[];
  openingCast: string[];
  icebreaker: VarietyShowIcebreaker | null;
  drawOrder: string[];
  drawRandom: number[];
  drawCursor: number;
  teams: VarietyShowTeam[];
  teamCursor: number;
  conflict: { teamId: string; contestantIds: [string, string]; description: string } | null;
  physicalGameId: string | null;
  segments: VarietyShowSegment[];
  panel: VarietyShowPanelAssessment[];
  evidence: VarietyShowEvidence[];
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
  eliminatedIds: string[];
  rankRevealed: boolean;
  sealedRankingScores: Record<string, number>;
  rankingTieKeys: Record<string, number>;
  fanTransfers: { survivorIds: string[]; before: ShowAudience; after: ShowAudience; random: number[] }[];
  scenes: EpisodeScene[];
  changes: Record<string, PropertyChange[]>;
}
