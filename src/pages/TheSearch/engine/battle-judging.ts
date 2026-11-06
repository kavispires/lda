import type { BattleCheck, BattlePerformance } from '../types/battle-episode';
import type { Contestant } from '../types/contestant';
import { battleCheck, clampBattle } from './battle-scoring';

const mean = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0) / values.length;

function comment(checks: BattleCheck[], focus: string): string {
  const bySkill = new Map<string, number[]>();
  for (const check of checks) bySkill.set(check.skill, [...(bySkill.get(check.skill) ?? []), check.score]);
  const ordered = [...bySkill]
    .map(([skill, scores]) => ({ skill, score: mean(scores) }))
    .sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill));
  const label = (skill: string) => skill.replace(/([A-Z])/g, ' $1').toLowerCase();
  const strongest = ordered[0];
  const weakest = ordered.at(-1)!;
  return `${focus}: the recorded ${label(strongest.skill)} checks averaged ${strongest.score.toFixed(1)}/100${strongest.score >= 70 ? ', a strength' : strongest.score < 50 ? ', leaving room to improve' : ', a mixed delivery'}.${weakest.skill !== strongest.skill ? ` ${label(weakest.skill)} averaged ${weakest.score.toFixed(1)}/100${weakest.score < 70 ? ' and needs more assurance' : ' and also held up well'}.` : ''}`;
}

/** Judge only recorded delivery; this layer never rolls dice or rewrites individual results. */
export function addBattleJudging(
  performance: BattlePerformance,
  contestants: readonly Contestant[],
): BattlePerformance {
  return addGroupJudging(performance, contestants, 5);
}

export function addGroupJudging(
  performance: BattlePerformance,
  contestants: readonly Contestant[],
  groupSize: number,
): BattlePerformance {
  if (
    !Number.isInteger(groupSize) ||
    groupSize < 1 ||
    performance.evaluations.length !== groupSize ||
    new Set(performance.evaluations.map((evaluation) => evaluation.contestantId)).size !== groupSize
  )
    throw new Error(
      groupSize === 5
        ? 'Battle judging requires five distinct recorded performances.'
        : `Group judging requires ${groupSize} distinct recorded performances.`,
    );
  const john: BattleCheck[] = [];
  const megan: BattleCheck[] = [];
  const michael: BattleCheck[] = [];
  for (const evaluation of performance.evaluations) {
    const contestant = contestants.find((entry) => entry.id === evaluation.contestantId);
    if (!contestant) throw new Error('Battle judging requires a valid contestant.');
    // A technical composite retains every weighted source check; its score is not re-normalized.
    john.push(
      ...evaluation.technicalChecks.map((check) => ({
        ...check,
        adjustedDice: [...check.adjustedDice] as [number, number],
      })),
    );
    const impression = (skill: string): BattleCheck => {
      const check = evaluation.impressionChecks.find((entry) => entry.skill === skill);
      if (!check) throw new Error(`Missing recorded ${skill} impression.`);
      return { ...check, adjustedDice: [...check.adjustedDice] };
    };
    megan.push(
      { ...evaluation.stageCheck, adjustedDice: [...evaluation.stageCheck.adjustedDice] },
      impression('potential'),
      impression('uniqueness'),
    );
    const normalized = (skill: string, level: number): BattleCheck => {
      const check = battleCheck(skill, level, 3, evaluation.rawDice);
      return { ...check, score: (check.score * 100) / 80 };
    };
    michael.push(
      impression('visual'),
      normalized('consistency', contestant.utilitySkills.consistency),
      normalized('leadership', contestant.coreSkills.leadership),
    );
  }
  const result = (checks: BattleCheck[], score: number, focus: string) => ({
    checks,
    score,
    bonus: score / 60,
    comment: comment(checks, focus),
  });
  const judging = {
    john: result(
      john,
      mean(performance.evaluations.map((entry) => entry.technicalScore)),
      'Technical delivery',
    ),
    megan: result(megan, mean(megan.map((entry) => entry.score)), 'Stage presence, potential and uniqueness'),
    michael: result(michael, mean(michael.map((entry) => entry.score)), 'Visual, consistency and leadership'),
  };
  const baseScore = performance.baseScore ?? performance.finalScore;
  return {
    ...performance,
    baseScore,
    judging,
    finalScore: clampBattle(
      baseScore + (judging.john.score + judging.megan.score + judging.michael.score) / 60,
    ),
  };
}
