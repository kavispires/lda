import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AuditionEvaluation,
  AuditionLevel,
  AuditionPerformer,
  AuditionPreferences,
  AuditionSong,
  ScoreAuditionInput,
} from '../types/audition';
import { getAuditionSongs, validateAuditionSongs } from '../utilities/audition-songs';
import {
  AUDITION_BATCH_SIZES,
  auditionBiasScoreBoosts,
  auditionGrade,
  auditionMinimumFace,
  compareAuditions,
  drawAuditionTieBreakKey,
  rankAuditions,
  rollAuditionDice,
  scoreAudition,
  startAuditionBatch,
} from './audition-scoring';
import { createSeededRandom } from './random';

function performer(level = 3): AuditionPerformer {
  return {
    id: 'bob',
    coreSkills: {
      vocals: level,
      rap: level,
      dance: level,
      stagePresence: level,
      visual: level,
      uniqueness: level,
      leadership: level,
    },
    utilitySkills: {
      potential: level,
      memory: level,
      stamina: level,
      learning: level,
      acrobatics: level,
      consistency: level,
      charisma: level,
    },
    aggregations: { practice: 0 },
  };
}

function song(requiredLevel: AuditionLevel = 4): AuditionSong {
  return {
    id: 'test-song',
    title: 'Test Arrangement',
    description: 'An original test arrangement.',
    track: 'VOCAL',
    genre: 'MAINSTREAM_POP',
    part: {
      testedSkills: [
        { skill: 'vocals', requiredLevel },
        { skill: 'dance', requiredLevel: 3 },
      ],
    },
  };
}

const preferences: AuditionPreferences = {
  visualOrUniqueness: 'visual',
  potentialOrCharisma: 'potential',
};

function input(): ScoreAuditionInput {
  const contestant = performer();
  contestant.coreSkills.dance = 4;
  return { contestant, song: song(), preferences, rawDice: [1, 4], tieBreakKey: 0.25 };
}

