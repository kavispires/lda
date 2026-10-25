import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { Contestant } from '../types/contestant';
import type { SimulationState } from '../types/simulation';
import { TRACKS } from '../utilities/constants';
import { createContestant } from '../utilities/contestant-factory';
import { createSeededRandom } from './random';
import { createSeasonSetup } from './season-setup';
import {
  decodeSimulationState,
  encodeSimulationState,
  loadSimulationState,
  SIMULATION_STORAGE_KEY,
} from './simulation-persistence';

function sourcePool(): Record<string, Contestant> {
  return Object.fromEntries(
    Array.from({ length: 66 }, (_, index) => {
      const id = `test-${index}`;
      return [
        id,
        createContestant({
          id,
          name: `Contestant ${index}`,
          updatedAt: 1,
          track: Object.values(TRACKS)[index % 3],
          aggregations: {
            ...createContestant({ id, name: id }).aggregations,
            practice: 4,
          },
        }),
      ];
    }),
  );
}

const options = { seed: 12345, runId: 'test-season', now: 123456, formatVersion: 1 as const };

test('season setup excludes self from every contestant relationship map', () => {
  const setup = createSeasonSetup(sourcePool(), options);
  for (const contestant of setup.contestants) {
    assert.equal(Object.hasOwn(contestant.relationships, contestant.id), false);
    assert.equal(Object.keys(contestant.relationships).length, 49);
    assert.deepEqual(
      setup.runtime.initialContestants.find((entry) => entry.id === contestant.id)?.relationships,
      contestant.relationships,
    );
  }
});

test('seeded draws resume exactly from their persisted state and reject invalid seeds', () => {
  const random = createSeededRandom(0);
  const first = random.next();
  assert.ok(first >= 0 && first < 1);
  const resumed = createSeededRandom(random.getState());
  assert.deepEqual([random.next(), random.next()], [resumed.next(), resumed.next()]);
  for (const seed of [-1, 1.5, Number.NaN, 0x100000000]) {
    assert.throws(() => createSeededRandom(seed), /32-bit/);
  }
});

