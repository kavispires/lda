import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuditionPreferences, AuditionSong } from '../types/audition';
import type { Contestant } from '../types/contestant';
import { getAuditionSongs } from '../utilities/audition-songs';
import { createContestant } from '../utilities/contestant-factory';
import { chooseAuditionSongs, resolveLiveAudition, selectAuditionPool } from './audition-live';
import { scoreAudition } from './audition-scoring';
import { createSeededRandom } from './random';

const preferences: AuditionPreferences = {
  visualOrUniqueness: 'visual',
  potentialOrCharisma: 'potential',
};

function contestant(id: string, level = 3): Contestant {
  const result = createContestant({ id, name: id, updatedAt: 1 });
  for (const skill of Object.keys(result.coreSkills) as (keyof Contestant['coreSkills'])[]) {
    result.coreSkills[skill] = level;
  }
  for (const skill of Object.keys(result.utilitySkills) as (keyof Contestant['utilitySkills'])[]) {
    result.utilitySkills[skill] = level;
  }
  return result;
}

function song(): AuditionSong {
  const selected = getAuditionSongs().find(
    (entry) => entry.track === 'VOCAL' && entry.part.testedSkills[0].requiredLevel === 3,
  );
  assert.ok(selected);
  return selected;
}

function draws(values: number[]) {
  let calls = 0;
  return {
    next: () => {
      assert.ok(calls < values.length, 'Unexpected random draw (future auditions must not be rolled).');
      return values[calls++];
    },
    calls: () => calls,
  };
}

function liveInput(contestants = [contestant('performer', 5), contestant('observer', 1)]) {
  const selected = song();
  return {
    contestants,
    pool: [selected],
    songChoices: Object.fromEntries(contestants.map(({ id }) => [id, selected.id])),
    performerId: 'performer',
    previousEvaluations: [],
    preferences,
    composure: {},
    random: createSeededRandom(5).next,
    relationshipPolicy: 'reactions-only' as const,
  };
}

test('pool samples exactly one song per track/bucket reproducibly without mutating catalog', () => {
  const catalog = getAuditionSongs();
  const snapshot = structuredClone(catalog);
  const first = selectAuditionPool(catalog, createSeededRandom(11).next);
  assert.deepEqual(first, selectAuditionPool(catalog, createSeededRandom(11).next));
  assert.equal(first.length, 9);
  assert.equal(new Set(first.map(({ id }) => id)).size, 9);
  for (const track of ['VOCAL', 'RAP', 'DANCE']) {
    const levels = first
      .filter((entry) => entry.track === track)
      .map((entry) => entry.part.testedSkills[0].requiredLevel);
    assert.ok(levels[0] <= 2);
    assert.equal(levels[1], 3);
    assert.ok(levels[2] >= 4);
  }
  assert.deepEqual(catalog, snapshot);
});

test('pool coverage fails explicitly before consuming randomness for every missing bucket', () => {
  const catalog = getAuditionSongs();
  for (const track of ['VOCAL', 'RAP', 'DANCE']) {
    for (const [bucket, includes] of [
      ['approachable', (level: number) => level <= 2],
      ['intermediate', (level: number) => level === 3],
      ['demanding', (level: number) => level >= 4],
    ] as const) {
      const incomplete = catalog.filter(
        (entry) => entry.track !== track || !includes(entry.part.testedSkills[0].requiredLevel),
      );
      assert.throws(
        () => selectAuditionPool(incomplete, () => assert.fail('Must validate coverage first')),
        new RegExp(`${track} ${bucket}`),
      );
    }
  }
});

test('locked choices are seeded, shared songs are allowed, and source cast/pool remain unchanged', () => {
  const cast = Array.from({ length: 20 }, (_, index) => contestant(`c${index}`));
  const pool = selectAuditionPool(getAuditionSongs(), createSeededRandom(9).next);
  const before = structuredClone({ cast, pool });
  const choices = chooseAuditionSongs(cast, pool, createSeededRandom(17).next);
  assert.deepEqual(choices, chooseAuditionSongs(cast, pool, createSeededRandom(17).next));
  assert.equal(Object.keys(choices).length, 20);
  assert.ok(new Set(Object.values(choices)).size < 20);
  assert.deepEqual({ cast, pool }, before);
});

