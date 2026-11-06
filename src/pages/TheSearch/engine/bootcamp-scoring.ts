import type { AuditionDice } from '../types/audition';
import type {
  BootcampCheck,
  BootcampEvaluation,
  BootcampEvent,
  BootcampGroup,
  BootcampGroupResult,
} from '../types/bootcamp-episode';
import type { Contestant } from '../types/contestant';
import { auditionMinimumFace, drawAuditionTieBreakKey, rollAuditionDice } from './audition-scoring';
import { type RandomSource, shuffleWithRandom } from './random';

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));
const lowRoll = (dice: AuditionDice): boolean => dice[0] + dice[1] <= 4;

function validateContestants(contestants: readonly Contestant[], count: number): void {
  if (
    contestants.length !== count ||
    contestants.some((contestant) => !contestant.id.trim()) ||
    new Set(contestants.map((contestant) => contestant.id)).size !== count
  ) {
    throw new Error(`Boot Camp requires exactly ${count} distinct contestants.`);
  }
}

function check(skillLevel: number, rawDice: AuditionDice): BootcampCheck {
  const floor = auditionMinimumFace(skillLevel, 3);
  const adjustedDice: AuditionDice = [Math.max(rawDice[0], floor), Math.max(rawDice[1], floor)];
  return { skillLevel, adjustedDice, score: (adjustedDice[0] + adjustedDice[1] - 2) * 10 };
}

function evaluation(
  contestant: Contestant,
  round: number,
  skills: string[],
  random: RandomSource,
): BootcampEvaluation {
  const rawDice = rollAuditionDice(random);
  const checks = Object.fromEntries(
    skills.map((skill) => {
      const level =
        skill === 'vocals' || skill === 'rap'
          ? contestant.coreSkills[skill]
          : contestant.utilitySkills[skill as keyof Contestant['utilitySkills']];
      return [skill, check(level, rawDice)];
    }),
  );
  return {
    contestantId: contestant.id,
    round,
    rawDice,
    checks,
    baseScore: 0,
    finalScore: 0,
    fatigue: round < 4 ? clamp(7 - round - contestant.utilitySkills.stamina, 0, 5) : 0,
    tieBreakKey: drawAuditionTieBreakKey(random),
    events: [],
  };
}

function event(
  record: BootcampEvaluation,
  kind: string,
  narrative: string,
  scoreDelta = 0,
  spotlight = 0,
  relationships: BootcampEvent['relationships'] = [],
  contestantIds = [record.contestantId],
): void {
  const used = record.events.reduce((sum, entry) => sum + entry.spotlight, 0);
  record.events.push({
    kind,
    narrative,
    contestantIds,
    scoreDelta,
    spotlight: Math.min(spotlight, Math.max(0, 2 - used)),
    relationships,
  });
}

function technicalBonus(
  record: BootcampEvaluation,
  kind: string,
  narrative: string,
  delta: number,
  spotlight = 0,
): void {
  const before = record.events.reduce((sum, entry) => sum + entry.scoreDelta, 0);
  event(record, kind, narrative, clamp(before + delta, -10, 10) - before, spotlight);
}

function finish(record: BootcampEvaluation): void {
  record.finalScore = clamp(
    record.baseScore + record.events.reduce((sum, entry) => sum + entry.scoreDelta, 0),
  );
}

function delivery(contestant: Contestant, tieBreakKey: number): 'vocals' | 'rap' {
  if (contestant.track === 'VOCAL') return 'vocals';
  if (contestant.track === 'RAP') return 'rap';
  const difference = contestant.coreSkills.vocals - contestant.coreSkills.rap;
  if (difference !== 0) return difference > 0 ? 'vocals' : 'rap';
  return tieBreakKey < 0.5 ? 'vocals' : 'rap';
}

