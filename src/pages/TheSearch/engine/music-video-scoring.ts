import type { AuditionDice } from '../types/audition';
import type { Contestant } from '../types/contestant';
import type {
  MusicVideoCut,
  MusicVideoPanelAssessment,
  MusicVideoSolo,
  MusicVideoTake,
  MusicVideoTakeEvaluation,
} from '../types/music-video-episode';
import { auditionGrade } from './audition-scoring';
import { battleCheck, clampBattle } from './battle-scoring';

export const musicVideoMean = (values: readonly number[]): number => {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error('Music Videos requires finite, completed score evidence.');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};
function check(skill: string, level: number, dice: AuditionDice) {
  if (dice.length !== 2 || dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6))
    throw new Error('Music Videos requires actual saved 2d6.');
  const result = battleCheck(skill, level, 3, dice);
  return { ...result, score: 10 * (result.adjustedDice[0] + result.adjustedDice[1] - 2) };
}

export function scoreMusicVideoSolo(
  person: Contestant,
  setId: string,
  rawDice: AuditionDice,
): MusicVideoSolo {
  const checks = {
    visual: check('visual', person.coreSkills.visual, rawDice),
    charisma: check('charisma', person.utilitySkills.charisma, rawDice),
  };
  const baseScore = 0.55 * checks.visual.score + 0.45 * checks.charisma.score;
  const frozen = person.personality.sensitivity >= 5 && rawDice[0] + rawDice[1] <= 4;
  const freezePenalty = frozen ? -10 : 0;
  const finalScore = clampBattle(baseScore + freezePenalty);
  const oneTakeWonder = finalScore >= 85 && !frozen;
  const preferenceBefore = person.aggregations.audienceRatio;
  const preferenceAfter = clampBattle(preferenceBefore + (oneTakeWonder ? 0.1 : 0), -1, 1);
  return {
    contestantId: person.id,
    setId,
    rawDice: [...rawDice],
    checks,
    baseScore,
    frozen,
    freezePenalty,
    stalledSeconds: frozen ? 20 : 0,
    finalScore,
    grade: auditionGrade(finalScore),
    oneTakeWonder,
    preferenceBefore,
    preferenceAfter,
    feedback: frozen
      ? 'Vivienne pauses the cue for twenty seconds and gives a clear eyeline mark. The single recorded result stands; there is no second solo.'
      : oneTakeWonder
        ? 'Vivienne keeps the expressive first pass as a One-Take Wonder edit: the held eyeline and expression read clearly.'
        : finalScore >= 60
          ? 'Vivienne notes a readable expression and asks that the final held look stay specific to this set.'
          : 'Vivienne identifies an uneven camera connection in the filmed pass, without treating a weak result as misconduct.',
  };
}

export function scoreMusicVideoTake(
  person: Contestant,
  rawDice: AuditionDice,
  scheduledTake: number,
  actualOrdinal: number,
  overnightFatigue: number,
  alreadySmiled = false,
): MusicVideoTakeEvaluation {
  if (
    !Number.isInteger(scheduledTake) ||
    scheduledTake < 1 ||
    scheduledTake > 5 ||
    !Number.isInteger(actualOrdinal) ||
    actualOrdinal < scheduledTake ||
    actualOrdinal > 6 ||
    (overnightFatigue !== 0 && overnightFatigue !== 1)
  )
    throw new Error('Invalid actual Music Videos take.');
  const checks = {
    dance: check('dance', person.coreSkills.dance, rawDice),
    stagePresence: check('stagePresence', person.coreSkills.stagePresence, rawDice),
    consistency: check('consistency', person.utilitySkills.consistency, rawDice),
  };
  const fatigue = Math.min(
    12,
    overnightFatigue + Math.max(0, actualOrdinal - 2) * (6 - person.utilitySkills.stamina),
  );
  const baseScore = 0.6 * checks.dance.score + 0.4 * checks.stagePresence.score;
  const lowStaminaPenalty = scheduledTake >= 4 && person.utilitySkills.stamina < 3 ? 10 : 0;
  const finalScore = clampBattle(baseScore - 2 * fatigue - lowStaminaPenalty);
  const idolSmile =
    !alreadySmiled &&
    scheduledTake >= 4 &&
    person.personality.resilience >= 5 &&
    person.personality.investment >= 5 &&
    fatigue > 0 &&
    checks.stagePresence.score >= 70;
  const resetFailure =
    scheduledTake === 4 &&
    person.utilitySkills.consistency < 3 &&
    checks.consistency.score < 50 &&
    finalScore < 55;
  return {
    contestantId: person.id,
    rawDice: [...rawDice],
    checks,
    overnightFatigue,
    fatigue,
    baseScore,
    lowStaminaPenalty,
    finalScore,
    grade: auditionGrade(finalScore),
    resetFailure,
    idolSmile,
    description: `${person.name} completes the marked choreography with ${finalScore >= 60 ? 'readable' : 'uneven'} feet and timing. Fatigue is ${fatigue}; crew offer water and assisted marks.${
      idolSmile
        ? ' A convincing idol smile reads through the tiredness; it does not repair the technical errors or remove fatigue.'
        : ''
    }`,
  };
}

