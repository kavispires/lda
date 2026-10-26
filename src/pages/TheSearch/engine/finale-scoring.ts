import type { AuditionDice } from '../types/audition';
import type { Contestant } from '../types/contestant';
import type {
  FinaleAssessment,
  FinaleCheckKey,
  FinalePerformance,
  FinaleRehearsal,
} from '../types/finale-episode';
import { auditionGrade } from './audition-scoring';
import { battleCheck, clampBattle } from './battle-scoring';

export const finaleMean = (values: readonly number[]) => {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error('Missing finite Finale evidence.');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};
function check(skill: string, level: number, difficulty: 3 | 4, dice: AuditionDice, weight = 1) {
  if (dice.length !== 2 || dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6))
    throw new Error('Finale requires saved 2d6.');
  const result = battleCheck(skill, level, difficulty, dice, weight);
  return { ...result, score: 10 * (result.adjustedDice[0] + result.adjustedDice[1] - 2) };
}
export function rehearseFinale(
  person: Contestant,
  session: 1 | 2,
  rawDice: AuditionDice,
  readinessBefore = 0,
): FinaleRehearsal {
  const skills =
    session === 1
      ? (['learning', 'memory', 'consistency'] as const)
      : (['stamina', 'consistency', 'memory'] as const);
  const checks = skills.map((skill, index) =>
    check(skill, person.utilitySkills[skill], 3, rawDice, index === 0 ? 2 : 1),
  );
  const weightedSum =
    checks.reduce((sum, value) => sum + value.weight * (value.adjustedDice[0] + value.adjustedDice[1]), 0) /
    4;
  const sessionPractice = Math.min(5, Math.floor(weightedSum / 2));
  return {
    contestantId: person.id,
    session,
    rawDice: [...rawDice],
    checks,
    weightedSum,
    sessionPractice,
    readinessBefore,
    readinessAfter: Math.max(readinessBefore, sessionPractice),
  };
}
export function scoreFinalePerformance(
  person: Contestant,
  songId: string,
  rawDice: AuditionDice,
  readiness: number,
  act: 'original' | 'theme',
): FinalePerformance {
  const track = person.track === 'VOCAL' ? 'vocals' : person.track === 'RAP' ? 'rap' : 'dance';
  const difficulty = act === 'original' ? 4 : 3;
  const checks = Object.fromEntries(
    (
      [
        'track',
        'dance',
        'stagePresence',
        'visual',
        'uniqueness',
        'potential',
        'stamina',
        'consistency',
        'charisma',
        'leadership',
      ] as const
    ).map((key) => {
      const skill = key === 'track' ? track : key;
      const level =
        skill in person.coreSkills
          ? person.coreSkills[skill as keyof typeof person.coreSkills]
          : person.utilitySkills[skill as keyof typeof person.utilitySkills];
      return [key, check(skill, level, difficulty, rawDice)];
    }),
  ) as Record<FinaleCheckKey, ReturnType<typeof check>>;
  const breakdownPenalty =
    act === 'original' &&
    rawDice[0] + rawDice[1] <= 4 &&
    ((person.utilitySkills.stamina < 3 && checks.stamina.score < 40) ||
      (person.utilitySkills.consistency < 3 && checks.consistency.score < 40))
      ? 20
      : 0;
  const base =
    act === 'original'
      ? 0.3 * checks.track.score +
        0.2 * checks.stagePresence.score +
        0.25 * checks.stamina.score +
        0.25 * checks.consistency.score
      : 0.5 * checks.dance.score +
        0.2 * checks.stagePresence.score +
        0.15 * checks.stamina.score +
        0.15 * checks.consistency.score;
  const technical = clampBattle(base + 2 * readiness - breakdownPenalty);
  return {
    contestantId: person.id,
    songId,
    rawDice: [...rawDice],
    checks,
    readiness,
    base,
    breakdownPenalty,
    technical,
    emotionalPraise:
      act === 'original' &&
      person.personality.resilience >= 5 &&
      person.personality.ambition >= 5 &&
      technical >= 85,
  };
}
export function assessFinale(original: FinalePerformance, theme: FinalePerformance): FinaleAssessment {
  if (original.contestantId !== theme.contestantId)
    throw new Error('Finale acts must belong to the same finalist.');
  const adaptability = Math.min(original.technical, theme.technical);
  const perspectives = (act: FinalePerformance, isTheme: boolean) => {
    const c = act.checks;
    const primary = isTheme ? c.dance.score : c.track.score;
    return {
      john: primary,
      megan: finaleMean([c.stagePresence.score, c.uniqueness.score, c.potential.score]),
      michael: finaleMean([c.visual.score, c.consistency.score, c.leadership.score]),
      jane: 0.6 * c.dance.score + 0.4 * c.consistency.score,
      'doubt-girls': 0.5 * primary + 0.3 * c.stagePresence.score + 0.2 * c.uniqueness.score,
      roxana: 0.6 * c.charisma.score + 0.4 * adaptability,
      vivienne: 0.4 * c.visual.score + 0.3 * c.stamina.score + 0.3 * c.consistency.score,
    };
  };
  const a = perspectives(original, false);
  const b = perspectives(theme, true);
  const judges = Object.fromEntries(
    Object.entries(a).map(([id, value]) => [
      id,
      { original: value, theme: b[id as keyof typeof b], score: (value + b[id as keyof typeof b]) / 2 },
    ]),
  ) as FinaleAssessment['judges'];
  const performance = (original.technical + theme.technical) / 2;
  const judgeMean = finaleMean(Object.values(judges).map((judge) => judge.score));
  const finalScore = 0.5 * performance + 0.5 * judgeMean;
  return {
    contestantId: original.contestantId,
    original: original.technical,
    theme: theme.technical,
    performance,
    judges,
    judgeMean,
    finalScore,
    grade: auditionGrade(finalScore),
  };
}

export function finalePostSeason(audience: number, satisfaction: number) {
  if (
    !Number.isSafeInteger(audience) ||
    audience < 0 ||
    !Number.isFinite(satisfaction) ||
    satisfaction < 0 ||
    satisfaction > 100
  )
    throw new Error('Invalid post-season audience.');
  const retainedGroupFans = Math.floor((audience * satisfaction) / 100);
  return {
    audience,
    satisfaction,
    retainedGroupFans,
    retainedShare: audience ? retainedGroupFans / audience : 0,
    nonRetainedViewers: audience - retainedGroupFans,
  };
}
