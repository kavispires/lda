import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NarrativeBattlePlayer } from '../components/NarrativeBattlePlayer';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { SimulationState } from '../types/simulation';
import { battleRelationship } from './battle-scoring';
import { transitionNarrativeBattle } from './narrative-audition';
import {
  applyBattleRankReactions,
  applyNarrativeBattleBacklash,
  transitionBattleStory,
} from './narrative-battle';
import {
  advanceBattleStoryTo,
  narrativeBattleFixture,
  nextBattleStoryAction,
} from './narrative-battle-fixtures';
import { decodeSimulationState } from './simulation-persistence';

const initial = narrativeBattleFixture();

test('each battle draft pick lists the current team in order with linked contestant references', () => {
  let state = advanceBattleStoryTo(initial, 'captains');
  for (let pick = 0; pick < 24; pick++) {
    state = transitionBattleStory(state, { type: 'advance' }, state.runtime!.battle!.revision);
    const ep = state.runtime!.battle!;
    const scene = ep.scenes.at(-1)!;
    const team = ep.teams[pick % 6];
    assert.equal(
      scene.paragraphs[1],
      `Now the team consists of ${team.memberIds.map((id) => state.contestants.find((person) => person.id === id)!.name).join(', ')}.`,
    );
    assert.deepEqual(scene.paragraphContestantIds?.[1], team.memberIds);
    assert.deepEqual(scene.contestantIds, team.memberIds);
    assert.ok(scene.paragraphs.length <= 4, 'only two tension highlights accompany each pick');
  }
});

test('draft reactions distinguish one-sided and mutual dislike without inventing neutral tension or changing bonds', () => {
  for (const [captainAffection, newcomerAffection, expected] of [
    [51, 39, 'one-sided'],
    [49, 39, 'mutual'],
    [51, 50, 'neutral'],
  ] as const) {
    const state = advanceBattleStoryTo(initial, 'captains');
    const ep = state.runtime!.battle!;
    const captain = state.contestants.find((person) => person.id === ep.teams[0].captainId)!;
    const captains = new Set(ep.teams.map((team) => team.captainId));
    const newcomer = state.contestants.find(
      (person) => ep.participantIds.includes(person.id) && !captains.has(person.id),
    )!;
    for (const id of ep.participantIds) if (!captains.has(id)) captain.relationships[id] = [40];
    captain.relationships[newcomer.id] = [captainAffection];
    newcomer.relationships[captain.id] = [newcomerAffection];
    const next = transitionBattleStory(state, { type: 'advance' }, ep.revision);
    const scene = next.runtime!.battle!.scenes.at(-1)!;
    assert.deepEqual(next.runtime!.battle!.teams[0].memberIds, [captain.id, newcomer.id]);
    if (expected === 'neutral') assert.equal(scene.paragraphs.length, 2);
    else {
      assert.equal(scene.paragraphs.length, 3);
      assert.deepEqual(scene.paragraphContestantIds?.[2], [newcomer.id, captain.id]);
      assert.match(scene.paragraphs[2], expected === 'mutual' ? /both feel uneasy/ : /feels uneasy/);
      if (expected === 'one-sided') assert.doesNotMatch(scene.paragraphs[2], /both/);
    }
    assert.equal(
      battleRelationship(next.contestants.find((person) => person.id === captain.id)!, newcomer.id),
      captainAffection,
    );
    assert.equal(
      battleRelationship(next.contestants.find((person) => person.id === newcomer.id)!, captain.id),
      newcomerAffection,
    );
    const html = renderToStaticMarkup(
      createElement(NarrativeBattlePlayer, {
        state: next,
        onAction: () => {},
        onInspect: () => {},
      }),
    );
    if (expected !== 'neutral') assert.match(html, /role="note"/);
  }
});

