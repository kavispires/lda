import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BattleSong, BattleTeam } from '../types/battle-episode';
import { createContestant } from '../utilities/contestant-factory';
import { addBattleJudging } from './battle-judging';
import { scoreBattleTeam } from './battle-scoring';

function fixture() {
  const contestants = Array.from({ length: 5 }, (_, i) => {
    const person = createContestant({ id: `judge-${i}`, name: `Artist ${i}`, updatedAt: 1 });
    for (const skill of Object.keys(person.coreSkills) as (keyof typeof person.coreSkills)[])
      person.coreSkills[skill] = 3;
    for (const skill of Object.keys(person.utilitySkills) as (keyof typeof person.utilitySkills)[])
      person.utilitySkills[skill] = 3;
    person.aggregations.practice = 0;
    return person;
  });
  const song: BattleSong = {
    id: 'judge-song',
    title: 'Judging',
    description: 'Recorded delivery',
    genre: 'pop',
    difficulty: 3,
    parts: contestants.map((person) => ({
      id: `part-${person.id}`,
      name: 'Solo',
      testedSkills: [{ skill: 'vocals', requiredLevel: 3 }],
    })),
  };
  const team: BattleTeam = {
    id: 'judge-team',
    name: 'Team Artist',
    captainId: contestants[0].id,
    memberIds: contestants.map((person) => person.id),
    songId: song.id,
    centerId: contestants[1].id,
    centerBallots: {},
    partAssignments: Object.fromEntries(contestants.map((person) => [person.id, `part-${person.id}`])),
    partReactions: {},
    coordination: 0,
    practice: [],
  };
  return { contestants, song, team };
}

test('center only changes temporary stage readiness, combines with composure and leaves legacy scoring unchanged', () => {
  const { contestants, song, team } = fixture();
  const before = structuredClone(contestants);
  const legacy = scoreBattleTeam(team, song, contestants, 0, () => 0);
  const explicitLegacy = scoreBattleTeam(team, song, contestants, 0, () => 0, false);
  assert.deepEqual(legacy, explicitLegacy);
  assert.ok(legacy.evaluations.every((entry) => !Object.hasOwn(entry, 'centerBonus')));
  assert.ok(legacy.evaluations.every((entry) => entry.finalScore === 39.6));
  const narrative = scoreBattleTeam(team, song, contestants, 0, () => 0, true);
  narrative.evaluations.forEach((entry, i) => {
    assert.equal(entry.centerBonus, i === 1 ? 1 : 0);
    assert.equal(entry.stageCheck.skillLevel, i === 1 ? 4 : 3);
    assert.equal(entry.stageScore, i === 1 ? 80 : 40);
    assert.equal(entry.technicalScore, legacy.evaluations[i].technicalScore);
    assert.equal(entry.impressionScore, legacy.evaluations[i].impressionScore);
  });
  const nervous = scoreBattleTeam(team, song, contestants, -1, () => 0, true);
  assert.equal(nervous.evaluations[1].stageCheck.skillLevel, 3);
  assert.equal(nervous.evaluations[0].stageCheck.skillLevel, 2);
  contestants[1].coreSkills.stagePresence = 5;
  const bounded = scoreBattleTeam(team, song, contestants, 1, () => 0, true);
  assert.equal(bounded.evaluations[1].stageCheck.skillLevel, 5);
  contestants[1].coreSkills.stagePresence = 3;
  assert.deepEqual(contestants, before);
});

test('judges reuse exactly recorded dice and evidence, preserve individuals, and have equal maximum contributions totaling five', () => {
  const { contestants, song, team } = fixture();
  let draws = 0;
  const performance = scoreBattleTeam(
    team,
    song,
    contestants,
    0,
    () => {
      draws++;
      return 0;
    },
    true,
  );
  const before = structuredClone(performance);
  const judged = addBattleJudging(performance, contestants);
  assert.equal(draws, 15);
  assert.deepEqual(performance, before);
  assert.deepEqual(judged.evaluations, performance.evaluations);
  assert.equal(judged.baseScore, performance.finalScore);
  assert.equal(judged.judging!.john.score, 32);
  assert.equal(judged.judging!.megan.score, (40 * 14 + 80) / 15);
  assert.equal(judged.judging!.michael.score, 40);
  assert.equal(judged.judging!.megan.checks[3].skillLevel, 4, 'center readiness reaches Megan');
  assert.ok(judged.judging!.michael.checks.every((entry) => entry.adjustedDice.every((face) => face === 3)));
  assert.deepEqual(addBattleJudging(judged, contestants), judged, 'judging cannot compound its own bonus');
  for (const person of contestants)
    for (const skill of Object.keys(person.coreSkills) as (keyof typeof person.coreSkills)[])
      person.coreSkills[skill] = 5;
  for (const part of song.parts) part.testedSkills[0].requiredLevel = 5;
  team.coordination = -5;
  const maximum = addBattleJudging(
    scoreBattleTeam(team, song, contestants, 0, () => 0.999, true),
    contestants,
  );
  assert.equal(maximum.baseScore, 95);
  assert.equal(maximum.finalScore, 100);
  for (const judge of Object.values(maximum.judging!)) {
    assert.equal(judge.score, 100);
    assert.equal(judge.bonus, 100 / 60);
  }
  assert.equal(
    Object.values(maximum.judging!).reduce((total, judge) => total + judge.bonus, 0),
    5,
  );
});
