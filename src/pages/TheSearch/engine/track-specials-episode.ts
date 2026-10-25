import type { EpisodeScene } from '../types/audition-episode';
import type { Contestant, UtilitySkills } from '../types/contestant';
import type { SimulationState } from '../types/simulation';
import type {
  TrackSpecialSong,
  TrackSpecialsAction,
  TrackSpecialsEpisode,
  TrackSpecialsPhase,
  TrackSpecialTeam,
} from '../types/track-specials-episode';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { validateTrackSpecialSongs } from '../utilities/track-special-songs';
import { awardNewActivity, recordSceneTV } from './activity-awards';
import {
  chooseEvidenceMvp,
  resolveNarrativeEvidenceAudience,
  transferEliminatedFans,
} from './audition-audience';
import { auditionMinimumFace, rollAuditionDice } from './audition-scoring';
import { revealAuditionSecret } from './audition-secrets';
import { battleCheck, battleRelationship, changeBattleRelationship, clampBattle } from './battle-scoring';
import { appendContestantHistory, recordContestantChanges } from './change-history';
import { applyPreparation, initializePreparation, playOpening } from './episode-preparation';
import { createSeededRandom, type RandomSource, shuffleWithRandom } from './random';
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
import { assertTrackSpecialsEpisode, validateTrackSpecials } from './track-specials-validation';

export { assertTrackSpecialsEpisode, validateTrackSpecials } from './track-specials-validation';

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const mention = (id: string) => `[[contestant:${id}]]`;
const host = { name: 'Mike Philip', role: 'Host' };
const episode = (state: SimulationState) => {
  const ep = state.runtime?.trackSpecials;
  if (!ep) throw new Error('Start Track Specials first.');
  return ep;
};
const person = (state: SimulationState, id: string) => {
  const entry = state.contestants.find((contestant) => contestant.id === id);
  if (!entry) throw new Error(`Unknown Track Specials contestant "${id}".`);
  return entry;
};
const songFor = (state: SimulationState, team: TrackSpecialTeam) => {
  const song = state.runtime!.definitions.trackSpecialSongs!.find((entry) => entry.id === team.songId);
  if (!song) throw new Error('Missing frozen track song.');
  return song;
};

function append(
  state: SimulationState,
  phase: TrackSpecialsPhase,
  sequence: number,
  title: string,
  paragraphs: string[],
  ids: string[] = [],
  tier: 0 | 1 | 3 | 6 = 1,
) {
  const ep = episode(state);
  const references: string[][] = [];
  const plain = paragraphs.map((paragraph) => {
    const refs: string[] = [];
    const text = paragraph.replace(/\[\[contestant:([^\]]+)\]\]/g, (_, id: string) => {
      refs.push(id);
      return person(state, id).name;
    });
    references.push(refs);
    return text;
  });
  const kind: EpisodeScene['kind'] =
    phase === 're-lodging'
      ? 'dorms'
      : phase === 'credits'
        ? 'opening'
        : phase === 'practice' || phase === 'intervention'
          ? 'practice'
          : phase === 'performances'
            ? 'battles'
            : phase === 'ranking'
              ? 'ranking'
              : phase === 'secret-choice' || phase === 'secret-result'
                ? 'secret'
                : phase === 'finale'
                  ? 'mvp'
                  : 'recap';
  ep.phase = phase;
  ep.scenes.push(
    recordSceneTV(
      {
        id: `track-specials-${ep.scenes.length}`,
        sequence,
        kind,
        title,
        paragraphs: plain,
        contestantIds: [...new Set(ids)],
        paragraphContestantIds: references,
        presentation: phase === 'credits' ? 'credits' : phase === 'performances' ? 'performance' : 'host',
        ...(phase !== 'credits' && phase !== 'performances' ? { speaker: host } : {}),
      },
      tier,
    ),
  );
  for (const id of ids) if (ep.participantIds.includes(id)) person(state, id).aggregations.screenTime++;
}

