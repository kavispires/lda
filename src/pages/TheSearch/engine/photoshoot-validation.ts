import type { AuditionDice } from '../types/audition';
import type { EpisodeScene } from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import type { PhotoshootEpisode, PhotoshootPhase } from '../types/photoshoot-episode';
import type { SimulationDefinitions, SimulationState } from '../types/simulation';
import { validatePhotoshootConcepts } from '../utilities/photoshoot-concepts';
import { auditionGrade, auditionMinimumFace } from './audition-scoring';
import { change, mvp, outcome, secret, scene as validScene } from './audition-validation';
import { battleRelationship } from './battle-scoring';
import {
  choosePhotoshootVisual,
  clampPhoto,
  meanPhoto,
  photoshootConceptPreference,
  photoshootStylingQuality,
} from './photoshoot-scoring';

function check(value: unknown, reason: string): asserts value {
  if (!value) throw new Error(`Invalid Photoshoot: ${reason}.`);
}
function object(value: unknown): asserts value is Record<string, unknown> {
  check(value && typeof value === 'object' && !Array.isArray(value), 'expected an object');
}
function array(value: unknown): asserts value is unknown[] {
  check(Array.isArray(value), 'expected an array');
}
function text(value: unknown): asserts value is string {
  check(typeof value === 'string' && value.trim(), 'expected nonempty text');
}
function number(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  integer = false,
): asserts value is number {
  check(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!integer || Number.isSafeInteger(value)),
    'invalid bounded number',
  );
}
function close(a: number, b: number, reason: string) {
  check(Math.abs(a - b) < 1e-8, reason);
}
function exact(value: Record<string, unknown>, keys: readonly string[], reason: string) {
  check(Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)), reason);
}
function ids(value: unknown, known: readonly string[], count?: number): asserts value is string[] {
  array(value);
  check(
    value.every((id) => typeof id === 'string' && known.includes(id)) &&
      new Set(value).size === value.length &&
      (count === undefined || value.length === count),
    'unknown, repeated or missing contestant IDs',
  );
}
function numericMap(value: unknown, keys: readonly string[], min = 0, max = 100, integer = false) {
  object(value);
  exact(value, keys, 'incomplete numeric evidence');
  Object.values(value).forEach((entry) => {
    number(entry, min, max, integer);
  });
}
function tieMap(value: unknown, keys: readonly string[]) {
  numericMap(value, keys, 0, 1);
  check(
    Object.values(value as Record<string, number>).every((entry) => entry < 1),
    'invalid saved draw',
  );
}
function stringMap(value: unknown, keys: readonly string[], choices?: readonly string[]) {
  object(value);
  exact(value, keys, 'incomplete string evidence');
  for (const entry of Object.values(value)) {
    text(entry);
    check(!choices || choices.includes(entry), 'unknown choice');
  }
}
function dice(value: unknown): asserts value is AuditionDice {
  array(value);
  check(value.length === 2, 'two raw dice required');
  value.forEach((entry) => {
    number(entry, 1, 6, true);
  });
}
function changes(value: unknown, participants: readonly string[]) {
  object(value);
  for (const [id, entries] of Object.entries(value)) {
    check(participants.includes(id), 'unknown change subject');
    array(entries);
    for (const entry of entries)
      check(change(entry) && entry.path !== `relationships.${id}`, 'invalid or self relationship change');
  }
}
function photoScene(value: unknown): value is EpisodeScene {
  object(value);
  return (
    [
      'opening',
      'choices',
      'auditions',
      'broadcast',
      'audience',
      'eliminations',
      'mvp',
      'secret',
      'dorms',
      'ranking',
      'draft',
      'practice',
      'battles',
      'saves',
      'recap',
    ].includes(String(value.kind)) && validScene({ ...value, kind: 'recap' })
  );
}
const phases: PhotoshootPhase[] = [
  'dorms',
  'credits',
  'briefing',
  'concepts',
  'draft',
  'styling-choice',
  'styling-result',
  'individual',
  'center',
  'group',
  'gallery',
  'ballots',
  'ultimate-visual',
  'secret-choice',
  'secret-result',
  'ranking',
  'complete',
];
function checkPhoto(value: unknown, skills: readonly string[]) {
  object(value);
  text(value.contestantId);
  dice(value.rawDice);
  const rawDice = value.rawDice;
  array(value.checks);
  check(value.checks.length === skills.length, 'wrong photography checks');
  for (const [index, entry] of value.checks.entries()) {
    object(entry);
    check(entry.skill === skills[index] && entry.requiredLevel === 3, 'invalid native photo check');
    number(entry.skillLevel, 1, 5, true);
    const floor = auditionMinimumFace(entry.skillLevel, 3);
    check(entry.floor === floor, 'photo floor mismatch');
    dice(entry.adjustedDice);
    check(
      entry.adjustedDice.every((face, die) => face === Math.max(floor, rawDice[die])),
      'photo adjusted dice mismatch',
    );
    number(entry.score, 0, 100);
    close(entry.score, 10 * (entry.adjustedDice[0] + entry.adjustedDice[1] - 2), 'photo check mismatch');
  }
  number(value.technicalScore, 0, 100);
  number(value.stylingModifier, -15, 25);
  number(value.outfitModifier, -5, 5);
  number(value.finalScore, 0, 100);
  check(value.grade === auditionGrade(value.finalScore), 'photo grade mismatch');
  text(value.description);
}
function shape(
  value: unknown,
  known: readonly string[],
  definitions: SimulationDefinitions,
): asserts value is PhotoshootEpisode {
  object(value);
  check(
    value.version === 1 && phases.includes(value.phase as PhotoshootPhase),
    'unsupported version or phase',
  );
  number(value.revision, 0, Number.MAX_SAFE_INTEGER, true);
  object(value.lastAction);
  number(value.lastAction.revision, 0, Number.MAX_SAFE_INTEGER, true);
  object(value.lastAction.action);
  const action = value.lastAction.action;
  check(['start', 'advance', 'styling', 'secret'].includes(String(action.type)), 'invalid last action');
  if (action.type === 'styling')
    check(['intervene', 'self-style'].includes(String(action.choice)), 'invalid styling choice');
  ids(value.participantIds, known, 16);
  const participants = value.participantIds;
  if (action.type === 'secret') ids([action.contestantId], participants, 1);
  ids(value.previousRankedIds, participants, 16);
  array(value.startingContestants);
  check(value.startingContestants.length === known.length, 'missing full starting cast');
  const startingIds: string[] = [];
  for (const entry of value.startingContestants) {
    object(entry);
    text(entry.id);
    text(entry.name);
    startingIds.push(entry.id);
    check(['ACTIVE', 'ELIMINATED', 'WINNER'].includes(String(entry.status)), 'invalid starting status');
    object(entry.coreSkills);
    object(entry.utilitySkills);
    object(entry.personality);
    object(entry.aggregations);
    object(entry.specialties);
    object(entry.relationships);
    for (const key of ['vocals', 'rap', 'dance', 'stagePresence', 'visual', 'uniqueness', 'leadership'])
      number(entry.coreSkills[key], 1, 5, true);
    for (const key of ['potential', 'memory', 'stamina', 'learning', 'acrobatics', 'consistency', 'charisma'])
      number(entry.utilitySkills[key], 1, 5, true);
    for (const key of [
      'discipline',
      'curiosity',
      'extroversion',
      'sensitivity',
      'gentleness',
      'sincerity',
      'ambition',
      'resilience',
      'maturity',
      'investment',
    ])
      number(entry.personality[key], -10, 10);
    for (const key of ['happiness', 'rankingScore', 'screenTime', 'leader', 'center', 'mvp'])
      number(entry.aggregations[key]);
    check(
      Object.hasOwn(definitions.specialties.visualVibe, String(entry.specialties.visualVibe)),
      'unknown frozen visual vibe',
    );
    for (const [id, history] of Object.entries(entry.relationships)) {
      check(known.includes(id), 'unknown relationship target');
      array(history);
      check(history.length, 'empty relationship history');
      history.forEach((score) => {
        number(score, 0, 100);
      });
    }
  }
  ids(startingIds, known, known.length);
  array(value.teams);
  check(value.teams.length <= 4, 'too many concept teams');
  const concepts = definitions.photoshootConcepts!;
  const conceptIds = concepts.map(({ id }) => id);
  const teamIds: string[] = [];
  for (const entry of value.teams) {
    object(entry);
    text(entry.id);
    text(entry.name);
    teamIds.push(entry.id);
    ids([entry.leaderId], participants, 1);
    check(conceptIds.includes(String(entry.conceptId)), 'unknown concept');
    ids(entry.memberIds, participants);
    check(
      entry.memberIds.length >= 1 && entry.memberIds.length <= 4 && entry.memberIds[0] === entry.leaderId,
      'invalid concept roster',
    );
    object(entry.conceptScores);
    const available = Object.keys(entry.conceptScores);
    check(
      available.every((id) => conceptIds.includes(id)),
      'unknown concept preference',
    );
    numericMap(entry.conceptScores, available, 0, 100);
    tieMap(entry.conceptTieKeys, available);
    array(entry.proposals);
    for (const proposal of entry.proposals) {
      object(proposal);
      ids([proposal.contestantId], entry.memberIds, 1);
      for (const key of ['outfitId', 'outfitName', 'propId', 'propName']) text(proposal[key]);
      check(
        [0, 50, 100].includes(Number(proposal.outfitFit)) &&
          [0, 50, 100].includes(Number(proposal.conceptFit)),
        'invalid proposal fit',
      );
      object(proposal.tieKeys);
      tieMap(proposal.tieKeys, Object.keys(proposal.tieKeys));
    }
    if (entry.negotiation !== null) {
      object(entry.negotiation);
      text(entry.negotiation.leaderOutfitId);
      text(entry.negotiation.description);
      if (entry.negotiation.challengerId !== null) ids([entry.negotiation.challengerId], entry.memberIds, 1);
      if (entry.negotiation.mediatorId !== null) ids([entry.negotiation.mediatorId], entry.memberIds, 1);
    }
    if (entry.styling !== null) {
      object(entry.styling);
      check(
        entry.styling.completed === true &&
          ['intervene', 'self-style'].includes(String(entry.styling.choice)),
        'invalid completed styling session',
      );
      number(entry.styling.quality, 0, 100);
      number(entry.styling.modifier, -15, 25);
      numericMap(entry.styling.outfitModifiers, entry.memberIds, -5, 5);
      stringMap(entry.styling.finalOutfits, entry.memberIds);
      text(entry.styling.description);
    }
    object(entry.centerBallots);
    object(entry.centerTotals);
    object(entry.centerTieKeys);
    if (entry.centerId !== null) {
      ids([entry.centerId], entry.memberIds, 1);
      stringMap(entry.centerBallots, entry.memberIds, entry.memberIds);
      numericMap(entry.centerTotals, entry.memberIds, 0, 4, true);
      exact(entry.centerTieKeys, [...entry.memberIds, 'result'], 'missing center draw');
      for (const map of Object.values(entry.centerTieKeys)) tieMap(map, entry.memberIds);
    } else
      check(
        !Object.keys(entry.centerBallots).length &&
          !Object.keys(entry.centerTotals).length &&
          !Object.keys(entry.centerTieKeys).length,
        'center evidence before election',
      );
  }
  ids(teamIds, teamIds, value.teams.length);
  array(value.draftPicks);
  check(value.draftPicks.length <= 12, 'too many draft picks');
  for (const entry of value.draftPicks) {
    object(entry);
    check(teamIds.includes(String(entry.teamId)), 'unknown draft team');
    ids([entry.contestantId], participants, 1);
    ids(entry.availableIds, participants);
    ids(entry.passedOverIds, entry.availableIds);
    number(entry.round, 1, 3, true);
    tieMap(entry.tieKeys, entry.availableIds);
  }
  number(value.teamCursor, 0, 3, true);
  number(value.individualCursor, 0, 16, true);
  number(value.groupCursor, 0, 4, true);
  array(value.individualPhotos);
  for (const photo of value.individualPhotos) {
    checkPhoto(photo, ['visual', 'uniqueness', 'charisma', 'potential']);
    object(photo);
    ids([photo.contestantId], participants, 1);
    check(teamIds.includes(String(photo.teamId)), 'unknown individual photo team');
    check(typeof photo.banter === 'boolean', 'missing banter evidence');
    array(photo.feedback);
    check(photo.feedback.length === 2, 'two grounded judge comments required');
    for (const entry of photo.feedback) {
      object(entry);
      check(['megan', 'michael'].includes(String(entry.judgeId)), 'invalid photo judge');
      number(entry.score, 0, 100);
      text(entry.description);
    }
    array(photo.reactions);
    for (const entry of photo.reactions) {
      object(entry);
      ids([entry.observerId, entry.performerId], participants, 2);
      check(
        entry.performerId === photo.contestantId &&
          ['awe', 'support', 'awkward'].includes(String(entry.kind)),
        'invalid photo reaction',
      );
      check(entry.delta === 1 || entry.delta === -1, 'invalid reaction delta');
      number(entry.relationshipBefore, 0, 100);
      number(entry.relationshipAfter, 0, 100);
      close(
        entry.relationshipAfter,
        clampPhoto(entry.relationshipBefore + entry.delta),
        'reaction bond mismatch',
      );
      text(entry.description);
      check(typeof entry.highlighted === 'boolean', 'missing reaction highlight');
    }
  }
  array(value.groupPhotos);
  for (const photo of value.groupPhotos) {
    object(photo);
    check(teamIds.includes(String(photo.teamId)), 'unknown cover team');
    ids([photo.centerId], participants, 1);
    array(photo.evaluations);
    check(photo.evaluations.length === 4, 'four personal cover results required');
    for (const entry of photo.evaluations) {
      checkPhoto(entry, ['visual', 'uniqueness', 'stagePresence', 'charisma']);
      object(entry);
      ids([entry.contestantId], participants, 1);
      number(entry.centerBonus, 0, 5);
      number(entry.actionModifier, -10, 10);
      number(entry.cohesionModifier, -11, 11);
    }
    array(photo.actions);
    for (const entry of photo.actions) {
      object(entry);
      ids([entry.contestantId], participants, 1);
      ids([entry.beneficiaryId], participants, 1);
      check(
        ['steal', 'yield'].includes(String(entry.type)) && typeof entry.success === 'boolean',
        'invalid cover action',
      );
      number(entry.modifier, -10, 10);
      text(entry.description);
    }
    number(photo.relationshipMean, 0, 100);
    number(photo.baseCohesion, -5, 5);
    number(photo.supportCohesion, 0, 6);
    number(photo.stealingPenalty, 0, 6);
    number(photo.cohesionModifier, -11, 11);
    number(photo.finalScore, 0, 100);
    check(photo.grade === auditionGrade(photo.finalScore), 'cover grade mismatch');
    text(photo.description);
  }
  numericMap(value.attention, participants, 0, 3, true);
  numericMap(value.receptionBonuses, participants, 0, 15, true);
  numericMap(value.screenTime, participants, 0, Number.MAX_SAFE_INTEGER);
  object(value.peerTieKeys);
  object(value.awardTieKeys);
  object(value.peerEvidence);
  if (value.peerVote !== null) {
    check(mvp(value.peerVote), 'invalid peer ballot');
    const vote = value.peerVote;
    stringMap(vote.ballots, participants, participants);
    numericMap(vote.totals, participants, 0, 16, true);
    ids(vote.tiedIds, participants);
    ids([vote.winnerId], vote.tiedIds, 1);
    exact(value.peerTieKeys, participants, 'missing peer draws');
    exact(value.peerEvidence, participants, 'missing peer preferences');
    tieMap(value.awardTieKeys, participants);
    for (const id of participants) {
      const eligible = participants.filter((other) => other !== id);
      check(vote.ballots[id] !== id, 'self vote for Ultimate Visual');
      tieMap(value.peerTieKeys[id], eligible);
      const evidence = value.peerEvidence[id];
      object(evidence);
      ids([evidence.closestFriendId], eligible, 1);
      check(typeof evidence.override === 'boolean', 'missing override evidence');
      numericMap(evidence.preferences, eligible, 0, 100);
      numericMap(evidence.relationships, eligible, 0, 100);
    }
  } else
    check(
      !Object.keys(value.peerTieKeys).length &&
        !Object.keys(value.awardTieKeys).length &&
        !Object.keys(value.peerEvidence).length,
      'premature peer evidence',
    );
  if (value.ultimateVisual !== null) check(mvp(value.ultimateVisual), 'invalid announced Ultimate Visual');
  if (value.audience !== null) check(outcome(value.audience), 'invalid audience outcome');
  object(value.sealedRankingScores);
  object(value.rankingTieKeys);
  if (value.audience !== null) {
    numericMap(value.sealedRankingScores, participants, 0, Number.MAX_VALUE);
    tieMap(value.rankingTieKeys, participants);
  } else
    check(
      !Object.keys(value.sealedRankingScores).length && !Object.keys(value.rankingTieKeys).length,
      'premature sealed points',
    );
  ids(value.secretCandidates, participants);
  check(value.secretCandidates.length <= 3, 'investigation must use a three-person shortlist');
  if (value.secret !== null) check(secret(value.secret), 'invalid secret result');
  ids(value.rankedIds, participants);
  ids(value.survivorIds, participants);
  check(typeof value.rankRevealed === 'boolean', 'missing rank visibility');
  array(value.scenes);
  for (const [index, entry] of value.scenes.entries()) {
    check(photoScene(entry), 'invalid scene');
    check(entry.id === `photoshoot-${index}`, 'scene identity mismatch');
    ids(entry.contestantIds, participants);
    number(entry.sequence, 1, 8, true);
    check(entry.paragraphContestantIds?.length === entry.paragraphs.length, 'paragraph reference mismatch');
    for (const refs of entry.paragraphContestantIds ?? []) {
      array(refs);
      check(
        refs.every((id) => known.includes(String(id))),
        'unknown paragraph reference',
      );
    }
    if (entry.contestantChanges !== undefined) changes(entry.contestantChanges, participants);
    if (entry.tvMoments !== undefined) {
      object(entry.tvMoments);
      for (const [moment, entries] of Object.entries(entry.tvMoments)) {
        text(moment);
        object(entries);
        for (const [id, tier] of Object.entries(entries))
          check(
            participants.includes(id) && (tier === 1 || tier === 3 || tier === 6),
            'invalid aired TV moment',
          );
      }
    }
  }
  changes(value.changes, participants);
}

