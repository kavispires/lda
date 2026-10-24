import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { MoodChoices } from '../types/audition-episode';
import type { BootcampEpisode, BootcampEvaluation } from '../types/bootcamp-episode';
import type { SimulationState } from '../types/simulation';
import { chooseBootcampMvp, closeBootcampAudience } from './bootcamp-audience';
import { transitionBootcamp } from './bootcamp-episode';
import { applyPreparation, initializePreparation, playOpening } from './episode-preparation';
import { transitionBattleStory } from './narrative-battle';
import { narrativeBattleFixture, nextBattleStoryAction } from './narrative-battle-fixtures';
import { createSeededRandom } from './random';
import { decodeSimulationState } from './simulation-persistence';

function completedBattles(): SimulationState {
  let state = narrativeBattleFixture();
  for (let turn = 0; turn < 180 && state.runtime?.battle?.phase !== 'complete'; turn++) {
    const { action, revision } = nextBattleStoryAction(state);
    state = transitionBattleStory(state, action, revision);
  }
  assert.equal(state.runtime?.battle?.phase, 'complete');
  return state;
}

const previous = completedBattles();

function prepared(): SimulationState {
  const state = structuredClone(previous);
  const preparation = initializePreparation(state, 3, createSeededRandom(47).next);
  if (preparation.requiredSelections)
    applyPreparation(
      state,
      {
        type: 'opening-cast',
        contestantIds: preparation.shortlist.slice(0, preparation.requiredSelections),
      },
      createSeededRandom(48).next,
    );
  const choices = Object.fromEntries(
    Object.entries(preparation.moodOptions).map(([field, options]) => [field, options[0]]),
  ) as MoodChoices;
  applyPreparation(state, { type: 'mood', choices }, createSeededRandom(49).next);
  return state;
}

function audienceFixture(): SimulationState {
  const state = prepared();
  const runtime = state.runtime!;
  const ids = [...runtime.battle!.survivorIds];
  const groups = Array.from({ length: 3 }, (_, index) => ({
    id: `bootcamp-${index}`,
    memberIds: ids.slice(index * 6, index * 6 + 6),
    pairs: [],
    ballots: {},
    tieKeys: {},
  }));
  const evaluations: BootcampEvaluation[] = ids.flatMap((id, index) =>
    [1 + (Math.floor(index / 2) % 3), 4].map((round) => ({
      contestantId: id,
      round,
      rawDice: [3, 4],
      checks: {},
      baseScore: round === 4 ? 60 : 70,
      finalScore: round === 4 ? 60 : 70,
      fatigue: 0,
      tieBreakKey: index / 18,
      events: [],
    })),
  );
  const ep: BootcampEpisode = {
    version: 1,
    phase: 'winner',
    revision: 40,
    lastAction: { revision: 39, action: { type: 'advance' } },
    participantIds: ids,
    previousRankedIds: runtime.battle!.finalRankedIds.filter((id) => ids.includes(id)),
    groups,
    round: 4,
    roomCursor: runtime.battle!.rooms.length,
    groupCursor: 3,
    evaluations,
    groupResults: groups.map((group, index) => ({
      groupId: group.id,
      score: 80,
      tieBreakKey: index / 3,
      resets: 0,
      assisted: false,
      staging: [],
      attempts: [],
    })),
    winners: [ids[0], ids[1], ids[2], ids[0]],
    winningGroupId: groups[0].id,
    scoreAwardsApplied: false,
    exposure: Object.fromEntries(ids.map((id, index) => [id, 2 + (index % 3)])),
    audience: null,
    mvp: null,
    rankedIds: [],
    rankRevealed: false,
    initialState: {},
    startingContestants: structuredClone(state.contestants),
    scenes: [],
    changes: {},
  };
  runtime.bootcamp = ep;
  runtime.episode = 3;
  runtime.phase = 'bootcamp';
  return state;
}