/** Retain whole surviving roommate blocks whenever possible, minimizing actual moves. */
export function consolidateTrackRooms(
  oldRooms: readonly { id: string; memberIds: string[] }[],
  participantIds: readonly string[],
) {
  const blocks = oldRooms.map((room) => ({
    id: room.id,
    memberIds: room.memberIds.filter((id) => participantIds.includes(id)),
  }));
  const identities = [...blocks]
    .sort((a, b) => b.memberIds.length - a.memberIds.length || a.id.localeCompare(b.id))
    .slice(0, 3);
  if (
    identities.length !== 3 ||
    new Set(blocks.flatMap((room) => room.memberIds)).size !== 16 ||
    blocks.flatMap((room) => room.memberIds).length !== 16
  )
    throw new Error('Missing original sixteen-person room history.');
  const ordered = [...blocks].sort(
    (a, b) => b.memberIds.length - a.memberIds.length || a.id.localeCompare(b.id),
  );
  const capacities = [6, 6, 4];
  let best: string[][] | null = null;
  let bestMoves = Number.POSITIVE_INFINITY;
  const packingMemo = new Map<string, number>();
  function pack(index: number, groups: string[][]) {
    const moves = groups.reduce(
      (sum, members, room) => sum + members.filter((id) => !identities[room].memberIds.includes(id)).length,
      0,
    );
    const key = `${index}:${groups.map((members) => members.length).join(',')}`;
    if ((packingMemo.get(key) ?? Number.POSITIVE_INFINITY) <= moves) return;
    packingMemo.set(key, moves);
    if (index === ordered.length) {
      if (moves < bestMoves) {
        bestMoves = moves;
        best = groups.map((members) => [...members]);
      }
      return;
    }
    const block = ordered[index].memberIds;
    if (!block.length) {
      pack(index + 1, groups);
      return;
    }
    for (let room = 0; room < 3; room++) {
      if (groups[room].length + block.length > capacities[room]) continue;
      groups[room].push(...block);
      pack(index + 1, groups);
      groups[room].splice(groups[room].length - block.length);
    }
  }
  pack(0, [[], [], []]);
  if (!best) {
    // An indivisible packing can be impossible (for example three blocks of five).
    // Split the smallest necessary number of blocks, preserving the others.
    const candidates = ordered.filter((block) => block.memberIds.length > 1);
    for (let splits = 1; splits <= candidates.length && !best; splits++) {
      function split(start: number, selected: Set<string>) {
        if (selected.size === splits) {
          const original = [...ordered];
          ordered.splice(
            0,
            ordered.length,
            ...original.flatMap((block) =>
              selected.has(block.id)
                ? block.memberIds.map((id) => ({ id: block.id, memberIds: [id] }))
                : [block],
            ),
          );
          packingMemo.clear();
          pack(0, [[], [], []]);
          ordered.splice(0, ordered.length, ...original);
          return;
        }
        for (let index = start; index < candidates.length; index++) {
          selected.add(candidates[index].id);
          split(index + 1, selected);
          selected.delete(candidates[index].id);
        }
      }
      split(0, new Set());
    }
  }
  if (!best) throw new Error('Cannot consolidate the dorms.');
  const packed: string[][] = best;
  const rooms = identities.map((room, index) => ({ id: room.id, memberIds: packed[index] }));
  return {
    rooms,
    roomMoves: rooms.flatMap((room) =>
      room.memberIds
        .filter((id) => !oldRooms.find((old) => old.id === room.id)?.memberIds.includes(id))
        .map((contestantId) => ({
          contestantId,
          fromRoomId: oldRooms.find((old) => old.memberIds.includes(contestantId))?.id ?? null,
          toRoomId: room.id,
        })),
    ),
    closedRoomIds: oldRooms
      .filter((room) => !identities.some((identity) => identity.id === room.id))
      .map((room) => room.id),
  };
}

function start(state: SimulationState) {
  const runtime = state.runtime!;
  const previous = runtime.photoshoot!;
  const ids = [...previous.survivorIds];
  const active = state.contestants.filter((entry) => entry.status === 'ACTIVE');
  if (
    ids.length !== 16 ||
    new Set(ids).size !== 16 ||
    active.length !== 16 ||
    active.some((entry) => !ids.includes(entry.id))
  )
    throw new Error('Track Specials requires the sixteen Photoshoot survivors.');
  validateTrackSpecialSongs(runtime.definitions.trackSpecialSongs);
  const juryProfiles = frozenTrackJurors(state.contestants, ids);
  const dorms = consolidateTrackRooms(runtime.battle!.rooms, ids);
  runtime.trackSpecials = {
    version: 1,
    phase: 're-lodging',
    revision: 0,
    lastAction: { revision: 0, action: { type: 'start' } },
    participantIds: ids,
    startingContestants: structuredClone(state.contestants),
    previousRankedIds: [...previous.rankedIds],
    ...dorms,
    teams: [],
    grouping: [],
    frozenRelationships: Object.fromEntries(
      state.contestants.map((entry) => [
        entry.id,
        Object.fromEntries(ids.map((id) => [id, battleRelationship(entry, id)])),
      ]),
    ),
    frozenTraits: Object.fromEntries(
      state.contestants.map((entry) => [entry.id, structuredClone(entry.personality)]),
    ),
    priorPractice: Object.fromEntries(ids.map((id) => [id, person(state, id).aggregations.practice])),
    teamCursor: 0,
    practiceCursor: 0,
    performanceOrder: [],
    performances: [],
    conflict: null,
    juryIds: juryProfiles.map((entry) => entry.contestantId),
    juryProfiles,
    juryRevealed: false,
    revealEffects: {},
    awards: [],
    bestAnnounced: false,
    worstAnnounced: false,
    awardHappinessBaseline: {},
    awardEffects: {},
    evidence: [],
    exposure: {},
    audience: null,
    mvp: null,
    sealedRankingScores: {},
    rankingTieKeys: {},
    secretCandidates: [],
    secret: null,
    rankedIds: [],
    survivorIds: [],
    eliminatedId: null,
    rankRevealed: false,
    scenes: [],
    changes: {},
  };
  runtime.episode = 6;
  runtime.phase = 'track-specials';
  const lines = [
    `The remaining contestants move into three six-bed dorms. Closed rooms: ${dorms.closedRoomIds.join(', ') || 'none'}.`,
    ...dorms.rooms.map(
      (room) => `${room.id}: ${room.memberIds.map(mention).join(', ')} (${room.memberIds.length}/6 beds).`,
    ),
    ...dorms.roomMoves.map(
      (move) => `${mention(move.contestantId)} moves from ${move.fromRoomId} to ${move.toRoomId}.`,
    ),
  ];
  for (const id of ids) {
    const entry = person(state, id);
    entry.aggregations.practice = 0;
    const delta = entry.personality.extroversion > 5 ? 3 : entry.personality.extroversion < -5 ? -3 : 0;
    entry.aggregations.happiness = clampBattle(entry.aggregations.happiness + delta);
    lines.push(
      `${mention(id)} ${delta > 0 ? 'welcomes the busier room' : delta < 0 ? 'finds the move unsettling' : 'settles in without an automatic change of mood'}.`,
    );
  }
  append(state, 're-lodging', 1, 'Three dorms, sixteen performers', lines, ids);
}

