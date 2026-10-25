import type { EpisodeScene } from '../types/audition-episode';
import type { BattleSong } from '../types/battle-episode';
import type { Contestant } from '../types/contestant';
import type {
  MegaGroupsAction,
  MegaGroupsEpisode,
  MegaGroupsPhase,
  MegaGroupTeam,
} from '../types/mega-groups-episode';
import type { SimulationState } from '../types/simulation';
import { MEGA_GROUP_IMAGES } from '../utilities/mega-groups-catalogs';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { awardNewActivity, recordSceneTV } from './activity-awards';
import {
  type AudienceEvidence,
  chooseEvidenceMvp,
  resolveNarrativeEvidenceAudience,
  transferEliminatedFans,
} from './audition-audience';
import { auditionGrade } from './audition-scoring';
import { revealAuditionSecret } from './audition-secrets';
import { addGroupJudging } from './battle-judging';
import {
  battleCheck,
  battleRelationship,
  changeBattleRelationship,
  clampBattle,
  practiceBattleTeam,
  scoreGroupTeam,
} from './battle-scoring';
import { appendContestantHistory, recordContestantChanges } from './change-history';
import { applyPreparation, initializePreparation, playOpening } from './episode-preparation';
import { assertMegaGroupsEpisode, validateMegaGroups } from './mega-groups-validation';
import { createSeededRandom, type RandomSource, shuffleWithRandom } from './random';

export { assertMegaGroupsEpisode, validateMegaGroups } from './mega-groups-validation';

