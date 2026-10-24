import type { AuditionBatchJudging, AuditionEvaluation, AuditionSong } from './audition';
import type { ChangeValue, PropertyChange } from './common';
import type { Specialties } from './contestant';

export type MoodChoices = Record<keyof Specialties, string>;
export type MoodOptions = Record<keyof Specialties, string[]>;
export type AuditionRelationshipPolicy = 'reactions-only' | 'everyone-forms-opinions';
export type AuditionPhase =
  | 'mood'
  | 'choices'
  | 'live'
  | 'broadcast'
  | 'audience'
  | 'eliminations'
  | 'mvp'
  | 'secret'
  | 'complete';

export interface AuditionReaction {
  observerId: string;
  performerId: string;
  type: 'admiration' | 'inspiration' | 'intimidation' | 'jealousy' | 'confidence' | 'sympathy';
  sameSong: boolean;
  gap: number;
  relationshipBefore: number;
  relationshipAfter: number;
  composureBefore: number;
  composureAfter: number;
  narrative: string;
}

export interface EpisodeScene {
  id: string;
  kind:
    | 'opening'
    | 'choices'
    | 'auditions'
    | 'broadcast'
    | 'audience'
    | 'eliminations'
    | 'mvp'
    | 'secret'
    | 'recap';
  title: string;
  paragraphs: string[];
  contestantIds: string[];
}

export interface BroadcastCut {
  id: 'music' | 'personalities' | 'backstage';
  title: string;
  description: string;
  featuredIds: string[];
  footage: { contestantId: string; description: string }[];
  /** Fractions of the total contestant runtime, including baseline coverage. */
  exposure: Record<string, number>;
}

export interface ShowAudience {
  audience: number;
  satisfaction: number;
  general: number;
  fans: Record<string, number>;
  pendingAttrition: number;
}

export interface AudienceOutcome {
  votes: Record<string, number>;
  receptions: Record<string, number>;
  newFans: Record<string, number>;
  votingPopulation: number;
  newViewers: number;
  satisfactionBefore: number;
  satisfactionAfter: number;
  attention: number;
  enjoyment: number;
}

export interface MvpResult {
  ballots: Record<string, string>;
  totals: Record<string, number>;
  winnerId: string;
  tiedIds: string[];
}

export interface DeferredConsequence {
  contestantId: string;
  path: string;
  value: ChangeValue;
  cause: string;
}

export interface SecretResult {
  contestantId: string;
  cardId: string | null;
  title: string;
  description: string;
  deferred: DeferredConsequence[];
}

export type AuditionAction =
  | { type: 'start' }
  | { type: 'mood'; choices: MoodChoices }
  | { type: 'advance' }
  | { type: 'broadcast'; cutId: BroadcastCut['id'] }
  | { type: 'secret'; contestantId: string };

export interface AuditionEpisode {
  version: 1;
  relationshipPolicy: AuditionRelationshipPolicy;
  phase: AuditionPhase;
  revision: number;
  lastAction: { revision: number; action: AuditionAction };
  pool: AuditionSong[];
  moodOptions: MoodOptions;
  mood: MoodChoices | null;
  songChoices: Record<string, string>;
  order: string[];
  cursor: number;
  evaluations: AuditionEvaluation[];
  batches: AuditionBatchJudging[];
  composure: Record<string, number>;
  reactions: AuditionReaction[];
  scenes: EpisodeScene[];
  changes: Record<string, PropertyChange[]>;
  cuts: BroadcastCut[];
  selectedCutId: BroadcastCut['id'] | null;
  audience: AudienceOutcome | null;
  rankedIds: string[];
  survivorIds: string[];
  eliminatedIds: string[];
  revealedEliminations: number;
  mvp: MvpResult | null;
  secretCandidates: string[];
  secret: SecretResult | null;
}
