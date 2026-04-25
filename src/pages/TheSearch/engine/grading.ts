import type { Contestant, PersonalityTraits } from '../types/contestant';
import { GRADES } from '../utilities/constants';

/**
 * Apply personality factor to performance score
 * Discipline + Resilience buff/debuff
 * Curiosity gamble for high curiosity contestants
 */
export function applyPersonalityFactor(score: number, personality: PersonalityTraits): number {
  let modifiedScore = score;

  // Discipline + Resilience check
  const disciplineResilience = personality.discipline + personality.resilience;

  if (disciplineResilience >= 10) {
    modifiedScore *= 1.05; // +5% buff
  } else if (disciplineResilience <= -10) {
    modifiedScore *= 0.95; // -5% debuff
  }

  // Curiosity gamble (50/50 for +8% or -8%)
  if (personality.curiosity >= 8) {
    const gamble = Math.random() < 0.5 ? 1.08 : 0.92;
    modifiedScore *= gamble;
  }

  return modifiedScore;
}

/**
 * Calculate charisma edit for productionRatio
 * Mapping: 1→-0.02, 2→-0.01, 3→0.00, 4→+0.01, 5→+0.05
 */
export function calculateCharismaEdit(charisma: number): number {
  const charismaMap: Record<number, number> = {
    1: -0.02,
    2: -0.01,
    3: 0.0,
    4: 0.01,
    5: 0.05,
  };

  return charismaMap[charisma] || 0;
}

/**
 * Calculate producer edit for productionRatio
 * Based on investment, extroversion, ambition, and extreme traits
 */
export function calculateProducerEdit(personality: PersonalityTraits, charisma: number): number {
  let edit = 0;

  // Start with charisma edit
  edit += calculateCharismaEdit(charisma);

  // Investment penalty (below 0)
  if (personality.investment < 0) {
    edit += personality.investment * 0.01; // Each point below 0 = -0.01
  }

  // Extroversion bonus (above 5)
  if (personality.extroversion > 5) {
    edit += (personality.extroversion - 5) * 0.01;
  }

  // Ambition bonus (above 5)
  if (personality.ambition > 5) {
    edit += (personality.ambition - 5) * 0.01;
  }

  // Extreme trait bonus (+0.03 if any trait is exactly 10 or -10)
  const traits = Object.values(personality);
  if (traits.some((t) => t === 10 || t === -10)) {
    edit += 0.03;
  }

  return edit;
}

/**
 * Assign preliminary grades based on standard curve
 * Top 20% = A, next 20% = B, middle 20% = C, next 20% = D, bottom 20% = F
 */
export function assignPreliminaryGrades(scores: Array<{ id: string; score: number }>): Map<string, string> {
  const grades = new Map<string, string>();

  // Sort by score descending
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const total = sorted.length;

  // Calculate thresholds (20% each)
  const aThreshold = Math.floor(total * 0.2);
  const bThreshold = Math.floor(total * 0.4);
  const cThreshold = Math.floor(total * 0.6);
  const dThreshold = Math.floor(total * 0.8);

  sorted.forEach((entry, index) => {
    if (index < aThreshold) {
      grades.set(entry.id, GRADES.A);
    } else if (index < bThreshold) {
      grades.set(entry.id, GRADES.B);
    } else if (index < cThreshold) {
      grades.set(entry.id, GRADES.C);
    } else if (index < dThreshold) {
      grades.set(entry.id, GRADES.D);
    } else {
      grades.set(entry.id, GRADES.F);
    }
  });

  return grades;
}

/**
 * Apply producer interference (15% rule)
 * Top 15% productionRatio: +1 grade
 * Bottom 15%: -1 grade
 */
export function applyProducerInterference(
  contestants: Contestant[],
  preliminaryGrades: Map<string, string>,
  scores: Map<string, number>,
): Map<string, string> {
  const grades = new Map(preliminaryGrades);

  // Sort by productionRatio
  const sorted = [...contestants].sort(
    (a, b) => b.aggregations.productionRatio - a.aggregations.productionRatio,
  );

  const total = sorted.length;
  const top15Count = Math.ceil(total * 0.15); // 8 contestants for 50
  const bottom15Count = Math.ceil(total * 0.15);

  // Top 15%: +1 grade
  for (let i = 0; i < top15Count; i++) {
    const contestant = sorted[i];
    const currentGrade = grades.get(contestant.id);
    if (currentGrade) {
      grades.set(contestant.id, bumpGradeUp(currentGrade));
    }
  }

  // Bottom 15%: -1 grade
  for (let i = total - bottom15Count; i < total; i++) {
    const contestant = sorted[i];
    const currentGrade = grades.get(contestant.id);
    if (currentGrade) {
      grades.set(contestant.id, bumpGradeDown(currentGrade));
    }
  }

  return grades;
}