const host = { name: 'Mike Philip', role: 'Host' };
const judges = [
  { id: 'john', name: 'John Stan', role: 'Music producer' },
  { id: 'megan', name: 'Megan Ryder', role: 'Veteran artist' },
  { id: 'michael', name: 'Michael Lion', role: 'Record-label executive' },
] as const;
const mention = (id: string) => `{{${encodeURIComponent(id)}}}`;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
function episode(state: SimulationState): MegaGroupsEpisode {
  const ep = state.runtime?.megaGroups;
  if (!ep) throw new Error('Start Mega Groups first.');
  return ep;
}
function person(state: SimulationState, id: string): Contestant {
  const contestant = state.contestants.find((entry) => entry.id === id);
  if (!contestant) throw new Error(`Unknown Mega Groups contestant "${id}".`);
  return contestant;
}
function append(
  state: SimulationState,
  phase: MegaGroupsPhase,
  sequence: number,
  title: string,
  paragraphs: string[],
  ids: string[] = [],
  speaker?: EpisodeScene['speaker'],
  tier?: 0 | 1 | 3 | 6,
) {
  const ep = episode(state);
  const references: string[][] = [];
  const text = paragraphs.map((paragraph) => {
    const refs: string[] = [];
    const result = paragraph.replace(/\{\{([^{}]+)\}\}/g, (_, encoded: string) => {
      const id = decodeURIComponent(encoded);
      refs.push(id);
      return person(state, id).name;
    });
    references.push(refs);
    return result;
  });
  ep.phase = phase;
  ep.scenes.push(
    recordSceneTV(
      {
        id: `mega-groups-${ep.scenes.length}`,
        sequence,
        kind:
          phase === 'ranking'
            ? 'ranking'
            : phase === 'performance'
              ? 'battles'
              : phase === 'secret-choice' || phase === 'secret-result'
                ? 'secret'
                : phase === 'elimination' || phase === 'withdrawal'
                  ? 'eliminations'
                  : phase === 'rehearsal' || phase === 'intervention'
                    ? 'practice'
                    : phase === 'mvp'
                      ? 'mvp'
                      : 'recap',
        title,
        paragraphs: text,
        contestantIds: [...new Set(ids)],
        paragraphContestantIds: references,
        presentation: phase === 'credits' ? 'credits' : speaker ? 'host' : 'performance',
        ...(speaker ? { speaker } : {}),
      },
      tier,
    ),
  );
}
function ratio(
  contestant: Contestant,
  key: 'audienceRatio' | 'fanbaseRatio' | 'productionRatio',
  delta: number,
) {
  contestant.aggregations[key] = clampBattle(contestant.aggregations[key] + delta, -1, 1);
}
function response(state: SimulationState, observer: string, target: string) {
  const contestant = person(state, observer);
  const p = contestant.personality;
  const disposition =
    (battleRelationship(contestant, target) - 50) / 5 +
    p.gentleness +
    p.maturity -
    p.sensitivity -
    p.ambition;
  changeBattleRelationship(contestant, target, disposition >= 0 ? 1 : -1);
}
function start(state: SimulationState, random: RandomSource) {
  const runtime = state.runtime!;
  const ids = [...runtime.bootcamp!.rankedIds];
  if (
    ids.length !== 18 ||
    state.contestants.filter((entry) => entry.status === 'ACTIVE').length !== 18 ||
    ids.some((id) => person(state, id).status !== 'ACTIVE')
  )
    throw new Error('Mega Groups requires eighteen active Boot Camp survivors.');
  const ties = Object.fromEntries(ids.map((id) => [id, random()]));
  const distressed = [...ids].sort(
    (a, b) =>
      person(state, a).aggregations.happiness - person(state, b).aggregations.happiness ||
      ties[a] - ties[b] ||
      a.localeCompare(b),
  )[0];
  const room = runtime.battle!.rooms.find((entry) => entry.memberIds.includes(distressed));
  const roommates = (room?.memberIds ?? []).filter((id) => id !== distressed && ids.includes(id));
  const candidates = roommates.length ? roommates : ids.filter((id) => id !== distressed);
  const comforter = [...candidates].sort(
    (a, b) =>
      person(state, b).personality.gentleness - person(state, a).personality.gentleness ||
      ties[a] - ties[b] ||
      a.localeCompare(b),
  )[0];
  runtime.megaGroups = {
    version: 1,
    phase: 'dorms',
    revision: 0,
    lastAction: { revision: 0, action: { type: 'start' } },
    participantIds: ids,
    previousRankedIds: [...ids],
    startingContestants: structuredClone(state.contestants),
    comfort: { distressedId: distressed, comforterId: comforter, visitor: !roommates.length, tieKeys: ties },
    hands: {
      tired: ids.filter(
        (id) =>
          runtime.bootcamp!.evaluations.some((entry) => entry.contestantId === id && entry.fatigue > 0) ||
          person(state, id).utilitySkills.stamina <= 2,
      ),
      fun: ids.filter((id) => {
        const p = person(state, id).personality;
        return (
          p.curiosity >= 5 ||
          (p.resilience >= 5 &&
            mean(
              runtime
                .bootcamp!.evaluations.filter((entry) => entry.contestantId === id)
                .map((entry) => entry.finalScore),
            ) >= 50)
        );
      }),
      ready: ids.filter((id) => {
        const p = person(state, id).personality;
        return p.ambition >= 5 || p.discipline >= 5 || p.investment >= 5;
      }),
    },
    questionCursor: 0,
    testId: null,
    blindOrder: [],
    choices: [],
    teams: [],
    transfer: null,
    performanceCursor: 0,
    reviewCursor: 0,
    performances: [],
    conflict: null,
    interventions: {},
    jane: [],
    audience: null,
    mvp: null,
    secretCandidates: [],
    secret: null,
    rankedIds: [],
    rankRevealed: false,
    finalRankedIds: [],
    eliminatedId: null,
    withdrawnId: null,
    withdrawalReason: null,
    withdrawalEvidence: null,
    survivorIds: [],
    initialPractice: Object.fromEntries(ids.map((id) => [id, person(state, id).aggregations.practice])),
    scenes: [],
    changes: {},
  };
  runtime.episode = 4;
  runtime.phase = 'mega-groups';
  const low = person(state, distressed);
  const helper = person(state, comforter);
  changeBattleRelationship(low, comforter, 10);
  changeBattleRelationship(helper, distressed, 10);
  low.aggregations.happiness = clampBattle(low.aggregations.happiness + 5);
  ratio(low, 'audienceRatio', 0.1);
  ratio(helper, 'audienceRatio', 0.1);
  append(
    state,
    'dorms',
    1,
    'After Boot Camp: someone listens',
    [
      'The dorms are quiet after Boot Camp. The empty beds have not been filled.',
      `${mention(distressed)} is the unhappiest person still here: "Boot Camp left me exhausted. I thought about giving up." ${mention(comforter)} ${roommates.length ? 'sits beside their roommate' : 'visits from another room'}: "You do not have to carry this alone. I can stay and listen."`,
      `${mention(distressed)}: "I needed someone to notice. I will stay and try another day." The conversation brings a little relief, and both leave feeling closer.`,
    ],
    [distressed, comforter],
    undefined,
    6,
  );
}
function ask(state: SimulationState) {
  const ep = episode(state);
  const key = (['tired', 'fun', 'ready'] as const)[ep.questionCursor++];
  const bonus = { tired: 'fanbaseRatio', fun: 'audienceRatio', ready: 'productionRatio' } as const;
  for (const id of ep.hands[key]) ratio(person(state, id), bonus[key], 0.01);
  append(
    state,
    'briefing',
    3,
    { tired: 'Who is still tired?', fun: 'Who had fun?', ready: 'Who is ready?' }[key],
    [
      {
        tired: '"Who is still tired after Boot Camp?"',
        fun: '"Who actually had fun out there?"',
        ready: '"Who is ready for the next challenge?"',
      }[key],
      ...ep.hands[key].map(
        (id) =>
          `${mention(id)} raises a hand${key === 'tired' ? ', admitting the training still weighs on them' : key === 'fun' ? ', remembering something worth smiling about' : ', eager to get back on stage'}.`,
      ),
      ...(ep.hands[key].length ? [] : ['Nobody raises a hand. Mike lets the silence speak.']),
      ...(key === 'ready'
        ? [
            '"Today you will form two groups of nine, and each group will perform two songs. The individual continuing ranking decides who leaves: eighteenth place is eliminated. No team elimination, and no saves."',
          ]
        : []),
    ],
    ep.hands[key],
    host,
  );
}
function images(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const definitions = state.runtime!.definitions;
  const tests = definitions.megaGroupTests!;
  const test = tests[Math.floor(random() * tests.length)];
  ep.testId = test.id;
  ep.blindOrder = shuffleWithRandom(ep.participantIds, random);
  const songs = shuffleWithRandom(definitions.megaGroupSongs!, random).slice(0, 4);
  ep.teams = test.sides.map(
    (side, index): MegaGroupTeam => ({
      id: `mega-${index === 0 ? 'a' : 'b'}`,
      name: side.name,
      memberIds: [],
      initialMemberIds: [],
      captainId: '',
      songId: songs[index * 2].id,
      songIds: [songs[index * 2].id, songs[index * 2 + 1].id],
      centerId: null,
      partAssignments: {},
      assignmentsBySong: {},
      partReactions: {},
      centerBallots: {},
      leaderBallots: {},
      leaderTotals: {},
      centerTotals: {},
      roleTieKeys: {},
      coordination: 0,
      practice: [],
    }),
  );
  append(
    state,
    'images',
    4,
    `Blind images: ${test.name}`,
    [
      `"${test.sides[0].name}, or ${test.sides[1].name}? Choose the image that feels more like you."`,
      'Everyone chooses alone, without seeing anyone else’s answer. Only after every choice is locked will they learn the team sizes.',
    ],
    [],
    host,
  );
  ep.scenes.at(-1)!.illustrations = test.sides.map((side) => ({
    src: MEGA_GROUP_IMAGES[side.image],
    label: side.name,
  }));
}
function blindChoice(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const id = ep.blindOrder[ep.choices.length];
  const contestant = person(state, id);
  const test = state.runtime!.definitions.megaGroupTests!.find((entry) => entry.id === ep.testId)!;
  const sums: [number, number] = [
    test.sides[0].traits.reduce((sum, trait) => sum + contestant.personality[trait], 0),
    test.sides[1].traits.reduce((sum, trait) => sum + contestant.personality[trait], 0),
  ];
  const tieKey = sums[0] === sums[1] ? random() : null;
  const side = sums[0] === sums[1] ? (tieKey! < 0.5 ? 0 : 1) : sums[0] > sums[1] ? 0 : 1;
  ep.choices.push({ contestantId: id, sums, side, tieKey });
  const team = ep.teams[side];
  for (const other of team.memberIds) {
    response(state, id, other);
    response(state, other, id);
  }
  team.memberIds.push(id);
  team.initialMemberIds.push(id);
  append(
    state,
    'choices',
    4,
    `${contestant.name}'s locked choice`,
    [
      `${mention(id)} chooses ${team.name} independently, drawn to its ${test.sides[side].traits.join(' and ')} associations.`,
      `${team.name} now contains ${team.memberIds.map(mention).join(', ')}.`,
    ],
    team.memberIds,
  );
}

