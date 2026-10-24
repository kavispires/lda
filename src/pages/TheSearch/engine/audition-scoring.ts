import type {
  AuditionBatchJudging,
  AuditionDice,
  AuditionEvaluation,
  AuditionGrade,
  AuditionLevel,
  AuditionPreferences,
  AuditionQuality,
  AuditionQualityMemory,
  AuditionSkillCheck,
  ScoreAuditionInput,
} from '../types/audition';
import { isAuditionLevel, validateAuditionSongs } from '../utilities/audition-songs';
import type { RandomSource } from './random';

export const AUDITION_BATCH_SIZES = [13, 13, 13, 11] as const;

function randomUnit(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('Audition random draws must be finite numbers in [0, 1).');
  }
  return value;
}

function validateDice(dice: AuditionDice): void {
  if (
    !Array.isArray(dice) ||
    dice.length !== 2 ||
    dice.some((face) => !Number.isInteger(face) || face < 1 || face > 6)
  ) {
    throw new Error('Audition dice must be exactly two integer faces from 1 to 6.');
  }
}

function validatePreferences(preferences: AuditionPreferences): void {
  if (
    !preferences ||
    (preferences.visualOrUniqueness !== 'visual' && preferences.visualOrUniqueness !== 'uniqueness') ||
    (preferences.potentialOrCharisma !== 'potential' && preferences.potentialOrCharisma !== 'charisma')
  ) {
    throw new Error('Audition preferences must select one quality from each pair.');
  }
}

function validateTieBreakKey(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('Audition tie-break keys must be finite seeded draws in [0, 1).');
  }
}

