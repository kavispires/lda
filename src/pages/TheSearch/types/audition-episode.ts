import type { AuditionBatchJudging, AuditionEvaluation, AuditionSong } from './audition';
import type { ChangeValue, PropertyChange } from './common';
import type { Specialties } from './contestant';
import type { NarrativeAuditionStory, PreparationAction } from './narrative';

export type MoodChoices = Record<keyof Specialties, string>;
export type MoodOptions = Record<keyof Specialties, string[]>;
export type AuditionRelationshipPolicy = 'reactions-only' | 'everyone-forms-opinions';
export type AuditionPhase =
  | 'opening-cast'
  | 'host-intro'
  | 'credits'
  | 'judges'
  | 'introduction'
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
  tvMoments?: Record<string, Record<string, 1 | 3 | 6>>;
  kind:
    | 'opening'
    | 'choices'
    | 'auditions'
    | 'broadcast'
    | 'audience'
    | 'eliminations'
    | 'mvp'
    | 'secret'
    | 'dorms'
    | 'ranking'
    | 'draft'
    | 'practice'
    | 'battles'
    | 'saves'
    | 'recap';
  title: string;
  paragraphs: string[];
  contestantIds: string[];
  paragraphContestantIds?: string[][];
  sequence?: number;
  presentation?: NarrativeAuditionStory['presentation'];
  speaker?: { name: string; role: string };
  introductions?: Record<string, string[]>;
  dialogues?: { name: string; role: string; paragraphs: string[]; paragraphContestantIds?: string[][] }[];
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
  | PreparationAction
  | { type: 'start' }
  | { type: 'mood'; choices: MoodChoices }
  | { type: 'advance' }
  | { type: 'broadcast'; cutId: BroadcastCut['id'] }
  | { type: 'secret'; contestantId: string };

export interface AuditionEpisode {
  version: 1 | 2;
  story?: NarrativeAuditionStory;
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