function group(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  for (const track of ['VOCAL', 'RAP', 'DANCE'] as const) {
    const ids = ep.participantIds.filter((id) => person(state, id).track === track);
    const keys = trackGroupingTieKeys(ids, random);
    const result = optimalTrackGroups(ids, ep.frozenRelationships, keys);
    ep.grouping.push({ track, sizes: trackGroupSizes(ids.length), affinity: result.affinity, tieKeys: keys });
    for (const members of result.groups)
      ep.teams.push({
        id: `track-${track.toLowerCase()}-${ep.teams.length + 1}`,
        name: `${track} ${ep.teams.filter((team) => team.track === track).length + 1}`,
        track,
        memberIds: members,
        captainId: '',
        centerId: null,
        songId: null,
        centerBallots: {},
        partAssignments: {},
        partReactions: {},
        coordination: 0,
        practice: [],
        affinity: trackAffinity(members, ep.frozenRelationships),
        groupingTieKey: keys[[...members].sort().join('|')],
        songPreferences: {},
        leaderElection: null,
        centerElection: null,
        partTieKeys: {},
        intervention: null,
      });
  }
  for (const team of ep.teams)
    for (const id of team.memberIds) {
      person(state, id).aggregations.happiness = clampBattle(person(state, id).aggregations.happiness + 3);
      for (const other of team.memberIds)
        if (other !== id) changeBattleRelationship(person(state, id), other, 2);
    }
  const tracks = shuffleWithRandom(
    (['VOCAL', 'RAP', 'DANCE'] as const).filter((track) => ep.teams.some((team) => team.track === track)),
    random,
  );
  const queues = tracks.map((track) =>
    shuffleWithRandom(
      ep.teams.filter((team) => team.track === track),
      random,
    ),
  );
  while (queues.some((queue) => queue.length))
    for (const queue of queues) {
      const team = queue.shift();
      if (team) ep.performanceOrder.push(team.id);
    }
  append(
    state,
    'grouping',
    3,
    'Track Specials: the affinity groups',
    [
      '"You will perform within your primary track. Each real group, duo or solo has its own arrangement."',
      ...(['VOCAL', 'RAP', 'DANCE'] as const).map(
        (track) =>
          `${track}: ${
            ep.participantIds
              .filter((id) => person(state, id).track === track)
              .map(mention)
              .join(', ') || 'no performers'
          }.`,
      ),
      ...ep.teams.map((team) => {
        const pairs = (team.memberIds.length * (team.memberIds.length - 1)) / 2;
        return `${team.name}: ${team.memberIds.map(mention).join(', ')}. ${
          pairs
            ? team.affinity / pairs >= 60
              ? 'Their existing mutual affection supports the grouping.'
              : 'This is the strongest available affinity partition, not a promise of close friendship.'
            : 'A solo receives the same welcome without invented teammates.'
        }`;
      }),
    ],
    ep.participantIds,
  );
}