/** Ballots read one snapshot; transfers never change a later voter's nomination evidence. */
function transfer(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const from = ep.teams.find((team) => team.memberIds.length > 9);
  const record: NonNullable<MegaGroupsEpisode['transfer']> = {
    fromTeamId: from?.id ?? null,
    excess: from ? from.memberIds.length - 9 : 0,
    ballots: {},
    evidence: {},
    totals: {},
    tieKeys: {},
    movedIds: [],
  };
  ep.transfer = record;
  const paragraphs: string[] = ep.teams.map(
    (team) => `${team.name}: ${team.memberIds.length} members — ${team.memberIds.map(mention).join(', ')}.`,
  );
  if (from) {
    const to = ep.teams.find((team) => team !== from)!;
    for (const id of from.initialMemberIds) {
      record.totals[id] = 0;
      record.tieKeys[id] = random();
    }
    for (const voterId of from.initialMemberIds) {
      const voter = person(state, voterId);
      record.evidence[voterId] = {};
      for (const id of from.initialMemberIds.filter((other) => other !== voterId)) {
        const affection = battleRelationship(voter, id);
        const skill = (mean(Object.values(person(state, id).coreSkills)) - 1) * 25;
        record.evidence[voterId][id] = { relationship: affection, skill, blend: (affection + skill) / 2 };
      }
      const choices = Object.keys(record.evidence[voterId])
        .sort(
          (a, b) =>
            record.evidence[voterId][a].blend - record.evidence[voterId][b].blend ||
            record.tieKeys[a] - record.tieKeys[b] ||
            a.localeCompare(b),
        )
        .slice(0, record.excess);
      record.ballots[voterId] = choices;
      for (const id of choices) record.totals[id]++;
      paragraphs.push(
        `Viewer-only secret ballot: ${mention(voterId)} nominates ${choices.map(mention).join(', ')} to move. The contestants do not see this ballot.`,
      );
    }
    record.movedIds = [...from.initialMemberIds]
      .sort(
        (a, b) =>
          record.totals[b] - record.totals[a] || record.tieKeys[a] - record.tieKeys[b] || a.localeCompare(b),
      )
      .slice(0, record.excess);
    from.memberIds = from.initialMemberIds.filter((id) => !record.movedIds.includes(id));
    to.memberIds.push(...record.movedIds);
    for (const id of record.movedIds) {
      const moved = person(state, id);
      moved.aggregations.happiness = clampBattle(moved.aggregations.happiness - 3);
      for (const stayer of from.memberIds) changeBattleRelationship(moved, stayer, -5);
      paragraphs.push(
        `${mention(id)} moves to ${to.name} with ${record.totals[id]} nominations. Being sent away hurts; the disappointment is directed toward the original teammates who stay, not toward any identified voter.`,
      );
    }
    for (const id of from.memberIds) {
      const stayer = person(state, id);
      stayer.aggregations.happiness = clampBattle(stayer.aggregations.happiness - 1);
    }
  } else paragraphs.push('Both groups already have nine members. No transfer ballot is needed.');
  append(state, 'transfers', 4, 'The secret transfer ballot', paragraphs, ep.participantIds);
}
function rosters(state: SimulationState) {
  const ep = episode(state);
  for (const team of ep.teams)
    for (const observer of team.memberIds)
      for (const target of team.memberIds.filter((id) => id !== observer)) response(state, observer, target);
  append(
    state,
    'rosters',
    4,
    'Two final groups of nine',
    [
      ...ep.teams.map((team) => `${team.name}: ${team.memberIds.map(mention).join(', ')}.`),
      'The final lineups settle in. Each person responds to the teammates actually beside them; the transfer disappointment remains a separate part of the morning.',
    ],
    ep.participantIds,
  );
}
function songFor(state: SimulationState, id: string): BattleSong {
  const song = state.runtime!.definitions.megaGroupSongs!.find((entry) => entry.id === id);
  if (!song) throw new Error('Missing locked Mega Groups song.');
  return song;
}
function currentTeam(state: SimulationState) {
  return episode(state).teams[episode(state).performanceCursor % 2];
}
function sequence(state: SimulationState) {
  return 5 + episode(state).performanceCursor;
}

