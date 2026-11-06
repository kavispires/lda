import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { copyMarkdown } from '../components/CopyMarkdownButton';
import { CopyShowSoFar } from '../components/CopyShowSoFar';
import { autoCompleteEpisode } from '../engine/episode-auto-complete';
import { transitionNarrativeAudition } from '../engine/narrative-audition';
import { narrativeBattleFixture } from '../engine/narrative-battle-fixtures';
import { transitionPhotoshoot } from '../engine/photoshoot-episode';
import { createSeasonSetup } from '../engine/season-setup';
import type { SimulationState } from '../types/simulation';
import { createSeasonCastProfiles } from './contestant-profile';
import { createEpisodeRundown } from './episode-rundown';
import { markdown } from './markdown';
import { createShowRundown } from './show-rundown';

let first: SimulationState;
function completedAuditions() {
  first ??= narrativeBattleFixture();
  return first;
}

test('show so far includes initialized cast before play, excludes unfinished episodes and never reveals hidden cards', () => {
  const runtime = completedAuditions().runtime;
  assert.ok(runtime);
  const state: SimulationState = {
    ...createSeasonSetup(runtime.sourceContestants, { seed: 2948, runId: 'show-copy', now: 1000 }),
    status: 'ready',
    persistenceError: null,
  };
  const before = JSON.stringify(state);
  const text = createShowRundown(state);
  assert.ok(state.runtime);
  assert.ok(text.includes(createSeasonCastProfiles(state.runtime).trim()));
  assert.equal((text.match(/^## .* - Contestant profile$/gm) ?? []).length, 50);
  assert.doesNotMatch(text, /# The Search - Episode|simulation/i);
  for (const person of state.runtime.initialContestants)
    for (const id of person.attributes)
      if (Object.hasOwn(state.runtime.definitions.cards.secret, id))
        assert.ok(!text.includes(`(${markdown(id)})`));
  assert.equal(JSON.stringify(state), before);
  const started = transitionNarrativeAudition(state, { type: 'start' }, 0);
  assert.equal(createShowRundown(started), text);
  const unavailable = { ...state, runtime: null };
  assert.throws(() => createShowRundown(unavailable), /Initialize the show/);
  assert.equal(CopyShowSoFar({ state: unavailable }), null);
});

test('show so far starts with the supplied introduction, then cast and every completed episode exactly once in order', async () => {
  let state = completedAuditions();
  for (const episode of [2, 3, 4, 5] as const) {
    if (episode === 5) {
      const preparing = transitionPhotoshoot(state, { type: 'start' }, 0);
      const partial = createShowRundown(preparing);
      assert.ok(partial.includes(createEpisodeRundown(state, 4).trim()));
      assert.doesNotMatch(partial, /^# The Search - Episode 5:/m);
    }
    state = await autoCompleteEpisode(state, episode);
  }
  const before = JSON.stringify(state);
  const text = createShowRundown(state);
  assert.ok(
    text.startsWith(
      '“The Search” is a 11-episode reality TV competition to choose the next iteration of the global pop sensation, the boyband “Squirrel Zone” which tragically ended their course years ago. Who is gonna be the power vocal, the dance sensation, the edgy rapper, the mesmerizing visual, and the X factor glue? Stay tuned!”\n\n---\n\n# The Search - Season cast\n',
    ),
  );
  assert.ok(state.runtime);
  assert.ok(text.includes(createSeasonCastProfiles(state.runtime).trim()));
  let previous = text.indexOf('# The Search - Season cast');
  for (const episode of [1, 2, 3, 4, 5] as const) {
    const heading = `# The Search - Episode ${episode}:`;
    const position = text.indexOf(heading);
    assert.ok(position > previous);
    assert.equal(text.indexOf(heading, position + heading.length), -1);
    assert.ok(text.includes(createEpisodeRundown(state, episode).trim()));
    previous = position;
  }
  assert.doesNotMatch(text, /simulation/i);
  assert.equal(JSON.stringify(state), before);
});

test('Copy Show So Far uses the shared clipboard control and copies the combined Markdown without advancing', async () => {
  const state = completedAuditions();
  const before = JSON.stringify(state);
  const button = CopyShowSoFar({ state });
  assert.ok(isValidElement<{ label: string; createText: () => string }>(button));
  assert.equal(button.props.label, 'Copy Show So Far');
  assert.match(renderToStaticMarkup(button), /Copy Show So Far/);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const copied: string[] = [];
  try {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText: async (text: string) => copied.push(text) } },
    });
    await copyMarkdown(button.props.createText());
    assert.deepEqual(copied, [createShowRundown(state)]);
    assert.equal(JSON.stringify(state), before);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
