import type { Contestant } from '../types/contestant';
import { GRADES } from '../utilities/constants';

/**
 * Tier definitions and their rewards
 */
const TIER_REWARDS: Record<number, { screenTime: number; prodRatioDelta: number }> = {
  1.5: { screenTime: 6.0, prodRatioDelta: 0.05 },
  1: { screenTime: 3.0, prodRatioDelta: 0.03 },
  2: { screenTime: 3.0, prodRatioDelta: 0.01 },
  3: { screenTime: 2.0, prodRatioDelta: 0.0 },
  4: { screenTime: 1.0, prodRatioDelta: -0.01 },
  5: { screenTime: 0.5, prodRatioDelta: -0.02 },
  6: { screenTime: 0.0, prodRatioDelta: -0.03 }, // Not broadcast
};

/**
 * Assign narrative tiers to contestants
 * Returns map of contestant ID → tier number
 *
 * Tier 6 (Not Broadcast, 12 slots): F grades with lowest productionRatio - auditions not shown
 * Tier 1.5 (Ace Closer, 1 slot): Highest A with highest productionRatio
 * Tier 1 (Spotlight, 8 slots): 3 Openers + 3 Mid-Batch + 2 Bombs
 * Tier 2 (Quad Split, 0-4 slots): C/D grades with similar songs (optional)
 * Tier 3 (Montage Featured, 7 slots): Top remaining by productionRatio
 * Tier 4 (Montage Quick, 10 slots): Middle remaining
 * Tier 5 (Montage Flash, 8-12 slots): Remaining contestants
 */
