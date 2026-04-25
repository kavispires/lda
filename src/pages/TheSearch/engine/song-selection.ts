import type { PerformancePart, PerformanceSong } from '../types/common';
import type { Contestant } from '../types/contestant';

/**
 * Calculate affinity score for a contestant-song pairing
 * Higher score = better match
 *
 * Factors:
 * - Skill match delta (lower delta = better)
 * - Specialty bonus if song favors contestant's specialties
 * - Personality overrides (ambition, curiosity, sincerity, discipline)
 */
export function calculateAffinityScore(contestant: Contestant, song: PerformanceSong): number {
  const part = song.distribution[0]; // Auditions only have 1 part

  // BASELINE: Calculate skill match delta
  const vocalDelta = Math.abs(contestant.coreSkills.vocals - part.difficulty.vocal);
  const rapDelta = Math.abs(contestant.coreSkills.rap - part.difficulty.rap);
  const danceDelta = Math.abs(contestant.coreSkills.dance - part.difficulty.dance);

  // Lower delta is better - invert and normalize (max delta per skill = 4, so max total = 12)
  // Convert to 0-100 baseline score (perfect match = 100, max mismatch = 0)
  const totalDelta = vocalDelta + rapDelta + danceDelta;
  let affinityScore = Math.max(0, 100 - totalDelta * 8.33); // 12 delta = 0 score, 0 delta = 100 score

  // SPECIALTY BONUS: +20% if part favors contestant's specialty
  const specialtyMatch = checkSpecialtyMatch(contestant, part);
  if (specialtyMatch) {
    affinityScore *= 1.2;
  }

  // PERSONALITY OVERRIDES
  const avgDifficulty = (part.difficulty.vocal + part.difficulty.rap + part.difficulty.dance) / 3;
  const hasHighRiskModifiers = Object.values(part.modifiersWeight).some((weight) => weight >= 0.15);

  // High ambition or curiosity: +15% for challenging songs
  if (contestant.personality.ambition >= 8 || contestant.personality.curiosity >= 8) {
    if (avgDifficulty >= 3.5 || hasHighRiskModifiers) {
      affinityScore *= 1.15;
    }
  }

  // High sincerity AND low curiosity: +20% for perfectly matched songs
  if (contestant.personality.sincerity >= 8 && contestant.personality.curiosity <= 4) {
    if (totalDelta <= 1.5) {
      // Skill delta <= 0.5 per skill on average
      affinityScore *= 1.2;
    }
  }

  // Low discipline: -25% for stamina/memory heavy songs
  if (contestant.personality.discipline <= 3) {
    const hasHighStaminaOrMemory =
      (part.modifiersWeight['utilitySkills.stamina'] || 0) >= 0.1 ||
      (part.modifiersWeight['utilitySkills.memory'] || 0) >= 0.1;

    if (hasHighStaminaOrMemory) {
      affinityScore *= 0.75;
    }
  }

  return affinityScore;
}

/**
 * Check if a performance part favors any of the contestant's specialties
 */
function checkSpecialtyMatch(contestant: Contestant, part: PerformancePart): boolean {
  const favors = part.specialtyFavors;
  const specialties = contestant.specialties;

  if (favors.vocalColor && favors.vocalColor === specialties.vocalColor) {
    return true;
  }
  if (favors.rapStyle && favors.rapStyle === specialties.rapStyle) {
    return true;
  }
  if (favors.danceStyle && favors.danceStyle === specialties.danceStyle) {
    return true;
  }
  if (favors.visualVibe && favors.visualVibe === specialties.visualVibe) {
    return true;
  }

  return false;
}

/**
 * Select the best song for a contestant based on affinity scores
 * Returns the song with the highest affinity score
 * In case of ties, randomly selects one
 */
export function selectSongForContestant(
  contestant: Contestant,
  availableSongs: PerformanceSong[],
): PerformanceSong {
  if (availableSongs.length === 0) {
    throw new Error('No available songs to select from');
  }

  // Filter songs to match contestant's track
  const trackMatchedSongs = availableSongs.filter((song) => song.distribution[0].track === contestant.track);

  if (trackMatchedSongs.length === 0) {
    throw new Error(`No songs available for track: ${contestant.track}`);
  }

  if (trackMatchedSongs.length === 1) {
    return trackMatchedSongs[0];
  }

  // Calculate affinity scores for track-matched songs
  const songScores = trackMatchedSongs.map((song) => ({
    song,
    score: calculateAffinityScore(contestant, song),
  }));

  // Find the highest score
  const maxScore = Math.max(...songScores.map((s) => s.score));

  // Get all songs with the max score (handle ties)
  const topSongs = songScores.filter((s) => s.score === maxScore);

  // Randomly select from top songs if there's a tie
  const selectedIndex = Math.floor(Math.random() * topSongs.length);

  return topSongs[selectedIndex].song;
}
