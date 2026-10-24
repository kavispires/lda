import { Store } from '@tanstack/react-store';
import { transitionAudition } from '../engine/audition-episode';
import { transitionBattle } from '../engine/battle-episode';
import { transitionNarrativeAudition, transitionNarrativeBattle } from '../engine/narrative-audition';
import { createSeasonSetup } from '../engine/season-setup';
import {
  emptySimulationState,
  loadSimulationState,
  SIMULATION_STORAGE_KEY,
} from '../engine/simulation-persistence';
import type { AuditionAction } from '../types/audition-episode';
import type { BattleAction } from '../types/battle-episode';
import type { Contestant } from '../types/contestant';
import type { SimulationState } from '../types/simulation';

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
  window.localStorage.setItem(SIMULATION_STORAGE_KEY, JSON.stringify(next));
  simulationStore.setState(() => next);
}

export const simulationActions = {
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
    const next =
      current.runtime?.version === 2
        ? transitionNarrativeAudition(current, action, expectedRevision)
        : transitionAudition(current, action, expectedRevision);
    if (next !== current) commitState(next);
  },

  dispatchBattle(action: BattleAction, expectedRevision: number) {
    const current = simulationStore.state;
    const next =
      current.runtime?.version === 2
        ? transitionNarrativeBattle(current, action, expectedRevision)
        : transitionBattle(current, action, expectedRevision);
    if (next !== current) commitState(next);
  },
};