function close(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`);
}

test('editable catalog provides five songs per track, requirements 1–5, and detached validated snapshots', () => {
  const catalog = getAuditionSongs();
  assert.equal(catalog.length, 15);
  for (const track of ['VOCAL', 'RAP', 'DANCE']) {
    const songs = catalog.filter((entry) => entry.track === track);
    assert.equal(songs.length, 5);
    assert.deepEqual(songs.map((entry) => entry.part.testedSkills[0].requiredLevel).sort(), [1, 2, 3, 4, 5]);
    assert.ok(new Set(songs.map((entry) => entry.genre)).size >= 3);
  }
  assert.notEqual(catalog[0], getAuditionSongs()[0]);
  assert.notEqual(catalog[0].part.testedSkills, getAuditionSongs()[0].part.testedSkills);
  assert.ok(Object.isFrozen(catalog[0].part.testedSkills[0]));
  catalog.pop();
  assert.equal(getAuditionSongs().length, 15);
  assert.deepEqual(validateAuditionSongs(catalog), catalog);
});

test('stored catalogs validate against frozen genre IDs independently of current definitions', () => {
  const stored = [{ ...song(), genre: 'FROZEN_GENRE' }];
  assert.throws(() => validateAuditionSongs(stored), /genre is unknown/);
  const [frozenSong] = validateAuditionSongs(stored, ['FROZEN_GENRE']);
  assert.equal(frozenSong.genre, 'FROZEN_GENRE');
  assert.deepEqual(scoreAudition({ ...input(), song: frozenSong }), scoreAudition(input()));
  assert.throws(() => validateAuditionSongs(stored, ['REPLACEMENT_GENRE']), /genre is unknown/);
  assert.throws(() => validateAuditionSongs(stored, []), /genre is unknown/);
  assert.throws(() => validateAuditionSongs(stored, ['']), /genre IDs/);
});

test('catalog validator rejects malformed shape, unknown fields/IDs, duplicate skills and primary mismatches', () => {
  const base = song();
  const invalid: unknown[] = [
    null,
    {},
    [],
    [null],
    [{ ...base, id: '' }],
    [{ ...base, title: '' }],
    [{ ...base, description: 12 }],
    [{ ...base, track: 'BEATBOX' }],
    [{ ...base, genre: 'UNKNOWN' }],
    [{ ...base, extra: true }],
    [{ ...base, part: [] }],
    [{ ...base, part: { testedSkills: [] } }],
    [{ ...base, part: { testedSkills: [{ skill: 'vocals', requiredLevel: 1 }], extra: true } }],
    [{ ...base, part: { testedSkills: [{ skill: 'memory', requiredLevel: 1 }] } }],
    [{ ...base, part: { testedSkills: [{ skill: 'stagePresence', requiredLevel: 1 }] } }],
    [{ ...base, part: { testedSkills: [{ skill: 'vocals', requiredLevel: 1, extra: true }] } }],
    [{ ...base, part: { testedSkills: [{ skill: 'vocals', requiredLevel: 2.5 }] } }],
    [{ ...base, part: { testedSkills: [{ skill: 'vocals', requiredLevel: 0 }] } }],
    [{ ...base, part: { testedSkills: [{ skill: 'vocals', requiredLevel: 6 }] } }],
    [{ ...base, part: { testedSkills: [{ skill: 'vocals', requiredLevel: '3' }] } }],
    [{ ...base, part: { testedSkills: [{ skill: 'dance', requiredLevel: 3 }] } }],
    [{ ...base, part: { testedSkills: [base.part.testedSkills[0], base.part.testedSkills[0]] } }],
    [base, base],
  ];
  for (const value of invalid) assert.throws(() => validateAuditionSongs(value), /Audition songs/);
  assert.throws(() => validateAuditionSongs([base, base]), /duplicate song ID/);
});

test('worked Bob example uses weighted per-skill difficulty ceilings and one shared raw pair', () => {
  const evaluation = scoreAudition(input());
  const [vocals, dance] = evaluation.technical.checks;
  assert.equal(vocals.floor, 2);
  assert.equal(dance.floor, 5);
  assert.deepEqual(vocals.adjustedDice, [2, 4]);
  assert.deepEqual(dance.adjustedDice, [5, 5]);
  close(vocals.score, 36);
  close(dance.score, 64);
  close(evaluation.technical.score, (2 * 36 + 64) / 3);
  assert.deepEqual(evaluation.rawDice, [1, 4]);
  assert.deepEqual(evaluation.stagePresence.adjustedDice, [3, 4]);
  close(evaluation.stagePresence.score, 50);
  close(evaluation.finalScore, 0.55 * (136 / 3) + 0.35 * 50 + 0.1 * 50 + 0.1 * 50);
});

test('temporary composure changes only effective stage presence and preserves base skills', () => {
  const original = input();
  const before = structuredClone(original);
  const baseline = scoreAudition(original);
  for (const composure of [-1, 1]) {
    const evaluation = scoreAudition({ ...original, composure });
    assert.equal(evaluation.baseStagePresence, 3);
    assert.equal(evaluation.composure, composure);
    assert.equal(evaluation.stagePresence.skillLevel, 3 + composure);
    assert.notEqual(evaluation.stagePresence.score, baseline.stagePresence.score);
    assert.deepEqual(evaluation.technical, baseline.technical);
    assert.deepEqual(evaluation.impressions, baseline.impressions);
    assert.deepEqual(evaluation.rawDice, baseline.rawDice);
  }
  assert.deepEqual(original, before);
  for (const level of [1, 5]) {
    const evaluation = scoreAudition({
      ...original,
      contestant: performer(level),
      composure: level === 1 ? -1 : 1,
    });
    assert.equal(evaluation.stagePresence.skillLevel, level);
  }
  for (const composure of [-2, 2, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => scoreAudition({ ...original, composure }), /composure.*integer/);
  }
  const invalid = performer();
  invalid.coreSkills.stagePresence = 0;
  assert.throws(
    () => scoreAudition({ ...original, contestant: invalid, composure: 1 }),
    /base stage presence/,
  );
});

test('minimum face clamps 1–5 but never reduces a naturally rolled six', () => {
  assert.equal(auditionMinimumFace(1, 5), 1);
  assert.equal(auditionMinimumFace(5, 1), 5);
  assert.equal(auditionMinimumFace(3, 4), 2);
  const evaluation = scoreAudition({ ...input(), contestant: performer(5), rawDice: [6, 1] });
  for (const check of [
    ...evaluation.technical.checks,
    evaluation.stagePresence,
    ...Object.values(evaluation.impressions),
  ]) {
    assert.equal(check.floor, 5);
    assert.deepEqual(check.adjustedDice, [6, 5]);
    assert.equal(check.deliveryFraction, 0.9);
  }
  const low = scoreAudition({ ...input(), contestant: performer(1), rawDice: [1, 1] });
  assert.equal(low.finalScore, 0);
  for (const [skill, requirement] of [
    [0, 3],
    [6, 3],
    [2.5, 3],
    [3, 0],
    [3, 6],
    [3, Number.NaN],
  ]) {
    assert.throws(() => auditionMinimumFace(skill, requirement), /integers from 1 to 5/);
  }
});

test('all four impressions use corresponding skills, requirement 3, and shared dice even when unselected', () => {
  const contestant = performer(1);
  contestant.coreSkills.visual = 1;
  contestant.coreSkills.uniqueness = 2;
  contestant.utilitySkills.potential = 3;
  contestant.utilitySkills.charisma = 4;
  const original = { ...input(), contestant, rawDice: [1, 2] as const };
  const evaluation = scoreAudition(original);
  assert.deepEqual(Object.keys(evaluation.impressions), ['visual', 'uniqueness', 'potential', 'charisma']);
  assert.deepEqual(
    Object.values(evaluation.impressions).map((check) => check.score),
    [10, 10, 40, 80],
  );
  assert.ok(Object.values(evaluation.impressions).every((check) => check.requiredLevel === 3));
  const alternative = scoreAudition({
    ...original,
    preferences: { visualOrUniqueness: 'uniqueness', potentialOrCharisma: 'charisma' },
  });
  assert.deepEqual(alternative.impressions, evaluation.impressions);
  close(alternative.finalScore - evaluation.finalScore, 4);
  assert.notEqual(evaluation.preferences, original.preferences);
  assert.notEqual(evaluation.rawDice, original.rawDice);
});

test('grade thresholds use unrounded values and final score caps without renormalizing', () => {
  const thresholds: [number, string][] = [
    [0, 'F'],
    [39.999999, 'F'],
    [40, 'D'],
    [54.999999, 'D'],
    [55, 'C'],
    [69.999999, 'C'],
    [70, 'B'],
    [84.999999, 'B'],
    [85, 'A'],
    [100, 'A'],
  ];
  for (const [score, grade] of thresholds) assert.equal(auditionGrade(score), grade);
  for (const value of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY])
    assert.throws(() => auditionGrade(value), /finite score/);
  const maximum = scoreAudition({ ...input(), song: song(5), rawDice: [6, 6] });
  assert.equal(maximum.technical.score, (2 * 100 + 80) / 3);
  assert.equal(maximum.finalScore, 100);
  assert.equal(maximum.grade, 'A');
  const oneSkill: AuditionSong = {
    ...song(1),
    part: { testedSkills: [{ skill: 'vocals', requiredLevel: 1 }] },
  };
  const easy = scoreAudition({ ...input(), song: oneSkill, rawDice: [6, 6] });
  assert.equal(easy.technical.score, 60);
  close(easy.finalScore, 88);
});

test('rolls and tie keys consume explicit deterministic random draws and reject invalid random values', () => {
  const draws = [0, 0.999999, 0.375];
  let calls = 0;
  const random = () => draws[calls++];
  assert.deepEqual(rollAuditionDice(random), [1, 6]);
  assert.equal(drawAuditionTieBreakKey(random), 0.375);
  assert.equal(calls, 3);
  for (const value of [-0.1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => rollAuditionDice(() => value), /random draws/);
    assert.throws(() => drawAuditionTieBreakKey(() => value), /random draws/);
    assert.throws(() => startAuditionBatch(null, () => value), /random draws/);
  }
  function run() {
    const randomSource = createSeededRandom(123);
    const judging = startAuditionBatch(null, randomSource.next);
    return {
      judging,
      result: scoreAudition({
        ...input(),
        preferences: judging.preferences,
        rawDice: rollAuditionDice(randomSource.next),
        tieBreakKey: drawAuditionTieBreakKey(randomSource.next),
      }),
      state: randomSource.getState(),
    };
  }
  assert.deepEqual(run(), run());
});

test('first-batch preference choices are independent, equal, locked and consume exactly two draws', () => {
  for (const [first, second, visual, potential] of [
    [0, 0, 'visual', 'potential'],
    [0.499999, 0.5, 'visual', 'charisma'],
    [0.5, 0.499999, 'uniqueness', 'potential'],
    [0.99, 0.99, 'uniqueness', 'charisma'],
  ] as const) {
    const draws = [first, second];
    let calls = 0;
    const batch = startAuditionBatch(null, () => draws[calls++]);
    assert.deepEqual(batch.preferences, { visualOrUniqueness: visual, potentialOrCharisma: potential });
    assert.equal(batch.previousBatch, null);
    assert.equal(calls, 2);
    assert.ok(Object.isFrozen(batch.preferences));
  }
  assert.deepEqual(AUDITION_BATCH_SIZES, [13, 13, 13, 11]);
});

function withImpressions(
  contestantId: string,
  scores: readonly [number, number, number, number],
): AuditionEvaluation {
  const evaluation = scoreAudition(input());
  return {
    ...evaluation,
    contestantId,
    impressions: {
      visual: { ...evaluation.impressions.visual, score: scores[0] },
      uniqueness: { ...evaluation.impressions.uniqueness, score: scores[1] },
      potential: { ...evaluation.impressions.potential, score: scores[2] },
      charisma: { ...evaluation.impressions.charisma, score: scores[3] },
    },
  };
}

test('subsequent preferences use previous-batch mean/standouts with independent inverse-satisfaction weights', () => {
  const previous = [withImpressions('one', [100, 10, 0, 40]), withImpressions('two', [0, 10, 0, 40])];
  const draws = [0.2, 0.6];
  let calls = 0;
  const batch = startAuditionBatch(previous, () => draws[calls++]);
  assert.equal(calls, 2);
  assert.deepEqual(batch.previousBatch?.visual, { mean: 50, highest: 100, satisfaction: 80, weight: 21 });
  assert.deepEqual(batch.previousBatch?.uniqueness, { mean: 10, highest: 10, satisfaction: 10, weight: 91 });
  assert.deepEqual(batch.previousBatch?.potential, { mean: 0, highest: 0, satisfaction: 0, weight: 101 });
  assert.deepEqual(batch.previousBatch?.charisma, { mean: 40, highest: 40, satisfaction: 40, weight: 61 });
  assert.deepEqual(batch.preferences, { visualOrUniqueness: 'uniqueness', potentialOrCharisma: 'potential' });
  const boundary = startAuditionBatch(previous, () => 21 / 112);
  assert.equal(boundary.preferences.visualOrUniqueness, 'uniqueness');
  const newPrevious = [withImpressions('new', [0, 100, 100, 0])];
  const next = startAuditionBatch(newPrevious, () => 0.5);
  assert.equal(next.previousBatch?.visual.satisfaction, 0);
  assert.equal(next.preferences.visualOrUniqueness, 'visual');
  assert.equal(next.preferences.potentialOrCharisma, 'charisma');
  assert.throws(() => startAuditionBatch([], () => 0), /must not be empty/);
  assert.throws(() => startAuditionBatch([previous[0], previous[0]], () => 0), /Duplicate/);
  assert.throws(
    () => startAuditionBatch([withImpressions('bad', [Number.NaN, 1, 1, 1])], () => 0),
    /finite score/,
  );
});

test('ranking uses capped score, technical, stage presence, then persisted key; does not mutate input', () => {
  const base = scoreAudition(input());
  const result = (
    contestantId: string,
    finalScore: number,
    technical: number,
    stagePresence: number,
    tieBreakKey: number,
  ): AuditionEvaluation => ({
    ...base,
    contestantId,
    finalScore,
    technical: { ...base.technical, score: technical },
    stagePresence: { ...base.stagePresence, score: stagePresence },
    tieBreakKey,
  });
  const entries = [
    result('lower-score', 90, 100, 100, 0),
    result('lower-technical', 100, 80, 100, 0),
    result('lower-stage', 100, 90, 80, 0),
    result('later-key', 100, 90, 90, 0.8),
    result('earlier-key', 100, 90, 90, 0.2),
  ];
  const ranked = rankAuditions(entries);
  assert.deepEqual(
    ranked.map((entry) => entry.contestantId),
    ['earlier-key', 'later-key', 'lower-stage', 'lower-technical', 'lower-score'],
  );
  assert.equal(entries[0].contestantId, 'lower-score');
  assert.equal(ranked[0], entries[4]);
  assert.throws(() => rankAuditions([entries[0], entries[0]]), /Duplicate/);
  assert.deepEqual(rankAuditions([]), []);
  const tied = result('tie', 100, 90, 90, 0.2);
  assert.equal(compareAuditions(tied, entries[4]), 0);
  assert.throws(() => rankAuditions([tied, entries[4]]), /tie-break draw collision/);

  // Different unselected/selected surplus cannot supersede a persisted tie key once capped.
  const strong = performer(5);
  const highSurplus = scoreAudition({
    ...input(),
    contestant: { ...strong, id: 'high-surplus' },
    song: song(5),
    rawDice: [6, 6],
    tieBreakKey: 0.8,
  });
  const lowSurplus: AuditionEvaluation = {
    ...highSurplus,
    contestantId: 'low-surplus',
    tieBreakKey: 0.2,
    impressions: { ...highSurplus.impressions, visual: { ...highSurplus.impressions.visual, score: 60 } },
  };
  assert.ok(compareAuditions(lowSurplus, highSurplus) < 0);
});

test('private cutoff scores protect every bias without altering grades or requiring capped performances', () => {
  const base = scoreAudition(input());
  const entries = Array.from({ length: 50 }, (_, index) => ({
    ...base,
    contestantId: `protected-${index}`,
    finalScore: 100 - 2 * index,
    tieBreakKey: index / 50,
  }));
  const before = structuredClone(entries);
  const protectedIds = [entries[0].contestantId, entries[29].contestantId, entries[49].contestantId];
  const boosts = auditionBiasScoreBoosts(entries, protectedIds);
  assert.equal(boosts[entries[0].contestantId], undefined, 'a safe score needs no boost');
  assert.deepEqual(Object.keys(boosts).sort(), protectedIds.slice(1).sort());
  const ranked = rankAuditions(entries, boosts);
  for (const id of protectedIds) assert.ok(ranked.slice(0, 30).some((entry) => entry.contestantId === id));
  const ordinary = ranked.filter((entry) => !protectedIds.includes(entry.contestantId));
  assert.deepEqual(
    ordinary,
    rankAuditions(entries).filter((entry) => !protectedIds.includes(entry.contestantId)),
  );
  assert.deepEqual(entries, before);
  assert.deepEqual(auditionBiasScoreBoosts(entries, []), {});
  assert.deepEqual(rankAuditions(entries, {}), rankAuditions(entries));

  const tied = entries.map((entry) => ({ ...entry, finalScore: 100 }));
  const thirty = tied.slice(20).map((entry) => entry.contestantId);
  const tieBoosts = auditionBiasScoreBoosts(tied, thirty);
  assert.equal(Object.keys(tieBoosts).length, 30);
  assert.ok(Object.values(tieBoosts).every((value) => value === 1));
  assert.deepEqual(
    new Set(
      rankAuditions(tied, tieBoosts)
        .slice(0, 30)
        .map((entry) => entry.contestantId),
    ),
    new Set(thirty),
  );
  assert.ok(tied.every((entry) => entry.finalScore === 100 && entry.grade === base.grade));
  assert.throws(
    () =>
      auditionBiasScoreBoosts(
        tied,
        tied.slice(19).map((entry) => entry.contestantId),
      ),
    /thirty/,
  );
  assert.throws(() => auditionBiasScoreBoosts(tied, ['unknown']), /cast members/);
  assert.throws(() => auditionBiasScoreBoosts(tied, [thirty[0], thirty[0]]), /cast members/);
  assert.throws(() => rankAuditions(entries, { unknown: 1 }), /boosts/);
  assert.throws(() => rankAuditions(entries, { [thirty[0]]: Number.POSITIVE_INFINITY }), /boosts/);
});

test('scoring rejects unsupported practice, bad levels/dice/preferences/IDs and invalid persisted keys', () => {
  const base = input();
  assert.throws(
    () =>
      scoreAudition({
        ...base,
        contestant: { ...base.contestant, aggregations: { practice: 1 } },
      }),
    /Practice 0/,
  );
  for (const skill of ['vocals', 'stagePresence', 'visual', 'uniqueness'] as const) {
    assert.throws(
      () =>
        scoreAudition({
          ...base,
          contestant: { ...base.contestant, coreSkills: { ...base.contestant.coreSkills, [skill]: 2.5 } },
        }),
      /integers from 1 to 5/,
    );
  }
  for (const skill of ['potential', 'charisma'] as const) {
    assert.throws(
      () =>
        scoreAudition({
          ...base,
          contestant: { ...base.contestant, utilitySkills: { ...base.contestant.utilitySkills, [skill]: 6 } },
        }),
      /integers from 1 to 5/,
    );
  }
  for (const rawDice of [
    [0, 1],
    [1.2, 6],
    [1, 7],
    [Number.NaN, 1],
  ] as const) {
    assert.throws(() => scoreAudition({ ...base, rawDice }), /integer faces/);
  }
  for (const tieBreakKey of [-1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => scoreAudition({ ...base, tieBreakKey }), /tie-break keys/);
  }
  assert.throws(
    () =>
      scoreAudition({
        ...base,
        contestant: { ...base.contestant, id: ' ' },
      }),
    /IDs must be nonempty/,
  );
  // Deliberately malformed persisted inputs exercise runtime guards beyond the TS contract.
  const malformed: unknown = { visualOrUniqueness: 'potential', potentialOrCharisma: 'charisma' };
  assert.throws(
    () =>
      scoreAudition({
        ...base,
        preferences: malformed as AuditionPreferences,
      }),
    /one quality from each pair/,
  );
});