function prepareTeam(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const team = ep.teams[ep.teamCursor];
  const members = team.memberIds.map((id) => person(state, id));
  const available = state.runtime!.definitions.trackSpecialSongs!.filter(
    (song) => song.track === team.track && !ep.teams.some((other) => other.songId === song.id),
  );
  team.songPreferences = Object.fromEntries(
    available.map((song) => [
      song.id,
      {
        specialty:
          members.filter((entry) =>
            song.favoredSpecialties.includes(entry.specialties[trackSpecialty(team.track)]),
          ).length / members.length,
        genre:
          members.filter((entry) => entry.specialties.genreAffinity === song.genre).length / members.length,
        tieKey: random(),
      },
    ]),
  );
  const song = [...available].sort((a, b) => {
    const first = team.songPreferences[a.id];
    const second = team.songPreferences[b.id];
    return (
      second.specialty - first.specialty ||
      second.genre - first.genre ||
      first.tieKey - second.tieKey ||
      a.id.localeCompare(b.id)
    );
  })[0];
  if (!song) throw new Error('Not enough unused songs for this primary track.');
  team.songId = song.id;
  team.leaderElection = electTrackRole(
    members,
    'leader',
    Object.fromEntries(team.memberIds.map((id) => [id, random()])),
  );
  team.captainId = team.leaderElection.winnerId;
  person(state, team.captainId).aggregations.leader++;
  team.partTieKeys = Object.fromEntries(team.memberIds.map((id) => [id, random()]));
  const abilityOrder = [...members].sort(
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
  abilityOrder.forEach((entry, index) => {
    team.partAssignments[entry.id] = parts[index].id;
    team.partReactions[entry.id] = 'neutral';
  });
  ep.practiceCursor = 0;
  append(
    state,
    'practice',
    4,
    `${team.name}: song, parts and leader`,
    [
      `${song.title}: ${song.description}`,
      `${mention(team.captainId)} ${team.leaderElection.appointed ? 'is appointed as the sole performer' : 'wins the leadership vote'}.`,
      ...Object.entries(team.leaderElection.ballots).map(
        ([voter, candidate]) => `${mention(voter)} votes for ${mention(candidate)} as leader.`,
      ),
      ...members.map(
        (entry) =>
          `${mention(entry.id)} takes ${parts.find((part) => part.id === team.partAssignments[entry.id])!.name}.`,
      ),
    ],
    team.memberIds,
  );
}

function practice(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const team = ep.teams[ep.teamCursor];
  const song = songFor(state, team);
  const session = team.practice.length;
  const skills: (keyof UtilitySkills)[] =
    session === 0 ? ['learning', 'memory', 'consistency'] : ['stamina', 'consistency', 'memory'];
  const leader = person(state, team.captainId);
  const leaderDice = rollAuditionDice(random);
  const difficulty = 3;
  const leadershipCheck = battleCheck('leadership', leader.coreSkills.leadership, difficulty, leaderDice);
  const leadershipSuccess = leadershipCheck.adjustedDice[0] + leadershipCheck.adjustedDice[1] >= 8;
  const coordinationBefore = team.coordination;
  const coordinationChange = leadershipSuccess ? 1 : -1;
  team.coordination = clampBattle(team.coordination + coordinationChange, -5, 5);
  const records = team.memberIds.map((id) => {
    const entry = person(state, id);
    const rawDice = rollAuditionDice(random);
    const checks = skills.map((skill, index) => ({
      skill,
      skillLevel: entry.utilitySkills[skill],
      requiredLevel: difficulty as 3,
      floor: auditionMinimumFace(entry.utilitySkills[skill], difficulty),
      weight: index ? 1 : 2,
      adjustedDice: battleCheck(skill, entry.utilitySkills[skill], difficulty, rawDice).adjustedDice,
    }));
    const weightedSum =
      checks.reduce((sum, check) => sum + (check.adjustedDice[0] + check.adjustedDice[1]) * check.weight, 0) /
      4;
    const practiceBefore = entry.aggregations.practice;
    const sessionPractice = Math.min(5, Math.floor(weightedSum / 2));
    const practiceAfter = Math.max(practiceBefore, sessionPractice);
    entry.aggregations.practice = practiceAfter;
    if (id !== leader.id) {
      const strained = battleRelationship(entry, leader.id) < 40 || entry.personality.gentleness < -3;
      changeBattleRelationship(entry, leader.id, leadershipSuccess ? 1 : strained ? -2 : -1);
    }
    return {
      contestantId: id,
      rawDice,
      checks,
      practiceBefore,
      practiceAfter,
      weightedSum,
      sessionPractice,
      improved: practiceAfter > practiceBefore,
    };
  });
  const title = session === 0 ? 'Part learning' : 'Full rehearsal';
  team.practice.push({
    session: session + 1,
    title,
    leaderDice,
    leadershipCheck: { ...leadershipCheck, successThreshold: 8 },
    leadershipSuccess,
    coordinationChange,
    coordinationBefore,
    coordinationAfter: team.coordination,
    contestants: records,
  });
  ep.practiceCursor = session + 1;
  append(
    state,
    'practice',
    4,
    `${team.name}: ${title}`,
    [
      `${song.title}: ${mention(leader.id)} ${leadershipSuccess ? 'gives clear guidance that tightens the coordination' : 'struggles to organize the run; the transitions remain uneven'}.`,
      ...records.map(
        (record) =>
          `${mention(record.contestantId)} ${record.improved ? 'improves during this session' : 'works through the session without improving the earlier preparation'}.`,
      ),
    ],
    team.memberIds,
  );
}

function centerOrConflict(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const team = ep.teams[ep.teamCursor];
  const leader = person(state, team.captainId);
  const trouble = team.memberIds
    .filter((id) => id !== leader.id)
    .find((id) => {
      const entry = person(state, id);
      const stalled = team.practice.some(
        (session) => !session.contestants.find((record) => record.contestantId === id)!.improved,
      );
      return (
        (leader.personality.discipline >= 5 &&
          entry.personality.discipline <= -3 &&
          leader.personality.discipline - entry.personality.discipline >= 10 &&
          stalled) ||
        (battleRelationship(leader, id) < 35 && battleRelationship(entry, leader.id) < 35 && stalled)
      );
    });
  if (trouble && !team.intervention) {
    const description = `${leader.name} asks ${person(state, trouble).name} to repeat the stalled rehearsal passage; ${person(state, trouble).name} resists the approach. Their disagreement interrupts this group's work.`;
    team.intervention = { contestantIds: [leader.id, trouble], description, choice: null };
    ep.conflict = { teamId: team.id, contestantIds: [leader.id, trouble], description };
    changeBattleRelationship(leader, trouble, -2);
    changeBattleRelationship(person(state, trouble), leader.id, -2);
    append(
      state,
      'intervention',
      4,
      `${team.name}: a specific rehearsal dispute`,
      [description, 'Production must support, mediate or push before rehearsal can continue.'],
      [leader.id, trouble],
      3,
    );
    return;
  }
  team.centerElection = electTrackRole(
    team.memberIds.map((id) => person(state, id)),
    'center',
    Object.fromEntries(team.memberIds.map((id) => [id, random()])),
  );
  team.centerId = team.centerElection.winnerId;
  team.centerBallots = { ...team.centerElection.ballots };
  person(state, team.centerId).aggregations.center++;
  append(
    state,
    'practice',
    4,
    `${team.name}: the center`,
    [
      ...Object.entries(team.centerBallots).map(
        ([voter, candidate]) => `${mention(voter)} votes for ${mention(candidate)} as center.`,
      ),
      `${mention(team.centerId)} ${team.centerElection.appointed ? 'takes the solo spotlight' : 'wins the affection-heavy center election'}.`,
    ],
    team.memberIds,
  );
}

function revealJury(state: SimulationState) {
  const ep = episode(state);
  ep.juryRevealed = true;
  ep.revealEffects = Object.fromEntries(
    ep.participantIds.map((id) => [id, trackRevealReaction(person(state, id))]),
  );
  for (const id of ep.participantIds) {
    person(state, id).aggregations.happiness = ep.revealEffects[id].happinessAfter;
    person(state, id).condition = ep.revealEffects[id].conditionAfter;
  }
  append(
    state,
    'jury-reveal',
    5,
    'The returning jury',
    [
      '"All thirty-four departed contestants are back as guests, including the contestant who chose to withdraw. Tonight, they alone will judge your performances and cast the deciding votes."',
      ...ep.juryIds.map(
        (id) =>
          `${mention(id)} returns from season position ${ep.juryProfiles.find((profile) => profile.contestantId === id)!.departure.rank}.`,
      ),
      ...ep.participantIds.map((id) => ep.revealEffects[id].description),
      '"John, Megan and Michael will observe the performances. Their comments carry no scoring bonus."',
    ],
    [...ep.juryIds, ...ep.participantIds],
    3,
  );
}

function perform(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const team = ep.teams.find((entry) => entry.id === ep.performanceOrder[ep.performances.length])!;
  const song = songFor(state, team);
  const evaluations = team.memberIds.map((id) =>
    trackSpecialScore(
      person(state, id),
      team,
      song,
      rollAuditionDice(random),
      ep.revealEffects[id].readiness,
    ),
  );
  const meanScore = mean(evaluations.map((entry) => entry.rawScore));
  const comments = (['john', 'megan', 'michael'] as const).map((judgeId) => ({
    judgeId,
    description: `${{ john: 'John', megan: 'Megan', michael: 'Michael' }[judgeId]}: "${
      judgeId === 'john'
        ? meanScore >= 70
          ? 'The track work is secure and the transitions land.'
          : 'Some technical details and transitions still need attention.'
        : judgeId === 'megan'
          ? mean(evaluations.map((entry) => entry.uniquenessCheck.score)) >= 70
            ? 'I can see a distinctive identity in these performances.'
            : 'I want more individual character in the choices.'
          : mean(evaluations.map((entry) => entry.visualCheck.score)) >= 70
            ? 'The camera catches a convincing image.'
            : 'The camera connection is not yet consistent.'
    }"`,
  }));
  const candidates = ep.juryProfiles
    .flatMap((juror) =>
      team.memberIds.map((id) => ({
        jurorId: juror.contestantId,
        contestantId: id,
        relationship: juror.relationships[id],
        profile: juror.profile,
      })),
    )
    .sort(
      (a, b) =>
        Math.abs(b.relationship - 50) - Math.abs(a.relationship - 50) || a.jurorId.localeCompare(b.jurorId),
    );
  const reactions: { jurorId: string; contestantId: string; relationship: number; description: string }[] =
    [];
  const profiles = new Set<string>();
  for (const candidate of candidates) {
    if (reactions.some((reaction) => reaction.jurorId === candidate.jurorId)) continue;
    if (profiles.has(candidate.profile) && candidates.some((other) => !profiles.has(other.profile))) continue;
    profiles.add(candidate.profile);
    const result = evaluations.find((entry) => entry.contestantId === candidate.contestantId)!;
    reactions.push({
      jurorId: candidate.jurorId,
      contestantId: candidate.contestantId,
      relationship: candidate.relationship,
      description: `${person(state, candidate.jurorId).name} ${candidate.relationship >= 65 ? 'watches a close former companion with obvious interest' : candidate.relationship <= 35 ? 'watches someone with whom the bond was strained' : 'studies the performance without a clearly close or strained bond'} as ${person(state, candidate.contestantId).name} ${result.rawScore >= 70 ? 'lands the assigned passage' : 'works through an uneven passage'}. This is a reaction, not a final vote.`,
    });
    if (reactions.length === 3) break;
  }
  ep.performances.push({
    teamId: team.id,
    evaluations,
    meanScore,
    finalScore: meanScore,
    comments,
    reactions,
  });
  append(
    state,
    'performances',
    6,
    `${team.name}: ${song.title}`,
    [
      ...evaluations.map((entry) => entry.description),
      ...comments.map((comment) => comment.description),
      ...reactions.map((reaction) => reaction.description),
    ],
    [...team.memberIds, ...reactions.map((reaction) => reaction.jurorId)],
    3,
  );
}

function announceAwards(state: SimulationState, best: boolean, random: RandomSource) {
  const ep = episode(state);
  if (best) {
    ep.awards = castTrackAwards(ep, random);
    ep.awardHappinessBaseline = Object.fromEntries(
      ep.participantIds.map((id) => [id, person(state, id).aggregations.happiness]),
    );
    ep.bestAnnounced = true;
  } else ep.worstAnnounced = true;
  ep.awardEffects = trackAwardEffects(ep, true, !best);
  const lines: string[] = [];
  for (const award of ep.awards) {
    const recipient = best ? award.bestId : award.worstId;
    if (!recipient) {
      lines.push(
        `${award.category}: ${award.status === 'not-contested' ? 'not contested; no eligible primary-track performer' : 'no Worst; the single eligible recipient has an uncontested Best'}.`,
      );
      continue;
    }
    const team = award.category === 'group' ? ep.teams.find((entry) => entry.id === recipient)! : null;
    const members = team ? team.memberIds : [recipient];
    const totals = best ? award.bestTotals : award.worstTotals;
    lines.push(
      `${best ? 'Best' : 'Worst'} ${award.category}: ${team ? team.name : mention(recipient)}${award.status === 'uncontested' ? ' (uncontested)' : ` with ${totals[recipient]} jury votes`}.`,
    );
    for (const id of members) {
      const entry = person(state, id);
      if (!best)
        entry.condition = preserveTrackCondition(
          entry.condition,
          entry.personality.sensitivity >= 5 ? 'DEPRESSED' : 'STRESSED',
        );
      lines.push(
        `${mention(id)} ${
          best
            ? entry.personality.extroversion >= 5
              ? 'thanks the room with an excited smile'
              : 'quietly accepts the recognition'
            : entry.personality.resilience >= 5
              ? 'absorbs the criticism and resolves to work'
              : 'looks shaken by the announcement'
        }.`,
      );
    }
  }
  for (const id of ep.participantIds)
    person(state, id).aggregations.happiness = clampBattle(
      ep.awardHappinessBaseline[id] + ep.awardEffects[id].happiness,
    );
  append(
    state,
    best ? 'awards-best' : 'awards-worst',
    7,
    best ? 'The jury: Best awards' : 'The jury: Worst awards',
    [
      ...(best
        ? [
            'Every performance has now been seen. The viewer may inspect all final private jury ballots in Details; contestants hear only the announced totals.',
          ]
        : []),
      ...lines,
    ],
    ep.participantIds,
    3,
  );
}

function finale(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  ep.evidence = ep.performances.flatMap((performance) =>
    performance.evaluations.map((entry) => ({
      contestantId: entry.contestantId,
      finalScore: clampBattle(entry.rawScore * ep.awardEffects[entry.contestantId].multiplier),
      observedScore: entry.rawScore,
      reception: entry.rawScore,
      category: ep.teams.find((team) => team.id === performance.teamId)!.track,
    })),
  );
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
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  ep.exposure = Object.fromEntries(ep.participantIds.map((id) => [id, weights[id] / total]));
  ep.mvp = chooseEvidenceMvp(
    ep.participantIds.map((id) => person(state, id)),
    ep.evidence,
    ep.participantIds,
    random,
    16,
  );
  person(state, ep.mvp.winnerId).aggregations.mvp++;
  const result = resolveNarrativeEvidenceAudience({
    contestants: ep.participantIds.map((id) => person(state, id)),
    evidence: ep.evidence,
    exposure: ep.exposure,
    mood: state.runtime!.preparations![6]!.mood!,
    show: state.runtime!.show,
    random,
  });
  ep.audience = result.outcome;
  state.runtime!.show = result.show;
  ep.rankingTieKeys = Object.fromEntries(ep.participantIds.map((id) => [id, random()]));
  ep.sealedRankingScores = Object.fromEntries(
    result.contestants.map((entry) => [entry.id, entry.aggregations.rankingScore]),
  );
  ep.rankedIds = [...result.contestants]
    .sort(
      (a, b) =>
        b.aggregations.rankingScore - a.aggregations.rankingScore ||
        ep.rankingTieKeys[a.id] - ep.rankingTieKeys[b.id] ||
        a.id.localeCompare(b.id),
    )
    .map((entry) => entry.id);
  for (const entry of result.contestants) {
    const original = person(state, entry.id);
    entry.rank = original.rank;
    entry.aggregations.rankingScore = original.aggregations.rankingScore;
  }
  const byId = new Map(result.contestants.map((entry) => [entry.id, entry]));
  state.contestants = state.contestants.map((entry) => byId.get(entry.id) ?? entry);
  append(
    state,
    'finale',
    8,
    'The private peer MVP and sealed standings',
    [
      'All sixteen privately vote, without self-votes, from the raw performances and their existing bonds. The jury multipliers do not enter these ballots.',
      ...Object.entries(ep.mvp.ballots).map(
        ([voter, recipient]) => `${mention(voter)} votes for ${mention(recipient)}.`,
      ),
      `${mention(ep.mvp.winnerId)} is peer MVP with ${ep.mvp.totals[ep.mvp.winnerId]} votes. The cumulative ranking is now sealed.`,
    ],
    [ep.mvp.winnerId],
    3,
  );
}

function investigate(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const eligible = ep.rankedIds
    .slice(0, 15)
    .filter((id) => !person(state, id).events.some((event) => event.startsWith('SECRET_REVEALED:')));
  const available = eligible.some((id) =>
    person(state, id).attributes.some((attribute) =>
      Object.hasOwn(state.runtime!.definitions.cards.secret, attribute),
    ),
  );
  ep.secretCandidates = available ? shuffleWithRandom(eligible, random).slice(0, 3) : [];
  append(
    state,
    ep.secretCandidates.length ? 'secret-choice' : 'secret-result',
    8,
    ep.secretCandidates.length ? 'The investigation shortlist' : 'The investigation desk is closed',
    ep.secretCandidates.length
      ? [
          'The ranking is sealed. Production may investigate one eligible continuing performer; a miss changes nothing.',
          ...ep.secretCandidates.map(mention),
          ...(ep.secretCandidates.length < 3
            ? ['Fewer than three eligible names remain; all are offered.']
            : []),
        ]
      : ['No eligible unrevealed secret remains. The sealed ranking is unchanged.'],
    ep.secretCandidates,
    0,
  );
}

function rank(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  ep.rankRevealed = true;
  ep.survivorIds = ep.rankedIds.slice(0, 15);
  ep.eliminatedId = ep.rankedIds[15];
  const lines = ep.rankedIds.map((id, index) => {
    const entry = person(state, id);
    const prior = ep.previousRankedIds.indexOf(id) + 1;
    const movement = prior - index - 1;
    entry.rank = index + 1;
    entry.aggregations.rankingScore = ep.sealedRankingScores[id];
    const performance = ep.performances
      .flatMap((item) => item.evaluations)
      .find((item) => item.contestantId === id)!;
    entry.grade = performance.grade;
    entry.missionRating = { A: 5, B: 4, C: 3, D: 2, F: 1 }[performance.grade];
    if (index === 15) {
      entry.status = 'ELIMINATED';
      entry.events.push('TRACK_SPECIALS_ELIMINATED');
    }
    return `${index + 1}. ${mention(id)} ${movement > 0 ? `↑ rises from ${prior}` : movement < 0 ? `↓ falls from ${prior}` : `holds ${prior}`}.${
      index === 15
        ? ' Sixteenth place means elimination; there are no saves.'
        : ' Continues to the next episode.'
    }`;
  });
  const reactions = ep.rankedIds
    .map((id, index) => ({
      id,
      movement: ep.previousRankedIds.indexOf(id) - index,
    }))
    .filter(({ id, movement }) => id !== ep.eliminatedId && Math.abs(movement) >= 3)
    .sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement) || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map(({ id, movement }) => {
      const traits = person(state, id).personality;
      const reaction =
        movement > 0
          ? traits.ambition >= 5
            ? 'keeps the celebration brief, already looking toward an even higher place.'
            : traits.sensitivity >= 5
              ? 'cannot hide the emotion as the size of the climb sinks in.'
              : 'lets out a relieved laugh at the unexpected climb.'
          : traits.resilience >= 5 || traits.ambition >= 5
            ? 'steadies their expression and resolves to fight back after the drop.'
            : traits.sensitivity >= 5
              ? 'looks shaken by the drop and struggles to hold back tears.'
              : 'goes quiet, taking a moment to absorb the fall.';
      return `${mention(id)} ${reaction}`;
    });
  state.runtime!.show = transferEliminatedFans(
    state.runtime!.show,
    state.contestants,
    ep.survivorIds,
    random,
  );
  append(state, 'ranking', 8, 'The sixteen-person ranking', [...lines, ...reactions], ep.rankedIds, 3);
}

