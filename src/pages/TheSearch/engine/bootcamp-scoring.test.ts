import assert from 'node:assert/strict';
import test from 'node:test';
import type { BootcampEvaluation, BootcampGroup } from '../types/bootcamp-episode';
import type { Contestant } from '../types/contestant';
import { createContestant } from '../utilities/contestant-factory';
import {
  bootcampWinner,
  bootcampWinningGroup,
  scoreBootcampGroup,
  scoreBootcampPair,
} from './bootcamp-scoring';
import { createSeededRandom } from './random';

function contestant(id: string, level = 3): Contestant {
  const result = createContestant({ id, name: id, track: 'VOCAL', updatedAt: 1 });
  for (const key of Object.keys(result.personality) as (keyof Contestant['personality'])[])
    result.personality[key] = 0;
  for (const key of Object.keys(result.utilitySkills) as (keyof Contestant['utilitySkills'])[])
    result.utilitySkills[key] = level;
  for (const key of Object.keys(result.coreSkills) as (keyof Contestant['coreSkills'])[])
    result.coreSkills[key] = level;
  return result;
}

function pairRecords(cast: readonly Contestant[], round = 1): BootcampEvaluation[] {
  return cast.flatMap((_entry, index) =>
    index % 2 === 0 ? scoreBootcampPair(cast.slice(index, index + 2), round, () => 0) : [],
  );
}

function freeze(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
}

test('pair checks use shared actual two-d6, medium skill floors, and the specified weights', () => {
  const a = contestant('a');
  const b = contestant('b');
  a.utilitySkills.stamina = 5;
  a.coreSkills.vocals = 1;
  const [record] = scoreBootcampPair([a, b], 1, () => 0);
  assert.deepEqual(record.rawDice, [1, 1]);
  assert.deepEqual(record.checks.stamina.adjustedDice, [5, 5]);
  assert.equal(record.checks.stamina.score, 80);
  assert.equal(record.checks.consistency.score, 40);
  assert.equal(record.checks.vocals.score, 0);
  assert.equal(record.baseScore, 52);
  assert.equal(record.finalScore, 52);

  const [box] = scoreBootcampPair([a, b], 3, () => 0);
  assert.equal(box.baseScore, 40);
  assert.deepEqual(Object.keys(box.checks), ['consistency', 'learning']);
});

test('Action Sequence really depends on the weaker partner consistency', () => {
  const a = contestant('a');
  const b = contestant('b');
  const strong = scoreBootcampPair([a, b], 2, () => 0)[0];
  b.utilitySkills.consistency = 1;
  const weak = scoreBootcampPair([a, b], 2, () => 0)[0];
  assert.equal(strong.baseScore - weak.baseScore, 8);
  assert.deepEqual(strong.checks, weak.checks);
});

test('Dance microphone uses the stronger skill or its persisted seeded tie key', () => {
  const dancer = contestant('dancer');
  dancer.track = 'DANCE';
  dancer.coreSkills.rap = 5;
  const partner = contestant('partner');
  assert.ok(scoreBootcampPair([dancer, partner], 1, () => 0)[0].checks.rap);
  dancer.coreSkills.vocals = 5;
  const vocal = scoreBootcampPair([dancer, partner], 1, () => 0.25)[0];
  const rap = scoreBootcampPair([dancer, partner], 1, () => 0.75)[0];
  assert.ok(vocal.checks.vocals);
  assert.ok(rap.checks.rap);
  assert.equal(vocal.tieBreakKey, 0.25);
  assert.equal(rap.tieBreakKey, 0.75);
});

test('sensitivity alone does not panic: only the saved low raw roll can zero the score', () => {
  const sensitive = contestant('sensitive', 5);
  sensitive.personality.sensitivity = 5;
  sensitive.personality.discipline = 5;
  const partner = contestant('partner');
  const failure = scoreBootcampPair([sensitive, partner], 1, () => 0)[0];
  const success = scoreBootcampPair([sensitive, partner], 1, () => 0.5)[0];
  assert.equal(failure.finalScore, 0);
  assert.ok(failure.baseScore > 0);
  assert.ok(failure.events.some((entry) => entry.kind === 'panic'));
  assert.equal(failure.baseScore + failure.events.reduce((sum, entry) => sum + entry.scoreDelta, 0), 0);
  assert.ok(success.finalScore > 0);
  assert.ok(success.events.every((entry) => entry.kind !== 'panic'));
  sensitive.personality.sensitivity = 4;
  assert.ok(scoreBootcampPair([sensitive, partner], 1, () => 0)[0].finalScore > 0);
});

