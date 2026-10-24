import type { AuditionEvaluation, AuditionSkillCheck, ScoreAuditionInput } from '../types/audition';
import type { Contestant } from '../types/contestant';
import type { JudgeId } from '../types/narrative';
import type { SimulationState } from '../types/simulation';
import { isAuditionLevel } from '../utilities/audition-songs';
import { auditionGrade, auditionMinimumFace, scoreAudition } from './audition-scoring';
import { recordContestantChanges } from './change-history';

const judges: readonly JudgeId[] = ['john', 'megan', 'michael'];
const names: Record<JudgeId, string> = {
  john: 'John Stan',
  megan: 'Megan Ryder',
  michael: 'Michael Lion',
};

export function judgeName(id: JudgeId): string {
  return names[id];
}

function nonSongCheck(
  skill: 'consistency' | 'leadership',
  level: number,
  rawDice: ScoreAuditionInput['rawDice'],
): AuditionSkillCheck {
  if (!isAuditionLevel(level)) throw new Error(`${skill} must be an integer from 1 to 5.`);
  const floor = auditionMinimumFace(level, 3);
  const adjustedDice = [Math.max(rawDice[0], floor), Math.max(rawDice[1], floor)] as const;
  const deliveryFraction = (adjustedDice[0] + adjustedDice[1] - 2) / 10;
  return {
    skill,
    skillLevel: level,
    requiredLevel: 3,
    floor,
    adjustedDice,
    deliveryFraction,
    ceiling: 100,
    score: 100 * deliveryFraction,
  };
}

function comment(lead: JudgeId, criteria: readonly { name: string; score: number }[]): string {
  const ranked = [...criteria].sort((left, right) => right.score - left.score);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  const scope = {
    john: 'the song-tested technical skills',
    megan: 'stage presence, potential and uniqueness',
    michael: 'visual, consistency and leadership',
  }[lead];
  if (strongest.score === weakest.score) {
    return `Your checks for ${scope} were evenly matched at ${strongest.score.toFixed(1)}.`;
  }
  return `Among ${scope}, your strongest check was ${strongest.name} (${strongest.score.toFixed(1)}); your weakest was ${weakest.name} (${weakest.score.toFixed(1)}).`;
}

/** Reuse observation checks; grade the song's track alongside the named panel. */
export function scorePanelAudition(input: ScoreAuditionInput, position: number): AuditionEvaluation {
  if (!Number.isInteger(position) || position < 0 || position >= 50) {
    throw new Error('Panel audition position must be between zero and forty-nine.');
  }
  const evaluation = scoreAudition(input);
  const technical = evaluation.technical.checks.filter(({ skill }) =>
    ['vocals', 'rap', 'dance'].includes(skill),
  );
  if (!technical.length) throw new Error('Panel auditions require a vocal, rap or dance song check.');
  const consistencyCheck = nonSongCheck(
    'consistency',
    input.contestant.utilitySkills.consistency,
    input.rawDice,
  );
  const leadershipCheck = nonSongCheck('leadership', input.contestant.coreSkills.leadership, input.rawDice);
  const consistency = consistencyCheck.score;
  const leadership = leadershipCheck.score;
  const criteria = {
    john: technical.map(({ skill, score }) => ({ name: skill, score })),
    megan: [
      { name: 'stage presence', score: evaluation.stagePresence.score },
      { name: 'potential', score: evaluation.impressions.potential.score },
      { name: 'uniqueness', score: evaluation.impressions.uniqueness.score },
    ],
    michael: [
      { name: 'visual', score: evaluation.impressions.visual.score },
      { name: 'consistency', score: consistency },
      { name: 'leadership', score: leadership },
    ],
  };
  const scores = {
    john:
      technical.reduce((sum, check, index) => sum + check.score * (index === 0 ? 2 : 1), 0) /
      (technical.length + 1),
    megan: criteria.megan.reduce((sum, check) => sum + check.score, 0) / 3,
    michael: criteria.michael.reduce((sum, check) => sum + check.score, 0) / 3,
  };
  const lead = judges[Math.floor(position / 7) % judges.length];
  const weights: Record<JudgeId, number> = { john: 1, megan: 1, michael: 1 };
  weights[lead] = 2;
  const track = { ...evaluation.technical.checks[0], weight: 3 };
  const finalScore = (3 * track.score + scores.john + scores.megan + scores.michael + scores[lead]) / 7;
  return {
    ...evaluation,
    finalScore,
    grade: auditionGrade(finalScore),
    panel: {
      lead,
      scores,
      weights,
      track,
      finalScore,
      consistency,
      leadership,
      consistencyCheck,
      leadershipCheck,
      comment: comment(lead, criteria[lead]),
    },
  };
}

export function applyAuditionFarewells(state: SimulationState, departedIds: readonly string[]): void {
  const episode = state.runtime?.audition;
  const story = episode?.story;
  if (!episode || !story) throw new Error('Narrative Auditions are required for farewell reactions.');
  const cast = new Map(state.contestants.map((contestant) => [contestant.id, contestant]));
  const highlights: { actor: Contestant; departed: Contestant; baseline: number; positive: boolean }[] = [];
  const applied = new Set(story.farewellAppliedIds);
  for (const departedId of new Set(departedIds)) {
    if (applied.has(departedId)) continue;
    const departed = cast.get(departedId);
    if (!departed) throw new Error(`Unknown departing audition contestant "${departedId}".`);
    for (const survivorId of episode.survivorIds) {
      if (survivorId === departedId) continue;
      const actor = cast.get(survivorId);
      if (!actor) throw new Error(`Unknown audition survivor "${survivorId}".`);
      const baseline = story.farewellBaseline[survivorId]?.[departedId] ?? 50;
      if (baseline > 47 && baseline < 53) continue;
      const positive = baseline >= 53;
      const history = actor.relationships[departedId] ?? [];
      const before = history[history.length - 1] ?? 50;
      const after = Math.max(0, Math.min(100, before + (positive ? 2 : -2)));
      if (before === after) continue;
      const previous = { ...actor, relationships: { ...actor.relationships } };
      actor.relationships[departedId] = [...history, after];
      const cause = `Auditions farewell: ${actor.name} feels ${positive ? 'sadness' : 'relief'} at ${departed.name}'s departure.`;
      episode.changes[actor.id] ??= [];
      episode.changes[actor.id].push(...recordContestantChanges(previous, actor, cause));
      highlights.push({ actor, departed, baseline, positive });
    }
    story.farewellAppliedIds.push(departedId);
    applied.add(departedId);
  }
  const scene = [...episode.scenes].reverse().find((entry) => entry.kind === 'eliminations');
  if (!scene) return;
  highlights.sort(
    (left, right) =>
      Math.abs(right.baseline - 50) - Math.abs(left.baseline - 50) ||
      left.actor.id.localeCompare(right.actor.id) ||
      left.departed.id.localeCompare(right.departed.id),
  );
  for (const { actor, departed, positive } of highlights.slice(0, 2)) {
    scene.paragraphs.push(
      positive
        ? `${actor.name} is sad to see ${departed.name} leave; their connection grows stronger.`
        : `${actor.name} feels relief as ${departed.name} leaves; their already strained connection weakens.`,
    );
    const mentions = [actor.id, departed.id];
    for (const id of mentions) if (!scene.contestantIds.includes(id)) scene.contestantIds.push(id);
    scene.paragraphContestantIds?.push(mentions);
  }
}
