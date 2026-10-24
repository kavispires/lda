import type { BattleCheck, BattleEpisode, BattleStoryStage } from '../types/battle-episode';
import type { Contestant } from '../types/contestant';
import type { SimulationDefinitions } from '../types/simulation';
import { validateBattleSongs } from '../utilities/battle-songs';
import { auditionGrade } from './audition-scoring';
import { addBattleJudging } from './battle-judging';
import { battleCheck, clampBattle } from './battle-scoring';

const stages: BattleStoryStage[] = [
  'dorms',
  'credits',
  'challenge',
  'captains',
  'draft',
  'pairings',
  'rehearsal',
  'leadership',
  'center',
  'intervention',
  'intervention-result',
  'performance',
  'opponent-reaction',
  'reviews',
  'winners',
  'twist',
  'judge-save',
  'audience-save',
  'production-save',
  'save-result',
  'departures',
  'mvp',
  'secret-choice',
  'secret-result',
  'ranking-rule',
  'ranking',
  'rank-reactions',
  'complete',
];
const phases = [
  'dorms',
  'ranking',
  'draft',
  'pairings',
  'preparation',
  'conflict',
  'performance',
  'broadcast',
  'audience',
  'saves',
  'results',
  'mvp',
  'secret',
  'complete',
];
const choices = ['support', 'mediate', 'push'];
const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid narrative Group Battles: ${message}.`);
}
function object(value: unknown, name: string): asserts value is Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
}
function array(value: unknown, name: string): asserts value is unknown[] {
  check(Array.isArray(value), `${name} must be an array`);
}
function text(value: unknown): asserts value is string {
  check(typeof value === 'string' && !!value.trim(), 'nonempty text required');
}
function number(
  value: unknown,
  min: number,
  max: number,
  name: string,
  integer = false,
): asserts value is number {
  check(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!integer || Number.isInteger(value)),
    `${name} outside ${min}..${max}`,
  );
}
function same(actual: unknown, expected: number, name: string): void {
  check(
    typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8,
    `${name} does not match its recorded inputs`,
  );
}
function ids(
  value: unknown,
  eligible: readonly string[],
  name: string,
  length?: number,
): asserts value is string[] {
  array(value, name);
  check(
    value.every((id) => typeof id === 'string' && eligible.includes(id)) &&
      new Set(value).size === value.length,
    `${name} has unknown or duplicate IDs`,
  );
  if (length !== undefined) check(value.length === length, `${name} requires ${length} IDs`);
}
function keys(
  value: unknown,
  expected: readonly string[],
  name: string,
): asserts value is Record<string, unknown> {
  object(value, name);
  check(
    Object.keys(value).length === expected.length &&
      Object.keys(value).every((key) => expected.includes(key)),
    `${name} has missing or unknown keys`,
  );
}
function dice(value: unknown): asserts value is [number, number] {
  array(value, 'dice');
  check(value.length === 2, 'exactly two dice required');
  value.forEach((face) => {
    number(face, 1, 6, 'die', true);
  });
}
function evidence(actual: unknown, expected: BattleCheck, name: string): void {
  object(actual, name);
  for (const key of ['skill', 'skillLevel', 'requiredLevel', 'floor', 'weight'] as const)
    check(actual[key] === expected[key], `${name} ${key} mismatch`);
  dice(actual.adjustedDice);
  check(
    actual.adjustedDice.every((face, i) => face === expected.adjustedDice[i]),
    `${name} adjusted dice mismatch`,
  );
  same(actual.score, expected.score, `${name} score`);
}
function normalized(skill: string, level: number, raw: [number, number]): BattleCheck {
  const result = battleCheck(skill, level, 3, raw);
  return { ...result, score: (result.score * 100) / 80 };
}

/** Validate the narrative chronology directly; legacy phase names are not a timeline. */
export function assertNarrativeBattleEpisode(
  value: unknown,
  contestants: Contestant[],
  definitions: SimulationDefinitions,
): asserts value is BattleEpisode {
  object(value, 'episode');
  const required = [
    'version',
    'story',
    'phase',
    'revision',
    'lastAction',
    'participantIds',
    'rankedIds',
    'finalRankedIds',
    'rooms',
    'roomCursor',
    'teams',
    'draftRound',
    'pairings',
    'teamCursor',
    'performances',
    'composure',
    'conflict',
    'conflictChoice',
    'scenes',
    'changes',
    'cuts',
    'selectedCutId',
    'audience',
    'judgeSaveId',
    'audienceSaveId',
    'productionShortlist',
    'productionSaveId',
    'survivorIds',
    'eliminatedIds',
    'revealedResults',
    'mvp',
    'secretCandidates',
    'secret',
  ];
  keys(value, required, 'episode');
  check(value.version === 2 && phases.includes(value.phase as string), 'unsupported version or phase');
  number(value.revision, 1, Number.MAX_SAFE_INTEGER, 'revision', true);
  keys(value.lastAction, ['revision', 'action'], 'last action');
  check(value.lastAction.revision === value.revision - 1, 'last action revision mismatch');
  object(value.lastAction.action, 'action');
  const action = value.lastAction.action;
  check(
    ['start', 'advance', 'conflict', 'production-save', 'secret'].includes(action.type as string),
    'unknown action',
  );
  keys(
    action,
    action.type === 'conflict'
      ? ['type', 'choice']
      : action.type === 'production-save' || action.type === 'secret'
        ? ['type', 'contestantId']
        : ['type'],
    'action',
  );
  check((value.revision === 1) === (action.type === 'start'), 'start revision mismatch');
  if (action.type === 'conflict') check(choices.includes(action.choice as string), 'unknown intervention');
  if (action.type === 'production-save' || action.type === 'secret') text(action.contestantId);
  const castIds = contestants.map((entry) => entry.id);
  check(new Set(castIds).size === castIds.length, 'duplicate cast IDs');
  ids(value.participantIds, castIds, 'participants', 30);
  const participants = value.participantIds;
  ids(value.rankedIds, participants, 'captain ranking', 30);
  ids(value.finalRankedIds, participants, 'continuing ranking');
  ids(value.survivorIds, participants, 'survivors');
  ids(value.eliminatedIds, participants, 'departures');
  ids(value.productionShortlist, participants, 'production shortlist');
  ids(value.secretCandidates, participants, 'secret candidates');
  const contestant = (id: string): Contestant => contestants.find((entry) => entry.id === id)!;
  object(value.story, 'story');
  const story = value.story;
  const storyKeys = [
    'stage',
    'sequence',
    'draftPick',
    'pairingCursor',
    'reviewCursor',
    'departureCursor',
    'interventions',
    'exposure',
    'creditedTeamIds',
    'matchupReactions',
    'rankReactions',
    'rankRevealed',
    'backlashApplied',
  ];
  keys(story, storyKeys, 'story');
  check(stages.includes(story.stage as BattleStoryStage), 'unknown story stage');
  const stage = story.stage as BattleStoryStage;
  const atLeast = (target: BattleStoryStage): boolean => stages.indexOf(stage) >= stages.indexOf(target);
  number(story.sequence, 1, 8, 'story sequence', true);
  const expectedSequence =
    stage === 'dorms'
      ? 1
      : stage === 'credits'
        ? 2
        : ['challenge', 'captains', 'draft', 'pairings'].includes(stage)
          ? 3
          : ['reviews', 'winners'].includes(stage)
            ? 7
            : atLeast('twist')
              ? 8
              : null;
  if (expectedSequence !== null) check(story.sequence === expectedSequence, 'stage/sequence mismatch');
  else number(story.sequence, 4, 6, 'battle sequence', true);
  number(story.draftPick, 0, 24, 'draft pick', true);
  number(story.pairingCursor, 0, 3, 'pairing cursor', true);
  number(story.reviewCursor, 0, 3, 'review cursor', true);
  number(story.departureCursor, 0, 3, 'departure cursor', true);
  number(value.roomCursor, 1, 5, 'room cursor', true);
  number(value.draftRound, 0, 4, 'draft round', true);
  number(value.teamCursor, 0, 6, 'team cursor', true);
  number(value.revealedResults, 0, 3, 'winner cursor', true);
  check(
    typeof story.rankRevealed === 'boolean' && typeof story.backlashApplied === 'boolean',
    'story flags required',
  );
  if (stage !== 'dorms') check(value.roomCursor === 5, 'all dorm arrivals must precede credits');
  if (!atLeast('draft')) check(story.draftPick === 0, 'draft picks before draft');
  if (atLeast('pairings')) check(story.draftPick === 24 && value.draftRound === 4, 'incomplete draft');
  if (!atLeast('reviews')) check(story.reviewCursor === 0, 'reviews before performances finish');
  if (atLeast('winners')) check(story.reviewCursor === 3, 'all reviews must precede winners');
  if (!atLeast('winners')) check(value.revealedResults === 0, 'winners revealed before all reviews');
  if (atLeast('twist')) check(value.revealedResults === 3, 'twist before winners');
  if (!atLeast('save-result'))
    check(story.departureCursor === 0 && !story.backlashApplied, 'premature departure effects');
  if (atLeast('mvp'))
    check(story.departureCursor === 3 && story.backlashApplied, 'MVP before final departures');
  check(story.rankRevealed === atLeast('ranking'), 'ranking reveal flag mismatches finale');
  if (atLeast('rank-reactions')) check(story.rankRevealed, 'reactions before ranking reveal');
  check((value.phase === 'complete') === (stage === 'complete'), 'completion phase mismatch');
  array(value.rooms, 'rooms');
  check(value.rooms.length === 5, 'five rooms required');
  const roomIds: string[] = [];
  const roomMembers: string[] = [];
  for (const room of value.rooms) {
    object(room, 'room');
    text(room.id);
    check(!roomIds.includes(room.id), 'duplicate room ID');
    roomIds.push(room.id);
    ids(room.memberIds, participants, 'room members', 6);
    roomMembers.push(...room.memberIds);
  }
  check(new Set(roomMembers).size === 30, 'rooms must partition the cast');
  validateBattleSongs(definitions.battleSongs, Object.keys(definitions.specialties.genreAffinity));
  const songs = definitions.battleSongs;
  array(value.teams, 'teams');
  array(value.pairings, 'pairings');
  array(value.performances, 'performances');
  const ep = value as unknown as BattleEpisode;
  const teamIds: string[] = [];
  const members: string[] = [];
  const songIds: string[] = [];
  check(ep.teams.length === 0 || ep.teams.length === 6, 'six captain teams required');
  if (atLeast('captains')) check(ep.teams.length === 6, 'captains must precede draft');
  if (!atLeast('captains')) check(ep.teams.length === 0, 'future captains');
  check(ep.draftRound === Math.floor(story.draftPick / 6), 'draft round/pick mismatch');
  object(story.interventions, 'interventions');
  for (const [index, team] of ep.teams.entries()) {
    object(team, 'team');
    text(team.id);
    text(team.name);
    check(!teamIds.includes(team.id), 'duplicate team ID');
    teamIds.push(team.id);
    check(team.captainId === ep.rankedIds[index], 'captain ranking mismatch');
    ids(team.memberIds, participants, 'team members');
    check(
      team.memberIds.length >= 1 && team.memberIds.length <= 5 && team.memberIds[0] === team.captainId,
      'captain must occupy first team slot',
    );
    if (stage === 'draft') {
      const completed = Math.floor(story.draftPick / 6) + (index < story.draftPick % 6 ? 1 : 0);
      check(team.memberIds.length === completed + 1, 'alternating draft roster mismatch');
    } else if (atLeast('pairings')) check(team.memberIds.length === 5, 'completed team needs five members');
    else check(team.memberIds.length === 1, 'teammates before draft picks');
    members.push(...team.memberIds);
    number(team.coordination, -5, 5, 'coordination');
    object(team.centerBallots, 'center ballots');
    object(team.partAssignments, 'parts');
    object(team.partReactions, 'part reactions');
    array(team.practice, 'practice');
    const song = songs.find((entry) => entry.id === team.songId);
    check(team.songId === null || !!song, 'unknown song');
    if (song) songIds.push(song.id);
    if (atLeast('rehearsal')) check(!!song, 'battle team missing song');
    check(team.practice.length === 0 || team.practice.length === 2, 'two practice sessions required');
    const hasParts = Object.keys(team.partAssignments).length > 0;
    if (hasParts) {
      check(!!song && team.memberIds.length === 5, 'parts before full team/song');
      keys(team.partAssignments, team.memberIds, 'parts');
      keys(team.partReactions, team.memberIds, 'part reactions');
      const assigned = Object.values(team.partAssignments);
      check(
        new Set(assigned).size === 5 && assigned.every((id) => song.parts.some((part) => part.id === id)),
        'parts must form a five-part bijection',
      );
      check(
        Object.values(team.partReactions).every((reaction) =>
          ['happy', 'neutral', 'unhappy'].includes(reaction),
        ),
        'unknown part reaction',
      );
    } else
      check(
        team.practice.length === 0 && Object.keys(team.partReactions).length === 0,
        'practice without assignments',
      );
    if (team.centerId !== null) {
      check(team.memberIds.includes(team.centerId), 'center outside team');
      keys(team.centerBallots, team.memberIds, 'center ballots');
      for (const [voter, choice] of Object.entries(team.centerBallots))
        check(voter !== choice && team.memberIds.includes(choice), 'center self-vote or ineligible choice');
      const count = (id: string) =>
        Object.values(team.centerBallots).filter((choice) => choice === id).length;
      const most = Math.max(...team.memberIds.map(count));
      const tied = team.memberIds
        .filter((id) => count(id) === most)
        .sort(
          (a, b) =>
            contestant(b).utilitySkills.charisma - contestant(a).utilitySkills.charisma ||
            sum(Object.values(contestant(b).coreSkills)) - sum(Object.values(contestant(a).coreSkills)),
        );
      const center = contestant(team.centerId);
      check(
        tied.includes(team.centerId) &&
          center.utilitySkills.charisma === contestant(tied[0]).utilitySkills.charisma &&
          sum(Object.values(center.coreSkills)) === sum(Object.values(contestant(tied[0]).coreSkills)),
        'center ballot or tie-break mismatch',
      );
    } else check(Object.keys(team.centerBallots).length === 0, 'ballots without a center');
    let coordination = 0;
    const lastPractice = new Map<string, number>();
    for (const [sessionIndex, session] of team.practice.entries()) {
      object(session, 'practice session');
      check(
        !!song &&
          session.session === sessionIndex + 1 &&
          session.title === (sessionIndex === 0 ? 'Part learning' : 'Full rehearsal'),
        'practice order mismatch',
      );
      dice(session.leaderDice);
      const leaderCheck = battleCheck(
        'leadership',
        contestant(team.captainId).coreSkills.leadership,
        song.difficulty,
        session.leaderDice,
      );
      evidence(session.leadershipCheck, leaderCheck, 'leadership');
      check(
        session.leadershipCheck.successThreshold === 8 &&
          session.leadershipSuccess === sum(leaderCheck.adjustedDice) >= 8,
        'leadership result mismatch',
      );
      check(
        session.coordinationBefore === coordination &&
          session.coordinationChange === (session.leadershipSuccess ? 1 : -1),
        'practice coordination mismatch',
      );
      coordination = clampBattle(coordination + session.coordinationChange, -5, 5);
      same(session.coordinationAfter, coordination, 'practice coordination');
      array(session.contestants, 'practice members');
      ids(
        session.contestants.map((entry) => entry.contestantId),
        team.memberIds,
        'practice roster',
        5,
      );
      for (const result of session.contestants) {
        object(result, 'practice result');
        dice(result.rawDice);
        number(result.practiceBefore, 0, 5, 'previous practice', true);
        number(result.practiceAfter, 1, 5, 'retained practice', true);
        if (sessionIndex > 0)
          check(
            result.practiceBefore === lastPractice.get(result.contestantId),
            'practice continuity mismatch',
          );
        const utilities =
          sessionIndex === 0
            ? (['learning', 'memory', 'consistency'] as const)
            : (['stamina', 'consistency', 'memory'] as const);
        array(result.checks, 'practice checks');
        check(result.checks.length === 3, 'three practice utilities required');
        let weighted = 0;
        result.checks.forEach((actual, i) => {
          object(actual, 'utility check');
          const expected = battleCheck(
            utilities[i],
            contestant(result.contestantId).utilitySkills[utilities[i]],
            song.difficulty,
            result.rawDice,
            i === 0 ? 2 : 1,
          );
          evidence({ ...actual, score: expected.score }, expected, 'practice utility');
          weighted += (sum(expected.adjustedDice) * expected.weight) / 4;
        });
        same(result.weightedSum, weighted, 'practice weighted sum');
        const practice = Math.min(5, Math.floor(weighted / 2));
        check(
          result.sessionPractice === practice &&
            result.practiceAfter === Math.max(result.practiceBefore, practice) &&
            result.improved === result.practiceAfter > result.practiceBefore,
          'practice outcome mismatch',
        );
        lastPractice.set(result.contestantId, result.practiceAfter);
      }
    }
    const intervention = story.interventions[team.id];
    if (intervention !== undefined) {
      check(
        choices.includes(intervention as string) && team.practice.length === 2,
        'invalid saved intervention',
      );
      coordination = clampBattle(
        coordination + (intervention === 'push' ? 3 : intervention === 'support' ? 2 : 1),
        -5,
        5,
      );
    }
    same(team.coordination, coordination, 'final coordination');
  }
  check(new Set(members).size === members.length, 'duplicate drafted member');
  check(new Set(songIds).size === songIds.length, 'duplicate team song');
  if (atLeast('pairings')) check(members.length === 30, 'incomplete cast draft');
  for (const id of Object.keys(story.interventions)) check(teamIds.includes(id), 'unknown intervention team');
  check(ep.pairings.length === 0 || ep.pairings.length === 3, 'three pairings required');
  if (atLeast('rehearsal'))
    check(ep.pairings.length === 3 && songIds.length === 6, 'battle schedule incomplete');
  if (!atLeast('pairings')) check(ep.pairings.length === 0, 'future pairings');
  const pairIds: string[] = [];
  const paired: string[] = [];
  for (const pair of ep.pairings) {
    object(pair, 'pairing');
    text(pair.id);
    check(!pairIds.includes(pair.id), 'duplicate pairing ID');
    pairIds.push(pair.id);
    ids(pair.teamIds, teamIds, 'paired teams', 2);
    paired.push(...pair.teamIds);
    check(pair.winnerId === null || pair.teamIds.includes(pair.winnerId), 'winner outside pairing');
    const pairSongs = pair.teamIds.map((id) =>
      songs.find((song) => song.id === ep.teams.find((team) => team.id === id)!.songId),
    );
    check(
      pairSongs.every(Boolean) && Math.abs(pairSongs[0]!.difficulty - pairSongs[1]!.difficulty) <= 1,
      'unfair song pairing',
    );
  }
  check(new Set(paired).size === paired.length, 'teams paired more than once');
  const order = ep.pairings.flatMap((pair) => pair.teamIds);
  if (stage === 'pairings') number(story.pairingCursor, 1, 3, 'announced pairings', true);
  else if (atLeast('rehearsal')) check(story.pairingCursor === 3, 'missing pairing announcements');
  else check(story.pairingCursor === 0, 'premature pairing announcements');
  check(ep.performances.length === ep.teamCursor, 'performance cursor mismatch');
  if (atLeast('reviews')) check(ep.performances.length === 6, 'reviews before all performances');
  if (!atLeast('rehearsal')) check(ep.performances.length === 0, 'future performances');
  if (!atLeast('reviews') && atLeast('rehearsal')) {
    const shownCursor = stage === 'performance' ? ep.teamCursor - 1 : ep.teamCursor;
    check(
      shownCursor >= 0 && shownCursor < 6 && story.sequence === 4 + Math.floor(shownCursor / 2),
      'battle sequence/cursor mismatch',
    );
    if (stage === 'opponent-reaction') check(ep.teamCursor % 2 === 1, 'reaction requires the second team');
  }
  const preparedCount = !atLeast('rehearsal')
    ? 0
    : atLeast('reviews')
      ? 6
      : ['performance', 'opponent-reaction'].includes(stage)
        ? Math.ceil(ep.teamCursor / 2) * 2
        : Math.floor(ep.teamCursor / 2) * 2 + 2;
  for (const [index, id] of order.entries())
    check(
      ep.teams.find((team) => team.id === id)!.practice.length === (index < preparedCount ? 2 : 0),
      'practice chronology mismatch',
    );
  const interventionTeams = [
    ...ep.performances.map((performance) => performance.teamId),
    ...(stage === 'intervention-result' ? [order[ep.teamCursor]] : []),
  ];
  keys(story.interventions, interventionTeams, 'saved interventions');
  object(value.composure, 'composure');
  for (const [id, adjustment] of Object.entries(value.composure)) {
    check(participants.includes(id), 'unknown composure contestant');
    number(adjustment, -1, 1, 'composure', true);
  }
  for (const [index, performance] of ep.performances.entries()) {
    object(performance, 'performance');
    check(performance.teamId === order[index], 'performance order mismatch');
    const team = ep.teams.find((entry) => entry.id === performance.teamId)!;
    const song = songs.find((entry) => entry.id === team.songId)!;
    check(
      team.practice.length === 2 && team.centerId !== null && Object.hasOwn(story.interventions, team.id),
      'performance before rehearsal/center/intervention',
    );
    array(performance.evaluations, 'evaluations');
    ids(
      performance.evaluations.map((entry) => entry.contestantId),
      team.memberIds,
      'performance roster',
      5,
    );
    check(performance.coordination === team.coordination, 'performance coordination mismatch');
    for (const evaluation of performance.evaluations) {
      object(evaluation, 'evaluation');
      const person = contestant(evaluation.contestantId);
      const part = song.parts.find((entry) => entry.id === evaluation.partId);
      check(!!part && team.partAssignments[person.id] === part.id, 'performed part mismatch');
      dice(evaluation.rawDice);
      number(evaluation.composure, -1, 1, 'performance composure', true);
      check(index % 2 !== 0 || evaluation.composure === 0, 'A team cannot react to a future performance');
      check(ep.composure[person.id] === 0, 'temporary composure not consumed');
      if (index % 2 !== 0) {
        const resilience = sum(team.memberIds.map((id) => contestant(id).personality.resilience)) / 5;
        const expected = ep.performances[index - 1].finalScore >= 70 && resilience < 0 ? -1 : 1;
        check(evaluation.composure === expected, 'rival composure mismatches delivered performance');
      }
      const centerBonus = person.id === team.centerId ? 1 : 0;
      check(evaluation.centerBonus === centerBonus, 'center bonus mismatch');
      array(evaluation.technicalChecks, 'technical checks');
      const practice = team.practice[1].contestants.find(
        (entry) => entry.contestantId === person.id,
      )!.practiceAfter;
      const technical = part.testedSkills.map((requirement, i) =>
        battleCheck(
          requirement.skill,
          person.coreSkills[requirement.skill],
          requirement.requiredLevel,
          evaluation.rawDice,
          i === 0 ? 2 : 1,
        ),
      );
      if (practice > 0)
        technical.push(
          battleCheck('practice', practice, part.testedSkills[0].requiredLevel, evaluation.rawDice),
        );
      check(evaluation.technicalChecks.length === technical.length, 'technical evidence count mismatch');
      technical.forEach((expected, i) => {
        evidence(evaluation.technicalChecks[i], expected, 'technical');
      });
      const technicalScore =
        sum(technical.map((entry) => entry.score * entry.weight)) /
        sum(technical.map((entry) => entry.weight));
      same(evaluation.technicalScore, technicalScore, 'technical total');
      evidence(
        evaluation.stageCheck,
        normalized(
          'stagePresence',
          clampBattle(person.coreSkills.stagePresence + evaluation.composure + centerBonus, 1, 5),
          evaluation.rawDice,
        ),
        'stage',
      );
      same(evaluation.stageScore, evaluation.stageCheck.score, 'stage score');
      array(evaluation.impressionChecks, 'impression checks');
      check(evaluation.impressionChecks.length === 4, 'four impression checks required');
      const impressions = [
        normalized('visual', person.coreSkills.visual, evaluation.rawDice),
        normalized('uniqueness', person.coreSkills.uniqueness, evaluation.rawDice),
        normalized('potential', person.utilitySkills.potential, evaluation.rawDice),
        normalized('charisma', person.utilitySkills.charisma, evaluation.rawDice),
      ];
      impressions.forEach((expected, i) => {
        evidence(evaluation.impressionChecks[i], expected, 'impression');
      });
      same(evaluation.impressionScore, sum(impressions.map((entry) => entry.score)) / 4, 'impression total');
      same(
        evaluation.finalScore,
        clampBattle(0.55 * technicalScore + 0.35 * evaluation.stageScore + 0.2 * evaluation.impressionScore),
        'individual total',
      );
      check(evaluation.grade === auditionGrade(evaluation.finalScore), 'individual grade mismatch');
      number(evaluation.tieBreakKey, 0, 1, 'tie key');
      check(evaluation.tieBreakKey < 1, 'tie key must be below one');
    }
    same(
      performance.meanScore,
      sum(performance.evaluations.map((entry) => entry.finalScore)) / 5,
      'team mean',
    );
    const base = clampBattle(performance.meanScore + team.coordination);
    same(performance.baseScore, base, 'base team score');
    const expected = addBattleJudging({ ...performance, baseScore: base }, contestants);
    keys(performance.judging, ['john', 'megan', 'michael'], 'judging');
    for (const judge of ['john', 'megan', 'michael'] as const) {
      const actual = performance.judging[judge];
      const computed = expected.judging![judge];
      object(actual, 'judge');
      number(actual.score, 0, 100, 'judge score');
      same(actual.score, computed.score, 'judge score');
      same(actual.bonus, computed.bonus, 'judge bonus');
      text(actual.comment);
      check(actual.comment === computed.comment, 'judge comment mismatches recorded delivery');
      array(actual.checks, 'judge evidence');
      check(actual.checks.length === computed.checks.length, 'judge evidence count mismatch');
      computed.checks.forEach((entry, i) => {
        evidence(actual.checks[i], entry, 'judge evidence');
      });
    }
    same(performance.finalScore, expected.finalScore, 'final team score');
  }
  ids(story.creditedTeamIds, teamIds, 'credited teams', ep.performances.length);
  check(
    ep.performances.every((entry) => (story.creditedTeamIds as string[]).includes(entry.teamId)),
    'credit/performance mismatch',
  );
  object(story.exposure, 'exposure');
  const exposure = story.exposure;
  const exposed = ep.performances.flatMap(
    (performance) => ep.teams.find((team) => team.id === performance.teamId)!.memberIds,
  );
  for (const [id, exposure] of Object.entries(story.exposure)) {
    check(participants.includes(id), 'unknown exposure contestant');
    same(exposure, exposed.includes(id) ? 1 / 30 : 0, 'equal performance exposure');
  }
  check(
    exposed.every((id) => Object.hasOwn(exposure, id)),
    'credited performance missing exposure',
  );
  same(sum(Object.values(story.exposure) as number[]), ep.performances.length / 6, 'exposure total');
  array(value.cuts, 'cuts');
  check(
    value.cuts.length === 0 && value.selectedCutId === null,
    'narrative battles cannot contain broadcast cuts',
  );
  object(value.changes, 'changes');
  for (const [id, changes] of Object.entries(value.changes)) {
    check(participants.includes(id), 'unknown change contestant');
    array(changes, 'changes');
    for (const change of changes) {
      object(change, 'change');
      text(change.path);
      text(change.cause);
      check('before' in change || 'after' in change, 'change requires values');
    }
  }
  array(value.scenes, 'scenes');
  check(value.scenes.length > 0, 'story scenes required');
  const sceneIds = new Set<string>();
  const kinds = [
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
  ];
  let sequence = 1;
  for (const scene of value.scenes) {
    object(scene, 'scene');
    text(scene.id);
    text(scene.title);
    check(!sceneIds.has(scene.id), 'duplicate scene ID');
    sceneIds.add(scene.id);
    check(
      kinds.includes(scene.kind as string) && !['broadcast', 'audience'].includes(scene.kind as string),
      'unknown or removed scene kind',
    );
    array(scene.paragraphs, 'scene paragraphs');
    scene.paragraphs.forEach(text);
    ids(scene.contestantIds, participants, 'scene contestants');
    number(scene.sequence, 1, 8, 'scene sequence', true);
    check(
      scene.sequence >= sequence && scene.sequence <= story.sequence,
      'scene sequence progression mismatch',
    );
    sequence = scene.sequence;
    if (scene.paragraphContestantIds !== undefined) {
      array(scene.paragraphContestantIds, 'paragraph identities');
      check(
        scene.paragraphContestantIds.length === scene.paragraphs.length,
        'paragraph identity alignment mismatch',
      );
      for (const mentions of scene.paragraphContestantIds) {
        array(mentions, 'paragraph mentions');
        check(
          mentions.every((id) => typeof id === 'string' && participants.includes(id)),
          'paragraph mentions has unknown IDs',
        );
      }
    }
    if (scene.speaker !== undefined) {
      object(scene.speaker, 'speaker');
      text(scene.speaker.name);
      text(scene.speaker.role);
    }
    if (scene.presentation !== undefined)
      check(
        ['host', 'credits', 'judges', 'introduction', 'performance', 'montage', 'results'].includes(
          scene.presentation as string,
        ),
        'unknown scene presentation',
      );
    if (scene.dialogues !== undefined) {
      array(scene.dialogues, 'dialogues');
      for (const dialogue of scene.dialogues) {
        object(dialogue, 'dialogue');
        text(dialogue.name);
        text(dialogue.role);
        array(dialogue.paragraphs, 'dialogue paragraphs');
        check(dialogue.paragraphs.length > 0, 'empty dialogue');
        dialogue.paragraphs.forEach(text);
        if (dialogue.paragraphContestantIds !== undefined) {
          array(dialogue.paragraphContestantIds, 'dialogue paragraph identities');
          check(
            dialogue.paragraphContestantIds.length === dialogue.paragraphs.length,
            'dialogue paragraph identity alignment mismatch',
          );
          for (const mentions of dialogue.paragraphContestantIds) {
            array(mentions, 'dialogue paragraph mentions');
            check(
              mentions.every((id) => typeof id === 'string' && participants.includes(id)),
              'dialogue paragraph mentions has unknown IDs',
            );
          }
        }
      }
    }
    if (scene.introductions !== undefined) {
      object(scene.introductions, 'introductions');
      for (const [id, paragraphs] of Object.entries(scene.introductions)) {
        check(participants.includes(id), 'unknown introduction contestant');
        array(paragraphs, 'introduction');
        paragraphs.forEach(text);
      }
    }
  }
  check(sequence === story.sequence, 'latest scene sequence mismatch');
  check(
    ep.scenes.filter((scene) => scene.kind === 'dorms').length === ep.roomCursor,
    'dorm arrival count mismatch',
  );
  if (value.conflict !== null) {
    object(value.conflict, 'conflict');
    const team = ep.teams.find((entry) => entry.id === ep.conflict!.teamId);
    check(!!team, 'unknown conflict team');
    ids(value.conflict.contestantIds, team.memberIds, 'conflict participants');
    text(value.conflict.description);
  }
  check(
    value.conflictChoice === null || choices.includes(value.conflictChoice as string),
    'unknown conflict choice',
  );
  if (action.type === 'conflict')
    check(
      stage === 'intervention-result' &&
        ep.conflictChoice === action.choice &&
        ep.conflict !== null &&
        story.interventions[ep.conflict.teamId] === action.choice,
      'saved intervention/action mismatch',
    );
  if (stage === 'intervention')
    check(ep.conflict !== null && ep.conflictChoice === null, 'intervention must be blocking');
  if (ep.audience !== null) {
    object(value.audience, 'audience');
    check(
      ep.performances.length === 6 && ep.finalRankedIds.length === 30,
      'audience before complete performances/ranking',
    );
    for (const key of ['votes', 'newFans', 'receptions']) {
      keys(value.audience[key], participants, key);
      for (const count of Object.values(value.audience[key]))
        number(count, 0, key === 'receptions' ? 100 : Number.MAX_SAFE_INTEGER, key, key !== 'receptions');
    }
    for (const key of ['votingPopulation', 'newViewers'])
      number(value.audience[key], 0, Number.MAX_SAFE_INTEGER, key, true);
    for (const key of ['satisfactionBefore', 'satisfactionAfter', 'attention', 'enjoyment'])
      number(value.audience[key], 0, 100, key);
    check(
      sum(Object.values(ep.audience.votes)) === ep.audience.votingPopulation,
      'votes do not conserve population',
    );
    check(
      participants.every((id) => ep.audience!.newFans[id] <= ep.audience!.votes[id]),
      'new fans exceed votes',
    );
  } else check(ep.finalRankedIds.length === 0 && !atLeast('reviews'), 'missing audience outcome');
  const evaluations = new Map(
    ep.performances.flatMap((entry) => entry.evaluations).map((entry) => [entry.contestantId, entry]),
  );
  const performanceOrder = (a: string, b: string): number =>
    evaluations.get(b)!.finalScore - evaluations.get(a)!.finalScore ||
    evaluations.get(b)!.technicalScore - evaluations.get(a)!.technicalScore ||
    evaluations.get(a)!.tieBreakKey - evaluations.get(b)!.tieBreakKey ||
    a.localeCompare(b);
  if (ep.audience !== null) {
    const expectedRanking = [...participants].sort(
      (a, b) =>
        contestant(b).aggregations.score - contestant(a).aggregations.score ||
        evaluations.get(b)!.finalScore - evaluations.get(a)!.finalScore ||
        evaluations.get(b)!.technicalScore - evaluations.get(a)!.technicalScore ||
        evaluations.get(b)!.stageScore - evaluations.get(a)!.stageScore ||
        evaluations.get(a)!.tieBreakKey - evaluations.get(b)!.tieBreakKey,
    );
    check(
      JSON.stringify(ep.finalRankedIds) === JSON.stringify(expectedRanking),
      'continuing ranking mismatches cumulative scores',
    );
  }
  const atRisk: string[] = [];
  const winners: string[] = [];
  for (const [index, pair] of ep.pairings.entries()) {
    if (pair.winnerId === null) {
      check(index >= ep.revealedResults, 'announced winner missing');
      continue;
    }
    check(index < ep.revealedResults, 'future winner before its announcement');
    check(ep.performances.length === 6 && atLeast('winners'), 'premature winner');
    const performances = pair.teamIds.map((id) => ep.performances.find((entry) => entry.teamId === id)!);
    const expected = [...performances].sort(
      (a, b) =>
        b.finalScore - a.finalScore ||
        sum(b.evaluations.map((entry) => entry.technicalScore)) -
          sum(a.evaluations.map((entry) => entry.technicalScore)) ||
        a.evaluations[0].tieBreakKey - b.evaluations[0].tieBreakKey ||
        a.teamId.localeCompare(b.teamId),
    )[0].teamId;
    check(pair.winnerId === expected, 'winner mismatches recorded performance');
    winners.push(...ep.teams.find((team) => team.id === pair.winnerId)!.memberIds);
    atRisk.push(
      ...ep.teams.find((team) => pair.teamIds.includes(team.id) && team.id !== pair.winnerId)!.memberIds,
    );
  }
  const saves = [ep.judgeSaveId, ep.audienceSaveId, ep.productionSaveId].filter(
    (id): id is string => id !== null,
  );
  ids(saves, atRisk, 'saves');
  if (ep.judgeSaveId !== null) {
    check(
      atLeast('judge-save') &&
        ep.revealedResults === 3 &&
        ep.judgeSaveId === [...atRisk].sort(performanceOrder)[0],
      'judge save mismatch or premature reveal',
    );
  } else check(!atLeast('audience-save'), 'missing judge save');
  if (ep.audienceSaveId !== null) {
    check(
      atLeast('audience-save') && ep.judgeSaveId !== null && ep.audience !== null,
      'premature audience save',
    );
    check(
      ep.audienceSaveId ===
        atRisk
          .filter((id) => id !== ep.judgeSaveId)
          .sort((a, b) => ep.audience!.votes[b] - ep.audience!.votes[a] || performanceOrder(a, b))[0],
      'audience save mismatch',
    );
  } else check(!atLeast('production-save'), 'missing audience save');
  if (ep.productionShortlist.length) {
    check(atLeast('production-save') && ep.audienceSaveId !== null, 'premature shortlist');
    ids(
      ep.productionShortlist,
      atRisk.filter((id) => id !== ep.judgeSaveId && id !== ep.audienceSaveId),
      'production shortlist',
      3,
    );
  }
  if (atLeast('production-save')) check(ep.productionShortlist.length === 3, 'missing production shortlist');
  if (ep.productionSaveId !== null)
    check(
      atLeast('save-result') && ep.productionShortlist.includes(ep.productionSaveId),
      'invalid production save',
    );
  else check(!atLeast('save-result'), 'missing production save');
  if (action.type === 'production-save')
    check(stage === 'save-result' && ep.productionSaveId === action.contestantId, 'save action mismatch');
  const locked = ep.survivorIds.length > 0 || ep.eliminatedIds.length > 0;
  if (locked) {
    check(
      atLeast('save-result') &&
        saves.length === 3 &&
        ep.survivorIds.length === 18 &&
        ep.eliminatedIds.length === 12 &&
        new Set([...ep.survivorIds, ...ep.eliminatedIds]).size === 30,
      'invalid eighteen/twelve final partition',
    );
    check(
      [...winners, ...saves].every((id) => ep.survivorIds.includes(id)),
      'winning teams and saves must survive',
    );
    check(
      JSON.stringify(ep.survivorIds) ===
        JSON.stringify(ep.finalRankedIds.filter((id) => !ep.eliminatedIds.includes(id))),
      'survivors must retain the locked continuing order',
    );
    if (story.rankRevealed)
      ep.survivorIds.forEach((id, index) => {
        check(contestant(id).rank === index + 1, 'revealed survivor ranks must be contiguous');
      });
  } else check(!atLeast('departures'), 'missing final partition');
  const departed = ep.scenes.filter((scene) => scene.kind === 'eliminations');
  check(departed.length === story.departureCursor, 'departure cursor/scene mismatch');
  for (const [index, scene] of departed.entries()) {
    const pair = ep.pairings[index];
    check(!!pair && pair.winnerId !== null, 'departure without result');
    const expected = ep.teams.find(
      (team) => pair.teamIds.includes(team.id) && team.id !== pair.winnerId,
    )!.memberIds;
    check(JSON.stringify(scene.contestantIds) === JSON.stringify(expected), 'departure group mismatch');
  }
  const departedIds = new Set(
    departed.flatMap((scene) => scene.contestantIds.filter((id) => ep.eliminatedIds.includes(id))),
  );
  check(
    story.backlashApplied === (story.departureCursor === 3),
    'backlash must follow the third departure group',
  );
  for (const id of participants)
    check(
      contestant(id).status === (departedIds.has(id) ? 'ELIMINATED' : 'ACTIVE'),
      'status precedes departure reveal',
    );
  if (ep.mvp !== null) {
    check(atLeast('mvp') && locked && story.departureCursor === 3, 'premature MVP');
    object(value.mvp, 'MVP');
    keys(ep.mvp.ballots, ep.survivorIds, 'MVP ballots');
    keys(ep.mvp.totals, ep.survivorIds, 'MVP totals');
    for (const [id, choice] of Object.entries(ep.mvp.ballots))
      check(id !== choice && ep.survivorIds.includes(choice), 'MVP ineligible vote');
    for (const id of ep.survivorIds)
      check(
        ep.mvp.totals[id] === Object.values(ep.mvp.ballots).filter((choice) => choice === id).length,
        'MVP ballot total mismatch',
      );
    const highest = Math.max(...Object.values(ep.mvp.totals));
    const tied = ep.survivorIds.filter((id) => ep.mvp!.totals[id] === highest);
    ids(ep.mvp.tiedIds, tied, 'MVP ties', tied.length);
    check(tied.includes(ep.mvp.winnerId), 'MVP winner mismatch');
  } else check(!atLeast('secret-choice'), 'missing MVP');
  check(ep.secretCandidates.length <= 3, 'secret shortlist exceeds three');
  if (ep.secretCandidates.length) check(ep.mvp !== null, 'secret candidates before MVP');
  if (stage === 'secret-choice')
    check(ep.secretCandidates.length > 0 && ep.secret === null, 'invalid pending secret choice');
  if (ep.secret !== null) {
    object(value.secret, 'secret');
    check(
      atLeast('secret-result') && ep.secretCandidates.includes(ep.secret.contestantId),
      'invalid secret choice',
    );
    text(ep.secret.title);
    text(ep.secret.description);
    check(
      ep.secret.cardId === null || Object.hasOwn(definitions.cards.secret, ep.secret.cardId),
      'unknown secret card',
    );
    array(ep.secret.deferred, 'deferred consequences');
    for (const consequence of ep.secret.deferred) {
      object(consequence, 'deferred consequence');
      check(
        consequence.contestantId === ep.secret.contestantId &&
          ['status', 'aggregations.score'].includes(consequence.path),
        'invalid deferred consequence',
      );
      text(consequence.cause);
    }
  }
  if (atLeast('ranking-rule'))
    check(ep.secret !== null || ep.secretCandidates.length === 0, 'unresolved secret');
  if (action.type === 'secret')
    check(
      stage === 'secret-result' && ep.secret?.contestantId === action.contestantId,
      'secret action mismatch',
    );
  for (const [name, reactions] of [
    ['matchup', story.matchupReactions],
    ['rank', story.rankReactions],
  ] as const) {
    array(reactions, `${name} reactions`);
    const seen = new Set<string>();
    for (const reaction of reactions) {
      object(reaction, 'reaction');
      check(
        participants.includes(reaction.observerId as string) && !seen.has(reaction.observerId as string),
        'unknown or repeated reaction observer',
      );
      seen.add(reaction.observerId as string);
      check(
        reaction.targetId === null ||
          (participants.includes(reaction.targetId as string) && reaction.observerId !== reaction.targetId),
        'invalid reaction target',
      );
      number(reaction.before, 0, 100, 'reaction before');
      number(reaction.after, 0, 100, 'reaction after');
      text(reaction.emotion);
      if (name === 'rank') {
        check(story.rankRevealed && atLeast('rank-reactions'), 'rank reaction before reveal');
        const ranked = ep.finalRankedIds.filter((id) => ep.survivorIds.includes(id));
        const index = ranked.indexOf(reaction.observerId as string);
        check(
          index >= 0 && reaction.targetId === (index === 0 ? null : ranked[index - 1]),
          'rank reaction target must be immediately higher',
        );
        check(
          Math.abs(reaction.after - reaction.before) <= 2 &&
            (index !== 0 || reaction.after === reaction.before),
          'rank reaction outside bounded change',
        );
        const person = contestant(reaction.observerId as string);
        const { gentleness, maturity, sensitivity, ambition } = person.personality;
        const disposition = (reaction.before - 50) / 5 + gentleness + maturity - sensitivity - ambition;
        const delta = index === 0 ? 0 : clampBattle(Math.round(disposition / 10), -2, 2);
        same(reaction.after, clampBattle(reaction.before + delta), 'placement relationship change');
        if (index === 0) same(reaction.before, 50, 'first-place neutral relationship baseline');
        else
          same(
            person.relationships[reaction.targetId as string]?.at(-1) ?? 50,
            reaction.after,
            'retained placement relationship',
          );
      } else {
        check(atLeast('pairings') && reaction.targetId !== null, 'premature matchup reaction');
        const own = ep.teams.find((team) => team.memberIds.includes(reaction.observerId as string));
        const pair = ep.pairings.find((entry) => entry.teamIds.includes(own!.id));
        const opponent = ep.teams.find((team) => pair?.teamIds.includes(team.id) && team.id !== own!.id);
        check(
          !!opponent?.memberIds.includes(reaction.targetId as string),
          'matchup target must be opposing team',
        );
        const delta =
          reaction.before < 40 || contestant(reaction.observerId as string).personality.ambition > 4 ? -2 : 1;
        same(reaction.after, clampBattle(reaction.before + delta), 'matchup relationship change');
      }
    }
    if (name === 'rank' && reactions.length)
      check(reactions.length === 18, 'all eighteen need rank reactions');
    if (name === 'rank' && stage === 'complete')
      check(reactions.length === 18, 'missing final rank reactions');
    if (name === 'matchup' && atLeast('rehearsal'))
      check(reactions.length === 30, 'all thirty need matchup reactions');
    if (name === 'matchup' && stage === 'pairings')
      check(reactions.length === story.pairingCursor * 10, 'pairing reaction count mismatch');
  }
  if (stage === 'complete')
    check(story.rankRevealed && ep.scenes.at(-1)?.kind === 'recap', 'missing final recap/ranking');
  for (const id of participants) {
    const logs = contestant(id).changeLog.filter((entry) => entry.episode === 2);
    if (stage === 'complete')
      check(
        logs.length === 1 &&
          logs[0].phaseId === 'episode-2' &&
          logs[0].status === contestant(id).status &&
          logs[0].score === evaluations.get(id)!.finalScore &&
          JSON.stringify(logs[0].changes) === JSON.stringify(ep.changes[id] ?? []),
        'episode history mismatch',
      );
    else check(logs.length === 0, 'completed history in intermediate story');
  }
}