export function assignNarrativeTiers(
  contestants: Contestant[],
  grades: Map<string, string>,
  songs: Map<string, string>, // contestant ID → song ID
): Map<string, number> {
  const tiers = new Map<string, number>();
  const remaining = new Set(contestants.map((c) => c.id));

  // Helper to remove contestants from remaining pool
  const assignTier = (contestantIds: string[], tier: number) => {
    for (const id of contestantIds) {
      tiers.set(id, tier);
      remaining.delete(id);
    }
  };

  // TIER 6: Not Broadcast (12 slots) - ASSIGN FIRST
  // F grades with lowest productionRatio - their auditions won't be shown
  const fGrades = contestants.filter((c) => grades.get(c.id) === GRADES.F);
  const notBroadcast = fGrades
    .sort((a, b) => a.aggregations.productionRatio - b.aggregations.productionRatio)
    .slice(0, 12);
  assignTier(
    notBroadcast.map((c) => c.id),
    6,
  );

  // TIER 1.5: Ace Closer (1 slot)
  // Highest A grade with highest productionRatio (heavily weighted)
  const aGrades = contestants.filter((c) => grades.get(c.id) === GRADES.A);
  if (aGrades.length > 0) {
    const aceCloser = aGrades.sort((a, b) => {
      // ProductionRatio is the primary factor for ace closer selection
      const prodDiff = b.aggregations.productionRatio - a.aggregations.productionRatio;
      if (Math.abs(prodDiff) > 0.01) return prodDiff;
      // Tie-breaker: extroversion + ambition
      return (
        b.personality.extroversion +
        b.personality.ambition -
        (a.personality.extroversion + a.personality.ambition)
      );
    })[0];
    assignTier([aceCloser.id], 1.5);
  }

  // TIER 1: Spotlight (8 slots total)
  const spotlightCandidates = contestants.filter((c) => remaining.has(c.id));

  // 3 Openers: High extroversion/ambition with good grades (A/B/C), productionRatio weighted
  const openers = spotlightCandidates
    .filter((c) => {
      const grade = grades.get(c.id);
      return grade === GRADES.A || grade === GRADES.B || grade === GRADES.C;
    })
    .sort((a, b) => {
      // ProductionRatio weighted 50%, personality 50%
      const scoreA =
        a.personality.extroversion + a.personality.ambition + a.aggregations.productionRatio * 20;
      const scoreB =
        b.personality.extroversion + b.personality.ambition + b.aggregations.productionRatio * 20;
      return scoreB - scoreA;
    })
    .slice(0, 3);
  assignTier(
    openers.map((c) => c.id),
    1,
  );

  // 3 Mid-Batch: High productionRatio with good grades (A/B/C)
  const midBatch = contestants
    .filter((c) => remaining.has(c.id))
    .filter((c) => {
      const grade = grades.get(c.id);
      return grade === GRADES.A || grade === GRADES.B || grade === GRADES.C;
    })
    .sort((a, b) => b.aggregations.productionRatio - a.aggregations.productionRatio)
    .slice(0, 3);
  assignTier(
    midBatch.map((c) => c.id),
    1,
  );

  // 2 Bombs: F grades with high extroversion OR high productionRatio (productionRatio weighted heavily)
  const bombs = contestants
    .filter((c) => remaining.has(c.id) && grades.get(c.id) === GRADES.F)
    .sort((a, b) => {
      // ProductionRatio weighted 70%, extroversion 30%
      const scoreA = a.personality.extroversion * 0.5 + a.aggregations.productionRatio * 20;
      const scoreB = b.personality.extroversion * 0.5 + b.aggregations.productionRatio * 20;
      return scoreB - scoreA;
    })
    .slice(0, 2);
  assignTier(
    bombs.map((c) => c.id),
    1,
  );

  // TIER 2: Quad Split (4 slots)
  // C/D grades MUST have the same song
  const quadSplitCandidates = contestants
    .filter((c) => remaining.has(c.id))
    .filter((c) => {
      const grade = grades.get(c.id);
      return grade === GRADES.C || grade === GRADES.D;
    });

  // Group by song and find the largest group with at least 4 contestants
  const songGroups = new Map<string, Contestant[]>();
  for (const c of quadSplitCandidates) {
    const song = songs.get(c.id) || '';
    if (!songGroups.has(song)) {
      songGroups.set(song, []);
    }
    songGroups.get(song)!.push(c);
  }

  // Find the largest group with at least 4 contestants, prioritize by productionRatio
  let quadSplit: Contestant[] = [];
  let largestGroupSize = 0;

  for (const group of songGroups.values()) {
    if (group.length >= 4 && group.length > largestGroupSize) {
      // Sort by productionRatio and take top 4
      quadSplit = group
        .sort((a, b) => b.aggregations.productionRatio - a.aggregations.productionRatio)
        .slice(0, 4);
      largestGroupSize = group.length;
    }
  }

  // If we found a valid quad split group, assign it
  if (quadSplit.length === 4) {
    assignTier(
      quadSplit.map((c) => c.id),
      2,
    );
  }
  // Otherwise, skip tier 2 entirely (no quad split this episode)

  // TIER 3: Montage Featured (7 slots)
  // Top remaining by productionRatio
  const montageFeatured = contestants
    .filter((c) => remaining.has(c.id))
    .sort((a, b) => b.aggregations.productionRatio - a.aggregations.productionRatio)
    .slice(0, 7);
  assignTier(
    montageFeatured.map((c) => c.id),
    3,
  );

  // TIER 4: Montage Quick (10 slots)
  // Middle remaining
  const montageQuick = contestants
    .filter((c) => remaining.has(c.id))
    .sort((a, b) => b.aggregations.productionRatio - a.aggregations.productionRatio)
    .slice(0, 10);
  assignTier(
    montageQuick.map((c) => c.id),
    4,
  );

  // TIER 5: Montage Flash (remaining, ~8-12 slots depending on tier 2)
  // All remaining contestants
  const montageFlash = contestants.filter((c) => remaining.has(c.id));
  assignTier(
    montageFlash.map((c) => c.id),
    5,
  );

  return tiers;
}

/**
 * Get screen time rewards for a given tier
 */
export function calculateScreenTime(tier: number): { screenTime: number; prodRatioDelta: number } {
  return TIER_REWARDS[tier] || { screenTime: 0, prodRatioDelta: 0 };
}
