import type { AuditionDice } from '../types/audition';
import type { Contestant } from '../types/contestant';
import type {
  DoubtGirlsMember,
  VersatilityBreakthrough,
  VersatilityEvaluation,
  VersatilitySong,
  VersatilityTeam,
  VersatilityTrack,
} from '../types/versatility-episode';
import { auditionGrade } from './audition-scoring';
import { battleCheck, clampBattle } from './battle-scoring';
import { versatilitySkill } from './versatility-draft';

export function scoreVersatility(
  contestant: Contestant,
  team: VersatilityTeam,
  song: VersatilitySong,
  track: VersatilityTrack,
  guest: DoubtGirlsMember,
  rawDice: AuditionDice,
  practice: number,
  refusalPenalty: 0 | -10,
): VersatilityEvaluation {
  if (
    track === contestant.track ||
    rawDice.length !== 2 ||
    rawDice.some((die) => !Number.isInteger(die) || die < 1 || die > 6)
  )
    throw new Error('A real off-track performance and saved 2d6 are required.');
  const part = song.parts.find((part) => part.id === team.partAssignments[contestant.id]);
  if (!part) throw new Error('Missing actual Versatility part.');
  const check = (skill: string, level: number, difficulty = 3) => {
    const result = battleCheck(skill, level, difficulty, rawDice);
    return { ...result, score: (100 * (result.adjustedDice[0] + result.adjustedDice[1] - 2)) / 10 };
  };
  const skill = versatilitySkill(track);
  const baseSkill = contestant.coreSkills[skill];
  const matchedSpecialty =
    guest.favoredSpecialties.find(
      (reference) => contestant.specialties[reference.field] === reference.value,
    ) ?? null;
  const effectiveGuestSkill = Math.min(5, baseSkill + (matchedSpecialty ? 2 : 0));
  const trackCheck = check(skill, baseSkill, part.alternatives[track].difficulty);
  const guestTrackCheck = check(skill, effectiveGuestSkill, part.alternatives[track].difficulty);
  const centerBonus = Number(team.centerId === contestant.id);
  const stageCheck = check('stagePresence', Math.min(5, contestant.coreSkills.stagePresence + centerBonus));
  const potentialCheck = check('potential', contestant.utilitySkills.potential);
  const uniquenessCheck = check('uniqueness', contestant.coreSkills.uniqueness);
  const visualCheck = check('visual', contestant.coreSkills.visual);
  const consistencyCheck = check('consistency', contestant.utilitySkills.consistency);
  const leadershipCheck = check('leadership', contestant.coreSkills.leadership);
  const john = trackCheck.score;
  const megan = (stageCheck.score + potentialCheck.score + uniquenessCheck.score) / 3;
  const michael = (visualCheck.score + consistencyCheck.score + leadershipCheck.score) / 3;
  const guestScore = 0.7 * guestTrackCheck.score + 0.3 * stageCheck.score;
  const weightedScore = (3 * trackCheck.score + 2 * guestScore + john + megan + michael) / 8;
  const finalScore = clampBattle(weightedScore + 2 * practice + team.coordination + refusalPenalty);
  const expressive = contestant.personality.curiosity >= 5 || contestant.specialties.visualVibe === 'CUTE';
  return {
    contestantId: contestant.id,
    track,
    partId: part.id,
    rawDice: [...rawDice],
    baseSkill,
    effectiveGuestSkill,
    matchedSpecialty,
    trackCheck,
    guestTrackCheck,
    stageCheck,
    potentialCheck,
    uniquenessCheck,
    visualCheck,
    consistencyCheck,
    leadershipCheck,
    john,
    megan,
    michael,
    guest: guestScore,
    weightedScore,
    practice,
    coordination: team.coordination,
    refusalPenalty,
    centerBonus,
    finalScore,
    grade: auditionGrade(finalScore),
    expressive,
    description: `${contestant.name} performs ${part.name} in ${track}: ${part.alternatives[track].action} ${finalScore >= 70 ? 'The passage lands confidently.' : finalScore >= 40 ? 'Some phrases land, while other details remain uneven.' : 'Missed details and hesitation remain visible.'}${expressive ? ' A playful change of expression catches the camera, independently of the technical result.' : ''}`,
  };
}

export function versatilityBreakthrough(
  contestant: Contestant,
  track: VersatilityTrack,
  gateDie: number,
  potentialDie: number,
): VersatilityBreakthrough {
  if (
    [gateDie, potentialDie].some((die) => !Number.isInteger(die) || die < 1 || die > 6) ||
    track === contestant.track
  )
    throw new Error('Invalid breakthrough dice or performed track.');
  const skill = versatilitySkill(track);
  const before = contestant.coreSkills[skill];
  const potential = contestant.utilitySkills.potential;
  const passed = gateDie === 6 && potentialDie <= potential;
  return {
    contestantId: contestant.id,
    skill,
    before,
    after: passed ? Math.min(5, before + 1) : before,
    gateDie,
    potentialDie,
    potential,
    passed,
  };
}
