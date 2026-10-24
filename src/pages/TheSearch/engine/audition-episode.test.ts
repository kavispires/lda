import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { AuditionAction, AuditionEpisode, MoodChoices } from '../types/audition-episode';
import type { SimulationState } from '../types/simulation';
import { createContestant } from '../utilities/contestant-factory';
import { MOOD_FIELDS, transitionAudition } from './audition-episode';
import { rankAuditions } from './audition-scoring';
import { createSeasonSetup } from './season-setup';
import { decodeSimulationState, SIMULATION_STORAGE_KEY } from './simulation-persistence';

function setup(): SimulationState {
  const source = Object.fromEntries(
    Array.from({ length: 66 }, (_, index) => {
      const id = `audition-${index}`;
      return [
        id,
        createContestant({
          id,
          name: `Performer ${index}`,
          updatedAt: 1,
          track: (['VOCAL', 'RAP', 'DANCE'] as const)[index % 3],
        }),
      ];
    }),
  );
  return {
    ...createSeasonSetup(source, { seed: 12345, runId: 'episode-test', now: 1000, formatVersion: 1 }),
    status: 'ready',
    persistenceError: null,
  };
}

function episode(state: SimulationState): AuditionEpisode {
  assert.ok(state.runtime?.audition);
  return state.runtime.audition;
}

function nextAction(state: SimulationState): AuditionAction {
  const current = state.runtime?.audition;
  if (!current) return { type: 'start' };
  if (current.phase === 'mood') {
    const choices: MoodChoices = {
      vocalColor: '',
      danceStyle: '',
      rapStyle: '',
      visualVibe: '',
      leadershipStyle: '',
      genreAffinity: '',
    };
    for (const field of MOOD_FIELDS) choices[field] = current.moodOptions[field][0];
    return { type: 'mood', choices };
  }
  if (current.phase === 'broadcast') return { type: 'broadcast', cutId: 'music' };
  if (current.phase === 'secret') return { type: 'secret', contestantId: current.secretCandidates[0] };
  return { type: 'advance' };
}

function play(initial: SimulationState, reload: boolean): SimulationState {
  let state = initial;
  for (let step = 0; step < 40 && state.runtime?.audition?.phase !== 'complete'; step++) {
    const action = nextAction(state);
    const revision = state.runtime?.audition?.revision ?? 0;
    const before = structuredClone(state);
    const next = transitionAudition(state, action, revision);
    assert.deepEqual(state, before, 'a transition must not mutate its input');
    assert.equal(transitionAudition(next, action, revision), next, 'a retried action must not roll twice');
    assert.ok(Object.isFrozen(next.runtime?.definitions.auditionSongs));
    assert.ok(Object.isFrozen(next.runtime?.initialContestants[0].coreSkills));
    state = reload ? decodeSimulationState(JSON.stringify(next)) : next;
  }
  assert.equal(episode(state).phase, 'complete');
  return state;
}

test('complete Auditions resumes identically after every scene and closes exactly once for all fifty', () => {
  const initial = setup();
  const original = structuredClone(initial);
  const direct = play(initial, false);
  const restored = play(initial, true);
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(direct)));
  assert.deepEqual(initial, original);
  const result = episode(restored);
  assert.equal(result.evaluations.length, 50);
  const reactionNotes = new Set(result.reactions.map((reaction) => reaction.narrative));
  let narratedReactions = 0;
  for (const scene of result.scenes.filter((entry) => entry.kind === 'auditions')) {
    const notes = scene.paragraphs.filter((paragraph) => reactionNotes.has(paragraph));
    assert.ok(notes.length <= 2, 'Only two standout reactions should be narrated in an audition scene');
    narratedReactions += notes.length;
    assert.equal(
      scene.paragraphs.filter((paragraph) => paragraph.includes(' performs "')).length,
      scene.contestantIds.length,
    );
  }
  assert.ok(
    result.reactions.length > narratedReactions,
    'Other opinions remain recorded without filling the episode narration',
  );
  assert.equal(result.batches.length, 4);
  assert.equal(restored.contestants.filter((entry) => entry.status === 'ACTIVE').length, 30);
  assert.equal(restored.contestants.filter((entry) => entry.status === 'ELIMINATED').length, 20);
  assert.deepEqual(
    result.survivorIds,
    rankAuditions(result.evaluations)
      .slice(0, 30)
      .map((entry) => entry.contestantId),
  );
  assert.equal(result.revealedEliminations, 20);
  assert.ok(result.mvp);
  assert.equal(Object.keys(result.mvp.ballots).length, 30);
  assert.equal(
    restored.contestants.reduce((sum, entry) => sum + entry.aggregations.mvp, 0),
    1,
  );
  assert.ok(result.audience);
  assert.ok(restored.runtime);
  assert.equal(
    Object.values(result.audience.votes).reduce((sum, count) => sum + count, 0),
    restored.runtime.show.audience,
  );
  assert.equal(
    restored.runtime.show.general +
      Object.values(restored.runtime.show.fans).reduce((sum, count) => sum + count, 0),
    restored.runtime.show.audience,
  );
  assert.ok(result.eliminatedIds.every((id) => !restored.runtime?.show.fans[id]));
  for (const contestant of restored.contestants) {
    const initialContestant = initial.contestants.find((entry) => entry.id === contestant.id);
    assert.ok(initialContestant);
    for (const other of restored.contestants) {
      const baseline: number[] = initialContestant.relationships[other.id];
      const history: number[] = contestant.relationships[other.id];
      if (other.id === contestant.id) {
        assert.deepEqual(history, baseline);
      } else {
        assert.equal(
          history.length,
          baseline.length + 1,
          `${contestant.id} must form an opinion of ${other.id}`,
        );
        assert.ok([1, 3, 5].includes(Math.abs(history[history.length - 1] - baseline[baseline.length - 1])));
      }
    }
    const entries = contestant.changeLog.filter((entry) => entry.phaseId === 'episode-1');
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0].changes, result.changes[contestant.id] ?? []);
    assert.equal(
      entries[0].score,
      result.evaluations.find((entry) => entry.contestantId === contestant.id)?.finalScore,
    );
  }
  assert.throws(() => transitionAudition(restored, { type: 'advance' }, result.revision), /complete/);
});

