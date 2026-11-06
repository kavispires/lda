import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Button, Modal } from 'antd';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MusicVideoEpisodeView } from '../components/MusicVideoEpisodeView';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { MusicVideoAction, MusicVideoEpisode } from '../types/music-video-episode';
import type { SimulationState } from '../types/simulation';
import { createEpisodeRundown } from '../utilities/episode-rundown';
import { projectSeasonCast } from '../utilities/episode-visibility';
import { episodeRelationshipUpdates } from '../utilities/relationship-updates';
import { createShowRundown } from '../utilities/show-rundown';
import { battleRelationship } from './battle-scoring';
import { completedBattlesForBootcamp } from './bootcamp-fixtures';
import { autoCompleteEpisode } from './episode-auto-complete';
import { transitionMusicVideo } from './music-video-episode';
import { createSeededRandom } from './random';
import {
  decodeSimulationState,
  encodeSimulationState,
  loadSimulationState,
  SIMULATION_STORAGE_KEY,
} from './simulation-persistence';

let baseline: Promise<SimulationState> | undefined;
let completed: SimulationState | undefined;
async function completedVarietyShow() {
  baseline ??= (async () => {
    let state = completedBattlesForBootcamp();
    for (const number of [3, 4, 5, 6, 7, 8] as const) state = await autoCompleteEpisode(state, number);
    return state;
  })();
  return structuredClone(await baseline);
}
const normalized = (value: unknown) => JSON.parse(JSON.stringify(value));
const records = (state: SimulationState) =>
  JSON.stringify([
    state.runtime!.audition,
    state.runtime!.battle,
    state.runtime!.bootcamp,
    state.runtime!.megaGroups,
    state.runtime!.photoshoot,
    state.runtime!.trackSpecials,
    state.runtime!.versatility,
    state.runtime!.varietyShow,
  ]);

function CaptureMusicVideo({
  state,
  onAction,
  onCapture,
}: {
  state: SimulationState;
  onAction: (action: MusicVideoAction, revision: number) => void;
  onCapture: (node: ReactNode) => void;
}) {
  onCapture(
    MusicVideoEpisodeView({
      state,
      onAction,
      onInspect: () => {},
      actionError: 'Could not save the decision.',
    }),
  );
  return null;
}

function nextAction(state: SimulationState): { action: MusicVideoAction; revision: number } {
  const episode = state.runtime!.musicVideo;
  const preparation = state.runtime!.preparations?.[9];
  if (episode)
    return {
      action:
        episode.phase === 'secret-choice'
          ? { type: 'secret', contestantId: episode.secretCandidates[0] }
          : { type: 'advance' },
      revision: episode.revision,
    };
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
  return {
    action: preparation.requiredSelections
      ? {
          type: 'opening-cast',
          contestantIds: preparation.shortlist.slice(0, preparation.requiredSelections),
        }
      : { type: 'start' },
    revision: preparation.revision,
  };
}