function elect(state: SimulationState, team: MegaGroupTeam, role: 'leader' | 'center', random: RandomSource) {
  const ballots = role === 'leader' ? team.leaderBallots : team.centerBallots;
  const totals = role === 'leader' ? team.leaderTotals : team.centerTotals;
  const ties = Object.fromEntries(team.memberIds.map((id) => [id, random()]));
  team.roleTieKeys[role] = ties;
  const evidence = (voterId: string, id: string): number[] => {
    const voter = person(state, voterId);
    const candidate = person(state, id);
    const bond = battleRelationship(voter, id);
    return role === 'leader'
      ? [
          candidate.coreSkills.leadership +
            (voter.specialties.leadershipStyle === candidate.specialties.leadershipStyle ? 1 : 0),
          bond,
        ]
      : [candidate.coreSkills.stagePresence, bond, candidate.coreSkills.visual];
  };
  const compare = (a: number[], b: number[]) => {
    for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return b[index] - a[index];
    return 0;
  };
  for (const id of team.memberIds) totals[id] = 0;
  for (const voter of team.memberIds) {
    const chosen = [...team.memberIds].sort(
      (a, b) => compare(evidence(voter, a), evidence(voter, b)) || ties[a] - ties[b] || a.localeCompare(b),
    )[0];
    ballots[voter] = chosen;
    totals[chosen]++;
  }
  const aggregate = (id: string) =>
    evidence(team.memberIds[0], id).map((_, index) =>
      team.memberIds.reduce((sum, voter) => sum + evidence(voter, id)[index], 0),
    );
  const winner = [...team.memberIds].sort(
    (a, b) =>
      totals[b] - totals[a] || compare(aggregate(a), aggregate(b)) || ties[a] - ties[b] || a.localeCompare(b),
  )[0];
  if (role === 'leader') {
    team.captainId = winner;
    person(state, winner).aggregations.leader++;
  } else {
    team.centerId = winner;
    person(state, winner).aggregations.center++;
  }
}

