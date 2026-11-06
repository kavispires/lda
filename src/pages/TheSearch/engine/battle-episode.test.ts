import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { BattleEpisode } from '../types/battle-episode';
import type { SimulationState } from '../types/simulation';
import { applyBattleBacklash, transitionBattle } from './battle-episode';
import { advanceBattleTo, completedAuditionsFixture, nextBattleAction } from './battle-fixtures';
import { battleRelationship } from './battle-scoring';
import { assertBattleEpisode } from './battle-validation';
import { decodeSimulationState, SIMULATION_STORAGE_KEY } from './simulation-persistence';

const ep = (state: SimulationState): BattleEpisode => state.runtime!.battle!;
const initial = completedAuditionsFixture();

test('Group Battles is deterministic across every JSON reload, freezes snapshots, and archives only its thirty participants', () => {
  const source = structuredClone(initial);
  let direct = initial;
  let reload = initial;
  for (let count = 0; count < 80 && ep(direct)?.phase !== 'complete'; count++) {
    const action = nextBattleAction(direct);
    const revision = ep(direct)?.revision ?? 0;
    const before = structuredClone(direct);
    const next = transitionBattle(direct, action, revision);
    assert.deepEqual(direct, before);
    assert.ok(
      next.contestants.every((contestant) => {
        const previous = before.contestants.find((entry) => entry.id === contestant.id);
        return previous && contestant.updatedAt >= previous.updatedAt;
      }),
      'starting a new episode must not move contestant update times backwards',
    );
    assert.equal(transitionBattle(next, action, revision), next);
    assert.ok(Object.isFrozen(next.runtime!.definitions.battleSongs));
    assert.ok(Object.isFrozen(next.runtime!.initialContestants[0].coreSkills));
    direct = next;
    reload = decodeSimulationState(JSON.stringify(transitionBattle(reload, action, revision)));
    assert.deepEqual(JSON.parse(JSON.stringify(reload)), JSON.parse(JSON.stringify(direct)));
    assertBattleEpisode(ep(direct), direct.contestants, direct.runtime!.definitions);
  }
  assert.equal(ep(direct).phase, 'complete');
  assert.deepEqual(initial, source);
  assert.equal(direct.runtime!.phase, 'episode-complete');
  assert.equal(direct.runtime!.episode, 2);
  assert.equal(ep(direct).survivorIds.length, 18);
  assert.equal(ep(direct).eliminatedIds.length, 12);
  assert.equal(
    new Set(
      ep(direct).performances.flatMap((performance) =>
        performance.evaluations.map((evaluation) => evaluation.contestantId),
      ),
    ).size,
    30,
  );
  assert.equal(ep(direct).performances.length, 6);
  for (const team of ep(direct).teams) {
    assert.equal(team.memberIds.length, 5);
    assert.equal(team.practice.length, 2);
    assert.equal(Object.keys(team.centerBallots).length, 5);
    for (const [voter, choice] of Object.entries(team.centerBallots)) assert.notEqual(voter, choice);
    assert.ok(Math.abs(team.coordination) <= 5);
    for (const session of team.practice) {
      assert.equal(session.contestants.length, 5);
      assert.ok(session.contestants.every((result) => result.practiceAfter >= result.practiceBefore));
    }
  }
  for (const contestant of direct.contestants) {
    const previous = initial.contestants.find((entry) => entry.id === contestant.id)!;
    assert.deepEqual(contestant.coreSkills, previous.coreSkills);
    assert.deepEqual(contestant.utilitySkills, previous.utilitySkills);
    if (ep(direct).participantIds.includes(contestant.id)) {
      assert.equal(contestant.changeLog.filter((entry) => entry.episode === 2).length, 1);
      assert.ok(contestant.changeLog.at(-1)!.changes!.length > 0);
    } else assert.deepEqual(contestant, previous, 'old departures stay archived unchanged');
  }
  assert.equal(Object.keys(ep(direct).mvp!.ballots).length, 18);
  for (const [voter, choice] of Object.entries(ep(direct).mvp!.ballots)) assert.notEqual(voter, choice);
  assert.equal(
    Object.values(ep(direct).audience!.votes).reduce((a, b) => a + b, 0),
    direct.runtime!.show.audience,
  );
  assert.equal(
    direct.runtime!.show.general + Object.values(direct.runtime!.show.fans).reduce((a, b) => a + b, 0),
    direct.runtime!.show.audience,
  );
  assert.ok(ep(direct).eliminatedIds.every((id) => !direct.runtime!.show.fans[id]));
  assert.equal(ep(direct).secret!.cardId, null);
});

