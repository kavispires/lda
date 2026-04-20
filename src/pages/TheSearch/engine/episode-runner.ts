import type { ValuesOf } from 'types';
import type { PerformanceSong } from '../types/common';
import type { Contestant } from '../types/contestant';
import type { GRADES, STATUSES } from '../utilities/constants';
import { buildChangeLogEntry, generatePerformanceSummary, trackChanges } from './change-tracking';
import {
  applyPersonalityFactor,
  applyProducerInterference,
  assignPreliminaryGrades,
  calculateCharismaEdit,
  calculateProducerEdit,
  enforceQuotas,
  gradeToMissionRating,
} from './grading';
import { calculatePerformanceScore } from './performance-scoring';
import { updateRelationshipsAfterPerformances } from './relationships';
import { assignNarrativeTiers, calculateScreenTime } from './screen-time';
import { selectSongForContestant } from './song-selection';

/**
 * Performance result for tracking
 */
interface PerformanceResult {
  contestantId: string;
  songId: string;
  rawScore: number;
  modifiedScore: number;
  rngRoll: number;
}

/**
 * Run Episode 1: Audition
 * Orchestrates the entire audition episode for all 50 contestants
 * Returns array of mutated contestants with updated states
 */
export function runEpisode1(contestants: Contestant[], songs: PerformanceSong[]): Contestant[] {
  // Create deep copies of contestants to avoid mutating originals
  const workingContestants = contestants.map((c) => JSON.parse(JSON.stringify(c)) as Contestant);
  const originalContestants = contestants.map((c) => JSON.parse(JSON.stringify(c)) as Contestant);

  // Tracking maps
  const performances: PerformanceResult[] = [];
  const scores = new Map<string, number>();
  const selectedSongs = new Map<string, string>(); // contestant ID → song ID

  // ===== PHASE 1: PERFORMANCE & SCORING =====

  // Randomize contestant processing order
  const randomizedOrder = [...workingContestants].sort(() => Math.random() - 0.5);

  for (const contestant of randomizedOrder) {
    // Select song based on affinity
    const selectedSong = selectSongForContestant(contestant, songs);
    selectedSongs.set(contestant.id, selectedSong.id);

    // Calculate performance score
    const part = selectedSong.distribution[0];
    const { score: rawScore, rngRoll } = calculatePerformanceScore(contestant, part);

    // Apply personality factor
    const modifiedScore = applyPersonalityFactor(rawScore, contestant.personality);

    // Store results
    performances.push({
      contestantId: contestant.id,
      songId: selectedSong.id,
      rawScore,
      modifiedScore,
      rngRoll,
    });
    scores.set(contestant.id, modifiedScore);
  }

  // ===== PHASE 2: CHARISMA & PRODUCER EDITS =====

  for (const contestant of workingContestants) {
    // Apply charisma edit
    const charismaEdit = calculateCharismaEdit(contestant.utilitySkills.charisma);
    contestant.aggregations.productionRatio += charismaEdit;

    // Apply producer edit
    const producerEdit = calculateProducerEdit(contestant.personality, contestant.utilitySkills.charisma);
    contestant.aggregations.productionRatio += producerEdit;
  }

  // ===== PHASE 3: GRADING PIPELINE =====

  // Assign preliminary grades
  const scoreArray = Array.from(scores.entries()).map(([id, score]) => ({ id, score }));
  let grades = assignPreliminaryGrades(scoreArray);

  // Apply producer interference (15% rule)
  grades = applyProducerInterference(workingContestants, grades, scores);

  // Enforce quotas (6 A's, 20 F's)
  grades = enforceQuotas(grades, workingContestants, scores);

  // ===== PHASE 4: RELATIONSHIP UPDATES =====

  const updatedRelationships = updateRelationshipsAfterPerformances(workingContestants);

  // ===== PHASE 5: NARRATIVE TIERS & SCREEN TIME =====

  const tiers = assignNarrativeTiers(workingContestants, grades, selectedSongs);

  // ===== PHASE 5.5: COMMERCIAL BREAK STRUCTURE =====

  // Organize contestants into 4 segments divided by 3 commercial breaks
  // Segment 1: Tiers 5 (bottom 10 of flash montage)
  // COMMERCIAL BREAK 1
  // Segment 2: Tiers 5 (top 5 of flash montage) + Tier 4 (15 quick montage)
  // COMMERCIAL BREAK 2
  // Segment 3: Tier 3 (7 featured montage) + Tier 2 (quad split, if exists)
  // COMMERCIAL BREAK 3
  // Segment 4: Tier 1 (8 spotlight) + Tier 1.5 (ace closer)
  // ENDING: Next episode announcement

  const tierStructure = new Map<string, { segment: number; commercialBreakAfter?: string }>();

  // Sort contestants by tier for segment assignment
  const tier5 = workingContestants
    .filter((c) => tiers.get(c.id) === 5)
    .sort((a, b) => a.aggregations.productionRatio - b.aggregations.productionRatio);
  const tier4 = workingContestants.filter((c) => tiers.get(c.id) === 4);
  const tier3 = workingContestants.filter((c) => tiers.get(c.id) === 3);
  const tier2 = workingContestants.filter((c) => tiers.get(c.id) === 2);
  const tier1 = workingContestants.filter((c) => tiers.get(c.id) === 1);
  const tier1_5 = workingContestants.filter((c) => tiers.get(c.id) === 1.5);

  // Segment 1: Bottom 10 of Tier 5
  const segment1 = tier5.slice(0, 10);
  segment1.forEach((c) => {
    tierStructure.set(c.id, { segment: 1 });
  });
  if (segment1.length > 0) {
    tierStructure.set(segment1[segment1.length - 1].id, {
      segment: 1,
      commercialBreakAfter:
        '🎬 COMMERCIAL BREAK 1: Quick product placements and preview of upcoming stellar performances',
    });
  }

  // Segment 2: Top 5 of Tier 5 + All of Tier 4
  const segment2 = [...tier5.slice(10), ...tier4];
  segment2.forEach((c) => {
    tierStructure.set(c.id, { segment: 2 });
  });
  if (segment2.length > 0) {
    tierStructure.set(segment2[segment2.length - 1].id, {
      segment: 2,
      commercialBreakAfter:
        '🎬 COMMERCIAL BREAK 2: Dramatic teasers showing upcoming standout performances and potential grade reveals',
    });
  }

  // Segment 3: Tier 3 + Tier 2
  const segment3 = [...tier3, ...tier2];
  segment3.forEach((c) => {
    tierStructure.set(c.id, { segment: 3 });
  });
  if (segment3.length > 0) {
    tierStructure.set(segment3[segment3.length - 1].id, {
      segment: 3,
      commercialBreakAfter:
        '🎬 COMMERCIAL BREAK 3: Suspenseful montage of judges reactions and build-up to the final showstoppers',
    });
  }

  // Segment 4: Tier 1 + Tier 1.5
  const segment4 = [...tier1, ...tier1_5];
  segment4.forEach((c) => {
    tierStructure.set(c.id, { segment: 4 });
  });

  // ===== PHASE 6: MUTATION & CHANGE TRACKING =====

  // Calculate ranks based on grade first (A > B > C > D > F), then by score
  const gradeOrder = { A: 1, B: 2, C: 3, D: 4, F: 5 };
  const rankedContestants = [...workingContestants].sort((a, b) => {
    const gradeA = grades.get(a.id) || 'F';
    const gradeB = grades.get(b.id) || 'F';
    const gradeOrderA = gradeOrder[gradeA as keyof typeof gradeOrder];
    const gradeOrderB = gradeOrder[gradeB as keyof typeof gradeOrder];

    // First compare by grade
    if (gradeOrderA !== gradeOrderB) {
      return gradeOrderA - gradeOrderB;
    }

    // If grades are equal, compare by score (higher is better)
    const scoreA = scores.get(a.id) || 0;
    const scoreB = scores.get(b.id) || 0;
    return scoreB - scoreA;
  });
  const ranks = new Map<string, number>();
  rankedContestants.forEach((c, index) => {
    ranks.set(c.id, index + 1);
  });

  // Mutate contestants with all episode results
  for (const contestant of workingContestants) {
    const original = originalContestants.find((c) => c.id === contestant.id);
    const performance = performances.find((p) => p.contestantId === contestant.id);
    const grade = grades.get(contestant.id);
    const tier = tiers.get(contestant.id) || 5;
    const rank = ranks.get(contestant.id) || 50;
    const song = songs.find((s) => s.id === selectedSongs.get(contestant.id));

    if (!original || !performance || !grade || !song) {
      // Skip contestant if critical data is missing
      continue;
    }

    // Update missionRating
    contestant.missionRating = gradeToMissionRating(grade);

    // Update grade (cast to proper type)
    contestant.grade = grade as ValuesOf<typeof GRADES>;

    // Update aggregations
    const scoreBonus = Math.floor(performance.modifiedScore);
    contestant.aggregations.score += scoreBonus;

    const tierRewards = calculateScreenTime(tier);
    contestant.aggregations.screenTime += tierRewards.screenTime;
    contestant.aggregations.productionRatio += tierRewards.prodRatioDelta;

    // Update rank
    contestant.rank = rank;

    // Update relationships
    const newRelationships = updatedRelationships.get(contestant.id);
    if (newRelationships) {
      contestant.relationships = newRelationships;
    }

    // Track all changes
    const changes = trackChanges(original, contestant);

    // Generate summary
    const summary = generatePerformanceSummary(contestant, song, grade, performance.rngRoll);

    // Build and append ChangeLogEntry
    const logEntry = buildChangeLogEntry(
      contestant,
      1, // Episode 1
      contestant.missionRating,
      rank,
      changes,
      summary,
      [], // No event cards triggered in Episode 1
    );

    // Store tier and song info in the change log for narrative reconstruction
    logEntry.change['tier'] = tier;
    logEntry.change['songId'] = selectedSongs.get(contestant.id) || '';

    // Store segment and commercial break info
    const structure = tierStructure.get(contestant.id);
    if (structure) {
      logEntry.change['segment'] = structure.segment;
      if (structure.commercialBreakAfter) {
        logEntry.change['commercialBreakAfter'] = structure.commercialBreakAfter;
      }
    }

    contestant.changeLog.push(logEntry);

    // Update timestamp
    contestant.updatedAt = Date.now();
  }

  // ===== ELIMINATIONS =====
  // Eliminate contestants ranked 31-50
  for (const contestant of workingContestants) {
    const rank = ranks.get(contestant.id) || 50;
    if (rank > 30) {
      contestant.status = 'ELIMINATED' as ValuesOf<typeof STATUSES>;
      // Update the change log to reflect elimination
      const lastEntry = contestant.changeLog[contestant.changeLog.length - 1];
      if (lastEntry) {
        lastEntry.status = 'ELIMINATED' as ValuesOf<typeof STATUSES>;
        lastEntry.summary += ` Unfortunately, with a rank of ${rank}, they are eliminated from the competition.`;
      }
    }
  }

  // ===== ENDING ANNOUNCEMENT =====
  // Add a special ending announcement to the first contestant's change log
  // (This will be displayed at the end of the episode narrative)
  if (workingContestants.length > 0) {
    const firstContestant = workingContestants[0];
    const eliminatedContestants = workingContestants.filter((c) => c.status === 'ELIMINATED');
    const eliminatedCount = eliminatedContestants.length;

    // Get top 5 contestants by rank
    const top5 = rankedContestants.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      rank: ranks.get(c.id) || 0,
    }));

    // Get eliminated contestants info
    const eliminated = eliminatedContestants
      .map((c) => ({
        id: c.id,
        name: c.name,
        rank: ranks.get(c.id) || 0,
      }))
      .sort((a, b) => a.rank - b.rank);

    const endingAnnouncement = {
      type: 'EPISODE_ENDING',
      message: `🎭 Episode 1 Complete! The auditions are over. 50 contestants have given their all, but only 30 will move forward. ${eliminatedCount} contestants ranked 31-50 have been eliminated. The remaining 30 survivors will face even greater challenges in Episode 2. Who will rise? Who will fall? Find out next time!`,
      top5,
      eliminated,
    };
    // Store in the last entry's change object as JSON string
    const lastEntry = firstContestant.changeLog[firstContestant.changeLog.length - 1];
    if (lastEntry) {
      lastEntry.change['episodeEnding'] = JSON.stringify(endingAnnouncement);
    }
  }

  return workingContestants;
}