test('every protective trait vetoes off-track risk even with both reckless traits', () => {
  const pool = getAuditionSongs();
  for (const trait of ['investment', 'maturity', 'discipline'] as const) {
    const person = contestant('veto');
    person.personality.discipline = -10;
    person.personality.curiosity = 10;
    person.personality[trait] = 7;
    const choice = chooseAuditionSongs([person], pool, () => 0)[person.id];
    assert.equal(pool.find(({ id }) => id === choice)?.track, 'VOCAL');
  }
  assert.throws(() => chooseAuditionSongs([contestant('a')], [song()], () => 0), /missing track RAP/);
});

test('25% risk requires both traits; capability weights alternate tracks', () => {
  const pool = getAuditionSongs();
  for (const [discipline, curiosity, offTrack] of [
    [-7, 7, true],
    [-6, 7, false],
    [-7, 6, false],
  ] as const) {
    const person = contestant('risk');
    person.personality.discipline = discipline;
    person.personality.curiosity = curiosity;
    const choice = chooseAuditionSongs([person], pool, () => 0.15)[person.id];
    assert.equal(pool.find(({ id }) => id === choice)?.track !== person.track, offTrack);
  }
  const person = contestant('capability');
  person.coreSkills.rap = 1;
  person.coreSkills.dance = 5;
  const random = draws([0, 0.3, 0]);
  const choice = chooseAuditionSongs([person], pool, random.next)[person.id];
  assert.equal(pool.find(({ id }) => id === choice)?.track, 'DANCE');
});

test('song weights include genre and all ordered tested skills, not merely the primary', () => {
  const person = contestant('fit');
  person.personality.investment = 7;
  person.coreSkills.dance = 1;
  const base = song();
  const candidates: AuditionSong[] = [
    {
      ...base,
      id: 'bad',
      part: {
        testedSkills: [
          { skill: 'vocals', requiredLevel: 3 },
          { skill: 'dance', requiredLevel: 5 },
        ],
      },
    },
    {
      ...base,
      id: 'good',
      part: {
        testedSkills: [
          { skill: 'vocals', requiredLevel: 3 },
          { skill: 'dance', requiredLevel: 1 },
        ],
      },
    },
    ...getAuditionSongs().filter((entry) => entry.track !== 'VOCAL'),
  ];
  assert.equal(chooseAuditionSongs([person], candidates, () => 0.4).fit, 'good');
  const genreCandidates = [
    { ...base, id: 'no-affinity', genre: 'OTHER' },
    { ...base, id: 'affinity' },
    ...candidates.filter((entry) => entry.track !== 'VOCAL'),
  ];
  person.specialties.genreAffinity = base.genre;
  assert.equal(chooseAuditionSongs([person], genreCandidates, () => 0.4).fit, 'affinity');
});