test('rooms, stage ranking and four-round outgoing-relationship draft stay fixed and paced', () => {
  let state = transitionBattle(initial, { type: 'start' }, 0);
  const rooms = structuredClone(ep(state).rooms);
  assert.equal(rooms.length, 5);
  assert.ok(rooms.every((room) => room.memberIds.length === 6));
  assert.equal(new Set(rooms.flatMap((room) => room.memberIds)).size, 30);
  for (let room = 0; room < 5; room++) {
    state = transitionBattle(state, { type: 'advance' }, ep(state).revision);
    assert.equal(ep(state).phase, 'dorms');
    assert.equal(ep(state).roomCursor, room + 1);
    assert.deepEqual(ep(state).scenes.at(-1)?.contestantIds, rooms[room].memberIds);
    assert.ok(!ep(state).scenes.some((scene) => scene.kind === 'ranking'));
  }
  state = transitionBattle(state, { type: 'advance' }, ep(state).revision);
  assert.equal(ep(state).phase, 'ranking');
  const combined = [...initial.contestants]
    .filter((entry) => ep(state).participantIds.includes(entry.id))
    .sort((a, b) => b.aggregations.rankingScore - a.aggregations.rankingScore);
  assert.deepEqual(
    ep(state).rankedIds,
    combined.map((entry) => entry.id),
  );
  ep(state).rankedIds.forEach((id, index) => {
    assert.equal(
      state.contestants.find((contestant) => contestant.id === id)?.rank,
      index + 1,
      'cast inspection must match the announced thirty-person ranking',
    );
  });
  state = transitionBattle(state, { type: 'advance' }, ep(state).revision);
  assert.equal(ep(state).phase, 'draft');
  assert.deepEqual(
    ep(state).teams.map((team) => team.captainId),
    ep(state).rankedIds.slice(0, 6),
  );
  for (let round = 0; round < 4; round++) {
    const before = state;
    state = transitionBattle(state, { type: 'advance' }, ep(state).revision);
    assert.equal(ep(state).draftRound, round + 1);
    assert.equal(ep(state).phase, 'draft');
    assert.equal(ep(state).scenes.at(-1)?.title, `Draft round ${round + 1}`);
    if (round === 3) {
      assert.match(ep(state).scenes.at(-1)?.paragraphs.at(-1) ?? '', /last available contestant/);
    }
    const chosen = new Set(ep(before).teams.flatMap((team) => team.memberIds));
    for (const team of ep(state).teams) {
      const captain = before.contestants.find((entry) => entry.id === team.captainId)!;
      const eligible = ep(before).participantIds.filter((id) => !chosen.has(id));
      const picked = team.memberIds[round + 1];
      assert.equal(
        battleRelationship(captain, picked),
        Math.max(...eligible.map((id) => battleRelationship(captain, id))),
      );
      chosen.add(picked);
    }
  }
  state = transitionBattle(state, { type: 'advance' }, ep(state).revision);
  assert.equal(ep(state).phase, 'pairings');
  assert.equal(ep(state).pairings.length, 3);
  assert.deepEqual(ep(state).rooms, rooms);
});

test('both teams practice before A delivers, while B preparation is revealed only in its flashback', () => {
  let state = advanceBattleTo(initial, 'preparation');
  const firstPair = ep(state).pairings[0];
  const teams = firstPair.teamIds.map((id) => ep(state).teams.find((team) => team.id === id)!);
  assert.ok(teams.every((team) => team.practice.length === 2));
  assert.equal(ep(state).performances.length, 0);
  assert.equal(ep(state).scenes.filter((scene) => scene.kind === 'practice').length, 1);
  const practices = structuredClone(teams.map((team) => team.practice));
  state = transitionBattle(state, { type: 'advance' }, ep(state).revision);
  assert.equal(ep(state).phase, 'conflict');
  state = transitionBattle(state, { type: 'conflict', choice: 'push' }, ep(state).revision);
  state = transitionBattle(state, { type: 'advance' }, ep(state).revision);
  assert.equal(ep(state).performances.length, 1);
  state = transitionBattle(state, { type: 'advance' }, ep(state).revision);
  assert.ok(ep(state).scenes.at(-1)!.title.includes('flashback'));
  state = transitionBattle(state, { type: 'advance' }, ep(state).revision);
  assert.equal(ep(state).performances.length, 2);
  assert.deepEqual(
    firstPair.teamIds.map((id) => ep(state).teams.find((team) => team.id === id)!.practice),
    practices,
  );
  assert.ok(
    ep(state).performances[1].evaluations.every((evaluation) => Math.abs(evaluation.composure) === 1),
  );
  for (const evaluation of ep(state).performances[1].evaluations) {
    assert.equal(ep(state).composure[evaluation.contestantId], 0);
    assert.deepEqual(
      ep(state)
        .changes[evaluation.contestantId].filter((change) => change.path === 'episode2.composure')
        .map(({ before, after }) => [before, after]),
      [
        [0, evaluation.composure],
        [evaluation.composure, 0],
      ],
      'temporary stage readiness must be applied, consumed and included in the contestant history',
    );
  }
});