export function assertPhotoshootEpisode(
  value: unknown,
  contestants: readonly Contestant[],
  definitions: SimulationDefinitions,
): asserts value is PhotoshootEpisode {
  validatePhotoshootConcepts(definitions.photoshootConcepts, Object.keys(definitions.specialties.visualVibe));
  shape(
    value,
    contestants.map(({ id }) => id),
    definitions,
  );
  const ep = value;
  const source = (id: string) => ep.startingContestants.find((entry) => entry.id === id)!;
  const relationshipsBefore = (sceneIndex: number) => {
    const cast = new Map(
      ep.participantIds.map((id) => [
        id,
        {
          ...source(id),
          relationships: structuredClone(source(id).relationships),
        },
      ]),
    );
    for (const scene of ep.scenes.slice(0, sceneIndex)) {
      for (const [id, entries] of Object.entries(scene.contestantChanges ?? {})) {
        for (const entry of entries) {
          if (!entry.path.startsWith('relationships.')) continue;
          check(
            Array.isArray(entry.after) &&
              entry.after.every((value) => typeof value === 'number' && value >= 0 && value <= 100),
            'invalid relationship change history',
          );
          cast.get(id)!.relationships[entry.path.slice('relationships.'.length)] = entry.after as number[];
        }
      }
    }
    return cast;
  };
  const stage = phases.indexOf(ep.phase);
  const at = (phase: PhotoshootPhase) => phases.indexOf(phase);
  check(
    ep.scenes.length === ep.revision + 1 && ep.lastAction.revision === Math.max(0, ep.revision - 1),
    'revision/scene mismatch',
  );
  check(
    JSON.stringify(ep.participantIds) === JSON.stringify(ep.previousRankedIds),
    'previous survivor ranking mismatch',
  );
  check(
    ep.startingContestants.filter((entry) => entry.status === 'ACTIVE').length === 16 &&
      ep.participantIds.every((id, index) => source(id).status === 'ACTIVE' && source(id).rank === index + 1),
    'starting cast must preserve sixteen final Episode 4 survivors',
  );
  const drafted = stage >= at('styling-choice');
  check(
    ep.teams.length === (stage < at('concepts') ? 0 : stage === at('concepts') ? ep.teams.length : 4),
    'leader appointment phase mismatch',
  );
  if (ep.phase === 'concepts') check(ep.teams.length >= 1, 'missing concept leader');
  check(new Set(ep.teams.map((team) => team.conceptId)).size === ep.teams.length, 'repeated concept');
  check(
    ep.draftPicks.length === (stage < at('draft') ? 0 : drafted ? 12 : ep.draftPicks.length),
    'draft phase mismatch',
  );
  const rosters = ep.teams.map((team) => [team.leaderId]);
  for (const [index, team] of ep.teams.entries()) {
    check(
      team.id === `photo-team-${index + 1}` && team.leaderId === ep.previousRankedIds[index],
      'concept leader order mismatch',
    );
    const available = definitions.photoshootConcepts!.filter(
      (entry) => !ep.teams.slice(0, index).some((previous) => previous.conceptId === entry.id),
    );
    exact(
      team.conceptScores,
      available.map(({ id }) => id),
      'incomplete available concepts',
    );
    for (const board of available)
      close(
        team.conceptScores[board.id],
        photoshootConceptPreference(source(team.leaderId), board),
        'concept preference mismatch',
      );
    const selected = [...available].sort(
      (a, b) =>
        team.conceptScores[b.id] - team.conceptScores[a.id] ||
        team.conceptTieKeys[a.id] - team.conceptTieKeys[b.id] ||
        a.id.localeCompare(b.id),
    )[0];
    check(team.conceptId === selected.id && team.name === selected.name, 'concept selection mismatch');
  }
  for (const [index, pick] of ep.draftPicks.entries()) {
    const team = ep.teams[index % 4];
    check(pick.teamId === team.id && pick.round === Math.floor(index / 4) + 1, 'draft order mismatch');
    const available = ep.participantIds.filter((id) => !rosters.flat().includes(id));
    check(
      JSON.stringify(pick.availableIds) === JSON.stringify(available) &&
        available.includes(pick.contestantId),
      'draft availability mismatch',
    );
    const draftScene = ep.scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => scene.sequence === 3 && scene.kind === 'draft')
      .slice(4)[index];
    check(draftScene, 'missing draft scene');
    const cast = relationshipsBefore(draftScene.index);
    const leader = cast.get(team.leaderId)!;
    const expected = [...available].sort(
      (a, b) =>
        battleRelationship(leader, b) - battleRelationship(leader, a) ||
        source(b).utilitySkills.charisma - source(a).utilitySkills.charisma ||
        meanPhoto(Object.values(source(b).coreSkills)) - meanPhoto(Object.values(source(a).coreSkills)) ||
        pick.tieKeys[a] - pick.tieKeys[b] ||
        a.localeCompare(b),
    )[0];
    check(pick.contestantId === expected, 'draft priority mismatch');
    check(
      JSON.stringify(pick.passedOverIds) ===
        JSON.stringify(
          available.filter(
            (id) =>
              id !== expected && source(id).personality.gentleness < 5 && source(id).personality.maturity < 5,
          ),
        ),
      'draft pass-over reaction gate mismatch',
    );
    rosters[index % 4].push(pick.contestantId);
  }
  ep.teams.forEach((team, index) => {
    check(JSON.stringify(team.memberIds) === JSON.stringify(rosters[index]), 'draft roster mismatch');
  });
  const stylingStage = stage >= at('styling-choice');
  const afterStyling = stage > at('styling-result');
  for (const [index, team] of ep.teams.entries()) {
    const proposed = stylingStage && (afterStyling || index <= ep.teamCursor);
    check(
      team.proposals.length === (proposed ? 4 : 0) && (team.negotiation !== null) === proposed,
      'proposal phase mismatch',
    );
    const styled =
      stylingStage &&
      (afterStyling || index < ep.teamCursor || (index === ep.teamCursor && ep.phase === 'styling-result'));
    check((team.styling !== null) === styled, 'styling completion phase mismatch');
    const board = definitions.photoshootConcepts!.find((entry) => entry.id === team.conceptId)!;
    for (const [proposalIndex, proposal] of team.proposals.entries()) {
      check(proposal.contestantId === team.memberIds[proposalIndex], 'proposal participant mismatch');
      const contestant = source(proposal.contestantId);
      const outfit = board.outfits.find((entry) => entry.id === proposal.outfitId);
      const prop = board.props.find((entry) => entry.id === proposal.propId);
      check(
        outfit &&
          prop &&
          outfit.name === proposal.outfitName &&
          prop.name === proposal.propName &&
          outfit.vibeFit[contestant.specialties.visualVibe] === proposal.outfitFit &&
          board.vibeFit[contestant.specialties.visualVibe] === proposal.conceptFit,
        'proposal fit mismatch',
      );
      const allKeys = [
        ...board.outfits.map(({ id }) => `outfit:${id}`),
        ...board.props.map(({ id }) => `prop:${id}`),
      ];
      exact(proposal.tieKeys, allKeys, 'missing wardrobe draws');
      for (const [choices, prefix, chosen] of [
        [board.outfits, 'outfit', proposal.outfitId],
        [board.props, 'prop', proposal.propId],
      ] as const) {
        const expected = [...choices].sort(
          (a, b) =>
            b.vibeFit[contestant.specialties.visualVibe] - a.vibeFit[contestant.specialties.visualVibe] ||
            Math.abs(a.novelty - (contestant.personality.curiosity + 10) * 5) -
              Math.abs(b.novelty - (contestant.personality.curiosity + 10) * 5) ||
            proposal.tieKeys[`${prefix}:${a.id}`] - proposal.tieKeys[`${prefix}:${b.id}`] ||
            a.id.localeCompare(b.id),
        )[0];
        check(chosen === expected.id, 'wardrobe choice priority mismatch');
      }
    }
    if (team.styling) {
      const quality = photoshootStylingQuality(team.memberIds.map(source));
      close(team.styling.quality, quality, 'self styling quality mismatch');
      close(
        team.styling.modifier,
        team.styling.choice === 'intervene' ? 15 : clampPhoto(0.5 * (quality - 50), -15, 25),
        'styling modifier mismatch',
      );
      for (const proposal of team.proposals)
        close(
          team.styling.outfitModifiers[proposal.contestantId],
          team.styling.choice === 'intervene' ? 5 : (proposal.outfitFit - 50) / 10,
          'final outfit fit mismatch',
        );
    }
    const centered =
      stage >= at('center') &&
      (stage > at('group') || index < ep.groupCursor || (index === ep.groupCursor && ep.phase === 'center'));
    check((team.centerId !== null) === centered, 'center election phase mismatch');
    if (team.centerId) {
      const centerScene = ep.scenes.findIndex(
        (scene) => scene.sequence === 6 && scene.title === `${team.name}: choosing a center`,
      );
      check(centerScene >= 0, 'missing center election scene');
      const cast = relationshipsBefore(centerScene);
      for (const voter of team.memberIds) {
        const preference = (id: string) =>
          source(id).coreSkills.visual +
          source(id).coreSkills.uniqueness +
          source(id).utilitySkills.charisma +
          battleRelationship(cast.get(voter)!, id) / 20;
        const expected = [...team.memberIds].sort(
          (a, b) =>
            preference(b) - preference(a) ||
            source(b).coreSkills.stagePresence - source(a).coreSkills.stagePresence ||
            team.centerTieKeys[voter][a] - team.centerTieKeys[voter][b] ||
            a.localeCompare(b),
        )[0];
        check(team.centerBallots[voter] === expected, 'center preference mismatch');
      }
      for (const id of team.memberIds)
        check(
          team.centerTotals[id] ===
            Object.values(team.centerBallots).filter((choice) => choice === id).length,
          'center ballot total mismatch',
        );
      const winner = [...team.memberIds].sort(
        (a, b) =>
          team.centerTotals[b] - team.centerTotals[a] ||
          source(b).coreSkills.visual - source(a).coreSkills.visual ||
          source(b).utilitySkills.charisma - source(a).utilitySkills.charisma ||
          team.centerTieKeys.result[a] - team.centerTieKeys.result[b] ||
          a.localeCompare(b),
      )[0];
      check(team.centerId === winner, 'center election winner mismatch');
    }
  }
  check(
    ep.individualPhotos.length === ep.individualCursor && ep.groupPhotos.length === ep.groupCursor,
    'photo cursor mismatch',
  );
  if (stage < at('individual')) check(ep.individualCursor === 0, 'premature individual photograph');
  if (stage > at('individual')) check(ep.individualCursor === 16, 'incomplete individual photography');
  if (stage < at('center')) check(ep.groupCursor === 0, 'premature cover photograph');
  if (ep.phase === 'center') check(ep.groupCursor < 4, 'center election after final cover');
  if (stage > at('group')) check(ep.groupCursor === 4, 'incomplete cover photography');
  const attention = Object.fromEntries(ep.participantIds.map((id) => [id, 0]));
  for (const [index, photo] of ep.individualPhotos.entries()) {
    check(photo.contestantId === ep.participantIds[index], 'individual shoot order mismatch');
    const team = ep.teams.find((entry) => entry.id === photo.teamId)!;
    check(team.memberIds.includes(photo.contestantId) && team.styling, 'individual team mismatch');
    for (const entry of photo.checks) {
      const contestant = source(photo.contestantId);
      const level =
        entry.skill === 'charisma' || entry.skill === 'potential'
          ? contestant.utilitySkills[entry.skill]
          : contestant.coreSkills[entry.skill];
      check(entry.skillLevel === level, 'individual source skill mismatch');
    }
    close(
      photo.technicalScore,
      0.4 * photo.checks[0].score + 0.4 * photo.checks[1].score + 0.2 * photo.checks[2].score,
      'individual technical composite mismatch',
    );
    close(photo.stylingModifier, team.styling.modifier, 'individual styling mismatch');
    close(
      photo.outfitModifier,
      team.styling.outfitModifiers[photo.contestantId],
      'individual outfit mismatch',
    );
    close(
      photo.finalScore,
      clampPhoto(photo.technicalScore + photo.stylingModifier + photo.outfitModifier),
      'individual final score mismatch',
    );
    const contestant = source(photo.contestantId);
    check(
      photo.banter === (contestant.personality.extroversion >= 5 || contestant.utilitySkills.charisma >= 4),
      'banter gate mismatch',
    );
    if (photo.banter) attention[photo.contestantId]++;
    close(
      photo.feedback[0].score,
      0.7 * photo.checks[1].score + 0.3 * photo.checks[3].score,
      'Megan perspective mismatch',
    );
    close(
      photo.feedback[1].score,
      0.7 * photo.checks[0].score + 0.3 * photo.checks[2].score,
      'Michael perspective mismatch',
    );
    const react = photo.finalScore >= 85 || photo.finalScore < 40;
    check(photo.reactions.length === (react ? 15 : 0), 'photo reaction gate mismatch');
    ids(
      photo.reactions.map(({ observerId }) => observerId),
      ep.participantIds.filter((id) => id !== photo.contestantId),
      react ? 15 : 0,
    );
    check(
      photo.reactions.filter(({ highlighted }) => highlighted).length <= 3,
      'too many highlighted reactions',
    );
  }
  for (const [index, photo] of ep.groupPhotos.entries()) {
    const team = ep.teams[index];
    check(photo.teamId === team.id && photo.centerId === team.centerId, 'cover order or center mismatch');
    check(
      JSON.stringify(photo.evaluations.map(({ contestantId }) => contestantId)) ===
        JSON.stringify(team.memberIds),
      'cover roster mismatch',
    );
    ids(
      photo.actions.map(({ contestantId }) => contestantId),
      team.memberIds,
    );
    for (const id of team.memberIds) {
      const contestant = source(id);
      const entry = photo.evaluations.find((evaluation) => evaluation.contestantId === id)!;
      for (const checkEntry of entry.checks) {
        const level =
          checkEntry.skill === 'charisma' || checkEntry.skill === 'potential'
            ? contestant.utilitySkills[checkEntry.skill]
            : contestant.coreSkills[checkEntry.skill];
        check(checkEntry.skillLevel === level, 'cover source skill mismatch');
      }
      const action = photo.actions.find((action) => action.contestantId === id);
      const steal = id !== team.centerId && contestant.personality.ambition >= 5;
      const yieldSpace = id !== team.centerId && !steal && contestant.personality.gentleness >= 5;
      check(Boolean(action) === (steal || yieldSpace), 'focus/yield gate mismatch');
      if (action) {
        check(action.type === (steal ? 'steal' : 'yield'), 'focus/yield exclusivity mismatch');
        const success = !steal || entry.checks[2].score >= 70;
        check(
          action.success === success &&
            action.modifier === (steal ? (success ? 10 : -10) : -5) &&
            action.beneficiaryId === (steal ? id : team.centerId),
          'cover action evidence mismatch',
        );
        if (success) attention[id]++;
      }
      close(
        entry.technicalScore,
        entry.checks.reduce((sum, entry, index) => sum + entry.score * [0.35, 0.25, 0.25, 0.15][index], 0),
        'cover technical composite mismatch',
      );
      close(entry.stylingModifier, team.styling!.modifier, 'cover styling mismatch');
      close(entry.outfitModifier, team.styling!.outfitModifiers[id], 'cover outfit mismatch');
      check(entry.centerBonus === (id === team.centerId ? 5 : 0), 'center bonus mismatch');
      close(entry.actionModifier, action?.modifier ?? 0, 'cover role modifier mismatch');
      close(entry.cohesionModifier, photo.cohesionModifier, 'shared cohesion mismatch');
      close(
        entry.finalScore,
        clampPhoto(
          entry.technicalScore +
            entry.stylingModifier +
            entry.outfitModifier +
            entry.centerBonus +
            entry.actionModifier +
            photo.cohesionModifier,
        ),
        'cover final result mismatch',
      );
    }
    close(
      photo.baseCohesion,
      clampPhoto((photo.relationshipMean - 50) / 10, -5, 5),
      'relationship cohesion mismatch',
    );
    close(
      photo.supportCohesion,
      Math.min(6, photo.actions.filter(({ type }) => type === 'yield').length * 2),
      'yield cohesion mismatch',
    );
    close(
      photo.stealingPenalty,
      Math.min(6, photo.actions.filter(({ type }) => type === 'steal').length * 3),
      'stealing cohesion mismatch',
    );
    close(
      photo.cohesionModifier,
      photo.baseCohesion + photo.supportCohesion - photo.stealingPenalty,
      'group cohesion mismatch',
    );
    close(
      photo.finalScore,
      meanPhoto(photo.evaluations.map(({ finalScore }) => finalScore)),
      'cover mean mismatch',
    );
  }
  for (const id of ep.participantIds) {
    check(
      ep.attention[id] === attention[id] && ep.receptionBonuses[id] === attention[id] * 5,
      'attention must come from actual banter/focus/angel footage',
    );
  }
  const voted = stage >= at('ballots');
  const awarded = stage >= at('ultimate-visual');
  check(
    (ep.peerVote !== null) === voted &&
      (ep.ultimateVisual !== null) === awarded &&
      (ep.audience !== null) === awarded &&
      ep.rankedIds.length === (awarded ? 16 : 0),
    'peer award/audience phase mismatch',
  );
  if (ep.peerVote) {
    const ballotScene = ep.scenes.findIndex(
      (scene) => scene.sequence === 7 && scene.title === 'Sixteen private peer ballots',
    );
    check(ballotScene >= 0, 'missing gallery ballot scene');
    const atBallot = relationshipsBefore(ballotScene);
    const peerCast = ep.participantIds.map((id) => structuredClone(source(id)));
    for (const voter of peerCast) {
      const evidence = ep.peerEvidence[voter.id];
      for (const [id, relationship] of Object.entries(evidence.relationships)) {
        const photo = ep.individualPhotos.find((entry) => entry.contestantId === id)!;
        close(
          evidence.preferences[id],
          0.65 * relationship + 0.35 * photo.finalScore,
          'peer friendship/photo weighting mismatch',
        );
        close(relationship, battleRelationship(atBallot.get(voter.id)!, id), 'peer outgoing bond mismatch');
        voter.relationships[id] = [relationship];
      }
    }
    const expected = choosePhotoshootVisual(peerCast, ep.individualPhotos, ep.peerTieKeys, ep.awardTieKeys);
    check(
      JSON.stringify(expected.result) === JSON.stringify(ep.peerVote),
      'Ultimate Visual ballot/winner mismatch',
    );
    for (const id of ep.participantIds)
      check(
        expected.evidence[id].closestFriendId === ep.peerEvidence[id].closestFriendId &&
          expected.evidence[id].override === ep.peerEvidence[id].override,
        'peer override evidence mismatch',
      );
  }
  if (awarded) {
    check(JSON.stringify(ep.ultimateVisual) === JSON.stringify(ep.peerVote), 'announced award mismatch');
    const ranked = [...ep.participantIds].sort(
      (a, b) =>
        ep.sealedRankingScores[b] - ep.sealedRankingScores[a] ||
        ep.rankingTieKeys[a] - ep.rankingTieKeys[b] ||
        a.localeCompare(b),
    );
    check(JSON.stringify(ranked) === JSON.stringify(ep.rankedIds), 'sealed ranking mismatch');
  }
  check(ep.rankRevealed === stage >= at('ranking'), 'private rank reveal mismatch');
  check(ep.survivorIds.length === (ep.phase === 'complete' ? 16 : 0), 'continuing cast phase mismatch');
  if (ep.phase === 'complete')
    check(
      JSON.stringify(ep.survivorIds) === JSON.stringify(ep.rankedIds),
      'all sixteen must continue in final rank order',
    );
  if (stage < at('secret-choice'))
    check(!ep.secretCandidates.length && ep.secret === null, 'premature investigation');
  if (ep.phase === 'secret-choice')
    check(ep.secretCandidates.length > 0 && ep.secret === null, 'missing eligible investigation shortlist');
  if (ep.secret)
    check(ep.secretCandidates.includes(ep.secret.contestantId), 'secret outside persisted shortlist');
}