test('live audition shares one raw pair, persists tie key, consumes composure, and assigns only mission grade', () => {
  const person = contestant('performer');
  person.rank = 42;
  person.aggregations.rankingScore = 321;
  const input = { ...liveInput([person]), composure: { performer: 1 }, random: draws([0, 0.2, 0.7]).next };
  const snapshot = structuredClone({ contestants: input.contestants, composure: input.composure });
  const result = resolveLiveAudition(input);
  const ordinary = scoreAudition({
    contestant: person,
    song: song(),
    rawDice: [1, 2],
    preferences,
    tieBreakKey: 0.7,
  });
  assert.deepEqual(result.evaluation.rawDice, [1, 2]);
  assert.equal(result.evaluation.tieBreakKey, 0.7);
  assert.equal(result.evaluation.stagePresence.skillLevel, 4);
  assert.equal(result.evaluation.baseStagePresence, 3);
  assert.equal(result.evaluation.composure, 1);
  assert.deepEqual(result.evaluation.technical, ordinary.technical);
  assert.deepEqual(result.evaluation.impressions, ordinary.impressions);
  assert.equal(result.composure.performer, 0);
  assert.equal(result.contestants[0].grade, result.evaluation.grade);
  assert.equal(
    result.contestants[0].missionRating,
    { A: 5, B: 4, C: 3, D: 2, F: 1 }[result.evaluation.grade],
  );
  assert.equal(result.contestants[0].aggregations.rankingScore, 321);
  assert.equal(result.contestants[0].rank, 42);
  assert.deepEqual(result.contestants[0].changeLog, []);
  assert.deepEqual({ contestants: input.contestants, composure: input.composure }, snapshot);
});

test('strong same-song admiration/jealousy change only the observer relationship in stable order', () => {
  const cast = [contestant('performer', 5), contestant('first', 1), contestant('second', 1)];
  const input = liveInput(cast);
  const before = structuredClone(cast);
  const random = draws([0, 0, 0.5, 0, 0, 0, 0.99]);
  const result = resolveLiveAudition({ ...input, random: random.next });
  assert.deepEqual(
    result.reactions.map(({ observerId, type }) => [observerId, type]),
    [
      ['first', 'admiration'],
      ['second', 'jealousy'],
    ],
  );
  assert.ok(result.reactions.every(({ sameSong, gap }) => sameSong && gap >= 20));
  assert.deepEqual(result.contestants[1].relationships.performer, [53]);
  assert.deepEqual(result.contestants[2].relationships.performer, [47]);
  assert.deepEqual(result.contestants[0].relationships, {});
  assert.deepEqual(cast, before);
  assert.equal(random.calls(), 7);
});

test('relationship histories append only actual changes, clamp bounds, and reject invalid scores', () => {
  const input = liveInput();
  input.contestants[1].relationships.performer = [50, 99];
  const result = resolveLiveAudition({ ...input, random: draws([0, 0, 0, 0, 0]).next });
  assert.deepEqual(result.contestants[1].relationships.performer, [50, 99, 100]);
  input.contestants[1].relationships.performer = [100];
  const capped = resolveLiveAudition({ ...input, random: draws([0, 0, 0, 0, 0]).next });
  assert.deepEqual(capped.reactions, []);
  assert.deepEqual(capped.contestants[1].relationships.performer, [100]);
  for (const invalid of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    input.contestants[1].relationships.performer = [invalid];
    assert.throws(() => resolveLiveAudition(input), /Invalid audition relationship score/);
  }
});

test('inspiration/confidence raise and intimidation lowers upcoming composure without changing skills', () => {
  for (const [typeDraw, expected, type] of [
    [0.3, 1, 'inspiration'],
    [0.6, -1, 'intimidation'],
  ] as const) {
    const input = liveInput();
    const before = structuredClone(input.contestants);
    const result = resolveLiveAudition({ ...input, random: draws([0, 0, 0, 0, typeDraw]).next });
    assert.equal(result.composure.observer, expected);
    assert.equal(result.reactions[0].type, type);
    assert.equal(result.reactions[0].relationshipBefore, result.reactions[0].relationshipAfter);
    assert.deepEqual(result.contestants[1], before[1]);
    const performed = resolveLiveAudition({
      ...input,
      contestants: result.contestants,
      performerId: 'observer',
      previousEvaluations: [result.evaluation],
      composure: result.composure,
      random: () => 0.99,
    });
    assert.equal(performed.evaluation.composure, expected);
    assert.equal(performed.composure.observer, 0);
    assert.deepEqual(performed.contestants[1].coreSkills, before[1].coreSkills);
  }
  const input = liveInput([contestant('performer', 1), contestant('observer', 5)]);
  const confidence = resolveLiveAudition({ ...input, random: draws([0, 0, 0, 0, 0]).next });
  assert.equal(confidence.reactions[0].type, 'confidence');
  assert.equal(confidence.composure.observer, 1);
  const sympathy = resolveLiveAudition({ ...input, random: draws([0, 0, 0, 0, 0.99]).next });
  assert.equal(sympathy.reactions[0].type, 'sympathy');
  assert.deepEqual(sympathy.contestants[1].relationships.performer, [53]);
});