/** Each scheduled slot counts once; an actual reset shares slot four, never replaces it. */
export function musicVideoSlots(
  contestantId: string,
  takes: readonly MusicVideoTake[],
  value: (evaluation: MusicVideoTakeEvaluation) => number,
): number[] {
  return [1, 2, 3, 4, 5].map((scheduled) => {
    const entries = takes.filter((take) => take.scheduledTake === scheduled);
    if (
      entries.length !== (scheduled === 4 && takes.some((take) => take.isReset) ? 2 : 1) ||
      entries[0]?.isReset ||
      (entries.length === 2 && !entries[1].isReset)
    )
      throw new Error('Five completed scheduled Music Videos slots are required.');
    return musicVideoMean(
      entries.map((take) => {
        const evaluation = take.evaluations.find((entry) => entry.contestantId === contestantId);
        if (!evaluation) throw new Error('Missing actual Music Videos footage.');
        return value(evaluation);
      }),
    );
  });
}

export function assessMusicVideo(
  solo: MusicVideoSolo,
  takes: readonly MusicVideoTake[],
  professionalPivot: boolean,
  idolSmile: boolean,
): MusicVideoPanelAssessment {
  const slots = (value: (entry: MusicVideoTakeEvaluation) => number) =>
    musicVideoSlots(solo.contestantId, takes, value);
  const results = slots((entry) => entry.finalScore);
  const dance = slots((entry) => entry.checks.dance.score);
  const consistency = slots((entry) => entry.checks.consistency.score);
  const stage = slots((entry) => entry.checks.stagePresence.score);
  const late = musicVideoMean(results.slice(3));
  const lateStage = musicVideoMean(stage.slice(3));
  const performance = 0.4 * solo.finalScore + 0.6 * musicVideoMean(results);
  const john = musicVideoMean(dance);
  const megan = solo.checks.charisma.score;
  const michael = 0.5 * solo.checks.visual.score + 0.5 * lateStage;
  const professionalism = clampBattle(
    0.6 * musicVideoMean(consistency) +
      0.4 * lateStage +
      5 * Number(professionalPivot) +
      5 * Number(idolSmile),
  );
  const director = 0.35 * solo.finalScore + 0.45 * late + 0.2 * professionalism;
  const finalScore = clampBattle((performance + john + megan + michael + director) / 5);
  return {
    contestantId: solo.contestantId,
    performance,
    john,
    megan,
    michael,
    professionalism,
    director,
    finalScore,
    grade: auditionGrade(finalScore),
    comments: [
      {
        judgeId: 'john',
        description: `John: "The five scheduled dance slots average ${john.toFixed(1)}; I can see the footwork in those completed takes."`,
      },
      {
        judgeId: 'megan',
        description: `Megan: "The acting delivery in your ${solo.setId} solo supports ${megan.toFixed(1)}."`,
      },
      {
        judgeId: 'michael',
        description: `Michael: "The solo eyeline and late group camera connection together support ${michael.toFixed(1)}."`,
      },
      {
        judgeId: 'vivienne-voss',
        description: `Vivienne: "The recorded solo, Take 4 slot and Take 5, plus your actual professional response, support ${director.toFixed(1)}. Rest was the right call."`,
      },
    ],
  };
}

export function createMusicVideoCut(
  solos: readonly MusicVideoSolo[],
  takes: readonly MusicVideoTake[],
  tieKeys: Record<string, number>,
): MusicVideoCut {
  if (solos.length !== 10 || new Set(solos.map((entry) => entry.contestantId)).size !== 10)
    throw new Error('The cut needs ten actual distinct solo shoots.');
  const quality = Object.fromEntries(
    solos.map((solo) => [
      solo.contestantId,
      0.5 * solo.finalScore +
        0.5 * musicVideoMean(musicVideoSlots(solo.contestantId, takes, (entry) => entry.finalScore).slice(3)),
    ]),
  );
  const ids = solos.map((solo) => solo.contestantId);
  if (ids.some((id) => !Number.isFinite(tieKeys[id]) || tieKeys[id] < 0 || tieKeys[id] >= 1))
    throw new Error('Missing seeded Music Videos edit cutoff ties.');
  const featuredIds = [...ids]
    .sort((a, b) => quality[b] - quality[a] || tieKeys[a] - tieKeys[b] || a.localeCompare(b))
    .slice(0, 5);
  const weight = featuredIds.reduce((sum, id) => sum + 1 + quality[id], 0);
  const individualFocus = Object.fromEntries(
    ids.map((id) => [id, featuredIds.includes(id) ? (80 * (1 + quality[id])) / weight : 0]),
  );
  const presence = Object.fromEntries(ids.map((id) => [id, 20 + individualFocus[id]]));
  const total = Object.values(presence).reduce((sum, value) => sum + value, 0);
  const exposure = Object.fromEntries(ids.map((id) => [id, presence[id] / total]));
  const late = takes.filter((take) => take.scheduledTake >= 4);
  const group = [...late].sort(
    (a, b) =>
      musicVideoMean(b.evaluations.map((entry) => entry.finalScore)) -
        musicVideoMean(a.evaluations.map((entry) => entry.finalScore)) || b.actualOrdinal - a.actualOrdinal,
  )[0];
  return {
    featuredIds,
    quality,
    tieKeys: { ...tieKeys },
    individualFocus,
    presence,
    exposure,
    shots: [
      {
        id: 'shared-choreography',
        kind: 'group',
        contestantIds: ids,
        sourceId: group.id,
        percent: 20,
        reason:
          'The most usable actual late ensemble clip; every performer remains visible and its imperfections remain real.',
      },
      ...featuredIds.map((id, index) => ({
        id: `focus-${index + 1}`,
        kind: 'solo' as const,
        contestantIds: [id],
        sourceId: `solo-${id}`,
        percent: individualFocus[id],
        reason:
          'The filmed solo supplies this focus shot; equal solo and late-slot quality determine edit priority.',
      })),
    ],
  };
}
