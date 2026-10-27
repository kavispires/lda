import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Button, Modal } from 'antd';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpecialtiesEpisodeView } from '../components/SpecialtiesEpisodeView';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { Contestant } from '../types/contestant';
import type { SimulationState } from '../types/simulation';
import type { SpecialtiesAction, SpecialtiesEpisode } from '../types/specialties-episode';
import { createEpisodeRundown } from '../utilities/episode-rundown';
import { projectSeasonCast } from '../utilities/episode-visibility';
import { episodeRelationshipUpdates } from '../utilities/relationship-updates';
import { createShowRundown } from '../utilities/show-rundown';
import { battleRelationship } from './battle-scoring';
import { completedBattlesForBootcamp } from './bootcamp-fixtures';
import { autoCompleteEpisode } from './episode-auto-complete';
import { createSeededRandom } from './random';
import {
  decodeSimulationState,
  encodeSimulationState,
  SIMULATION_STORAGE_KEY,
} from './simulation-persistence';
import { transitionSpecialties } from './specialties-episode';

let baseline: Promise<SimulationState> | undefined;
let completed: SimulationState | undefined;
async function completedMusicVideos() {
  baseline ??= (async () => {
    let state = completedBattlesForBootcamp();
    for (const number of [3, 4, 5, 6, 7, 8, 9] as const) state = await autoCompleteEpisode(state, number);
    return state;
  })();
  return structuredClone(await baseline);
}
const normalized = (value: unknown) => JSON.parse(JSON.stringify(value));
const earlier = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
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
    state.runtime!.musicVideo,
  ]);

function nextAction(state: SimulationState): { action: SpecialtiesAction; revision: number } {
  const episode = state.runtime!.specialties;
  const preparation = state.runtime!.preparations?.[10];
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
    action: {
      type: 'opening-cast',
      contestantIds: preparation.shortlist.slice(0, preparation.requiredSelections),
    },
    revision: preparation.revision,
  };
}

function CaptureSpecialties({
  state,
  onAction,
  onCapture,
}: {
  state: SimulationState;
  onAction: (action: SpecialtiesAction, revision: number) => void;
  onCapture: (node: ReactNode) => void;
}) {
  onCapture(
    SpecialtiesEpisodeView({
      state,
      onAction,
      onInspect: () => {},
      actionError: 'Could not save the decision.',
    }),
  );
  return null;
}