test('later draft picks react to existing teammates without repeating older team tensions', () => {
  let state = advanceBattleStoryTo(initial, 'draft');
  for (let pick = 1; pick < 6; pick++)
    state = transitionBattleStory(state, { type: 'advance' }, state.runtime!.battle!.revision);
  const ep = state.runtime!.battle!;
  const team = ep.teams[0];
  const captain = state.contestants.find((person) => person.id === team.captainId)!;
  const teammate = state.contestants.find((person) => person.id === team.memberIds[1])!;
  const picked = new Set(ep.teams.flatMap((entry) => entry.memberIds));
  const newcomer = state.contestants.find(
    (person) => ep.participantIds.includes(person.id) && !picked.has(person.id),
  )!;
  for (const id of ep.participantIds) if (!picked.has(id)) captain.relationships[id] = [40];
  captain.relationships[newcomer.id] = [51];
  newcomer.relationships[captain.id] = [50];
  newcomer.relationships[teammate.id] = [50];
  teammate.relationships[newcomer.id] = [33];
  teammate.relationships[captain.id] = [5];
  const next = transitionBattleStory(state, { type: 'advance' }, ep.revision);
  const scene = next.runtime!.battle!.scenes.at(-1)!;
  assert.equal(scene.paragraphs.length, 3);
  assert.deepEqual(scene.paragraphContestantIds?.[1], [captain.id, teammate.id, newcomer.id]);
  assert.deepEqual(scene.paragraphContestantIds?.[2], [teammate.id, newcomer.id]);
});

test('real battle story beats render with accurate contestant mention references', () => {
  let state = initial;
  for (let turn = 0; turn < 180 && state.runtime?.battle?.phase !== 'complete'; turn++) {
    const { action, revision } = nextBattleStoryAction(state);
    state = transitionBattleStory(state, action, revision);
    if (state.runtime?.battle)
      assert.doesNotThrow(
        () =>
          renderToStaticMarkup(
            createElement(NarrativeBattlePlayer, {
              state,
              onAction: () => {},
              onInspect: () => {},
            }),
          ),
        `Rendering stage ${state.runtime.battle.story?.stage}`,
      );
  }
});

test('The Battles plays eight sequences with six interventions and identical outcomes after every reload', () => {
  assert.equal(initial.runtime?.version, 3);
  let direct = initial;
  let restored = initial;
  const stages: string[] = [];
  const beforeScreenTime = new Map(
    initial.contestants.map((person) => [person.id, person.aggregations.screenTime]),
  );
  for (let turn = 0; turn < 180 && direct.runtime?.battle?.phase !== 'complete'; turn++) {
    const { action, revision } = nextBattleStoryAction(direct);
    const before = JSON.stringify(direct);
    const next = transitionBattleStory(direct, action, revision);
    assert.equal(JSON.stringify(direct), before, 'transitions preserve the input state');
    assert.equal(transitionBattleStory(next, action, revision), next, 'duplicate delivery is a no-op');
    restored = decodeSimulationState(JSON.stringify(transitionBattleStory(restored, action, revision)));
    assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(next)));
    direct = next;
    const stage = direct.runtime?.battle?.story?.stage;
    if (stage) stages.push(stage);
    const ep = direct.runtime?.battle;
    if (ep && !ep.story?.rankRevealed)
      assert.ok(!ep.scenes.some((scene) => scene.kind === 'ranking' && scene.contestantIds.length > 6));
    if (stage === 'winners')
      assert.ok(
        ep?.participantIds.every(
          (id) => direct.contestants.find((person) => person.id === id)?.status === 'ACTIVE',
        ),
      );
    if (stage === 'mvp') assert.ok(ep?.mvp, 'MVP is visible before secret choice');
  }
  const ep = direct.runtime?.battle;
  assert.ok(ep?.story);
  assert.equal(ep.phase, 'complete');
  assert.equal(ep.version, 2);
  assert.equal(ep.teams.length, 6);
  assert.equal(ep.story.draftPick, 24);
  assert.equal(ep.rooms.length, 5);
  assert.ok(ep.rooms.every((room) => room.memberIds.length === 6));
  assert.equal(new Set(ep.rooms.flatMap((room) => room.memberIds)).size, 30);
  assert.equal(Object.keys(ep.story.interventions).length, 6);
  assert.equal(ep.story.matchupReactions.length, 30);
  assert.equal(ep.story.rankReactions.length, 18);
  assert.equal(ep.story.rankReactions[0].targetId, null);
  assert.equal(ep.performances.length, 6);
  assert.equal(ep.survivorIds.length, 18);
  assert.equal(ep.eliminatedIds.length, 12);
  assert.equal(new Set([ep.judgeSaveId, ep.audienceSaveId, ep.productionSaveId]).size, 3);
  assert.deepEqual([...new Set(ep.scenes.map((scene) => scene.sequence))], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(stages.filter((stage) => stage === 'intervention').length, 6);
  assert.equal(stages.filter((stage) => stage === 'reviews').length, 3);
  assert.ok(stages.lastIndexOf('reviews') < stages.indexOf('winners'));
  assert.ok(stages.indexOf('secret-result') < stages.indexOf('ranking-rule'));
  assert.ok(stages.indexOf('ranking') < stages.indexOf('rank-reactions'));
  assert.equal(ep.cuts.length, 0);
  assert.equal(ep.selectedCutId, null);
  assert.ok(!ep.scenes.some((scene) => scene.kind === 'broadcast' || scene.kind === 'audience'));
  assert.equal(Object.keys(ep.mvp!.ballots).length, 18);
  for (const [voter, choice] of Object.entries(ep.mvp!.ballots)) assert.notEqual(voter, choice);
  ep.survivorIds.forEach((id, index) => {
    const person = direct.contestants.find((entry) => entry.id === id)!;
    assert.equal(person.rank, index + 1);
    assert.equal(person.status, 'ACTIVE');
  });
  for (const id of ep.participantIds) {
    const person = direct.contestants.find((entry) => entry.id === id)!;
    assert.ok(Math.abs(person.aggregations.screenTime - beforeScreenTime.get(id)! - 100 / 30) < 1e-8);
    assert.equal(ep.story.exposure[id], 1 / 30);
    assert.ok(!person.relationships[id]);
    assert.equal(person.changeLog.filter((entry) => entry.episode === 2).length, 1);
  }
  assert.equal(
    Object.values(ep.audience!.votes).reduce((sum, count) => sum + count, 0),
    direct.runtime!.show.audience,
  );
  assert.equal(
    direct.runtime!.show.general +
      Object.values(direct.runtime!.show.fans).reduce((sum, count) => sum + count, 0),
    direct.runtime!.show.audience,
  );
  assert.throws(() => transitionNarrativeBattle(initial, { type: 'start' }, 0), /modern season/);
});