test('Episode 3 preparation keeps the surviving opening cast and uses the revealed battle ranking', () => {
  const state = structuredClone(previous);
  const runtime = state.runtime!;
  const survivors = runtime.battle!.survivorIds;
  const ranked = runtime.battle!.finalRankedIds.filter((id) => survivors.includes(id));
  const first = state.contestants.find((entry) => entry.id === ranked[0])!;
  const last = state.contestants.find((entry) => entry.id === ranked.at(-1))!;
  const fields = Object.keys(runtime.definitions.specialties) as (keyof MoodChoices)[];
  for (const field of fields) {
    const values = Object.keys(runtime.definitions.specialties[field]);
    first.specialties[field] = values[0];
    last.specialties[field] = values[1];
  }
  const priorCast = [...runtime.openingCast!];
  state.contestants.forEach((person) => {
    person.rank = 51 - person.rank;
  });
  const prep = initializePreparation(state, 3, createSeededRandom(92).next);
  assert.deepEqual(
    prep.slots,
    priorCast.map((id) => (survivors.includes(id) ? id : null)),
  );
  for (const field of fields)
    assert.deepEqual(
      new Set(prep.moodOptions[field]),
      new Set([first.specialties[field], last.specialties[field]]),
    );
  const invalid = structuredClone(previous);
  invalid.runtime!.battle!.phase = 'mvp';
  assert.throws(() => initializePreparation(invalid, 3, createSeededRandom(4).next), /Complete The Battles/);
});

test('Boot Camp opening credits apply once and leave history capture to the transition', () => {
  const state = audienceFixture();
  const before = structuredClone(state);
  playOpening(state, 3);
  const ep = state.runtime!.bootcamp!;
  const cast = state.runtime!.preparations![3]!.slots;
  for (const person of state.contestants) {
    const prior = before.contestants.find((entry) => entry.id === person.id)!;
    assert.equal(
      person.aggregations.audienceRatio,
      cast.includes(person.id)
        ? Math.min(1, prior.aggregations.audienceRatio + 0.02)
        : prior.aggregations.audienceRatio,
    );
  }
  assert.deepEqual(state.runtime!.battle!.changes, before.runtime!.battle!.changes);
  assert.deepEqual(ep.changes, {});
  const after = structuredClone(state);
  playOpening(state, 3);
  assert.deepEqual(state, after);
});

test('Boot Camp closes conserved support, credits normalized footage once, and stacks repeated winner awards', () => {
  const state = audienceFixture();
  const before = structuredClone(state);
  const ep = state.runtime!.bootcamp!;
  closeBootcampAudience(state, createSeededRandom(71).next);
  assert.ok(ep.audience);
  assert.equal(ep.scoreAwardsApplied, true);
  assert.equal(ep.rankRevealed, false);
  assert.equal(
    Object.values(ep.audience.votes).reduce((a, b) => a + b, 0),
    state.runtime!.show.audience,
  );
  assert.equal(
    state.runtime!.show.general + Object.values(state.runtime!.show.fans).reduce((a, b) => a + b, 0),
    state.runtime!.show.audience,
  );
  assert.deepEqual(ep.exposure, before.runtime!.bootcamp!.exposure);
  const maximum = Math.max(...Object.values(ep.audience.votes));
  const total = Object.values(ep.exposure).reduce((a, b) => a + b, 0);
  for (const id of ep.participantIds) {
    const person = state.contestants.find((entry) => entry.id === id)!;
    const prior = before.contestants.find((entry) => entry.id === id)!;
    assert.equal(person.rank, prior.rank, 'closed ranking remains sealed');
    assert.ok(
      Math.abs(
        person.aggregations.screenTime - prior.aggregations.screenTime - (100 * ep.exposure[id]) / total,
      ) < 1e-9,
    );
    const expected =
      0.75 * prior.aggregations.score +
      0.6 * 69 +
      0.3 * ((100 * ep.audience.votes[id]) / maximum) +
      0.1 * (50 * (prior.aggregations.productionRatio + 1)) +
      5 * ep.winners.filter((winner) => winner === id).length;
    assert.ok(Math.abs(person.aggregations.score - expected) < 1e-9);
  }
  assert.deepEqual(ep.startingContestants, before.runtime!.bootcamp!.startingContestants);
  const scores = state.contestants.map((person) => person.aggregations.score);
  chooseBootcampMvp(state, createSeededRandom(72).next);
  assert.equal(Object.keys(ep.mvp!.ballots).length, 18);
  for (const [voter, chosen] of Object.entries(ep.mvp!.ballots)) assert.notEqual(voter, chosen);
  assert.deepEqual(
    state.contestants.map((person) => person.aggregations.score),
    scores,
  );
  const winner = state.contestants.find((person) => person.id === ep.mvp!.winnerId)!;
  assert.equal(
    winner.aggregations.mvp,
    before.contestants.find((person) => person.id === winner.id)!.aggregations.mvp + 1,
  );
  assert.equal(winner.events.at(-1), 'BOOTCAMP_MVP');
  assert.throws(() => closeBootcampAudience(state, createSeededRandom(71).next), /already closed/);
  assert.throws(() => chooseBootcampMvp(state, createSeededRandom(72).next), /already been chosen/);
});