/** Nine-person maximum-coverage assignment in O(n² 2ⁿ), not nine-factorial enumeration. */
function assignParts(state: SimulationState, team: MegaGroupTeam, song: BattleSong, random: RandomSource) {
  const order = shuffleWithRandom(team.memberIds, random);
  const best = new Map<number, { score: number; order: string[] }>([[0, { score: 0, order: [] }]]);
  for (let mask = 0; mask < 1 << order.length; mask++) {
    const prior = best.get(mask);
    if (!prior || prior.order.length === order.length) continue;
    const part = song.parts[prior.order.length];
    for (const [index, id] of order.entries()) {
      if (mask & (1 << index)) continue;
      const score =
        prior.score +
        part.testedSkills.reduce(
          (sum, check, checkIndex) =>
            sum +
            Math.min(person(state, id).coreSkills[check.skill], check.requiredLevel) *
              (checkIndex === 0 ? 2 : 1),
          0,
        );
      const nextMask = mask | (1 << index);
      if (!best.has(nextMask) || score > best.get(nextMask)!.score)
        best.set(nextMask, { score, order: [...prior.order, id] });
    }
  }
  const assignment = Object.fromEntries(
    best.get((1 << order.length) - 1)!.order.map((id, index) => [id, song.parts[index].id]),
  );
  team.assignmentsBySong[song.id] = assignment;
}
function rehearse(state: SimulationState, random: RandomSource) {
  const team = currentTeam(state);
  elect(state, team, 'leader', random);
  const songs = team.songIds.map((id) => songFor(state, id));
  for (const song of songs) assignParts(state, team, song, random);
  team.partAssignments = { ...team.assignmentsBySong[team.songIds[0]] };
  for (const id of team.memberIds) {
    const contestant = person(state, id);
    const worstFit = Math.min(
      ...songs.map((song) =>
        song.parts
          .find((part) => part.id === team.assignmentsBySong[song.id][id])!
          .testedSkills.reduce(
            (sum, check) => sum + contestant.coreSkills[check.skill] - check.requiredLevel,
            0,
          ),
      ),
    );
    team.partReactions[id] = worstFit < -2 ? 'unhappy' : worstFit >= 0 ? 'happy' : 'neutral';
    if (id !== team.captainId)
      changeBattleRelationship(
        contestant,
        team.captainId,
        team.partReactions[id] === 'unhappy' ? -2 : team.partReactions[id] === 'happy' ? 1 : 0,
      );
  }
  const practiceSong = songs.reduce((a, b) => (a.difficulty >= b.difficulty ? a : b));
  practiceBattleTeam(team, practiceSong, state.contestants, random);
  append(
    state,
    'rehearsal',
    sequence(state),
    `${team.name}: two songs, one team`,
    [
      `The songs are ${songs.map((song) => song.title).join(' and ')}. One leader and one center will serve both performances.`,
      ...team.memberIds.map(
        (id) => `Public leader ballot: ${mention(id)} votes for ${mention(team.leaderBallots[id])}.`,
      ),
      `${mention(team.captainId)} is elected leader with ${team.leaderTotals[team.captainId]} votes.`,
      ...songs.flatMap((song) => [
        `${song.title}:`,
        ...team.memberIds.map(
          (id) =>
            `${mention(id)} takes ${song.parts.find((part) => part.id === team.assignmentsBySong[song.id][id])!.name}.`,
        ),
      ]),
      ...team.practice.map(
        (session) =>
          `${session.title}, covering both songs: ${session.leadershipSuccess ? 'the leader makes the plan clear and the team finds a stronger shared rhythm' : 'the leader struggles to make the plan clear, and the team loses some coordination'}. ${
            session.contestants
              .filter((entry) => entry.improved)
              .map((entry) => mention(entry.contestantId))
              .join(', ') || 'No one'
          } ${session.contestants.filter((entry) => entry.improved).length === 1 ? 'makes' : 'make'} a clear rehearsal improvement.`,
      ),
    ],
    team.memberIds,
  );
}
function center(state: SimulationState, random: RandomSource) {
  const team = currentTeam(state);
  if (team.centerId) throw new Error('The Mega Groups center is already elected.');
  elect(state, team, 'center', random);
  append(
    state,
    'center',
    sequence(state),
    `${team.name}: the center ballot`,
    [
      ...team.memberIds.map((id) => `${mention(id)} votes for ${mention(team.centerBallots[id])}.`),
      `${mention(team.centerId!)} wins with ${team.centerTotals[team.centerId!]} votes and will be center for both songs. Everyone, including the leader, was eligible; self-votes were allowed.`,
    ],
    team.memberIds,
  );
}
function conflictOrCenter(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const team = currentTeam(state);
  const partner = team.memberIds
    .filter((id) => id !== team.captainId)
    .sort(
      (a, b) =>
        battleRelationship(person(state, a), team.captainId) -
          battleRelationship(person(state, b), team.captainId) || a.localeCompare(b),
    )[0];
  const strained =
    battleRelationship(person(state, partner), team.captainId) < 40 ||
    battleRelationship(person(state, team.captainId), partner) < 40 ||
    (team.partReactions[partner] === 'unhappy' && person(state, partner).personality.gentleness < -3);
  if (!strained) {
    center(state, random);
    return;
  }
  ep.conflict = {
    teamId: team.id,
    contestantIds: [team.captainId, partner],
    description: 'A strained bond turns the final rehearsal discussion into a dispute.',
  };
  append(
    state,
    'intervention',
    sequence(state),
    'A genuine rehearsal dispute',
    [
      `${mention(partner)} challenges ${mention(team.captainId)} over the rehearsal plan. Their strained working relationship makes it difficult to hear each other.`,
      'Production can support the team, mediate the disagreement, or push them to finish.',
    ],
    ep.conflict.contestantIds,
    undefined,
    6,
  );
}
function perform(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const team = currentTeam(state);
  const songId = team.songIds[Math.floor(ep.performanceCursor / 2)];
  const song = songFor(state, songId);
  const scoringTeam = { ...team, songId, partAssignments: team.assignmentsBySong[songId] };
  const scored = addGroupJudging(
    scoreGroupTeam(scoringTeam, song, state.contestants, 0, random, true),
    state.contestants,
    9,
  );
  ep.performances.push({ ...scored, songId });
  ep.reviewCursor = 0;
  append(
    state,
    'performance',
    sequence(state),
    `${team.name}: ${song.title}`,
    [
      `${mention(team.captainId)} brings all nine into position; ${mention(team.centerId!)} anchors the center.`,
      ...scored.evaluations.map(
        (evaluation) =>
          `${mention(evaluation.contestantId)} performs ${song.parts.find((part) => part.id === evaluation.partId)!.name}: ${evaluation.finalScore >= 70 ? 'a confident delivery with clear control' : evaluation.finalScore >= 50 ? 'a mixed delivery, with both assured passages and room to improve' : 'an uncertain delivery that needs more technical and stage assurance'}.`,
      ),
      'All nine finish together. The judges respond before the next song.',
    ],
    team.memberIds,
    undefined,
    0,
  );
}
function review(state: SimulationState) {
  const ep = episode(state);
  const performance = ep.performances.at(-1)!;
  const judge = judges[ep.reviewCursor++];
  append(
    state,
    'reviews',
    sequence(state),
    `${judge.name}'s review`,
    [performance.judging![judge.id].comment],
    currentTeam(state).memberIds,
    { name: judge.name, role: judge.role },
    0,
  );
}
function jane(state: SimulationState) {
  const ep = episode(state);
  ep.jane = ep.participantIds.map((id) => {
    const contestant = person(state, id);
    const records = ep.performances
      .flatMap((entry) => entry.evaluations)
      .filter((entry) => entry.contestantId === id);
    if (records.length !== 2) throw new Error('Jane needs both recorded performances.');
    const checks = records.flatMap((entry) =>
      [
        ['consistency', contestant.utilitySkills.consistency] as const,
        ['uniqueness', contestant.coreSkills.uniqueness] as const,
      ].map(([skill, level]) => {
        const check = battleCheck(skill, level, 3, entry.rawDice);
        return { ...check, score: (check.score * 100) / 80 };
      }),
    );
    const score = mean(checks.map((check) => check.score));
    const approved = score >= 70;
    if (approved) ratio(contestant, 'productionRatio', 0.05);
    return { contestantId: id, checks, score, approved };
  });
  const ordered = [...ep.jane].sort(
    (a, b) => b.score - a.score || a.contestantId.localeCompare(b.contestantId),
  );
  const highlights = [...ordered.slice(0, 3), ...ordered.slice(-3)];
  append(
    state,
    'jane',
    9,
    'A surprise observer: Jane Strauss',
    [
      '"Master Choreographer Jane Strauss has been watching all four performances." Mike turns toward the guest as the contestants realize the assessment is not over.',
      ...highlights.map(
        (entry) =>
          `${mention(entry.contestantId)}: Jane's recorded consistency and uniqueness checks averaged ${entry.score.toFixed(1)}/100. "${entry.score >= 70 ? 'Your control and individuality stood out across the two songs. I approve.' : entry.score >= 50 ? 'There were promising moments, but your control and individuality need to become more dependable.' : 'The recorded delivery needs steadier control and a clearer individual identity.'}"`,
      ),
    ],
    highlights.map((entry) => entry.contestantId),
    { name: 'Jane Strauss', role: 'Master Choreographer' },
  );
}
function evidence(state: SimulationState): AudienceEvidence[] {
  const ep = episode(state);
  return ep.participantIds
    .map((id) => {
      const records = ep.performances
        .flatMap((entry) => entry.evaluations)
        .filter((entry) => entry.contestantId === id);
      if (records.length !== 2) throw new Error('Mega Groups voting needs two performances per person.');
      const finalScore = mean(records.map((entry) => entry.finalScore));
      return {
        contestantId: id,
        finalScore,
        reception: finalScore,
        observedScore: finalScore,
        category: person(state, id).track,
      };
    })
    .sort(
      (a, b) =>
        b.finalScore - a.finalScore ||
        ep.performances
          .flatMap((entry) => entry.evaluations)
          .find((entry) => entry.contestantId === a.contestantId)!.tieBreakKey -
          ep.performances
            .flatMap((entry) => entry.evaluations)
            .find((entry) => entry.contestantId === b.contestantId)!.tieBreakKey ||
        a.contestantId.localeCompare(b.contestantId),
    );
}
function lockResults(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  if (ep.audience || ep.mvp) throw new Error('Mega Groups results are already locked.');
  const performances = evidence(state);
  const cast = ep.participantIds.map((id) => person(state, id));
  const result = resolveNarrativeEvidenceAudience({
    contestants: cast,
    evidence: performances,
    exposure: Object.fromEntries(ep.participantIds.map((id) => [id, 1 / 18])),
    mood: state.runtime!.preparations![4]!.mood!,
    show: state.runtime!.show,
    random,
  });
  const order = new Map(performances.map((entry, index) => [entry.contestantId, index]));
  const byId = new Map(result.contestants.map((entry) => [entry.id, entry]));
  for (const contestant of result.contestants) {
    contestant.rank = person(state, contestant.id).rank;
    contestant.aggregations.screenTime += 100 / 18;
    contestant.grade = auditionGrade(performances[order.get(contestant.id)!].finalScore);
    contestant.missionRating = { A: 5, B: 4, C: 3, D: 2, F: 1 }[contestant.grade];
  }
  ep.rankedIds = [...result.contestants]
    .sort(
      (a, b) =>
        b.aggregations.rankingScore - a.aggregations.rankingScore || order.get(a.id)! - order.get(b.id)!,
    )
    .map((entry) => entry.id);
  state.contestants = state.contestants.map((entry) => byId.get(entry.id) ?? entry);
  state.runtime!.show = result.show;
  ep.audience = result.outcome;
  ep.mvp = chooseEvidenceMvp(
    ep.participantIds.map((id) => person(state, id)),
    performances,
    ep.participantIds,
    random,
    18,
  );
  const winner = person(state, ep.mvp.winnerId);
  winner.aggregations.mvp++;
  winner.events.push('MEGA_GROUPS_MVP');
  append(
    state,
    'mvp',
    9,
    'The eighteen-person peer MVP',
    [
      'The audience ballot and continuing ranking are now sealed. Every performer has one peer vote; nobody can vote for themselves.',
      ...ep.participantIds.map((id) => `${mention(id)} votes for ${mention(ep.mvp!.ballots[id])}.`),
      `${mention(winner.id)} is the peer MVP with ${ep.mvp.totals[winner.id]} votes.`,
    ],
    ep.participantIds,
    host,
  );
}
function revealRanking(state: SimulationState) {
  const ep = episode(state);
  ep.rankRevealed = true;
  const paragraphs = ep.rankedIds.map((id, index) => {
    const contestant = person(state, id);
    const previous = ep.previousRankedIds.indexOf(id) + 1;
    const movement = previous - index - 1;
    contestant.rank = index + 1;
    contestant.aggregations.happiness = clampBattle(contestant.aggregations.happiness + Math.sign(movement));
    if (index) {
      const above = ep.rankedIds[index - 1];
      response(state, id, above);
    }
    return `${index + 1}. ${mention(id)}${movement > 0 ? ` rises from ${previous}, visibly relieved` : movement < 0 ? ` falls from ${previous}, ${contestant.personality.sensitivity >= 5 ? 'struggling to hide the disappointment' : 'taking the news quietly'}` : ', holding their previous place'}.`;
  });
  append(
    state,
    'ranking',
    9,
    'The announced eighteen-person ranking',
    [
      'These are the sealed cumulative results. The contestant in eighteenth place will leave; no team result or save changes this decision.',
      ...paragraphs,
    ],
    ep.rankedIds,
    host,
  );
}
function farewell(state: SimulationState, id: string, remaining: string[]): string[] {
  const bonds = remaining
    .map((observer) => ({ id: observer, bond: battleRelationship(person(state, observer), id) }))
    .filter((entry) => entry.bond >= 60)
    .sort((a, b) => b.bond - a.bond || a.id.localeCompare(b.id))
    .slice(0, 3);
  for (const bond of bonds)
    person(state, bond.id).aggregations.happiness = clampBattle(
      person(state, bond.id).aggregations.happiness - 2,
    );
  return bonds.length
    ? bonds.map(
        (entry) =>
          `${mention(entry.id)} finds the goodbye to ${mention(id)} especially hard; their existing bond made this more than a place in a lineup.`,
      )
    : [
        'The goodbye is subdued. The others offer respectful farewells without pretending that every bond was close.',
      ];
}
function eliminate(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const id = ep.rankedIds[17];
  ep.eliminatedId = id;
  const departed = person(state, id);
  departed.status = 'ELIMINATED';
  departed.rank = 18;
  departed.events.push('MEGA_GROUPS_ELIMINATED');
  ep.survivorIds = ep.rankedIds.filter((other) => other !== id);
  state.runtime!.show = transferEliminatedFans(
    state.runtime!.show,
    state.contestants,
    ep.survivorIds,
    random,
  );
  append(
    state,
    'elimination',
    9,
    'Eighteenth place: the competitive elimination',
    [
      `${mention(id)} is eliminated in eighteenth place. Both songs counted, and this is an individual competitive departure.`,
      ...farewell(state, id, ep.survivorIds),
    ],
    [id, ...ep.survivorIds],
    host,
  );
}
function withdraw(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const ties = Object.fromEntries(ep.survivorIds.map((id) => [id, random()]));
  // Only the single current unhappiest person is checked for low investment.
  const unhappiest = [...ep.survivorIds].sort(
    (a, b) =>
      person(state, a).aggregations.happiness - person(state, b).aggregations.happiness ||
      ties[a] - ties[b] ||
      a.localeCompare(b),
  )[0];
  ep.withdrawalEvidence = {
    unhappiestId: unhappiest,
    tieKeys: ties,
    happiness: Object.fromEntries(ep.survivorIds.map((id) => [id, person(state, id).aggregations.happiness])),
    investment: person(state, unhappiest).personality.investment,
  };
  const uninvested = person(state, unhappiest).personality.investment < 0;
  const id = uninvested ? unhappiest : ep.survivorIds.at(-1)!;
  ep.withdrawnId = id;
  ep.withdrawalReason = uninvested ? 'unhappy-uninvested' : 'lowest-ranked';
  const departed = person(state, id);
  departed.status = 'ELIMINATED';
  departed.rank = 17;
  departed.events.push('MEGA_GROUPS_WITHDRAWN', `MEGA_GROUPS_WITHDRAWAL:${ep.withdrawalReason}`);
  ep.survivorIds = ep.survivorIds.filter((other) => other !== id);
  ep.finalRankedIds = [...ep.survivorIds, id, ep.eliminatedId!];
  for (const [index, survivor] of ep.survivorIds.entries()) person(state, survivor).rank = index + 1;
  state.runtime!.show = transferEliminatedFans(
    state.runtime!.show,
    state.contestants,
    ep.survivorIds,
    random,
  );
  append(
    state,
    'withdrawal',
    10,
    'One more goodbye: a voluntary withdrawal',
    [
      `${mention(id)} asks to leave. "${uninvested ? 'I am unhappy here, and I no longer have the commitment to keep going. I need to step away.' : 'After seeing where I stand, I have decided not to continue. This is where my time here ends.'}"`,
      'This is a withdrawal, not a second competitive elimination. Their final placement is seventeenth.',
      ...farewell(state, id, ep.survivorIds),
    ],
    [id, ...ep.survivorIds],
    undefined,
    6,
  );
}
function advance(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  switch (ep.phase) {
    case 'dorms':
      playOpening(state, 4);
      append(
        state,
        'credits',
        2,
        'Opening credits',
        ['Eighteen performers. A bigger stage.'],
        state.runtime!.openingCast,
      );
      break;
    case 'credits':
      append(
        state,
        'briefing',
        3,
        'Back on stage',
        ['"Welcome back. Before we begin, I want to know how you are feeling after Boot Camp."'],
        [],
        host,
      );
      break;
    case 'briefing':
      if (ep.questionCursor < 3) ask(state);
      else images(state, random);
      break;
    case 'images':
      blindChoice(state, random);
      break;
    case 'choices':
      if (ep.choices.length < 18) blindChoice(state, random);
      else transfer(state, random);
      break;
    case 'transfers':
      rosters(state);
      break;
    case 'rosters':
      rehearse(state, random);
      break;
    case 'rehearsal':
      conflictOrCenter(state, random);
      break;
    case 'center':
      perform(state, random);
      break;
    case 'performance':
      review(state);
      break;
    case 'reviews':
      if (ep.reviewCursor < 3) review(state);
      else if (ep.performanceCursor < 3) {
        ep.performanceCursor++;
        if (ep.performanceCursor === 1) rehearse(state, random);
        else {
          const team = currentTeam(state);
          append(
            state,
            'center',
            sequence(state),
            `${team.name} returns`,
            [
              `${team.name} returns for ${songFor(state, team.songIds[1]).title}, keeping ${mention(team.captainId)} as leader and ${mention(team.centerId!)} as center.`,
            ],
            team.memberIds,
          );
        }
      } else jane(state);
      break;
    case 'jane':
      lockResults(state, random);
      break;
    case 'mvp':
      ep.secretCandidates = ep.participantIds.filter(
        (id) => !person(state, id).events.some((event) => event.startsWith('SECRET_REVEALED:')),
      );
      if (!ep.secretCandidates.length) {
        append(state, 'secret-result', 9, 'The investigation desk', [
          'Every performer has already been investigated. No repeat investigation is run.',
        ]);
      } else
        append(
          state,
          'secret-choice',
          9,
          'The secret investigation',
          [
            'Choose one of the eighteen performers for the usual secret investigation. The already sealed competitive result cannot be rewritten.',
          ],
          ep.secretCandidates,
        );
      break;
    case 'secret-result':
      revealRanking(state);
      break;
    case 'ranking':
      eliminate(state, random);
      break;
    case 'elimination':
      withdraw(state, random);
      break;
    case 'withdrawal':
      for (const id of ep.participantIds) person(state, id).aggregations.practice = ep.initialPractice[id];
      append(
        state,
        'complete',
        10,
        'Mega Groups: the final sixteen',
        [
          ...ep.survivorIds.map((id, index) => `${index + 1}. ${mention(id)}.`),
          'Mega Groups is complete. Episode 5 is unlocked and next; it has not begun.',
        ],
        ep.survivorIds,
        host,
      );
      state.runtime!.phase = 'episode-complete';
      break;
    default:
      throw new Error('Choose the available Mega Groups action before continuing.');
  }
}
function capture(
  state: SimulationState,
  before: readonly Contestant[],
  cause: string,
  previousSceneId?: string,
) {
  const ep = episode(state);
  const scene = ep.scenes.at(-1);
  const aired = scene && scene.id !== previousSceneId ? scene : undefined;
  for (const id of ep.participantIds) {
    const previous = before.find((entry) => entry.id === id);
    if (!previous) throw new Error('Missing Mega Groups change-history snapshot.');
    ep.changes[id] ??= [];
    const changes = recordContestantChanges(previous, person(state, id), cause);
    ep.changes[id].push(...changes);
    if (aired && changes.length) {
      aired.contestantChanges ??= {};
      aired.contestantChanges[id] = structuredClone(changes);
    }
  }
}
function finalize(state: SimulationState, random: ReturnType<typeof createSeededRandom>) {
  state.runtime!.randomState = random.getState();
  freezeSimulationSnapshot(state.runtime!.initialContestants);
  freezeSimulationSnapshot(state.runtime!.sourceContestants);
  freezeSimulationSnapshot(state.runtime!.definitions);
  if (state.runtime!.megaGroups) freezeSimulationSnapshot(state.runtime!.megaGroups.startingContestants);
  validateMegaGroups(state);
  state.persistenceError = null;
  return state;
}
export function transitionMegaGroups(
  current: SimulationState,
  action: MegaGroupsAction,
  expectedRevision: number,
): SimulationState {
  return awardNewActivity(current, transitionInternal(current, action, expectedRevision));
}
function transitionInternal(
  current: SimulationState,
  action: MegaGroupsAction,
  revision: number,
): SimulationState {
  const runtime = current.runtime;
  if (runtime?.version !== 3 || current.status !== 'ready' || runtime.bootcamp?.phase !== 'complete')
    throw new Error('Complete Boot Camp in a current-format season before Mega Groups.');
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error('A valid Mega Groups revision is required.');
  const old = runtime.megaGroups;
  const prep = runtime.preparations?.[4];
  if (!old) {
    if (!prep) {
      if (action.type !== 'start' || revision !== 0) throw new Error('Start Episode 4 preparation first.');
      const next = structuredClone(current);
      const random = createSeededRandom(runtime.randomState);
      initializePreparation(next, 4, random.next);
      return finalize(next, random);
    }
    if (
      (action.type === 'start' && revision === 0 && prep.revision === 0) ||
      (prep.lastAction?.revision === revision &&
        JSON.stringify(prep.lastAction.action) === JSON.stringify(action))
    )
      return current;
    if (revision !== prep.revision) throw new Error('This Mega Groups opening preparation action is stale.');
    if (action.type !== 'mood' && action.type !== 'opening-cast' && action.type !== 'randomize-mood')
      throw new Error('Confirm the opening mood and replacement cast first.');
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    const before = structuredClone(next.contestants);
    applyPreparation(next, action, random.next);
    const nextPrep = next.runtime!.preparations![4]!;
    nextPrep.revision++;
    nextPrep.lastAction = { revision, action: structuredClone(action) };
    if (nextPrep.mood && !nextPrep.requiredSelections) {
      start(next, random.next);
      capture(next, before, 'Mega Groups: comfort after Boot Camp');
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
  if (old.revision !== revision) throw new Error('This Mega Groups action is stale; reload the episode.');
  if (old.phase === 'complete') throw new Error('Mega Groups is complete.');
  assertMegaGroupsEpisode(old, current.contestants, runtime.definitions);
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
      throw new Error('No Mega Groups intervention is available.');
    const team = currentTeam(next);
    ep.interventions[team.id] = action.choice;
    team.coordination = clampBattle(
      team.coordination + { support: 2, mediate: 1, push: 3 }[action.choice],
      -5,
      5,
    );
    const [a, b] = ep.conflict.contestantIds;
    const delta = { support: 1, mediate: 2, push: -3 }[action.choice];
    changeBattleRelationship(person(next, a), b, delta);
    changeBattleRelationship(person(next, b), a, delta);
    ep.conflict = null;
    center(next, random.next);
    const scene = ep.scenes.at(-1)!;
    scene.paragraphs.unshift(
      action.choice === 'push'
        ? 'Production pushes the team to finish. They find urgency, but the disagreement leaves a colder bond.'
        : action.choice === 'mediate'
          ? 'Production mediates. Both sides are heard, and the team can move forward with a little more trust.'
          : 'Production supports the team. The reassurance helps them work together again.',
    );
    scene.paragraphContestantIds?.unshift([]);
  } else if (action.type === 'secret') {
    if (ep.phase !== 'secret-choice' || !ep.secretCandidates.includes(action.contestantId))
      throw new Error('Choose an eligible Mega Groups secret candidate.');
    const result = revealAuditionSecret(next.contestants, action.contestantId, next.runtime!.definitions);
    next.contestants = result.contestants;
    ep.secret = result.result;
    next.runtime!.deferredConsequences.push(...result.result.deferred);
    if (result.result.cardId)
      next.runtime!.revealedSecrets.push({ contestantId: action.contestantId, cardId: result.result.cardId });
    append(
      next,
      'secret-result',
      9,
      result.result.title,
      [result.result.description, 'The sealed audience result and announced elimination remain unchanged.'],
      [action.contestantId],
    );
  } else if (action.type === 'advance') advance(next, random.next);
  else throw new Error('Only the current Mega Groups story action is available.');
  capture(next, before, `Mega Groups: ${old.phase}`, old.scenes.at(-1)?.id);
  if (ep.phase === 'complete')
    next.contestants = next.contestants.map((contestant) =>
      !ep.participantIds.includes(contestant.id)
        ? contestant
        : appendContestantHistory(
            contestant,
            {
              episode: 4,
              phaseId: `${runtime.runId}:mega-groups:complete`,
              rank: contestant.rank,
              status: contestant.status,
              score: contestant.aggregations.rankingScore,
              missionRating: contestant.missionRating,
              summary:
                contestant.id === ep.withdrawnId
                  ? 'Voluntarily withdrew after Mega Groups.'
                  : contestant.id === ep.eliminatedId
                    ? 'Eliminated in eighteenth place after Mega Groups.'
                    : 'Mega Groups completed.',
              events: contestant.events.filter((event) => event.startsWith('MEGA_GROUPS_')),
            },
            ep.changes[contestant.id] ?? [],
          ),
    );
  return finalize(next, random);
}
