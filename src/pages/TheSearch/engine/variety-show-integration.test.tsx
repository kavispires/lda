import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Button, Modal } from 'antd';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VarietyShowEpisodeView } from '../components/VarietyShowEpisodeView';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { SimulationState } from '../types/simulation';
import type { VarietyShowAction } from '../types/variety-show-episode';
import { createEpisodeRundown } from '../utilities/episode-rundown';
import { projectSeasonCast } from '../utilities/episode-visibility';
import { episodeRelationshipUpdates } from '../utilities/relationship-updates';
import { createShowRundown } from '../utilities/show-rundown';
import { battleRelationship } from './battle-scoring';
import { completedBattlesForBootcamp } from './bootcamp-fixtures';
import { autoCompleteEpisode } from './episode-auto-complete';
import {
  decodeSimulationState,
  encodeSimulationState,
  loadSimulationState,
  SIMULATION_STORAGE_KEY,
} from './simulation-persistence';
import { transitionVarietyShow } from './variety-show-episode';

let baseline: Promise<SimulationState> | undefined;
async function completedVersatility() {
  baseline ??= (async () => {
    let state = completedBattlesForBootcamp();
    for (const number of [3, 4, 5, 6, 7] as const) state = await autoCompleteEpisode(state, number);
    return state;
  })();
  return structuredClone(await baseline);
}
const normalized = (state: SimulationState) => JSON.parse(JSON.stringify(state));
const records = (state: SimulationState) =>
  JSON.stringify([
    state.runtime!.audition,
    state.runtime!.battle,
    state.runtime!.bootcamp,
    state.runtime!.megaGroups,
    state.runtime!.photoshoot,
    state.runtime!.trackSpecials,
    state.runtime!.versatility,
  ]);

