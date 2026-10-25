import type { Contestant } from '../types/contestant';
import type { SimulationDefinitions, SimulationState } from '../types/simulation';
import type { TrackSpecialsEpisode, TrackSpecialsPhase } from '../types/track-specials-episode';
import { validateTrackSpecialSongs } from '../utilities/track-special-songs';
import { auditionMinimumFace } from './audition-scoring';
import { revealAuditionSecret } from './audition-secrets';
import { change, mvp, outcome, secret } from './audition-validation';
import { battleCheck, battleRelationship, changeBattleRelationship, clampBattle } from './battle-scoring';
import {
  electTrackRole,
  optimalTrackGroups,
  trackAffinity,
  trackGroupingTieKeys,
  trackGroupSizes,
  trackSkill,
  trackSpecialty,
} from './track-specials-grouping';
import { castTrackAwards, frozenTrackJurors, trackAwardEffects } from './track-specials-jury';
import { preserveTrackCondition, trackRevealReaction, trackSpecialScore } from './track-specials-scoring';

const phases: TrackSpecialsPhase[] = [
  're-lodging',
  'credits',
  'grouping',
  'practice',
  'intervention',
  'jury-reveal',
  'performances',
  'awards-best',
  'awards-worst',
  'finale',
  'secret-choice',
  'secret-result',
  'ranking',
  'complete',
];
const episodeKeys = [
  'version',
  'phase',
  'revision',
  'lastAction',
  'participantIds',
  'startingContestants',
  'previousRankedIds',
  'rooms',
  'roomMoves',
  'closedRoomIds',
  'teams',
  'grouping',
  'frozenRelationships',
  'frozenTraits',
  'priorPractice',
  'teamCursor',
  'practiceCursor',
  'performanceOrder',
  'performances',
  'conflict',
  'juryIds',
  'juryProfiles',
  'juryRevealed',
  'revealEffects',
  'awards',
  'bestAnnounced',
  'worstAnnounced',
  'awardHappinessBaseline',
  'awardEffects',
  'evidence',
  'exposure',
  'audience',
  'mvp',
  'sealedRankingScores',
  'rankingTieKeys',
  'secretCandidates',
  'secret',
  'rankedIds',
  'survivorIds',
  'eliminatedId',
  'rankRevealed',
  'scenes',
  'changes',
];
function check(value: unknown, reason: string): asserts value {
  if (!value) throw new Error(`Invalid Track Specials: ${reason}.`);
}
function object(value: unknown): asserts value is Record<string, unknown> {
  check(value && typeof value === 'object' && !Array.isArray(value), 'expected an object');
}
function exact(value: unknown, keys: readonly string[]) {
  object(value);
  check(
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)),
    'missing or unknown keys',
  );
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
    'invalid numeric evidence',
  );
}
function ids(value: unknown, known: readonly string[], count?: number): asserts value is string[] {
  check(
    Array.isArray(value) &&
      value.every((id) => typeof id === 'string' && known.includes(id)) &&
      new Set(value).size === value.length &&
      (count === undefined || value.length === count),
    'unknown, repeated or missing IDs',
  );
}
function equal(value: unknown, expected: unknown, reason: string) {
  function canonical(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === 'object')
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, canonical(entry)]),
      );
    return input;
  }
  check(JSON.stringify(canonical(value)) === JSON.stringify(canonical(expected)), reason);
}
function close(a: number, b: number, reason: string) {
  number(a, -Number.MAX_SAFE_INTEGER);
  check(Math.abs(a - b) < 1e-8, reason);
}
function ties(value: unknown, keys: readonly string[]) {
  exact(value, keys);
  for (const entry of Object.values(value as Record<string, unknown>)) {
    number(entry, 0, 1);
    check(entry < 1, 'invalid random tie');
  }
}
function dice(value: unknown) {
  check(Array.isArray(value) && value.length === 2, 'missing dice pair');
  value.forEach((die) => {
    number(die, 1, 6, true);
  });
}