test('Music Videos restores every beat including randomized preparation and preserves eight archives', async () => {
  const initial = await completedVarietyShow();
  delete initial.runtime!.definitions.musicVideoCatalog;
  const before = JSON.stringify(initial);
  const oldRecords = records(initial);
  const oldCopies = ([1, 2, 3, 4, 5, 6, 7, 8] as const).map((number) =>
    createEpisodeRundown(initial, number),
  );
  let state = transitionMusicVideo(initial, { type: 'start' }, 0);
  assert.equal(state.runtime!.episode, 8, 'preparation does not start the native episode');
  assert.equal(Boolean(state.runtime!.musicVideo), false);
  let restored = decodeSimulationState(encodeSimulationState(state));
  for (let index = 0; index < 2; index++) {
    const revision = state.runtime!.preparations![9]!.revision;
    state = transitionMusicVideo(state, { type: 'randomize-mood' }, revision);
    restored = transitionMusicVideo(restored, { type: 'randomize-mood' }, revision);
    assert.deepEqual(normalized(restored), normalized(state));
    assert.equal(transitionMusicVideo(state, { type: 'randomize-mood' }, revision), state);
    restored = decodeSimulationState(encodeSimulationState(restored));
    assert.deepEqual(normalized(restored), normalized(state));
  }
  const prepared = normalized(state);
  prepared.runtime.preparations[9].randomAudit.initialDraws[0] = 0.123456789;
  assert.throws(() => decodeSimulationState(JSON.stringify(prepared)), /preparation|random/i);
  const forgedAction = normalized(state);
  forgedAction.runtime.preparations[9].randomAudit.steps[0].action = {
    type: 'opening-cast',
    contestantIds: [],
  };
  assert.throws(() => decodeSimulationState(JSON.stringify(forgedAction)), /opening|preparation/i);
  const alteredRng = normalized(state);
  alteredRng.runtime.randomState = (alteredRng.runtime.randomState + 1) >>> 0;
  assert.throws(() => decodeSimulationState(JSON.stringify(alteredRng)), /preparation|random/i);
  const extraDraw = normalized(state);
  const audit = extraDraw.runtime.preparations[9].randomAudit;
  const validPrefix = createSeededRandom(audit.endState);
  audit.steps.at(-1).draws.push(validPrefix.next());
  audit.endState = validPrefix.getState();
  extraDraw.runtime.randomState = audit.endState;
  assert.throws(() => decodeSimulationState(JSON.stringify(extraDraw)), /preparation|random/i);
  const preparation = state.runtime!.preparations![9]!;
  const previousIds = initial.runtime!.varietyShow!.survivorIds;
  const first = initial.contestants.find(({ id }) => id === previousIds[0])!;
  const last = initial.contestants.find(({ id }) => id === previousIds.at(-1))!;
  for (const field of Object.keys(preparation.moodOptions) as (keyof typeof preparation.moodOptions)[]) {
    assert.ok(preparation.moodOptions[field].includes(first.specialties[field]));
    if (first.specialties[field] !== last.specialties[field])
      assert.ok(preparation.moodOptions[field].includes(last.specialties[field]));
  }
  for (const id of initial.runtime!.openingCast!.filter((id) => previousIds.includes(id)))
    assert.ok(preparation.slots.includes(id));
  const sequences = new Set<number>();
  let sawSealedRanking = false;
  let openingCount = 0;
  for (let step = 0; step < 200 && state.runtime!.musicVideo?.phase !== 'complete'; step++) {
    const { action, revision } = nextAction(state);
    const prior = state;
    state = transitionMusicVideo(state, action, revision);
    restored = transitionMusicVideo(restored, action, revision);
    assert.deepEqual(normalized(state), normalized(restored));
    assert.equal(transitionMusicVideo(state, action, revision), state);
    restored = decodeSimulationState(encodeSimulationState(restored));
    assert.deepEqual(normalized(restored), normalized(state));
    assert.equal(records(state), oldRecords);
    const episode: MusicVideoEpisode | null | undefined = state.runtime!.musicVideo;
    if (!episode) continue;
    assert.deepEqual(episode.participantIds, previousIds);
    const scene = episode.scenes.at(-1);
    if (scene?.sequence) sequences.add(scene.sequence);
    if (!episode.secret) {
      for (const id of episode.participantIds) {
        const current = state.contestants.find((entry) => entry.id === id)!;
        const previous = initial.contestants.find((entry) => entry.id === id)!;
        assert.deepEqual(current.coreSkills, previous.coreSkills);
        assert.deepEqual(current.utilitySkills, previous.utilitySkills);
        if (episode.cut) assert.equal(current.condition, previous.condition);
      }
    }
    if (scene?.sequence && scene.sequence < 3) {
      const html = renderToStaticMarkup(
        <MusicVideoEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
      );
      assert.doesNotMatch(html, /Vivienne|discarded|reset cause|featuredIds|individualFocus/);
      assert.equal(episode.solos.length, 0);
      assert.equal(episode.takes.length, 0);
      assert.equal(episode.cut, null);
      assert.equal(episode.panel.length, 0);
    }
    if (episode.audience && !episode.rankRevealed) {
      sawSealedRanking = true;
      for (const person of projectSeasonCast(state.contestants, state.runtime!)) {
        const previous = initial.contestants.find(({ id }) => id === person.id)!;
        assert.equal(person.rank, previous.rank);
        assert.equal(person.aggregations.rankingScore, previous.aggregations.rankingScore);
      }
    }
    if (scene?.presentation === 'credits') {
      openingCount++;
      for (const id of episode.openingCast)
        assert.equal(
          state.contestants.find((entry) => entry.id === id)!.aggregations.audienceRatio,
          Math.min(1, prior.contestants.find((entry) => entry.id === id)!.aggregations.audienceRatio + 0.02),
        );
    }
    if (episode.mvp) {
      assert.ok(episode.eliminatedId);
      assert.equal(state.contestants.find(({ id }) => id === episode.eliminatedId)!.status, 'ELIMINATED');
      assert.equal(Object.keys(episode.mvp.ballots).length, 9);
      for (const [voter, choice] of Object.entries(episode.mvp.ballots)) {
        assert.ok(episode.survivorIds.includes(voter) && episode.survivorIds.includes(choice));
        assert.notEqual(voter, choice);
      }
    }
    if (episode.phase === 'secret-choice')
      assert.ok(episode.secretCandidates.every((id) => episode.survivorIds.includes(id)));
  }
  const episode = state.runtime!.musicVideo!;
  assert.equal(episode.phase, 'complete');
  assert.deepEqual([...sequences].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(openingCount, 1);
  assert.ok(sawSealedRanking);
  assert.equal(episode.storyboards.filter((entry) => entry.completed).length, 10);
  assert.equal(episode.solos.length, 10);
  assert.equal(episode.takes.filter((take) => !take.isReset).length, 5);
  assert.ok(episode.takes.filter((take) => take.isReset).length <= 1);
  assert.ok(episode.takes.every((take) => take.evaluations.length === 10));
  assert.equal(episode.filmingCompleted, true);
  assert.ok(episode.cut);
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9);
  assert.equal(episode.cut.featuredIds.length, 5);
  assert.equal(Object.values(episode.cut.individualFocus).filter((value) => value > 0).length, 5);
  close(
    Object.values(episode.cut.individualFocus).reduce((sum, value) => sum + value, 0),
    80,
  );
  close(
    Object.values(episode.cut.presence).reduce((sum, value) => sum + value, 0),
    280,
  );
  close(
    Object.values(episode.cut.exposure).reduce((sum, value) => sum + value, 0),
    1,
  );
  for (const id of episode.participantIds) {
    close(episode.cut.presence[id], 20 + episode.cut.individualFocus[id]);
    close(episode.cut.exposure[id], episode.cut.presence[id] / 280);
  }
  const priorities = new Map<string, number>();
  const choreography = new Map<string, number>();
  for (const id of episode.participantIds) {
    const solo = episode.solos.find((entry) => entry.contestantId === id)!;
    const slots = [1, 2, 3, 4, 5].map((number) => {
      const values = episode.takes
        .filter((take) => take.scheduledTake === number)
        .map((take) => take.evaluations.find((entry) => entry.contestantId === id)!.finalScore);
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    });
    priorities.set(id, 0.5 * solo.finalScore + 0.5 * ((slots[3] + slots[4]) / 2));
    choreography.set(id, slots.reduce((sum, value) => sum + value, 0) / 5);
  }
  const focusWeight = episode.cut.featuredIds.reduce((sum, id) => sum + 1 + priorities.get(id)!, 0);
  for (const id of episode.cut.featuredIds) {
    close(episode.cut.individualFocus[id], (80 * (1 + priorities.get(id)!)) / focusWeight);
    for (const other of episode.participantIds.filter(
      (candidate) => !episode.cut!.featuredIds.includes(candidate),
    ))
      assert.ok(priorities.get(id)! >= priorities.get(other)!);
  }
  for (const entry of episode.panel) {
    close(
      entry.performance,
      0.4 * episode.solos.find((solo) => solo.contestantId === entry.contestantId)!.finalScore +
        0.6 * choreography.get(entry.contestantId)!,
    );
    close(
      entry.finalScore,
      (entry.performance + entry.john + entry.megan + entry.michael + entry.director) / 5,
    );
  }
  assert.equal(episode.eliminatedId, episode.rankedIds[9]);
  assert.deepEqual(episode.survivorIds, episode.rankedIds.slice(0, 9));
  assert.equal(state.contestants.filter(({ status }) => status === 'ACTIVE').length, 9);
  assert.deepEqual(
    state.contestants.map(({ rank }) => rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
  );
  for (const prior of initial.contestants) {
    const current = state.contestants.find(({ id }) => id === prior.id)!;
    assert.equal(
      current.aggregations.experience,
      prior.aggregations.experience + (episode.participantIds.includes(prior.id) ? 7 : 0),
    );
    if (prior.status !== 'ACTIVE') {
      assert.equal(current.rank, prior.rank);
      assert.equal(current.status, prior.status);
      assert.equal(current.aggregations.rankingScore, prior.aggregations.rankingScore);
    }
  }
  const show = state.runtime!.show;
  assert.equal(show.general + Object.values(show.fans).reduce((sum, fans) => sum + fans, 0), show.audience);
  assert.equal(show.fans[episode.eliminatedId!], 0);
  assert.equal(JSON.stringify(initial), before);
  assert.deepEqual(state.runtime!.initialContestants, initial.runtime!.initialContestants);
  for (const [index, number] of ([1, 2, 3, 4, 5, 6, 7, 8] as const).entries())
    assert.equal(createEpisodeRundown(state, number), oldCopies[index]);
  for (const change of episodeRelationshipUpdates(state, 9).changes) {
    assert.equal(
      change.before,
      battleRelationship(initial.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
    assert.equal(
      change.after,
      battleRelationship(state.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
  }
  const rundown = createEpisodeRundown(state, 9);
  for (const text of [
    'Sequence 1',
    'Sequence 8',
    'Squirrel Life',
    'Vivienne',
    'Nine continue',
    'Relationships Updates',
  ])
    assert.ok(rundown.includes(text));
  assert.doesNotMatch(
    rundown,
    /\bsimulation\b|\bTV score\b|\bXP\b|experience points|randomAudit|randomStartState/i,
  );
  if (!episode.secret?.cardId) assert.doesNotMatch(rundown, /Recorded investigation/);
  assert.equal((createShowRundown(state).match(/^## Relationships Updates$/gm) ?? []).length, 9);
  const html = renderToStaticMarkup(
    <MusicVideoEpisodeView
      onAction={() => assert.fail('Finale is read-only')}
      onInspect={() => {}}
      state={state}
    />,
  );
  assert.match(html, /Episode 9 standings/);
  assert.match(html, /Nine continue/);
  assert.match(html, /Relationships Updates/);
  assert.equal(state.runtime!.episode, 9);
  assert.equal(await autoCompleteEpisode(state, 9), state);
  const corrupt = normalized(state);
  corrupt.runtime.musicVideo.takes[0].evaluations[0].rawDice[0] = 7;
  assert.match(
    loadSimulationState({ getItem: () => JSON.stringify(corrupt) }).persistenceError ?? '',
    /Could not restore/,
  );
  completed = state;
});

test('Music Videos investigation is blocking; failed saves preserve RNG and full history fits quota', async () => {
  const initial = await completedVarietyShow();
  const final = completed ?? (await autoCompleteEpisode(initial, 9));
  type Props = {
    children?: ReactNode;
    onClick?: () => void;
    open?: boolean;
    closable?: boolean;
    keyboard?: boolean;
    mask?: { closable?: boolean };
  };
  const elements = (node: ReactNode): ReactElement<Props>[] =>
    Children.toArray(node).flatMap((child) =>
      isValidElement<Props>(child) ? [child, ...elements(child.props.children)] : [],
    );
  const actions: [MusicVideoAction, number][] = [];
  const view = structuredClone(final);
  view.runtime!.musicVideo!.phase = 'secret-choice';
  view.runtime!.musicVideo!.secretCandidates = view.runtime!.musicVideo!.survivorIds.slice(0, 3);
  let tree: ReactNode;
  renderToStaticMarkup(
    <CaptureMusicVideo
      onAction={(action, revision) => actions.push([action, revision])}
      onCapture={(node) => {
        tree = node;
      }}
      state={view}
    />,
  );
  const modal = elements(tree).find((element) => element.type === Modal);
  assert.ok(modal);
  assert.equal(modal.props.open, true);
  assert.equal(modal.props.closable, false);
  assert.equal(modal.props.keyboard, false);
  assert.equal(modal.props.mask?.closable, false);
  const button = elements(modal.props.children).find(
    (element) =>
      element.type === Button &&
      Children.toArray(element.props.children).some(
        (text) => typeof text === 'string' && text.startsWith('Investigate'),
      ),
  );
  assert.ok(button?.props.onClick);
  button.props.onClick();
  assert.deepEqual(actions.at(-1), [
    {
      type: 'secret',
      contestantId: view.runtime!.musicVideo!.secretCandidates[0],
    },
    view.runtime!.musicVideo!.revision,
  ]);
  const previousState = simulationStore.state;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const quota = 10 * 1024 * 1024;
  let saved = JSON.stringify(initial);
  let writes = 0;
  let rejectWrites = true;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => saved,
        setItem(key: string, value: string) {
          assert.equal(key, SIMULATION_STORAGE_KEY);
          if (rejectWrites) throw new Error('Storage unavailable');
          if (value.length * 2 > quota) throw new Error('QuotaExceededError');
          saved = value;
          writes++;
        },
      },
    },
  });
  try {
    simulationStore.setState(() => initial);
    assert.throws(() => simulationActions.dispatchMusicVideo({ type: 'start' }, 0), /Storage unavailable/);
    assert.equal(simulationStore.state, initial);
    await assert.rejects(simulationActions.autoCompleteEpisode(9, initial), /Storage unavailable/);
    assert.equal(simulationStore.state, initial);
    assert.equal(writes, 0);
    rejectWrites = false;
    simulationActions.dispatchMusicVideo({ type: 'start' }, 0);
    const prepared = simulationStore.state;
    assert.throws(
      () => simulationActions.dispatchMusicVideo({ type: 'randomize-mood' }, 99),
      /revision|stale/i,
    );
    assert.equal(simulationStore.state, prepared);
    await simulationActions.autoCompleteEpisode(9, prepared);
    assert.equal(simulationStore.state.runtime!.musicVideo!.phase, 'complete');
    assert.equal(simulationStore.state.runtime!.episode, 9);
    assert.ok(saved.length * 2 < quota);
    assert.deepEqual(normalized(decodeSimulationState(saved)), normalized(simulationStore.state));
    const current = simulationStore.state;
    const previousWrites = writes;
    await simulationActions.autoCompleteEpisode(9, current);
    assert.equal(simulationStore.state, current);
    assert.equal(writes, previousWrites);
  } finally {
    simulationStore.setState(() => previousState);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
