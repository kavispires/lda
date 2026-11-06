import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Button, Modal } from 'antd';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VersatilityEpisodeView } from '../components/VersatilityEpisodeView';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { SimulationState } from '../types/simulation';
import type { VersatilityAction } from '../types/versatility-episode';
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
import { transitionVersatility } from './versatility-episode';

let baseline: Promise<SimulationState> | undefined;
async function completedTrackSpecials() {
  baseline ??= (async () => {
    let state = completedBattlesForBootcamp();
    for (const number of [3, 4, 5, 6] as const) state = await autoCompleteEpisode(state, number);
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
  ]);

function nextAction(state: SimulationState): { action: VersatilityAction; revision: number } {
  const episode = state.runtime!.versatility;
  const preparation = state.runtime!.preparations?.[7];
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

function CaptureVersatility({
  state,
  onAction,
  onCapture,
}: {
  state: SimulationState;
  onAction: (action: VersatilityAction, revision: number) => void;
  onCapture: (node: ReactNode) => void;
}) {
  onCapture(
    VersatilityEpisodeView({
      state,
      onAction,
      onInspect: () => {},
      actionError: 'Could not save the decision.',
    }),
  );
  return null;
}

test('Versatility restores every beat, preserves six archives, and separates announced ranks from final departures', async () => {
  const initial = await completedTrackSpecials();
  delete initial.runtime!.definitions.versatilitySongs;
  delete initial.runtime!.definitions.doubtGirls;
  const before = JSON.stringify(initial);
  const oldRecords = records(initial);
  const oldCopies = ([1, 2, 3, 4, 5, 6] as const).map((number) => createEpisodeRundown(initial, number));
  let state = initial;
  let restored = decodeSimulationState(JSON.stringify(initial));
  const sequences = new Set<number>();
  let sawHolding = false;
  let sawLockedRanking = false;
  let lockedPerformances: string | undefined;
  let grownCast: SimulationState['contestants'] | undefined;
  let holdingCast: SimulationState['contestants'] | undefined;
  let hiddenSecretHolders: string[] = [];
  for (let step = 0; step < 400 && state.runtime!.versatility?.phase !== 'complete'; step++) {
    if (step % 4 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const { action, revision } = nextAction(state);
    const previous = state;
    state = transitionVersatility(state, action, revision);
    restored = decodeSimulationState(
      encodeSimulationState(transitionVersatility(restored, action, revision)),
    );
    assert.deepEqual(normalized(restored), normalized(state), `Episode 7 reload diverged at ${step}`);
    const episode = state.runtime!.versatility;
    if (!episode) continue;
    const latest = episode.scenes.at(-1);
    if (latest?.sequence) sequences.add(latest.sequence);
    if (latest?.sequence && latest.sequence < 4) assert.equal(episode.guestId, null);
    if (episode.performances.length === 3) {
      lockedPerformances ??= JSON.stringify(episode.performances);
      assert.equal(JSON.stringify(episode.performances), lockedPerformances);
    }
    if (episode.breakthroughs.length === 15 && !grownCast) grownCast = structuredClone(state.contestants);
    if (!episode.rankRevealed) {
      for (const visible of projectSeasonCast(state.contestants, state.runtime!)) {
        const prior = initial.contestants.find(({ id }) => id === visible.id)!;
        assert.equal(visible.rank, prior.rank);
        assert.equal(visible.aggregations.rankingScore, prior.aggregations.rankingScore);
      }
    }
    if (episode.audience && !previous.runtime?.versatility?.audience) {
      sawLockedRanking = true;
      const maximumVotes = Math.max(...Object.values(episode.audience.votes));
      for (const evidence of episode.evidence) {
        const contestant = state.contestants.find(({ id }) => id === evidence.contestantId)!;
        const prior = initial.contestants.find(({ id }) => id === evidence.contestantId)!;
        const votes = maximumVotes ? (100 * episode.audience.votes[contestant.id]) / maximumVotes : 0;
        const expected =
          0.75 * prior.aggregations.rankingScore +
          0.6 * evidence.finalScore +
          0.3 * votes +
          0.1 * 50 * (contestant.aggregations.productionRatio + 1);
        assert.ok(Math.abs(episode.sealedRankingScores[contestant.id] - expected) < 1e-9);
      }
    }
    if (episode.phase === 'briefing' || episode.phase === 'credits') {
      const html = renderToStaticMarkup(
        <VersatilityEpisodeView
          onAction={() => assert.fail('Rendering is read-only')}
          onInspect={() => {}}
          state={state}
        />,
      );
      if (episode.phase === 'credits') {
        assert.match(html, /aria-label="Opening cast"/);
        assert.match(html, /Opening song lyrics/);
      } else assert.doesNotMatch(html, /aria-label="Opening cast"/);
    }
    if (episode.phase === 'holding') {
      sawHolding = true;
      holdingCast = structuredClone(state.contestants.filter(({ status }) => status === 'ACTIVE'));
      hiddenSecretHolders = holdingCast
        .filter((person) =>
          person.attributes.some(
            (cardId) =>
              Object.hasOwn(state.runtime!.definitions.cards.secret, cardId) &&
              !state.runtime!.revealedSecrets.some(
                (entry) => entry.contestantId === person.id && entry.cardId === cardId,
              ),
          ),
        )
        .map(({ id }) => id);
      assert.equal(state.contestants.filter(({ status }) => status === 'ACTIVE').length, 13);
      assert.equal(episode.expelledId, null);
      assert.equal(episode.expulsion, null);
    }
    if (episode.phase === 'intervention' || episode.phase === 'secret-choice') {
      const html = renderToStaticMarkup(
        <VersatilityEpisodeView
          onAction={() => assert.fail('Rendering is read-only')}
          onInspect={() => {}}
          state={state}
        />,
      );
      assert.match(html, /paused for your decision/);
      assert.doesNotMatch(html, />Support the team<|>Investigate [^<]+</);
    }
  }
  const episode = state.runtime!.versatility!;
  assert.equal(episode.phase, 'complete');
  assert.ok(sawHolding && sawLockedRanking && grownCast && lockedPerformances);
  assert.deepEqual([...sequences].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(episode.teams.length, 3);
  assert.equal(new Set(episode.teams.flatMap((team) => team.memberIds)).size, 15);
  for (const team of episode.teams) {
    assert.equal(team.memberIds.length, 5);
    assert.equal(team.practice.length, 2);
  }
  const evaluations = episode.performances.flatMap((performance) => performance.evaluations);
  assert.equal(evaluations.length, 15);
  assert.equal(new Set(evaluations.map(({ contestantId }) => contestantId)).size, 15);
  for (const evaluation of evaluations) {
    const original = initial.contestants.find(({ id }) => id === evaluation.contestantId)!;
    assert.notEqual(evaluation.track, original.track);
    assert.equal(evaluation.rawDice.length, 2);
    assert.ok(evaluation.rawDice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6));
  }
  assert.equal(episode.breakthroughs.length, 15);
  for (const growth of episode.breakthroughs) {
    assert.equal(growth.passed, growth.gateDie === 6 && growth.potentialDie <= growth.potential);
    assert.equal(growth.after, Math.min(5, growth.before + (growth.passed ? 1 : 0)));
    assert.equal(
      grownCast!.find(({ id }) => id === growth.contestantId)!.coreSkills[growth.skill],
      growth.after,
    );
  }
  assert.equal(episode.survivorIds.length, 12);
  assert.deepEqual(episode.eliminatedIds, episode.rankedIds.slice(13));
  assert.ok(episode.expelledId && episode.expulsion);
  assert.ok(holdingCast);
  const eligibleIds = hiddenSecretHolders.length ? hiddenSecretHolders : holdingCast.map(({ id }) => id);
  assert.deepEqual([...episode.expulsion.eligibleIds].sort(), [...eligibleIds].sort());
  for (const candidateId of eligibleIds)
    assert.equal(
      episode.expulsion.incomingTotals[candidateId],
      holdingCast
        .filter(({ id }) => id !== candidateId)
        .reduce((total, person) => total + battleRelationship(person, candidateId), 0),
    );
  assert.equal(
    episode.expulsion.incomingTotals[episode.expelledId],
    Math.min(...eligibleIds.map((id) => episode.expulsion!.incomingTotals[id])),
  );
  assert.equal(episode.expulsion.result.cardId, episode.expulsion.cardId);
  assert.equal(
    state.runtime!.revealedSecrets.filter(
      (entry) => entry.contestantId === episode.expelledId && entry.cardId === episode.expulsion!.cardId,
    ).length,
    1,
  );
  assert.equal(state.contestants.find(({ id }) => id === episode.expelledId)!.rank, 13);
  assert.deepEqual(
    episode.survivorIds,
    episode.rankedIds.filter((id) => !episode.eliminatedIds.includes(id) && id !== episode.expelledId),
  );
  assert.equal(state.contestants.filter(({ status }) => status === 'ACTIVE').length, 12);
  const show = state.runtime!.show;
  assert.equal(
    show.general + Object.values(show.fans).reduce((total, fans) => total + fans, 0),
    show.audience,
  );
  for (const departed of [episode.expelledId, ...episode.eliminatedIds]) assert.equal(show.fans[departed], 0);
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
  assert.ok(episode.mvp);
  assert.equal(Object.keys(episode.mvp.ballots).length, 12);
  for (const [voter, choice] of Object.entries(episode.mvp.ballots)) {
    assert.ok(episode.survivorIds.includes(voter) && episode.survivorIds.includes(choice));
    assert.notEqual(voter, choice);
  }
  assert.equal(JSON.stringify(initial), before);
  assert.equal(records(state), oldRecords);
  assert.deepEqual(state.runtime!.initialContestants, initial.runtime!.initialContestants);
  for (const [index, number] of ([1, 2, 3, 4, 5, 6] as const).entries())
    assert.equal(createEpisodeRundown(state, number), oldCopies[index]);
  for (const change of episodeRelationshipUpdates(state, 7).changes) {
    assert.equal(
      change.before,
      battleRelationship(initial.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
    assert.equal(
      change.after,
      battleRelationship(state.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
  }
  const rundown = createEpisodeRundown(state, 7);
  for (const text of [
    'Sequence 1',
    'Sequence 8',
    'Announced fifteen-person ranking',
    'expelled',
    episode.expulsion.result.title,
    'Relationships Updates',
  ])
    assert.ok(rundown.includes(text));
  assert.doesNotMatch(rundown, /\bsimulation\b|\bTV score\b|\bXP\b|experience points/i);
  if (!episode.secret?.cardId) assert.doesNotMatch(rundown, /Recorded closing investigation/);
  assert.equal((createShowRundown(state).match(/^## Relationships Updates$/gm) ?? []).length, 7);
  const html = renderToStaticMarkup(
    <VersatilityEpisodeView
      onAction={() => assert.fail('Finale is read-only')}
      onInspect={() => {}}
      state={state}
    />,
  );
  assert.match(html, /Episode 7 final placements/);
  assert.match(html, /Twelve continue/);
  assert.match(html, /Expelled; announced rank/);
  assert.match(html, /Relationships Updates/);
  assert.equal(state.runtime!.episode, 7);
  const corrupt = normalized(state);
  corrupt.runtime.versatility.breakthroughs[0].gateDie = 7;
  assert.match(
    loadSimulationState({ getItem: () => JSON.stringify(corrupt) }).persistenceError ?? '',
    /Could not restore/,
  );
});

test('Versatility modal choices are revision bound, and store failures do not publish or repeat full-history awards', async () => {
  const initial = await completedTrackSpecials();
  const completed = await autoCompleteEpisode(initial, 7);
  const episode = completed.runtime!.versatility!;
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
  const actions: [VersatilityAction, number][] = [];
  let tree: ReactNode;
  for (const phase of ['intervention', 'secret-choice'] as const) {
    const view = structuredClone(completed);
    view.runtime!.versatility!.phase = phase;
    view.runtime!.versatility!.secretCandidates = episode.survivorIds.slice(0, 3);
    renderToStaticMarkup(
      <CaptureVersatility
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
        : { type: 'secret', contestantId: episode.survivorIds[0] },
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
          writes++;
          assert.equal(simulationStore.state, initial, 'Save before publishing');
          assert.equal(key, SIMULATION_STORAGE_KEY);
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
    assert.throws(() => simulationActions.dispatchVersatility({ type: 'start' }, 0), /Storage unavailable/);
    assert.equal(simulationStore.state, initial);
    assert.equal(saved, JSON.stringify(initial));
    rejectWrites = false;
    writes = 0;
    await simulationActions.autoCompleteEpisode(7, initial);
    const final = simulationStore.state;
    assert.equal(final.runtime!.versatility!.phase, 'complete');
    assert.equal(writes, 1);
    assert.ok(2 * (SIMULATION_STORAGE_KEY.length + saved.length) <= quota);
    assert.deepEqual(normalized(loadSimulationState({ getItem: () => saved })), normalized(final));
    await simulationActions.autoCompleteEpisode(7, final);
    assert.equal(writes, 1);
    assert.equal(simulationStore.state, final);
  } finally {
    simulationStore.setState(() => previousState);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