export function validatePhotoshoot(state: SimulationState): void {
  const ep = state.runtime?.photoshoot;
  if (!ep) return;
  assertPhotoshootEpisode(ep, state.contestants, state.runtime!.definitions);
  const previous = state.runtime!.megaGroups;
  check(
    previous?.phase === 'complete' &&
      JSON.stringify(previous.survivorIds) === JSON.stringify(ep.previousRankedIds),
    'completed Mega Groups survivor provenance mismatch',
  );
  check(
    state.contestants.filter(({ status }) => status === 'ACTIVE').length === 16 &&
      ep.participantIds.every(
        (id) => state.contestants.find((entry) => entry.id === id)?.status === 'ACTIVE',
      ),
    'the Photoshoot cannot remove a performer',
  );
  for (const id of ep.participantIds) {
    const current = state.contestants.find((entry) => entry.id === id)!;
    const source = ep.startingContestants.find((entry) => entry.id === id)!;
    check(
      current.rank === (ep.rankRevealed ? ep.rankedIds.indexOf(id) + 1 : source.rank),
      'private or revealed live rank mismatch',
    );
    close(
      current.aggregations.rankingScore,
      ep.rankRevealed ? ep.sealedRankingScores[id] : source.aggregations.rankingScore,
      'sealed ranking points leaked or changed',
    );
  }
}