test('setup is reproducible, captures complete histories and isolates all source/snapshot references', () => {
  const pool = sourcePool();
  const original = structuredClone(pool);
  const first = createSeasonSetup(pool, options);
  const second = createSeasonSetup(pool, options);
  assert.deepEqual(first, second);
  assert.deepEqual(pool, original);
  assert.equal(first.contestants.length, 50);
  assert.deepEqual(
    first.contestants.map((contestant) => contestant.rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
  );
  for (const contestant of first.contestants) {
    assert.equal(contestant.changeLog.find((entry) => entry.phaseId === 'setup')?.rank, contestant.rank);
  }
  assert.equal(new Set(first.runtime.setup.selectedIds).size, 50);
  assert.ok(first.contestants.every((contestant) => contestant.aggregations.practice === 0));
  assert.notEqual(first.runtime.randomState, first.runtime.seed);
  const current = first.contestants[0];
  const setupHistory = current.changeLog.find((entry) => entry.phaseId === 'setup');
  assert.ok(setupHistory);
  for (const path of ['attributes', 'persona', 'relationships', 'aggregations.practice', 'updatedAt']) {
    assert.ok(
      setupHistory.changes?.some((change) => change.path === path || change.path.startsWith(`${path}.`)),
      path,
    );
  }
  current.coreSkills.vocals = 1;
  current.relationships[first.contestants[1].id].push(90);
  assert.deepEqual(pool, original);
  assert.notDeepEqual(current, first.runtime.initialContestants[0]);
  pool[current.id].name = 'Edited database profile';
  assert.notEqual(first.runtime.sourceContestants[current.id].name, pool[current.id].name);
  assert.ok(Object.isFrozen(first.runtime.sourceContestants[current.id].coreSkills));
  assert.ok(Object.isFrozen(first.runtime.definitions.auditionSongs));
  assert.throws(() => {
    first.runtime.initialContestants[0].name = 'Overwrite snapshot';
  }, TypeError);
});

test('new runtime round-trips without rerolls and legacy setups remain inspectable without fabricated snapshots', () => {
  const setup = createSeasonSetup(sourcePool(), options);
  const state: SimulationState = { ...setup, status: 'ready', persistenceError: null };
  const serialized = JSON.stringify(state);
  const restored = decodeSimulationState(serialized);
  assert.deepEqual(restored, JSON.parse(serialized));
  assert.ok(Object.isFrozen(restored.runtime?.definitions.auditionSongs));
  assert.ok(Object.isFrozen(restored.runtime?.initialContestants[0].coreSkills));
  const archived = structuredClone(state);
  if (!archived.runtime) assert.fail('Missing runtime');
  const definitions = archived.runtime.definitions;
  definitions.specialties.genreAffinity = {
    ARCHIVED_GENRE: {
      ...Object.values(definitions.specialties.genreAffinity)[0],
      id: 'ARCHIVED_GENRE',
    },
  };
  definitions.auditionSongs = definitions.auditionSongs.map((song) => ({ ...song, genre: 'ARCHIVED_GENRE' }));
  assert.ok(definitions.battleSongs);
  definitions.battleSongs = definitions.battleSongs.map((song) => ({ ...song, genre: 'ARCHIVED_GENRE' }));
  assert.ok(definitions.megaGroupSongs);
  definitions.megaGroupSongs = definitions.megaGroupSongs.map((song) => ({
    ...song,
    genre: 'ARCHIVED_GENRE',
  }));
  assert.equal(
    decodeSimulationState(JSON.stringify(archived)).runtime?.definitions.auditionSongs[0].genre,
    'ARCHIVED_GENRE',
  );
  assert.equal(
    decodeSimulationState(JSON.stringify(archived)).runtime?.definitions.battleSongs?.[0].genre,
    'ARCHIVED_GENRE',
  );
  assert.equal(
    decodeSimulationState(JSON.stringify(archived)).runtime?.definitions.megaGroupSongs?.[0].genre,
    'ARCHIVED_GENRE',
  );
  const legacyContestants = state.contestants.map((contestant) => {
    const { genreAffinity: _genre, ...specialties } = contestant.specialties;
    const { practice: _practice, ...aggregations } = contestant.aggregations;
    return { ...contestant, specialties, aggregations };
  });
  const legacy = decodeSimulationState(
    JSON.stringify({
      contestants: legacyContestants,
      status: 'ready',
      createdAt: state.createdAt,
    }),
  );
  assert.equal(legacy.runtime, null);
  assert.ok(legacy.contestants.every((contestant) => contestant.aggregations.practice === 0));
  assert.ok(legacy.contestants.every((contestant) => contestant.specialties.genreAffinity === ''));
  assert.deepEqual(legacy.contestants[0].changeLog, state.contestants[0].changeLog);
});

test('corrupt or unsupported saves report a visible error and are not silently overwritten', () => {
  for (const stored of ['{broken', '{}', JSON.stringify({ contestants: [] })]) {
    const result = loadSimulationState({ getItem: () => stored });
    assert.match(result.persistenceError ?? '', /Could not restore/);
    assert.equal(result.contestants.length, 0);
  }
  const setup = createSeasonSetup(sourcePool(), options);
  const state: SimulationState = { ...setup, status: 'ready', persistenceError: null };
  const wrongVersion = structuredClone(state);
  if (!wrongVersion.runtime) assert.fail('Missing runtime');
  Object.assign(wrongVersion.runtime, { version: 999 });
  assert.throws(() => decodeSimulationState(JSON.stringify(wrongVersion)), /unsupported version/);
  const mismatched = structuredClone(state);
  if (!mismatched.runtime) assert.fail('Missing runtime');
  mismatched.runtime.setup.selectedIds[0] = 'not-in-cast';
  assert.throws(() => decodeSimulationState(JSON.stringify(mismatched)), /does not match/);
  const valid = loadSimulationState({
    getItem(key) {
      assert.equal(key, SIMULATION_STORAGE_KEY);
      return JSON.stringify(state);
    },
  });
  assert.equal(valid.persistenceError, null);
});

test('compressed saves preserve Unicode and reject corruption or unsupported storage versions', () => {
  const state: SimulationState = {
    ...createSeasonSetup(sourcePool(), options),
    status: 'ready',
    persistenceError: null,
  };
  state.contestants[0].name = 'Performer \u00e9 \ud83c\udfb5';
  const encoded = encodeSimulationState(state);
  assert.deepEqual(decodeSimulationState(encoded), JSON.parse(JSON.stringify(state)));
  for (const stored of [encoded.slice(0, 32), encoded.replace(':1:', ':999:')]) {
    const restored = loadSimulationState({ getItem: () => stored });
    assert.match(restored.persistenceError ?? '', /Could not restore/);
    assert.equal(restored.runtime, null);
    assert.equal(restored.contestants.length, 0);
  }
});

test('runtime actions publish only after persistence succeeds and leave the database pool untouched', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const stored = new Map<string, string>();
  let failWrites = false;
  const storage = {
    getItem(key: string) {
      return stored.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (failWrites) throw new Error('Storage is full');
      stored.set(key, value);
    },
    removeItem(key: string) {
      if (failWrites) throw new Error('Storage is unavailable');
      stored.delete(key);
    },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  try {
    const pool = sourcePool();
    const original = structuredClone(pool);
    simulationActions.initializeSimulation(pool, { seed: options.seed });
    const ready = simulationStore.state;
    assert.deepEqual(pool, original);
    assert.equal(ready.status, 'ready');
    assert.deepEqual(
      decodeSimulationState(stored.get(SIMULATION_STORAGE_KEY) ?? ''),
      JSON.parse(JSON.stringify(ready)),
    );
    failWrites = true;
    assert.throws(() => simulationActions.initializeSimulation(pool, { seed: 42 }), /Storage is full/);
    assert.equal(simulationStore.state, ready);
    assert.throws(() => simulationActions.clearSimulation(), /Storage is unavailable/);
    assert.equal(simulationStore.state, ready);
    failWrites = false;
    simulationActions.clearSimulation();
    assert.equal(simulationStore.state.status, 'idle');
    assert.equal(stored.has(SIMULATION_STORAGE_KEY), false);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