test('composure accumulates opposing effects and clamps without narrating zero mutations', () => {
  const input = liveInput();
  const result = resolveLiveAudition({
    ...input,
    composure: { observer: 1 },
    random: draws([0, 0, 0, 0, 0.6]).next,
  });
  assert.equal(result.composure.observer, 0);
  const clamped = resolveLiveAudition({
    ...input,
    composure: { observer: 1 },
    random: draws([0, 0, 0, 0, 0.3]).next,
  });
  assert.equal(clamped.composure.observer, 1);
  assert.deepEqual(clamped.reactions, []);
});

test('past observers use actual past performance without retroactive composure or source mutation', () => {
  const input = liveInput();
  const previous = scoreAudition({
    contestant: input.contestants[1],
    song: song(),
    preferences,
    rawDice: [6, 6],
    tieBreakKey: 0.4,
  });
  const snapshot = structuredClone(previous);
  const result = resolveLiveAudition({
    ...input,
    previousEvaluations: [previous],
    random: draws([0, 0, 0, 0, 0.99]).next,
  });
  assert.equal(result.reactions[0].type, 'sympathy');
  assert.equal(result.reactions[0].composureAfter, 0);
  assert.equal(result.composure.observer, undefined);
  assert.deepEqual(previous, snapshot);
  assert.throws(
    () => resolveLiveAudition({ ...input, performerId: 'observer', previousEvaluations: [previous] }),
    /already auditioned/,
  );
});

test('expectations consume no future dice and ineligible gaps consume no reaction randomness', () => {
  const eligible = draws([0, 0, 0.2, 0.99]);
  assert.deepEqual(resolveLiveAudition({ ...liveInput(), random: eligible.next }).reactions, []);
  assert.equal(eligible.calls(), 4);
  const ineligible = draws([0, 0, 0.2]);
  const result = resolveLiveAudition({
    ...liveInput([contestant('performer', 5), contestant('observer', 5)]),
    random: ineligible.next,
  });
  assert.deepEqual(result.reactions, []);
  assert.equal(ineligible.calls(), 3);
});

test('ordinary reactions use the larger gap, lower chance, and one-point directional change', () => {
  const input = liveInput();
  const otherSong = { ...song(), id: 'other-song' };
  const ordinary = {
    ...input,
    pool: [song(), otherSong],
    songChoices: { performer: song().id, observer: otherSong.id },
  };
  const rejected = resolveLiveAudition({ ...ordinary, random: draws([0, 0, 0, 0.2]).next });
  assert.deepEqual(rejected.reactions, []);
  const accepted = resolveLiveAudition({ ...ordinary, random: draws([0, 0, 0, 0.1, 0]).next });
  assert.equal(accepted.reactions[0].sameSong, false);
  assert.deepEqual(accepted.contestants[1].relationships.performer, [51]);
});

test('live input rejects malformed composure and missing performers/locked songs', () => {
  for (const value of [-2, 2, 0.1, Number.NaN]) {
    assert.throws(
      () => resolveLiveAudition({ ...liveInput(), composure: { observer: value } }),
      /composure.*integer/,
    );
  }
  assert.throws(
    () => resolveLiveAudition({ ...liveInput(), performerId: 'missing' }),
    /Unknown audition performer/,
  );
  assert.throws(
    () => resolveLiveAudition({ ...liveInput(), songChoices: {} }),
    /Missing locked audition song/,
  );
});