function advance(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  switch (ep.phase) {
    case 're-lodging':
      playOpening(state, 6);
      append(
        state,
        'credits',
        2,
        'Opening credits',
        ['The confirmed portraits and opening song introduce the sixteen remaining performers.'],
        state.runtime!.openingCast,
      );
      break;
    case 'credits':
      group(state, random);
      break;
    case 'grouping':
      prepareTeam(state, random);
      break;
    case 'practice': {
      const team = ep.teams[ep.teamCursor];
      if (team.practice.length < 2) practice(state, random);
      else if (!team.centerId) centerOrConflict(state, random);
      else if (ep.teamCursor + 1 < ep.teams.length) {
        ep.teamCursor++;
        prepareTeam(state, random);
      } else revealJury(state);
      break;
    }
    case 'jury-reveal':
      perform(state, random);
      break;
    case 'performances':
      if (ep.performances.length < ep.teams.length) perform(state, random);
      else announceAwards(state, true, random);
      break;
    case 'awards-best':
      announceAwards(state, false, random);
      break;
    case 'awards-worst':
      finale(state, random);
      break;
    case 'finale':
      investigate(state, random);
      break;
    case 'secret-result':
      rank(state, random);
      break;
    case 'ranking': {
      const departed = person(state, ep.eliminatedId!);
      const companions = ep.survivorIds
        .slice()
        .sort(
          (a, b) => battleRelationship(departed, b) - battleRelationship(departed, a) || a.localeCompare(b),
        )
        .slice(0, 2);
      for (const id of ep.participantIds) person(state, id).aggregations.practice = ep.priorPractice[id];
      append(
        state,
        'complete',
        8,
        'Fifteen continue',
        [
          `${mention(departed.id)} says goodbye from sixteenth place.`,
          ...companions.map(
            (id) =>
              `${mention(id)} ${battleRelationship(departed, id) >= 60 ? 'shares a warm farewell with a close companion' : 'offers a respectful goodbye without pretending to a closeness they never had'}.`,
          ),
          'Fifteen remain. Episode 7 is next; no further challenge has begun.',
        ],
        [departed.id, ...companions],
        3,
      );
      state.runtime!.phase = 'episode-complete';
      break;
    }
    default:
      throw new Error('Resolve the available Track Specials production choice first.');
  }
}

