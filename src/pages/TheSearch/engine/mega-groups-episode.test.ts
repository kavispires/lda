import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MegaGroupsAction, MegaGroupsPhase } from '../types/mega-groups-episode';
import type { SimulationState } from '../types/simulation';
import {
  getMegaGroupsCatalogs,
  validateMegaGroupSongs,
  validateMegaGroupsCatalogs,
  validateMegaGroupTests,
} from '../utilities/mega-groups-catalogs';
import { addBattleJudging, addGroupJudging } from './battle-judging';
import { scoreGroupTeam } from './battle-scoring';
import { advanceBootcampTo, completedBattlesForBootcamp } from './bootcamp-fixtures';
import { transitionMegaGroups } from './mega-groups-episode';
import { assertMegaGroupsEpisode, validateMegaGroups } from './mega-groups-validation';
import { createSeededRandom } from './random';

let baseline: SimulationState | undefined;
function completedBootcamp(): SimulationState {
  baseline ??= advanceBootcampTo(completedBattlesForBootcamp(), 'complete');
  return structuredClone(baseline);
}
function next(state: SimulationState, action?: MegaGroupsAction) {
  const ep = state.runtime!.megaGroups;
  const prep = state.runtime!.preparations?.[4];
  if (ep)
    return transitionMegaGroups(
      state,
      action ??
        (ep.phase === 'intervention'
          ? { type: 'conflict', choice: 'mediate' }
          : ep.phase === 'secret-choice'
            ? { type: 'secret', contestantId: ep.secretCandidates[0] }
            : { type: 'advance' }),
      ep.revision,
    );
  if (!prep) return transitionMegaGroups(state, { type: 'start' }, 0);
  if (!prep.mood)
    return transitionMegaGroups(
      state,
      {
        type: 'mood',
        choices: {
          vocalColor: prep.moodOptions.vocalColor[0],
          danceStyle: prep.moodOptions.danceStyle[0],
          rapStyle: prep.moodOptions.rapStyle[0],
          visualVibe: prep.moodOptions.visualVibe[0],
          leadershipStyle: prep.moodOptions.leadershipStyle[0],
          genreAffinity: prep.moodOptions.genreAffinity[0],
        },
      },
      prep.revision,
    );
  return transitionMegaGroups(
    state,
    { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) },
    prep.revision,
  );
}
function to(state: SimulationState, phase: MegaGroupsPhase) {
  for (let count = 0; count < 110 && state.runtime?.megaGroups?.phase !== phase; count++) state = next(state);
  assert.equal(state.runtime?.megaGroups?.phase, phase);
  return state;
}

