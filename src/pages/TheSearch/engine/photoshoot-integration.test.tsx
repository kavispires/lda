import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhotoshootEpisodeView } from '../components/PhotoshootEpisodeView';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { PhotoshootAction } from '../types/photoshoot-episode';
import type { SimulationState } from '../types/simulation';
import { createEpisodeRundown } from '../utilities/episode-rundown';
import { projectSeasonCast } from '../utilities/episode-visibility';
import { advanceBootcampTo, completedBattlesForBootcamp } from './bootcamp-fixtures';
import { autoCompleteEpisode } from './episode-auto-complete';
import { transitionPhotoshoot } from './photoshoot-episode';
import {
  decodeSimulationState,
  encodeSimulationState,
  loadSimulationState,
  SIMULATION_STORAGE_KEY,
} from './simulation-persistence';

let baseline: Promise<SimulationState> | undefined;
async function completedMegaGroups() {
  baseline ??= autoCompleteEpisode(advanceBootcampTo(completedBattlesForBootcamp(), 'complete'), 4);
  return structuredClone(await baseline);
}
const normalized = (state: SimulationState) => JSON.parse(JSON.stringify(state));
function nextAction(state: SimulationState): { action: PhotoshootAction; revision: number } {
  const episode = state.runtime!.photoshoot;
  const preparation = state.runtime!.preparations?.[5];
  if (episode) {
    if (episode.phase === 'styling-choice')
      return {
        action: { type: 'styling', choice: episode.teamCursor % 2 ? 'intervene' : 'self-style' },
        revision: episode.revision,
      };
    if (episode.phase === 'secret-choice')
      return {
        action: { type: 'secret', contestantId: episode.secretCandidates[0] },
        revision: episode.revision,
      };
    return { action: { type: 'advance' }, revision: episode.revision };
  }
  if (!preparation) return { action: { type: 'start' }, revision: 0 };
  if (!preparation.mood)
    return {
      action: {
        type: 'mood',
        choices: {
          vocalColor: preparation.moodOptions.vocalColor[0],
          rapStyle: preparation.moodOptions.rapStyle[0],
          danceStyle: preparation.moodOptions.danceStyle[0],
          visualVibe: preparation.moodOptions.visualVibe[0],
          leadershipStyle: preparation.moodOptions.leadershipStyle[0],
          genreAffinity: preparation.moodOptions.genreAffinity[0],
        },
      },
      revision: preparation.revision,
    };
  if (preparation.requiredSelections)
    return {
      action: {
        type: 'opening-cast',
        contestantIds: preparation.shortlist.slice(0, preparation.requiredSelections),
      },
      revision: preparation.revision,
    };
  return { action: { type: 'start' }, revision: preparation.revision };
}

