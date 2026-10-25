import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContestant } from '../utilities/contestant-factory';
import { getTrackSpecialSongs, validateTrackSpecialSongs } from '../utilities/track-special-songs';
import { battleRelationship } from './battle-scoring';
import { createSeededRandom } from './random';
import { consolidateTrackRooms, transitionTrackSpecials } from './track-specials-episode';
import { advanceTracksTo, completedPhotoshootForTracks, nextTrackAction } from './track-specials-fixtures';
import {
  electTrackRole,
  optimalTrackGroups,
  trackGroupingTieKeys,
  trackGroupSizes,
} from './track-specials-grouping';
import {
  castTrackAwards,
  trackAwardEffects,
  trackJurorProfile,
  trackJuryPreference,
} from './track-specials-jury';
import { preserveTrackCondition, trackRevealReaction, trackSpecialScore } from './track-specials-scoring';
import { assertTrackSpecialsEpisode, validateTrackSpecials } from './track-specials-validation';

test('track catalog has distinct exact-size arrangements and rejects malformed songs', () => {
  const songs = getTrackSpecialSongs();
  for (const track of ['VOCAL', 'RAP', 'DANCE'])
    assert.ok(songs.filter((song) => song.track === track).length >= 4);
  const malformed = structuredClone(songs);
  malformed[0].arrangements['2'].push({ ...malformed[0].arrangements['2'][0] });
  assert.throws(() => validateTrackSpecialSongs(malformed), /Invalid Track Specials/);
  const duplicate = structuredClone(songs);
  duplicate[1].id = duplicate[0].id;
  assert.throws(() => validateTrackSpecialSongs(duplicate), /Invalid Track Specials/);
  assert.throws(() => validateTrackSpecialSongs(songs.slice(1)), /Invalid Track Specials/);
  assert.deepEqual(getTrackSpecialSongs(), songs);
});

test('all track populations use legal minimum-count partitions and exact affinity defeats greedy pairing', () => {
  const random = createSeededRandom(6);
  for (let count = 0; count <= 16; count++) {
    const ids = Array.from({ length: count }, (_, index) => `p${index}`);
    const relationships = Object.fromEntries(
      ids.map((id) => [id, Object.fromEntries(ids.map((other) => [other, 50]))]),
    );
    const keys = trackGroupingTieKeys(ids, random.next);
    const result = optimalTrackGroups(ids, relationships, keys);
    assert.deepEqual(result.groups.flat().sort(), ids.sort());
    assert.deepEqual(result.groups.map((group) => group.length).sort(), trackGroupSizes(count).sort());
    assert.deepEqual(result, optimalTrackGroups(ids, relationships, keys));
  }
  assert.deepEqual(trackGroupSizes(5), [3, 2]);
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const relationships = Object.fromEntries(
    ids.map((id) => [id, Object.fromEntries(ids.map((other) => [other, 0]))]),
  );
  for (const group of [
    ['a', 'c', 'e'],
    ['b', 'd', 'f'],
  ])
    for (const id of group) for (const other of group) if (id !== other) relationships[id][other] = 90;
  relationships.a.b = 100;
  relationships.b.a = 100;
  const result = optimalTrackGroups(ids, relationships, trackGroupingTieKeys(ids, random.next));
  assert.deepEqual(result.groups, [
    ['a', 'c', 'e'],
    ['b', 'd', 'f'],
  ]);
  assert.equal(result.affinity, 540);
});

test('dorm consolidation preserves all possible roommate blocks, handles unavoidable splits, and fills 6/6/4', () => {
  const ids = Array.from({ length: 16 }, (_, index) => `p${index}`);
  const old = [5, 5, 5, 1].map((size, index, sizes) => ({
    id: `room${index}`,
    memberIds: ids.slice(
      sizes.slice(0, index).reduce((a, b) => a + b, 0),
      sizes.slice(0, index + 1).reduce((a, b) => a + b, 0),
    ),
  }));
  const rooms = consolidateTrackRooms(old, ids);
  assert.deepEqual(
    rooms.rooms.map((room) => room.memberIds.length),
    [6, 6, 4],
  );
  assert.equal(new Set(rooms.rooms.flatMap((room) => room.memberIds)).size, 16);
  assert.deepEqual(
    old.map((room) => room.memberIds.length),
    [5, 5, 5, 1],
  );
  const preserved = old.filter((block) =>
    rooms.rooms.some((room) => block.memberIds.every((id) => room.memberIds.includes(id))),
  );
  assert.ok(preserved.length >= 3);
});

