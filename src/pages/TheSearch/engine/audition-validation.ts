import type { AuditionEvaluation, AuditionSkillCheck } from '../types/audition';
import type {
  AudienceOutcome,
  AuditionAction,
  AuditionEpisode,
  AuditionReaction,
  BroadcastCut,
  DeferredConsequence,
  EpisodeScene,
  MvpResult,
  SecretResult,
  ShowAudience,
} from '../types/audition-episode';
import type { ChangeValue, PropertyChange } from '../types/common';
import type { Contestant } from '../types/contestant';
import type { SimulationDefinitions } from '../types/simulation';
import { validateAuditionSongs } from '../utilities/audition-songs';
import { rankAuditions } from './audition-scoring';

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function number(
  value: unknown,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
function uniqueIds(value: unknown): value is string[] {
  return strings(value) && new Set(value).size === value.length;
}
function numbers(value: unknown, min = 0, max = Number.POSITIVE_INFINITY): value is Record<string, number> {
  return object(value) && Object.values(value).every((entry) => number(entry, min, max));
}
function counts(value: unknown): value is Record<string, number> {
  return object(value) && Object.values(value).every((entry) => integer(entry));
}
function changeValue(value: unknown): value is ChangeValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    number(value) ||
    (Array.isArray(value) && value.every(changeValue)) ||
    (object(value) && Object.values(value).every(changeValue))
  );
}
function change(value: unknown): value is PropertyChange {
  return (
    object(value) &&
    typeof value.path === 'string' &&
    typeof value.cause === 'string' &&
    value.cause.trim().length > 0 &&
    (value.before === undefined || changeValue(value.before)) &&
    (value.after === undefined || changeValue(value.after))
  );
}
function preferences(value: unknown): boolean {
  return (
    object(value) &&
    (value.visualOrUniqueness === 'visual' || value.visualOrUniqueness === 'uniqueness') &&
    (value.potentialOrCharisma === 'potential' || value.potentialOrCharisma === 'charisma')
  );
}
function check(value: unknown): value is AuditionSkillCheck {
  return (
    object(value) &&
    typeof value.skill === 'string' &&
    integer(value.skillLevel, 1, 5) &&
    integer(value.requiredLevel, 1, 5) &&
    integer(value.floor, 1, 5) &&
    Array.isArray(value.adjustedDice) &&
    value.adjustedDice.length === 2 &&
    value.adjustedDice.every((face) => integer(face, 1, 6)) &&
    number(value.deliveryFraction, 0, 1) &&
    number(value.ceiling, 0, 100) &&
    number(value.score, 0, 100)
  );
}
function evaluation(value: unknown): value is AuditionEvaluation {
  return (
    object(value) &&
    typeof value.contestantId === 'string' &&
    typeof value.songId === 'string' &&
    Array.isArray(value.rawDice) &&
    value.rawDice.length === 2 &&
    value.rawDice.every((face) => integer(face, 1, 6)) &&
    preferences(value.preferences) &&
    integer(value.baseStagePresence, 1, 5) &&
    integer(value.composure, -1, 1) &&
    object(value.technical) &&
    number(value.technical.score, 0, 100) &&
    Array.isArray(value.technical.checks) &&
    value.technical.checks.length > 0 &&
    value.technical.checks.every((entry) => check(entry) && object(entry) && integer(entry.weight, 1, 2)) &&
    check(value.stagePresence) &&
    object(value.impressions) &&
    ['visual', 'uniqueness', 'potential', 'charisma'].every(
      (key) => object(value.impressions) && check(value.impressions[key]),
    ) &&
    number(value.finalScore, 0, 100) &&
    ['A', 'B', 'C', 'D', 'F'].includes(String(value.grade)) &&
    number(value.tieBreakKey, 0, 1) &&
    value.tieBreakKey < 1
  );
}
function reaction(value: unknown): value is AuditionReaction {
  return (
    object(value) &&
    typeof value.observerId === 'string' &&
    typeof value.performerId === 'string' &&
    ['admiration', 'inspiration', 'intimidation', 'jealousy', 'confidence', 'sympathy'].includes(
      String(value.type),
    ) &&
    typeof value.sameSong === 'boolean' &&
    number(value.gap, -100, 100) &&
    number(value.relationshipBefore, 0, 100) &&
    number(value.relationshipAfter, 0, 100) &&
    integer(value.composureBefore, -1, 1) &&
    integer(value.composureAfter, -1, 1) &&
    typeof value.narrative === 'string'
  );
}
function scene(value: unknown): value is EpisodeScene {
  return (
    object(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    [
      'opening',
      'choices',
      'auditions',
      'broadcast',
      'audience',
      'eliminations',
      'mvp',
      'secret',
      'recap',
    ].includes(String(value.kind)) &&
    strings(value.paragraphs) &&
    uniqueIds(value.contestantIds)
  );
}
function cut(value: unknown): value is BroadcastCut {
  return (
    object(value) &&
    ['music', 'personalities', 'backstage'].includes(String(value.id)) &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    uniqueIds(value.featuredIds) &&
    value.featuredIds.length === 10 &&
    Array.isArray(value.footage) &&
    value.footage.every(
      (entry) =>
        object(entry) && typeof entry.contestantId === 'string' && typeof entry.description === 'string',
    ) &&
    numbers(value.exposure, 0.01, 1) &&
    Math.abs(Object.values(value.exposure).reduce((sum, exposure) => sum + exposure, 0) - 1) < 1e-8
  );
}
function outcome(value: unknown): value is AudienceOutcome {
  return (
    object(value) &&
    counts(value.votes) &&
    numbers(value.receptions, 0, 100) &&
    counts(value.newFans) &&
    integer(value.votingPopulation) &&
    integer(value.newViewers) &&
    integer(value.satisfactionBefore, 0, 100) &&
    integer(value.satisfactionAfter, 0, 100) &&
    number(value.attention, 0, 100) &&
    number(value.enjoyment, 0, 100) &&
    Object.values(value.votes).reduce((sum, votes) => sum + votes, 0) === value.votingPopulation
  );
}
export function isDeferredConsequence(value: unknown): value is DeferredConsequence {
  return (
    object(value) &&
    typeof value.contestantId === 'string' &&
    typeof value.path === 'string' &&
    typeof value.cause === 'string' &&
    changeValue(value.value)
  );
}
function secret(value: unknown): value is SecretResult {
  return (
    object(value) &&
    typeof value.contestantId === 'string' &&
    (value.cardId === null || typeof value.cardId === 'string') &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    Array.isArray(value.deferred) &&
    value.deferred.every(isDeferredConsequence)
  );
}
function mvp(value: unknown): value is MvpResult {
  return (
    object(value) &&
    object(value.ballots) &&
    Object.values(value.ballots).every((id) => typeof id === 'string') &&
    counts(value.totals) &&
    typeof value.winnerId === 'string' &&
    uniqueIds(value.tiedIds)
  );
}

export function isShowAudience(value: unknown): value is ShowAudience {
  return (
    object(value) &&
    integer(value.audience) &&
    integer(value.general) &&
    integer(value.satisfaction, 0, 100) &&
    counts(value.fans) &&
    integer(value.pendingAttrition) &&
    value.pendingAttrition <= value.audience &&
    value.audience === value.general + Object.values(value.fans).reduce((sum, fans) => sum + fans, 0)
  );
}

export function isAuditionAction(value: unknown): value is AuditionAction {
  if (!object(value)) return false;
  if (value.type === 'start' || value.type === 'advance') return true;
  if (value.type === 'broadcast')
    return ['music', 'personalities', 'backstage'].includes(String(value.cutId));
  if (value.type === 'secret') return typeof value.contestantId === 'string';
  return (
    value.type === 'mood' &&
    object(value.choices) &&
    ['vocalColor', 'danceStyle', 'rapStyle', 'visualVibe', 'leadershipStyle', 'genreAffinity'].every(
      (key) => object(value.choices) && typeof value.choices[key] === 'string',
    )
  );
}

export function assertAuditionEpisode(
  value: unknown,
  contestants: readonly Contestant[],
  definitions: SimulationDefinitions,
): asserts value is AuditionEpisode {
  const invalid = () => {
    throw new Error('The saved Auditions episode is invalid or incomplete.');
  };
  if (!object(value)) return invalid();
  const fields = [
    'vocalColor',
    'danceStyle',
    'rapStyle',
    'visualVibe',
    'leadershipStyle',
    'genreAffinity',
  ] as const;
  if (
    value.version !== 1 ||
    (value.relationshipPolicy !== 'reactions-only' &&
      value.relationshipPolicy !== 'everyone-forms-opinions') ||
    ![
      'mood',
      'choices',
      'live',
      'broadcast',
      'audience',
      'eliminations',
      'mvp',
      'secret',
      'complete',
    ].includes(String(value.phase)) ||
    !integer(value.revision, 1) ||
    !object(value.lastAction) ||
    value.lastAction.revision !== value.revision - 1 ||
    !isAuditionAction(value.lastAction.action) ||
    !object(value.moodOptions) ||
    !fields.every(
      (field) =>
        object(value.moodOptions) &&
        uniqueIds(value.moodOptions[field]) &&
        value.moodOptions[field].length === 3 &&
        value.moodOptions[field].every((id) => Object.hasOwn(definitions.specialties[field], id)),
    ) ||
    !(
      value.mood === null ||
      (object(value.mood) &&
        fields.every((field) => object(value.mood) && typeof value.mood[field] === 'string'))
    ) ||
    !object(value.songChoices) ||
    !Object.values(value.songChoices).every((id) => typeof id === 'string') ||
    !uniqueIds(value.order) ||
    !integer(value.cursor, 0, 50) ||
    !Array.isArray(value.evaluations) ||
    !value.evaluations.every(evaluation) ||
    value.evaluations.length !== value.cursor ||
    !Array.isArray(value.batches) ||
    value.batches.length > 4 ||
    !value.batches.every(
      (batch) =>
        object(batch) &&
        preferences(batch.preferences) &&
        (batch.previousBatch === null ||
          (object(batch.previousBatch) &&
            ['visual', 'uniqueness', 'potential', 'charisma'].every((quality) => {
              if (!object(batch.previousBatch)) return false;
              const memory = batch.previousBatch[quality];
              return (
                object(memory) &&
                number(memory.mean, 0, 100) &&
                number(memory.highest, 0, 100) &&
                number(memory.satisfaction, 0, 100) &&
                number(memory.weight, 1, 101)
              );
            }))),
    ) ||
    !object(value.composure) ||
    !Object.values(value.composure).every((entry) => integer(entry, -1, 1)) ||
    !Array.isArray(value.reactions) ||
    !value.reactions.every(reaction) ||
    !Array.isArray(value.scenes) ||
    value.scenes.length === 0 ||
    !value.scenes.every(scene) ||
    !object(value.changes) ||
    !Object.values(value.changes).every((entries) => Array.isArray(entries) && entries.every(change)) ||
    !Array.isArray(value.cuts) ||
    !value.cuts.every(cut) ||
    !(
      value.selectedCutId === null ||
      ['music', 'personalities', 'backstage'].includes(String(value.selectedCutId))
    ) ||
    !(value.audience === null || outcome(value.audience)) ||
    !uniqueIds(value.rankedIds) ||
    !uniqueIds(value.survivorIds) ||
    !uniqueIds(value.eliminatedIds) ||
    !integer(value.revealedEliminations, 0, 20) ||
    !(value.mvp === null || mvp(value.mvp)) ||
    !uniqueIds(value.secretCandidates) ||
    !(value.secret === null || secret(value.secret))
  )
    return invalid();
  const pool = validateAuditionSongs(value.pool, Object.keys(definitions.specialties.genreAffinity));
  if (
    pool.length !== 9 ||
    !pool.every((song) => {
      const original = definitions.auditionSongs.find((entry) => entry.id === song.id);
      return original && JSON.stringify(original) === JSON.stringify(song);
    })
  )
    return invalid();
  const ids = new Set(contestants.map((contestant) => contestant.id));
  const evaluations = value.evaluations;
  const order = value.order;
  const survivorIds = value.survivorIds;
  const hasClosedVotes = ['audience', 'eliminations', 'mvp', 'secret', 'complete'].includes(
    String(value.phase),
  );
  if (
    value.batches.length !== (value.cursor === 0 ? 0 : Math.ceil(value.cursor / 13)) ||
    (['mood', 'choices'].includes(String(value.phase)) && value.cursor !== 0) ||
    (value.phase === 'live' && (value.cursor === 0 || value.cursor === 50)) ||
    (!hasClosedVotes &&
      (value.audience !== null ||
        value.selectedCutId !== null ||
        value.rankedIds.length !== 0 ||
        value.survivorIds.length !== 0 ||
        value.eliminatedIds.length !== 0)) ||
    (!['secret', 'complete'].includes(String(value.phase)) &&
      (value.mvp !== null || value.secretCandidates.length !== 0)) ||
    (value.phase !== 'complete' && value.secret !== null) ||
    (value.phase === 'eliminations' && value.revealedEliminations === 20) ||
    value.revealedEliminations % 5 !== 0
  )
    return invalid();
  const revealedDepartures = new Set(value.eliminatedIds.slice(0, value.revealedEliminations));
  if (
    !contestants.every(
      (contestant) => contestant.status === (revealedDepartures.has(contestant.id) ? 'ELIMINATED' : 'ACTIVE'),
    )
  )
    return invalid();
  if (
    !value.order.every((id) => ids.has(id)) ||
    new Set(evaluations.map((entry) => entry.contestantId)).size !== evaluations.length ||
    !evaluations.every(
      (entry, index) =>
        entry.contestantId === order[index] &&
        value.songChoices &&
        object(value.songChoices) &&
        value.songChoices[entry.contestantId] === entry.songId,
    ) ||
    !Object.keys(value.composure).every((id) => ids.has(id)) ||
    !Object.keys(value.changes).every((id) => ids.has(id)) ||
    !value.reactions.every(
      (entry) =>
        ids.has(entry.observerId) && ids.has(entry.performerId) && entry.observerId !== entry.performerId,
    ) ||
    !value.scenes.every((entry) => entry.contestantIds.every((id) => ids.has(id))) ||
    new Set(value.scenes.map((entry) => entry.id)).size !== value.scenes.length ||
    !value.secretCandidates.every((id) => ids.has(id)) ||
    value.secretCandidates.length > 3
  )
    return invalid();
  if (value.phase === 'mood') {
    if (value.mood !== null || value.order.length || value.cursor || Object.keys(value.songChoices).length)
      return invalid();
  } else {
    if (!object(value.mood) || value.order.length !== 50 || Object.keys(value.songChoices).length !== 50)
      return invalid();
    for (const field of fields) {
      const moodOptions = value.moodOptions;
      if (
        !object(moodOptions) ||
        !strings(moodOptions[field]) ||
        !moodOptions[field].includes(String(value.mood[field]))
      )
        return invalid();
    }
    if (
      !Object.entries(value.songChoices).every(
        ([id, songId]) => ids.has(id) && pool.some((song) => song.id === songId),
      )
    )
      return invalid();
  }
  if (['broadcast', 'audience', 'eliminations', 'mvp', 'secret', 'complete'].includes(String(value.phase))) {
    if (
      value.cursor !== 50 ||
      value.batches.length !== 4 ||
      value.cuts.length !== 3 ||
      new Set(value.cuts.map((entry) => entry.id)).size !== 3 ||
      !value.cuts.every(
        (entry) =>
          Object.keys(entry.exposure).length === 50 &&
          Object.keys(entry.exposure).every((id) => ids.has(id)) &&
          entry.featuredIds.every((id) => ids.has(id)),
      )
    )
      return invalid();
  }
  if (hasClosedVotes) {
    if (
      !outcome(value.audience) ||
      value.selectedCutId === null ||
      value.rankedIds.length !== 50 ||
      value.survivorIds.length !== 30 ||
      value.eliminatedIds.length !== 20 ||
      Object.keys(value.audience.votes).length !== 50 ||
      !Object.keys(value.audience.votes).every((id) => ids.has(id)) ||
      Object.keys(value.audience.receptions).length !== 50 ||
      !Object.keys(value.audience.receptions).every((id) => ids.has(id)) ||
      !Object.keys(value.audience.newFans).every((id) => ids.has(id)) ||
      JSON.stringify(rankAuditions(evaluations).map((entry) => entry.contestantId)) !==
        JSON.stringify(value.rankedIds) ||
      JSON.stringify(value.rankedIds.slice(0, 30)) !== JSON.stringify(value.survivorIds) ||
      JSON.stringify(value.rankedIds.slice(30).reverse()) !== JSON.stringify(value.eliminatedIds)
    )
      return invalid();
  }
  if (['mvp', 'secret', 'complete'].includes(String(value.phase)) && value.revealedEliminations !== 20)
    return invalid();
  if (['secret', 'complete'].includes(String(value.phase))) {
    if (
      !mvp(value.mvp) ||
      !value.survivorIds.includes(value.mvp.winnerId) ||
      Object.keys(value.mvp.ballots).length !== 30 ||
      !Object.entries(value.mvp.ballots).every(
        ([voter, target]) =>
          voter !== target && survivorIds.includes(voter) && survivorIds.includes(String(target)),
      )
    )
      return invalid();
  }
  if (value.phase === 'secret' && value.secretCandidates.length !== 3) return invalid();
  if (
    value.phase === 'complete' &&
    contestants.filter((contestant) => contestant.status === 'ACTIVE').length !== 30
  )
    return invalid();
}