test('draft narration records the actual deciding criterion without changing the selection hierarchy', () => {
  const cases = [
    { criterion: 'relationship', expected: /relationship score.*highest/ },
    { criterion: 'charisma', expected: /charisma.*breaks the tie/ },
    { criterion: 'core', expected: /higher average core skill/ },
    { criterion: 'seed', expected: /saved seeded draw/ },
  ];
  for (const { criterion, expected } of cases) {
    const state = advanceBattleTo(initial, 'draft');
    const battle = ep(state);
    const captain = state.contestants.find((entry) => entry.id === battle.teams[0].captainId);
    assert.ok(captain);
    const captainIds = new Set(battle.teams.map((team) => team.captainId));
    const available = state.contestants.filter(
      (entry) => battle.participantIds.includes(entry.id) && !captainIds.has(entry.id),
    );
    for (const contestant of available) {
      captain.relationships[contestant.id] = [50];
      contestant.utilitySkills.charisma = 3;
      for (const skill of Object.keys(contestant.coreSkills) as (keyof typeof contestant.coreSkills)[]) {
        contestant.coreSkills[skill] = 3;
      }
    }
    const preferred = available[0];
    if (criterion === 'relationship') captain.relationships[preferred.id] = [55];
    if (criterion === 'charisma') preferred.utilitySkills.charisma = 5;
    if (criterion === 'core') {
      for (const skill of Object.keys(preferred.coreSkills) as (keyof typeof preferred.coreSkills)[]) {
        preferred.coreSkills[skill] = 4;
      }
    }
    const next = transitionBattle(state, { type: 'advance' }, battle.revision);
    const chosen = ep(next).teams[0].memberIds[1];
    if (criterion !== 'seed') assert.equal(chosen, preferred.id);
    const narrated = ep(next).scenes.at(-1);
    assert.ok(narrated);
    assert.match(narrated.paragraphs[0], expected);
    assert.deepEqual(narrated.paragraphContestantIds?.[0], [captain.id, chosen]);
    assert.deepEqual(decodeSimulationState(JSON.stringify(next)).runtime?.battle?.scenes.at(-1), narrated);
  }
});

