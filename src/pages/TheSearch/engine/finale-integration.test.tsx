import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Button, Modal } from 'antd';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AutoCompleteEpisodeButton } from '../components/AutoCompleteEpisodeButton';
import { FinaleEpisodeView } from '../components/FinaleEpisodeView';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { Contestant } from '../types/contestant';
import type { FinaleAction, FinaleEpisode } from '../types/finale-episode';
import type { SimulationState } from '../types/simulation';
import { createEpisodeRundown } from '../utilities/episode-rundown';
import { projectSeasonCast } from '../utilities/episode-visibility';
import { episodeRelationshipUpdates } from '../utilities/relationship-updates';
import { createShowRundown } from '../utilities/show-rundown';
import { battleRelationship } from './battle-scoring';
import { completedBattlesForBootcamp } from './bootcamp-fixtures';
import { autoCompleteEpisode } from './episode-auto-complete';
import { transitionFinale } from './finale-episode';
import { createSeededRandom } from './random';
import {
  decodeSimulationState,
  encodeSimulationState,
  SIMULATION_STORAGE_KEY,
} from './simulation-persistence';

let baseline: Promise<SimulationState> | undefined;
async function completedSpecialties() {
  baseline ??= (async () => {
    let state = completedBattlesForBootcamp();
    for (const number of [3, 4, 5, 6, 7, 8, 9, 10] as const) state = await autoCompleteEpisode(state, number);
    return state;
  })();
  return structuredClone(await baseline);
}
const normalized = (value: unknown) => JSON.parse(JSON.stringify(value));
const earlier = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const oldRecords = (state: SimulationState) =>
  JSON.stringify([
    state.runtime!.audition,
    state.runtime!.battle,
    state.runtime!.bootcamp,
    state.runtime!.megaGroups,
    state.runtime!.photoshoot,
    state.runtime!.trackSpecials,
    state.runtime!.versatility,
    state.runtime!.varietyShow,
    state.runtime!.musicVideo,
    state.runtime!.specialties,
  ]);