test('risky flips fail safely and charisma never converts embarrassment to technical success', () => {
  const risk = contestant('risk', 1);
  risk.personality.ambition = 5;
  const partner = contestant('partner');
  const plain = scoreBootcampPair([risk, partner], 2, () => 0)[0];
  risk.utilitySkills.charisma = 5;
  const charming = scoreBootcampPair([risk, partner], 2, () => 0)[0];
  assert.ok(charming.events.some((entry) => entry.kind === 'safe-failed-flip'));
  assert.ok(charming.events.some((entry) => entry.kind === 'charming-recovery'));
  assert.equal(charming.finalScore, plain.finalScore);
  assert.equal(risk.condition, 'STABLE');
});

test('Distraction Box shield blocks flinching; genuine mistakes can earn apologies, not skill', () => {
  const trainee = contestant('trainee');
  const partner = contestant('partner');
  Object.assign(trainee.personality, { sensitivity: 5, sincerity: 5, resilience: 5, maturity: 5 });
  const shield = scoreBootcampPair([trainee, partner], 3, () => 0)[0];
  assert.ok(shield.events.some((entry) => entry.kind === 'trainer-awe'));
  assert.ok(shield.events.every((entry) => entry.kind !== 'flinch'));
  trainee.personality.maturity = 4;
  const flinch = scoreBootcampPair([trainee, partner], 3, () => 0)[0];
  assert.equal(flinch.finalScore, flinch.baseScore - 5);
  assert.ok(flinch.events.some((entry) => entry.kind === 'sincere-apology' && entry.scoreDelta === 0));
  assert.deepEqual(shield.checks, flinch.checks);
});

test('scoring is deterministic and never mutates contestants, relationships, skills, or prior records', () => {
  const cast = Array.from({ length: 6 }, (_, index) => contestant(`c${index}`, 1 + (index % 5)));
  cast[1].personality.gentleness = 5;
  cast[2].personality.ambition = 5;
  cast[2].personality.gentleness = -5;
  cast[3].personality.investment = -5;
  cast[0].condition = 'RECOVERING';
  cast[0].aggregations.practice = 4;
  const before = structuredClone(cast);
  freeze(cast);
  for (const round of [1, 2, 3]) {
    assert.deepEqual(
      scoreBootcampPair(cast.slice(0, 2), round, createSeededRandom(77).next),
      scoreBootcampPair(cast.slice(0, 2), round, createSeededRandom(77).next),
    );
  }
  const prior = pairRecords(cast);
  const beforePrior = structuredClone(prior);
  freeze(prior);
  const first = scoreBootcampGroup(cast, prior, 'group', createSeededRandom(91).next);
  assert.deepEqual(first, scoreBootcampGroup(cast, prior, 'group', createSeededRandom(91).next));
  assert.deepEqual(cast, before);
  assert.deepEqual(prior, beforePrior);
  assert.equal(new Set(first.result.staging).size, 6);
});

test('fatigue loads 6/5/4 stay bounded and subtract two points each only from final individuals', () => {
  for (const round of [1, 2, 3]) {
    for (const stamina of [1, 5]) {
      const cast = Array.from({ length: 6 }, (_, index) => contestant(`c${index}`, stamina));
      const prior = pairRecords(cast, round);
      const expected = Math.max(0, Math.min(5, 7 - round - stamina));
      assert.ok(prior.every((record) => record.fatigue === expected));
      const { evaluations } = scoreBootcampGroup(cast, prior, 'group', () => 0.99);
      for (const record of evaluations) {
        assert.equal(record.fatigue, expected);
        assert.equal(record.finalScore, 100 - 2 * expected);
      }
    }
  }
});

test('five-reset safety cap records every attempt; correction cannot inflate technical scores', () => {
  const cast = Array.from({ length: 6 }, (_, index) => contestant(`c${index}`, 1));
  cast[0].personality.investment = -5;
  const { evaluations, result } = scoreBootcampGroup(cast, pairRecords(cast), 'group', () => 0);
  assert.equal(result.resets, 5);
  assert.equal(result.assisted, true);
  assert.deepEqual(
    result.attempts.map((attempt) => attempt.reset),
    [0, 1, 2, 3, 4, 5],
  );
  assert.ok(result.attempts[5].timing.c0 < 60);
  assert.equal(
    evaluations[0].events
      .filter((entry) => entry.kind === 'checking-out')
      .reduce((sum, entry) => sum + entry.scoreDelta, 0),
    -10,
  );
  assert.ok(evaluations.every((record) => record.baseScore === 0 && record.finalScore === 0));
  assert.equal(result.score, 0);
});