test('re-lodging applies strict extroversion thresholds once, leaving exact boundaries neutral', async () => {
  const initial = await completedPhotoshootForTracks();
  const survivors = initial.contestants.filter((person) => person.status === 'ACTIVE');
  const traits = [-6, -5, 0, 5, 6];
  survivors.forEach((person, index) => {
    person.personality.extroversion = traits[index % traits.length];
    person.aggregations.happiness = 50;
  });
  const state = advanceTracksTo(initial, 're-lodging');
  for (const before of survivors) {
    const after = state.contestants.find((person) => person.id === before.id);
    assert.ok(after);
    assert.equal(
      after.aggregations.happiness,
      before.personality.extroversion > 5 ? 53 : before.personality.extroversion < -5 ? 47 : 50,
    );
  }
  const { action, revision } = nextTrackAction(state);
  const advanced = transitionTrackSpecials(state, action, revision);
  assert.equal(advanced.runtime?.trackSpecials?.phase, 'credits');
  for (const before of state.contestants) {
    const after = advanced.contestants.find((person) => person.id === before.id);
    assert.ok(after);
    assert.equal(after.aggregations.happiness, before.aggregations.happiness);
  }
});

test('juror objective precedence, pure relationship bias, protected stress and independent reunion are explicit', () => {
  const person = createContestant({ id: 'traits', name: 'Traits' });
  Object.keys(person.personality).forEach((key) => {
    person.personality[key as keyof typeof person.personality] = 0;
  });
  person.personality.ambition = 9;
  person.personality.sensitivity = 9;
  person.personality.sincerity = 5;
  assert.equal(trackJurorProfile(person.personality), 'objective');
  person.personality.sincerity = 0;
  assert.equal(trackJurorProfile(person.personality), 'biased');
  const biased = {
    contestantId: person.id,
    profile: trackJurorProfile(person.personality),
    traits: person.personality,
    relationships: {},
    departure: { rank: 20, status: person.status, events: [] },
  };
  assert.equal(trackJuryPreference(biased, 99, 12), 12);
  person.personality.extroversion = 5;
  person.aggregations.happiness = 50;
  assert.equal(trackRevealReaction(person).readiness, 0);
  assert.equal(trackRevealReaction(person).happinessAfter, 53);
  person.personality.ambition = 0;
  person.condition = 'INJURED';
  assert.equal(trackRevealReaction(person).readiness, -5);
  assert.equal(trackRevealReaction(person).happinessAfter, 48);
  assert.equal(trackRevealReaction(person).conditionAfter, 'INJURED');
  assert.equal(preserveTrackCondition('DEPRESSED', 'STRESSED'), 'DEPRESSED');
  assert.equal(preserveTrackCondition('RECOVERING', 'DEPRESSED'), 'RECOVERING');
});

test('center elections favor outgoing affection even when the preferred candidate has weaker ability; solos appoint', () => {
  const members = ['a', 'b'].map((id) => createContestant({ id, name: id }));
  members[0].coreSkills.vocals = 1;
  members[0].coreSkills.stagePresence = 1;
  members[1].coreSkills.vocals = 5;
  members[1].coreSkills.stagePresence = 5;
  for (const member of members) {
    member.track = 'VOCAL';
    member.relationships.a = [100];
    member.relationships.b = [0];
  }
  const election = electTrackRole(members, 'center', { a: 0.2, b: 0.1 });
  assert.equal(election.winnerId, 'a');
  assert.deepEqual(election.ballots, { a: 'a', b: 'a' });
  const solo = electTrackRole([members[0]], 'leader', { a: 0.5 });
  assert.equal(solo.appointed, true);
  assert.deepEqual(solo.ballots, {});
});

