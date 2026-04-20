import { Store } from '@tanstack/react-store';
import type { Contestant } from '../types/contestant';

/**
 * Simulation state structure
 */
export interface SimulationState {
  /**
   * Array of contestants in the current simulation
   */
  contestants: Contestant[];
  /**
   * Current episode number (0 = initialization)
   */
  episode: number;
  /**
   * Simulation status
   */
  status: 'idle' | 'initializing' | 'ready' | 'running' | 'paused' | 'completed';
  /**
   * Timestamp when simulation was created
   */
  createdAt: number;
  /**
   * Episode history snapshots (for future use)
   */
  history: unknown[];
}

/**
 * Initial simulation state
 */
const initialState: SimulationState = {
  contestants: [],
  episode: 0,
  status: 'idle',
  createdAt: 0,
  history: [],
};

/**
 * LocalStorage key for persisting simulation state
 */
const STORAGE_KEY = 'the-search-simulation-state';

/**
 * Load simulation state from localStorage
 */
function loadFromStorage(): SimulationState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
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
      contestants,
      episode: 0,
      status: 'ready',
      createdAt: Date.now(),
      history: [],
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
      contestants,
    }));
  },
};