test('Gauntlet stops as soon as every timing passes, and group score uses original evidence', () => {
  const cast = Array.from({ length: 6 }, (_, index) => contestant(`c${index}`));
  const { result, evaluations } = scoreBootcampGroup(cast, pairRecords(cast, 3), 'group', () => 0);
  assert.equal(result.resets, 3);
  assert.equal(result.assisted, false);
  assert.ok(Object.values(result.attempts[result.resets].timing).every((score) => score >= 60));
  assert.equal(result.score, 40 - 9);
  assert.ok(evaluations.every((record) => record.finalScore === 38));
});

test('group tie key is a separate saved draw that cannot change scored performance', () => {
  const cast = Array.from({ length: 6 }, (_, index) => contestant(`c${index}`));
  const prior = pairRecords(cast);
  let draws = 0;
  const first = scoreBootcampGroup(cast, prior, 'group', () => {
    draws++;
    return 0.25;
  });
  const totalDraws = draws;
  draws = 0;
  const second = scoreBootcampGroup(cast, prior, 'group', () => {
    draws++;
    return draws === totalDraws ? 0.75 : 0.25;
  });
  assert.equal(first.result.tieBreakKey, 0.25);
  assert.equal(second.result.tieBreakKey, 0.75);
  assert.deepEqual(first.evaluations, second.evaluations);
  assert.deepEqual({ ...first.result, tieBreakKey: second.result.tieBreakKey }, second.result);
});

test('support and confrontation address the actual weak link directionally with bounded assistance', () => {
  const cast = Array.from({ length: 6 }, (_, index) => contestant(`c${index}`, 1));
  cast.slice(1).forEach((entry) => {
    entry.personality.gentleness = 5;
  });
  const supported = scoreBootcampGroup(cast, pairRecords(cast), 'group', () => 0);
  const support = supported.evaluations
    .flatMap((record) => record.events)
    .filter((entry) => entry.kind === 'gentle-support');
  assert.equal(support.length, 5);
  for (const entry of support) {
    assert.equal(entry.relationships[0].observerId, 'c0');
    assert.notEqual(entry.relationships[0].targetId, 'c0');
    assert.equal(entry.relationships[0].delta, 1);
  }
  assert.equal(supported.result.attempts[2].timing.c0, 20);
  assert.ok(supported.evaluations.every((record) => record.finalScore === 0));
  cast[1].personality.gentleness = -5;
  cast[1].personality.ambition = 5;
  const confronted = scoreBootcampGroup(cast, pairRecords(cast), 'group', () => 0);
  assert.deepEqual(
    confronted.evaluations[1].events.find((entry) => entry.kind === 'harsh-confrontation')?.relationships,
    [{ observerId: 'c0', targetId: 'c1', delta: -1 }],
  );
});

test('staging and charisma affect footage only, capped at two extra spotlight units across both appearances', () => {
  const cast = Array.from({ length: 6 }, (_, index) => contestant(`c${index}`, 5));
  cast.forEach((entry) => {
    entry.personality.extroversion = 5;
  });
  const prior = pairRecords(cast, 3);
  const result = scoreBootcampGroup(cast, prior, 'group', () => 0.99);
  assert.ok(result.evaluations.every((record) => record.finalScore === 100));
  assert.equal(result.result.score, 100);
  for (const record of result.evaluations) {
    const pair = prior.find((entry) => entry.contestantId === record.contestantId);
    assert.ok(pair);
    assert.ok([...pair.events, ...record.events].reduce((sum, entry) => sum + entry.spotlight, 0) <= 2);
  }
});

test('event identity follows actual name mentions, including namesakes, not affected rosters', () => {
  const cast = Array.from({ length: 6 }, (_, index) => contestant(`c${index}`, 1));
  cast[0].name = 'Alex';
  cast[1].name = 'Alex';
  cast[1].personality.gentleness = 5;
  cast[2].personality.ambition = 5;
  cast[2].personality.gentleness = -5;
  const prior = pairRecords(cast);
  const { evaluations } = scoreBootcampGroup(cast, prior, 'group', () => 0);
  const support = evaluations[1].events.find((entry) => entry.kind === 'gentle-support');
  assert.ok(support);
  assert.equal(
    support.narrative,
    'Alex patiently coaches Alex, the weakest timing contributor after reset 1.',
  );
  assert.deepEqual(support.contestantIds, ['c1', 'c0']);
  const confrontation = evaluations[2].events.find((entry) => entry.kind === 'harsh-confrontation');
  assert.ok(confrontation);
  assert.deepEqual(confrontation.contestantIds, ['c2', 'c0']);
  for (const record of evaluations) {
    const finish = record.events.find((entry) => entry.kind === 'assisted-finish');
    assert.ok(finish);
    assert.deepEqual(finish.contestantIds, []);
    assert.deepEqual(record.events.find((entry) => entry.kind === 'fatigue')?.contestantIds, [
      record.contestantId,
    ]);
  }
});

