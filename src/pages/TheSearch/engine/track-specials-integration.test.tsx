import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Button, Modal } from 'antd';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrackSpecialsEpisodeView } from '../components/TrackSpecialsEpisodeView';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { SimulationState } from '../types/simulation';
import type { TrackSpecialsAction } from '../types/track-specials-episode';
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
import { transitionTrackSpecials } from './track-specials-episode';

let baseline: Promise<SimulationState> | undefined;
async function completedPhotoshoot() {
  baseline ??= (async () => {
    let state = completedBattlesForBootcamp();
    for (const number of [3, 4, 5] as const) state = await autoCompleteEpisode(state, number);
    return state;
  })();
  return structuredClone(await baseline);
}
const normalized = (state: SimulationState) => JSON.parse(JSON.stringify(state));
function CaptureTrackSpecials({
  state,
  onAction,
  onCapture,
}: {
  state: SimulationState;
  onAction: (action: TrackSpecialsAction, revision: number) => void;
  onCapture: (node: ReactNode) => void;
}) {
  onCapture(
    TrackSpecialsEpisodeView({
      state,
      onAction,
      onInspect: () => {},
      actionError: 'Could not save the decision.',
    }),
  );
  return null;
}
function nextAction(state: SimulationState): { action: TrackSpecialsAction; revision: number } {
  const episode = state.runtime!.trackSpecials;
  const preparation = state.runtime!.preparations?.[6];
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

test('Track Specials restores every beat, preserves earlier episodes and ends with exactly fifteen survivors', async () => {
  const initial = await completedPhotoshoot();
  delete initial.runtime!.definitions.trackSpecialSongs;
  const before = JSON.stringify(initial);
  const oldRecords = JSON.stringify([
    initial.runtime!.audition,
    initial.runtime!.battle,
    initial.runtime!.bootcamp,
    initial.runtime!.megaGroups,
    initial.runtime!.photoshoot,
  ]);
  const oldCopies = ([1, 2, 3, 4, 5] as const).map((number) => createEpisodeRundown(initial, number));
  let state = initial;
  let restored = decodeSimulationState(JSON.stringify(initial));
  const sequences = new Set<number>();
  let sealed = false;
  for (let step = 0; step < 350 && state.runtime!.trackSpecials?.phase !== 'complete'; step++) {
    if (step % 4 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const { action, revision } = nextAction(state);
    const previous = state;
    state = transitionTrackSpecials(state, action, revision);
    restored = decodeSimulationState(
      encodeSimulationState(transitionTrackSpecials(restored, action, revision)),
    );
    assert.deepEqual(normalized(restored), normalized(state), `Episode 6 reload diverged at ${step}`);
    const episode = state.runtime!.trackSpecials;
    if (!episode) continue;
    const latest = episode.scenes.at(-1);
    if (latest?.sequence) sequences.add(latest.sequence);
    if (latest?.sequence && latest.sequence < 5)
      assert.doesNotMatch(
        episode.scenes.flatMap((scene) => scene.paragraphs).join('\n'),
        /jury|thirty-four.*return|34.*return/i,
      );
    assert.doesNotMatch(
      episode.scenes
        .filter((scene) => scene.sequence !== undefined && scene.sequence < 7)
        .flatMap((scene) => scene.paragraphs)
        .join('\n'),
      /\bworst\b/i,
      'Keep the Worst awards a surprise until the tally',
    );
    if (!episode.rankRevealed) {
      for (const visible of projectSeasonCast(state.contestants, state.runtime!)) {
        const prior = initial.contestants.find(({ id }) => id === visible.id)!;
        assert.equal(visible.rank, prior.rank);
        assert.equal(visible.aggregations.rankingScore, prior.aggregations.rankingScore);
      }
      if (episode.audience) sealed = true;
    }
    if (episode.audience && !previous.runtime?.trackSpecials?.audience) {
      const maximumVotes = Math.max(...Object.values(episode.audience.votes));
      for (const evidence of episode.evidence) {
        const contestant = state.contestants.find(({ id }) => id === evidence.contestantId);
        const prior = initial.contestants.find(({ id }) => id === evidence.contestantId);
        assert.ok(contestant && prior);
        const votes = maximumVotes ? (100 * episode.audience.votes[contestant.id]) / maximumVotes : 0;
        const expected =
          0.75 * prior.aggregations.rankingScore +
          0.6 * evidence.finalScore +
          0.3 * votes +
          0.1 * 50 * (contestant.aggregations.productionRatio + 1);
        assert.ok(Math.abs(episode.sealedRankingScores[contestant.id] - expected) < 1e-9);
      }
    }
    if (episode.phase === 'credits') {
      const html = renderToStaticMarkup(
        <TrackSpecialsEpisodeView
          onAction={() => assert.fail('Rendering is read-only')}
          onInspect={() => {}}
          state={state}
        />,
      );
      assert.match(html, /aria-label="Opening cast"/);
      assert.match(html, /Opening song lyrics/);
      assert.equal((html.match(/data-contestant-id=/g) ?? []).length, 5);
    }
    if (episode.phase === 'intervention' || episode.phase === 'secret-choice') {
      const html = renderToStaticMarkup(
        <TrackSpecialsEpisodeView
          onAction={() => assert.fail('Rendering is read-only')}
          onInspect={() => {}}
          state={state}
        />,
      );
      assert.match(html, /paused for your decision/);
      assert.doesNotMatch(html, />Support the team<|>Investigate [^<]+</);
    }
    if (episode.phase === 'ranking') {
      const reactions = latest?.paragraphs.filter((paragraph) => !/^\d+[.)]\s/.test(paragraph)) ?? [];
      const largeMove = episode.rankedIds.some(
        (id, index) =>
          id !== episode.eliminatedId && Math.abs(episode.previousRankedIds.indexOf(id) - index) >= 3,
      );
      if (largeMove) assert.ok(reactions.length > 0, 'Large ranking changes need visible reactions');
      const html = renderToStaticMarkup(
        <TrackSpecialsEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
      );
      for (const reaction of reactions) {
        const id = latest?.paragraphContestantIds?.[latest.paragraphs.indexOf(reaction)]?.[0];
        const contestant = state.contestants.find((person) => person.id === id);
        assert.ok(contestant);
        assert.ok(html.includes(reaction.slice(contestant.name.length)));
      }
    }
  }
  const episode = state.runtime!.trackSpecials!;
  assert.equal(episode.phase, 'complete');
  assert.ok(sealed);
  assert.deepEqual([...sequences].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(episode.juryIds.length, 34);
  assert.ok(episode.juryIds.includes(state.runtime!.megaGroups!.withdrawnId!));
  assert.equal(new Set(episode.juryIds).size, 34);
  assert.ok(episode.juryIds.every((id) => !episode.participantIds.includes(id)));
  assert.equal(episode.performances.flatMap((performance) => performance.evaluations).length, 16);
  for (const award of episode.awards) {
    assert.equal(Object.keys(award.ballots).length, award.status === 'not-contested' ? 0 : 34);
    for (const ballot of Object.values(award.ballots)) {
      assert.ok(award.eligibleIds.includes(ballot.bestId));
      if (ballot.worstId) {
        assert.ok(award.eligibleIds.includes(ballot.worstId));
        assert.notEqual(ballot.bestId, ballot.worstId);
      } else assert.equal(award.status, 'uncontested');
    }
  }
  for (const evaluation of episode.performances.flatMap((performance) => performance.evaluations)) {
    const factors: number[] = [];
    for (const award of episode.awards) {
      const receives = (recipientId: string | null) =>
        award.category === 'group'
          ? episode.teams.find(({ id }) => id === recipientId)?.memberIds.includes(evaluation.contestantId)
          : recipientId === evaluation.contestantId;
      if (receives(award.bestId)) factors.push(award.category === 'overall' ? 1.35 : 1.2);
      if (receives(award.worstId)) factors.push(award.category === 'overall' ? 0.65 : 0.8);
    }
    const multiplier = Math.max(
      0.4,
      Math.min(
        2,
        factors.reduce((product, factor) => product * factor, 1),
      ),
    );
    assert.equal(episode.awardEffects[evaluation.contestantId].multiplier, multiplier);
    assert.equal(
      episode.evidence.find(({ contestantId }) => contestantId === evaluation.contestantId)?.finalScore,
      Math.max(0, Math.min(100, evaluation.finalScore * multiplier)),
    );
  }
  assert.equal(episode.survivorIds.length, 15);
  assert.equal(episode.eliminatedId, episode.rankedIds[15]);
  assert.equal(state.contestants.filter(({ status }) => status === 'ACTIVE').length, 15);
  assert.deepEqual(
    state.contestants.map(({ rank }) => rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
  );
  for (const prior of initial.contestants) {
    const current = state.contestants.find(({ id }) => id === prior.id)!;
    assert.equal(
      current.aggregations.experience,
      prior.aggregations.experience + (episode.participantIds.includes(prior.id) ? 5 : 0),
    );
    if (prior.status === 'ELIMINATED') {
      assert.equal(current.rank, prior.rank);
      assert.equal(current.status, prior.status);
      assert.equal(current.aggregations.rankingScore, prior.aggregations.rankingScore);
    }
  }
  assert.equal(JSON.stringify(initial), before);
  assert.equal(
    JSON.stringify([
      state.runtime!.audition,
      state.runtime!.battle,
      state.runtime!.bootcamp,
      state.runtime!.megaGroups,
      state.runtime!.photoshoot,
    ]),
    oldRecords,
  );
  for (const [index, number] of ([1, 2, 3, 4, 5] as const).entries())
    assert.equal(createEpisodeRundown(state, number), oldCopies[index]);
  const rundown = createEpisodeRundown(state, 6);
  for (const text of [
    'Sequence 1',
    'Sequence 8',
    'Returning jury',
    'Continuing ranking',
    'Relationships Updates',
  ])
    assert.ok(rundown.includes(text));
  assert.doesNotMatch(rundown, /\bsimulation\b|\bTV score\b|\bXP\b|experience points/i);
  assert.equal((createShowRundown(state).match(/^## Relationships Updates$/gm) ?? []).length, 6);
  for (const change of episodeRelationshipUpdates(state, 6).changes) {
    assert.equal(
      change.before,
      battleRelationship(initial.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
    assert.equal(
      change.after,
      battleRelationship(state.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
  }
  assert.ok(episode.mvp);
  assert.equal(Object.keys(episode.mvp.ballots).length, 16);
  for (const [voter, choice] of Object.entries(episode.mvp.ballots)) assert.notEqual(voter, choice);
  const html = renderToStaticMarkup(
    <TrackSpecialsEpisodeView
      onAction={() => assert.fail('Finale is read-only')}
      onInspect={() => {}}
      state={state}
    />,
  );
  assert.match(html, /aria-label="Episode 6 standings"/);
  assert.match(html, /Fifteen continue/);
  assert.match(html, /Relationships Updates/);
  assert.equal(state.runtime!.episode, 6);
  const corrupt = normalized(state);
  corrupt.runtime.trackSpecials.performances[0].evaluations[0].finalScore +=
    corrupt.runtime.trackSpecials.performances[0].evaluations[0].finalScore > 99 ? -1 : 1;
  assert.match(
    loadSimulationState({ getItem: () => JSON.stringify(corrupt) }).persistenceError ?? '',
    /Could not restore/,
  );
});

test('Track Specials store fails atomically and auto-completes under quota without repeating awards', async () => {
  const initial = await completedPhotoshoot();
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
          writes++;
          assert.equal(simulationStore.state, initial, 'save before publishing');
          assert.equal(key, SIMULATION_STORAGE_KEY);
          if (rejectWrites) throw new DOMException('Storage unavailable', 'QuotaExceededError');
          if (2 * (key.length + value.length) > quota)
            throw new DOMException('Quota exceeded', 'QuotaExceededError');
          saved = value;
        },
      },
    },
  });

  async function verifyDecisionModals() {
    const state = await autoCompleteEpisode(await completedPhotoshoot(), 6);
    const episode = state.runtime?.trackSpecials;
    assert.ok(episode);
    type Props = {
      children?: ReactNode;
      onClick?: () => void;
      open?: boolean;
      closable?: boolean;
      keyboard?: boolean;
      mask?: { closable?: boolean };
    };
    function elements(node: ReactNode): ReactElement<Props>[] {
      return Children.toArray(node).flatMap((child) =>
        isValidElement<Props>(child) ? [child, ...elements(child.props.children)] : [],
      );
    }
    const actions: [TrackSpecialsAction, number][] = [];
    let tree: ReactNode;
    for (const phase of ['intervention', 'secret-choice'] as const) {
      episode.phase = phase;
      episode.secretCandidates = episode.participantIds.slice(0, 3);
      renderToStaticMarkup(
        <CaptureTrackSpecials
          onAction={(action, revision) => actions.push([action, revision])}
          onCapture={(node) => {
            tree = node;
          }}
          state={state}
        />,
      );
      const modal = elements(tree).find((element) => element.type === Modal);
      assert.ok(modal, `${phase} must be a modal, not inline controls`);
      assert.equal(modal.props.open, true);
      assert.equal(modal.props.closable, false);
      assert.equal(modal.props.keyboard, false);
      assert.equal(modal.props.mask?.closable, false);
      const buttons = elements(modal.props.children).filter((element) => element.type === Button);
      const choice = buttons.find((button) =>
        Children.toArray(button.props.children).some(
          (text) =>
            typeof text === 'string' && text.startsWith(phase === 'intervention' ? 'Mediate' : 'Investigate'),
        ),
      );
      assert.ok(choice?.props.onClick);
      choice.props.onClick();
      assert.deepEqual(actions.at(-1), [
        phase === 'intervention'
          ? { type: 'conflict', choice: 'mediate' }
          : { type: 'secret', contestantId: episode.secretCandidates[0] },
        episode.revision,
      ]);
    }
  }
  simulationStore.setState(() => initial);
  try {
    await verifyDecisionModals();
    assert.throws(() => simulationActions.dispatchTrackSpecials({ type: 'start' }, 0), /Storage unavailable/);
    assert.equal(simulationStore.state, initial);
    assert.equal(saved, JSON.stringify(initial));
    rejectWrites = false;
    writes = 0;
    await simulationActions.autoCompleteEpisode(6, initial);
    const completed = simulationStore.state;
    assert.equal(completed.runtime!.trackSpecials!.phase, 'complete');
    assert.equal(writes, 1);
    assert.ok(2 * (SIMULATION_STORAGE_KEY.length + saved.length) <= quota);
    assert.deepEqual(normalized(loadSimulationState({ getItem: () => saved })), normalized(completed));
    await simulationActions.autoCompleteEpisode(6, completed);
    assert.equal(writes, 1);
    assert.equal(simulationStore.state, completed);
  } finally {
    simulationStore.setState(() => previousState);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