test('older in-progress Auditions keep their original relationship policy and seeded continuation', () => {
  const opening = transitionAudition(setup(), { type: 'start' }, 0);
  Reflect.deleteProperty(episode(opening), 'relationshipPolicy');
  const restored = decodeSimulationState(JSON.stringify(opening));
  assert.equal(episode(restored).relationshipPolicy, 'reactions-only');
  const direct = play(restored, false);
  assert.deepEqual(JSON.parse(JSON.stringify(direct)), JSON.parse(JSON.stringify(play(restored, true))));
  assert.ok(
    direct.contestants.some((contestant) =>
      direct.contestants.some(
        (other) => other.id !== contestant.id && contestant.relationships[other.id].length === 1,
      ),
    ),
  );
});

test('episode choices are phase-gated, stale choices fail, and incomplete saved progress is rejected', () => {
  const initial = setup();
  assert.throws(() => transitionAudition(initial, { type: 'advance' }, 0), /Start Episode/);
  const opening = transitionAudition(initial, { type: 'start' }, 0);
  assert.throws(() => transitionAudition(opening, { type: 'broadcast', cutId: 'music' }, 0), /advanced/);
  const action = nextAction(opening);
  assert.equal(action.type, 'mood');
  if (action.type !== 'mood') assert.fail('Expected mood choices');
  action.choices.genreAffinity = 'UNKNOWN';
  assert.throws(() => transitionAudition(opening, action, 1), /available/);
  assert.equal(episode(opening).phase, 'mood');
  const damaged = structuredClone(opening);
  episode(damaged).revision = -1;
  assert.throws(() => decodeSimulationState(JSON.stringify(damaged)), /invalid or incomplete/);
  const missingShow = structuredClone(opening);
  Reflect.deleteProperty(missingShow.runtime ?? {}, 'show');
  assert.throws(() => decodeSimulationState(JSON.stringify(missingShow)), /audience/);
  const nullShow = structuredClone(opening);
  Object.assign(nullShow.runtime ?? {}, { show: null });
  assert.throws(() => decodeSimulationState(JSON.stringify(nullShow)), /audience/);
});

test('foundation setup saves migrate without invented rolls or snapshots', () => {
  const initial = setup();
  const archived = structuredClone(initial);
  assert.ok(archived.runtime);
  for (const field of ['audition', 'show', 'revealedSecrets', 'deferredConsequences'])
    Reflect.deleteProperty(archived.runtime, field);
  Reflect.deleteProperty(archived.runtime.setup, 'auditionPoolIds');
  const restored = decodeSimulationState(JSON.stringify(archived));
  assert.equal(restored.runtime?.randomState, initial.runtime?.randomState);
  assert.equal(restored.runtime?.audition, null);
  assert.equal(restored.runtime?.show.general, 100000);
  assert.equal(episode(transitionAudition(restored, { type: 'start' }, 0)).pool.length, 9);
});

test('episode actions persist before publication and failed writes preserve phase, RNG, and outcomes', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousState = simulationStore.state;
  const saved = new Map<string, string>();
  let fail = true;
  let writes = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        setItem(key: string, value: string) {
          if (fail) throw new Error('Storage is full');
          writes++;
          saved.set(key, value);
        },
      },
    },
  });
  try {
    const initial = setup();
    simulationStore.setState(() => initial);
    assert.throws(() => simulationActions.dispatchAudition({ type: 'start' }, 0), /Storage is full/);
    assert.equal(simulationStore.state, initial);
    fail = false;
    simulationActions.dispatchAudition({ type: 'start' }, 0);
    const opening = simulationStore.state;
    assert.deepEqual(
      decodeSimulationState(saved.get(SIMULATION_STORAGE_KEY) ?? ''),
      JSON.parse(JSON.stringify(opening)),
    );
    simulationActions.dispatchAudition({ type: 'start' }, 0);
    assert.equal(writes, 1);
    assert.equal(simulationStore.state, opening);
    fail = true;
    assert.throws(() => simulationActions.dispatchAudition(nextAction(opening), 1), /Storage is full/);
    assert.equal(simulationStore.state, opening);
    let live = opening;
    while (episode(live).phase !== 'broadcast') {
      live = transitionAudition(live, nextAction(live), episode(live).revision);
    }
    const incorrectPhase = structuredClone(live);
    episode(incorrectPhase).phase = 'live';
    assert.throws(() => decodeSimulationState(JSON.stringify(incorrectPhase)), /invalid or incomplete/);
    simulationStore.setState(() => live);
    const revision = episode(live).revision;
    assert.throws(
      () => simulationActions.dispatchAudition({ type: 'broadcast', cutId: 'music' }, revision),
      /Storage is full/,
    );
    assert.equal(simulationStore.state, live);
    const expected = transitionAudition(live, { type: 'broadcast', cutId: 'music' }, revision);
    fail = false;
    simulationActions.dispatchAudition({ type: 'broadcast', cutId: 'music' }, revision);
    assert.deepEqual(simulationStore.state, expected);
    simulationActions.dispatchAudition({ type: 'broadcast', cutId: 'music' }, revision);
    assert.equal(writes, 2);
  } finally {
    simulationStore.setState(() => previousState);
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