test('individual Gauntlet standout considers all eighteen, including an inferior group', () => {
  const casts = [5, 4, 3].map((level, group) =>
    Array.from({ length: 6 }, (_, index) => contestant(`g${group}-${index}`, level)),
  );
  casts[0][5] = contestant('g0-5', 1);
  const scored = casts.map((cast, index) =>
    scoreBootcampGroup(cast, pairRecords(cast), `g${index}`, () => 0),
  );
  assert.ok(scored[1].result.score > scored[0].result.score);
  assert.equal(bootcampWinner(scored.flatMap((group) => group.evaluations)), 'g0-0');
});

test('winner ties use primary, secondary, persisted key, then stable ID without mutating records', () => {
  const [first, second] = scoreBootcampPair([contestant('b'), contestant('a')], 1, () => 0);
  assert.equal(bootcampWinner([first, second]), 'a');
  first.tieBreakKey = 0.8;
  assert.equal(bootcampWinner([first, second]), 'b');
  second.checks.consistency.score++;
  assert.equal(bootcampWinner([first, second]), 'a');
  first.checks.stamina.score++;
  assert.equal(bootcampWinner([first, second]), 'b');
  const records = [first, second];
  freeze(records);
  bootcampWinner(records);
  assert.equal(records[0].contestantId, 'b');
});

test('group winner ties use score, fewer resets, final individual total, saved key, and stable ID', () => {
  const casts = ['b', 'a'].map((group) =>
    Array.from({ length: 6 }, (_, index) => contestant(`${group}${index}`)),
  );
  const groups: BootcampGroup[] = casts.map((cast, index) => ({
    id: index === 0 ? 'b' : 'a',
    memberIds: cast.map((entry) => entry.id),
    pairs: [],
    ballots: {},
    tieKeys: {},
  }));
  const scored = casts.map((cast, index) =>
    scoreBootcampGroup(cast, pairRecords(cast), groups[index].id, () => 0),
  );
  const results = scored.map((entry) => entry.result);
  const evaluations = scored.flatMap((entry) => entry.evaluations);
  assert.equal(bootcampWinningGroup(groups, results, evaluations), 'a');
  results[0].tieBreakKey = 0.9;
  assert.equal(bootcampWinningGroup(groups, results, evaluations), 'b');
  evaluations[6].finalScore++;
  assert.equal(bootcampWinningGroup(groups, results, evaluations), 'a');
  results[0].resets--;
  assert.equal(bootcampWinningGroup(groups, results, evaluations), 'b');
  results[1].score++;
  assert.equal(bootcampWinningGroup(groups, results, evaluations), 'a');
  freeze(groups);
  freeze(results);
  freeze(evaluations);
  assert.equal(bootcampWinningGroup(groups, results, evaluations), 'a');
  assert.deepEqual(
    results.map((entry) => entry.groupId),
    ['b', 'a'],
  );
  assert.throws(() => bootcampWinningGroup([], [], []), /group winners/);
  assert.throws(() => bootcampWinningGroup(groups, results, evaluations.slice(1)), /complete/);
});

test('invalid sizes, duplicate IDs, rounds, histories, and random draws reject', () => {
  const a = contestant('a');
  const b = contestant('b');
  assert.throws(() => scoreBootcampPair([a], 1, () => 0), /exactly 2/);
  assert.throws(() => scoreBootcampPair([a, a], 1, () => 0), /distinct/);
  assert.throws(() => scoreBootcampPair([a, b], 4, () => 0), /rounds/);
  assert.throws(() => scoreBootcampPair([a, b], 1, () => 1), /random draws/);
  const cast = Array.from({ length: 6 }, (_, index) => contestant(`c${index}`));
  assert.throws(() => scoreBootcampGroup(cast, [], 'group', () => 0), /pair record/);
  assert.throws(() => bootcampWinner([]), /evidence/);
  assert.throws(() => bootcampWinner([...pairRecords(cast, 1), ...pairRecords(cast, 2)]), /one round/);
});