function capture(state: SimulationState, before: Contestant[], cause: string, oldSceneId?: string) {
  const ep = episode(state);
  const scene = ep.scenes.at(-1);
  for (const id of ep.participantIds) {
    const changes = recordContestantChanges(
      before.find((entry) => entry.id === id)!,
      person(state, id),
      cause,
    );
    ep.changes[id] ??= [];
    ep.changes[id].push(...changes);
    if (scene && scene.id !== oldSceneId && changes.length) {
      scene.contestantChanges ??= {};
      scene.contestantChanges[id] = structuredClone(changes);
    }
  }
}
function finalize(state: SimulationState, random: ReturnType<typeof createSeededRandom>) {
  state.runtime!.randomState = random.getState();
  freezeSimulationSnapshot(state.runtime!.initialContestants);
  freezeSimulationSnapshot(state.runtime!.sourceContestants);
  freezeSimulationSnapshot(state.runtime!.definitions);
  if (state.runtime!.trackSpecials)
    freezeSimulationSnapshot(state.runtime!.trackSpecials.startingContestants);
  validateTrackSpecials(state);
  state.persistenceError = null;
  return state;
}

export function transitionTrackSpecials(
  current: SimulationState,
  action: TrackSpecialsAction,
  revision: number,
): SimulationState {
  return awardNewActivity(current, transitionInternal(current, action, revision));
}
function transitionInternal(current: SimulationState, action: TrackSpecialsAction, revision: number) {
  const runtime = current.runtime;
  if (runtime?.version !== 3 || current.status !== 'ready' || runtime.photoshoot?.phase !== 'complete')
    throw new Error('Complete Photoshoot in a current-format season before Track Specials.');
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error('A valid Track Specials revision is required.');
  const old = runtime.trackSpecials;
  const prep = runtime.preparations?.[6];
  if (!old) {
    if (!prep) {
      if (action.type !== 'start' || revision !== 0) throw new Error('Start Episode 6 preparation first.');
      const next = structuredClone(current);
      const random = createSeededRandom(runtime.randomState);
      initializePreparation(next, 6, random.next);
      return finalize(next, random);
    }
    if (
      (action.type === 'start' && revision === 0 && prep.revision === 0) ||
      (prep.lastAction?.revision === revision &&
        JSON.stringify(prep.lastAction.action) === JSON.stringify(action))
    )
      return current;
    if (revision !== prep.revision) throw new Error('This Track Specials preparation action is stale.');
    if (action.type !== 'mood' && action.type !== 'opening-cast' && action.type !== 'randomize-mood')
      throw new Error('Confirm the opening mood and replacement cast first.');
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    const before = structuredClone(next.contestants);
    applyPreparation(next, action, random.next);
    const nextPrep = next.runtime!.preparations![6]!;
    nextPrep.revision++;
    nextPrep.lastAction = { revision, action: structuredClone(action) };
    if (nextPrep.mood && !nextPrep.requiredSelections) {
      start(next);
      capture(next, before, 'Track Specials: re-lodging');
    }
    return finalize(next, random);
  }
  if (
    (old.lastAction.revision === revision &&
      JSON.stringify(old.lastAction.action) === JSON.stringify(action)) ||
    (prep?.lastAction?.revision === revision &&
      JSON.stringify(prep.lastAction.action) === JSON.stringify(action))
  )
    return current;
  if (old.revision !== revision) throw new Error('This Track Specials action is stale; reload the episode.');
  if (old.phase === 'complete') throw new Error('Track Specials is complete.');
  assertTrackSpecialsEpisode(old, current.contestants, runtime.definitions);
  const next = structuredClone(current);
  const random = createSeededRandom(runtime.randomState);
  const before = structuredClone(next.contestants);
  const ep = episode(next);
  ep.revision++;
  ep.lastAction = { revision, action: structuredClone(action) };
  if (action.type === 'conflict') {
    if (
      ep.phase !== 'intervention' ||
      !ep.conflict ||
      !['support', 'mediate', 'push'].includes(action.choice)
    )
      throw new Error('No eligible Track Specials rehearsal conflict.');
    const team = ep.teams.find((entry) => entry.id === ep.conflict!.teamId)!;
    team.intervention!.choice = action.choice;
    const ids = ep.conflict.contestantIds;
    team.coordination = clampBattle(
      team.coordination + (action.choice === 'push' ? 3 : action.choice === 'support' ? 2 : 1),
      -5,
      5,
    );
    for (const id of ids) {
      for (const other of ids)
        if (other !== id)
          changeBattleRelationship(
            person(next, id),
            other,
            action.choice === 'push' ? -3 : action.choice === 'mediate' ? 2 : 1,
          );
    }
    ep.conflict = null;
    append(
      next,
      'practice',
      4,
      `${team.name}: production ${action.choice}`,
      [
        action.choice === 'push'
          ? 'Production pushes for a finished rehearsal. The urgency helps coordination but leaves the pair colder.'
          : action.choice === 'mediate'
            ? 'Production hears both sides. The pair regain a little trust and can return to the passage.'
            : 'Production offers practical reassurance. The pair settle enough to continue.',
      ],
      ids,
      3,
    );
  } else if (action.type === 'secret') {
    if (ep.phase !== 'secret-choice' || !ep.secretCandidates.includes(action.contestantId))
      throw new Error('Choose an eligible Track Specials secret candidate.');
    const result = revealAuditionSecret(next.contestants, action.contestantId, next.runtime!.definitions);
    next.contestants = result.contestants;
    ep.secret = result.result;
    next.runtime!.deferredConsequences.push(...result.result.deferred);
    if (result.result.cardId)
      next.runtime!.revealedSecrets.push({ contestantId: action.contestantId, cardId: result.result.cardId });
    append(
      next,
      'secret-result',
      8,
      result.result.title,
      [
        `${mention(action.contestantId)}: ${result.result.description}`,
        'The sealed standings and rank-sixteen departure remain unchanged.',
      ],
      [action.contestantId],
      result.result.cardId ? 6 : 0,
    );
  } else if (action.type === 'advance') advance(next, random.next);
  else throw new Error('Only the current Track Specials story action is available.');
  capture(next, before, `Track Specials: ${old.phase}`, old.scenes.at(-1)?.id);
  if (ep.phase === 'complete')
    next.contestants = next.contestants.map((entry) =>
      !ep.participantIds.includes(entry.id)
        ? entry
        : appendContestantHistory(
            entry,
            {
              episode: 6,
              phaseId: `${runtime.runId}:track-specials:complete`,
              rank: entry.rank,
              status: entry.status,
              score: entry.aggregations.rankingScore,
              missionRating: entry.missionRating,
              summary:
                entry.id === ep.eliminatedId
                  ? 'Eliminated in sixteenth place after Track Specials.'
                  : 'Track Specials completed; fifteen continue.',
              events: entry.events.filter((event) => event.startsWith('TRACK_SPECIALS_')),
            },
            ep.changes[entry.id] ?? [],
          ),
    );
  return finalize(next, random);
}
