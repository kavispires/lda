import type { AuditionDice, AuditionSkillCheck } from '../types/audition';
import type { AuditionEpisode } from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import { auditionSequence } from '../types/narrative';
import type { SimulationDefinitions } from '../types/simulation';
import { validateAuditionSongs } from '../utilities/audition-songs';
import { auditionPanelFinalScore } from './audition-panel';
import { auditionGrade, rankAuditions } from './audition-scoring';
import {
  change,
  check,
  evaluation,
  mvp,
  outcome,
  reaction,
  scene,
  secret,
  validateAuditionBiasProtection,
} from './audition-validation';

const fields = [
  'vocalColor',
  'danceStyle',
  'rapStyle',
  'visualVibe',
  'leadershipStyle',
  'genreAffinity',
] as const;
const phases = [
  'opening-cast',
  'mood',
  'host-intro',
  'credits',
  'judges',
  'introduction',
  'live',
  'eliminations',
  'mvp',
  'secret',
  'complete',
];
const judges = ['john', 'megan', 'michael'] as const;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max: number): value is number =>
  number(value, min, max) && Number.isSafeInteger(value);
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string') && new Set(value).size === value.length;

function validCheck(value: AuditionSkillCheck, raw: AuditionDice, technical = false): boolean {
  const floor = Math.max(1, Math.min(5, 2 * value.skillLevel - value.requiredLevel));
  const adjusted = raw.map((face) => Math.max(face, floor));
  const fraction = (adjusted[0] + adjusted[1] - 2) / 10;
  const ceiling = technical ? 50 + 10 * value.requiredLevel : 100;
  return (
    value.floor === floor &&
    value.adjustedDice.every((face, index) => face === adjusted[index]) &&
    Math.abs(value.deliveryFraction - fraction) < 1e-9 &&
    value.ceiling === ceiling &&
    Math.abs(value.score - ceiling * fraction) < 1e-9
  );
}

function shape(value: unknown): value is AuditionEpisode {
  if (!object(value) || !object(value.story) || !object(value.moodOptions) || !object(value.lastAction))
    return false;
  const story = value.story;
  return (
    value.version === 2 &&
    (value.scoringVersion === undefined || value.scoringVersion === 1 || value.scoringVersion === 2) &&
    phases.includes(String(value.phase)) &&
    value.relationshipPolicy === 'everyone-forms-opinions' &&
    integer(value.revision, 1, Number.MAX_SAFE_INTEGER) &&
    value.lastAction.revision === value.revision - 1 &&
    object(value.lastAction.action) &&
    ['start', 'advance', 'opening-cast', 'mood', 'randomize-mood', 'secret'].includes(
      String(value.lastAction.action.type),
    ) &&
    Array.isArray(value.pool) &&
    ids(value.order) &&
    integer(value.cursor, 0, 50) &&
    object(value.songChoices) &&
    Object.values(value.songChoices).every((id) => typeof id === 'string') &&
    fields.every(
      (field) =>
        object(value.moodOptions) && ids(value.moodOptions[field]) && value.moodOptions[field].length === 2,
    ) &&
    (value.mood === null ||
      (object(value.mood) &&
        fields.every((field) => object(value.mood) && typeof value.mood[field] === 'string'))) &&
    Array.isArray(value.evaluations) &&
    value.evaluations.every(evaluation) &&
    Array.isArray(value.batches) &&
    value.batches.length === 0 &&
    object(value.composure) &&
    Object.values(value.composure).every((entry) => integer(entry, -1, 1)) &&
    Array.isArray(value.reactions) &&
    value.reactions.every(reaction) &&
    Array.isArray(value.scenes) &&
    value.scenes.every(scene) &&
    object(value.changes) &&
    Object.values(value.changes).every((entries) => Array.isArray(entries) && entries.every(change)) &&
    Array.isArray(value.cuts) &&
    value.cuts.length === 0 &&
    value.selectedCutId === null &&
    (value.audience === null || outcome(value.audience)) &&
    ids(value.rankedIds) &&
    ids(value.survivorIds) &&
    ids(value.eliminatedIds) &&
    integer(value.revealedEliminations, 0, 20) &&
    value.revealedEliminations % 5 === 0 &&
    (value.mvp === null || mvp(value.mvp)) &&
    ids(value.secretCandidates) &&
    (value.secret === null || secret(value.secret)) &&
    integer(story.sequence, 1, 12) &&
    ['host', 'credits', 'judges', 'introduction', 'performance', 'montage', 'results'].includes(
      String(story.presentation),
    ) &&
    (story.pendingPerformerId === null || typeof story.pendingPerformerId === 'string') &&
    object(story.exposure) &&
    Object.values(story.exposure).every((entry) => number(entry, 0, 1)) &&
    ids(story.creditedIds) &&
    ids(story.farewellAppliedIds) &&
    object(story.farewellBaseline) &&
    Object.values(story.farewellBaseline).every(
      (entries) => object(entries) && Object.values(entries).every((entry) => number(entry, 0, 100)),
    )
  );
}

