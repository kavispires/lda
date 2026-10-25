import type { Contestant } from '../types/contestant';
import type { SimulationDefinitions, SimulationState } from '../types/simulation';
import type { VarietyShowEpisode, VarietyShowPhase, VarietyShowSegment } from '../types/variety-show-episode';
import { validateVarietyShowCatalog } from '../utilities/variety-show-catalog';
import {
  chooseEvidenceMvp,
  resolveNarrativeEvidenceAudience,
  transferEliminatedFans,
} from './audition-audience';
import { revealAuditionSecret, revealExactAuditionSecret } from './audition-secrets';
import { changeBattleRelationship, clampBattle } from './battle-scoring';
import { createSeededRandom, shuffleWithRandom } from './random';
import { assessVarietyShow, finalizeVarietyShowSegment, scoreVarietyShow } from './variety-show-scoring';
import {
  createVarietyShowTeams,
  electVarietyShowLeader,
  varietyShowConflict,
  varietyShowConflictDescription,
  varietyShowIdeas,
} from './variety-show-teams';
import { awardVarietyIceCategory, resolveVarietyIceCategory } from './variety-show-voting';
import { unrevealedVersatilityCards } from './versatility-expulsion';

function fail(detail: string): never {
  throw new Error(`Invalid Variety Show episode: ${detail}.`);
}
const same = (actual: unknown, expected: unknown, detail: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(detail);
};
const unique = (ids: string[]) =>
  Array.isArray(ids) && ids.every((id) => typeof id === 'string') && new Set(ids).size === ids.length;
const integer = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const unit = (value: number) => Number.isFinite(value) && value >= 0 && value < 1;
const phases: VarietyShowPhase[] = [
  'briefing',
  'credits',
  'icebreaker',
  'team-draw',
  'physical',
  'interviews',
  'improv-preparation',
  'intervention',
  'improv',
  'panel',
  'peer-mvp',
  'secret-choice',
  'secret-result',
  'ranking',
  'elimination',
  'complete',
];
function randomReplay(values: number[]) {
  if (!Array.isArray(values) || values.some((value) => !unit(value))) fail('saved random values');
  let index = 0;
  return {
    next: () => {
      if (index >= values.length) fail('missing random draw');
      return values[index++];
    },
    done: () => {
      if (index !== values.length) fail('unused random draws');
    },
  };
}
function tieKeys(keys: Record<string, number>, ids: string[]) {
  if (!keys || typeof keys !== 'object') fail('tie keys');
  same(Object.keys(keys).sort(), [...ids].sort(), 'tie eligibility');
  if (Object.values(keys).some((key) => !unit(key))) fail('tie key range');
}
function checkCast(people: readonly Contestant[], count: number) {
  if (!Array.isArray(people) || people.length !== count || !unique(people.map((person) => person.id)))
    fail('cast');
  for (const person of people) {
    if (
      !person ||
      typeof person.name !== 'string' ||
      !integer(person.rank, 1, 50) ||
      !person.relationships ||
      !Array.isArray(person.events) ||
      !Array.isArray(person.attributes)
    )
      fail('contestant shape');
    for (const skill of [
      'vocals',
      'rap',
      'dance',
      'stagePresence',
      'visual',
      'uniqueness',
      'leadership',
    ] as const)
      if (!integer(person.coreSkills?.[skill], 1, 5)) fail('core skill range');
    for (const skill of [
      'potential',
      'memory',
      'stamina',
      'learning',
      'acrobatics',
      'consistency',
      'charisma',
    ] as const)
      if (!integer(person.utilitySkills?.[skill], 1, 5)) fail('utility skill range');
    if (Object.keys(person.personality).length !== 10) fail('personality shape');
    for (const trait of [
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
    ] as const)
      if (!integer(person.personality?.[trait], -10, 10)) fail('personality range');
    if (
      !Number.isFinite(person.aggregations.rankingScore) ||
      !Number.isFinite(person.aggregations.audienceRatio) ||
      person.aggregations.audienceRatio < -1 ||
      person.aggregations.audienceRatio > 1 ||
      !Number.isFinite(person.aggregations.happiness) ||
      person.aggregations.happiness < 0 ||
      person.aggregations.happiness > 100
    )
      fail('aggregation range');
    if (Object.hasOwn(person.relationships, person.id)) fail('self relationship');
    for (const values of Object.values(person.relationships))
      if (
        !Array.isArray(values) ||
        !values.length ||
        values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)
      )
        fail('affection range');
  }
}
function mechanical(person: Contestant) {
  const copy = structuredClone(person);
  // These presentation/history fields are awarded by the shared transition wrapper.
  const { screenTime: _screen, score: _score, experience: _experience, ...aggregations } = copy.aggregations;
  const { updatedAt: _updated, changeLog: _history, ...identity } = copy;
  return { ...identity, aggregations };
}
function compareCast(actual: readonly Contestant[], expected: readonly Contestant[], detail: string) {
  same(actual.map(mechanical), expected.map(mechanical), detail);
}

