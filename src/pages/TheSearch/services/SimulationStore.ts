import { Store } from '@tanstack/react-store';
import type { Contestant } from '../types/contestant';
import { normalizeContestant } from '../utilities/contestant-factory';

/**
 * Simulation state structure
 */
export interface SimulationState {
  /**
   * Array of contestants in the current simulation
   */
  contestants: Contestant[];
  /**
   * Simulation status
   */
  status: 'idle' | 'initializing' | 'ready';
  /**
   * Timestamp when simulation was created
   */
  createdAt: number;
}

/**
 * Initial simulation state
 */
const initialState: SimulationState = {
  contestants: [],
  status: 'idle',
  createdAt: 0,
};

/**
 * LocalStorage key for persisting simulation state
 */
// Keep setup state separate from incompatible legacy episode results.
const STORAGE_KEY = 'the-search-simulation-setup';

/**
 * Load simulation state from localStorage
 */
function loadFromStorage(): SimulationState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const state: SimulationState = JSON.parse(stored);
      return {
        ...state,
        contestants: state.contestants.map(normalizeContestant),
      };
    }
  } catch {
    // Silent error - return initial state
  }
  return initialState;
}

/**
 * Save simulation state to localStorage
 */
function saveToStorage(state: SimulationState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silent error - localStorage might be full or unavailable
  }
}

/**
 * Create the simulation store with localStorage persistence
 */
export const simulationStore = new Store<SimulationState>(loadFromStorage());

/**
 * Subscribe to store changes and persist to localStorage
 */
simulationStore.subscribe(() => {
  saveToStorage(simulationStore.state);
});

/**
 * Store actions
 */
export const simulationActions = {
  /**
   * Initialize a new simulation with contestants
   */
  initializeSimulation(contestants: Contestant[]) {
    simulationStore.setState((state) => ({
      ...state,
      contestants: contestants.map((contestant) =>
        normalizeContestant({
          ...contestant,
          aggregations: { ...contestant.aggregations, practice: 0 },
        }),
      ),
      status: 'ready',
      createdAt: Date.now(),
    }));
  },

  /**
   * Update simulation status
   */
  setStatus(status: SimulationState['status']) {
    simulationStore.setState((state) => ({
      ...state,
      status,
    }));
  },

  /**
   * Clear the simulation
   */
  clearSimulation() {
    simulationStore.setState(() => initialState);
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * Update contestants
   */
  updateContestants(contestants: Contestant[]) {
    simulationStore.setState((state) => ({
      ...state,
      contestants: contestants.map(normalizeContestant),
    }));
  },
};