export function scoreBootcampPair(
  contestants: readonly Contestant[],
  round: number,
  random: RandomSource,
): BootcampEvaluation[] {
  validateContestants(contestants, 2);
  if (!Number.isInteger(round) || round < 1 || round > 3) {
    throw new Error('Boot Camp pair rounds must be 1, 2, or 3.');
  }
  const records = contestants.map((contestant) => {
    const skills =
      round === 1
        ? ['stamina', 'consistency']
        : round === 2
          ? ['acrobatics', 'consistency']
          : ['consistency', 'learning'];
    const record = evaluation(contestant, round, skills, random);
    const microphone = round === 1 ? delivery(contestant, record.tieBreakKey) : null;
    if (microphone) record.checks[microphone] = check(contestant.coreSkills[microphone], record.rawDice);
    if (microphone && contestant.track === 'DANCE') {
      event(
        record,
        'delivery-choice',
        contestant.coreSkills.vocals === contestant.coreSkills.rap
          ? `${contestant.name} uses ${microphone}; equal microphone skills are resolved by saved tie key ${record.tieBreakKey}.`
          : `${contestant.name} uses the stronger microphone skill, ${microphone}.`,
      );
    }
    return record;
  });
  const pairConsistency = Math.min(...records.map((record) => record.checks.consistency.score));
  records.forEach((record, index) => {
    const contestant = contestants[index];
    const { personality: traits, utilitySkills: utility } = contestant;
    const { checks } = record;
    if (round === 1) {
      record.baseScore =
        0.5 * checks.stamina.score +
        0.3 * checks.consistency.score +
        0.2 * (checks.vocals ?? checks.rap).score;
      if (traits.discipline >= 5)
        technicalBonus(record, 'disciplined-pacing', `${contestant.name} keeps a disciplined pace.`, 5);
      if (traits.resilience >= 5 && utility.stamina <= 2)
        technicalBonus(record, 'underdog', `${contestant.name} perseveres despite limited stamina.`, 5, 1);
      finish(record);
      if (traits.sensitivity >= 5 && lowRoll(record.rawDice)) {
        event(
          record,
          'panic',
          `${contestant.name}'s low-roll panic cracks the delivery; Miller safely stops the attempt.`,
          -record.baseScore - record.events.reduce((sum, entry) => sum + entry.scoreDelta, 0),
          1,
        );
        record.finalScore = 0;
      }
    } else if (round === 2) {
      record.baseScore =
        0.6 * checks.acrobatics.score + 0.2 * checks.consistency.score + 0.2 * pairConsistency;
      if (traits.curiosity >= 5)
        technicalBonus(record, 'curious-approach', `${contestant.name} explores a useful approach.`, 5);
      if (traits.maturity <= -5)
        technicalBonus(record, 'goofing-off', `${contestant.name}'s goofing off disrupts the sequence.`, -5);
      if (traits.ambition >= 5 && utility.acrobatics <= 2 && checks.acrobatics.score < 60) {
        event(
          record,
          'safe-failed-flip',
          `${contestant.name} attempts an ambitious flip but lands safely on the mat; no injury occurs.`,
          0,
          1,
        );
        if (utility.charisma >= 5)
          event(
            record,
            'charming-recovery',
            `${contestant.name} laughs off the real mistake for the camera.`,
            0,
            1,
          );
      }
      finish(record);
    } else {
      record.baseScore = 0.6 * checks.consistency.score + 0.4 * checks.learning.score;
      const shielded = traits.resilience >= 5 && traits.maturity >= 5;
      if (shielded) {
        technicalBonus(
          record,
          'trainer-awe',
          `${contestant.name} stays composed through the distractions.`,
          5,
          1,
        );
      } else if (traits.sensitivity >= 5 && lowRoll(record.rawDice)) {
        technicalBonus(record, 'flinch', `${contestant.name} flinches and loses the hand timing.`, -5, 1);
        if (traits.sincerity >= 5)
          event(
            record,
            'sincere-apology',
            `${contestant.name} sincerely apologizes for the actual timing mistake.`,
            0,
            1,
          );
      }
      if (utility.charisma >= 5 && traits.extroversion >= 5)
        event(
          record,
          'camera-interaction',
          `${contestant.name} shares a playful look with the camera.`,
          0,
          1,
        );
      finish(record);
    }
  });
  return records;
}