test('each draft pick strains only still-unpicked relationships, with personality immunity, sensitivity and bounded cumulative losses', () => {
  const state = advanceBattleTo(initial, 'draft');
  const battle = ep(state);
  const captains = battle.teams.map((team) => {
    const captain = state.contestants.find((entry) => entry.id === team.captainId);
    assert.ok(captain);
    return captain;
  });
  const candidates = state.contestants.filter(
    (entry) =>
      battle.participantIds.includes(entry.id) && !captains.some((captain) => captain.id === entry.id),
  );
  const choices = candidates.slice(0, 6);
  for (const candidate of candidates) {
    Object.assign(candidate.personality, { gentleness: 0, maturity: 0, sensitivity: 0 });
    for (const id of battle.participantIds) {
      if (id !== candidate.id) candidate.relationships[id] = [50];
    }
  }
  const cases = [
    { gentleness: 0, maturity: 0, sensitivity: -4, loss: 1 },
    { gentleness: 5, maturity: 0, sensitivity: -5, loss: 0 },
    { gentleness: 0, maturity: 5, sensitivity: -5, loss: 0 },
    { gentleness: 4, maturity: 4, sensitivity: -5, loss: 2 },
    { gentleness: 0, maturity: 0, sensitivity: -6, loss: 2 },
    { gentleness: 4, maturity: 4, sensitivity: 0, loss: 1 },
    { gentleness: 6, maturity: 0, sensitivity: -10, loss: 0 },
    { gentleness: 0, maturity: 6, sensitivity: -10, loss: 0 },
  ];
  cases.forEach(({ loss: _loss, ...traits }, index) => {
    Object.assign(candidates[index + 6].personality, traits);
  });
  const last = candidates[candidates.length - 1];
  last.personality.sensitivity = -5;
  last.relationships[captains[0].id] = [1];
  last.relationships[choices[0].id] = [0];
  captains.forEach((captain, index) => {
    for (const candidate of candidates) captain.relationships[candidate.id] = [50];
    captain.relationships[choices[index].id] = [100];
    captain.relationships[last.id] = [0];
  });
  const before = structuredClone(state);
  let next = transitionBattle(state, { type: 'advance' }, battle.revision);
  assert.deepEqual(state, before, 'draft reactions must not mutate the input state');
  assert.deepEqual(
    ep(next).teams.map((team) => team.memberIds[1]),
    choices.map((entry) => entry.id),
  );
  const targets = [...captains, ...choices];
  for (const [index, { loss }] of cases.entries()) {
    const observer = next.contestants.find((entry) => entry.id === candidates[index + 6].id);
    assert.ok(observer);
    for (const target of targets) assert.equal(battleRelationship(observer, target.id), 50 - loss);
    assert.equal(battleRelationship(observer, last.id), 50, 'unpicked contestants do not resent each other');
  }
  for (const [index, choice] of choices.entries()) {
    const picked = next.contestants.find((entry) => entry.id === choice.id);
    assert.ok(picked);
    for (const [turn, captain] of captains.entries()) {
      assert.equal(battleRelationship(picked, captain.id), turn < index ? 49 : 50);
      if (turn !== index) assert.equal(battleRelationship(picked, choices[turn].id), turn < index ? 49 : 50);
    }
  }
  for (const captain of captains) {
    assert.deepEqual(
      next.contestants.find((entry) => entry.id === captain.id)?.relationships,
      captain.relationships,
    );
  }
  for (let round = 2; round <= 4; round++) {
    next = transitionBattle(
      decodeSimulationState(JSON.stringify(next)),
      { type: 'advance' },
      ep(next).revision,
    );
    const observer = next.contestants.find((entry) => entry.id === last.id);
    assert.ok(observer);
    assert.equal(battleRelationship(observer, captains[0].id), 0);
    assert.equal(battleRelationship(observer, choices[0].id), 0);
    assert.equal(battleRelationship(observer, captains[1].id), 50 - round * 2);
    assert.equal(
      battleRelationship(observer, captains[5].id),
      50 - Math.min(round, 3) * 2,
      'the last contestant no longer reacts when they are finally picked',
    );
  }
  assert.equal(ep(next).teams[5].memberIds[4], last.id);
  const bounded = ep(next).changes[last.id].filter(
    (change) => change.path === `relationships.${captains[0].id}`,
  );
  assert.equal(bounded.length, 1);
  assert.deepEqual(bounded[0].after, [1, 0]);
  assert.match(bounded[0].cause, /passed over during draft round 1/);
  assert.deepEqual(
    decodeSimulationState(JSON.stringify(next)).contestants.map((entry) => entry.relationships),
    next.contestants.map((entry) => entry.relationships),
  );
});

test('mixed-skill part satisfaction is saved once using weighted fit, not recomputed after practice', () => {
  const state = structuredClone(advanceBattleTo(initial, 'pairings'));
  const team = ep(state).teams.find((entry) => entry.id === ep(state).pairings[0].teamIds[0])!;
  const song = state.runtime!.definitions.battleSongs!.find((entry) => entry.id === team.songId)!;
  const mixedPart = song.parts.find(
    (part) =>
      part.testedSkills.length === 2 &&
      part.testedSkills[0].skill === 'vocals' &&
      part.testedSkills[0].requiredLevel === 4,
  )!;
  assert.ok(mixedPart);
  for (const id of team.memberIds) {
    const contestant = state.contestants.find((entry) => entry.id === id)!;
    contestant.coreSkills.vocals = 1;
    contestant.coreSkills.dance = 5;
  }
  const next = transitionBattle(state, { type: 'advance' }, ep(state).revision);
  const prepared = ep(next).teams.find((entry) => entry.id === team.id)!;
  const assignedId = prepared.memberIds.find((id) => prepared.partAssignments[id] === mixedPart.id)!;
  const contestant = next.contestants.find((entry) => entry.id === assignedId)!;
  // vocals deficit -3×2 plus dance surplus +3 is unhappy; an unweighted sum would wrongly be happy.
  assert.equal(prepared.partReactions[assignedId], 'unhappy');
  assert.ok(
    ep(next)
      .scenes.at(-1)!
      .paragraphs.includes(
        `${contestant.name}: ${mixedPart.name}; unhappy about the assignment. Practice ${contestant.aggregations.practice}/5.`,
      ),
  );
  const reloaded = decodeSimulationState(JSON.stringify(next));
  assert.equal(
    ep(reloaded).teams.find((entry) => entry.id === team.id)!.partReactions[assignedId],
    'unhappy',
  );
});