test('Specialties restores every beat and preserves nine historical records and copied stories', async () => {
  const initial = await completedMusicVideos();
  delete initial.runtime!.definitions.specialtiesCatalog;
  const untouched = JSON.stringify(initial);
  const oldRecords = records(initial);
  const oldCopies = earlier.map((number) => createEpisodeRundown(initial, number));
  let state = transitionSpecialties(initial, { type: 'start' }, 0);
  assert.equal(state.runtime!.episode, 9);
  assert.equal(Boolean(state.runtime!.specialties), false);
  let restored = decodeSimulationState(encodeSimulationState(state));
  for (let index = 0; index < 2; index++) {
    const revision = state.runtime!.preparations![10]!.revision;
    state = transitionSpecialties(state, { type: 'randomize-mood' }, revision);
    restored = transitionSpecialties(restored, { type: 'randomize-mood' }, revision);
    assert.equal(transitionSpecialties(state, { type: 'randomize-mood' }, revision), state);
    restored = decodeSimulationState(encodeSimulationState(restored));
    assert.deepEqual(normalized(restored), normalized(state));
  }
  const extra = normalized(state);
  const audit = extra.runtime.preparations[10].randomAudit;
  const random = createSeededRandom(audit.endState);
  audit.steps.at(-1).draws.push(random.next());
  audit.endState = random.getState();
  extra.runtime.randomState = audit.endState;
  assert.throws(() => decodeSimulationState(JSON.stringify(extra)), /preparation|random/i);
  const corrupt = normalized(state);
  corrupt.runtime.preparations[10].randomAudit.initialDraws[0] = 0.123456789;
  assert.throws(() => decodeSimulationState(JSON.stringify(corrupt)), /preparation|random/i);
  const forged = normalized(state);
  forged.runtime.preparations[10].randomAudit.steps[0].action = { type: 'opening-cast', contestantIds: [] };
  assert.throws(() => decodeSimulationState(JSON.stringify(forged)), /opening|preparation/i);
  const preparation = state.runtime!.preparations![10]!;
  const previousIds = initial.runtime!.musicVideo!.survivorIds;
  const first = initial.contestants.find(({ id }) => id === previousIds[0])!;
  const last = initial.contestants.find(({ id }) => id === previousIds.at(-1))!;
  for (const field of Object.keys(preparation.moodOptions) as (keyof typeof preparation.moodOptions)[]) {
    assert.ok(preparation.moodOptions[field].includes(first.specialties[field]));
    if (first.specialties[field] !== last.specialties[field])
      assert.ok(preparation.moodOptions[field].includes(last.specialties[field]));
  }
  for (const id of initial.runtime!.openingCast!.filter((id) => previousIds.includes(id)))
    assert.ok(preparation.slots.includes(id));
  let openingCount = 0;
  let sawSealedRanking = false;
  const sequences = new Set<number>();
  for (let step = 0; step < 150 && state.runtime!.specialties?.phase !== 'complete'; step++) {
    const { action, revision } = nextAction(state);
    const prior = state;
    state = transitionSpecialties(state, action, revision);
    restored = transitionSpecialties(restored, action, revision);
    assert.equal(transitionSpecialties(state, action, revision), state);
    restored = decodeSimulationState(encodeSimulationState(restored));
    assert.deepEqual(normalized(restored), normalized(state));
    assert.equal(records(state), oldRecords);
    const episode: SpecialtiesEpisode | null | undefined = state.runtime!.specialties;
    if (!episode) continue;
    assert.deepEqual(episode.participantIds, previousIds);
    const scene = episode.scenes.at(-1);
    if (scene?.sequence) sequences.add(scene.sequence);
    if (!episode.secret)
      for (const id of episode.participantIds) {
        const current = state.contestants.find((entry) => entry.id === id)!;
        const previous = initial.contestants.find((entry) => entry.id === id)!;
        assert.deepEqual(current.coreSkills, previous.coreSkills);
        assert.deepEqual(current.utilitySkills, previous.utilitySkills);
        assert.deepEqual(current.specialties, previous.specialties);
        assert.equal(current.aggregations.practice, previous.aggregations.practice);
        assert.equal(current.condition, previous.condition);
      }
    if (scene?.sequence && scene.sequence < 3) {
      assert.equal(episode.performances.length, 0);
      assert.equal(episode.panel.length, 0);
      assert.equal(episode.rankedIds.length, 0);
    }
    if (scene?.presentation === 'credits') {
      openingCount++;
      for (const id of episode.openingCast)
        assert.equal(
          state.contestants.find((entry) => entry.id === id)!.aggregations.audienceRatio,
          Math.min(1, prior.contestants.find((entry) => entry.id === id)!.aggregations.audienceRatio + 0.02),
        );
    }
    if (episode.audience && !episode.rankRevealed) {
      sawSealedRanking = true;
      for (const person of projectSeasonCast(state.contestants, state.runtime!)) {
        const previous = initial.contestants.find(({ id }) => id === person.id)!;
        assert.equal(person.rank, previous.rank);
        assert.equal(person.aggregations.rankingScore, previous.aggregations.rankingScore);
      }
    }
    if (episode.mvp) {
      assert.equal(episode.survivorIds.length, 8);
      assert.ok(episode.eliminatedId);
      assert.equal(Object.keys(episode.mvp.ballots).length, 8);
      for (const [voter, choice] of Object.entries(episode.mvp.ballots)) {
        assert.ok(episode.survivorIds.includes(voter) && episode.survivorIds.includes(choice));
        assert.notEqual(voter, choice);
      }
    }
    if (episode.phase === 'secret-choice')
      assert.ok(episode.secretCandidates.every((id) => episode.survivorIds.includes(id)));
    if (scene?.kind === 'ranking') {
      const reactions = scene.paragraphs.filter((paragraph) => !/^\d+[.)]\s/.test(paragraph));
      assert.ok(reactions.length >= 3);
      const html = renderToStaticMarkup(
        <SpecialtiesEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
      );
      for (const reaction of reactions) {
        const speaker = state.contestants.find((entry) => reaction.startsWith(`${entry.name} `))!;
        assert.ok(html.includes(reaction.slice(speaker.name.length)));
      }
    }
    if (scene?.presentation === 'performance') {
      const html = renderToStaticMarkup(
        <SpecialtiesEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
      );
      for (const name of ['John Stan', 'Megan Ryder', 'Michael Lion']) assert.ok(html.includes(name));
    }
  }
  const episode = state.runtime!.specialties!;
  assert.equal(episode.phase, 'complete');
  assert.deepEqual([...sequences].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(openingCount, 1);
  assert.ok(sawSealedRanking);
  assert.equal(episode.performances.length, 9);
  assert.equal(episode.panel.length, 9);
  assert.equal(episode.rehearsals.length, 18);
  const close = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  const observed = new Map<string, number>();
  for (const performance of episode.performances) {
    const person = episode.startingContestants.find(({ id }) => id === performance.contestantId)!;
    const rehearsals = episode.rehearsals.filter((entry) => entry.contestantId === person.id);
    assert.deepEqual(
      rehearsals.map((entry) => entry.session),
      [1, 2],
    );
    let practice = 0;
    for (const rehearsal of rehearsals) {
      const sums = rehearsal.checks.map((check) => {
        const floor = Math.max(1, Math.min(5, 2 * check.skillLevel - 3));
        return rehearsal.rawDice.reduce((sum, die) => sum + Math.max(die, floor), 0);
      });
      const weighted = (2 * sums[0] + sums[1] + sums[2]) / 4;
      close(rehearsal.weightedSum, weighted);
      practice = Math.max(practice, Math.min(5, Math.floor(weighted / 2)));
      assert.equal(rehearsal.practiceAfter, practice);
    }
    for (const check of Object.values(performance.checks)) {
      const floor = Math.max(1, Math.min(5, 2 * check.skillLevel - 3));
      close(check.score, 10 * (performance.rawDice.reduce((sum, die) => sum + Math.max(die, floor), 0) - 2));
    }
    close(performance.matchedTrack, clamp(performance.checks.track.score + 10));
    close(performance.matchedVisual, clamp(performance.checks.visual.score + 10));
    close(
      performance.technical,
      clamp(performance.matchedTrack + 2 * practice + performance.readinessModifier),
    );
    close(
      performance.observedScore,
      (3 * performance.technical + performance.john + performance.megan + performance.michael) / 6,
    );
    observed.set(person.id, performance.observedScore);
  }
  assert.ok(episode.friendship);
  assert.equal(episode.friendship.choices.length, 9);
  for (const choice of episode.friendship.choices) {
    const voter: Contestant = episode.friendship.snapshot.find(({ id }) => id === choice.contestantId)!;
    assert.notEqual(choice.contestantId, choice.targetId);
    assert.equal(
      choice.affection,
      Math.max(
        ...episode.participantIds.filter((id) => id !== voter.id).map((id) => battleRelationship(voter, id)),
      ),
    );
  }
  const matched = episode.friendship.pairs.flat();
  assert.equal(new Set(matched).size, matched.length);
  assert.equal(episode.friendship.rewards.length, matched.length);
  for (const reward of episode.friendship.rewards) {
    assert.ok(matched.includes(reward.contestantId));
    assert.equal(reward.happinessAfter, clamp(reward.happinessBefore + 20));
    close(reward.audienceAfter, Math.min(1, reward.audienceBefore + 0.1));
    close(reward.fanbaseAfter, Math.min(1, reward.fanbaseBefore + 0.1));
  }
  assert.ok(episode.peer);
  assert.equal(episode.peer.ballots.length, 9);
  let positions = 0;
  for (const ballot of episode.peer.ballots) {
    assert.equal(ballot.rankedIds.length, 8);
    assert.equal(new Set(ballot.rankedIds).size, 8);
    assert.ok(!ballot.rankedIds.includes(ballot.voterId));
    const voter: Contestant = episode.peer.snapshot.find(({ id }) => id === ballot.voterId)!;
    const objective = voter.personality.sincerity >= 5 || voter.personality.maturity >= 5;
    const strategic = !objective && voter.personality.ambition >= 5 && voter.personality.sincerity <= -5;
    assert.equal(ballot.profile, objective ? 'objective' : strategic ? 'strategic' : 'blended');
    if (strategic) {
      const honest = ballot.rankedIds.slice(0, 6);
      const last = observed.get(ballot.rankedIds[7])!;
      const secondLast = observed.get(ballot.rankedIds[6])!;
      assert.ok(last >= secondLast);
      assert.ok(honest.every((id) => observed.get(id)! <= secondLast));
      for (let index = 1; index < honest.length; index++)
        assert.ok(observed.get(honest[index - 1])! >= observed.get(honest[index])!);
    } else {
      const preferences = ballot.rankedIds.map((id) =>
        objective ? observed.get(id)! : (observed.get(id)! + battleRelationship(voter, id)) / 2,
      );
      assert.ok(preferences.every((value, index) => index === 0 || value <= preferences[index - 1]));
    }
    positions += ballot.rankedIds.reduce((sum, _, index) => sum + index + 1, 0);
  }
  assert.equal(positions, 324);
  close(
    Object.values(episode.peer.averages).reduce((sum, value) => sum + value, 0),
    450,
  );
  for (const entry of episode.panel) {
    const received = episode.peer.ballots
      .filter((ballot) => ballot.voterId !== entry.contestantId)
      .map((ballot) => (100 * (7 - ballot.rankedIds.indexOf(entry.contestantId))) / 7);
    const expectedPeer = received.reduce((sum, value) => sum + value, 0) / 8;
    close(entry.peer, expectedPeer);
    close(
      entry.finalScore,
      (3 * entry.performance + entry.john + entry.megan + entry.michael + 2 * expectedPeer) / 8,
    );
    close(entry.finalScore, 0.75 * observed.get(entry.contestantId)! + 0.25 * expectedPeer);
  }
  assert.equal(episode.eliminatedId, episode.rankedIds[8]);
  assert.deepEqual(episode.survivorIds, episode.rankedIds.slice(0, 8));
  assert.equal(state.contestants.filter(({ status }) => status === 'ACTIVE').length, 8);
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
    if (prior.status !== 'ACTIVE') {
      assert.equal(current.rank, prior.rank);
      assert.equal(current.status, prior.status);
      assert.equal(current.aggregations.rankingScore, prior.aggregations.rankingScore);
    }
  }
  const show = state.runtime!.show;
  assert.equal(show.general + Object.values(show.fans).reduce((sum, fans) => sum + fans, 0), show.audience);
  assert.equal(show.fans[episode.eliminatedId!], 0);
  assert.equal(JSON.stringify(initial), untouched);
  for (const [index, number] of earlier.entries())
    assert.equal(createEpisodeRundown(state, number), oldCopies[index]);
  for (const change of episodeRelationshipUpdates(state, 10).changes) {
    assert.equal(
      change.before,
      battleRelationship(initial.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
    assert.equal(
      change.after,
      battleRelationship(state.contestants.find(({ id }) => id === change.fromId)!, change.toId),
    );
  }
  const rundown = createEpisodeRundown(state, 10);
  for (const text of [
    'Sequence 1',
    'Sequence 8',
    'Specialties',
    'Eight continue',
    'Viewer-only',
    'Relationships Updates',
  ])
    assert.ok(rundown.includes(text));
  assert.doesNotMatch(
    rundown,
    /\bsimulation\b|\bTV score\b|\bXP\b|experience points|randomAudit|randomStartState/i,
  );
  if (!episode.secret?.cardId) assert.doesNotMatch(rundown, /Recorded investigation/);
  assert.equal((createShowRundown(state).match(/^## Relationships Updates$/gm) ?? []).length, 10);
  const html = renderToStaticMarkup(
    <SpecialtiesEpisodeView onAction={() => assert.fail('Read-only')} onInspect={() => {}} state={state} />,
  );
  assert.match(html, /Episode 10 standings/);
  assert.match(html, /Eight reach/);
  assert.match(html, /Relationships Updates/);
  assert.equal(state.runtime!.episode, 10);
  assert.equal(await autoCompleteEpisode(state, 10), state);
  completed = state;
});

test('Specialties decisions block, failed writes preserve state and complete history fits quota', async () => {
  const initial = await completedMusicVideos();
  const final = completed ?? (await autoCompleteEpisode(initial, 10));
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
  const actions: [SpecialtiesAction, number][] = [];
  const view = structuredClone(final);
  view.runtime!.specialties!.phase = 'secret-choice';
  view.runtime!.specialties!.secretCandidates = view.runtime!.specialties!.survivorIds.slice(0, 3);
  let tree: ReactNode;
  renderToStaticMarkup(
    <CaptureSpecialties
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
    { type: 'secret', contestantId: view.runtime!.specialties!.secretCandidates[0] },
    view.runtime!.specialties!.revision,
  ]);
  const previous = simulationStore.state;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let saved = JSON.stringify(initial);
  let writes = 0;
  let rejectWrites = true;
  const quota = 5 * 1024 * 1024;
  const otherStorageBytes = 2 * 1024 * 1024;
  const storageBytes = (value: string) => 2 * (SIMULATION_STORAGE_KEY.length + value.length);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => saved,
        setItem(key: string, value: string) {
          assert.equal(key, SIMULATION_STORAGE_KEY);
          if (rejectWrites) throw new Error('Storage unavailable');
          if (storageBytes(value) + otherStorageBytes > quota)
            throw new DOMException(
              'Simulation save exceeded the shared storage quota.',
              'QuotaExceededError',
            );
          saved = value;
          writes++;
        },
      },
    },
  });
  try {
    simulationStore.setState(() => initial);
    assert.throws(() => simulationActions.dispatchSpecialties({ type: 'start' }, 0), /Storage unavailable/);
    await assert.rejects(simulationActions.autoCompleteEpisode(10, initial), /Storage unavailable/);
    assert.equal(simulationStore.state, initial);
    assert.equal(writes, 0);
    rejectWrites = false;
    simulationActions.dispatchSpecialties({ type: 'start' }, 0);
    const prepared = simulationStore.state;
    assert.throws(
      () => simulationActions.dispatchSpecialties({ type: 'randomize-mood' }, 99),
      /revision|stale/i,
    );
    assert.equal(simulationStore.state, prepared);
    await simulationActions.autoCompleteEpisode(10, prepared);
    assert.equal(simulationStore.state.runtime!.specialties!.phase, 'complete');
    assert.equal(simulationStore.state.runtime!.episode, 10);
    assert.ok(storageBytes(saved) + otherStorageBytes < quota);
    assert.deepEqual(normalized(decodeSimulationState(saved)), normalized(simulationStore.state));
    const current = simulationStore.state;
    const previousWrites = writes;
    await simulationActions.autoCompleteEpisode(10, current);
    assert.equal(simulationStore.state, current);
    assert.equal(writes, previousWrites);
  } finally {
    simulationStore.setState(() => previous);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
