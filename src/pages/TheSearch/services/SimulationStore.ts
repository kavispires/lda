import { Store } from '@tanstack/react-store';
import { transitionAudition } from '../engine/audition-episode';
import { transitionBattle } from '../engine/battle-episode';
import { transitionBootcamp } from '../engine/bootcamp-episode';
import { autoCompleteEpisode, type EpisodeNumber } from '../engine/episode-auto-complete';
import { transitionMegaGroups } from '../engine/mega-groups-episode';
import { transitionNarrativeAudition, transitionNarrativeBattle } from '../engine/narrative-audition';
import { transitionBattleStory } from '../engine/narrative-battle';
import { transitionPhotoshoot } from '../engine/photoshoot-episode';
import { createSeasonSetup } from '../engine/season-setup';
import {
  emptySimulationState,
  encodeSimulationState,
  loadSimulationState,
  SIMULATION_STORAGE_KEY,
} from '../engine/simulation-persistence';
import { transitionTrackSpecials } from '../engine/track-specials-episode';
import type { AuditionAction } from '../types/audition-episode';
import type { BattleAction } from '../types/battle-episode';
import type { BootcampAction } from '../types/bootcamp-episode';
import type { Contestant } from '../types/contestant';
import type { MegaGroupsAction } from '../types/mega-groups-episode';
import type { PhotoshootAction } from '../types/photoshoot-episode';
import { isNarrativeSeason, type SimulationState } from '../types/simulation';
import type { TrackSpecialsAction } from '../types/track-specials-episode';

export type { SimulationState } from '../types/simulation';

function loadFromStorage(): SimulationState {
  if (typeof window === 'undefined') return emptySimulationState();
  try {
    return loadSimulationState(window.localStorage);
  } catch (error) {
    return {
      ...emptySimulationState(),
      persistenceError: `Could not access simulation storage: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const simulationStore = new Store<SimulationState>(loadFromStorage());

function commitState(next: SimulationState): void {
  // Save before publishing state so a failed write cannot look like a completed phase.
  window.localStorage.setItem(SIMULATION_STORAGE_KEY, encodeSimulationState(next));
  simulationStore.setState(() => next);
}

export const simulationActions = {
  async autoCompleteEpisode(episode: EpisodeNumber, expectedState: SimulationState) {
    if (simulationStore.state !== expectedState)
      throw new Error('The simulation changed. Retry auto-completing the current episode.');
    const next = await autoCompleteEpisode(expectedState, episode);
    if (simulationStore.state !== expectedState)
      throw new Error('The simulation changed during auto-completion. Your latest progress was kept.');
    if (next !== expectedState) commitState(next);
  },

  initializeSimulation(
    sourceContestants: Record<string, Contestant>,
    options: { useBias?: boolean; seed?: number } = {},
  ) {
    const setup = createSeasonSetup(sourceContestants, {
      seed: options.seed ?? crypto.getRandomValues(new Uint32Array(1))[0],
      runId: crypto.randomUUID(),
      now: Date.now(),
      useBias: options.useBias,
    });
    commitState({ ...setup, status: 'ready', persistenceError: null });
  },

  clearSimulation() {
    window.localStorage.removeItem(SIMULATION_STORAGE_KEY);
    simulationStore.setState(emptySimulationState);
  },

  dispatchAudition(action: AuditionAction, expectedRevision: number) {
    const current = simulationStore.state;
    const next = isNarrativeSeason(current.runtime)
      ? transitionNarrativeAudition(current, action, expectedRevision)
      : transitionAudition(current, action, expectedRevision);
    if (next !== current) commitState(next);
  },

  dispatchBattle(action: BattleAction, expectedRevision: number) {
    const current = simulationStore.state;
    const next =
      current.runtime?.version === 3
        ? transitionBattleStory(current, action, expectedRevision)
        : current.runtime?.version === 2
          ? transitionNarrativeBattle(current, action, expectedRevision)
          : transitionBattle(current, action, expectedRevision);
    if (next !== current) commitState(next);
  },

  dispatchBootcamp(action: BootcampAction, expectedRevision: number) {
    const current = simulationStore.state;
    const next = transitionBootcamp(current, action, expectedRevision);
    if (next !== current) commitState(next);
  },

  dispatchMegaGroups(action: MegaGroupsAction, expectedRevision: number) {
    const current = simulationStore.state;
    const next = transitionMegaGroups(current, action, expectedRevision);
    if (next !== current) commitState(next);
  },

  dispatchPhotoshoot(action: PhotoshootAction, expectedRevision: number) {
    const current = simulationStore.state;
    const next = transitionPhotoshoot(current, action, expectedRevision);
    if (next !== current) commitState(next);
  },

  dispatchTrackSpecials(action: TrackSpecialsAction, expectedRevision: number) {
    const current = simulationStore.state;
    const next = transitionTrackSpecials(current, action, expectedRevision);
    if (next !== current) commitState(next);
  },
};