test('incomplete Boot Camp evidence and invalid footage fail before audience draws', () => {
  const incomplete = audienceFixture();
  incomplete.runtime!.bootcamp!.evaluations.pop();
  const never = () => {
    throw new Error('Unexpected random draw');
  };
  assert.throws(() => closeBootcampAudience(incomplete, never), /all challenges/);
  const invalid = audienceFixture();
  invalid.runtime!.bootcamp!.exposure[invalid.runtime!.bootcamp!.participantIds[0]] = 1;
  assert.throws(() => closeBootcampAudience(invalid, never), /two to four/);
});

test('real charming failures and sincere apologies improve public reception without improving technical grades', () => {
  const baseline = audienceFixture();
  const ep = baseline.runtime!.bootcamp!;
  const id = ep.participantIds[3];
  for (const evaluation of ep.evaluations.filter((record) => record.contestantId === id))
    evaluation.finalScore = 0;
  const close = (kinds: string[]) => {
    const state = structuredClone(baseline);
    const record = state.runtime!.bootcamp!.evaluations.find((entry) => entry.contestantId === id)!;
    record.events = kinds.map((kind) => ({
      kind,
      narrative: `Recorded ${kind}.`,
      contestantIds: [id, ep.participantIds[4]],
      scoreDelta: 0,
      spotlight: 0,
      relationships: [],
    }));
    closeBootcampAudience(state, createSeededRandom(413).next);
    return state;
  };
  const neutral = close([]);
  const embarrassed = close(['safe-failed-flip']);
  const charming = close(['safe-failed-flip', 'charming-recovery']);
  const apology = close(['flinch', 'sincere-apology']);
  assert.equal(embarrassed.runtime!.bootcamp!.audience!.receptions[id], 13);
  assert.equal(charming.runtime!.bootcamp!.audience!.receptions[id], 18);
  assert.equal(apology.runtime!.bootcamp!.audience!.receptions[id], 18);
  for (const state of [embarrassed, charming, apology]) {
    const person = state.contestants.find((entry) => entry.id === id)!;
    const original = neutral.contestants.find((entry) => entry.id === id)!;
    assert.equal(person.grade, 'F');
    assert.equal(person.missionRating, original.missionRating);
    assert.deepEqual(
      state.runtime!.bootcamp!.evaluations.map((entry) => entry.finalScore),
      neutral.runtime!.bootcamp!.evaluations.map((entry) => entry.finalScore),
    );
    const mentioned = ep.participantIds[4];
    assert.equal(
      state.runtime!.bootcamp!.audience!.receptions[mentioned],
      69,
      'mentioning a teammate does not give them the event owner’s edit',
    );
  }
  const hero = close(['underdog', 'gentle-support', 'trainer-awe', 'charismatic-edge']);
  assert.equal(hero.runtime!.bootcamp!.audience!.receptions[id], 26, 'positive edit is capped at ten');
  assert.ok(
    charming.contestants.find((entry) => entry.id === id)!.aggregations.audienceRatio >
      neutral.contestants.find((entry) => entry.id === id)!.aggregations.audienceRatio,
    'the edit reaches actual audience appeal and popularity',
  );
});

test('closed score ties use deterministic composite evidence, not old ranks', () => {
  const state = audienceFixture();
  const ep = state.runtime!.bootcamp!;
  state.runtime!.show = { audience: 0, general: 0, fans: {}, satisfaction: 50, pendingAttrition: 0 };
  ep.winners = Array(4).fill(ep.participantIds[0]);
  for (const person of state.contestants) {
    person.aggregations.score = 0;
    person.aggregations.productionRatio = 0;
  }
  const first = ep.participantIds[1];
  const second = ep.participantIds[2];
  const firstFinal = ep.evaluations.find((entry) => entry.contestantId === first && entry.round === 4)!;
  const secondFinal = ep.evaluations.find((entry) => entry.contestantId === second && entry.round === 4)!;
  firstFinal.tieBreakKey = 0.9;
  secondFinal.tieBreakKey = 0.1;
  closeBootcampAudience(state, () => {
    throw new Error('Zero viewers do not need a draw');
  });
  assert.equal(ep.rankedIds[0], ep.participantIds[0], 'each recorded win earns its bonus');
  assert.ok(ep.rankedIds.indexOf(second) < ep.rankedIds.indexOf(first));
  assert.ok(Object.values(ep.audience!.votes).every((votes) => votes === 0));
});