test('B rehearsal is already complete before A performs and all six rehearsal choices stay independent', () => {
  let state = advanceBattleStoryTo(initial, 'intervention');
  const firstPair = state.runtime!.battle!.pairings[0];
  const teamB = state.runtime!.battle!.teams.find((team) => team.id === firstPair.teamIds[1])!;
  const baseline = JSON.stringify(teamB.practice);
  const earlier = state.runtime!.battle!.story!.interventions;
  assert.deepEqual(earlier, {});
  state = transitionBattleStory(state, { type: 'conflict', choice: 'push' }, state.runtime!.battle!.revision);
  state = advanceBattleStoryTo(state, 'opponent-reaction');
  assert.equal(
    JSON.stringify(state.runtime!.battle!.teams.find((team) => team.id === teamB.id)!.practice),
    baseline,
  );
  const choices = state.runtime!.battle!.story!.interventions;
  assert.equal(Object.keys(choices).length, 1);
  state = advanceBattleStoryTo(state, 'intervention');
  assert.equal(state.runtime!.battle!.conflict?.teamId, teamB.id);
  assert.equal(state.runtime!.battle!.conflictChoice, null);
  assert.equal(
    JSON.stringify(state.runtime!.battle!.teams.find((team) => team.id === teamB.id)!.practice),
    baseline,
  );
});

test('personality-adjusted battle backlash uses only departed friends and caps each target at fifteen', () => {
  const ready = advanceBattleStoryTo(initial, 'save-result');
  for (const [traits, expected] of [
    [{ gentleness: 0, maturity: 0, sensitivity: 0 }, -15],
    [{ gentleness: 5, maturity: 5, sensitivity: 0 }, 0],
    [{ gentleness: 0, maturity: 0, sensitivity: -8 }, -4],
    [{ gentleness: -5, maturity: -5, sensitivity: 5 }, -15],
  ] as const) {
    const state = structuredClone(ready);
    const ep = state.runtime!.battle!;
    const pair = ep.pairings.find((entry) => {
      const loser = ep.teams.find((team) => entry.teamIds.includes(team.id) && team.id !== entry.winnerId)!;
      return loser.memberIds.filter((id) => ep.eliminatedIds.includes(id)).length >= 2;
    })!;
    const winner = ep.teams.find((team) => team.id === pair.winnerId)!;
    const loser = ep.teams.find((team) => pair.teamIds.includes(team.id) && team.id !== pair.winnerId)!;
    const observer = state.contestants.find((person) => person.id === winner.memberIds[0])!;
    Object.assign(observer.personality, traits);
    for (const id of ep.participantIds) if (id !== observer.id) observer.relationships[id] = [50];
    for (const id of loser.memberIds.filter((id) => ep.eliminatedIds.includes(id)).slice(0, 2))
      observer.relationships[id] = [60];
    const target = winner.memberIds[1];
    applyNarrativeBattleBacklash(state);
    assert.equal(battleRelationship(observer, target), 50 + expected);
    assert.equal(observer.relationships[observer.id], undefined);
    const after = JSON.stringify(state.contestants);
    applyNarrativeBattleBacklash(state);
    assert.equal(JSON.stringify(state.contestants), after);
  }
});

