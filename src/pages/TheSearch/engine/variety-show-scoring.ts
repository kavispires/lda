import type { AuditionDice } from '../types/audition';
import type { Contestant } from '../types/contestant';
import type {
  VarietyShowEvaluation,
  VarietyShowEvent,
  VarietyShowPanelAssessment,
  VarietyShowSegment,
  VarietyShowSegmentKind,
} from '../types/variety-show-episode';
import { auditionGrade } from './audition-scoring';
import { battleCheck, battleRelationship, clampBattle } from './battle-scoring';

export const varietyMean = (values: readonly number[]) => {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error('Variety Show requires finite, nonempty score evidence.');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export function scoreVarietyShow(
  contestant: Contestant,
  kind: VarietyShowSegmentKind,
  rawDice: AuditionDice,
): VarietyShowEvaluation {
  if (rawDice.length !== 2 || rawDice.some((die) => !Number.isInteger(die) || die < 1 || die > 6))
    throw new Error('Variety Show requires saved 2d6.');
  const check = (skill: 'stamina' | 'acrobatics' | 'charisma') => {
    const result = battleCheck(skill, contestant.utilitySkills[skill], 3, rawDice);
    return { ...result, score: (100 * (result.adjustedDice[0] + result.adjustedDice[1] - 2)) / 10 };
  };
  const checks = {
    charisma: check('charisma'),
    stamina: kind === 'physical' ? check('stamina') : null,
    acrobatics: kind === 'physical' ? check('acrobatics') : null,
  };
  const p = contestant.personality;
  const normalizedTraits = {
    sincerity: 5 * (p.sincerity + 10),
    maturity: 5 * (p.maturity + 10),
    curiosity: 5 * (p.curiosity + 10),
    extroversion: 5 * (p.extroversion + 10),
  };
  const baseScore =
    kind === 'physical'
      ? 0.4 * checks.stamina!.score + 0.35 * checks.acrobatics!.score + 0.25 * checks.charisma.score
      : kind === 'interview'
        ? 0.5 * checks.charisma.score + 0.25 * normalizedTraits.sincerity + 0.25 * normalizedTraits.maturity
        : 0.4 * checks.charisma.score +
          0.35 * normalizedTraits.curiosity +
          0.25 * normalizedTraits.extroversion;
  const events: VarietyShowEvent[] = [];
  const event = (
    kind: VarietyShowEvent['kind'],
    description: string,
    personal: number,
    reception: number,
    comic = 0,
  ) => events.push({ kind, description, personal, reception, spotlight: 1, comic });
  const sum = rawDice[0] + rawDice[1];
  if (kind === 'physical') {
    if (p.extroversion >= 5)
      event('hype', 'Turns the safe prop handoff into an exaggerated slow-motion celebration.', 0, 3, 2);
    if (p.discipline >= 5 && p.curiosity <= -5 && checks.charisma.score < 50)
      event(
        'stiff',
        'Clings to the exact handoff order; the deliberately comic pause comes out stiff.',
        -5,
        -2,
        -2,
      );
  } else if (kind === 'interview') {
    if (p.sincerity >= 5)
      event('thoughtful', 'Offers a thoughtful public anecdote and an unforced, specific answer.', 0, 5);
    if (p.sincerity <= -5 && p.ambition >= 5 && sum <= 4)
      event(
        'calculated-fumble',
        'A rehearsed boast overcomplicates the public question; the punch line falls flat.',
        -5,
        -5,
        -3,
      );
    if (p.sensitivity >= 5 && sum <= 4)
      event(
        'sensitive-fumble',
        'Loses the thread mid-answer and pauses before finishing the thought.',
        -5,
        -2,
        -2,
      );
    else if (p.sensitivity >= 5 && checks.charisma.score >= 70)
      event(
        'shy-recovery',
        'A quiet, self-aware aside turns initial shyness into an endearing exchange.',
        0,
        5,
        2,
      );
  } else if (baseScore < 50 && p.resilience >= 5)
    event(
      'recovery',
      'The first joke fails. A clear callback to the misplaced prop gets a separate laugh and rescues the exchange.',
      5,
      5,
      3,
    );
  const modifier = clampBattle(
    events.reduce((sum, entry) => sum + entry.personal, 0),
    -10,
    10,
  );
  const personalScore = clampBattle(baseScore + modifier);
  return {
    contestantId: contestant.id,
    rawDice: [...rawDice],
    checks,
    normalizedTraits,
    baseScore,
    events,
    modifier,
    receptionModifier: clampBattle(
      events.reduce((sum, entry) => sum + entry.reception, 0),
      -10,
      10,
    ),
    personalScore,
    finalScore: null,
    grade: null,
    description: `${contestant.name} ${
      kind === 'physical'
        ? 'takes a complete turn carrying and passing the safe props'
        : kind === 'interview'
          ? 'answers the public question in their own words'
          : 'contributes a distinct entrance, response and handoff to the scene'
    }. ${events.map((entry) => entry.description).join(' ') || (personalScore >= 60 ? 'The contribution connects clearly.' : 'Some timing and delivery remain uneven.')}`,
  };
}

export function finalizeVarietyShowSegment(segment: VarietyShowSegment, coordination: number): void {
  if (segment.evaluations.length !== 4 || segment.teamScore !== null)
    throw new Error('Finalize a Variety Show team only after its four actual turns.');
  segment.cohesion =
    segment.kind === 'improv'
      ? clampBattle(
          (varietyMean(
            segment.frozenContestants.flatMap((from) =>
              segment.frozenContestants
                .filter((to) => to.id !== from.id)
                .map((to) => battleRelationship(from, to.id)),
            ),
          ) -
            50) /
            10,
          -5,
          5,
        )
      : 0;
  segment.coordination = segment.kind === 'improv' ? coordination : 0;
  segment.chaosPenalty =
    segment.kind === 'improv' &&
    Math.max(...segment.frozenContestants.map((person) => person.coreSkills.leadership)) < 3
      ? -15
      : 0;
  segment.teamScore = clampBattle(
    varietyMean(segment.evaluations.map((entry) => entry.personalScore)) +
      segment.cohesion +
      segment.coordination +
      segment.chaosPenalty,
  );
  for (const entry of segment.evaluations) {
    entry.finalScore = 0.7 * entry.personalScore + 0.3 * segment.teamScore;
    entry.grade = auditionGrade(entry.finalScore);
  }
}

export function assessVarietyShow(
  contestantId: string,
  segments: readonly VarietyShowSegment[],
): VarietyShowPanelAssessment {
  const acts = (['physical', 'interview', 'improv'] as const).map((kind) => {
    const act = segments.find(
      (segment) =>
        segment.kind === kind && segment.evaluations.some((entry) => entry.contestantId === contestantId),
    );
    const evaluation = act?.evaluations.find((entry) => entry.contestantId === contestantId);
    if (!act || act.teamScore === null || !evaluation || evaluation.finalScore === null)
      throw new Error('All three actual segments are required before the final panel.');
    return { act, evaluation };
  });
  const personal = acts.map(({ evaluation }) => evaluation.personalScore);
  const charisma = varietyMean(acts.map(({ evaluation }) => evaluation.checks.charisma.score));
  const variety = varietyMean(acts.map(({ evaluation }) => evaluation.finalScore!));
  const john = personal[0];
  const megan = (personal[1] + personal[2]) / 2;
  const michael = 0.7 * charisma + 0.3 * varietyMean(acts.map(({ act }) => act.teamScore!));
  const roxana = 0.6 * charisma + 0.4 * Math.min(...personal);
  const finalScore = clampBattle((variety + john + megan + michael + roxana) / 5);
  return {
    contestantId,
    variety,
    john,
    megan,
    michael,
    roxana,
    finalScore,
    grade: auditionGrade(finalScore),
    comments: [
      {
        judgeId: 'john',
        description: `John: "The prop handoff and controlled physical delivery support ${john.toFixed(1)}."`,
      },
      {
        judgeId: 'megan',
        description: `Megan: "The public answer and the improvised contribution together support ${megan.toFixed(1)}."`,
      },
      {
        judgeId: 'michael',
        description: `Michael: "Your screen connection across the three turns and the actual ensemble timing support ${michael.toFixed(1)}."`,
      },
      {
        judgeId: 'roxana',
        description: `Roxana: "Across the game, conversation and scene, your charm and least secure turn together support ${roxana.toFixed(1)}."`,
      },
    ],
  };
}