test('completed runtime-3 battle saves without Boot Camp remain valid', () => {
  assert.deepEqual(decodeSimulationState(JSON.stringify(previous)), JSON.parse(JSON.stringify(previous)));
  const fakePhase = structuredClone(previous);
  fakePhase.runtime!.phase = 'bootcamp';
  assert.throws(() => decodeSimulationState(JSON.stringify(fakePhase)), /Episode 3/);
});

test('Boot Camp reloads every beat against untouched historical battle evidence', () => {
  let state = structuredClone(previous);
  const archive = JSON.stringify(state.runtime!.battle);
  for (let turn = 0; turn < 120 && state.runtime?.bootcamp?.phase !== 'complete'; turn++) {
    const ep = state.runtime!.bootcamp;
    const prep = state.runtime!.preparations?.[3];
    const revision = ep?.revision ?? prep?.revision ?? 0;
    let action: Parameters<typeof transitionBootcamp>[1] = { type: 'advance' };
    if (!ep && !prep) action = { type: 'start' };
    else if (!ep && prep) {
      action = prep.requiredSelections
        ? { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) }
        : {
            type: 'mood',
            choices: Object.fromEntries(
              Object.entries(prep.moodOptions).map(([field, options]) => [field, options[0]]),
            ) as MoodChoices,
          };
    }
    const next = transitionBootcamp(state, action, revision);
    assert.equal(transitionBootcamp(next, action, revision), next, 'duplicate actions are inert');
    if (next.runtime!.bootcamp?.phase === 'credits' && ep?.phase !== 'credits') {
      for (const id of next.runtime!.openingCast!) {
        const prior = state.contestants.find((person) => person.id === id)!;
        const current = next.contestants.find((person) => person.id === id)!;
        assert.equal(
          current.aggregations.audienceRatio,
          Math.min(1, prior.aggregations.audienceRatio + 0.02),
        );
        const priorCount = ep!.changes[id]?.length ?? 0;
        const added: BootcampEpisode['changes'][string] = next
          .runtime!.bootcamp.changes[id].slice(priorCount)
          .filter((change) => change.path === 'aggregations.audienceRatio');
        assert.equal(
          added.length,
          prior.aggregations.audienceRatio < 1 ? 1 : 0,
          'opening popularity is captured exactly once',
        );
      }
    }
    const serialized = JSON.stringify(next);
    state = decodeSimulationState(serialized);
    assert.deepEqual(
      state,
      JSON.parse(serialized),
      `reloaded ${state.runtime!.bootcamp?.phase ?? 'preparation'}`,
    );
    assert.equal(JSON.stringify(state.runtime!.battle), archive);
  }
  const ep = state.runtime!.bootcamp!;
  assert.equal(ep.phase, 'complete');
  assert.equal(ep.rankRevealed, true);
  assert.equal(state.contestants.filter((person) => person.status === 'ACTIVE').length, 18);
  for (const [index, id] of ep.rankedIds.entries())
    assert.equal(state.contestants.find((person) => person.id === id)!.rank, index + 1);
  const invalid = JSON.parse(JSON.stringify(state));
  invalid.runtime.bootcamp.startingContestants[0].aggregations = {};
  assert.throws(() => decodeSimulationState(JSON.stringify(invalid)), /starting cast/);
});

test('failed Boot Camp storage writes do not publish state or consume the saved random stream', () => {
  const published = simulationStore.state;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const state = structuredClone(previous);
  const before = JSON.stringify(state);
  let writes = 0;
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          setItem() {
            writes++;
            assert.equal(simulationStore.state, state, 'persistence precedes publication');
            throw new Error('storage unavailable');
          },
        },
      },
    });
    simulationStore.setState(() => state);
    assert.throws(() => simulationActions.dispatchBootcamp({ type: 'start' }, 0), /storage unavailable/);
    assert.equal(writes, 1);
    assert.equal(simulationStore.state, state);
    assert.equal(JSON.stringify(simulationStore.state), before);
  } finally {
    simulationStore.setState(() => published);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