export function scoreBootcampGroup(
  contestants: readonly Contestant[],
  prior: readonly BootcampEvaluation[],
  groupId: string,
  random: RandomSource,
): { evaluations: BootcampEvaluation[]; result: BootcampGroupResult } {
  validateContestants(contestants, 6);
  if (!groupId.trim()) throw new Error('Boot Camp groups require an ID.');
  const history = contestants.map((contestant) => {
    const records = prior.filter((record) => record.contestantId === contestant.id);
    if (
      records.length !== 1 ||
      !Number.isInteger(records[0].round) ||
      records[0].round < 1 ||
      records[0].round > 3 ||
      !Number.isInteger(records[0].fatigue) ||
      records[0].fatigue < 0 ||
      records[0].fatigue > 5
    ) {
      throw new Error('Each group member requires one pair record with bounded fatigue.');
    }
    return records[0];
  });
  const evaluations = contestants.map((contestant, index) => {
    const record = evaluation(contestant, 4, ['stamina', 'consistency'], random);
    record.fatigue = history[index].fatigue;
    record.baseScore = 0.5 * record.checks.stamina.score + 0.5 * record.checks.consistency.score;
    if (record.fatigue)
      event(
        record,
        'fatigue',
        `${contestant.name} carries ${record.fatigue} units of temporary fatigue.`,
        -2 * record.fatigue,
      );
    return record;
  });
  const staging = shuffleWithRandom(
    contestants.map((contestant) => contestant.id),
    () => drawAuditionTieBreakKey(random),
  );
  const corrections = new Map<string, number>();
  const penalties = new Map<string, number>();
  const interactions = new Set<string>();
  const attempts: BootcampGroupResult['attempts'] = [];
  let resets = 0;
  let assisted = false;
  for (;;) {
    const timing = Object.fromEntries(
      evaluations.map((record) => [
        record.contestantId,
        clamp(
          record.checks.consistency.score -
            2 * record.fatigue +
            10 * resets +
            (corrections.get(record.contestantId) ?? 0) -
            (penalties.get(record.contestantId) ?? 0),
        ),
      ]),
    );
    attempts.push({ reset: resets, timing });
    if (Object.values(timing).every((score) => score >= 60)) break;
    if (resets === 5) {
      assisted = true;
      break;
    }
    const weakest = [...evaluations].sort(
      (a, b) =>
        timing[a.contestantId] - timing[b.contestantId] ||
        b.tieBreakKey - a.tieBreakKey ||
        a.contestantId.localeCompare(b.contestantId),
    )[0];
    resets++;
    if (resets >= 3) {
      contestants.forEach((contestant, index) => {
        if (resets === 3 && contestant.personality.investment >= 5)
          event(
            evaluations[index],
            'sustained-effort',
            `${contestant.name} stays committed through the repeated resets and follows Miller's rest cues.`,
            0,
            1,
          );
        if (contestant.personality.investment > -5) return;
        const before = penalties.get(contestant.id) ?? 0;
        const after = Math.min(10, before + 5);
        if (after === before) return;
        penalties.set(contestant.id, after);
        event(
          evaluations[index],
          'checking-out',
          `${contestant.name} checks out after reset ${resets}, losing ${after - before} timing and performance points.`,
          before - after,
          1,
        );
      });
    }
    if (resets >= 2) {
      contestants.forEach((contestant, index) => {
        if (contestant.id === weakest.contestantId || interactions.has(contestant.id)) return;
        const support = contestant.personality.gentleness >= 5;
        const confront = contestant.personality.ambition >= 5 && contestant.personality.gentleness <= -5;
        if (!support && !confront) return;
        interactions.add(contestant.id);
        // Several teammates cannot stack limitless assistance onto the same weak link.
        corrections.set(
          weakest.contestantId,
          clamp((corrections.get(weakest.contestantId) ?? 0) + (support ? 5 : -5), -10, 10),
        );
        event(
          evaluations[index],
          support ? 'gentle-support' : 'harsh-confrontation',
          `${contestant.name} ${support ? 'patiently coaches' : 'harshly confronts'} ${contestants[evaluations.indexOf(weakest)].name}, the weakest timing contributor after reset ${resets - 1}.`,
          0,
          1,
          [{ observerId: weakest.contestantId, targetId: contestant.id, delta: support ? 1 : -1 }],
          [contestant.id, weakest.contestantId],
        );
      });
    }
  }
  evaluations.forEach((record, index) => {
    if (record.contestantId === staging[2])
      event(
        record,
        'center-framing',
        `${contestants[index].name} receives center framing in the saved staging.`,
        0,
        1,
      );
    else if (
      (record.contestantId === staging[0] || record.contestantId === staging[5]) &&
      contestants[index].utilitySkills.charisma >= 5
    )
      event(
        record,
        'charismatic-edge',
        `${contestants[index].name} catches the camera from the edge of the formation.`,
        0,
        1,
      );
    if (assisted)
      event(
        record,
        'assisted-finish',
        'After five resets, Miller calls a safe, assisted finish and rest.',
        0,
        0,
        [],
        [],
      );
    let remaining = Math.max(0, 2 - history[index].events.reduce((sum, entry) => sum + entry.spotlight, 0));
    for (const entry of record.events) {
      entry.spotlight = Math.min(entry.spotlight, remaining);
      remaining -= entry.spotlight;
    }
    finish(record);
  });
  const meanStamina =
    evaluations.reduce((sum, record) => sum + record.checks.stamina.score, 0) / evaluations.length;
  const minConsistency = Math.min(...evaluations.map((record) => record.checks.consistency.score));
  return {
    evaluations,
    result: {
      groupId,
      score: clamp(0.6 * meanStamina + 0.4 * minConsistency - 3 * resets),
      resets,
      assisted,
      staging,
      attempts,
      tieBreakKey: drawAuditionTieBreakKey(random),
    },
  };
}

