import type { AuditionDice, AuditionEvaluation, AuditionLevel, AuditionSkillCheck } from '../types/audition';
import type {
  BattleCheck,
  BattleEvaluation,
  BattlePerformance,
  BattleSong,
  BattleTeam,
} from '../types/battle-episode';
import type { Contestant, UtilitySkills } from '../types/contestant';
import { auditionGrade, auditionMinimumFace, rollAuditionDice } from './audition-scoring';
import type { RandomSource } from './random';

export const clampBattle = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));
export const battleRelationship = (from: Contestant, toId: string): number =>
  from.relationships[toId]?.at(-1) ?? 50;

export function changeBattleRelationship(from: Contestant, toId: string, delta: number): void {
  if (from.id === toId) return;
  const before = battleRelationship(from, toId);
  const after = clampBattle(before + delta);
  if (after !== before) {
    from.relationships[toId] ??= [before];
    from.relationships[toId].push(after);
  }
}

export function battleCheck(
  skill: string,
  skillLevel: number,
  requiredLevel: number,
  rawDice: AuditionDice,
  weight = 1,
): BattleCheck {
  const floor = auditionMinimumFace(skillLevel, requiredLevel);
  const adjustedDice: AuditionDice = [Math.max(rawDice[0], floor), Math.max(rawDice[1], floor)];
  return {
    skill,
    skillLevel,
    requiredLevel,
    floor,
    adjustedDice,
    weight,
    score: ((50 + 10 * requiredLevel) * (adjustedDice[0] + adjustedDice[1] - 2)) / 10,
  };
}

export function practiceBattleTeam(
  team: BattleTeam,
  song: BattleSong,
  contestants: Contestant[],
  random: RandomSource,
): void {
  if (team.practice.length) throw new Error('Team practice is already locked.');
  const leader = contestants.find((entry) => entry.id === team.captainId);
  if (!leader) throw new Error('Missing battle captain.');
  const sessions: { title: string; skills: (keyof UtilitySkills)[] }[] = [
    { title: 'Part learning', skills: ['learning', 'memory', 'consistency'] },
    { title: 'Full rehearsal', skills: ['stamina', 'consistency', 'memory'] },
  ];
  for (const [index, session] of sessions.entries()) {
    const leaderDice = rollAuditionDice(random);
    const leaderCheck = battleCheck('leadership', leader.coreSkills.leadership, song.difficulty, leaderDice);
    const leadershipSuccess = leaderCheck.adjustedDice[0] + leaderCheck.adjustedDice[1] >= 8;
    const coordinationChange = leadershipSuccess ? 1 : -1;
    const coordinationBefore = team.coordination;
    team.coordination = clampBattle(team.coordination + coordinationChange, -5, 5);
    const records = team.memberIds.map((id) => {
      const contestant = contestants.find((entry) => entry.id === id);
      if (!contestant) throw new Error('Missing practice contestant.');
      const rawDice = rollAuditionDice(random);
      const checks = session.skills.map((skill, skillIndex) => ({
        skill,
        requiredLevel: song.difficulty,
        skillLevel: contestant.utilitySkills[skill],
        floor: auditionMinimumFace(contestant.utilitySkills[skill], song.difficulty),
        weight: skillIndex === 0 ? 2 : 1,
        adjustedDice: battleCheck(skill, contestant.utilitySkills[skill], song.difficulty, rawDice)
          .adjustedDice,
      }));
      const total =
        checks.reduce(
          (sum, check, checkIndex) =>
            sum + (check.adjustedDice[0] + check.adjustedDice[1]) * (checkIndex === 0 ? 2 : 1),
          0,
        ) / 4;
      const practiceBefore = contestant.aggregations.practice;
      const practiceAfter = Math.max(practiceBefore, Math.min(5, Math.floor(total / 2)));
      contestant.aggregations.practice = practiceAfter;
      if (id !== leader.id) {
        const strained =
          battleRelationship(contestant, leader.id) < 40 || contestant.personality.gentleness < -3;
        changeBattleRelationship(contestant, leader.id, leadershipSuccess ? 1 : strained ? -2 : -1);
      }
      return {
        contestantId: id,
        rawDice,
        checks,
        practiceBefore,
        practiceAfter,
        weightedSum: total,
        sessionPractice: Math.min(5, Math.floor(total / 2)),
        improved: practiceAfter > practiceBefore,
      };
    });
    team.practice.push({
      session: index + 1,
      title: session.title,
      leaderDice,
      leadershipSuccess,
      coordinationChange,
      coordinationBefore,
      coordinationAfter: team.coordination,
      contestants: records,
      leadershipCheck: { ...leaderCheck, successThreshold: 8 },
    });
  }
}