test('invalid/stale choices never mutate state; winners precede distinct eligible saves and departures', () => {
  const opening = transitionBattle(initial, { type: 'start' }, 0);
  assert.throws(() => transitionBattle(opening, { type: 'advance' }, 0), /stale/);
  assert.throws(
    () => transitionBattle(opening, { type: 'broadcast', cutId: 'music' }, ep(opening).revision),
    /not available/,
  );
  const awaiting = advanceBattleTo(initial, 'saves');
  const before = structuredClone(awaiting);
  const battle = ep(awaiting);
  assert.equal(battle.revealedResults, 3);
  assert.ok(battle.pairings.every((pair) => pair.winnerId));
  assert.equal(battle.survivorIds.length, 0);
  assert.equal(new Set([battle.judgeSaveId, battle.audienceSaveId]).size, 2);
  assert.ok(
    battle.productionShortlist.every((id) => id !== battle.judgeSaveId && id !== battle.audienceSaveId),
  );
  assert.throws(() => transitionBattle(awaiting, { type: 'advance' }, battle.revision), /choice/);
  assert.throws(
    () =>
      transitionBattle(
        awaiting,
        { type: 'production-save', contestantId: battle.judgeSaveId! },
        battle.revision,
      ),
    /eligible/,
  );
  assert.deepEqual(awaiting, before);
  const selected = transitionBattle(
    awaiting,
    { type: 'production-save', contestantId: battle.productionShortlist[0] },
    battle.revision,
  );
  assert.equal(ep(selected).eliminatedIds.length, 12);
  assert.ok(
    ep(selected).eliminatedIds.every(
      (id) => selected.contestants.find((entry) => entry.id === id)!.status === 'ACTIVE',
    ),
  );
  assert.equal(ep(selected).survivorIds.length, 18);
});

test('backlash is directional, -15 per actually eliminated friend, capped at -30 per target, and excludes saved friends/self', () => {
  const state = structuredClone(advanceBattleTo(initial, 'complete'));
  const battle = ep(state);
  battle.changes = {};
  const survivor = state.contestants.find((entry) => entry.id === battle.survivorIds[0])!;
  for (const id of battle.participantIds) if (id !== survivor.id) survivor.relationships[id] = [80];
  for (const other of state.contestants)
    if (other.id !== survivor.id)
      for (const id of battle.participantIds) if (id !== other.id) other.relationships[id] = [50];
  const expected = new Map<string, number>();
  for (const friendId of battle.eliminatedIds) {
    const friendTeam = battle.teams.find((team) => team.memberIds.includes(friendId))!;
    const pairing = battle.pairings.find((pair) => pair.teamIds.includes(friendTeam.id))!;
    const winners = battle.teams.find((team) => team.id === pairing.winnerId)!;
    for (const targetId of winners.memberIds)
      if (targetId !== survivor.id) expected.set(targetId, Math.min(30, (expected.get(targetId) ?? 0) + 15));
  }
  const selfBefore = structuredClone(survivor.relationships[survivor.id]);
  applyBattleBacklash(state.contestants, battle);
  for (const id of battle.participantIds)
    if (id !== survivor.id) assert.equal(battleRelationship(survivor, id), 80 - (expected.get(id) ?? 0));
  assert.ok(battle.changes[survivor.id].every((change) => change.cause.includes('capped at -30')));
  assert.deepEqual(survivor.relationships[survivor.id], selfBefore);
  assert.ok(
    state.contestants
      .filter((entry) => entry.id !== survivor.id)
      .every((entry) =>
        Object.entries(entry.relationships).every(
          ([id, history]) => id === entry.id || !battle.participantIds.includes(id) || history.at(-1) === 50,
        ),
      ),
  );
  const exemption = structuredClone(state);
  const exemptSurvivor = exemption.contestants.find((entry) => entry.id === survivor.id)!;
  for (const id of battle.participantIds) if (id !== survivor.id) exemptSurvivor.relationships[id] = [50];
  const savedFriend = [battle.judgeSaveId!, battle.audienceSaveId!, battle.productionSaveId!].find(
    (id) => id !== survivor.id,
  )!;
  exemptSurvivor.relationships[savedFriend] = [80];
  const snapshot = structuredClone(exemptSurvivor.relationships);
  applyBattleBacklash(exemption.contestants, exemption.runtime!.battle!);
  assert.deepEqual(
    exemptSurvivor.relationships,
    snapshot,
    'friendship with a saved contestant never triggers backlash',
  );
});