test('a lone distressed survivor gets the gentlest visitor, and hand benefits apply only when each answer airs', () => {
  const initial = completedBootcamp();
  const ids = initial.runtime!.bootcamp!.participantIds;
  const distressed = ids[0];
  const helper = ids[1];
  for (const contestant of initial.contestants.filter((entry) => ids.includes(entry.id))) {
    contestant.aggregations.happiness = contestant.id === distressed ? 1 : 50;
    contestant.personality.gentleness = contestant.id === helper ? 10 : 0;
  }
  const rooms = initial.runtime!.battle!.rooms;
  for (const room of rooms) room.memberIds = room.memberIds.filter((id) => id !== distressed);
  rooms.push({ id: 'alone-fixture', memberIds: [distressed] });
  const lone = initial.contestants.find((entry) => entry.id === distressed)!;
  lone.utilitySkills.stamina = 2;
  lone.personality.curiosity = 10;
  lone.personality.ambition = 10;
  const previousDorms = structuredClone(rooms);
  let state = to(initial, 'dorms');
  assert.deepEqual(state.runtime!.battle!.rooms, previousDorms);
  assert.equal(state.runtime!.megaGroups!.comfort.visitor, true);
  assert.equal(state.runtime!.megaGroups!.comfort.comforterId, helper);
  const comforted = state.contestants.find((entry) => entry.id === distressed)!;
  assert.equal(comforted.aggregations.happiness, 6);
  const comfortScene = state.runtime!.megaGroups!.scenes.at(-1)!;
  assert.match(comfortScene.paragraphs.join(' '), /I thought about giving up/);
  assert.match(comfortScene.paragraphs.join(' '), /I will stay and try another day/);
  const comfortChanges = comfortScene.contestantChanges?.[distressed];
  assert.deepEqual(
    comfortChanges?.find((entry) => entry.path === 'aggregations.happiness'),
    { path: 'aggregations.happiness', before: 1, after: 6, cause: 'Mega Groups: comfort after Boot Camp' },
  );
  const corrupt = structuredClone(state.runtime!.megaGroups!);
  corrupt.scenes[0].contestantChanges![distressed][0].path = `relationships.${distressed}`;
  assert.throws(
    () => assertMegaGroupsEpisode(corrupt, state.contestants, state.runtime!.definitions),
    /self relationship/,
  );
  assert.equal(
    comforted.relationships[helper].at(-1),
    Math.min(100, (lone.relationships[helper]?.at(-1) ?? 50) + 10),
  );
  state = to(state, 'briefing');
  assert.deepEqual(state.runtime!.megaGroups!.scenes[0].contestantChanges?.[distressed], comfortChanges);
  assert.ok(
    !state
      .runtime!.megaGroups!.scenes.at(-1)!
      .contestantChanges?.[distressed]?.some((entry) => entry.path === 'aggregations.happiness'),
  );
  const before = structuredClone(state.contestants.find((entry) => entry.id === distressed)!);
  state = next(state);
  const tired = state.contestants.find((entry) => entry.id === distressed)!;
  assert.equal(tired.aggregations.fanbaseRatio, Math.min(1, before.aggregations.fanbaseRatio + 0.01));
  assert.equal(tired.aggregations.audienceRatio, before.aggregations.audienceRatio);
  assert.equal(tired.aggregations.productionRatio, before.aggregations.productionRatio);
  state = next(state);
  assert.equal(
    state.contestants.find((entry) => entry.id === distressed)!.aggregations.audienceRatio,
    Math.min(1, before.aggregations.audienceRatio + 0.01),
  );
  state = next(state);
  assert.equal(
    state.contestants.find((entry) => entry.id === distressed)!.aggregations.productionRatio,
    Math.min(1, before.aggregations.productionRatio + 0.01),
  );
});

test('Mega Groups runs only current beats, preserves announced order, and closes with exactly two departures', () => {
  const first = completedBootcamp();
  const previous = structuredClone(first.runtime!.bootcamp);
  let state = to(first, 'performance');
  const ep = state.runtime!.megaGroups!;
  assert.equal(ep.performances.length, 1);
  assert.equal(ep.teams[0].practice.length, 2);
  assert.equal(ep.teams[1].practice.length, 0);
  assert.equal(ep.jane.length, 0);
  assert.equal(ep.audience, null);
  assert.equal(ep.performances[0].evaluations.length, 9);
  const action = { type: 'advance' } as const;
  const revision = ep.revision;
  const applied = transitionMegaGroups(state, action, revision);
  assert.equal(transitionMegaGroups(applied, action, revision), applied);
  assert.throws(
    () => transitionMegaGroups(applied, { type: 'secret', contestantId: ep.participantIds[0] }, revision),
    /stale/,
  );
  state = to(applied, 'mvp');
  const closed = state.runtime!.megaGroups!;
  assert.equal(closed.performances.length, 4);
  assert.equal(closed.rankRevealed, false);
  assert.equal(Object.keys(closed.mvp!.ballots).length, 18);
  for (const [voter, choice] of Object.entries(closed.mvp!.ballots)) assert.notEqual(voter, choice);
  const lockedRanking = [...closed.rankedIds];
  state = to(state, 'complete');
  const final = state.runtime!.megaGroups!;
  assert.deepEqual(final.rankedIds, lockedRanking);
  assert.equal(final.eliminatedId, lockedRanking[17]);
  assert.equal(final.survivorIds.length, 16);
  assert.deepEqual(
    final.survivorIds,
    lockedRanking.filter((id) => id !== final.eliminatedId && id !== final.withdrawnId),
  );
  assert.deepEqual(final.finalRankedIds.slice(-2), [final.withdrawnId, final.eliminatedId]);
  assert.equal(state.contestants.filter((entry) => entry.status === 'ACTIVE').length, 16);
  assert.equal(state.runtime!.episode, 4);
  assert.equal(state.runtime!.phase, 'episode-complete');
  assert.deepEqual(state.runtime!.bootcamp, previous);
  const roundtrip: unknown = JSON.parse(JSON.stringify(final));
  assertMegaGroupsEpisode(roundtrip, state.contestants, state.runtime!.definitions);
  validateMegaGroups(state);
});

