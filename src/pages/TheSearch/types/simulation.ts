import type { AuditionSong } from './audition';
import type { AuditionEpisode, DeferredConsequence, ShowAudience } from './audition-episode';
import type { BattleEpisode, BattleSong } from './battle-episode';
import type { BootcampEpisode } from './bootcamp-episode';
import type { AttributeCard } from './common';
import type { Contestant, Specialties } from './contestant';
import type { EpisodePreparation } from './narrative';

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
  battleSongs?: BattleSong[];
}

export interface SeasonRuntime {
  progression?: {
    version: 1;
    baseline: string[];
    awards: Record<string, { tv: number; experience: number }>;
  };
  version: 1 | 2 | 3;
  runId: string;
  seed: number;
  randomState: number;
  episode: 0 | 1 | 2 | 3;
  phase: 'setup-complete' | 'auditions' | 'battles' | 'bootcamp' | 'episode-complete';
  setup: {
    useBias: boolean;
    selectedIds: string[];
    auditionPoolIds?: string[];
  };
  sourceContestants: Record<string, Contestant>;
  initialContestants: Contestant[];
  definitions: SimulationDefinitions;
  audition: AuditionEpisode | null;
  battle?: BattleEpisode | null;
  bootcamp?: BootcampEpisode | null;
  openingCast?: string[];
  preparations?: Partial<Record<1 | 2 | 3, EpisodePreparation>>;
  show: ShowAudience;
  revealedSecrets: { contestantId: string; cardId: string }[];
  deferredConsequences: DeferredConsequence[];
}

export function isNarrativeSeason(runtime: { version: number } | null | undefined): boolean {
  return runtime?.version === 2 || runtime?.version === 3;
}

export interface SimulationState {
  contestants: Contestant[];
  status: 'idle' | 'initializing' | 'ready';
  createdAt: number;
  runtime: SeasonRuntime | null;
  persistenceError: string | null;
}