export function bootcampWinner(evaluations: readonly BootcampEvaluation[]): string {
  if (!evaluations.length) throw new Error('Boot Camp winners require evaluation evidence.');
  const round = evaluations[0].round;
  if (
    !Number.isInteger(round) ||
    round < 1 ||
    round > 4 ||
    evaluations.some((record) => record.round !== round) ||
    new Set(evaluations.map((record) => record.contestantId)).size !== evaluations.length
  ) {
    throw new Error('Boot Camp winners require distinct contestants from one round.');
  }
  const [primary, secondary] =
    round === 2
      ? ['acrobatics', 'consistency']
      : round === 3
        ? ['consistency', 'learning']
        : ['stamina', 'consistency'];
  return [...evaluations].sort(
    (a, b) =>
      b.finalScore - a.finalScore ||
      b.checks[primary].score - a.checks[primary].score ||
      b.checks[secondary].score - a.checks[secondary].score ||
      b.tieBreakKey - a.tieBreakKey ||
      a.contestantId.localeCompare(b.contestantId),
  )[0].contestantId;
}

export function bootcampWinningGroup(
  groups: readonly BootcampGroup[],
  results: readonly BootcampGroupResult[],
  evaluations: readonly BootcampEvaluation[],
): string {
  if (
    !groups.length ||
    groups.length !== results.length ||
    new Set(groups.map((group) => group.id)).size !== groups.length ||
    new Set(results.map((result) => result.groupId)).size !== results.length ||
    new Set(groups.flatMap((group) => group.memberIds)).size !== groups.length * 6
  ) {
    throw new Error('Boot Camp group winners require distinct six-person groups and matching results.');
  }
  const ranked = groups.map((group) => {
    const result = results.find((entry) => entry.groupId === group.id);
    const records = evaluations.filter(
      (record) => record.round === 4 && group.memberIds.includes(record.contestantId),
    );
    if (
      !result ||
      group.memberIds.length !== 6 ||
      records.length !== 6 ||
      new Set(records.map((record) => record.contestantId)).size !== 6 ||
      !Number.isFinite(result.score) ||
      result.score < 0 ||
      result.score > 100 ||
      !Number.isInteger(result.resets) ||
      result.resets < 0 ||
      result.resets > 5 ||
      !Number.isFinite(result.tieBreakKey) ||
      result.tieBreakKey < 0 ||
      result.tieBreakKey >= 1 ||
      records.some(
        (record) => !Number.isFinite(record.finalScore) || record.finalScore < 0 || record.finalScore > 100,
      )
    ) {
      throw new Error('Boot Camp group winners require complete final-round evidence and saved tie keys.');
    }
    return {
      result,
      individualTotal: records.reduce((sum, record) => sum + record.finalScore, 0),
    };
  });
  return ranked.sort(
    (a, b) =>
      b.result.score - a.result.score ||
      a.result.resets - b.result.resets ||
      b.individualTotal - a.individualTotal ||
      b.result.tieBreakKey - a.result.tieBreakKey ||
      a.result.groupId.localeCompare(b.result.groupId),
  )[0].result.groupId;
}