test('blind all-to-one choice allows eighteen arrivals, simultaneous no-self excess ballots and exact transfer penalties', () => {
  const initial = completedBootcamp();
  initial.runtime!.definitions = {
    ...initial.runtime!.definitions,
    ...getMegaGroupsCatalogs(),
    megaGroupTests: [
      {
        id: 'one-side',
        name: 'All choose the same image',
        sides: [
          { name: 'First', image: 'cat.svg', traits: ['ambition', 'gentleness'] },
          { name: 'Second', image: 'dog.svg', traits: ['curiosity', 'sincerity'] },
        ],
      },
    ],
  };
  for (const contestant of initial.contestants.filter((entry) => entry.status === 'ACTIVE')) {
    contestant.personality.ambition = 10;
    contestant.personality.gentleness = 10;
    contestant.personality.curiosity = -10;
    contestant.personality.sincerity = -10;
    contestant.aggregations.happiness = 60;
  }
  let state = to(initial, 'choices');
  while (state.runtime!.megaGroups!.choices.length < 18) state = next(state);
  assert.equal(state.runtime!.megaGroups!.teams[0].memberIds.length, 18);
  assert.equal(state.runtime!.megaGroups!.teams[1].memberIds.length, 0);
  const before = structuredClone(state.contestants);
  state = next(state);
  const ep = state.runtime!.megaGroups!;
  const transfer = ep.transfer!;
  assert.equal(transfer.excess, 9);
  assert.equal(transfer.movedIds.length, 9);
  assert.equal(Object.keys(transfer.ballots).length, 18);
  for (const [voter, ballot] of Object.entries(transfer.ballots)) {
    assert.equal(ballot.length, 9);
    assert.equal(new Set(ballot).size, 9);
    assert.ok(!ballot.includes(voter));
  }
  for (const id of ep.teams[0].initialMemberIds) {
    const source = before.find((entry) => entry.id === id)!;
    const current = state.contestants.find((entry) => entry.id === id)!;
    assert.equal(
      current.aggregations.happiness,
      source.aggregations.happiness - (transfer.movedIds.includes(id) ? 3 : 1),
    );
    if (transfer.movedIds.includes(id))
      for (const stayer of ep.teams[0].memberIds)
        assert.equal(
          current.relationships[stayer].at(-1),
          Math.max(0, (source.relationships[stayer]?.at(-1) ?? 50) - 5),
        );
  }
  assert.deepEqual(
    ep.teams.map((team) => team.memberIds.length),
    [9, 9],
  );
  const corrupt = structuredClone(ep);
  const voter = Object.keys(corrupt.transfer!.ballots)[0];
  corrupt.transfer!.ballots[voter][0] = voter;
  assert.throws(
    () => assertMegaGroupsEpisode(corrupt, state.contestants, state.runtime!.definitions),
    /self transfer/,
  );
});

test('withdrawal checks only the single current unhappiest person, not every unhappy uninvested survivor', () => {
  const base = to(completedBootcamp(), 'elimination');
  const ids = base.runtime!.megaGroups!.survivorIds;
  const ordered = [...ids];
  const invested = ordered[0];
  const uninvested = ordered[1];
  for (const id of ids) {
    const contestant = base.contestants.find((entry) => entry.id === id)!;
    contestant.aggregations.happiness = id === invested ? 1 : id === uninvested ? 2 : 50;
    contestant.personality.investment = id === uninvested ? -10 : 10;
  }
  const fallback = next(base);
  assert.equal(fallback.runtime!.megaGroups!.withdrawnId, ids.at(-1));
  assert.equal(fallback.runtime!.megaGroups!.withdrawalReason, 'lowest-ranked');
  const alternate = structuredClone(base);
  alternate.contestants.find((entry) => entry.id === invested)!.personality.investment = -1;
  const unhappy = next(alternate);
  assert.equal(unhappy.runtime!.megaGroups!.withdrawnId, invested);
  assert.equal(unhappy.runtime!.megaGroups!.withdrawalReason, 'unhappy-uninvested');
});

