import type { AuditionDice } from '../types/audition';
import type { Contestant } from '../types/contestant';
import type { SpecialtiesPerformance, SpecialtiesRehearsal } from '../types/specialties-episode';
import { battleCheck, clampBattle } from './battle-scoring';

export const specialtiesMean = (values: readonly number[]) => {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error('Missing finite Specialties evidence.');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};
function check(skill: string, level: number, dice: AuditionDice, weight = 1) {
  if (dice.length !== 2 || dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6))
    throw new Error('Specialties requires saved 2d6.');
  const result = battleCheck(skill, level, 3, dice, weight);
  return { ...result, score: 10 * (result.adjustedDice[0] + result.adjustedDice[1] - 2) };
}
export function rehearseSpecialties(
  person: Contestant,
  session: 1 | 2,
  rawDice: AuditionDice,
  practiceBefore = 0,
): SpecialtiesRehearsal {
  const skills =
    session === 1
      ? (['learning', 'memory', 'consistency'] as const)
      : (['stamina', 'consistency', 'memory'] as const);
  const checks = skills.map((skill, index) =>
    check(skill, person.utilitySkills[skill], rawDice, index === 0 ? 2 : 1),
  );
  const weightedSum =
    checks.reduce((sum, value) => sum + value.weight * (value.adjustedDice[0] + value.adjustedDice[1]), 0) /
    4;
  const sessionPractice = Math.min(5, Math.floor(weightedSum / 2));
  const enduranceStruggle = session === 2 && person.utilitySkills.consistency < 3 && checks[0].score < 50;
  return {
    contestantId: person.id,
    session,
    rawDice: [...rawDice],
    checks,
    weightedSum,
    sessionPractice,
    practiceBefore,
    practiceAfter: Math.max(practiceBefore, sessionPractice),
    enduranceStruggle,
    readinessModifier: enduranceStruggle ? -5 : 0,
  };
}
export function scoreSpecialtiesSolo(
  person: Contestant,
  songId: string,
  rawDice: AuditionDice,
  practice: number,
  readinessModifier: number,
): SpecialtiesPerformance {
  const track = person.track === 'VOCAL' ? 'vocals' : person.track === 'RAP' ? 'rap' : 'dance';
  const checks = {
    track: check(track, person.coreSkills[track], rawDice),
    stagePresence: check('stagePresence', person.coreSkills.stagePresence, rawDice),
    visual: check('visual', person.coreSkills.visual, rawDice),
    uniqueness: check('uniqueness', person.coreSkills.uniqueness, rawDice),
    potential: check('potential', person.utilitySkills.potential, rawDice),
    consistency: check('consistency', person.utilitySkills.consistency, rawDice),
    leadership: check('leadership', person.coreSkills.leadership, rawDice),
  };
  const matchedTrack = clampBattle(checks.track.score + 10);
  const matchedVisual = clampBattle(checks.visual.score + 10);
  const technical = clampBattle(matchedTrack + 2 * practice + readinessModifier);
  const shrinking =
    (person.personality.extroversion <= -5 || person.coreSkills.leadership < 3) &&
    rawDice[0] + rawDice[1] <= 4 &&
    checks.stagePresence.score < 50;
  const adjustedStage = clampBattle(checks.stagePresence.score - (shrinking ? 5 : 0));
  const trainerAwe =
    person.coreSkills.stagePresence >= 4 && person.personality.ambition >= 5 && adjustedStage >= 85;
  const john = technical;
  const megan = specialtiesMean([adjustedStage, checks.uniqueness.score, checks.potential.score]);
  const michael = specialtiesMean([matchedVisual, checks.consistency.score, checks.leadership.score]);
  const observedScore = (3 * technical + john + megan + michael) / 6;
  return {
    contestantId: person.id,
    songId,
    rawDice: [...rawDice],
    checks,
    matchedTrack,
    matchedVisual,
    practice,
    readinessModifier,
    shrinking,
    adjustedStage,
    trainerAwe,
    technical,
    john,
    megan,
    michael,
    observedScore,
    comments: [
      {
        judgeId: 'john',
        description: `John: "Your ${track} execution ${technical >= 70 ? 'stays clear through the complete arrangement' : technical >= 50 ? 'holds the main phrases with some uneven transitions' : 'needs cleaner control through the full phrases'}."`,
      },
      {
        judgeId: 'megan',
        description: `Megan: "Your stage expression ${megan >= 70 ? 'has a distinct, sustained identity' : 'needs a clearer connection between the details and the whole'}."${shrinking ? ' A brief retreat on the low opening cue is visible.' : ''}${trainerAwe ? ' The assured stage command genuinely impresses the trainers.' : ''}`,
      },
      {
        judgeId: 'michael',
        description: `Michael: "The camera framing, preparation and self-direction ${michael >= 70 ? 'support a controlled solo' : 'show specific places to sharpen the finish'}."`,
      },
    ],
  };
}
export const specialtiesFinalScore = (performance: SpecialtiesPerformance, peer: number) =>
  (3 * performance.technical + performance.john + performance.megan + performance.michael + 2 * peer) / 8;