export function assertNarrativeAudition(
  value: unknown,
  contestants: readonly Contestant[],
  definitions: SimulationDefinitions,
  { archived = false, useBias = false }: { archived?: boolean; useBias?: boolean } = {},
): asserts value is AuditionEpisode {
  const fail = (reason: string): never => {
    throw new Error(`Invalid narrative Auditions: ${reason}.`);
  };
  if (!shape(value)) return fail('malformed story record');
  const ep = value;
  const biasScoreBoosts = validateAuditionBiasProtection(ep, contestants, useBias);
  const story = ep.story;
  if (!story) return fail('missing story');
  const cast = new Set(contestants.map(({ id }) => id));
  const known = (entries: readonly string[]) => entries.every((id) => cast.has(id));
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const pool = validateAuditionSongs(ep.pool, Object.keys(definitions.specialties.genreAffinity));
  if (
    pool.length !== 9 ||
    pool.some(
      (song) =>
        !same(
          song,
          definitions.auditionSongs.find(({ id }) => id === song.id),
        ),
    )
  )
    fail('unfrozen song pool');
  if (contestants.length !== 50 || cast.size !== 50 || !known(ep.order) || !known(Object.keys(ep.changes)))
    fail('invalid cast references');
  for (const field of fields) {
    if (
      ep.moodOptions[field].some((id) => !Object.hasOwn(definitions.specialties[field], id)) ||
      (ep.mood && !ep.moodOptions[field].includes(ep.mood[field]))
    )
      fail('invalid mood');
  }
  if (
    ep.evaluations.length !== ep.cursor ||
    !same(
      ep.evaluations.map(({ contestantId }) => contestantId),
      ep.order.slice(0, ep.cursor),
    )
  )
    fail('performance order mismatch');
  for (const [position, entry] of ep.evaluations.entries()) {
    const panel = entry.panel;
    if (
      !object(panel) ||
      !object(panel.scores) ||
      panel.lead !== judges[Math.floor(position / 7) % 3] ||
      !judges.every((id) => number(panel.scores[id], 0, 100)) ||
      !number(panel.consistency, 0, 100) ||
      !number(panel.leadership, 0, 100) ||
      typeof panel.comment !== 'string' ||
      !panel.comment.trim()
    )
      fail('invalid panel evaluation');
    if (!panel) return fail('missing panel');
    if (
      !object(panel.weights) ||
      judges.some((id) => panel.weights[id] !== (id === panel.lead ? 2 : 1)) ||
      !check(panel.consistencyCheck) ||
      !check(panel.leadershipCheck) ||
      panel.consistencyCheck.skill !== 'consistency' ||
      panel.leadershipCheck.skill !== 'leadership' ||
      panel.consistencyCheck.score !== panel.consistency ||
      panel.leadershipCheck.score !== panel.leadership
    )
      fail('missing panel checks or weights');
    const song = pool.find(({ id }) => id === entry.songId);
    if (
      !song ||
      entry.technical.checks.length !== song.part.testedSkills.length ||
      entry.technical.checks.some(
        (item, index) =>
          item.skill !== song.part.testedSkills[index].skill ||
          item.requiredLevel !== song.part.testedSkills[index].requiredLevel ||
          item.weight !== (index === 0 ? 2 : 1) ||
          !validCheck(item, entry.rawDice, true),
      )
    )
      fail('invalid technical checks');
    const technical =
      entry.technical.checks.reduce((sum, item) => sum + item.score * item.weight, 0) /
      entry.technical.checks.reduce((sum, item) => sum + item.weight, 0);
    const star =
      (entry.stagePresence.score + entry.impressions.potential.score + entry.impressions.uniqueness.score) /
      3;
    const market = (entry.impressions.visual.score + panel.consistency + panel.leadership) / 3;
    if (
      Math.abs(technical - entry.technical.score) > 1e-9 ||
      Math.abs(technical - panel.scores.john) > 1e-9 ||
      Math.abs(star - panel.scores.megan) > 1e-9 ||
      Math.abs(market - panel.scores.michael) > 1e-9 ||
      [
        entry.stagePresence,
        ...Object.values(entry.impressions),
        panel.consistencyCheck,
        panel.leadershipCheck,
      ].some((item) => item.requiredLevel !== 3 || !validCheck(item, entry.rawDice))
    )
      fail('panel evidence does not match its scores');
    const judgeTotal =
      panel.scores.john + panel.scores.megan + panel.scores.michael + panel.scores[panel.lead];
    let expected = judgeTotal / 4;
    if (panel.track !== undefined) {
      const primary = entry.technical.checks[0];
      if (
        !check(panel.track) ||
        panel.track.weight !== 3 ||
        panel.track.skill !== primary.skill ||
        panel.track.skillLevel !== primary.skillLevel ||
        panel.track.requiredLevel !== primary.requiredLevel ||
        panel.track.score !== primary.score ||
        !validCheck(panel.track, entry.rawDice, true)
      )
        fail('invalid song-track evaluation');
      expected = (3 * panel.track.score + judgeTotal) / 7;
    }
    if (ep.scoringVersion === 2) {
      if (
        panel.track === undefined ||
        !number(panel.rawFinalScore, 0, 100) ||
        Math.abs(panel.rawFinalScore - expected) > 1e-9
      )
        fail('invalid raw panel score for the audition scale');
    } else if (panel.rawFinalScore !== undefined) {
      fail('unexpected adjusted panel evidence for the original audition scale');
    }
    expected = auditionPanelFinalScore(expected, ep.scoringVersion);
    if (
      Math.abs(expected - entry.finalScore) > 1e-9 ||
      panel.finalScore !== entry.finalScore ||
      auditionGrade(entry.finalScore) !== entry.grade ||
      ep.songChoices[entry.contestantId] !== entry.songId
    )
      fail('judge score mismatch');
  }
  const prepared = ep.mood !== null;
  if (
    (prepared ? ep.order.length !== 50 : ep.order.length !== 0) ||
    (!prepared && !['opening-cast', 'mood'].includes(ep.phase))
  )
    fail('preparation timing');
  if (
    prepared &&
    (Object.keys(ep.songChoices).length !== 50 ||
      !known(Object.keys(ep.songChoices)) ||
      Object.values(ep.songChoices).some((id) => !pool.some((song) => song.id === id)))
  )
    fail('invalid locked songs');
  if (!prepared && Object.keys(ep.songChoices).length) fail('premature song choices');
  if (prepared) {
    const exposureIds = Object.keys(story.exposure);
    if (exposureIds.length !== 50 || !known(exposureIds)) fail('coverage cast mismatch');
    for (const [position, id] of ep.order.entries()) {
      const block = auditionSequence(position);
      const expected = 1 / (19 * (block.featured ? 1 : block.size));
      if (Math.abs(story.exposure[id] - expected) > 1e-12) fail('coverage allocation mismatch');
    }
  } else if (Object.keys(story.exposure).length) fail('premature coverage');
  if (!same(story.creditedIds, ep.order.slice(0, ep.cursor))) fail('screen-time credit mismatch');
  const resolvedBeats = ep.scenes.filter(
    (entry) => entry.presentation === 'performance' || entry.presentation === 'montage',
  );
  if (
    !same(
      resolvedBeats.flatMap((entry) => entry.contestantIds),
      story.creditedIds,
    )
  )
    fail('missing performed story beats');
  const last = ep.scenes.at(-1);
  if (last && (last.presentation !== story.presentation || last.sequence !== story.sequence))
    fail('current story beat mismatch');
  if (ep.phase !== 'introduction' && story.pendingPerformerId !== null) fail('premature performer');
  if (['opening-cast', 'mood'].includes(ep.phase) && (ep.scenes.length || ep.cursor !== 0))
    fail('premature story');
  if (ep.phase === 'host-intro' || ep.phase === 'credits' || ep.phase === 'judges') {
    const expected = { 'host-intro': 'host', credits: 'credits', judges: 'judges' }[ep.phase];
    if (ep.cursor !== 0 || story.presentation !== expected) fail('invalid prelude');
  }
  if (ep.phase === 'live' && (ep.cursor === 0 || !['performance', 'montage'].includes(story.presentation)))
    fail('invalid performance beat');
  if (
    ep.phase === 'introduction' &&
    (ep.cursor >= 50 ||
      !auditionSequence(ep.cursor).featured ||
      story.pendingPerformerId !== ep.order[ep.cursor])
  )
    fail('invalid introduction');
  if (
    ep.reactions.some(
      (entry) =>
        !cast.has(entry.observerId) || !cast.has(entry.performerId) || entry.observerId === entry.performerId,
    )
  )
    fail('invalid reactions');
  if (
    ep.scenes.some(
      (entry) =>
        !known(entry.contestantIds) || entry.paragraphContestantIds?.some((mentions) => !known(mentions)),
    )
  )
    fail('unknown scene contestant');
  for (const entry of ep.scenes) {
    if (
      !integer(entry.sequence, 1, 12) ||
      entry.sequence === 11 ||
      !['host', 'credits', 'judges', 'introduction', 'performance', 'montage', 'results'].includes(
        entry.presentation ?? '',
      ) ||
      (entry.speaker !== undefined &&
        (!object(entry.speaker) ||
          typeof entry.speaker.name !== 'string' ||
          typeof entry.speaker.role !== 'string'))
    )
      fail('invalid story beat');
    if (
      entry.introductions !== undefined &&
      (!object(entry.introductions) ||
        !known(Object.keys(entry.introductions)) ||
        Object.values(entry.introductions).some(
          (paragraphs) => !Array.isArray(paragraphs) || paragraphs.some((text) => typeof text !== 'string'),
        ))
    )
      fail('invalid montage introductions');
  }
  if (ep.audience) {
    const ranked = rankAuditions(ep.evaluations, biasScoreBoosts).map(({ contestantId }) => contestantId);
    if (
      ep.cursor !== 50 ||
      !same(ep.rankedIds, ranked) ||
      !same(ep.survivorIds, ranked.slice(0, 30)) ||
      !same(ep.eliminatedIds, ranked.slice(30).reverse())
    )
      fail('invalid elimination cut');
    if (
      Object.keys(ep.audience.votes).length !== 50 ||
      !known(Object.keys(ep.audience.votes)) ||
      Object.values(ep.audience.votes).reduce((sum, count) => sum + count, 0) !== ep.audience.votingPopulation
    )
      fail('vote population mismatch');
  } else if (
    ep.rankedIds.length ||
    ep.survivorIds.length ||
    ep.eliminatedIds.length ||
    ['eliminations', 'mvp', 'secret', 'complete'].includes(ep.phase)
  )
    fail('premature results');
  if (!same(story.farewellAppliedIds, ep.eliminatedIds.slice(0, ep.revealedEliminations)))
    fail('farewell application mismatch');
  if (!archived) {
    const departed = new Set(ep.eliminatedIds.slice(0, ep.revealedEliminations));
    if (contestants.some((entry) => entry.status !== (departed.has(entry.id) ? 'ELIMINATED' : 'ACTIVE')))
      fail('status mismatch');
  }
  if (['mvp', 'secret', 'complete'].includes(ep.phase) && ep.revealedEliminations !== 20)
    fail('incomplete departures');
  if (['secret', 'complete'].includes(ep.phase) && !ep.mvp) fail('missing MVP');
  if (!known(ep.secretCandidates) || (ep.phase === 'secret' && ep.secretCandidates.length !== 3))
    fail('invalid secret shortlist');
  if (ep.phase === 'complete' && !ep.secret) fail('missing secret investigation');
}