test('every observer forms a quiet opinion, including past performers, without extra narrated reactions', () => {
  const cast = [contestant('performer', 5), contestant('upcoming', 5), contestant('past', 5)];
  for (const observer of cast.slice(1)) observer.relationships.performer = [50];
  const previous = scoreAudition({
    contestant: cast[2],
    song: song(),
    preferences,
    rawDice: [1, 1],
    tieBreakKey: 0.4,
  });
  const before = structuredClone(cast);
  const random = draws([0, 0, 0.2, 0, 0.99]);
  const result = resolveLiveAudition({
    ...liveInput(cast),
    relationshipPolicy: 'everyone-forms-opinions',
    previousEvaluations: [previous],
    random: random.next,
  });
  assert.deepEqual(result.reactions, []);
  assert.deepEqual(result.contestants[1].relationships.performer, [50, 49]);
  assert.deepEqual(result.contestants[2].relationships.performer, [50, 51]);
  assert.equal(result.composure.upcoming, undefined);
  assert.equal(result.composure.past, undefined);
  assert.deepEqual(cast, before);
  assert.equal(random.calls(), 5);
});

test('notable opinions replace the quiet impression with three points, or five for a strong same-song reaction', () => {
  const input = liveInput();
  input.contestants[1].relationships.performer = [50];
  const otherSong = { ...song(), id: 'other-song' };
  for (const [sameSong, typeDraw, expected, type] of [
    [false, 0, 53, 'admiration'],
    [false, 0.99, 47, 'jealousy'],
    [true, 0, 55, 'admiration'],
    [true, 0.6, 45, 'intimidation'],
    [true, 0.99, 45, 'jealousy'],
  ] as const) {
    const result = resolveLiveAudition({
      ...input,
      relationshipPolicy: 'everyone-forms-opinions',
      pool: [song(), otherSong],
      songChoices: { performer: song().id, observer: sameSong ? song().id : otherSong.id },
      random: draws([0, 0, 0.2, typeDraw, 0]).next,
    });

    assert.deepEqual(result.contestants[1].relationships.performer, [50, expected]);
    assert.equal(result.reactions.length, 1);
    assert.equal(result.reactions[0].type, type);
    assert.equal(result.reactions[0].relationshipBefore, 50);
    assert.equal(result.reactions[0].relationshipAfter, expected);
  }
});

test('a weaker audition can create either a critical confident opinion or a sympathetic opinion', () => {
  const input = liveInput([contestant('performer', 1), contestant('observer', 5)]);
  input.contestants[1].relationships.performer = [50];
  for (const [typeDraw, type, after, composure] of [
    [0, 'confidence', 45, 1],
    [0.99, 'sympathy', 55, 0],
  ] as const) {
    const result = resolveLiveAudition({
      ...input,
      relationshipPolicy: 'everyone-forms-opinions',
      random: draws([0, 0, 0.2, typeDraw, 0]).next,
    });
    assert.equal(result.reactions[0].type, type);
    assert.deepEqual(result.contestants[1].relationships.performer, [50, after]);
    assert.equal(result.composure.observer ?? 0, composure);
  }
});

test('quiet inspiration does not change composure, but a notable inspiration changes both liking and readiness', () => {
  const input = liveInput();
  const quiet = resolveLiveAudition({
    ...input,
    relationshipPolicy: 'everyone-forms-opinions',
    random: draws([0, 0, 0.2, 0.3, 0.99]).next,
  });
  assert.deepEqual(quiet.contestants[1].relationships.performer, [51]);
  assert.equal(quiet.composure.observer, undefined);
  assert.deepEqual(quiet.reactions, []);
  const notable = resolveLiveAudition({
    ...input,
    relationshipPolicy: 'everyone-forms-opinions',
    random: draws([0, 0, 0.2, 0.3, 0]).next,
  });
  assert.deepEqual(notable.contestants[1].relationships.performer, [55]);
  assert.equal(notable.reactions[0].type, 'inspiration');
  assert.equal(notable.composure.observer, 1);
});