test('nine-person arithmetic uses nine while the old judge guard still requires five', () => {
  const state = to(completedBootcamp(), 'performance');
  const ep = state.runtime!.megaGroups!;
  const team = ep.teams[0];
  const song = state.runtime!.definitions.megaGroupSongs!.find((entry) => entry.id === team.songIds[0])!;
  const performance = scoreGroupTeam(team, song, state.contestants, 0, createSeededRandom(91).next);
  assert.equal(
    performance.meanScore,
    performance.evaluations.reduce((sum, entry) => sum + entry.finalScore, 0) / 9,
  );
  assert.throws(() => addBattleJudging(performance, state.contestants), /five distinct/);
  assert.ok(addGroupJudging(performance, state.contestants, 9).judging);
});

test('a genuinely strained rehearsal waits for player mediation and never reruns its practice', () => {
  const initial = completedBootcamp();
  const ids = initial.runtime!.bootcamp!.participantIds;
  for (const contestant of initial.contestants.filter((entry) => ids.includes(entry.id)))
    for (const other of ids.filter((id) => id !== contestant.id)) contestant.relationships[other] = [0];
  const waiting = to(initial, 'intervention');
  const ep = waiting.runtime!.megaGroups!;
  assert.equal(ep.performances.length, 0);
  assert.equal(ep.teams[0].practice.length, 2);
  assert.throws(() => next(waiting, { type: 'advance' }), /available Mega Groups action/);
  const choice = { type: 'conflict', choice: 'mediate' } as const;
  const selected = transitionMegaGroups(waiting, choice, ep.revision);
  assert.equal(selected.runtime!.megaGroups!.phase, 'center');
  assert.equal(selected.runtime!.megaGroups!.conflict, null);
  assert.equal(selected.runtime!.megaGroups!.interventions[ep.teams[0].id], 'mediate');
  assert.deepEqual(selected.runtime!.megaGroups!.teams[0].practice, ep.teams[0].practice);
  assert.equal(transitionMegaGroups(selected, choice, ep.revision), selected);
});

test('catalogs and saved evidence reject malformed identities, images, parts and invented future performances', () => {
  const catalog = getMegaGroupsCatalogs();
  const images = structuredClone(catalog.megaGroupTests);
  images[0].sides[0].image = 'https://elsewhere/image.svg';
  assert.throws(() => validateMegaGroupTests(images), /local/);
  const songs = structuredClone(catalog.megaGroupSongs);
  songs[0].parts.pop();
  assert.throws(() => validateMegaGroupSongs(songs), /nine/);
  const state = to(completedBootcamp(), 'performance');
  const ep = state.runtime!.megaGroups!;
  const future = structuredClone(ep);
  future.performances.push(structuredClone(future.performances[0]));
  assert.throws(
    () => assertMegaGroupsEpisode(future, state.contestants, state.runtime!.definitions),
    /premature|order/,
  );
  const dice = structuredClone(ep);
  dice.performances[0].evaluations[0].rawDice = [0, 6];
  assert.throws(
    () => assertMegaGroupsEpisode(dice, state.contestants, state.runtime!.definitions),
    /invalid number/,
  );
});

test('frozen Mega Groups catalogs use saved genre keys without relaxing unknown-genre checks', () => {
  const catalog = getMegaGroupsCatalogs();
  const songs = catalog.megaGroupSongs.map((song) => ({ ...song, genre: 'ARCHIVED_GENRE' }));
  assert.doesNotThrow(() => validateMegaGroupSongs(songs, ['ARCHIVED_GENRE']));
  assert.doesNotThrow(() => validateMegaGroupsCatalogs(catalog.megaGroupTests, songs, ['ARCHIVED_GENRE']));
  assert.throws(() => validateMegaGroupSongs(songs), /Unknown Mega Groups genre/);
  assert.throws(
    () => validateMegaGroupsCatalogs(catalog.megaGroupTests, songs, ['ANOTHER_GENRE']),
    /Unknown Mega Groups genre/,
  );
  assert.throws(() => validateMegaGroupSongs(songs, []), /Unknown Mega Groups genre/);
  assert.throws(() => validateMegaGroupSongs(songs, ['']), /nonempty strings/);
  const state = to(completedBootcamp(), 'performance');
  const definitions = state.runtime!.definitions;
  state.runtime!.definitions = {
    ...definitions,
    specialties: {
      ...definitions.specialties,
      genreAffinity: { ARCHIVED_GENRE: Object.values(definitions.specialties.genreAffinity)[0] },
    },
    megaGroupSongs: definitions.megaGroupSongs!.map((song) => ({ ...song, genre: 'ARCHIVED_GENRE' })),
  };
  assert.doesNotThrow(() => validateMegaGroups(state));
});