test('old Episode 1 snapshots freeze the editable battle catalog at Episode 2 opening and apply queued attrition conservatively', () => {
  const old = structuredClone(initial);
  delete old.runtime!.definitions.battleSongs;
  const before = old.runtime!.show.audience;
  old.runtime!.show.pendingAttrition = 37;
  const next = transitionBattle(old, { type: 'start' }, 0);
  assert.ok(next.runtime!.definitions.battleSongs!.length >= 6);
  assert.equal(next.runtime!.show.audience, before - 37);
  assert.equal(next.runtime!.show.pendingAttrition, 0);
  assert.equal(
    next.runtime!.show.general + Object.values(next.runtime!.show.fans).reduce((a, b) => a + b, 0),
    before - 37,
  );
  assert.equal(old.runtime!.definitions.battleSongs, undefined);
});

test('the closing secret check can select a new departure but never repeats a publicly revealed card', () => {
  const state = structuredClone(advanceBattleTo(initial, 'mvp'));
  const runtime = state.runtime!;
  const battle = ep(state);
  const targetId = battle.eliminatedIds[0];
  const cardId = Object.keys(runtime.definitions.cards.secret)[0];
  assert.ok(cardId);
  for (const id of battle.participantIds) {
    const contestant = state.contestants.find((entry) => entry.id === id)!;
    contestant.attributes = [cardId];
    if (id !== targetId) {
      contestant.events.push(`SECRET_REVEALED:${cardId}`);
      runtime.revealedSecrets.push({ contestantId: id, cardId });
    }
  }
  const check = transitionBattle(state, { type: 'advance' }, battle.revision);
  assert.equal(ep(check).phase, 'secret');
  assert.deepEqual(ep(check).secretCandidates, [targetId]);
  const complete = transitionBattle(check, { type: 'secret', contestantId: targetId }, ep(check).revision);
  assert.equal(ep(complete).phase, 'complete');
  assert.equal(ep(complete).secret!.cardId, cardId);
  assert.equal(complete.contestants.find((entry) => entry.id === targetId)!.status, 'ELIMINATED');
  assert.equal(
    complete.runtime!.revealedSecrets.filter(
      (entry) => entry.contestantId === targetId && entry.cardId === cardId,
    ).length,
    1,
  );
});

test('battle actions persist before publication; failed writes preserve RNG and retry stores exactly the resolved state', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousState = simulationStore.state;
  const saved = new Map<string, string>();
  let fail = true;
  let writes = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        setItem(key: string, value: string) {
          if (fail) throw new Error('Storage is full');
          writes++;
          saved.set(key, value);
        },
      },
    },
  });
  try {
    const state = advanceBattleTo(initial, 'broadcast');
    simulationStore.setState(() => state);
    const revision = ep(state).revision;
    const action = nextBattleAction(state);
    assert.throws(() => simulationActions.dispatchBattle(action, revision), /Storage is full/);
    assert.equal(simulationStore.state, state);
    const expected = transitionBattle(state, action, revision);
    fail = false;
    simulationActions.dispatchBattle(action, revision);
    assert.deepEqual(simulationStore.state, expected);
    assert.deepEqual(
      decodeSimulationState(saved.get(SIMULATION_STORAGE_KEY)!),
      JSON.parse(JSON.stringify(expected)),
    );
    simulationActions.dispatchBattle(action, revision);
    assert.equal(writes, 1);
  } finally {
    simulationStore.setState(() => previousState);
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
