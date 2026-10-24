import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AutoCompleteEpisodeButton } from '../components/AutoCompleteEpisodeButton';
import { BootcampEpisodeView } from '../components/BootcampEpisodeView';
import { NarrativeAuditionView, NarrativeBattleView } from '../components/NarrativeEpisodeView';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { SimulationState } from '../types/simulation';
import { advanceBootcampTo } from './bootcamp-fixtures';
import { autoCompleteEpisode } from './episode-auto-complete';
import { transitionBattleStory } from './narrative-battle';
import { advanceBattleStoryTo, narrativeBattleFixture } from './narrative-battle-fixtures';
import { createSeasonSetup } from './season-setup';
import { decodeSimulationState, SIMULATION_STORAGE_KEY } from './simulation-persistence';

const auditions = narrativeBattleFixture();
function setup(version: 1 | 2 | 3 = 3): SimulationState {
  const state: SimulationState = {
    ...createSeasonSetup(auditions.runtime!.sourceContestants, {
      seed: 2948,
      runId: 'battles-story',
      now: 1000,
      formatVersion: version,
    }),
    status: 'ready',
    persistenceError: null,
  };
  state.runtime!.show.audience = 1200;
  state.runtime!.show.general = 1200;
  return state;
}
const normalized = (state: SimulationState) => JSON.parse(JSON.stringify(state));

test('auto-complete episode uses normal transitions, stops at each final screen and preserves reloadable history', async () => {
  const initial = setup();
  const original = JSON.stringify(initial);
  const first = await autoCompleteEpisode(initial, 1);
  assert.deepEqual(normalized(first), normalized(auditions));
  assert.equal(first.runtime!.battle, undefined, 'Episode 2 does not start automatically');
  const second = await autoCompleteEpisode(first, 2);
  const manualBattles = advanceBattleStoryTo(auditions, 'complete');
  assert.deepEqual(normalized(second), normalized(manualBattles));
  assert.equal(second.runtime!.bootcamp, undefined, 'Episode 3 does not start automatically');
  const third = await autoCompleteEpisode(second, 3);
  assert.deepEqual(normalized(third), normalized(advanceBootcampTo(manualBattles, 'complete')));
  assert.deepEqual(normalized(decodeSimulationState(JSON.stringify(third))), normalized(third));
  assert.equal(JSON.stringify(initial), original);
  const noop = () => {};
  for (const [state, episode, View] of [
    [first, 1, NarrativeAuditionView],
    [second, 2, NarrativeBattleView],
    [third, 3, BootcampEpisodeView],
  ] as const) {
    const html = renderToStaticMarkup(<View onAction={noop} onInspect={noop} state={state} />);
    assert.match(html, /Episode (?:2 )?complete/i);
    assert.doesNotMatch(html, /Auto-complete episode|Return to current scene/);
    assert.equal(await autoCompleteEpisode(state, episode), state);
  }
});

test('auto-complete episode resumes partial episodes without replacing saved choices or rerolling earlier performances', async () => {
  const decision = advanceBattleStoryTo(auditions, 'production-save');
  const nominee = decision.runtime!.battle!.productionShortlist.at(-1)!;
  const chosen = transitionBattleStory(
    decision,
    { type: 'production-save', contestantId: nominee },
    decision.runtime!.battle!.revision,
  );
  const original = JSON.stringify(chosen);
  const complete = await autoCompleteEpisode(chosen, 2);
  assert.equal(complete.runtime!.battle!.productionSaveId, nominee);
  assert.deepEqual(complete.runtime!.battle!.performances, chosen.runtime!.battle!.performances);
  assert.equal(JSON.stringify(chosen), original);
  const partial = advanceBootcampTo(complete, 'performance');
  const restored = decodeSimulationState(JSON.stringify(partial));
  const final = await autoCompleteEpisode(restored, 3);
  assert.deepEqual(
    final.runtime!.bootcamp!.evaluations.slice(0, partial.runtime!.bootcamp!.evaluations.length),
    restored.runtime!.bootcamp!.evaluations,
  );
  assert.deepEqual(normalized(final), normalized(await autoCompleteEpisode(partial, 3)));
});

test('auto-complete episode supports saved runtime-1 and runtime-2 seasons without upgrading them', async () => {
  for (const version of [1, 2] as const) {
    const first = await autoCompleteEpisode(setup(version), 1);
    const second = await autoCompleteEpisode(first, 2);
    assert.equal(second.runtime!.version, version);
    assert.equal(second.runtime!.battle!.phase, 'complete');
    assert.equal(second.contestants.filter((person) => person.status === 'ACTIVE').length, 18);
    assert.deepEqual(normalized(decodeSimulationState(JSON.stringify(second))), normalized(second));
    await assert.rejects(autoCompleteEpisode(second, 3), /current-format/);
  }
  await assert.rejects(autoCompleteEpisode(setup(), 2), /Complete|Finish|Auditions|audition/i);
  await assert.rejects(autoCompleteEpisode(setup(), 3), /Complete The Battles/);
});

test('auto-complete episode control is available before play and hidden for completed or unavailable episodes', () => {
  const before = setup();
  const html = (state: SimulationState, episode: 1 | 2 | 3) =>
    renderToStaticMarkup(<AutoCompleteEpisodeButton episode={episode} state={state} />);
  assert.match(html(before, 1), /Auto-complete episode/);
  assert.equal(html(before, 2), '');
  assert.equal(html(before, 3), '');
  assert.equal(html(auditions, 1), '');
  assert.match(html(auditions, 2), /Auto-complete episode/);
});

test('auto-complete episode saves once before publishing and leaves state untouched on failed writes or concurrent changes', async () => {
  const previous = simulationStore.state;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const live = advanceBootcampTo(advanceBattleStoryTo(auditions, 'complete'), 'ranking');
  const original = JSON.stringify(live);
  let writes = 0;
  let fail = true;
  let saved = '';
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          setItem(key: string, value: string) {
            writes++;
            assert.equal(key, SIMULATION_STORAGE_KEY);
            assert.equal(simulationStore.state, live, 'save before publication');
            if (fail) throw new Error('storage unavailable');
            saved = value;
          },
        },
      },
    });
    simulationStore.setState(() => live);
    await assert.rejects(simulationActions.autoCompleteEpisode(3, live), /storage unavailable/);
    assert.equal(simulationStore.state, live);
    assert.equal(JSON.stringify(live), original);
    assert.equal(writes, 1);
    fail = false;
    await simulationActions.autoCompleteEpisode(3, live);
    assert.equal(writes, 2);
    assert.equal(simulationStore.state.runtime!.bootcamp!.phase, 'complete');
    assert.deepEqual(normalized(decodeSimulationState(saved)), normalized(simulationStore.state));
    await simulationActions.autoCompleteEpisode(3, simulationStore.state);
    assert.equal(writes, 2, 'completed episodes do not save or award twice');

    simulationStore.setState(() => live);
    const pending = simulationActions.autoCompleteEpisode(3, live);
    const changed = structuredClone(live);
    simulationStore.setState(() => changed);
    await assert.rejects(pending, /changed during auto-completion/);
    assert.equal(simulationStore.state, changed);
    assert.equal(writes, 2);
    await assert.rejects(simulationActions.autoCompleteEpisode(3, live), /simulation changed/);
  } finally {
    simulationStore.setState(() => previous);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