export function scoreBattleTeam(
  team: BattleTeam,
  song: BattleSong,
  contestants: readonly Contestant[],
  composure: number,
  random: RandomSource,
): BattlePerformance {
  const evaluations = team.memberIds.map((id): BattleEvaluation => {
    const contestant = contestants.find((entry) => entry.id === id);
    const part = song.parts.find((entry) => entry.id === team.partAssignments[id]);
    if (!contestant || !part)
      throw new Error('Battle performance requires a valid contestant and assigned part.');
    const rawDice = rollAuditionDice(random);
    const technicalChecks = part.testedSkills.map(({ skill, requiredLevel }, index) =>
      battleCheck(skill, contestant.coreSkills[skill], requiredLevel, rawDice, index === 0 ? 2 : 1),
    );
    if (contestant.aggregations.practice > 0)
      technicalChecks.push(
        battleCheck(
          'practice',
          contestant.aggregations.practice,
          part.testedSkills[0].requiredLevel,
          rawDice,
        ),
      );
    const technicalScore =
      technicalChecks.reduce((sum, check) => sum + check.score * check.weight, 0) /
      technicalChecks.reduce((sum, check) => sum + check.weight, 0);
    const normalized = (skill: string, value: number): BattleCheck => {
      const check = battleCheck(skill, value, 3, rawDice);
      return { ...check, score: (check.score * 100) / 80 };
    };
    const stageCheck = normalized(
      'stagePresence',
      clampBattle(contestant.coreSkills.stagePresence + composure, 1, 5),
    );
    const stageScore = stageCheck.score;
    const impressionChecks = [
      normalized('visual', contestant.coreSkills.visual),
      normalized('uniqueness', contestant.coreSkills.uniqueness),
      normalized('potential', contestant.utilitySkills.potential),
      normalized('charisma', contestant.utilitySkills.charisma),
    ];
    const impressionScore = impressionChecks.reduce((sum, check) => sum + check.score, 0) / 4;
    const finalScore = clampBattle(0.55 * technicalScore + 0.35 * stageScore + 0.2 * impressionScore);
    return {
      contestantId: id,
      partId: part.id,
      rawDice,
      technicalChecks,
      stageCheck,
      impressionChecks,
      technicalScore,
      stageScore,
      impressionScore,
      composure,
      finalScore,
      grade: auditionGrade(finalScore),
      tieBreakKey: random(),
    };
  });
  const meanScore = evaluations.reduce((sum, evaluation) => sum + evaluation.finalScore, 0) / 5;
  return {
    teamId: team.id,
    evaluations,
    meanScore,
    coordination: team.coordination,
    finalScore: clampBattle(meanScore + team.coordination),
  };
}

/** Reuse the audience's normalized delivery/voting/MVP machinery, not its audition-only scoring. */
export function battleAudienceEvaluations(
  teams: readonly BattleTeam[],
  performances: readonly BattlePerformance[],
): AuditionEvaluation[] {
  return performances.flatMap((performance) => {
    const team = teams.find((entry) => entry.id === performance.teamId);
    if (!team?.songId) throw new Error('Recorded battle has no song.');
    return performance.evaluations.map((evaluation): AuditionEvaluation => {
      const audienceCheck = (check: BattleCheck): AuditionSkillCheck => ({
        ...check,
        skill: check.skill as AuditionSkillCheck['skill'],
        skillLevel: check.skillLevel as AuditionLevel,
        requiredLevel: check.requiredLevel as AuditionLevel,
        floor: check.floor as AuditionLevel,
        deliveryFraction: check.score / 100,
        ceiling: 100,
      });
      return {
        contestantId: evaluation.contestantId,
        songId: team.songId!,
        rawDice: evaluation.rawDice,
        preferences: { visualOrUniqueness: 'visual', potentialOrCharisma: 'charisma' },
        technical: {
          score: evaluation.technicalScore,
          checks: evaluation.technicalChecks
            .filter((check) => check.skill !== 'practice')
            .map((check) => ({
              ...check,
              skill: check.skill as 'vocals',
              skillLevel: check.skillLevel as AuditionLevel,
              requiredLevel: check.requiredLevel as AuditionLevel,
              floor: check.floor as AuditionLevel,
              deliveryFraction: (check.adjustedDice[0] + check.adjustedDice[1] - 2) / 10,
              ceiling: 50 + 10 * check.requiredLevel,
            })),
        },
        stagePresence: audienceCheck(evaluation.stageCheck),
        baseStagePresence: evaluation.stageCheck.skillLevel,
        composure: evaluation.composure,
        impressions: {
          visual: audienceCheck(evaluation.impressionChecks[0]),
          uniqueness: audienceCheck(evaluation.impressionChecks[1]),
          potential: audienceCheck(evaluation.impressionChecks[2]),
          charisma: audienceCheck(evaluation.impressionChecks[3]),
        },
        finalScore: evaluation.finalScore,
        grade: evaluation.grade,
        tieBreakKey: evaluation.tieBreakKey,
      };
    });
  });
}
