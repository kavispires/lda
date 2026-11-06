import type { AuditionDice } from '../types/audition';
import type { Contestant } from '../types/contestant';
import type {
  TrackSpecialEvaluation,
  TrackSpecialSong,
  TrackSpecialTeam,
} from '../types/track-specials-episode';
import { auditionGrade } from './audition-scoring';
import { battleCheck, clampBattle } from './battle-scoring';
import { trackSkill } from './track-specials-grouping';

export function trackSpecialScore(
  contestant: Contestant,
  team: TrackSpecialTeam,
  song: TrackSpecialSong,
  dice: AuditionDice,
  readiness: number,
): TrackSpecialEvaluation {
  if (dice.length !== 2 || dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6))
    throw new Error('Track Specials requires one saved 2d6 pair.');
  const part = song.arrangements[String(team.memberIds.length) as '1'].find(
    (entry) => entry.id === team.partAssignments[contestant.id],
  );
  if (!part || song.track !== contestant.track || ![0, -5].includes(readiness))
    throw new Error('Invalid track performance arrangement or readiness.');
  const check = (skill: keyof Contestant['coreSkills'], level: number, required = 3) => {
    const raw = battleCheck(skill, level, required, dice);
    return { ...raw, score: (raw.score * 100) / (50 + 10 * required) };
  };
  const track = trackSkill(contestant.track);
  const trackCheck = check(track, contestant.coreSkills[track], part.requiredLevel);
  const centerBonus = team.centerId === contestant.id ? 1 : 0;
  const stageCheck = check(
    'stagePresence',
    clampBattle(contestant.coreSkills.stagePresence + centerBonus, 1, 5),
  );
  const visualCheck = check('visual', contestant.coreSkills.visual);
  const uniquenessCheck = check('uniqueness', contestant.coreSkills.uniqueness);
  const technicalScore =
    0.65 * trackCheck.score +
    0.2 * stageCheck.score +
    0.15 * ((visualCheck.score + uniquenessCheck.score) / 2);
  const practice = contestant.aggregations.practice;
  const rawScore = clampBattle(technicalScore + 2 * practice + team.coordination + readiness);
  const grade = auditionGrade(rawScore);
  return {
    contestantId: contestant.id,
    partId: part.id,
    rawDice: [...dice],
    trackCheck,
    stageCheck,
    visualCheck,
    uniquenessCheck,
    practice,
    coordination: team.coordination,
    revealReadiness: readiness,
    centerBonus,
    technicalScore,
    rawScore,
    finalScore: rawScore,
    grade,
    description: `${contestant.name} performs ${part.name}: ${rawScore >= 70 ? 'a clear, assured delivery' : rawScore >= 40 ? 'an uneven delivery with moments that land' : 'a hesitant delivery with visible missed details'}. Performance: ${grade}.`,
  };
}

export function preserveTrackCondition(current: string, requested: 'STRESSED' | 'ANXIOUS' | 'DEPRESSED') {
  if (['INJURED', 'RECOVERING', 'EXHAUSTED'].includes(current)) return current;
  const severity: Record<string, number> = { STRESSED: 1, ANXIOUS: 2, DEPRESSED: 3 };
  return (severity[current] ?? 0) >= severity[requested] ? current : requested;
}

export function trackRevealReaction(contestant: Contestant) {
  const traits = contestant.personality;
  const protectedFromStress = traits.resilience >= 5 || traits.ambition >= 5;
  const pressured = !protectedFromStress && (traits.sensitivity >= 5 || traits.sincerity >= 5);
  const reunion = traits.extroversion >= 5 ? 3 : 0;
  const happinessBefore = contestant.aggregations.happiness;
  const happinessDelta = reunion - (pressured ? 5 : 0);
  const conditionBefore = contestant.condition;
  const conditionAfter = pressured
    ? preserveTrackCondition(conditionBefore, traits.sensitivity >= 5 ? 'ANXIOUS' : 'STRESSED')
    : conditionBefore;
  return {
    readiness: (pressured ? -5 : 0) as 0 | -5,
    happinessBefore,
    happinessAfter: clampBattle(happinessBefore + happinessDelta),
    happinessDelta,
    conditionBefore,
    conditionAfter,
    description: `${contestant.name} ${pressured ? 'feels the pressure of being judged by former competitors' : protectedFromStress ? 'keeps a competitive focus despite the surprise' : 'takes a moment to absorb the unexpected panel'}${reunion ? ', and brightens at the reunion' : ''}.`,
  };
}
