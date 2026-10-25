import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MegaGroupsEpisodeView } from '../components/MegaGroupsEpisodeView';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { MegaGroupsAction } from '../types/mega-groups-episode';
import type { SimulationState } from '../types/simulation';
import { createEpisodeRundown } from '../utilities/episode-rundown';
import { projectSeasonCast } from '../utilities/episode-visibility';
import { advanceBootcampTo, completedBattlesForBootcamp } from './bootcamp-fixtures';
import { autoCompleteEpisode } from './episode-auto-complete';
import { transitionMegaGroups } from './mega-groups-episode';
import { decodeSimulationState, loadSimulationState, SIMULATION_STORAGE_KEY } from './simulation-persistence';

let baseline: SimulationState | undefined;
function completedBootcamp() {
  baseline ??= advanceBootcampTo(completedBattlesForBootcamp(), 'complete');
  return structuredClone(baseline);
}
const normalized = (state: SimulationState) => JSON.parse(JSON.stringify(state));
function nextAction(state: SimulationState): { action: MegaGroupsAction; revision: number } {
  const episode = state.runtime!.megaGroups;
  const preparation = state.runtime!.preparations?.[4];
  if (episode) {
    if (episode.phase === 'intervention')
      return { action: { type: 'conflict', choice: 'mediate' }, revision: episode.revision };
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
          danceStyle: preparation.moodOptions.danceStyle[0],
          rapStyle: preparation.moodOptions.rapStyle[0],
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

test('Mega Groups integrates every-beat reload, final season placement, silent activity and factual export', () => {
  const before = completedBootcamp();
  const untouched = JSON.stringify(before);
  let state = before;
  let reloaded = decodeSimulationState(JSON.stringify(before));
  const oldDepartures = new Map(
    before.contestants.filter((p) => p.status === 'ELIMINATED').map((p) => [p.id, p.rank]),
  );
  const experience = new Map(before.contestants.map((p) => [p.id, p.aggregations.experience]));
  const originalEpisodes = JSON.stringify([
    before.runtime!.audition,
    before.runtime!.battle,
    before.runtime!.bootcamp,
  ]);
  const sequences = new Set<number>();
  let closingSeen = false;
  let imagesSeen = false;
  let comfortSeen = false;
  for (let turn = 0; turn < 250 && state.runtime!.megaGroups?.phase !== 'complete'; turn++) {
    const { action, revision } = nextAction(state);
    const previous = state;
    state = transitionMegaGroups(state, action, revision);
    assert.notEqual(state, previous, 'each selected action advances');
    reloaded = decodeSimulationState(JSON.stringify(transitionMegaGroups(reloaded, action, revision)));
    assert.deepEqual(normalized(reloaded), normalized(state), `reload diverged at action ${turn}`);
    const episode = state.runtime!.megaGroups;
    if (!episode) continue;
    const scene = episode.scenes.at(-1);
    if (scene?.sequence) sequences.add(scene.sequence);
    if (scene?.sequence === 1) {
      const comforted = state.contestants.some(
        (person) =>
          person.aggregations.happiness >
          previous.contestants.find((prior) => prior.id === person.id)!.aggregations.happiness,
      );
      if (comforted) {
        const html = renderToStaticMarkup(
          <MegaGroupsEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
        );
        assert.match(html, /aria-label="Increased"[^>]*color:#1677ff/);
        comfortSeen = true;
      }
    }
    if (scene?.illustrations?.length) {
      assert.equal(scene.illustrations.length, 2);
      const html = renderToStaticMarkup(
        <MegaGroupsEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
      );
      assert.match(html, /aria-label="Blind image choices"/);
      imagesSeen = true;
    }
    if (!episode.rankRevealed) {
      const projected = projectSeasonCast(state.contestants, state.runtime!);
      for (const person of episode.startingContestants)
        assert.equal(projected.find((p) => p.id === person.id)!.rank, person.rank, 'new ranks remain sealed');
    }
    if (episode.audience && !episode.rankRevealed) closingSeen = true;
    if (scene && (scene.sequence ?? 0) < 9)
      assert.doesNotMatch(JSON.stringify(scene), /Jane Strauss|secretly watching|withdraws|withdrawal/i);
    assert.doesNotMatch(
      episode.scenes
        .flatMap((entry) => [
          ...entry.paragraphs,
          ...(entry.dialogues ?? []).flatMap((dialogue) => dialogue.paragraphs),
        ])
        .join('\n'),
      /TV (?:score|points)|experience points|ranking points|XP awards/i,
    );
  }
  const episode = state.runtime!.megaGroups!;
  assert.equal(episode.phase, 'complete');
  assert.deepEqual(
    [...sequences].sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.ok(closingSeen);
  assert.ok(imagesSeen, 'the selected test exposes both actual images to viewers');
  assert.ok(comfortSeen, 'comfort shows the happiness increase using the established blue arrow');
  assert.equal(episode.performances.length, 4);
  assert.equal(new Set(episode.performances.map((p) => p.songId)).size, 4);
  assert.ok(episode.performances.every((p) => p.evaluations.length === 9));
  assert.equal(episode.survivorIds.length, 16);
  assert.equal(state.contestants.filter((p) => p.status === 'ACTIVE').length, 16);
  assert.notEqual(episode.eliminatedId, episode.withdrawnId);
  assert.equal(state.contestants.find((p) => p.id === episode.eliminatedId)!.rank, 18);
  assert.equal(state.contestants.find((p) => p.id === episode.withdrawnId)!.rank, 17);
  assert.equal(episode.rankedIds.at(-1), episode.eliminatedId);
  assert.equal(episode.finalRankedIds.at(-2), episode.withdrawnId);
  for (const id of episode.participantIds) {
    const person = state.contestants.find((p) => p.id === id)!;
    assert.equal(person.aggregations.experience - experience.get(id)!, 8);
    assert.ok(person.aggregations.score > before.contestants.find((p) => p.id === id)!.aggregations.score);
  }
  for (const [id, rank] of oldDepartures)
    assert.equal(state.contestants.find((p) => p.id === id)!.rank, rank);
  assert.equal(new Set(state.contestants.map((p) => p.rank)).size, 50);
  assert.equal(state.runtime!.episode, 4);
  assert.equal(state.runtime!.phase, 'episode-complete');
  assert.equal(JSON.stringify(before), untouched);
  assert.equal(
    JSON.stringify([state.runtime!.audition, state.runtime!.battle, state.runtime!.bootcamp]),
    originalEpisodes,
  );
  assert.equal(Object.keys(episode.mvp!.ballots).length, 18);
  assert.ok(Object.entries(episode.mvp!.ballots).every(([voter, choice]) => voter !== choice));
  assert.ok(episode.secret);
  const rundown = createEpisodeRundown(state, 4);
  assert.match(rundown, /Sequence 10|Jane Strauss|Announced performance ranking/);
  assert.match(rundown, /withdrew/);
  assert.doesNotMatch(
    rundown,
    /TV (?:score|points)|experience points|ranking points|aggregations\.(score|experience|rankingScore)/i,
  );
  const html = renderToStaticMarkup(
    <MegaGroupsEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
  );
  assert.match(html, /Episode complete|Photoshoot is unlocked/);
  assert.match(html, /Withdrew/);
  assert.doesNotMatch(html, /Auto-complete episode/);
});

test('Mega Groups adopts missing catalogs in old saves and auto-completes only Episode 4', async () => {
  const old = completedBootcamp();
  delete old.runtime!.definitions.megaGroupTests;
  delete old.runtime!.definitions.megaGroupSongs;
  const decoded = decodeSimulationState(JSON.stringify(old));
  const initialized = transitionMegaGroups(decoded, { type: 'start' }, 0);
  assert.ok(initialized.runtime!.definitions.megaGroupTests);
  assert.ok(initialized.runtime!.definitions.megaGroupSongs);
  assert.equal(decoded.runtime!.definitions.megaGroupTests, undefined);
  const complete = await autoCompleteEpisode(initialized, 4);
  assert.equal(complete.runtime!.megaGroups!.phase, 'complete');
  assert.equal(complete.runtime!.episode, 4);
  assert.equal(await autoCompleteEpisode(complete, 4), complete);
  assert.deepEqual(normalized(decodeSimulationState(JSON.stringify(complete))), normalized(complete));
});

test('Mega Groups store preserves state when saving fails and ignores duplicate actions', () => {
  const initial = completedBootcamp();
  const previous = simulationStore.state;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const original = JSON.stringify(initial);
  try {
    simulationStore.setState(() => initial);
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          setItem() {
            throw new Error('storage unavailable');
          },
        },
      },
    });
    assert.throws(() => simulationActions.dispatchMegaGroups({ type: 'start' }, 0), /storage unavailable/);
    assert.equal(simulationStore.state, initial);
    assert.equal(JSON.stringify(initial), original);
    const started = transitionMegaGroups(initial, { type: 'start' }, 0);
    assert.equal(transitionMegaGroups(started, { type: 'start' }, 0), started);
  } finally {
    simulationStore.setState(() => previous);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('Mega Groups rejects corrupt saved catalogs before starting the episode', () => {
  const badTests = completedBootcamp();
  badTests.runtime!.definitions.megaGroupTests = [];
  assert.throws(() => decodeSimulationState(JSON.stringify(badTests)), /Mega|catalog|test/i);
  const badSongs = completedBootcamp();
  badSongs.runtime!.definitions.megaGroupSongs = [];
  assert.throws(() => decodeSimulationState(JSON.stringify(badSongs)), /Mega|catalog|song/i);
});

test('Episode 4 saves beyond the raw storage quota without discarding season history', async () => {
  const initial = completedBootcamp();
  const previous = simulationStore.state;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const quota = 10 * 1024 * 1024;
  let stored = JSON.stringify(initial);
  assert.ok(2 * (SIMULATION_STORAGE_KEY.length + stored.length) < quota, 'the legacy Episode 3 save fits');
  const storage = {
    getItem: () => stored,
    setItem(key: string, value: string) {
      assert.equal(key, SIMULATION_STORAGE_KEY);
      if (2 * (key.length + value.length) > quota)
        throw new DOMException('The simulation exceeded the quota.', 'QuotaExceededError');
      stored = value;
    },
  };
  try {
    simulationStore.setState(() => initial);
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
    for (let step = 0; step < 5 && !simulationStore.state.runtime!.megaGroups; step++) {
      const { action, revision } = nextAction(simulationStore.state);
      simulationActions.dispatchMegaGroups(action, revision);
    }
    assert.ok(simulationStore.state.runtime!.megaGroups);
    assert.ok(
      JSON.stringify(simulationStore.state).length * 2 > quota,
      'the new raw save really exceeds quota',
    );
    assert.deepEqual(normalized(loadSimulationState(storage)), normalized(simulationStore.state));
    await simulationActions.autoCompleteEpisode(4, simulationStore.state);
    const complete = simulationStore.state;
    assert.equal(complete.runtime!.megaGroups!.phase, 'complete');
    assert.deepEqual(normalized(loadSimulationState(storage)), normalized(complete));
    assert.deepEqual(complete.runtime!.audition, initial.runtime!.audition);
    assert.deepEqual(complete.runtime!.battle, initial.runtime!.battle);
    assert.deepEqual(complete.runtime!.bootcamp, initial.runtime!.bootcamp);
    assert.ok(stored.length * 2 < quota);
  } finally {
    simulationStore.setState(() => previous);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