function validateScore(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a finite score from 0 to 100.`);
  }
}

function validateId(value: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Audition contestant IDs must be nonempty text.');
  }
}

export function rollAuditionDice(random: RandomSource): AuditionDice {
  return [Math.floor(randomUnit(random) * 6) + 1, Math.floor(randomUnit(random) * 6) + 1];
}

/** Draw once per contestant and persist the key; never draw while sorting. */
export function drawAuditionTieBreakKey(random: RandomSource): number {
  return randomUnit(random);
}

export function auditionMinimumFace(skillLevel: number, requiredLevel: number): AuditionLevel {
  if (!isAuditionLevel(skillLevel) || !isAuditionLevel(requiredLevel)) {
    throw new Error('Audition skill and required levels must be integers from 1 to 5.');
  }
  const floor = Math.max(1, Math.min(5, 2 * skillLevel - requiredLevel));
  if (!isAuditionLevel(floor)) throw new Error('Invalid audition minimum face.');
  return floor;
}

function checkSkill(
  skill: AuditionSkillCheck['skill'],
  skillLevel: number,
  requiredLevel: AuditionLevel,
  rawDice: AuditionDice,
  ceiling: number,
): AuditionSkillCheck {
  const floor = auditionMinimumFace(skillLevel, requiredLevel);
  if (!isAuditionLevel(skillLevel)) throw new Error(`${skill} must be an integer from 1 to 5.`);
  const adjustedDice: AuditionDice = [Math.max(rawDice[0], floor), Math.max(rawDice[1], floor)];
  const deliveryFraction = (adjustedDice[0] + adjustedDice[1] - 2) / 10;
  return {
    skill,
    skillLevel,
    requiredLevel,
    floor,
    adjustedDice,
    deliveryFraction,
    ceiling,
    score: ceiling * deliveryFraction,
  };
}

export function auditionGrade(score: number): AuditionGrade {
  validateScore(score, 'Audition final score');
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/** Audition-only evaluation: one caller-supplied song, one shared raw pair, no practice or reactions. */
export function scoreAudition(input: ScoreAuditionInput): AuditionEvaluation {
  const { contestant, rawDice, preferences, tieBreakKey } = input;
  const composure = input.composure === undefined ? 0 : input.composure;
  if (!Number.isInteger(composure) || composure < -1 || composure > 1) {
    throw new Error('Audition composure must be an integer from -1 to 1.');
  }
  const baseStagePresence = contestant.coreSkills.stagePresence;
  if (!isAuditionLevel(baseStagePresence)) {
    throw new Error('Audition base stage presence levels must be integers from 1 to 5.');
  }
  validateId(contestant.id);
  validateDice(rawDice);
  validatePreferences(preferences);
  validateTieBreakKey(tieBreakKey);
  if (contestant.aggregations.practice !== 0) {
    throw new Error('Audition foundations require Practice 0; practice sessions are not implemented.');
  }
  // Catalog loading validates genre membership; scoring a frozen song must not consult today's library.
  const [song] = validateAuditionSongs([input.song], [input.song.genre]);
  const checks = song.part.testedSkills.map(({ skill, requiredLevel }, index) => ({
    ...checkSkill(skill, contestant.coreSkills[skill], requiredLevel, rawDice, 50 + 10 * requiredLevel),
    skill,
    weight: index === 0 ? 2 : 1,
  }));
  const technicalScore =
    checks.reduce((sum, check) => sum + check.score * check.weight, 0) /
    checks.reduce((sum, check) => sum + check.weight, 0);
  const stagePresence = checkSkill(
    'stagePresence',
    Math.max(1, Math.min(5, baseStagePresence + composure)),
    3,
    rawDice,
    100,
  );
  const impressions = {
    visual: checkSkill('visual', contestant.coreSkills.visual, 3, rawDice, 100),
    uniqueness: checkSkill('uniqueness', contestant.coreSkills.uniqueness, 3, rawDice, 100),
    potential: checkSkill('potential', contestant.utilitySkills.potential, 3, rawDice, 100),
    charisma: checkSkill('charisma', contestant.utilitySkills.charisma, 3, rawDice, 100),
  };
  const finalScore = Math.min(
    100,
    0.55 * technicalScore +
      0.35 * stagePresence.score +
      0.1 * impressions[preferences.visualOrUniqueness].score +
      0.1 * impressions[preferences.potentialOrCharisma].score,
  );
  return {
    contestantId: contestant.id,
    songId: song.id,
    rawDice: [rawDice[0], rawDice[1]],
    preferences: { ...preferences },
    technical: { score: technicalScore, checks },
    stagePresence,
    baseStagePresence,
    composure,
    impressions,
    finalScore,
    grade: auditionGrade(finalScore),
    tieBreakKey,
  };
}

function summarizeQuality(
  previousBatch: readonly AuditionEvaluation[],
  quality: AuditionQuality,
): AuditionQualityMemory {
  const scores = previousBatch.map((evaluation) => {
    const score = evaluation.impressions[quality].score;
    validateScore(score, `Previous batch ${quality} impression`);
    return score;
  });
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const highest = Math.max(...scores);
  const satisfaction = Math.max(mean, 0.8 * highest);
  return { mean, highest, satisfaction, weight: 101 - satisfaction };
}

function validateUniqueContestants(evaluations: readonly AuditionEvaluation[]): void {
  const ids = new Set<string>();
  for (const evaluation of evaluations) {
    validateId(evaluation.contestantId);
    if (ids.has(evaluation.contestantId)) {
      throw new Error(`Duplicate audition contestant ID "${evaluation.contestantId}".`);
    }
    ids.add(evaluation.contestantId);
  }
}

/** Start one batch only. Pass null for the first, or ONLY the immediately previous batch. */
export function startAuditionBatch(
  previousBatch: readonly AuditionEvaluation[] | null,
  random: RandomSource,
): AuditionBatchJudging {
  let memory: AuditionBatchJudging['previousBatch'] = null;
  if (previousBatch !== null) {
    if (previousBatch.length === 0) throw new Error('Previous audition batch must not be empty.');
    validateUniqueContestants(previousBatch);
    memory = {
      visual: summarizeQuality(previousBatch, 'visual'),
      uniqueness: summarizeQuality(previousBatch, 'uniqueness'),
      potential: summarizeQuality(previousBatch, 'potential'),
      charisma: summarizeQuality(previousBatch, 'charisma'),
    };
  }
  const firstWeight = (quality: AuditionQuality) => memory?.[quality].weight ?? 1;
  const chooseFirst = (first: AuditionQuality, second: AuditionQuality) =>
    randomUnit(random) < firstWeight(first) / (firstWeight(first) + firstWeight(second));
  const preferences: AuditionPreferences = Object.freeze({
    visualOrUniqueness: chooseFirst('visual', 'uniqueness') ? 'visual' : 'uniqueness',
    potentialOrCharisma: chooseFirst('potential', 'charisma') ? 'potential' : 'charisma',
  });
  return { preferences, previousBatch: memory };
}

function validateRanking(evaluation: AuditionEvaluation): void {
  validateId(evaluation.contestantId);
  validateScore(evaluation.finalScore, 'Audition final score');
  validateScore(evaluation.technical.score, 'Audition technical score');
  validateScore(evaluation.stagePresence.score, 'Audition stage-presence score');
  validateTieBreakKey(evaluation.tieBreakKey);
}

export function compareAuditions(left: AuditionEvaluation, right: AuditionEvaluation): number {
  validateRanking(left);
  validateRanking(right);
  return (
    right.finalScore - left.finalScore ||
    right.technical.score - left.technical.score ||
    right.stagePresence.score - left.stagePresence.score ||
    left.tieBreakKey - right.tieBreakKey
  );
}

/** Returns a new ranked list; does not eliminate, mutate contestants, or close an episode. */
export function rankAuditions(evaluations: readonly AuditionEvaluation[]): AuditionEvaluation[] {
  validateUniqueContestants(evaluations);
  for (const evaluation of evaluations) validateRanking(evaluation);
  const ranked = [...evaluations].sort(compareAuditions);
  for (let index = 1; index < ranked.length; index++) {
    if (compareAuditions(ranked[index - 1], ranked[index]) === 0) {
      throw new Error('Audition tie-break draw collision: persist a new seeded key before ranking.');
    }
  }
  return ranked;
}
