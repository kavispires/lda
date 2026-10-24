import type { AuditionSong } from './audition';
import type { AuditionEpisode, DeferredConsequence, ShowAudience } from './audition-episode';
import type { AttributeCard } from './common';
import type { Contestant, Specialties } from './contestant';

export interface SimulationDefinitions {
  cards: {
    persona: Record<string, AttributeCard>;
    identity: Record<string, AttributeCard>;
    interest: Record<string, AttributeCard>;
    secret: Record<string, AttributeCard>;
  };
  specialties: Record<keyof Specialties, Record<string, AttributeCard>>;
  zodiacSigns: Record<string, AttributeCard>;
  auditionSongs: AuditionSong[];
}

export interface SeasonRuntime {
  version: 1;
  runId: string;
  seed: number;
  randomState: number;
  episode: 0 | 1;
  phase: 'setup-complete' | 'auditions' | 'episode-complete';
  setup: {
    useBias: boolean;
    selectedIds: string[];
    auditionPoolIds?: string[];
  };
  sourceContestants: Record<string, Contestant>;
  initialContestants: Contestant[];
  definitions: SimulationDefinitions;
  audition: AuditionEpisode | null;
  show: ShowAudience;
  revealedSecrets: { contestantId: string; cardId: string }[];
  deferredConsequences: DeferredConsequence[];
}

export interface SimulationState {
  contestants: Contestant[];
  status: 'idle' | 'initializing' | 'ready';
  createdAt: number;
  runtime: SeasonRuntime | null;
  persistenceError: string | null;
}