/**
 * Enforce quotas: exactly 6 A's and 20 F's
 */
export function enforceQuotas(
  grades: Map<string, string>,
  contestants: Contestant[],
  scores: Map<string, number>,
): Map<string, string> {
  const finalGrades = new Map(grades);

  // Count current grades
  let aCount = 0;
  let fCount = 0;

  for (const grade of finalGrades.values()) {
    if (grade === GRADES.A) aCount++;
    if (grade === GRADES.F) fCount++;
  }

  // Sort contestants by score for edge case selection
  const sortedByScore = [...contestants].sort((a, b) => {
    const scoreA = scores.get(a.id) || 0;
    const scoreB = scores.get(b.id) || 0;
    return scoreB - scoreA;
  });

  // Enforce A quota (need exactly 6)
  if (aCount < 6) {
    // Promote closest B's
    const needed = 6 - aCount;
    const bContestants = sortedByScore.filter((c) => finalGrades.get(c.id) === GRADES.B);
    for (let i = 0; i < needed && i < bContestants.length; i++) {
      finalGrades.set(bContestants[i].id, GRADES.A);
    }
  } else if (aCount > 6) {
    // Demote excess A's
    const excess = aCount - 6;
    const aContestants = sortedByScore.filter((c) => finalGrades.get(c.id) === GRADES.A).reverse(); // Start from lowest scoring A's
    for (let i = 0; i < excess && i < aContestants.length; i++) {
      finalGrades.set(aContestants[i].id, GRADES.B);
    }
  }

  // Enforce F quota (need exactly 20)
  if (fCount < 20) {
    // Demote closest D's
    const needed = 20 - fCount;
    const dContestants = sortedByScore.filter((c) => finalGrades.get(c.id) === GRADES.D).reverse(); // Start from lowest scoring D's
    for (let i = 0; i < needed && i < dContestants.length; i++) {
      finalGrades.set(dContestants[i].id, GRADES.F);
    }
  } else if (fCount > 20) {
    // Promote excess F's
    const excess = fCount - 20;
    const fContestants = sortedByScore.filter((c) => finalGrades.get(c.id) === GRADES.F);
    for (let i = 0; i < excess && i < fContestants.length; i++) {
      finalGrades.set(fContestants[i].id, GRADES.D);
    }
  }

  return finalGrades;
}

/**
 * Convert grade to missionRating (1-5 scale)
 */
export function gradeToMissionRating(grade: string): number {
  const gradeMap: Record<string, number> = {
    [GRADES.A]: 5,
    [GRADES.B]: 4,
    [GRADES.C]: 3,
    [GRADES.D]: 2,
    [GRADES.F]: 1,
  };

  return gradeMap[grade] || 1;
}

/**
 * Apply potential bumps to low-performing contestants
 * High potential (4-5) can bump F grades up to D or C
 */
export function applyPotentialBumps(
  grades: Map<string, string>,
  contestants: Contestant[],
): Map<string, string> {
  const finalGrades = new Map(grades);

  for (const contestant of contestants) {
    const currentGrade = finalGrades.get(contestant.id);
    const potential = contestant.utilitySkills.potential;

    // Only bump F grades based on high potential
    if (currentGrade === GRADES.F) {
      if (potential === 5) {
        // Potential 5: F → C (major breakthrough potential)
        finalGrades.set(contestant.id, GRADES.C);
      } else if (potential === 4) {
        // Potential 4: F → D (solid breakthrough potential)
        finalGrades.set(contestant.id, GRADES.D);
      }
    }
  }

  return finalGrades;
}

/**
 * Helper: Bump grade up (F→D→C→B→A, A stays A)
 */
function bumpGradeUp(grade: string): string {
  const progression: Record<string, string> = {
    [GRADES.F]: GRADES.D,
    [GRADES.D]: GRADES.C,
    [GRADES.C]: GRADES.B,
    [GRADES.B]: GRADES.A,
    [GRADES.A]: GRADES.A,
  };

  return progression[grade] || grade;
}

/**
 * Helper: Bump grade down (A→B→C→D→F, F stays F)
 */
function bumpGradeDown(grade: string): string {
  const progression: Record<string, string> = {
    [GRADES.A]: GRADES.B,
    [GRADES.B]: GRADES.C,
    [GRADES.C]: GRADES.D,
    [GRADES.D]: GRADES.F,
    [GRADES.F]: GRADES.F,
  };

  return progression[grade] || grade;
}