test('Photoshoot integrates every-beat compressed reload, four styling gates, reveal-safe ranks and complete exports', async () => {
  const initial = await completedMegaGroups();
  delete initial.runtime!.definitions.photoshootConcepts;
  const original = JSON.stringify(initial);
  const oldEpisodes = JSON.stringify([
    initial.runtime!.audition,
    initial.runtime!.battle,
    initial.runtime!.bootcamp,
    initial.runtime!.megaGroups,
  ]);
  const oldRundown = createEpisodeRundown(initial, 4);
  const experience = new Map(
    initial.contestants.map((person) => [person.id, person.aggregations.experience]),
  );
  const departures = initial.contestants.filter((person) => person.status === 'ELIMINATED');
  let state = initial;
  let restored = decodeSimulationState(JSON.stringify(initial));
  const sequences = new Set<number>();
  const choices = new Set<number>();
  let happinessShown = false;
  let sawSealedResults = false;
  for (let step = 0; step < 220 && state.runtime!.photoshoot?.phase !== 'complete'; step++) {
    if (step % 4 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const { action, revision } = nextAction(state);
    const previous = state;
    state = transitionPhotoshoot(state, action, revision);
    assert.notEqual(state, previous);
    restored = decodeSimulationState(encodeSimulationState(transitionPhotoshoot(restored, action, revision)));
    assert.deepEqual(normalized(restored), normalized(state), `Photoshoot reload diverged at step ${step}`);
    const episode = state.runtime!.photoshoot;
    if (!episode) continue;
    const scene = episode.scenes.at(-1);
    if (scene?.sequence) sequences.add(scene.sequence);
    if (episode.phase === 'styling-choice') {
      choices.add(episode.teamCursor);
      const html = renderToStaticMarkup(
        <PhotoshootEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
      );
      assert.match(html, /bring in stylists/);
      assert.match(html, /keep creative control/);
      assert.doesNotMatch(html, /aria-label="Episode 5 standings"/);
    }
    if (action.type === 'styling' && action.choice === 'intervene') {
      const html = renderToStaticMarkup(
        <PhotoshootEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
      );
      assert.match(html, /aria-label="Decreased"[^>]*color:#fa8c16/);
      happinessShown = true;
    }
    if (!episode.rankRevealed) {
      const projected = projectSeasonCast(state.contestants, state.runtime!);
      for (const person of initial.contestants) {
        const visible = projected.find((entry) => entry.id === person.id)!;
        assert.equal(visible.rank, person.rank, 'previous final ranks remain public until reveal');
        assert.equal(visible.aggregations.rankingScore, person.aggregations.rankingScore);
      }
    }
    if (episode.audience && !episode.rankRevealed) sawSealedResults = true;
    if (scene?.sequence === 1)
      assert.doesNotMatch(
        scene.paragraphs.join(' '),
        /no eliminations|nobody (?:leaves|goes home)|safe this week/i,
      );
    assert.doesNotMatch(
      episode.scenes
        .flatMap((entry) => [
          ...entry.paragraphs,
          ...(entry.dialogues ?? []).flatMap((dialogue) => dialogue.paragraphs),
        ])
        .join('\n'),
      /\bTV (?:score|point)|experience point|\bXP\b|artistic experience|Completed episode activity/i,
    );
  }
  const episode = state.runtime!.photoshoot!;
  assert.equal(episode.phase, 'complete');
  assert.deepEqual([...sequences].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(choices.size, 4);
  assert.ok(happinessShown && sawSealedResults);
  assert.equal(episode.individualPhotos.length, 16);
  assert.equal(episode.groupPhotos.length, 4);
  assert.equal(state.contestants.filter((person) => person.status === 'ACTIVE').length, 16);
  assert.deepEqual(
    [...new Set(state.contestants.map((person) => person.rank))].sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
  );
  for (const departed of departures)
    assert.equal(state.contestants.find((person) => person.id === departed.id)!.rank, departed.rank);
  for (const id of episode.participantIds)
    assert.equal(
      state.contestants.find((person) => person.id === id)!.aggregations.experience,
      experience.get(id)! + 7,
    );
  assert.equal(JSON.stringify(initial), original, 'input is immutable');
  assert.equal(
    JSON.stringify([
      state.runtime!.audition,
      state.runtime!.battle,
      state.runtime!.bootcamp,
      state.runtime!.megaGroups,
    ]),
    oldEpisodes,
  );
  assert.equal(createEpisodeRundown(state, 4), oldRundown);
  const rundown = createEpisodeRundown(state, 5);
  for (const title of [
    'Sequence 1',
    'Sequence 8',
    'Ultimate Visual ballot',
    'Complete individual photography',
    'Complete group photography',
    'Continuing ranking',
  ])
    assert.ok(rundown.includes(title));
  assert.doesNotMatch(rundown, /\bTV score|\bXP\b|Completed episode activity/);
  assert.ok(episode.ultimateVisual);
  for (const [voter, candidate] of Object.entries(episode.ultimateVisual.ballots))
    assert.notEqual(voter, candidate);
  const html = renderToStaticMarkup(
    <PhotoshootEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
  );
  assert.match(html, /aria-label="Episode 5 standings"/);
  assert.match(html, /All sixteen continue/);
  assert.match(html, /Copy episode rundown/);
  assert.doesNotMatch(html, /Start Episode 6/);
});

test('Photoshoot store preserves player choices, saves atomically under quota and keeps failures visible', async () => {
  let initial = await completedMegaGroups();
  for (let step = 0; step < 80 && initial.runtime!.photoshoot?.phase !== 'styling-choice'; step++) {
    const { action, revision } = nextAction(initial);
    initial = transitionPhotoshoot(initial, action, revision);
  }
  const episode = initial.runtime!.photoshoot!;
  assert.equal(episode.phase, 'styling-choice');
  initial = transitionPhotoshoot(initial, { type: 'styling', choice: 'self-style' }, episode.revision);
  const chosenTeam = initial.runtime!.photoshoot!.teams.find((team) => team.styling)!;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousState = simulationStore.state;
  let saved = JSON.stringify(initial);
  let writes = 0;
  let rejectWrites = true;
  const quota = 10 * 1024 * 1024;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => saved,
        setItem(key: string, value: string) {
          writes++;
          assert.equal(key, SIMULATION_STORAGE_KEY);
          assert.equal(simulationStore.state, initial, 'persist before publishing');
          if (rejectWrites) throw new DOMException('Storage unavailable', 'QuotaExceededError');
          if (2 * (key.length + value.length) > quota)
            throw new DOMException('Quota exceeded', 'QuotaExceededError');
          saved = value;
        },
      },
    },
  });
  simulationStore.setState(() => initial);
  try {
    const previousSave = saved;
    const { action, revision } = nextAction(initial);
    assert.throws(() => simulationActions.dispatchPhotoshoot(action, revision), /Storage unavailable/);
    assert.equal(simulationStore.state, initial);
    assert.equal(saved, previousSave);
    rejectWrites = false;
    writes = 0;
    await simulationActions.autoCompleteEpisode(5, initial);
    assert.equal(writes, 1);
    const completed = simulationStore.state;
    assert.equal(completed.runtime!.photoshoot!.phase, 'complete');
    assert.equal(
      completed.runtime!.photoshoot!.teams.find((team) => team.id === chosenTeam.id)!.styling!.choice,
      'self-style',
    );
    assert.ok(2 * (SIMULATION_STORAGE_KEY.length + saved.length) <= quota);
    assert.deepEqual(normalized(loadSimulationState({ getItem: () => saved })), normalized(completed));
    await simulationActions.autoCompleteEpisode(5, completed);
    assert.equal(writes, 1, 'completed episodes do not write or award twice');
    assert.equal(simulationStore.state, completed);
    const corrupt = normalized(completed);
    corrupt.runtime.photoshoot.individualPhotos[0].finalScore = 101;
    const failed = loadSimulationState({ getItem: () => JSON.stringify(corrupt) });
    assert.match(failed.persistenceError ?? '', /Could not restore/);
    assert.equal(failed.runtime, null);
  } finally {
    simulationStore.setState(() => previousState);
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