test('rank reactions follow the immediately higher survivor without changing rankings and cannot repeat', () => {
  const state = structuredClone(advanceBattleStoryTo(initial, 'ranking'));
  const ep = state.runtime!.battle!;
  const standings = ep.survivorIds.map((id) => {
    const person = state.contestants.find((entry) => entry.id === id)!;
    return [id, person.rank, person.aggregations.rankingScore];
  });

  applyBattleRankReactions(state);
  assert.equal(ep.story!.rankReactions.length, 18);
  ep.story!.rankReactions.forEach((reaction, index) => {
    assert.equal(reaction.targetId, index ? ep.survivorIds[index - 1] : null);
    assert.ok(Math.abs(reaction.after - reaction.before) <= 2);
  });
  assert.deepEqual(
    ep.survivorIds.map((id) => {
      const person = state.contestants.find((entry) => entry.id === id)!;
      return [id, person.rank, person.aggregations.rankingScore];
    }),
    standings,
  );
  assert.throws(() => applyBattleRankReactions(state), /fresh full ranking/);
});

test('battle backlash excludes saved friends and neutral bonds and clamps low affection', () => {
  const ready = advanceBattleStoryTo(initial, 'save-result');
  const ep = ready.runtime!.battle!;
  const pair = ep.pairings.find((entry) => {
    const loser = ep.teams.find((team) => entry.teamIds.includes(team.id) && team.id !== entry.winnerId)!;
    return loser.memberIds.some((id) => ep.survivorIds.includes(id));
  })!;
  const loser = ep.teams.find((team) => pair.teamIds.includes(team.id) && team.id !== pair.winnerId)!;
  const winner = ep.teams.find((team) => team.id === pair.winnerId)!;
  const savedFriend = loser.memberIds.find((id) => ep.survivorIds.includes(id))!;
  const departedFriend = loser.memberIds.find((id) => ep.eliminatedIds.includes(id))!;
  for (const [friend, affinity, expected] of [
    [savedFriend, 100, 5],
    [departedFriend, 59, 5],
    [departedFriend, 60, 0],
  ] as const) {
    const state = structuredClone(ready);
    const observer = state.contestants.find((person) => person.id === winner.memberIds[0])!;
    Object.assign(observer.personality, { gentleness: 0, maturity: 0, sensitivity: 0 });
    for (const id of ep.participantIds) if (id !== observer.id) observer.relationships[id] = [50];
    observer.relationships[friend] = [affinity];
    observer.relationships[winner.memberIds[1]] = [5];
    applyNarrativeBattleBacklash(state);
    assert.equal(battleRelationship(observer, winner.memberIds[1]), expected);
  }
});

test('invalid battle choices and failed saves leave the published story and random state untouched', () => {
  const state = advanceBattleStoryTo(initial, 'intervention');
  const before = JSON.stringify(state);
  assert.throws(
    () => transitionBattleStory(state, { type: 'advance' }, state.runtime!.battle!.revision),
    /production decision/,
  );
  assert.throws(
    () =>
      transitionBattleStory(state, { type: 'broadcast', cutId: 'music' }, state.runtime!.battle!.revision),
    /not available/,
  );
  assert.throws(
    () =>
      transitionBattleStory(
        state,
        { type: 'conflict', choice: 'support' },
        state.runtime!.battle!.revision - 2,
      ),
    /stale/,
  );
  assert.equal(JSON.stringify(state), before);
  const previous = simulationStore.state;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
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
    simulationStore.setState(() => state);
    assert.throws(
      () =>
        simulationActions.dispatchBattle(
          { type: 'conflict', choice: 'mediate' },
          state.runtime!.battle!.revision,
        ),
      /storage unavailable/,
    );
    assert.equal(simulationStore.state, state);
  } finally {
    simulationStore.setState(() => previous);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