function validateChangeAudit(ep: VarietyShowEpisode, contestants: readonly Contestant[]) {
  same(Object.keys(ep.changes).sort(), [...ep.participantIds].sort(), 'full participant change audit');
  for (const id of ep.participantIds) {
    const reconstructed = structuredClone(ep.startingContestants.find((entry) => entry.id === id))!;
    const changes = ep.changes[id];
    if (!Array.isArray(changes)) fail('change audit');
    for (const change of changes) {
      if (
        typeof change.path !== 'string' ||
        !change.path ||
        typeof change.cause !== 'string' ||
        !change.cause.trim()
      )
        fail('change cause/path');
      const parts = change.path.split('.');
      if (
        parts.some((part) => !part || ['__proto__', 'constructor', 'prototype', 'changeLog'].includes(part))
      )
        fail('unsafe change path');
      let target = reconstructed as unknown as Record<string, unknown>;
      for (const part of parts.slice(0, -1)) {
        if (!Object.hasOwn(target, part) || !target[part] || typeof target[part] !== 'object')
          fail('change parent');
        target = target[part] as Record<string, unknown>;
      }
      const key = parts.at(-1)!;
      same(target[key], change.before, 'change chain before');
      if (Object.hasOwn(change, 'after')) target[key] = structuredClone(change.after);
      else delete target[key];
    }
    const actual = contestants.find((entry) => entry.id === id)!;
    const { changeLog: _oldHistory, ...expectedBody } = reconstructed;
    const { changeLog: _newHistory, ...actualBody } = actual;
    same(actualBody, expectedBody, 'once-only private/public change chain');
  }
}

function replaySeededDraws(ep: VarietyShowEpisode): number {
  const rng = createSeededRandom(ep.randomStartState);
  const draw = (actual: number) => same(actual, rng.next(), 'seeded random chronology');
  const dice = (segment: VarietyShowSegment) => {
    for (const evaluation of segment.evaluations)
      same(
        evaluation.rawDice,
        [Math.floor(rng.next() * 6) + 1, Math.floor(rng.next() * 6) + 1],
        'seeded saved dice',
      );
  };
  if (ep.icebreaker)
    for (const category of ep.icebreaker.categories) {
      for (const id of ep.participantIds) draw(category.ties.shortlist[id]);
      for (const voter of ep.participantIds)
        for (const candidate of ep.participantIds) draw(category.ties.ballots[voter][candidate]);
      for (const id of ep.participantIds) draw(category.ties.result[id]);
    }
  for (const value of ep.drawRandom) draw(value);
  for (const segment of ep.segments.filter((entry) => entry.kind === 'physical')) {
    if (segment.challengeDraw !== null) draw(segment.challengeDraw);
    dice(segment);
  }
  for (const segment of ep.segments.filter((entry) => entry.kind === 'interview'))
    for (const evaluation of segment.evaluations) {
      draw(segment.promptDraws[evaluation.contestantId]);
      same(
        evaluation.rawDice,
        [Math.floor(rng.next() * 6) + 1, Math.floor(rng.next() * 6) + 1],
        'seeded interview dice',
      );
    }
  for (const team of ep.teams)
    if (team.preparation) {
      for (const id of team.memberIds) draw(team.leaderElection!.tieKeys[id]);
      draw(team.preparation.sceneDraw);
      draw(team.preparation.propDraw);
      const segment = ep.segments.find((entry) => entry.kind === 'improv' && entry.teamId === team.id);
      if (segment) dice(segment);
    }
  for (const value of ep.audienceRandom) draw(value);
  if (ep.audience) for (const id of ep.participantIds) draw(ep.rankingTieKeys[id]);
  for (const value of ep.mvpRandom) draw(value);
  for (const value of ep.investigationRandom) draw(value);
  for (const transfer of ep.fanTransfers) for (const value of transfer.random) draw(value);
  return rng.getState();
}