function nextAction(state: SimulationState): { action: VarietyShowAction; revision: number } {
  const episode = state.runtime!.varietyShow;
  const preparation = state.runtime!.preparations?.[8];
  if (episode) {
    if (episode.phase === 'intervention')
      return { action: { type: 'conflict', choice: 'support' }, revision: episode.revision };
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

function CaptureVariety({
  state,
  onAction,
  onCapture,
}: {
  state: SimulationState;
  onAction: (action: VarietyShowAction, revision: number) => void;
  onCapture: (node: ReactNode) => void;
}) {
  onCapture(
    VarietyShowEpisodeView({
      state,
      onAction,
      onInspect: () => {},
      actionError: 'Could not save the decision.',
    }),
  );
  return null;
}

test('Variety Show restores every beat, protects private icebreaker evidence and preserves seven archives', async () => {
  const initial = await completedVersatility();
  delete initial.runtime!.definitions.varietyShowCatalog;
  const before = JSON.stringify(initial);
  const oldRecords = records(initial);
  const oldCopies = ([1, 2, 3, 4, 5, 6, 7] as const).map((number) => createEpisodeRundown(initial, number));
  let state = initial;
  let restored = decodeSimulationState(JSON.stringify(initial));
  const sequences = new Set<number>();
  let frozenBallots: string | undefined;
  let sawSealedRanking = false;
  let sawPendingInterview = false;
  for (let step = 0; step < 160 && state.runtime!.varietyShow?.phase !== 'complete'; step++) {
    const { action, revision } = nextAction(state);
    const prior = state;
    state = transitionVarietyShow(state, action, revision);
    restored = transitionVarietyShow(restored, action, revision);
    assert.deepEqual(normalized(state), normalized(restored));
    assert.equal(transitionVarietyShow(state, action, revision), state, 'duplicate action is idempotent');
    restored = decodeSimulationState(encodeSimulationState(restored));
    assert.deepEqual(normalized(restored), normalized(state));
    assert.equal(records(state), oldRecords);
    const episode = state.runtime!.varietyShow;
    if (!episode) {
      const preparation = state.runtime!.preparations![8]!;
      const previousIds = initial.runtime!.versatility!.survivorIds;
      const first = initial.contestants.find(({ id }) => id === previousIds[0])!;
      const last = initial.contestants.find(({ id }) => id === previousIds.at(-1))!;
      for (const field of Object.keys(preparation.moodOptions) as (keyof typeof preparation.moodOptions)[]) {
        assert.ok(preparation.moodOptions[field].includes(first.specialties[field]));
        if (first.specialties[field] !== last.specialties[field])
          assert.ok(preparation.moodOptions[field].includes(last.specialties[field]));
      }
      const retained = initial.runtime!.openingCast!.filter((id) => previousIds.includes(id));
      assert.ok(retained.every((id) => preparation.slots.includes(id)));
      continue;
    }
    const scene = episode.scenes.at(-1);
    if (scene?.sequence) sequences.add(scene.sequence);
    assert.deepEqual(episode.participantIds, initial.runtime!.versatility!.survivorIds);
    if (!episode.secret) {
      for (const id of episode.participantIds) {
        const person = state.contestants.find((entry) => entry.id === id)!;
        const start = initial.contestants.find((entry) => entry.id === id)!;
        assert.deepEqual(person.coreSkills, start.coreSkills);
        assert.deepEqual(person.utilitySkills, start.utilitySkills);
        assert.equal(person.condition, start.condition);
        assert.equal(person.aggregations.practice, start.aggregations.practice);
        assert.equal(person.aggregations.center, start.aggregations.center);
      }
    }
    if (episode.icebreaker) {
      const ballots = JSON.stringify(episode.icebreaker.categories.map((category) => category.ballots));
      frozenBallots ??= ballots;
      assert.equal(ballots, frozenBallots);
    }
    if (scene?.sequence === 3) {
      const html = renderToStaticMarkup(
        <VarietyShowEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
      );
      assert.doesNotMatch(html, /shortlistIds|statValues|frozenContestants|vote totals|voted for/i);
    }
    for (const segment of episode.segments)
      if (segment.kind === 'interview' && segment.evaluations.length > 0 && segment.evaluations.length < 4) {
        sawPendingInterview = true;
        assert.equal(segment.teamScore, null);
        assert.ok(segment.evaluations.every((evaluation) => evaluation.finalScore === null));
      }
    if (episode.audience && !episode.rankRevealed) {
      sawSealedRanking = true;
      const visible = projectSeasonCast(state.contestants, state.runtime!);
      for (const id of episode.participantIds) {
        const person = visible.find((entry) => entry.id === id)!;
        const previous = initial.contestants.find((entry) => entry.id === id)!;
        assert.equal(person.rank, previous.rank);
        assert.equal(person.aggregations.rankingScore, previous.aggregations.rankingScore);
      }
    }
    if (
      prior.runtime!.varietyShow?.phase === 'credits' &&
      episode.scenes.at(-1)?.presentation === 'credits'
    ) {
      for (const id of episode.openingCast)
        assert.equal(
          state.contestants.find((entry) => entry.id === id)!.aggregations.audienceRatio,
          Math.min(1, prior.contestants.find((entry) => entry.id === id)!.aggregations.audienceRatio + 0.02),
        );
    }
  }
  const episode = state.runtime!.varietyShow!;
  assert.equal(episode.phase, 'complete');
  assert.deepEqual([...sequences].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(sawSealedRanking && sawPendingInterview);
  assert.equal(episode.icebreaker!.categories.length, 8);
  assert.equal(episode.icebreaker!.revealCursor, 8);
  assert.equal(episode.teams.length, 3);
  assert.equal(new Set(episode.teams.flatMap((team) => team.memberIds)).size, 12);
  assert.ok(episode.teams.every((team) => team.memberIds.length === 4 && team.preparation?.completed));
  assert.equal(episode.segments.length, 9);
  assert.equal(episode.segments.flatMap((segment) => segment.evaluations).length, 36);
  for (const segment of episode.segments) {
    assert.ok(segment.teamScore !== null);
    for (const evaluation of segment.evaluations)
      assert.equal(evaluation.finalScore, 0.7 * evaluation.personalScore + 0.3 * segment.teamScore);
  }
  assert.equal(episode.panel.length, 12);
  for (const entry of episode.panel)
    assert.equal(
      entry.finalScore,
      (entry.variety + entry.john + entry.megan + entry.michael + entry.roxana) / 5,
    );
  assert.ok(episode.mvp);
  assert.equal(Object.keys(episode.mvp.ballots).length, 12);
  for (const [voter, choice] of Object.entries(episode.mvp.ballots)) {
    assert.ok(episode.participantIds.includes(voter) && episode.participantIds.includes(choice));
    assert.notEqual(voter, choice);
  }
  assert.deepEqual(episode.eliminatedIds, episode.rankedIds.slice(10));
  assert.deepEqual(episode.survivorIds, episode.rankedIds.slice(0, 10));
  assert.equal(state.contestants.filter(({ status }) => status === 'ACTIVE').length, 10);
  assert.deepEqual(
    state.contestants.map(({ rank }) => rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
  );
  for (const prior of initial.contestants) {
    const current = state.contestants.find(({ id }) => id === prior.id)!;
    assert.equal(
      current.aggregations.experience,
      prior.aggregations.experience + (episode.participantIds.includes(prior.id) ? 10 : 0),
    );
    if (prior.status !== 'ACTIVE') {
      assert.equal(current.rank, prior.rank);
      assert.equal(current.status, prior.status);
      assert.equal(current.aggregations.rankingScore, prior.aggregations.rankingScore);
    }
  }
  const show = state.runtime!.show;
  assert.equal(
    show.general + Object.values(show.fans).reduce((total, fans) => total + fans, 0),
    show.audience,
  );
  for (const id of episode.eliminatedIds) assert.equal(show.fans[id], 0);
  assert.equal(JSON.stringify(initial), before);
  assert.deepEqual(state.runtime!.initialContestants, initial.runtime!.initialContestants);
  for (const [index, number] of ([1, 2, 3, 4, 5, 6, 7] as const).entries())
    assert.equal(createEpisodeRundown(state, number), oldCopies[index]);
  for (const change of episodeRelationshipUpdates(state, 8).changes) {
    assert.equal(
      change.before,
      battleRelationship(initial.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
    assert.equal(
      change.after,
      battleRelationship(state.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
  }
  const rundown = createEpisodeRundown(state, 8);
  for (const text of [
    'Sequence 1',
    'Sequence 8',
    'Icebreaker winners',
    'Roxana',
    'Ten continue',
    'Relationships Updates',
  ])
    assert.ok(rundown.includes(text));
  assert.doesNotMatch(
    rundown,
    /\bsimulation\b|\bTV score\b|\bXP\b|experience points|shortlistIds|statValues|frozenContestants/i,
  );
  if (!episode.secret?.cardId) assert.doesNotMatch(rundown, /Recorded investigation/);
  assert.equal((createShowRundown(state).match(/^## Relationships Updates$/gm) ?? []).length, 8);
  const html = renderToStaticMarkup(
    <VarietyShowEpisodeView
      onAction={() => assert.fail('Finale is read-only')}
      onInspect={() => {}}
      state={state}
    />,
  );
  assert.match(html, /Episode 8 standings/);
  assert.match(html, /Ten continue/);
  assert.match(html, /Relationships Updates/);
  assert.equal(state.runtime!.episode, 8);
  assert.equal(await autoCompleteEpisode(state, 8), state);
  const corrupt = normalized(state);
  corrupt.runtime.varietyShow.segments[0].evaluations[0].rawDice[0] = 7;
  assert.match(
    loadSimulationState({ getItem: () => JSON.stringify(corrupt) }).persistenceError ?? '',
    /Could not restore/,
  );
});

test('Variety Show decisions are blocking and revision bound; failed saves publish no changes and full history fits quota', async () => {
  const initial = await completedVersatility();
  const completed = await autoCompleteEpisode(initial, 8);
  const episode = completed.runtime!.varietyShow!;
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
  const actions: [VarietyShowAction, number][] = [];
  let tree: ReactNode;
  for (const phase of ['intervention', 'secret-choice'] as const) {
    const view = structuredClone(completed);
    view.runtime!.varietyShow!.phase = phase;
    view.runtime!.varietyShow!.secretCandidates = episode.participantIds.slice(0, 3);
    renderToStaticMarkup(
      <CaptureVariety
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
          (text) =>
            typeof text === 'string' && text.startsWith(phase === 'intervention' ? 'Mediate' : 'Investigate'),
        ),
    );
    assert.ok(button?.props.onClick);
    button.props.onClick();
    assert.deepEqual(actions.at(-1), [
      phase === 'intervention'
        ? { type: 'conflict', choice: 'mediate' }
        : { type: 'secret', contestantId: episode.participantIds[0] },
      episode.revision,
    ]);
  }
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
    assert.throws(() => simulationActions.dispatchVarietyShow({ type: 'start' }, 0), /Storage unavailable/);
    assert.equal(simulationStore.state, initial);
    await assert.rejects(simulationActions.autoCompleteEpisode(8, initial), /Storage unavailable/);
    assert.equal(simulationStore.state, initial);
    assert.equal(writes, 0);
    rejectWrites = false;
    simulationActions.dispatchVarietyShow({ type: 'start' }, 0);
    const prepared = simulationStore.state;
    const preparations = JSON.stringify(prepared.runtime!.preparations);
    assert.throws(
      () => simulationActions.dispatchVarietyShow({ type: 'randomize-mood' }, 99),
      /revision|stale/i,
    );
    assert.equal(JSON.stringify(simulationStore.state.runtime!.preparations), preparations);
    await simulationActions.autoCompleteEpisode(8, prepared);
    assert.equal(simulationStore.state.runtime!.varietyShow!.phase, 'complete');
    assert.equal(simulationStore.state.runtime!.episode, 8);
    assert.ok(saved.length * 2 < quota);
    assert.deepEqual(normalized(decodeSimulationState(saved)), normalized(simulationStore.state));
    const final = simulationStore.state;
    const previousWrites = writes;
    await simulationActions.autoCompleteEpisode(8, final);
    assert.equal(simulationStore.state, final);
    assert.equal(writes, previousWrites);
  } finally {
    simulationStore.setState(() => previousState);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
