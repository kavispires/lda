import type { BattleEpisode } from '../types/battle-episode';
import type { Contestant } from '../types/contestant';
import type { SimulationDefinitions } from '../types/simulation';
import { validateBattleSongs } from '../utilities/battle-songs';
import { auditionGrade, auditionMinimumFace } from './audition-scoring';
import { clampBattle } from './battle-scoring';

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
const fail = (message: string): never => {
  throw new Error(`Invalid Group Battles: ${message}.`);
};
function check(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
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
  if (length !== undefined) check(value.length === length, `${name} must contain ${length} IDs`);
}
function exactKeys(
  value: unknown,
  keys: readonly string[],
  name: string,
): asserts value is Record<string, unknown> {
  object(value, name);
  check(
    Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key)),
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
function same(a: number, b: number, name: string): void {
  check(Math.abs(a - b) < 1e-8, `${name} does not match its recorded inputs`);
}
function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Reject malformed and semantically impossible intermediate saves, not just completed episodes. */
export function assertBattleEpisode(
  value: unknown,
  contestants: Contestant[],
  definitions: SimulationDefinitions,
): asserts value is BattleEpisode {
  object(value, 'episode');
  const required = [
    'version',
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
  check(
    required.every((key) => Object.hasOwn(value, key)),
    'episode fields are missing',
  );
  check(
    value.version === 1 && typeof value.phase === 'string' && phases.includes(value.phase),
    'unsupported version or phase',
  );
  number(value.revision, 1, Number.MAX_SAFE_INTEGER, 'revision', true);
  object(value.lastAction, 'lastAction');
  number(value.lastAction.revision, 0, value.revision - 1, 'last action revision', true);
  check(
    value.lastAction.revision === value.revision - 1,
    'last action revision must precede current revision',
  );
  object(value.lastAction.action, 'last action');
  const action = value.lastAction.action;
  const actionKeys =
    action.type === 'conflict'
      ? ['type', 'choice']
      : action.type === 'broadcast'
        ? ['type', 'cutId']
        : action.type === 'production-save' || action.type === 'secret'
          ? ['type', 'contestantId']
          : ['type'];
  exactKeys(action, actionKeys, 'last action');
  check(
    ['start', 'advance', 'conflict', 'broadcast', 'production-save', 'secret'].includes(
      action.type as string,
    ),
    'unknown last action',
  );
  if (action.type === 'conflict')
    check(['support', 'mediate', 'push'].includes(action.choice as string), 'unknown conflict choice');
  if (action.type === 'broadcast')
    check(['music', 'personalities', 'backstage'].includes(action.cutId as string), 'unknown cut choice');
  if (action.type === 'production-save' || action.type === 'secret') text(action.contestantId);
  check((value.revision === 1) === (action.type === 'start'), 'start action/revision mismatch');

  const castIds = contestants.map((contestant) => contestant.id);
  check(new Set(castIds).size === castIds.length, 'duplicate cast IDs');
  ids(value.participantIds, castIds, 'participant roster', 30);
  const participantIds = value.participantIds;
  ids(value.rankedIds, participantIds, 'opening ranking', 30);
  ids(value.finalRankedIds, participantIds, 'continuing ranking');
  ids(value.productionShortlist, participantIds, 'production shortlist');
  validateBattleSongs(definitions.battleSongs, Object.keys(definitions.specialties.genreAffinity));
  const songs = definitions.battleSongs;
  array(value.rooms, 'rooms');
  check(value.rooms.length === 5, 'five rooms required');
  const roomIds: string[] = [];
  const roomMembers: string[] = [];
  for (const room of value.rooms) {
    object(room, 'room');
    text(room.id);
    check(!roomIds.includes(room.id), 'duplicate room ID');
    roomIds.push(room.id);
    ids(room.memberIds, participantIds, 'room members', 6);
    roomMembers.push(...room.memberIds);
  }
  check(new Set(roomMembers).size === 30, 'rooms must partition the thirty participants');
  number(value.roomCursor, 0, 5, 'room cursor', true);
  if (value.phase !== 'dorms') check(value.roomCursor === 5, 'ranking cannot precede five room highlights');
  number(value.draftRound, 0, 4, 'draft round', true);
  number(value.teamCursor, 0, 6, 'team cursor', true);
  number(value.revealedResults, 0, 3, 'winner reveal cursor', true);
  array(value.teams, 'teams');
  array(value.pairings, 'pairings');
  array(value.performances, 'performances');
  array(value.scenes, 'scenes');
  array(value.cuts, 'cuts');
  object(value.composure, 'composure');
  object(value.changes, 'changes');
  for (const [id, composure] of Object.entries(value.composure)) {
    check(participantIds.includes(id), 'unknown composure contestant');
    number(composure, -1, 1, 'composure', true);
  }
  for (const [id, changes] of Object.entries(value.changes)) {
    check(participantIds.includes(id), 'unknown change-history contestant');
    array(changes, 'contestant changes');
    for (const change of changes) {
      object(change, 'property change');
      text(change.path);
      text(change.cause);
      check('before' in change || 'after' in change, 'property change requires values');
    }
  }
  const sceneIds = new Set<string>();
  const sceneKinds = [
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
  for (const scene of value.scenes) {
    object(scene, 'scene');
    text(scene.id);
    text(scene.title);
    check(!sceneIds.has(scene.id), 'duplicate scene ID');
    sceneIds.add(scene.id);
    check(sceneKinds.includes(scene.kind as string), 'unknown scene kind');
    array(scene.paragraphs, 'scene paragraphs');
    scene.paragraphs.forEach(text);
    ids(scene.contestantIds, participantIds, 'scene contestants');
    if (scene.paragraphContestantIds !== undefined) {
      array(scene.paragraphContestantIds, 'paragraph contestants');
      check(
        scene.paragraphContestantIds.length === scene.paragraphs.length,
        'paragraph identities must align with their text',
      );
      for (const mentions of scene.paragraphContestantIds) {
        array(mentions, 'paragraph mentions');
        check(
          mentions.every((id) => typeof id === 'string' && participantIds.includes(id)),
          'unknown paragraph contestant',
        );
      }
    }
  }
  check(
    value.scenes.length > 0 && (value.scenes[0] as Record<string, unknown>).kind === 'opening',
    'opening scene required',
  );
  const ep = value as unknown as BattleEpisode;
  check(
    ep.scenes.filter((scene) => scene.kind === 'dorms').length === ep.roomCursor,
    'room highlight count mismatches cursor',
  );
  check(
    ep.scenes.filter((scene) => scene.kind === 'ranking').length === (ep.phase === 'dorms' ? 0 : 1),
    'ranking scene timing invalid',
  );
  const early = ep.phase === 'dorms' || ep.phase === 'ranking';
  if (early) check(ep.teams.length === 0 && ep.draftRound === 0, 'teams cannot exist before draft');
  else check(ep.teams.length === 6, 'six teams required after captain selection');
  if (!early && ep.phase !== 'draft') check(ep.draftRound === 4, 'all four draft rounds required');
  const teamIds: string[] = [];
  const allMembers: string[] = [];
  const assignedSongs: string[] = [];
  for (const [index, rawTeam] of value.teams.entries()) {
    object(rawTeam, 'team');
    text(rawTeam.id);
    text(rawTeam.name);
    check(!teamIds.includes(rawTeam.id), 'duplicate team ID');
    teamIds.push(rawTeam.id);
    check(rawTeam.captainId === ep.rankedIds[index], 'captains must be the top six in ranking order');
    ids(rawTeam.memberIds, participantIds, 'team roster', 1 + ep.draftRound);
    check(rawTeam.memberIds[0] === rawTeam.captainId, 'captain must occupy first team slot');
    allMembers.push(...rawTeam.memberIds);
    number(rawTeam.coordination, -5, 5, 'coordination');
    object(rawTeam.centerBallots, 'center ballots');
    object(rawTeam.partAssignments, 'part assignments');
    object(rawTeam.partReactions, 'part reactions');
    array(rawTeam.practice, 'practice sessions');
    const song = songs.find((entry) => entry.id === rawTeam.songId);
    if (ep.phase === 'draft')
      check(
        rawTeam.songId === null && rawTeam.practice.length === 0,
        'draft cannot contain songs or practice',
      );
    else {
      check(!!song, 'team needs a valid song');
      assignedSongs.push(song.id);
    }
    const prepared = rawTeam.practice.length > 0;
    if (!prepared) {
      check(
        rawTeam.centerId === null &&
          Object.keys(rawTeam.centerBallots).length === 0 &&
          Object.keys(rawTeam.partAssignments).length === 0 &&
          Object.keys(rawTeam.partReactions).length === 0 &&
          rawTeam.coordination === 0,
        'unprepared team has future roles or coordination',
      );
    } else {
      check(rawTeam.practice.length === 2 && !!song, 'exactly two practice sessions per prepared team');
      check(rawTeam.memberIds.includes(rawTeam.centerId as string), 'center must belong to team');
      exactKeys(rawTeam.centerBallots, rawTeam.memberIds, 'center ballots');
      for (const [voterId, choice] of Object.entries(rawTeam.centerBallots))
        check(
          voterId !== choice && rawTeam.memberIds.includes(choice as string),
          'center ballots cannot be self-votes or leave the team',
        );
      const ballots = rawTeam.centerBallots;
      const count = (id: unknown) => Object.values(ballots).filter((choice) => choice === id).length;
      check(
        count(rawTeam.centerId) === Math.max(...rawTeam.memberIds.map(count)),
        'center must win the ballot',
      );
      exactKeys(rawTeam.partAssignments, rawTeam.memberIds, 'part assignments');
      exactKeys(rawTeam.partReactions, rawTeam.memberIds, 'part reactions');
      check(
        Object.values(rawTeam.partReactions).every((reaction) =>
          ['happy', 'neutral', 'unhappy'].includes(reaction as string),
        ),
        'part reactions must preserve an assignment satisfaction label for every member',
      );
      const partIds = Object.values(rawTeam.partAssignments);
      check(
        new Set(partIds).size === 5 && partIds.every((id) => song.parts.some((part) => part.id === id)),
        'parts must form a five-part bijection',
      );
      let coordination = 0;
      const lastPractice = new Map<string, number>();
      for (const [sessionIndex, rawSession] of rawTeam.practice.entries()) {
        object(rawSession, 'practice session');
        check(
          rawSession.session === sessionIndex + 1 &&
            rawSession.title === (sessionIndex === 0 ? 'Part learning' : 'Full rehearsal'),
          'practice sessions must be fixed and ordered',
        );
        dice(rawSession.leaderDice);
        const leaderDice = rawSession.leaderDice;
        check(typeof rawSession.leadershipSuccess === 'boolean', 'leadership result required');
        number(rawSession.coordinationChange, -1, 1, 'session coordination', true);
        check(
          rawSession.coordinationChange === (rawSession.leadershipSuccess ? 1 : -1),
          'leadership coordination mismatch',
        );
        check(rawSession.coordinationBefore === coordination, 'practice coordination continuity mismatch');
        coordination = clampBattle(coordination + rawSession.coordinationChange, -5, 5);
        check(rawSession.coordinationAfter === coordination, 'practice coordination outcome mismatch');
        object(rawSession.leadershipCheck, 'leadership check');
        const lead = rawSession.leadershipCheck;
        check(
          lead.skill === 'leadership' && lead.requiredLevel === song.difficulty,
          'leadership requirement mismatch',
        );
        number(lead.skillLevel, 1, 5, 'leadership level', true);
        dice(lead.adjustedDice);
        const leadFloor = auditionMinimumFace(lead.skillLevel, song.difficulty);
        check(
          lead.floor === leadFloor &&
            lead.adjustedDice.every((face, i) => face === Math.max(leaderDice[i], leadFloor)),
          'invalid leadership adjusted dice',
        );
        check(
          lead.successThreshold === 8 &&
            rawSession.leadershipSuccess === sum(lead.adjustedDice) >= lead.successThreshold,
          'leadership success mismatches recorded threshold',
        );
        same(
          lead.score as number,
          ((50 + 10 * song.difficulty) * (sum(lead.adjustedDice) - 2)) / 10,
          'leadership score',
        );
        array(rawSession.contestants, 'practice participants');
        check(rawSession.contestants.length === 5, 'practice needs every team member');
        const seen = new Set<string>();
        for (const rawPractice of rawSession.contestants) {
          object(rawPractice, 'practice result');
          text(rawPractice.contestantId);
          check(
            rawTeam.memberIds.includes(rawPractice.contestantId) && !seen.has(rawPractice.contestantId),
            'practice roster mismatch',
          );
          seen.add(rawPractice.contestantId);
          dice(rawPractice.rawDice);
          const practiceDice = rawPractice.rawDice;
          number(rawPractice.practiceBefore, 0, 5, 'previous practice', true);
          number(rawPractice.practiceAfter, 1, 5, 'retained practice', true);
          check(
            rawPractice.practiceBefore === (lastPractice.get(rawPractice.contestantId) ?? 0),
            'practice continuity mismatch',
          );
          array(rawPractice.checks, 'utility checks');
          const utilities =
            sessionIndex === 0 ? ['learning', 'memory', 'consistency'] : ['stamina', 'consistency', 'memory'];
          check(rawPractice.checks.length === 3, 'practice requires the three fixed utilities');
          const utilitySums: number[] = [];
          for (const [checkIndex, rawCheck] of rawPractice.checks.entries()) {
            object(rawCheck, 'utility check');
            check(
              rawCheck.skill === utilities[checkIndex] && rawCheck.requiredLevel === song.difficulty,
              'unknown practice skill or requirement',
            );
            check(rawCheck.weight === (checkIndex === 0 ? 2 : 1), 'practice utility weight mismatch');
            number(rawCheck.skillLevel, 1, 5, 'utility level', true);
            dice(rawCheck.adjustedDice);
            const floor = auditionMinimumFace(rawCheck.skillLevel, song.difficulty);
            check(
              rawCheck.floor === floor &&
                rawCheck.adjustedDice.every((face, i) => face === Math.max(practiceDice[i], floor)),
              'invalid practice adjusted dice',
            );
            utilitySums.push(sum(rawCheck.adjustedDice));
          }
          const weighted = (2 * utilitySums[0] + utilitySums[1] + utilitySums[2]) / 4;
          const result = Math.min(5, Math.floor(weighted / 2));
          same(rawPractice.weightedSum as number, weighted, 'practice weighted sum');
          check(
            rawPractice.sessionPractice === result &&
              rawPractice.practiceAfter === Math.max(rawPractice.practiceBefore, result),
            'practice bands or retained best mismatch',
          );
          check(
            rawPractice.improved === rawPractice.practiceAfter > rawPractice.practiceBefore,
            'practice improvement mismatch',
          );
          lastPractice.set(rawPractice.contestantId, rawPractice.practiceAfter);
        }
      }
      const decision =
        ep.conflict?.teamId === rawTeam.id && ep.conflictChoice
          ? ep.conflictChoice === 'push'
            ? 3
            : ep.conflictChoice === 'support'
              ? 2
              : 1
          : 0;
      same(rawTeam.coordination, clampBattle(coordination + decision, -5, 5), 'final team coordination');
    }
  }
  check(new Set(allMembers).size === allMembers.length, 'draft cannot duplicate contestants');
  if (!early && ep.phase !== 'draft')
    check(
      allMembers.length === 30 && new Set(assignedSongs).size === 6,
      'six distinct songs and full team partition required',
    );
  if (early || ep.phase === 'draft')
    check(
      ep.pairings.length === 0 && ep.performances.length === 0 && ep.teamCursor === 0,
      'future battles before draft finishes',
    );
  else {
    check(ep.pairings.length === 3, 'three pairings required');
    const paired: string[] = [];
    const pairIds = new Set<string>();
    for (const rawPair of value.pairings) {
      object(rawPair, 'pairing');
      text(rawPair.id);
      check(!pairIds.has(rawPair.id), 'duplicate pairing ID');
      pairIds.add(rawPair.id);
      ids(rawPair.teamIds, teamIds, 'paired teams', 2);
      paired.push(...rawPair.teamIds);
      const [a, b] = rawPair.teamIds.map((id) => ep.teams.find((team) => team.id === id)!);
      check(
        Math.abs(
          songs.find((song) => song.id === a.songId)!.difficulty -
            songs.find((song) => song.id === b.songId)!.difficulty,
        ) <= 1,
        'paired songs must have comparable difficulty',
      );
      check(
        rawPair.winnerId === null || rawPair.teamIds.includes(rawPair.winnerId as string),
        'winner is not a paired team',
      );
    }
    check(new Set(paired).size === 6, 'pairings must partition six teams');
  }
  const teamOrder = ep.pairings.flatMap((pairing) => pairing.teamIds);
  check(ep.performances.length === ep.teamCursor, 'performance cursor mismatch');
  for (const [performanceIndex, rawPerformance] of value.performances.entries()) {
    object(rawPerformance, 'performance');
    check(
      rawPerformance.teamId === teamOrder[performanceIndex],
      'performance must follow the saved pairing order',
    );
    const team = ep.teams.find((entry) => entry.id === rawPerformance.teamId)!;
    const song = songs.find((entry) => entry.id === team.songId)!;
    number(rawPerformance.meanScore, 0, 100, 'team mean');
    number(rawPerformance.finalScore, 0, 100, 'team score');
    check(rawPerformance.coordination === team.coordination, 'performance coordination mismatch');
    array(rawPerformance.evaluations, 'individual evaluations');
    check(rawPerformance.evaluations.length === 5, 'five evaluations per team required');
    const performed: string[] = [];
    for (const rawEvaluation of rawPerformance.evaluations) {
      object(rawEvaluation, 'evaluation');
      text(rawEvaluation.contestantId);
      check(
        team.memberIds.includes(rawEvaluation.contestantId) &&
          !performed.includes(rawEvaluation.contestantId),
        'individual must perform once in their team',
      );
      performed.push(rawEvaluation.contestantId);
      const part = song.parts.find((entry) => entry.id === rawEvaluation.partId);
      check(
        !!part && team.partAssignments[rawEvaluation.contestantId] === part.id,
        'performed part mismatches assignment',
      );
      dice(rawEvaluation.rawDice);
      const performanceDice = rawEvaluation.rawDice;
      number(rawEvaluation.composure, -1, 1, 'performance composure', true);
      if (performanceIndex % 2 === 0)
        check(rawEvaluation.composure === 0, 'A performance cannot react to a future opponent');
      else
        check(
          Math.abs(rawEvaluation.composure) === 1 && ep.composure[rawEvaluation.contestantId] === 0,
          'B composure must be recorded in its evaluation and consumed after performance',
        );
      number(rawEvaluation.technicalScore, 0, 100, 'technical score');
      number(rawEvaluation.stageScore, 0, 100, 'stage score');
      number(rawEvaluation.impressionScore, 0, 100, 'impression score');
      number(rawEvaluation.finalScore, 0, 100, 'individual score');
      number(rawEvaluation.tieBreakKey, 0, 1, 'tie key');
      check(rawEvaluation.tieBreakKey < 1, 'tie key must be below one');
      array(rawEvaluation.technicalChecks, 'technical checks');
      check(
        rawEvaluation.technicalChecks.length === part.testedSkills.length + 1,
        'performance must include nonzero Practice as a secondary skill',
      );
      let weighted = 0;
      let weights = 0;
      for (const [checkIndex, rawCheck] of rawEvaluation.technicalChecks.entries()) {
        object(rawCheck, 'technical check');
        const requirement = part.testedSkills[checkIndex];
        check(
          rawCheck.skill === (requirement?.skill ?? 'practice') &&
            rawCheck.requiredLevel === (requirement?.requiredLevel ?? part.testedSkills[0].requiredLevel),
          'technical requirements mismatch',
        );
        number(rawCheck.skillLevel, 1, 5, 'technical skill level', true);
        if (rawCheck.skill === 'practice') {
          const practiceResult = team.practice[1].contestants.find(
            (entry) => entry.contestantId === rawEvaluation.contestantId,
          )!;
          check(
            rawCheck.skillLevel === practiceResult.practiceAfter,
            'performance Practice must equal the retained preparation result',
          );
        }
        const floor = auditionMinimumFace(rawCheck.skillLevel, rawCheck.requiredLevel as number);
        check(
          rawCheck.floor === floor && rawCheck.weight === (checkIndex === 0 ? 2 : 1),
          'technical floor or weight mismatch',
        );
        dice(rawCheck.adjustedDice);
        check(
          rawCheck.adjustedDice.every((face, i) => face === Math.max(performanceDice[i], floor)),
          'technical adjusted dice mismatch',
        );
        const score =
          ((50 + 10 * (rawCheck.requiredLevel as number)) * (sum(rawCheck.adjustedDice) - 2)) / 10;
        same(rawCheck.score as number, score, 'technical skill score');
        weighted += score * (rawCheck.weight as number);
        weights += rawCheck.weight as number;
      }
      same(rawEvaluation.technicalScore, weighted / weights, 'technical score');
      object(rawEvaluation.stageCheck, 'stage check');
      array(rawEvaluation.impressionChecks, 'impression checks');
      check(rawEvaluation.impressionChecks.length === 4, 'four star-quality impressions required');
      const deliveryChecks = [rawEvaluation.stageCheck, ...rawEvaluation.impressionChecks];
      const deliverySkills = ['stagePresence', 'visual', 'uniqueness', 'potential', 'charisma'];
      for (const [index, delivery] of deliveryChecks.entries()) {
        object(delivery, 'delivery check');
        check(
          delivery.skill === deliverySkills[index] && delivery.requiredLevel === 3 && delivery.weight === 1,
          'stage/impression requirements mismatch',
        );
        number(delivery.skillLevel, 1, 5, 'delivery level', true);
        const floor = auditionMinimumFace(delivery.skillLevel, 3);
        check(delivery.floor === floor, 'delivery floor mismatch');
        dice(delivery.adjustedDice);
        check(
          delivery.adjustedDice.every((face, i) => face === Math.max(performanceDice[i], floor)),
          'delivery adjusted dice mismatch',
        );
        same(delivery.score as number, (sum(delivery.adjustedDice) - 2) * 10, 'normalized delivery score');
      }
      same(rawEvaluation.stageScore, rawEvaluation.stageCheck.score as number, 'stage score');
      same(
        rawEvaluation.impressionScore,
        sum(rawEvaluation.impressionChecks.map((entry) => (entry as Record<string, number>).score)) / 4,
        'impression score',
      );
      same(
        rawEvaluation.finalScore,
        clampBattle(
          0.55 * rawEvaluation.technicalScore +
            0.35 * rawEvaluation.stageScore +
            0.2 * rawEvaluation.impressionScore,
        ),
        'individual final score',
      );
      check(rawEvaluation.grade === auditionGrade(rawEvaluation.finalScore), 'grade does not match score');
    }
    const evaluations =
      rawPerformance.evaluations as unknown as BattleEpisode['performances'][number]['evaluations'];
    same(rawPerformance.meanScore, sum(evaluations.map((entry) => entry.finalScore)) / 5, 'team mean');
    same(
      rawPerformance.finalScore,
      clampBattle(rawPerformance.meanScore + team.coordination),
      'team final score',
    );
  }
  const afterPerformances = [
    'broadcast',
    'audience',
    'saves',
    'results',
    'mvp',
    'secret',
    'complete',
  ].includes(ep.phase);
  if (afterPerformances)
    check(
      ep.teamCursor === 6 && ep.teams.every((team) => team.practice.length === 2),
      'all thirty must perform before broadcast',
    );
  if (ep.phase === 'pairings')
    check(
      ep.teamCursor === 0 && ep.teams.every((team) => !team.practice.length),
      'pairings cannot contain future practice',
    );
  if (['preparation', 'conflict', 'performance'].includes(ep.phase)) {
    const preparedCount =
      ep.phase === 'performance' ? Math.ceil(ep.teamCursor / 2) * 2 : Math.floor(ep.teamCursor / 2) * 2 + 2;
    check(ep.teamCursor < 6 || ep.phase === 'performance', 'no current team beyond six');
    check(
      teamOrder.every(
        (id, index) =>
          ep.teams.find((team) => team.id === id)!.practice.length === (index < preparedCount ? 2 : 0),
      ),
      'practice timeline inconsistent with pair cursor',
    );
  }
  if (ep.conflict !== null) {
    object(value.conflict, 'conflict');
    const team = ep.teams.find((entry) => entry.id === ep.conflict!.teamId);
    check(!!team, 'conflict requires a team');
    ids(ep.conflict.contestantIds, team.memberIds, 'conflict participants', 2);
    check(ep.conflict.contestantIds[0] === team.captainId, 'featured practice decision requires captain');
    text(ep.conflict.description);
    check(
      ep.conflictChoice === null || ['support', 'mediate', 'push'].includes(ep.conflictChoice),
      'unknown practice choice',
    );
  } else check(ep.conflictChoice === null, 'practice choice without a scene');
  if (ep.phase === 'conflict')
    check(
      ep.conflict !== null && ep.conflictChoice === null && ep.teamCursor === 0,
      'invalid unresolved conflict',
    );
  if (ep.teamCursor > 0)
    check(
      ep.conflict !== null && ep.conflictChoice !== null,
      'performance requires the one practice decision',
    );

  if (afterPerformances) check(ep.cuts.length === 3, 'three preassembled cuts required');
  else check(ep.cuts.length === 0, 'broadcast cuts before all performances');
  const cutIds = new Set<string>();
  for (const rawCut of value.cuts) {
    object(rawCut, 'cut');
    check(
      ['music', 'personalities', 'backstage'].includes(rawCut.id as string) &&
        !cutIds.has(rawCut.id as string),
      'unknown or duplicate cut',
    );
    cutIds.add(rawCut.id as string);
    text(rawCut.title);
    text(rawCut.description);
    ids(rawCut.featuredIds, participantIds, 'cut features', 10);
    exactKeys(rawCut.exposure, participantIds, 'cut exposure');
    for (const exposure of Object.values(rawCut.exposure)) number(exposure, 0.4 / 30, 1, 'exposure');
    same(sum(Object.values(rawCut.exposure) as number[]), 1, 'exposure total');
    array(rawCut.footage, 'footage');
    check(rawCut.footage.length === 10, 'footage required for each feature');
    const footageIds: string[] = [];
    for (const footage of rawCut.footage) {
      object(footage, 'footage');
      text(footage.description);
      check(rawCut.featuredIds.includes(footage.contestantId as string), 'footage must belong to a feature');
      footageIds.push(footage.contestantId as string);
    }
    check(new Set(footageIds).size === 10, 'duplicate footage');
  }
  const voted = ['audience', 'saves', 'results', 'mvp', 'secret', 'complete'].includes(ep.phase);
  if (voted) {
    object(value.audience, 'audience');
    check(
      ep.cuts.some((cut) => cut.id === ep.selectedCutId),
      'selected cut required',
    );
    check(ep.finalRankedIds.length === 30, 'post-vote ranking must contain thirty');
    const audience = value.audience;
    for (const key of ['votes', 'newFans', 'receptions']) {
      exactKeys(audience[key], participantIds, key);
      for (const count of Object.values(audience[key]))
        number(count, 0, key === 'receptions' ? 100 : Number.MAX_SAFE_INTEGER, key, key !== 'receptions');
    }
    for (const key of ['votingPopulation', 'newViewers'])
      number(audience[key], 0, Number.MAX_SAFE_INTEGER, key, true);
    for (const key of ['satisfactionBefore', 'satisfactionAfter', 'attention', 'enjoyment'])
      number(audience[key], 0, 100, key);
    check(
      sum(Object.values(audience.votes as Record<string, number>)) === audience.votingPopulation,
      'one vote per viewer required',
    );
    for (const id of participantIds)
      check(ep.audience!.newFans[id] <= ep.audience!.votes[id], 'new fans exceed votes');
  } else
    check(
      ep.audience === null && ep.selectedCutId === null && ep.finalRankedIds.length === 0,
      'future audience outcome',
    );
  const saved = ['saves', 'results', 'mvp', 'secret', 'complete'].includes(ep.phase);
  if (saved) {
    check(ep.revealedResults === 3, 'all battle winners must be announced before saves');
    const atRisk: string[] = [];
    for (const pairing of ep.pairings) {
      check(pairing.winnerId !== null, 'announced battle requires winner');
      const performances = pairing.teamIds.map(
        (id) => ep.performances.find((performance) => performance.teamId === id)!,
      );
      const technical = (id: string) =>
        sum(
          ep.performances
            .find((performance) => performance.teamId === id)!
            .evaluations.map((entry) => entry.technicalScore),
        );
      const expectedWinner = [...performances].sort(
        (a, b) =>
          b.finalScore - a.finalScore ||
          technical(b.teamId) - technical(a.teamId) ||
          a.evaluations[0].tieBreakKey - b.evaluations[0].tieBreakKey ||
          a.teamId.localeCompare(b.teamId),
      )[0].teamId;
      check(pairing.winnerId === expectedWinner, 'battle winner must follow recorded performance, not votes');
      atRisk.push(
        ...ep.teams.find((team) => pairing.teamIds.includes(team.id) && team.id !== pairing.winnerId)!
          .memberIds,
      );
    }
    ids([ep.judgeSaveId, ep.audienceSaveId], atRisk, 'judge/audience saves', 2);
    const evaluations = new Map(
      ep.performances
        .flatMap((performance) => performance.evaluations)
        .map((entry) => [entry.contestantId, entry]),
    );
    const performanceOrder = (a: string, b: string) =>
      evaluations.get(b)!.finalScore - evaluations.get(a)!.finalScore ||
      evaluations.get(b)!.technicalScore - evaluations.get(a)!.technicalScore ||
      evaluations.get(a)!.tieBreakKey - evaluations.get(b)!.tieBreakKey ||
      a.localeCompare(b);
    check(ep.judgeSaveId === [...atRisk].sort(performanceOrder)[0], 'judge save must be highest performance');
    check(
      ep.audienceSaveId ===
        atRisk
          .filter((id) => id !== ep.judgeSaveId)
          .sort((a, b) => ep.audience!.votes[b] - ep.audience!.votes[a] || performanceOrder(a, b))[0],
      'audience save must be highest remaining votes',
    );
    ids(
      ep.productionShortlist,
      atRisk.filter((id) => id !== ep.judgeSaveId && id !== ep.audienceSaveId),
      'production shortlist',
      3,
    );
    if (ep.phase !== 'saves')
      check(ep.productionShortlist.includes(ep.productionSaveId!), 'production save must be eligible');
    else check(ep.productionSaveId === null, 'unmade production save must be null');
  } else
    check(
      ep.revealedResults === 0 &&
        ep.pairings.every((pairing) => pairing.winnerId === null) &&
        ep.judgeSaveId === null &&
        ep.audienceSaveId === null &&
        ep.productionSaveId === null &&
        ep.productionShortlist.length === 0,
      'future winners or saves',
    );
  ids(value.survivorIds, participantIds, 'survivors');
  ids(value.eliminatedIds, participantIds, 'departures');
  ids(value.secretCandidates, participantIds, 'secret candidates');
  const locked = ['results', 'mvp', 'secret', 'complete'].includes(ep.phase);
  const departureScenes = ep.scenes.filter((scene) => scene.kind === 'eliminations');
  if (locked) {
    check(
      ep.survivorIds.length === 18 &&
        ep.eliminatedIds.length === 12 &&
        new Set([...ep.survivorIds, ...ep.eliminatedIds]).size === 30,
      'closure requires eighteen/twelve partition',
    );
    const winners = ep.pairings.flatMap(
      (pairing) => ep.teams.find((team) => team.id === pairing.winnerId)!.memberIds,
    );
    check(
      winners.every((id) => ep.survivorIds.includes(id)) &&
        [ep.judgeSaveId, ep.audienceSaveId, ep.productionSaveId].every((id) => ep.survivorIds.includes(id!)),
      'all winning teams and three distinct saves survive',
    );
    check(departureScenes.length <= 3, 'too many departure scenes');
    if (ep.phase !== 'results')
      check(departureScenes.length === 3, 'all departures must be revealed before MVP');
    else check(departureScenes.length < 3, 'results cursor must advance after third reveal');
    for (const [index, departure] of departureScenes.entries()) {
      const pairing = ep.pairings[index];
      const expected = ep.teams
        .find((team) => pairing.teamIds.includes(team.id) && team.id !== pairing.winnerId)!
        .memberIds.filter((id) => ep.eliminatedIds.includes(id));
      check(
        JSON.stringify(departure.contestantIds) === JSON.stringify(expected),
        'departure reveal does not match saved pairing',
      );
    }
    const revealed = new Set(departureScenes.flatMap((scene) => scene.contestantIds));
    for (const id of participantIds)
      check(
        contestants.find((contestant) => contestant.id === id)!.status ===
          (revealed.has(id) ? 'ELIMINATED' : 'ACTIVE'),
        'contestant status must follow actual departure reveal',
      );
  } else
    check(
      ep.survivorIds.length === 0 &&
        ep.eliminatedIds.length === 0 &&
        departureScenes.length === 0 &&
        participantIds.every(
          (id) => contestants.find((contestant) => contestant.id === id)!.status === 'ACTIVE',
        ),
      'departures before valid production save',
    );
  const afterMvp = ep.phase === 'secret' || ep.phase === 'complete';
  if (afterMvp) {
    object(value.mvp, 'MVP');
    exactKeys(value.mvp.ballots, ep.survivorIds, 'MVP ballots');
    exactKeys(value.mvp.totals, ep.survivorIds, 'MVP totals');
    for (const [voter, choice] of Object.entries(value.mvp.ballots))
      check(
        voter !== choice && ep.survivorIds.includes(choice as string),
        'MVP cannot self-vote or include eliminated participants',
      );
    for (const id of ep.survivorIds) {
      number(value.mvp.totals[id], 0, 18, 'MVP total', true);
      check(
        value.mvp.totals[id] === Object.values(value.mvp.ballots).filter((choice) => choice === id).length,
        'MVP totals mismatch ballots',
      );
    }
    const highest = Math.max(...(Object.values(value.mvp.totals) as number[]));
    const totals = value.mvp.totals;
    const tied = ep.survivorIds.filter((id) => totals[id] === highest);
    ids(value.mvp.tiedIds, tied, 'MVP ties', tied.length);
    check(tied.includes(value.mvp.winnerId as string), 'MVP winner must be a ballot winner');
    check(ep.secretCandidates.length <= 3, 'secret shortlist exceeds three');
    if (ep.phase === 'secret')
      check(
        ep.secretCandidates.length > 0 && ep.secret === null,
        'secret choice requires candidates and no resolved result',
      );
  } else
    check(ep.mvp === null && ep.secretCandidates.length === 0 && ep.secret === null, 'future MVP or secret');
  if (ep.secret !== null) {
    object(value.secret, 'secret');
    check(ep.secretCandidates.includes(ep.secret.contestantId), 'secret selected outside shortlist');
    text(ep.secret.title);
    text(ep.secret.description);
    check(
      ep.secret.cardId === null || Object.hasOwn(definitions.cards.secret, ep.secret.cardId),
      'unknown secret card',
    );
    array(ep.secret.deferred, 'deferred secret consequences');
    for (const consequence of ep.secret.deferred) {
      object(consequence, 'secret consequence');
      check(consequence.contestantId === ep.secret.contestantId, 'secret consequence contestant mismatch');
      check(
        consequence.path === 'status' || consequence.path === 'aggregations.score',
        'invalid deferred path',
      );
      text(consequence.cause);
    }
  }
  if (ep.phase === 'complete') {
    check(
      ep.secret !== null || ep.secretCandidates.length === 0,
      'cannot complete with an unresolved secret choice',
    );
    check(ep.scenes.at(-1)?.kind === 'recap', 'completed episode needs recap');
    for (const id of participantIds) {
      const contestant = contestants.find((entry) => entry.id === id)!;
      const logs = contestant.changeLog.filter((entry) => entry.episode === 2);
      check(
        logs.length === 1 &&
          logs[0].phaseId === 'episode-2' &&
          logs[0].status === contestant.status &&
          logs[0].score ===
            ep.performances.flatMap((entry) => entry.evaluations).find((entry) => entry.contestantId === id)!
              .finalScore,
        'each participant needs exactly one accurate episode-2 history',
      );
      check(
        JSON.stringify(logs[0].changes) === JSON.stringify(ep.changes[id] ?? []),
        'episode history must preserve detailed changes',
      );
    }
  } else
    check(
      participantIds.every(
        (id) => !contestants.find((entry) => entry.id === id)!.changeLog.some((entry) => entry.episode === 2),
      ),
      'partial episode cannot contain completed history',
    );
  if (action.type === 'start')
    check(ep.phase === 'dorms' && ep.roomCursor === 0, 'start must open the dorms');
  if (action.type === 'conflict')
    check(
      ep.phase === 'preparation' && ep.conflictChoice === action.choice && ep.teamCursor === 0,
      'practice choice timing mismatch',
    );
  if (action.type === 'broadcast')
    check(ep.phase === 'audience' && ep.selectedCutId === action.cutId, 'broadcast action timing mismatch');
  if (action.type === 'production-save')
    check(
      ep.phase === 'results' && ep.productionSaveId === action.contestantId && departureScenes.length === 0,
      'production save timing mismatch',
    );
  if (action.type === 'secret')
    check(
      ep.phase === 'complete' && ep.secret?.contestantId === action.contestantId,
      'secret action must close the episode',
    );
  if (action.type === 'advance') {
    check(ep.phase !== 'audience', 'advance cannot cast the public vote');
    if (ep.phase === 'complete')
      check(ep.secretCandidates.length === 0, 'advance cannot skip a secret choice');
  }
}