function nextAction(state: SimulationState): { action: FinaleAction; revision: number } {
  const episode = state.runtime!.finale;
  const preparation = state.runtime!.preparations?.[11];
  if (episode)
    return {
      action:
        episode.phase === 'executive-choice'
          ? { type: 'executive', contestantIds: episode.participantIds.slice(0, 3) }
          : { type: 'advance' },
      revision: episode.revision,
    };
  if (!preparation) return { action: { type: 'start' }, revision: 0 };
  if (!preparation.mood)
    return {
      action: {
        type: 'mood',
        choices: preparation.randomizedMood ?? {
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
    action: {
      type: 'opening-cast',
      contestantIds: preparation.shortlist.slice(0, preparation.requiredSelections),
    },
    revision: preparation.revision,
  };
}
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const clamp = (value: number) => Math.max(0, Math.min(100, value));

function CaptureFinale({ state, capture }: { state: SimulationState; capture: (tree: ReactNode) => void }) {
  capture(
    FinaleEpisodeView({
      state,
      onInspect: () => {},
      onAction: () => assert.fail('Read-only'),
      actionError: 'Could not save the decision.',
    }),
  );
  return null;
}

test('Finale reloads every beat and winner without changing ten archives, private choices or the final arithmetic', async () => {
  const initial = await completedSpecialties();
  delete initial.runtime!.definitions.finaleCatalog;
  const untouched = JSON.stringify(initial);
  const records = oldRecords(initial);
  const copies = earlier.map((number) => createEpisodeRundown(initial, number));
  let state = transitionFinale(initial, { type: 'start' }, 0);
  assert.equal(state.runtime!.episode, 10);
  assert.equal(Boolean(state.runtime!.finale), false);
  for (let index = 0; index < 2; index++) {
    const revision = state.runtime!.preparations![11]!.revision;
    state = transitionFinale(state, { type: 'randomize-mood' }, revision);
    state = decodeSimulationState(encodeSimulationState(state));
  }
  const corrupted = normalized(state);
  const audit = corrupted.runtime.preparations[11].randomAudit;
  const random = createSeededRandom(audit.endState);
  audit.steps.at(-1).draws.push(random.next());
  audit.endState = random.getState();
  corrupted.runtime.randomState = audit.endState;
  assert.throws(() => decodeSimulationState(JSON.stringify(corrupted)), /preparation|random/i);
  const previousIds = initial.runtime!.specialties!.survivorIds;
  const preparation = state.runtime!.preparations![11]!;
  for (const id of initial.runtime!.openingCast!.filter((id) => previousIds.includes(id)))
    assert.ok(preparation.slots.includes(id));
  const highest = initial.contestants.find(({ id }) => id === previousIds[0])!;
  const lowest = initial.contestants.find(({ id }) => id === previousIds.at(-1))!;
  for (const field of Object.keys(preparation.moodOptions) as (keyof typeof preparation.moodOptions)[]) {
    assert.ok(preparation.moodOptions[field].includes(highest.specialties[field]));
    if (highest.specialties[field] !== lowest.specialties[field])
      assert.ok(preparation.moodOptions[field].includes(lowest.specialties[field]));
  }
  const ready = state;
  let openingCount = 0;
  let revealCount = 0;
  let sawGate = false;
  const sequences = new Set<number>();
  for (let step = 0; step < 160 && state.runtime!.finale?.phase !== 'complete'; step++) {
    const { action, revision } = nextAction(state);
    const previous = state;
    state = transitionFinale(state, action, revision);
    assert.equal(transitionFinale(state, action, revision), state);
    assert.deepEqual(normalized(decodeSimulationState(encodeSimulationState(state))), normalized(state));
    assert.equal(oldRecords(state), records);
    const episode: FinaleEpisode | null | undefined = state.runtime!.finale;
    if (!episode) continue;
    assert.deepEqual(episode.participantIds, previousIds);
    const scene = episode.scenes.at(-1);
    if (scene?.sequence) sequences.add(scene.sequence);
    if (scene?.presentation === 'credits') {
      openingCount++;
      for (const id of episode.openingCast)
        close(
          state.contestants.find((entry) => entry.id === id)!.aggregations.audienceRatio,
          Math.min(
            1,
            previous.contestants.find((entry) => entry.id === id)!.aggregations.audienceRatio + 0.02,
          ),
        );
    }
    if (episode.phase === 'executive-choice') {
      sawGate = true;
      assert.equal(episode.originalPerformances.length, 0);
      assert.equal(episode.themePerformances.length, 0);
      assert.equal(episode.executive, null);
      assert.equal(await autoCompleteEpisode(state, 11), state);
      assert.throws(
        () => transitionFinale(state, { type: 'advance' }, episode.revision),
        /executive|three|decision/i,
      );
    }
    if (episode.revealedWinnerIds.length > revealCount) {
      assert.equal(episode.revealedWinnerIds.length, revealCount + 1);
      const id = episode.revealedWinnerIds.at(-1)!;
      assert.equal(episode.winnerIds.indexOf(id), 4 - revealCount);
      revealCount++;
    }
    const projected = projectSeasonCast(state.contestants, state.runtime!);
    for (const person of projected) {
      const prior = initial.contestants.find(({ id }) => id === person.id)!;
      close(person.aggregations.productionRatio, prior.aggregations.productionRatio);
      if (!episode.resultsPublished) {
        assert.equal(person.rank, prior.rank);
        close(person.aggregations.rankingScore, prior.aggregations.rankingScore);
        assert.equal(person.aggregations.center, prior.aggregations.center);
        assert.ok(!person.changeLog.some((entry) => entry.episode === 11));
        if (!episode.revealedWinnerIds.includes(person.id)) assert.equal(person.status, prior.status);
      }
    }
    const html = renderToStaticMarkup(
      <FinaleEpisodeView onAction={() => assert.fail('Read-only')} onInspect={() => {}} state={state} />,
    );
    if (!episode.resultsPublished) {
      assert.doesNotMatch(html, /Viewer-only final scores|Internal position|Official Center/);
      for (const id of episode.winnerIds.filter((id) => !episode.revealedWinnerIds.includes(id))) {
        const name = state.contestants.find((entry) => entry.id === id)!.name;
        const lineup =
          html.match(/<ol aria-label="Announced Squirrel Zone members"[\s\S]*?<\/ol>/)?.[0] ?? '';
        assert.ok(!lineup.includes(`>${name}</`));
      }
    }
    if (action.type === 'executive') {
      assert.equal(episode.scenes.length, previous.runtime!.finale!.scenes.length);
      assert.equal(episode.scenes.at(-1)?.id, previous.runtime!.finale!.scenes.at(-1)?.id);
    }
  }
  const episode = state.runtime!.finale!;
  assert.equal(episode.phase, 'complete');
  assert.deepEqual([...sequences].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(openingCount, 1);
  assert.equal(revealCount, 5);
  assert.ok(sawGate);
  assert.equal(episode.rehearsals.length, 16);
  assert.equal(episode.originalPerformances.length, 8);
  assert.equal(episode.themePerformances.length, 8);
  assert.equal(episode.personnel.length, 7);
  assert.equal(episode.startingGuestId, initial.runtime!.versatility!.guestId);
  const actScores = new Map<string, { original: number; theme: number }>();
  for (const rehearsal of episode.rehearsals) {
    const person = episode.startingContestants.find(({ id }) => id === rehearsal.contestantId)!;
    let sum = 0;
    const fields =
      rehearsal.session === 1
        ? (['learning', 'memory', 'consistency'] as const)
        : (['stamina', 'consistency', 'memory'] as const);
    for (const [index, field] of fields.entries()) {
      const floor = Math.max(1, Math.min(5, 2 * person.utilitySkills[field] - 3));
      sum +=
        (index === 0 ? 2 : 1) *
        (Math.max(rehearsal.rawDice[0], floor) + Math.max(rehearsal.rawDice[1], floor));
    }
    close(rehearsal.weightedSum, sum / 4);
    close(rehearsal.readinessAfter, Math.max(rehearsal.readinessBefore, Math.min(5, Math.floor(sum / 8))));
  }
  for (const [label, performances, difficulty] of [
    ['original', episode.originalPerformances, 4],
    ['theme', episode.themePerformances, 3],
  ] as const)
    for (const performance of performances) {
      const person: Contestant = episode.startingContestants.find(
        ({ id }) => id === performance.contestantId,
      )!;
      const check: Record<string, number> = {};
      for (const [key, entry] of Object.entries(performance.checks)) {
        const floor = Math.max(1, Math.min(5, 2 * entry.skillLevel - difficulty));
        check[key] =
          10 * (Math.max(performance.rawDice[0], floor) + Math.max(performance.rawDice[1], floor) - 2);
        close(entry.score, check[key]);
      }
      const breakdown =
        label === 'original' &&
        performance.rawDice[0] + performance.rawDice[1] <= 4 &&
        ((person.utilitySkills.stamina < 3 && check.stamina < 40) ||
          (person.utilitySkills.consistency < 3 && check.consistency < 40));
      const base =
        label === 'original'
          ? 0.3 * check.track + 0.2 * check.stagePresence + 0.25 * check.stamina + 0.25 * check.consistency
          : 0.5 * check.dance + 0.2 * check.stagePresence + 0.15 * check.stamina + 0.15 * check.consistency;
      const score = clamp(base + 2 * performance.readiness - (breakdown ? 20 : 0));
      close(performance.technical, score);
      const record = actScores.get(person.id) ?? { original: 0, theme: 0 };
      record[label] = score;
      actScores.set(person.id, record);
    }
  const maximumVotes = Math.max(...Object.values(episode.audience!.votes));
  for (const panel of episode.panel) {
    const acts = actScores.get(panel.contestantId)!;
    close(panel.performance, (acts.original + acts.theme) / 2);
    for (const value of Object.values(panel.judges)) close(value.score, (value.original + value.theme) / 2);
    close(panel.judgeMean, Object.values(panel.judges).reduce((sum, value) => sum + value.score, 0) / 7);
    close(panel.finalScore, (panel.performance + panel.judgeMean) / 2);
    const prior = initial.contestants.find(({ id }) => id === panel.contestantId)!;
    const person = state.contestants.find(({ id }) => id === panel.contestantId)!;
    const total =
      prior.aggregations.rankingScore +
      0.6 * panel.finalScore +
      0.3 * (maximumVotes ? (100 * episode.audience!.votes[person.id]) / maximumVotes : 0) +
      0.1 * (50 * (person.aggregations.productionRatio + 1)) +
      (episode.executive!.contestantIds.includes(person.id) ? 50 : 0);
    close(person.aggregations.rankingScore, total);
  }
  assert.equal(state.runtime!.phase, 'season-complete');
  assert.equal(state.runtime!.episode, 11);
  assert.equal(state.status, 'ready');
  assert.equal(state.contestants.filter(({ status }) => status === 'ACTIVE').length, 0);
  assert.equal(state.contestants.filter(({ status }) => status === 'WINNER').length, 5);
  assert.equal(state.contestants.filter(({ status }) => status === 'ELIMINATED').length, 45);
  assert.deepEqual(
    state.contestants.map(({ rank }) => rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
  );
  assert.equal(episode.centerId, episode.rankedIds[0]);
  assert.ok(!('mvp' in episode) && !('secret' in episode));
  assert.deepEqual(state.runtime!.revealedSecrets, initial.runtime!.revealedSecrets);
  assert.deepEqual(state.runtime!.deferredConsequences, initial.runtime!.deferredConsequences);
  for (const prior of initial.contestants) {
    const person = state.contestants.find(({ id }) => id === prior.id)!;
    assert.equal(
      person.aggregations.experience,
      prior.aggregations.experience + (previousIds.includes(person.id) ? 8 : 0),
    );
    assert.equal(person.aggregations.mvp, prior.aggregations.mvp);
    assert.equal(
      person.aggregations.center,
      prior.aggregations.center + (episode.centerId === person.id ? 1 : 0),
    );
    assert.deepEqual(person.coreSkills, prior.coreSkills);
    assert.deepEqual(person.utilitySkills, prior.utilitySkills);
    assert.equal(person.aggregations.practice, prior.aggregations.practice);
    if (!previousIds.includes(person.id)) {
      assert.equal(person.rank, prior.rank);
      assert.equal(person.status, prior.status);
      close(person.aggregations.rankingScore, prior.aggregations.rankingScore);
    }
  }
  const show = state.runtime!.show;
  assert.equal(show.general + Object.values(show.fans).reduce((sum, value) => sum + value, 0), show.audience);
  for (const id of episode.rankedIds.slice(5)) assert.equal(show.fans[id], 0);
  assert.equal(episode.postSeason!.retainedGroupFans, Math.floor((show.audience * show.satisfaction) / 100));
  assert.equal(episode.postSeason!.nonRetainedViewers, show.audience - episode.postSeason!.retainedGroupFans);
  assert.equal(episode.fanTransfers.length, 1);
  for (const [index, number] of earlier.entries())
    assert.equal(createEpisodeRundown(state, number), copies[index]);
  for (const change of episodeRelationshipUpdates(state, 11).changes) {
    assert.equal(
      change.before,
      battleRelationship(initial.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
    assert.equal(
      change.after,
      battleRelationship(state.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
  }
  const rundown = createEpisodeRundown(state, 11);
  assert.match(rundown, /Sequence 1/);
  assert.match(rundown, /Sequence 8/);
  assert.match(rundown, /Private label reference — not broadcast/);
  assert.match(rundown, /Viewer-only post-season outcome/);
  assert.doesNotMatch(rundown, /\bsimulation\b|\bXP\b|\bTV score\b|randomAudit|randomStartState/i);
  const broadcast = rundown.split('## Private label reference')[0];
  assert.doesNotMatch(
    broadcast.split('## Chronological broadcast')[1],
    /\bexecutive (?:selection|choice|boost|bonus)\b|secret production|productionRatio|ranking bonus|Internal position|^\s*[678]\.\s/im,
  );
  assert.equal((createShowRundown(state).match(/^## Relationships Updates$/gm) ?? []).length, 11);
  const gate = await autoCompleteEpisode(ready, 11);
  assert.equal(gate.runtime!.finale!.phase, 'executive-choice');
  const selected = transitionFinale(
    gate,
    { type: 'executive', contestantIds: gate.runtime!.finale!.participantIds.slice(0, 3) },
    gate.runtime!.finale!.revision,
  );
  assert.deepEqual(normalized(await autoCompleteEpisode(selected, 11)), normalized(state));
  assert.equal(await autoCompleteEpisode(state, 11), state);
  assert.equal(JSON.stringify(initial), untouched);
});

test('Finale executive modal is blocking and failed writes preserve its gate, RNG and manual choice', async () => {
  const initial = await completedSpecialties();
  const gate = await autoCompleteEpisode(initial, 11);
  const episode = gate.runtime!.finale!;
  assert.equal(episode.phase, 'executive-choice');
  type Props = {
    children?: ReactNode;
    open?: boolean;
    closable?: boolean;
    keyboard?: boolean;
    mask?: { closable?: boolean };
    disabled?: boolean;
    onClick?: () => void;
  };
  const elements = (node: ReactNode): ReactElement<Props>[] =>
    Children.toArray(node).flatMap((child) =>
      isValidElement<Props>(child) ? [child, ...elements(child.props.children)] : [],
    );
  let tree: ReactNode;
  renderToStaticMarkup(
    <CaptureFinale
      capture={(value) => {
        tree = value;
      }}
      state={gate}
    />,
  );
  const modal = elements(tree).find((element) => element.type === Modal);
  assert.ok(modal);
  assert.equal(modal.props.open, true);
  assert.equal(modal.props.closable, false);
  assert.equal(modal.props.keyboard, false);
  assert.equal(modal.props.mask?.closable, false);
  const confirm = elements(modal.props.children).find(
    (element) => element.type === Button && element.props.children === 'Confirm three executive selections',
  );
  assert.equal(confirm?.props.disabled, true);
  assert.equal(renderToStaticMarkup(<AutoCompleteEpisodeButton episode={11} state={gate} />), '');
  const previous = simulationStore.state;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let saved = '';
  let failWrites = true;
  let writes = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => saved,
        setItem(key: string, value: string) {
          assert.equal(key, SIMULATION_STORAGE_KEY);
          if (failWrites) throw new Error('Storage unavailable');
          if (value.length * 2 > 10 * 1024 * 1024) throw new Error('QuotaExceededError');
          saved = value;
          writes++;
        },
      },
    },
  });
  try {
    simulationStore.setState(() => initial);
    await assert.rejects(simulationActions.autoCompleteEpisode(11, initial), /Storage unavailable/);
    assert.equal(simulationStore.state, initial);
    failWrites = false;
    await simulationActions.autoCompleteEpisode(11, initial);
    assert.equal(simulationStore.state.runtime!.finale!.phase, 'executive-choice');
    assert.deepEqual(normalized(decodeSimulationState(saved)), normalized(simulationStore.state));
    const paused = simulationStore.state;
    failWrites = true;
    const ids = paused.runtime!.finale!.participantIds.slice(0, 3);
    assert.throws(
      () =>
        simulationActions.dispatchFinale(
          { type: 'executive', contestantIds: ids },
          paused.runtime!.finale!.revision,
        ),
      /Storage unavailable/,
    );
    assert.equal(simulationStore.state, paused);
    assert.equal(simulationStore.state.runtime!.finale!.executive, null);
    failWrites = false;
    simulationActions.dispatchFinale(
      { type: 'executive', contestantIds: ids },
      paused.runtime!.finale!.revision,
    );
    const chosen = simulationStore.state;
    assert.throws(
      () => simulationActions.dispatchFinale({ type: 'executive', contestantIds: ids }, 999),
      /revision|stale/i,
    );
    assert.equal(simulationStore.state, chosen);
    await simulationActions.autoCompleteEpisode(11, chosen);
    assert.equal(simulationStore.state.runtime!.phase, 'season-complete');
    assert.ok(saved.length * 2 < 10 * 1024 * 1024);
    assert.deepEqual(normalized(decodeSimulationState(saved)), normalized(simulationStore.state));
    const finished = simulationStore.state;
    const finalWrites = writes;
    await simulationActions.autoCompleteEpisode(11, finished);
    assert.equal(simulationStore.state, finished);
    assert.equal(writes, finalWrites);
  } finally {
    simulationStore.setState(() => previous);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