export function assertVarietyShowEpisode(
  value: unknown,
  contestants: readonly Contestant[],
  definitions: SimulationDefinitions,
): asserts value is VarietyShowEpisode {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('record');
  const ep = value as VarietyShowEpisode;
  if (
    ep.version !== 1 ||
    !phases.includes(ep.phase) ||
    !integer(ep.revision, 0, Number.MAX_SAFE_INTEGER) ||
    !ep.lastAction ||
    !ep.lastAction.action ||
    (ep.revision === 0
      ? ep.lastAction.revision !== 0 || ep.lastAction.action.type !== 'start'
      : ep.lastAction.revision !== ep.revision - 1)
  )
    fail('version, phase or revision');
  const action = ep.lastAction.action;
  if (
    !['start', 'advance', 'conflict', 'secret'].includes(action.type) ||
    (action.type === 'conflict' && !['support', 'mediate', 'push'].includes(action.choice)) ||
    (action.type === 'secret' && !ep.secretCandidates?.includes(action.contestantId))
  )
    fail('last action');
  for (const field of [
    'participantIds',
    'startingContestants',
    'previousRankedIds',
    'openingCast',
    'drawOrder',
    'drawRandom',
    'teams',
    'segments',
    'panel',
    'evidence',
    'audienceContestants',
    'audienceRandom',
    'mvpContestants',
    'mvpRandom',
    'secretCandidates',
    'investigationEligibleIds',
    'investigationContestants',
    'investigationRandom',
    'rankedIds',
    'survivorIds',
    'eliminatedIds',
    'fanTransfers',
    'scenes',
  ] as const)
    if (!Array.isArray(ep[field])) fail(`missing ${field}`);
  for (const field of ['changes', 'exposure', 'rankingTieKeys', 'sealedRankingScores'] as const)
    if (!ep[field] || typeof ep[field] !== 'object' || Array.isArray(ep[field])) fail(`missing ${field}`);
  for (const field of [
    'icebreaker',
    'conflict',
    'physicalGameId',
    'audience',
    'audienceBefore',
    'audienceAfter',
    'audienceMood',
    'mvp',
    'secret',
  ] as const)
    if (ep[field] === undefined) fail(`missing ${field}`);
  validateVarietyShowCatalog(definitions.varietyShowCatalog);
  const catalog = definitions.varietyShowCatalog;
  checkCast(ep.startingContestants, 50);
  checkCast(contestants, 50);
  if (
    !unique(ep.participantIds) ||
    ep.participantIds.length !== 12 ||
    ep.startingContestants.filter((entry) => entry.status === 'ACTIVE').length !== 12 ||
    ep.participantIds.some(
      (id) => !ep.startingContestants.some((entry) => entry.id === id && entry.status === 'ACTIVE'),
    )
  )
    fail('exact twelve participants');
  const expectedPrior = ep.startingContestants
    .filter((entry) => ep.participantIds.includes(entry.id))
    .sort((a, b) => a.rank - b.rank);
  same(
    ep.previousRankedIds,
    expectedPrior.map((entry) => entry.id),
    'previous final twelve ranking',
  );
  same(
    expectedPrior.map((entry) => entry.rank),
    Array.from({ length: 12 }, (_, i) => i + 1),
    'previous placements',
  );
  same(
    [...ep.startingContestants.map((entry) => entry.rank)].sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, i) => i + 1),
    'starting fifty placements',
  );
  same(
    [...contestants.map((entry) => entry.rank)].sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, i) => i + 1),
    'current fifty placements',
  );
  if (!integer(ep.drawCursor, 0, 12) || !integer(ep.teamCursor, 0, 2) || typeof ep.rankRevealed !== 'boolean')
    fail('cursors');
  if (ep.scenes.length !== ep.revision + 1) fail('scene/revision chronology');
  let sequence = 0;
  for (const [index, scene] of ep.scenes.entries()) {
    if (
      scene.id !== `variety-show-${index}` ||
      scene.sequence === undefined ||
      !integer(scene.sequence, 1, 8) ||
      scene.sequence < sequence ||
      !Array.isArray(scene.paragraphs) ||
      !Array.isArray(scene.contestantIds) ||
      scene.contestantIds.some((id) => !ep.participantIds.includes(id))
    )
      fail('scene chronology or references');
    sequence = scene.sequence;
    if (scene.presentation === 'credits' && (scene.sequence !== 2 || scene.kind !== 'opening'))
      fail('opening sequence');
    if (scene.sequence === 3 && scene.contestantChanges) fail('private icebreaker effects in a public scene');
  }
  if (ep.scenes[0].sequence !== 1 || ep.scenes[0].presentation === 'credits') fail('briefing sequence');
  const replay = structuredClone(ep.startingContestants);
  const get = (id: string) => {
    const person = replay.find((entry) => entry.id === id);
    if (!person) return fail('unknown contestant');
    return person;
  };
  const participants = () => ep.participantIds.map(get);
  const playedOpening = ep.phase !== 'briefing';
  if (playedOpening) {
    if (
      !unique(ep.openingCast) ||
      ep.openingCast.length !== 5 ||
      ep.openingCast.some((id) => !ep.participantIds.includes(id))
    )
      fail('opening eligibility');
    for (const id of ep.openingCast)
      get(id).aggregations.audienceRatio = Math.min(1, get(id).aggregations.audienceRatio + 0.02);
  } else same(ep.openingCast, [], 'premature opening');
  const progress = phases.indexOf(ep.phase);
  if (!ep.icebreaker) {
    if (progress >= 2) fail('missing frozen icebreaker');
  } else {
    const ice = ep.icebreaker;
    checkCast(ice.frozenContestants, 12);
    compareCast(ice.frozenContestants, participants(), 'icebreaker pre-award snapshot');
    if (!integer(ice.revealCursor, 0, 8) || ice.categories.length !== 8) fail('icebreaker categories/cursor');
    for (const [index, category] of ice.categories.entries()) {
      tieKeys(category.ties.shortlist, ep.participantIds);
      tieKeys(category.ties.result, ep.participantIds);
      same(Object.keys(category.ties.ballots), ep.participantIds, 'all twelve ballot tie records');
      for (const id of ep.participantIds) tieKeys(category.ties.ballots[id], ep.participantIds);
      const expected = resolveVarietyIceCategory(ice.frozenContestants, index, category.ties);
      expected.revealed = index < ice.revealCursor;
      same(category, expected, 'literal shortlist, frozen affection ballots and result');
    }
    const awards = structuredClone(ice);
    awards.revealCursor = 0;
    for (const category of awards.categories) category.revealed = false;
    for (let i = 0; i < ice.revealCursor; i++) awardVarietyIceCategory(replay, awards);
    if (progress > 2 && ice.revealCursor !== 8) fail('draw before all awards');
  }
  if (!ep.drawOrder.length) {
    if (ep.teams.length || ep.drawCursor || progress >= 3) fail('missing blind draw');
    same(ep.drawRandom, [], 'premature draw evidence');
  } else {
    if (ep.icebreaker?.revealCursor !== 8) fail('draw before awards');
    const rng = randomReplay(ep.drawRandom);
    same(ep.drawOrder, shuffleWithRandom(ep.participantIds, rng.next), 'one blind random partition');
    rng.done();
    const expectedTeams = createVarietyShowTeams(ep.drawOrder, participants());
    if (ep.teams.length !== 3 || ep.drawCursor < 1) fail('three teams');
    for (const [index, team] of ep.teams.entries()) {
      const expected = expectedTeams[index];
      same(
        [team.id, team.name, team.memberIds, team.ambitionClash],
        [expected.id, expected.name, expected.memberIds, expected.ambitionClash],
        'draw membership and genuine clash',
      );
      if (ep.drawCursor >= (index + 1) * 4 && team.ambitionClash) {
        const [first, second] = team.ambitionClash.contestantIds;
        changeBattleRelationship(get(first), second, -2);
        changeBattleRelationship(get(second), first, -2);
      }
    }
    if (progress > 3 && ep.drawCursor !== 12) fail('act before draw complete');
  }
  // Physical and interview turns precede every improv election and intervention.
  const expectedOrder: { kind: 'physical' | 'interview' | 'improv'; teamId: string }[] = (
    ['physical', 'interview', 'improv'] as const
  ).flatMap((kind) => ep.teams.map((team) => ({ kind, teamId: team.id })));
  if (ep.segments.length > 9) fail('duplicate segment');
  for (const [index, segment] of ep.segments.entries()) {
    same({ kind: segment.kind, teamId: segment.teamId }, expectedOrder[index], 'segment order');
    if (index > 0 && ep.segments[index - 1].teamScore === null) fail('unfinished earlier act');
  }
  function validateSegment(segment: VarietyShowSegment, teamIndex: number) {
    const team = ep.teams[teamIndex];
    if (
      !Array.isArray(segment.evaluations) ||
      segment.evaluations.length < 1 ||
      segment.evaluations.length > 4 ||
      (segment.kind !== 'interview' && segment.evaluations.length !== 4)
    )
      fail('actual turns');
    compareCast(segment.frozenContestants, team.memberIds.map(get), 'act snapshot');
    const complete = segment.evaluations.length === 4;
    if ((segment.teamScore !== null) !== complete) fail('team mean before all four answers');
    const expected: VarietyShowSegment = {
      ...structuredClone(segment),
      evaluations: [],
      teamScore: null,
      cohesion: 0,
      coordination: 0,
      chaosPenalty: 0,
    };
    for (const [i, entry] of segment.evaluations.entries()) {
      if (entry.contestantId !== team.memberIds[i]) fail('every performer exactly once in draw order');
      expected.evaluations.push(scoreVarietyShow(get(entry.contestantId), segment.kind, entry.rawDice));
    }
    if (complete) finalizeVarietyShowSegment(expected, team.preparation?.coordination ?? 0);
    same(segment, expected, 'checks, trait gates, modifiers, team blend and grades');
    if (segment.kind === 'physical') {
      if (
        segment.challengeId !== ep.physicalGameId ||
        Object.keys(segment.promptIds).length ||
        Object.keys(segment.promptDraws).length
      )
        fail('physical game');
      if (teamIndex === 0) {
        if (
          segment.challengeDraw === null ||
          !unit(segment.challengeDraw) ||
          catalog.physicalGames[Math.floor(segment.challengeDraw * catalog.physicalGames.length)].id !==
            ep.physicalGameId
        )
          fail('physical game draw');
      } else if (segment.challengeDraw !== null) fail('duplicate physical game draw');
    } else if (segment.kind === 'interview') {
      if (segment.challengeId !== 'public-interview' || segment.challengeDraw !== null)
        fail('public interview');
      same(
        Object.keys(segment.promptIds),
        segment.evaluations.map((entry) => entry.contestantId),
        'prompt eligibility',
      );
      same(Object.keys(segment.promptDraws), Object.keys(segment.promptIds), 'prompt draws');
      for (const [id, draw] of Object.entries(segment.promptDraws))
        if (
          !unit(draw) ||
          catalog.interviewPrompts[Math.floor(draw * catalog.interviewPrompts.length)].id !==
            segment.promptIds[id]
        )
          fail('public prompt draw');
    } else if (
      segment.challengeId !== team.preparation?.sceneId ||
      segment.challengeDraw !== null ||
      Object.keys(segment.promptIds).length ||
      Object.keys(segment.promptDraws).length
    )
      fail('improv premise');
  }
  for (const segment of ep.segments.filter((segment) => segment.kind !== 'improv')) {
    validateSegment(
      segment,
      ep.teams.findIndex((team) => team.id === segment.teamId),
    );
  }
  let conflict: VarietyShowEpisode['conflict'] = null;
  for (const [index, team] of ep.teams.entries()) {
    if (!team.preparation) {
      if (team.leaderId || team.leaderElection || team.leaderContestants.length) fail('premature leader');
      if (ep.segments.some((segment) => segment.kind === 'improv' && segment.teamId === team.id))
        fail('improv without prep');
      continue;
    }
    if (
      ep.segments.filter((segment) => segment.kind === 'interview' && segment.teamScore !== null).length !==
        3 ||
      (index > 0 &&
        !ep.segments.some(
          (segment) => segment.kind === 'improv' && segment.teamId === ep.teams[index - 1].id,
        ))
    )
      fail('preparation before earlier acts');
    compareCast(team.leaderContestants, team.memberIds.map(get), 'leader snapshot');
    if (!team.leaderElection) fail('missing leader election');
    tieKeys(team.leaderElection.tieKeys, team.memberIds);
    same(
      team.leaderElection,
      electVarietyShowLeader(team.leaderContestants, team.leaderElection.tieKeys),
      'ordinary leader election',
    );
    if (team.leaderId !== team.leaderElection.winnerId) fail('leader identity');
    get(team.leaderId).aggregations.leader++;
    const prep = team.preparation;
    if (
      !prep.completed ||
      prep.minutes !== 5 ||
      !unit(prep.sceneDraw) ||
      !unit(prep.propDraw) ||
      catalog.improvScenes[Math.floor(prep.sceneDraw * catalog.improvScenes.length)].id !== prep.sceneId ||
      catalog.propBoxes[Math.floor(prep.propDraw * catalog.propBoxes.length)].id !== prep.propBoxId ||
      prep.ideas.length !== 4 ||
      prep.ideas.some((idea, i) => idea.contestantId !== team.memberIds[i] || !idea.description.trim())
    )
      fail('substantive five-minute preparation');
    same(prep.ideas, varietyShowIdeas(team.leaderContestants), 'actual incompatible proposals');
    const pair = varietyShowConflict(team.leaderContestants);
    if (pair) {
      if (!prep.conflict) fail('missing genuine disagreement');
      same(prep.conflict.contestantIds, pair, 'involved disagreement pair');
      same(
        prep.conflict.description,
        varietyShowConflictDescription(team.leaderContestants),
        'genuine disagreement description',
      );
      const choice = prep.conflict.choice;
      if (choice !== null && !['support', 'mediate', 'push'].includes(choice)) fail('intervention choice');
      if (choice) {
        same(
          prep.coordination,
          choice === 'push' ? 3 : choice === 'support' ? 2 : 1,
          'once-only intervention coordination',
        );
        const delta = choice === 'push' ? -3 : choice === 'mediate' ? 2 : 1;
        changeBattleRelationship(get(pair[0]), pair[1], delta);
        changeBattleRelationship(get(pair[1]), pair[0], delta);
      } else {
        same(prep.coordination, 0, 'unresolved coordination');
        conflict = { teamId: team.id, contestantIds: pair, description: prep.conflict.description };
      }
    } else if (prep.conflict !== null || prep.coordination !== 0) fail('manufactured conflict');
    const segment = ep.segments.find((segment) => segment.kind === 'improv' && segment.teamId === team.id);
    if (segment) {
      if (conflict) fail('act before intervention');
      validateSegment(segment, index);
    }
  }
  same(ep.conflict, conflict, 'pending conflict');
  if ((ep.phase === 'intervention') !== Boolean(conflict)) fail('conflict phase');
  const actsComplete = ep.segments.length === 9 && ep.segments.every((segment) => segment.teamScore !== null);
  if (ep.panel.length) {
    if (!actsComplete) fail('panel before all acts');
    same(
      ep.panel,
      ep.participantIds.map((id) => assessVarietyShow(id, ep.segments)),
      'equal four-judge panel',
    );
  } else if (progress >= phases.indexOf('panel')) fail('missing panel');
  let expectedShow = structuredClone(ep.startingShow);
  if (ep.audience) {
    if (ep.panel.length !== 12 || !ep.audienceBefore || !ep.audienceAfter || !ep.audienceMood)
      fail('audience closure before panel');
    compareCast(ep.audienceContestants, participants(), 'audience snapshot');
    same(ep.audienceBefore, expectedShow, 'single audience before');
    const expectedEvidence = ep.panel.map((assessment) => {
      const evaluations = ep.segments.flatMap((segment) =>
        segment.evaluations.filter((entry) => entry.contestantId === assessment.contestantId),
      );
      const reception = clampBattle(
        evaluations.reduce((sum, entry) => sum + entry.receptionModifier, 0),
        -10,
        10,
      );
      const comic = clampBattle(
        evaluations.flatMap((entry) => entry.events).reduce((sum, entry) => sum + entry.comic, 0),
        -5,
        5,
      );
      return {
        contestantId: assessment.contestantId,
        finalScore: assessment.finalScore,
        observedScore: clampBattle(
          0.5 * evaluations[2].personalScore +
            0.3 * evaluations[0].checks.charisma.score +
            0.2 * evaluations[1].checks.charisma.score +
            comic,
        ),
        reception: clampBattle(assessment.finalScore + reception),
        category: 'variety',
      };
    });
    same(ep.evidence, expectedEvidence, 'native comic evidence and bounded reception');
    const units = ep.participantIds.map(
      (id) =>
        3 +
        Math.min(
          2,
          ep.segments
            .flatMap((segment) => segment.evaluations)
            .filter((entry) => entry.contestantId === id)
            .flatMap((entry) => entry.events)
            .reduce((sum, entry) => sum + entry.spotlight, 0) +
            ep.teams.reduce(
              (sum, team) =>
                sum +
                Number(team.leaderId === id) +
                Number(team.preparation?.conflict?.contestantIds.includes(id) ?? false),
              0,
            ),
        ),
    );
    const total = units.reduce((sum, value) => sum + value, 0);
    same(
      ep.exposure,
      Object.fromEntries(ep.participantIds.map((id, index) => [id, units[index] / total])),
      'real exposure',
    );
    const rng = randomReplay(ep.audienceRandom);
    const result = resolveNarrativeEvidenceAudience({
      contestants: ep.audienceContestants,
      evidence: ep.evidence,
      exposure: ep.exposure,
      mood: ep.audienceMood,
      show: ep.audienceBefore,
      random: rng.next,
    });
    rng.done();
    same(ep.audience, result.outcome, 'audience result');
    same(ep.audienceAfter, result.show, 'audience show');
    expectedShow = result.show;
    tieKeys(ep.rankingTieKeys, ep.participantIds);
    same(
      ep.sealedRankingScores,
      Object.fromEntries(result.contestants.map((entry) => [entry.id, entry.aggregations.rankingScore])),
      'sealed ranking formula',
    );
    same(
      ep.rankedIds,
      [...result.contestants]
        .sort(
          (a, b) =>
            b.aggregations.rankingScore - a.aggregations.rankingScore ||
            ep.rankingTieKeys[a.id] - ep.rankingTieKeys[b.id] ||
            a.id.localeCompare(b.id),
        )
        .map((entry) => entry.id),
      'sealed rank order',
    );
    for (const entry of result.contestants) {
      entry.rank = get(entry.id).rank;
      entry.aggregations.rankingScore = get(entry.id).aggregations.rankingScore;
      entry.aggregations.experience = get(entry.id).aggregations.experience;
      entry.aggregations.score = get(entry.id).aggregations.score;
      entry.aggregations.screenTime = get(entry.id).aggregations.screenTime;
      replay[replay.findIndex((person) => person.id === entry.id)] = entry;
    }
  } else {
    if (progress >= phases.indexOf('peer-mvp')) fail('missing sealed audience');
    for (const field of ['evidence', 'audienceContestants', 'audienceRandom', 'rankedIds'] as const)
      same(ep[field], [], 'premature audience evidence');
    for (const field of ['exposure', 'sealedRankingScores', 'rankingTieKeys'] as const)
      same(ep[field], {}, 'premature sealed scores');
    if (ep.audienceBefore !== null || ep.audienceAfter !== null || ep.audienceMood !== null)
      fail('premature audience snapshot');
  }
  if (ep.mvp) {
    if (!ep.audience) fail('MVP before audience');
    compareCast(ep.mvpContestants, participants(), 'MVP snapshot');
    const rng = randomReplay(ep.mvpRandom);
    same(
      ep.mvp,
      chooseEvidenceMvp(ep.mvpContestants, ep.evidence, ep.participantIds, rng.next, 12),
      'all twelve comic MVP/no self votes',
    );
    rng.done();
    get(ep.mvp.winnerId).aggregations.mvp++;
  } else if (ep.mvpContestants.length || ep.mvpRandom.length || ep.audience) fail('MVP chronology');
  if (ep.investigationContestants.length) {
    if (!ep.mvp) fail('investigation before MVP');
    compareCast(ep.investigationContestants, replay, 'investigation snapshot');
    const eligible = ep.participantIds.filter(
      (id) =>
        !get(id).events.some((event) => event.startsWith('SECRET_REVEALED:')) ||
        unrevealedVersatilityCards(get(id), definitions).length > 0,
    );
    same(ep.investigationEligibleIds, eligible, 'investigation eligibility');
    const available = eligible.some((id) => unrevealedVersatilityCards(get(id), definitions).length);
    const rng = randomReplay(ep.investigationRandom);
    same(
      ep.secretCandidates,
      available ? shuffleWithRandom(eligible, rng.next).slice(0, 3) : [],
      'unbiased three-person shortlist',
    );
    rng.done();
    if (ep.secret) {
      if (!ep.secretCandidates.includes(ep.secret.contestantId)) fail('secret target');
      const cards = unrevealedVersatilityCards(get(ep.secret.contestantId), definitions);
      const result = cards.length
        ? revealExactAuditionSecret(replay, ep.secret.contestantId, cards[0], definitions)
        : revealAuditionSecret(replay, ep.secret.contestantId, definitions);
      same(ep.secret, result.result, 'exact reveal or genuine miss');
      replay.splice(0, replay.length, ...result.contestants);
    } else if (ep.secretCandidates.length && ep.phase !== 'secret-choice') fail('unresolved investigation');
  } else {
    if (progress >= phases.indexOf('secret-choice')) fail('missing investigation');
    same(ep.secretCandidates, [], 'premature secret candidates');
    same(ep.investigationEligibleIds, [], 'premature investigation eligibility');
    same(ep.investigationRandom, [], 'premature investigation draws');
    if (ep.secret !== null) fail('premature reveal');
  }
  const ranked = ['ranking', 'elimination', 'complete'].includes(ep.phase);
  if (ep.rankRevealed !== ranked) fail('ranking announcement chronology');
  if (ranked)
    for (const [index, id] of ep.rankedIds.entries()) {
      const entry = get(id);
      entry.rank = index + 1;
      entry.aggregations.rankingScore = ep.sealedRankingScores[id];
      entry.grade = ep.panel.find((assessment) => assessment.contestantId === id)!.grade;
      entry.missionRating = { A: 5, B: 4, C: 3, D: 2, F: 1 }[entry.grade];
    }
  if (ep.phase === 'elimination' || ep.phase === 'complete') {
    same(ep.survivorIds, ep.rankedIds.slice(0, 10), 'exact ten survivors');
    same(ep.eliminatedIds, ep.rankedIds.slice(10), 'rank eleven then twelve depart');
    for (const id of ep.eliminatedIds) {
      get(id).status = 'ELIMINATED';
      get(id).events.push('VARIETY_SHOW_ELIMINATED');
    }
    if (ep.fanTransfers.length !== 1) fail('once-only departure fans');
    const transfer = ep.fanTransfers[0];
    same(transfer.survivorIds, ep.survivorIds, 'fan recipients');
    same(transfer.before, expectedShow, 'fans before departure');
    const rng = randomReplay(transfer.random);
    expectedShow = transferEliminatedFans(transfer.before, replay, ep.survivorIds, rng.next);
    rng.done();
    same(transfer.after, expectedShow, 'fan conservation');
  } else if (ep.survivorIds.length || ep.eliminatedIds.length || ep.fanTransfers.length)
    fail('premature departures');
  compareCast(contestants, replay, 'exact once-only effects, conditions and unchanged earlier placements');
  validateChangeAudit(ep, contestants);
  for (const id of ep.participantIds) {
    const actual = contestants.find((entry) => entry.id === id)!;
    const expected = get(id);
    const evaluations = ep.segments
      .flatMap((segment) => segment.evaluations)
      .filter((entry) => entry.contestantId === id);
    const preparation = ep.teams.some((team) => team.memberIds.includes(id) && team.preparation?.completed)
      ? 1
      : 0;
    const sceneTV = ep.scenes.reduce(
      (sum, scene) =>
        sum + Object.values(scene.tvMoments ?? {}).reduce((total, moment) => total + (moment[id] ?? 0), 0),
      0,
    );
    const performanceTV = evaluations.reduce(
      (sum, evaluation) => sum + (evaluation.personalScore >= 85 ? 6 : 3),
      0,
    );
    same(
      actual.aggregations.experience,
      expected.aggregations.experience + 3 * evaluations.length + preparation,
      'exact once-only segment/preparation experience',
    );
    same(
      actual.aggregations.score,
      expected.aggregations.score + sceneTV + performanceTV,
      'exact once-only activity tier totals',
    );
    same(
      actual.aggregations.screenTime,
      expected.aggregations.screenTime + ep.scenes.filter((scene) => scene.contestantIds.includes(id)).length,
      'actual aired appearances',
    );
  }
  replaySeededDraws(ep);
  const counts = (kind: VarietyShowSegment['kind']) =>
    ep.segments.filter((entry) => entry.kind === kind).length;
  const prepared = ep.teams.filter((team) => team.preparation).length;
  if (
    (['briefing', 'credits', 'icebreaker'].includes(ep.phase) && (ep.teams.length || ep.segments.length)) ||
    (ep.phase === 'team-draw' && ep.segments.length) ||
    (ep.phase === 'physical' && (counts('physical') < 1 || counts('interview') || prepared)) ||
    (ep.phase === 'interviews' && (counts('interview') < 1 || prepared)) ||
    (['improv-preparation', 'intervention'].includes(ep.phase) &&
      (prepared !== ep.teamCursor + 1 || counts('improv') !== ep.teamCursor)) ||
    (ep.phase === 'improv' && (prepared !== ep.teamCursor + 1 || counts('improv') !== ep.teamCursor + 1)) ||
    (progress >= phases.indexOf('panel') && (!actsComplete || prepared !== 3))
  )
    fail('phase/act chronology');
  // A forged phase cannot move past the work that belongs before it.
  if (progress >= phases.indexOf('physical') && ep.drawCursor !== 12) fail('physical before draw');
  if (
    progress >= phases.indexOf('interviews') &&
    ep.segments.filter((entry) => entry.kind === 'physical').length !== 3
  )
    fail('interview before physical');
  if (
    progress >= phases.indexOf('improv-preparation') &&
    ep.segments.filter((entry) => entry.kind === 'interview' && entry.teamScore !== null).length !== 3
  )
    fail('improv before answers');
}

export function validateVarietyShow(state: SimulationState): void {
  const runtime = state.runtime;
  if (!runtime?.varietyShow) return;
  if (
    runtime.version !== 3 ||
    runtime.episode !== 8 ||
    runtime.phase !== (runtime.varietyShow.phase === 'complete' ? 'episode-complete' : 'variety-show')
  )
    fail('runtime boundary');
  assertVarietyShowEpisode(runtime.varietyShow, state.contestants, runtime.definitions);
  const ep = runtime.varietyShow;
  same(runtime.randomState, replaySeededDraws(ep), 'persisted random state');
  const expectedShow = ep.fanTransfers.at(-1)?.after ?? ep.audienceAfter ?? ep.startingShow;
  same(runtime.show, expectedShow, 'live audience');
  same(ep.participantIds, runtime.versatility?.survivorIds, 'Episode 7 final survivor boundary');
  if (ep.audienceMood) same(ep.audienceMood, runtime.preparations?.[8]?.mood, 'frozen opening mood');
}