export function assertTrackSpecialsEpisode(
  value: unknown,
  contestants: readonly Contestant[],
  definitions: SimulationDefinitions,
): asserts value is TrackSpecialsEpisode {
  const songs = validateTrackSpecialSongs(definitions.trackSpecialSongs);
  exact(value, episodeKeys);
  const ep = value as unknown as TrackSpecialsEpisode;
  check(ep.version === 1 && phases.includes(ep.phase), 'unknown version or phase');
  number(ep.revision, 0, Number.MAX_SAFE_INTEGER, true);
  exact(ep.lastAction, ['revision', 'action']);
  check(ep.lastAction.revision === Math.max(0, ep.revision - 1), 'action revision mismatch');
  object(ep.lastAction.action);
  check(['start', 'advance', 'conflict', 'secret'].includes(ep.lastAction.action.type), 'invalid action');
  exact(
    ep.lastAction.action,
    ep.lastAction.action.type === 'conflict'
      ? ['type', 'choice']
      : ep.lastAction.action.type === 'secret'
        ? ['type', 'contestantId']
        : ['type'],
  );
  if (ep.lastAction.action.type === 'conflict')
    check(
      ['support', 'mediate', 'push'].includes(ep.lastAction.action.choice),
      'invalid recorded intervention',
    );
  if (ep.lastAction.action.type === 'secret')
    check(typeof ep.lastAction.action.contestantId === 'string', 'invalid recorded investigation');
  const known = contestants.map((entry) => entry.id);
  check(known.length === 50 && new Set(known).size === 50, 'full fifty-person cast required');
  ids(ep.participantIds, known, 16);
  ids(ep.previousRankedIds, ep.participantIds, 16);
  equal(ep.previousRankedIds, ep.participantIds, 'previous ranking differs from participants');
  check(
    Array.isArray(ep.startingContestants) && ep.startingContestants.length === 50,
    'missing starting cast',
  );
  ids(
    ep.startingContestants.map((entry) => entry.id),
    known,
    50,
  );
  const source = (id: string) => ep.startingContestants.find((entry) => entry.id === id)!;
  for (const entry of ep.startingContestants) {
    Object.values(entry.coreSkills).forEach((skill) => {
      number(skill, 1, 5, true);
    });
    Object.values(entry.utilitySkills).forEach((skill) => {
      number(skill, 1, 5, true);
    });
    Object.values(entry.personality).forEach((trait) => {
      number(trait, -10, 10, true);
    });
    number(entry.aggregations.happiness, 0, 100);
    number(entry.aggregations.practice, 0, 5, true);
    for (const history of Object.values(entry.relationships)) {
      check(Array.isArray(history) && history.length > 0, 'invalid frozen relationship history');
      history.forEach((affection) => {
        number(affection, 0, 100);
      });
    }
  }
  check(
    ep.startingContestants.filter((entry) => entry.status === 'ACTIVE').length === 16 &&
      ep.participantIds.every((id, index) => source(id).status === 'ACTIVE' && source(id).rank === index + 1),
    'starting placements mismatch',
  );
  ids(ep.juryIds, known, 34);
  equal(
    ep.juryProfiles,
    frozenTrackJurors(ep.startingContestants, ep.participantIds),
    'forged frozen jury profiles',
  );
  equal(
    ep.juryIds,
    ep.juryProfiles.map((profile) => profile.contestantId),
    'jury ID mismatch',
  );
  equal(
    ep.frozenTraits,
    Object.fromEntries(ep.startingContestants.map((entry) => [entry.id, entry.personality])),
    'frozen traits mismatch',
  );
  equal(
    ep.frozenRelationships,
    Object.fromEntries(
      ep.startingContestants.map((entry) => [
        entry.id,
        Object.fromEntries(ep.participantIds.map((id) => [id, battleRelationship(entry, id)])),
      ]),
    ),
    'frozen affection mismatch',
  );
  equal(
    ep.priorPractice,
    Object.fromEntries(ep.participantIds.map((id) => [id, source(id).aggregations.practice])),
    'practice baseline mismatch',
  );
  check(Array.isArray(ep.rooms) && ep.rooms.length === 3, 'three rooms required');
  ep.rooms.forEach((room) => {
    exact(room, ['id', 'memberIds']);
  });
  check(
    new Set(ep.rooms.map((room) => room.id)).size === 3 &&
      ep.rooms.every(
        (room, index) => typeof room.id === 'string' && room.memberIds.length === [6, 6, 4][index],
      ),
    'room occupancy mismatch',
  );
  ids(
    ep.rooms.flatMap((room) => room.memberIds),
    ep.participantIds,
    16,
  );
  ids(ep.closedRoomIds, ep.closedRoomIds);
  check(
    !ep.closedRoomIds.some((id) => ep.rooms.some((room) => room.id === id)),
    'closed room still occupied',
  );
  check(Array.isArray(ep.roomMoves), 'missing room moves');
  ep.roomMoves.forEach((move) => {
    exact(move, ['contestantId', 'fromRoomId', 'toRoomId']);
  });
  ids(
    ep.roomMoves.map((move) => move.contestantId),
    ep.participantIds,
  );
  check(
    ep.roomMoves.every(
      (move) =>
        ep.rooms.some((room) => room.id === move.toRoomId && room.memberIds.includes(move.contestantId)) &&
        move.fromRoomId !== move.toRoomId,
    ),
    'invalid room move',
  );
  check(Array.isArray(ep.scenes) && ep.scenes.length === ep.revision + 1, 'revision/scene mismatch');
  ep.scenes.forEach((scene, index) => {
    check(
      scene.id === `track-specials-${index}` &&
        typeof scene.title === 'string' &&
        Array.isArray(scene.paragraphs) &&
        scene.paragraphs.every((text) => typeof text === 'string'),
      'invalid scene',
    );
    number(scene.sequence, 1, 8, true);
    if (index) check(scene.sequence >= ep.scenes[index - 1]!.sequence!, 'scene sequence regressed');
    ids(scene.contestantIds, known);
    if (scene.sequence < 5)
      check(
        scene.contestantIds.every((id) => ep.participantIds.includes(id)),
        'premature jury footage',
      );
    if (scene.contestantChanges)
      for (const entries of Object.values(scene.contestantChanges))
        check(Array.isArray(entries) && entries.every(change), 'invalid scene changes');
  });
  object(ep.changes);
  check(
    Object.keys(ep.changes).every((id) => known.includes(id)) &&
      Object.values(ep.changes).every((entries) => Array.isArray(entries) && entries.every(change)),
    'invalid change history',
  );
  for (const jurorId of ep.juryIds)
    check(
      (ep.changes[jurorId] ?? []).every((entry) => entry.path === 'aggregations.score'),
      'returning guest received a competitive change',
    );
  for (const flag of [ep.juryRevealed, ep.bestAnnounced, ep.worstAnnounced, ep.rankRevealed])
    check(typeof flag === 'boolean', 'missing phase flag');
  number(ep.teamCursor, 0, 15, true);
  number(ep.practiceCursor, 0, 2, true);
  check(
    Array.isArray(ep.teams) &&
      Array.isArray(ep.grouping) &&
      Array.isArray(ep.performances) &&
      Array.isArray(ep.awards),
    'missing native records',
  );
  const grouped = !['re-lodging', 'credits'].includes(ep.phase);
  check(
    ep.teams.length === (grouped ? ep.teams.length : 0) && (!grouped || ep.teams.length > 0),
    'grouping phase mismatch',
  );
  const simulated = new Map(
    ep.participantIds.map((id) => {
      const entry = structuredClone(source(id));
      entry.aggregations.practice = 0;
      entry.aggregations.happiness = clampBattle(
        clampBattle(
          entry.aggregations.happiness +
            (entry.personality.extroversion > 5 ? 3 : entry.personality.extroversion < -5 ? -3 : 0),
        ) + (grouped ? 3 : 0),
      );
      return [id, entry];
    }),
  );
  if (grouped) {
    ids(
      ep.teams.flatMap((team) => team.memberIds),
      ep.participantIds,
      16,
    );
    check(new Set(ep.teams.map((team) => team.id)).size === ep.teams.length, 'repeated team');
    check(ep.grouping.length === 3, 'missing track partitions');
    for (const [index, track] of (['VOCAL', 'RAP', 'DANCE'] as const).entries()) {
      const record = ep.grouping[index];
      const members = ep.participantIds.filter((id) => source(id).track === track);
      check(record.track === track, 'track partition order');
      exact(record, ['track', 'sizes', 'affinity', 'tieKeys']);
      equal(record.sizes, trackGroupSizes(members.length), 'illegal group sizes');
      ties(record.tieKeys, Object.keys(trackGroupingTieKeys(members, () => 0)));
      for (const draw of Object.values(record.tieKeys)) {
        number(draw, 0, 1);
        check(draw < 1, 'grouping tie');
      }
      const optimal = optimalTrackGroups(members, ep.frozenRelationships, record.tieKeys);
      close(record.affinity, optimal.affinity, 'nonoptimal grouping evidence');
      equal(
        ep.teams.filter((team) => team.track === track).map((team) => team.memberIds),
        optimal.groups,
        'nonoptimal affinity memberships',
      );
    }
    for (const team of ep.teams)
      for (const id of team.memberIds)
        for (const other of team.memberIds)
          if (id !== other) changeBattleRelationship(simulated.get(id)!, other, 2);
  } else check(ep.grouping.length === 0, 'premature partition');
  const usedSongs = new Set<string>();
  for (const [index, team] of ep.teams.entries()) {
    exact(team, [
      'id',
      'name',
      'track',
      'memberIds',
      'captainId',
      'centerId',
      'songId',
      'centerBallots',
      'partAssignments',
      'partReactions',
      'coordination',
      'practice',
      'affinity',
      'groupingTieKey',
      'songPreferences',
      'leaderElection',
      'centerElection',
      'partTieKeys',
      'intervention',
    ]);
    check(
      team.id === `track-${team.track.toLowerCase()}-${index + 1}` &&
        team.memberIds.every((id) => source(id).track === team.track),
      'mixed primary track',
    );
    close(team.affinity, trackAffinity(team.memberIds, ep.frozenRelationships), 'group affinity mismatch');
    check(
      team.groupingTieKey ===
        ep.grouping.find((record) => record.track === team.track)!.tieKeys[
          [...team.memberIds].sort().join('|')
        ],
      'group tie mismatch',
    );
    check(Array.isArray(team.practice) && team.practice.length <= 2, 'invalid practice count');
    if (!team.songId) {
      check(
        !team.leaderElection &&
          !team.centerElection &&
          team.captainId === '' &&
          team.centerId === null &&
          team.practice.length === 0 &&
          index >= ep.teamCursor,
        'premature team preparation',
      );
      continue;
    }
    check(index <= ep.teamCursor, 'future team preparation');
    const song = songs.find((entry) => entry.id === team.songId);
    check(song && song.track === team.track && !usedSongs.has(song.id), 'song reuse or track mismatch');
    const available = songs.filter((entry) => entry.track === team.track && !usedSongs.has(entry.id));
    exact(
      team.songPreferences,
      available.map((entry) => entry.id),
    );
    for (const entry of available) {
      const preference = team.songPreferences[entry.id];
      exact(preference, ['specialty', 'genre', 'tieKey']);
      close(
        preference.specialty,
        team.memberIds.filter((id) =>
          entry.favoredSpecialties.includes(source(id).specialties[trackSpecialty(team.track)]),
        ).length / team.memberIds.length,
        'specialty proportion mismatch',
      );
      close(
        preference.genre,
        team.memberIds.filter((id) => source(id).specialties.genreAffinity === entry.genre).length /
          team.memberIds.length,
        'genre proportion mismatch',
      );
      number(preference.tieKey, 0, 1);
      check(preference.tieKey < 1, 'song tie');
    }
    const chosen = [...available].sort((a, b) => {
      const first = team.songPreferences[a.id];
      const second = team.songPreferences[b.id];
      return (
        second.specialty - first.specialty ||
        second.genre - first.genre ||
        first.tieKey - second.tieKey ||
        a.id.localeCompare(b.id)
      );
    })[0];
    check(chosen.id === song.id, 'incorrect song selection');
    usedSongs.add(song.id);
    check(team.leaderElection, 'missing leader election');
    ties(team.leaderElection.tieKeys, team.memberIds);
    const members = team.memberIds.map((id) => simulated.get(id)!);
    equal(
      team.leaderElection,
      electTrackRole(members, 'leader', team.leaderElection.tieKeys),
      'leader ballots mismatch',
    );
    check(team.captainId === team.leaderElection.winnerId, 'incorrect captain');
    ties(team.partTieKeys, team.memberIds);
    const ordered = [...members].sort(
      (a, b) =>
        b.coreSkills[trackSkill(team.track)] - a.coreSkills[trackSkill(team.track)] ||
        Number(song.favoredSpecialties.includes(b.specialties[trackSpecialty(team.track)])) -
          Number(song.favoredSpecialties.includes(a.specialties[trackSpecialty(team.track)])) ||
        team.partTieKeys[a.id] - team.partTieKeys[b.id] ||
        a.id.localeCompare(b.id),
    );
    const parts = [...song.arrangements[String(members.length) as '1']].sort(
      (a, b) => b.requiredLevel - a.requiredLevel || a.id.localeCompare(b.id),
    );
    equal(
      team.partAssignments,
      Object.fromEntries(ordered.map((entry, part) => [entry.id, parts[part].id])),
      'part assignment mismatch',
    );
    equal(
      team.partReactions,
      Object.fromEntries(team.memberIds.map((id) => [id, 'neutral'])),
      'part reaction mismatch',
    );
    let coordination = 0;
    for (const [sessionIndex, session] of team.practice.entries()) {
      exact(session, [
        'session',
        'title',
        'leaderDice',
        'leadershipCheck',
        'leadershipSuccess',
        'coordinationChange',
        'coordinationBefore',
        'coordinationAfter',
        'contestants',
      ]);
      check(
        session.session === sessionIndex + 1 &&
          session.title === (sessionIndex ? 'Full rehearsal' : 'Part learning'),
        'practice session mismatch',
      );
      dice(session.leaderDice);
      const leaderCheck = battleCheck(
        'leadership',
        source(team.captainId).coreSkills.leadership,
        3,
        session.leaderDice,
      );
      const success = leaderCheck.adjustedDice[0] + leaderCheck.adjustedDice[1] >= 8;
      equal(session.leadershipCheck, { ...leaderCheck, successThreshold: 8 }, 'leadership check mismatch');
      check(
        session.leadershipSuccess === success &&
          session.coordinationChange === (success ? 1 : -1) &&
          session.coordinationBefore === coordination,
        'practice leadership evidence mismatch',
      );
      coordination = clampBattle(coordination + (success ? 1 : -1), -5, 5);
      check(session.coordinationAfter === coordination, 'practice coordination mismatch');
      equal(
        session.contestants.map((entry) => entry.contestantId),
        team.memberIds,
        'practice participant mismatch',
      );
      const skills = sessionIndex
        ? (['stamina', 'consistency', 'memory'] as const)
        : (['learning', 'memory', 'consistency'] as const);
      for (const record of session.contestants) {
        exact(record, [
          'contestantId',
          'rawDice',
          'checks',
          'practiceBefore',
          'practiceAfter',
          'weightedSum',
          'sessionPractice',
          'improved',
        ]);
        dice(record.rawDice);
        const entry = simulated.get(record.contestantId)!;
        const checks = skills.map((skill, skillIndex) => ({
          skill,
          skillLevel: entry.utilitySkills[skill],
          requiredLevel: 3,
          floor: auditionMinimumFace(entry.utilitySkills[skill], 3),
          weight: skillIndex ? 1 : 2,
          adjustedDice: battleCheck(skill, entry.utilitySkills[skill], 3, record.rawDice).adjustedDice,
        }));
        equal(record.checks, checks, 'practice utility checks mismatch');
        const weighted =
          checks.reduce(
            (sum, check) => sum + (check.adjustedDice[0] + check.adjustedDice[1]) * check.weight,
            0,
          ) / 4;
        const sessionPractice = Math.min(5, Math.floor(weighted / 2));
        const after = Math.max(entry.aggregations.practice, sessionPractice);
        check(
          record.practiceBefore === entry.aggregations.practice &&
            record.practiceAfter === after &&
            record.sessionPractice === sessionPractice &&
            record.improved === after > record.practiceBefore,
          'practice improvement mismatch',
        );
        close(record.weightedSum, weighted, 'practice weighted sum mismatch');
        entry.aggregations.practice = after;
        if (entry.id !== team.captainId) {
          const strained =
            battleRelationship(entry, team.captainId) < 40 || entry.personality.gentleness < -3;
          changeBattleRelationship(entry, team.captainId, success ? 1 : strained ? -2 : -1);
        }
      }
    }
    if (team.intervention) {
      exact(team.intervention, ['contestantIds', 'description', 'choice']);
      check(team.memberIds.length > 1 && team.practice.length === 2, 'invalid solo or early conflict');
      ids(team.intervention.contestantIds, team.memberIds, 2);
      check(team.intervention.contestantIds[0] === team.captainId, 'conflict leader mismatch');
      const leader = simulated.get(team.captainId)!;
      const other = simulated.get(team.intervention.contestantIds[1])!;
      const stalled = team.practice.some(
        (session) => !session.contestants.find((entry) => entry.contestantId === other.id)!.improved,
      );
      check(
        stalled &&
          ((leader.personality.discipline >= 5 &&
            other.personality.discipline <= -3 &&
            leader.personality.discipline - other.personality.discipline >= 10) ||
            (battleRelationship(leader, other.id) < 35 && battleRelationship(other, leader.id) < 35)),
        'invented conflict',
      );
      changeBattleRelationship(leader, other.id, -2);
      changeBattleRelationship(other, leader.id, -2);
      const choice = team.intervention.choice;
      check(choice === null || ['support', 'mediate', 'push'].includes(choice), 'invalid conflict choice');
      if (choice) {
        coordination = clampBattle(
          coordination + (choice === 'push' ? 3 : choice === 'support' ? 2 : 1),
          -5,
          5,
        );
        for (const entry of [leader, other]) {
          changeBattleRelationship(
            entry,
            entry.id === leader.id ? other.id : leader.id,
            choice === 'push' ? -3 : choice === 'mediate' ? 2 : 1,
          );
        }
      } else
        check(ep.phase === 'intervention' && ep.conflict?.teamId === team.id, 'unresolved conflict mismatch');
    }
    check(team.coordination === coordination, 'team coordination mismatch');
    if (team.centerElection) {
      check(team.practice.length === 2 && (!team.intervention || team.intervention.choice), 'early center');
      ties(team.centerElection.tieKeys, team.memberIds);
      equal(
        team.centerElection,
        electTrackRole(members, 'center', team.centerElection.tieKeys),
        'center preference mismatch',
      );
      check(team.centerId === team.centerElection.winnerId, 'center winner mismatch');
      equal(team.centerBallots, team.centerElection.ballots, 'center ballot alias mismatch');
    } else check(team.centerId === null && !Object.keys(team.centerBallots).length, 'unrecorded center');
  }
  check((ep.phase === 'intervention') === (ep.conflict !== null), 'blocking conflict mismatch');
  if (ep.conflict) {
    const team = ep.teams.find((entry) => entry.id === ep.conflict!.teamId);
    check(team?.intervention && !team.intervention.choice, 'missing conflict record');
    equal(ep.conflict.contestantIds, team.intervention.contestantIds, 'conflict participant mismatch');
    check(ep.conflict.description === team.intervention.description, 'conflict description mismatch');
  }
  if (grouped) {
    ids(
      ep.performanceOrder,
      ep.teams.map((team) => team.id),
      ep.teams.length,
    );
    const queues = new Map<string, number>();
    const roundTracks = new Set<string>();
    let round = 0;
    for (const id of ep.performanceOrder) {
      const track = ep.teams.find((team) => team.id === id)!.track;
      const count = queues.get(track) ?? 0;
      if (count > round) {
        round++;
        roundTracks.clear();
      }
      check(!roundTracks.has(track), 'performance order is not track round-robin');
      roundTracks.add(track);
      queues.set(track, count + 1);
    }
  } else check(ep.performanceOrder.length === 0, 'premature performance order');
  const revealed = phases.indexOf(ep.phase) >= phases.indexOf('jury-reveal');
  check(ep.juryRevealed === revealed, 'jury reveal phase mismatch');
  if (revealed) {
    check(
      ep.teams.every((team) => team.practice.length === 2 && team.centerId),
      'jury before rehearsal completion',
    );
    exact(ep.revealEffects, ep.participantIds);
    for (const id of ep.participantIds)
      equal(
        ep.revealEffects[id],
        trackRevealReaction(simulated.get(id)!),
        'reveal readiness/condition mismatch',
      );
  } else
    check(!Object.keys(ep.revealEffects).length && ep.performances.length === 0, 'premature reveal effects');
  check(ep.performances.length <= ep.teams.length, 'too many performances');
  ep.performances.forEach((performance, index) => {
    exact(performance, ['teamId', 'evaluations', 'meanScore', 'finalScore', 'comments', 'reactions']);
    check(performance.teamId === ep.performanceOrder[index], 'performance order mismatch');
    const team = ep.teams.find((entry) => entry.id === performance.teamId)!;
    const song = songs.find((entry) => entry.id === team.songId)!;
    equal(
      performance.evaluations.map((entry) => entry.contestantId),
      team.memberIds,
      'performer mismatch',
    );
    for (const evaluation of performance.evaluations) {
      const expected = trackSpecialScore(
        simulated.get(evaluation.contestantId)!,
        team,
        song,
        evaluation.rawDice,
        ep.revealEffects[evaluation.contestantId].readiness,
      );
      equal(evaluation, expected, 'forged raw performance/checks/modifiers');
    }
    const average =
      performance.evaluations.reduce((sum, entry) => sum + entry.rawScore, 0) / team.memberIds.length;
    close(performance.meanScore, average, 'group mean divisor mismatch');
    close(performance.finalScore, average, 'judge bonus or group result mismatch');
    check(
      performance.comments.length === 3 &&
        performance.comments.every(
          (comment, commentIndex) =>
            comment.judgeId === ['john', 'megan', 'michael'][commentIndex] &&
            typeof comment.description === 'string',
        ),
      'invalid observational commentary',
    );
    performance.comments.forEach((comment) => {
      exact(comment, ['judgeId', 'description']);
    });
    check(
      performance.reactions.length <= 3 &&
        new Set(performance.reactions.map((entry) => entry.jurorId)).size === performance.reactions.length,
      'invalid juror reactions',
    );
    for (const reaction of performance.reactions) {
      exact(reaction, ['jurorId', 'contestantId', 'relationship', 'description']);
      check(
        ep.juryIds.includes(reaction.jurorId) &&
          team.memberIds.includes(reaction.contestantId) &&
          reaction.relationship ===
            ep.juryProfiles.find((profile) => profile.contestantId === reaction.jurorId)!.relationships[
              reaction.contestantId
            ],
        'ungrounded juror reaction',
      );
    }
  });
  const best = phases.indexOf(ep.phase) >= phases.indexOf('awards-best');
  const worst = phases.indexOf(ep.phase) >= phases.indexOf('awards-worst');
  check(ep.bestAnnounced === best && ep.worstAnnounced === worst, 'award announcement mismatch');
  if (best) {
    check(ep.performances.length === ep.teams.length && ep.awards.length === 7, 'early or missing ballots');
    const draws: number[] = [];
    for (const award of ep.awards)
      if (award.status === 'contested') {
        ties(award.tallyTieKeys, award.eligibleIds);
        draws.push(...award.eligibleIds.map((id) => award.tallyTieKeys[id]));
        exact(award.tieKeys, ep.juryIds);
        for (const juror of ep.juryIds) {
          ties(award.tieKeys[juror], award.eligibleIds);
          draws.push(...award.eligibleIds.map((id) => award.tieKeys[juror][id]));
        }
      }
    let cursor = 0;
    const expected = castTrackAwards({ ...ep, awards: [] }, () => {
      check(cursor < draws.length, 'missing ballot tie keys');
      return draws[cursor++];
    });
    equal(ep.awards, expected, 'forged eligibility/preferences/ballots/tallies/winners');
    check(cursor === draws.length, 'extra ballot ties');
    equal(
      ep.awardHappinessBaseline,
      Object.fromEntries(ep.participantIds.map((id) => [id, ep.revealEffects[id].happinessAfter])),
      'award baseline mismatch',
    );
    equal(ep.awardEffects, trackAwardEffects(ep, true, worst), 'award products/caps mismatch');
  } else
    check(
      ep.awards.length === 0 &&
        !Object.keys(ep.awardHappinessBaseline).length &&
        !Object.keys(ep.awardEffects).length,
      'premature ballots or awards',
    );
  const locked = phases.indexOf(ep.phase) >= phases.indexOf('finale');
  if (locked) {
    check(outcome(ep.audience) && mvp(ep.mvp), 'missing audience or MVP');
    const expectedEvidence = ep.performances.flatMap((performance) =>
      performance.evaluations.map((entry) => ({
        contestantId: entry.contestantId,
        finalScore: clampBattle(entry.rawScore * ep.awardEffects[entry.contestantId].multiplier),
        observedScore: entry.rawScore,
        reception: entry.rawScore,
        category: ep.teams.find((team) => team.id === performance.teamId)!.track,
      })),
    );
    equal(ep.evidence, expectedEvidence, 'jury altered raw audience or peer evidence');
    exact(ep.exposure, ep.participantIds);
    const weights = Object.fromEntries(
      ep.participantIds.map((id) => {
        const team = ep.teams.find((entry) => entry.memberIds.includes(id))!;
        const spotlight =
          Number(team.centerId === id) +
          Number(
            ep.performances.some((performance) =>
              performance.reactions.some((reaction) => reaction.contestantId === id),
            ),
          );
        return [id, 1 / team.memberIds.length + Math.min(2, spotlight) * 0.1];
      }),
    );
    const weightTotal = Object.values(weights).reduce((sum, entry) => sum + entry, 0);
    for (const id of ep.participantIds)
      close(ep.exposure[id], weights[id] / weightTotal, 'exposure mismatch');
    exact(ep.audience.votes, ep.participantIds);
    exact(ep.audience.receptions, ep.participantIds);
    exact(ep.audience.newFans, ep.participantIds);
    exact(ep.mvp.ballots, ep.participantIds);
    const totals = Object.fromEntries(ep.participantIds.map((id) => [id, 0]));
    for (const [voter, recipient] of Object.entries(ep.mvp.ballots)) {
      check(voter !== recipient && ep.participantIds.includes(recipient), 'MVP self/invalid vote');
      totals[recipient]++;
    }
    equal(ep.mvp.totals, totals, 'MVP tally mismatch');
    const max = Math.max(...Object.values(totals));
    const tied = ep.participantIds.filter((id) => totals[id] === max);
    equal(ep.mvp.tiedIds, tied, 'MVP ties mismatch');
    check(tied.includes(ep.mvp.winnerId), 'MVP winner mismatch');
    ties(ep.rankingTieKeys, ep.participantIds);
    exact(ep.sealedRankingScores, ep.participantIds);
    const maxVotes = Math.max(...Object.values(ep.audience.votes));
    for (const entry of ep.evidence) {
      const prior = source(entry.contestantId);
      const id = entry.contestantId;
      close(ep.audience.receptions[id], entry.reception, 'raw public reception mismatch');
      close(
        ep.sealedRankingScores[id],
        0.75 * prior.aggregations.rankingScore +
          0.6 * entry.finalScore +
          0.3 * (maxVotes ? (100 * ep.audience.votes[id]) / maxVotes : 0) +
          0.1 * 50 * (clampBattle(prior.aggregations.productionRatio, -1, 1) + 1),
        'sealed ranking formula mismatch',
      );
    }
    equal(
      ep.rankedIds,
      [...ep.participantIds].sort(
        (a, b) =>
          ep.sealedRankingScores[b] - ep.sealedRankingScores[a] ||
          ep.rankingTieKeys[a] - ep.rankingTieKeys[b] ||
          a.localeCompare(b),
      ),
      'ranking order mismatch',
    );
  } else
    check(
      ep.audience === null &&
        ep.mvp === null &&
        ep.evidence.length === 0 &&
        ep.rankedIds.length === 0 &&
        !Object.keys(ep.sealedRankingScores).length &&
        !Object.keys(ep.rankingTieKeys).length &&
        !Object.keys(ep.exposure).length,
      'premature sealed outcome',
    );
  ids(ep.secretCandidates, ep.rankedIds.slice(0, 15));
  check(ep.secretCandidates.length <= 3, 'investigation shortlist exceeds three');
  const investigation = phases.indexOf(ep.phase) >= phases.indexOf('secret-choice');
  if (!investigation)
    check(ep.secretCandidates.length === 0 && ep.secret === null, 'premature investigation');
  if (ep.phase === 'secret-choice')
    check(ep.secretCandidates.length > 0 && ep.secret === null, 'missing blocking shortlist');
  if (investigation) {
    const eligible = ep.rankedIds
      .slice(0, 15)
      .filter((id) => !source(id).events.some((event) => event.startsWith('SECRET_REVEALED:')));
    const available = eligible.some((id) =>
      source(id).attributes.some((attribute) => Object.hasOwn(definitions.cards.secret, attribute)),
    );
    ids(ep.secretCandidates, eligible, available ? Math.min(3, eligible.length) : 0);
  }
  if (ep.secret !== null)
    check(
      secret(ep.secret) &&
        ep.secretCandidates.includes(ep.secret.contestantId) &&
        (ep.secret.cardId === null || Object.hasOwn(definitions.cards.secret, ep.secret.cardId)),
      'invalid secret outcome',
    );
  if (ep.secret !== null)
    equal(
      ep.secret,
      revealAuditionSecret(ep.startingContestants, ep.secret.contestantId, definitions).result,
      'forged secret card or consequences',
    );
  check(
    ep.rankRevealed === (ep.phase === 'ranking' || ep.phase === 'complete'),
    'ranking visibility mismatch',
  );
  if (ep.rankRevealed) {
    equal(ep.survivorIds, ep.rankedIds.slice(0, 15), 'survivor ranking mismatch');
    check(ep.eliminatedId === ep.rankedIds[15], 'wrong elimination');
  } else check(ep.survivorIds.length === 0 && ep.eliminatedId === null, 'premature departure');
  for (const id of ep.participantIds) {
    const entry = simulated.get(id)!;
    if (revealed) {
      entry.aggregations.happiness = ep.revealEffects[id].happinessAfter;
      entry.condition = ep.revealEffects[id].conditionAfter;
    }
    if (best) {
      entry.aggregations.happiness = clampBattle(
        ep.awardHappinessBaseline[id] + ep.awardEffects[id].happiness,
      );
      if (
        worst &&
        ep.awards.some(
          (award) =>
            award.worstId !== null &&
            (award.category === 'group'
              ? ep.teams.find((team) => team.id === award.worstId)!.memberIds.includes(id)
              : award.worstId === id),
        )
      )
        entry.condition = preserveTrackCondition(
          entry.condition,
          entry.personality.sensitivity >= 5 ? 'DEPRESSED' : 'STRESSED',
        );
    }
  }
  if (ep.secret) {
    const updated = revealAuditionSecret(
      [...simulated.values()],
      ep.secret.contestantId,
      definitions,
    ).contestants;
    updated.forEach((entry) => {
      simulated.set(entry.id, entry);
    });
  }
  for (const id of ep.participantIds) {
    const current = contestants.find((entry) => entry.id === id)!;
    const expected = simulated.get(id)!;
    close(
      current.aggregations.happiness,
      expected.aggregations.happiness,
      'live award/reveal happiness mismatch',
    );
    check(current.condition === expected.condition, 'physical or severe condition overwritten');
    equal(
      current.relationships,
      expected.relationships,
      'directed grouping/practice/intervention consequences mismatch',
    );
    check(
      current.aggregations.practice ===
        (ep.phase === 'complete' ? ep.priorPractice[id] : expected.aggregations.practice),
      'live practice mismatch',
    );
  }
}