test('native Episode 6 completes all eight sequences with strict immutable current-beat records and sealed outcomes', async () => {
  const initial = await completedPhotoshootForTracks();
  const original = JSON.stringify(initial);
  let state = initial;
  let replay = structuredClone(initial);
  let performed = 0;
  for (let step = 0; step < 160 && state.runtime!.trackSpecials?.phase !== 'complete'; step++) {
    const { action, revision } = nextTrackAction(state);
    const before = state;
    state = transitionTrackSpecials(state, action, revision);
    replay = JSON.parse(JSON.stringify(transitionTrackSpecials(replay, action, revision)));
    assert.deepEqual(JSON.parse(JSON.stringify(state)), replay);
    assert.strictEqual(transitionTrackSpecials(state, action, revision), state);
    const ep = state.runtime!.trackSpecials;
    if (!ep) continue;
    validateTrackSpecials(state);
    assert.ok(ep.performances.length - performed <= 1);
    performed = ep.performances.length;
    if (!ep.juryRevealed) {
      assert.equal(ep.performances.length, 0);
      assert.doesNotMatch(ep.scenes.flatMap((scene) => scene.paragraphs).join(' '), /jury|thirty-four/i);
    }
    if (!ep.rankRevealed)
      for (const id of ep.participantIds) {
        assert.equal(
          state.contestants.find((person) => person.id === id)!.rank,
          initial.contestants.find((person) => person.id === id)!.rank,
        );
        assert.equal(
          state.contestants.find((person) => person.id === id)!.aggregations.rankingScore,
          initial.contestants.find((person) => person.id === id)!.aggregations.rankingScore,
        );
      }
    assert.equal(JSON.stringify(initial), original);
    if (before.runtime!.trackSpecials)
      assert.throws(() => transitionTrackSpecials(state, { type: 'advance' }, 99999), /stale|complete/);
  }
  const ep = state.runtime!.trackSpecials!;
  assert.equal(ep.phase, 'complete');
  assert.deepEqual([...new Set(ep.scenes.map((scene) => scene.sequence))], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(ep.juryIds.length, 34);
  assert.ok(ep.juryIds.includes(state.runtime!.megaGroups!.withdrawnId!));
  assert.equal(ep.performances.flatMap((performance) => performance.evaluations).length, 16);
  assert.ok(ep.teams.every((team) => team.practice.length === 2));
  assert.equal(ep.survivorIds.length, 15);
  assert.equal(ep.eliminatedId, ep.rankedIds[15]);
  for (const award of ep.awards)
    if (award.status === 'contested') {
      assert.equal(Object.keys(award.ballots).length, 34);
      assert.equal(
        Object.values(award.bestTotals).reduce((a, b) => a + b),
        34,
      );
      assert.equal(
        Object.values(award.worstTotals).reduce((a, b) => a + b),
        34,
      );
      assert.ok(Object.values(award.ballots).every((ballot) => ballot.bestId !== ballot.worstId));
    }
  for (const juror of ep.juryIds) {
    const after = state.contestants.find((person) => person.id === juror)!;
    const before = initial.contestants.find((person) => person.id === juror)!;
    assert.equal(after.status, before.status);
    assert.equal(after.rank, before.rank);
    assert.equal(after.aggregations.experience, before.aggregations.experience);
    assert.equal(after.aggregations.rankingScore, before.aggregations.rankingScore);
  }
  for (const id of ep.participantIds) {
    const before = initial.contestants.find((person) => person.id === id)!;
    const after = state.contestants.find((person) => person.id === id)!;
    assert.equal(after.aggregations.experience, before.aggregations.experience + 5);
    assert.equal(after.aggregations.practice, before.aggregations.practice);
  }
  const corrupted = structuredClone(ep);
  corrupted.performances[0].evaluations[0].rawScore += 0.1;
  assert.throws(
    () => assertTrackSpecialsEpisode(corrupted, state.contestants, state.runtime!.definitions),
    /performance/,
  );
  const ballots = structuredClone(ep);
  const award = ballots.awards.find((entry) => entry.status === 'contested')!;
  award.ballots[ep.juryIds[0]].worstId = award.ballots[ep.juryIds[0]].bestId;
  assert.throws(
    () => assertTrackSpecialsEpisode(ballots, state.contestants, state.runtime!.definitions),
    /ballots/,
  );
});

test('raw scoring reuses shared dice and jury effects multiply only final performance; empty/singleton categories omit contradictory ballots', async () => {
  const state = advanceTracksTo(await completedPhotoshootForTracks(), 'awards-worst');
  const ep = state.runtime!.trackSpecials!;
  const team = ep.teams[0];
  const person = structuredClone(ep.startingContestants.find((entry) => entry.id === team.memberIds[0])!);
  person.aggregations.practice = 4;
  const song = state.runtime!.definitions.trackSpecialSongs!.find((entry) => entry.id === team.songId)!;
  const evaluation = trackSpecialScore(person, team, song, [1, 6], -5);
  for (const check of [
    evaluation.trackCheck,
    evaluation.stageCheck,
    evaluation.visualCheck,
    evaluation.uniquenessCheck,
  ])
    assert.equal(check.adjustedDice[1], 6);
  assert.equal(
    evaluation.rawScore,
    Math.max(0, Math.min(100, evaluation.technicalScore + 8 + team.coordination - 5)),
  );
  const copied = structuredClone(ep);
  for (const award of copied.awards) {
    award.bestId = person.id;
    award.worstId = person.id;
    award.category = 'overall';
  }
  const effect = trackAwardEffects(copied)[person.id];
  assert.equal(effect.happiness, -14);
  assert.ok(Math.abs(effect.multiplier - Math.max(0.4, Math.min(2, (1.35 * 0.65) ** 7))) < 1e-12);
  const exceptions = structuredClone(ep);
  exceptions.awards = [];
  const sources = exceptions.startingContestants.filter((entry) =>
    exceptions.participantIds.includes(entry.id),
  );
  for (const award of copied.awards) award.worstId = null;
  assert.equal(trackAwardEffects(copied)[person.id].happiness, 12);
  assert.equal(trackAwardEffects(copied)[person.id].multiplier, 2);
  for (const award of copied.awards) {
    award.bestId = null;
    award.worstId = person.id;
  }
  assert.equal(trackAwardEffects(copied)[person.id].happiness, -16);
  assert.equal(trackAwardEffects(copied)[person.id].multiplier, 0.4);
  sources.forEach((entry) => {
    entry.track = 'VOCAL';
  });
  sources[0].track = 'RAP';
  const awards = castTrackAwards(exceptions, createSeededRandom(8).next);
  const rap = awards.find((award) => award.category === 'rapper')!;
  const dance = awards.find((award) => award.category === 'dancer')!;
  assert.equal(rap.status, 'uncontested');
  assert.equal(rap.bestId, sources[0].id);
  assert.equal(rap.worstId, null);
  assert.deepEqual(rap.ballots, {});
  assert.equal(dance.status, 'not-contested');
  assert.deepEqual(dance.ballots, {});
  const contradictory = structuredClone(ep);
  contradictory.awards = [];
  const [first, second] = [...contradictory.participantIds].sort();
  for (const performance of contradictory.performances)
    for (const evaluation of performance.evaluations) evaluation.rawScore = 50;
  for (const [index, juror] of contradictory.juryProfiles.entries()) {
    juror.profile = 'biased';
    for (const id of contradictory.participantIds)
      juror.relationships[id] =
        id === first ? (index < 17 ? 100 : 0) : id === second ? (index < 17 ? 0 : 100) : 50;
  }
  const overlap = castTrackAwards(contradictory, () => 0).find((award) => award.category === 'overall')!;
  assert.equal(overlap.bestId, first);
  assert.equal(overlap.worstId, first);
  assert.ok(Object.values(overlap.ballots).every((ballot) => ballot.bestId !== ballot.worstId));
  const grouped = advanceTracksTo(await completedPhotoshootForTracks(), 'grouping');
  for (const trackTeam of grouped.runtime!.trackSpecials!.teams)
    for (const id of trackTeam.memberIds) {
      const after = grouped.contestants.find((entry) => entry.id === id)!;
      const before = grouped.runtime!.trackSpecials!.startingContestants.find((entry) => entry.id === id)!;
      for (const other of trackTeam.memberIds)
        if (other !== id)
          assert.equal(
            battleRelationship(after, other),
            Math.min(100, battleRelationship(before, other) + 2),
          );
    }
});
