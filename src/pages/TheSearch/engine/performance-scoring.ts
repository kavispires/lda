import type { PerformancePart } from '../types/common';
import type { Contestant } from '../types/contestant';

/**
 * Calculate the base execution score for a performance
 * Formula: (vocals/vocalDiff) + (rap/rapDiff) + (dance/danceDiff)
 * Each skill yield is capped at 2.0x to prevent over-leveling
 * Returns a 0-100 normalized score
 */
export function calculateExecutionBase(contestant: Contestant, part: PerformancePart): number {
  const { vocals, rap, dance } = contestant.coreSkills;
  const { vocal: vocalDiff, rap: rapDiff, dance: danceDiff } = part.difficulty;

  // Calculate skill yields, cap each at 2.0x
  const vocalYield = Math.min(2.0, vocalDiff > 0 ? vocals / vocalDiff : vocals);
  const rapYield = Math.min(2.0, rapDiff > 0 ? rap / rapDiff : rap);
  const danceYield = Math.min(2.0, danceDiff > 0 ? dance / danceDiff : dance);

  // Sum yields (max possible = 6.0)
  const totalYield = vocalYield + rapYield + danceYield;

  // Normalize to 0-100 scale
  // Perfect score (2.0 + 2.0 + 2.0) = 100
  // Minimum realistic (0.2 + 0.2 + 0.2) = 10
  const normalizedScore = (totalYield / 6.0) * 100;

  return normalizedScore;
}

/**
 * Apply "It Factor" multipliers to the base score
 * Visual: 1.0 + (visual * 0.02) — max +10% at visual=5
 * Stage Presence: 1.0 + (stagePresence * 0.05) — max +25% at stagePresence=5
 */
export function applyItFactorMultipliers(baseScore: number, contestant: Contestant): number {
  const { visual, stagePresence } = contestant.coreSkills;

  const visualMultiplier = 1.0 + visual * 0.02;
  const presenceMultiplier = 1.0 + stagePresence * 0.05;

  // Apply both multipliers sequentially
  let score = baseScore * visualMultiplier;
  score = score * presenceMultiplier;

  return score;
}

/**
 * Apply modifiers and condition debuffs to the score
 * Modifiers are parsed from dot notation (e.g., "utilitySkills.stamina")
 * Conditions apply multiplicative debuffs
 */
export function applyModifiersAndConditions(
  score: number,
  contestant: Contestant,
  part: PerformancePart,
): number {
  let modifiedScore = score;

  // Apply modifiers from part.modifiersWeight
  for (const [path, weight] of Object.entries(part.modifiersWeight)) {
    const value = getNestedValue(contestant, path);
    if (typeof value === 'number') {
      // Convert skill value (1-5) to percentage bonus
      // weight is the max percentage (e.g., 0.15 = 15%)
      // Skill 5 = full bonus, Skill 1 = 20% of bonus
      const bonusPercentage = (value / 5) * weight;
      modifiedScore *= 1.0 + bonusPercentage;
    }
  }

  // Apply condition debuffs
  const { physicalCondition } = contestant.conditions;

  if (physicalCondition === 'INJURED') {
    modifiedScore *= 0.8;
  } else if (physicalCondition === 'EXHAUSTED') {
    modifiedScore *= 0.9;
  } else if (physicalCondition === 'SICK') {
    modifiedScore *= 0.85;
  }

  return modifiedScore;
}

/**
 * Apply consistency-based RNG variance to the score
 * Max Variance = (6 - consistency) * 0.08
 * At consistency 5: ±8%, At consistency 1: ±40%
 */
export function applyConsistencyRoll(score: number, consistency: number): number {
  const maxVariance = (6 - consistency) * 0.08;

  // Generate random variance between -maxVariance and +maxVariance
  const roll = (Math.random() * 2 - 1) * maxVariance;

  const finalScore = score * (1.0 + roll);

  return Math.max(0, finalScore); // Ensure non-negative
}

/**
 * Master performance scorer - orchestrates all scoring steps
 * Returns final performance score (0-100+ range, can exceed 100 with bonuses)
 */
export function calculatePerformanceScore(
  contestant: Contestant,
  part: PerformancePart,
): { score: number; rngRoll: number } {
  // Step 1: Calculate execution base
  const baseScore = calculateExecutionBase(contestant, part);

  // Step 2: Apply "It Factor" multipliers
  const withItFactor = applyItFactorMultipliers(baseScore, contestant);

  // Step 3: Apply modifiers and conditions
  const withModifiers = applyModifiersAndConditions(withItFactor, contestant, part);

  // Step 4: Apply consistency RNG
  const consistency = contestant.utilitySkills.consistency;
  const maxVariance = (6 - consistency) * 0.08;
  const rngRoll = (Math.random() * 2 - 1) * maxVariance;
  const finalScore = withModifiers * (1.0 + rngRoll);

  return {
    score: Math.max(0, finalScore),
    rngRoll,
  };
}

/**
 * Helper function to get nested object value via dot notation
 * e.g., "utilitySkills.stamina" returns contestant.utilitySkills.stamina
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