export function validateTrackSpecials(state: SimulationState): void {
  const runtime = state.runtime;
  const ep = runtime?.trackSpecials;
  if (!ep) return;
  assertTrackSpecialsEpisode(ep, state.contestants, runtime!.definitions);
  check(runtime!.photoshoot?.phase === 'complete', 'Photoshoot not completed');
  equal(ep.previousRankedIds, runtime!.photoshoot!.rankedIds, 'Photoshoot ranking provenance');
  const oldRooms = runtime!.battle?.rooms;
  check(oldRooms, 'missing historical rooms');
  for (const id of ep.participantIds) {
    const original = oldRooms.find((room) => room.memberIds.includes(id))?.id;
    const destination = ep.rooms.find((room) => room.memberIds.includes(id))!.id;
    const move = ep.roomMoves.find((entry) => entry.contestantId === id);
    check(
      original === destination ? !move : move?.fromRoomId === original && move?.toRoomId === destination,
      'room move provenance',
    );
  }
  for (const juror of ep.juryProfiles) {
    const current = state.contestants.find((entry) => entry.id === juror.contestantId)!;
    const starting = ep.startingContestants.find((entry) => entry.id === current.id)!;
    check(
      current.rank === juror.departure.rank &&
        current.status === juror.departure.status &&
        current.aggregations.rankingScore === starting.aggregations.rankingScore &&
        current.aggregations.experience === starting.aggregations.experience,
      'guest reactivated or trained or rescored',
    );
  }
  check(
    state.contestants.filter((entry) => entry.status === 'ACTIVE').length === (ep.rankRevealed ? 15 : 16),
    'active population mismatch',
  );
  for (const id of ep.participantIds) {
    const current = state.contestants.find((entry) => entry.id === id)!;
    const starting = ep.startingContestants.find((entry) => entry.id === id)!;
    check(
      current.status === (id === ep.eliminatedId ? 'ELIMINATED' : 'ACTIVE') &&
        current.rank === (ep.rankRevealed ? ep.rankedIds.indexOf(id) + 1 : starting.rank),
      'live status or placement mismatch',
    );
    close(
      current.aggregations.rankingScore,
      ep.rankRevealed ? ep.sealedRankingScores[id] : starting.aggregations.rankingScore,
      'sealed points leaked or changed',
    );
    const team = ep.teams.find((entry) => entry.memberIds.includes(id));
    check(
      current.aggregations.leader === starting.aggregations.leader + Number(team?.captainId === id),
      'leader counter mismatch',
    );
    check(
      current.aggregations.center === starting.aggregations.center + Number(team?.centerId === id),
      'center counter mismatch',
    );
    check(
      current.aggregations.mvp === starting.aggregations.mvp + Number(ep.mvp?.winnerId === id),
      'MVP counter mismatch',
    );
    if (ep.phase === 'complete')
      check(current.aggregations.practice === ep.priorPractice[id], 'practice was not restored');
  }
  check(
    new Set(state.contestants.map((entry) => entry.rank)).size === 50,
    'season placements no longer unique',
  );
}
