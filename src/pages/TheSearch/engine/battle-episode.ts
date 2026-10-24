import type { AuditionSong } from '../types/audition';
import type { EpisodeScene } from '../types/audition-episode';
import type { BattleAction, BattleEpisode, BattleSong, BattleTeam } from '../types/battle-episode';
import type { Contestant } from '../types/contestant';
import type { SimulationState } from '../types/simulation';
import { BATTLE_SONGS, validateBattleSongs } from '../utilities/battle-songs';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import {
  chooseAuditionMvp,
  createBroadcastCuts,
  resolveBroadcast,
  transferEliminatedFans,
} from './audition-audience';
import { revealAuditionSecret } from './audition-secrets';
import {
  battleAudienceEvaluations,
  battleRelationship,
  changeBattleRelationship,
  clampBattle,
  practiceBattleTeam,
  scoreBattleTeam,
} from './battle-scoring';
import { assertBattleEpisode } from './battle-validation';
import { appendContestantHistory, recordContestantChanges } from './change-history';
import { createSeededRandom, type RandomSource, shuffleWithRandom } from './random';

function member(state: SimulationState, id: string): Contestant {
  const contestant = state.contestants.find((entry) => entry.id === id);
  if (!contestant) throw new Error(`Unknown battle contestant "${id}".`);
  return contestant;
}

function episode(state: SimulationState): BattleEpisode {
  if (!state.runtime?.battle) throw new Error('Start Episode 2 before continuing.');
  return state.runtime.battle;
}

function scene(
  ep: BattleEpisode,
  kind: EpisodeScene['kind'],
  title: string,
  paragraphs: string[],
  contestantIds: string[] = [],
  paragraphContestantIds?: string[][],
): void {
  ep.scenes.push({
    id: `battles-scene-${ep.scenes.length}`,
    kind,
    title,
    paragraphs,
    contestantIds,
    ...(paragraphContestantIds ? { paragraphContestantIds } : {}),
  });
}

function songFor(state: SimulationState, team: BattleTeam): BattleSong {
  const song = state.runtime?.definitions.battleSongs?.find((entry) => entry.id === team.songId);
  if (!song) throw new Error('The team has no snapshotted battle song.');
  return song;
}

function orderedTeams(ep: BattleEpisode): BattleTeam[] {
  return ep.pairings.flatMap((pairing) =>
    pairing.teamIds.map((id) => {
      const team = ep.teams.find((entry) => entry.id === id);
      if (!team) throw new Error('Battle pairing has an unknown team.');
      return team;
    }),
  );
}

function pickWeighted<T>(entries: readonly T[], weight: (entry: T) => number, random: RandomSource): T {
  if (!entries.length) throw new Error('Cannot choose from an empty battle list.');
  const total = entries.reduce((sum, entry) => sum + weight(entry), 0);
  let roll = random() * total;
  for (const entry of entries) {
    roll -= weight(entry);
    if (roll < 0) return entry;
  }
  return entries[entries.length - 1];
}

function initialEpisode(state: SimulationState, random: RandomSource): BattleEpisode {
  const runtime = state.runtime;
  if (
    !runtime?.audition ||
    runtime.audition.phase !== 'complete' ||
    runtime.episode !== 1 ||
    runtime.phase !== 'episode-complete'
  )
    throw new Error('Complete Episode 1 before starting Group Battles.');
  const ids = runtime.audition.survivorIds;
  if (
    ids.length !== 30 ||
    new Set(ids).size !== 30 ||
    ids.some((id) => member(state, id).status !== 'ACTIVE')
  )
    throw new Error('Group Battles requires the thirty active Episode 1 survivors.');
  // Old Episode 1 saves predate the editable catalog; lock it exactly once at the episode boundary.
  runtime.definitions.battleSongs ??= structuredClone(BATTLE_SONGS);
  validateBattleSongs(
    runtime.definitions.battleSongs,
    Object.keys(runtime.definitions.specialties.genreAffinity),
  );
  const shuffled = shuffleWithRandom(ids, random);
  const ties = new Map(ids.map((id) => [id, random()]));
  const rankedIds = [...ids].sort(
    (a, b) =>
      member(state, b).aggregations.score - member(state, a).aggregations.score ||
      ties.get(a)! - ties.get(b)! ||
      a.localeCompare(b),
  );
  const attrition = runtime.show.pendingAttrition;
  const counts = [
    runtime.show.audience,
    runtime.show.general,
    attrition,
    ...Object.values(runtime.show.fans),
  ];
  if (
    counts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
    runtime.show.general + Object.values(runtime.show.fans).reduce((sum, count) => sum + count, 0) !==
      runtime.show.audience ||
    !Number.isFinite(runtime.show.satisfaction) ||
    runtime.show.satisfaction < 0 ||
    runtime.show.satisfaction > 100
  )
    throw new Error('Show audience must conserve valid populations before Group Battles.');
  if (!Number.isSafeInteger(attrition) || attrition < 0 || attrition > runtime.show.audience)
    throw new Error('Queued audience attrition is invalid.');
  const beforePopulation = runtime.show.audience;
  const buckets = [['general', runtime.show.general] as const, ...Object.entries(runtime.show.fans)];
  const removals = buckets.map(([id, population]) => {
    const quota = beforePopulation ? (attrition * population) / beforePopulation : 0;
    return { id, count: Math.floor(quota), fraction: quota % 1 };
  });
  let remainder = attrition - removals.reduce((sum, entry) => sum + entry.count, 0);
  for (const bucket of [...removals].sort((a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id))) {
    if (remainder-- > 0) bucket.count++;
  }
  for (const removal of removals) {
    if (removal.id === 'general') runtime.show.general -= removal.count;
    else runtime.show.fans[removal.id] -= removal.count;
  }
  runtime.show.audience -= attrition;
  runtime.show.pendingAttrition = 0;
  for (const id of ids) member(state, id).aggregations.practice = 0;
  const ep: BattleEpisode = {
    version: 1,
    phase: 'dorms',
    revision: 1,
    lastAction: { revision: 0, action: { type: 'start' } },
    participantIds: [...ids],
    rankedIds,
    finalRankedIds: [],
    rooms: Array.from({ length: 5 }, (_, index) => ({
      id: `room-${index + 1}`,
      memberIds: shuffled.slice(index * 6, index * 6 + 6),
    })),
    roomCursor: 0,
    teams: [],
    draftRound: 0,
    pairings: [],
    teamCursor: 0,
    performances: [],
    composure: {},
    conflict: null,
    conflictChoice: null,
    scenes: [],
    changes: {},
    cuts: [],
    selectedCutId: null,
    audience: null,
    judgeSaveId: null,
    audienceSaveId: null,
    productionShortlist: [],
    productionSaveId: null,
    survivorIds: [],
    eliminatedIds: [],
    revealedResults: 0,
    mvp: null,
    secretCandidates: [],
    secret: null,
  };
  scene(
    ep,
    'opening',
    'A new home',
    [
      'Production randomly assigns all thirty contestants to five rooms of six. Nobody chooses their room, and these assignments remain fixed.',
      'Group Battles is next: six teams of five, three head-to-head battles, and eighteen places in the next episode.',
      ...(attrition ? [`${attrition} queued viewers leave before the new episode opens.`] : []),
    ],
    ids,
  );
  return ep;
}

function roomHighlight(state: SimulationState, random: RandomSource): void {
  const ep = episode(state);
  const room = ep.rooms[ep.roomCursor];
  const pairs = room.memberIds.flatMap((a, index) =>
    room.memberIds.slice(index + 1).map((b) => [a, b] as const),
  );
  const [a, b] = pickWeighted(
    pairs,
    ([a, b]) => {
      const first = member(state, a);
      const second = member(state, b);
      return (
        1 +
        Math.abs(battleRelationship(first, b) - 50) +
        Math.abs(battleRelationship(second, a) - 50) +
        Math.abs(first.personality.gentleness - second.personality.gentleness)
      );
    },
    random,
  );
  const first = member(state, a);
  const second = member(state, b);
  const genuineTension =
    battleRelationship(first, b) < 40 ||
    battleRelationship(second, a) < 40 ||
    first.personality.gentleness + second.personality.gentleness < -8;
  changeBattleRelationship(first, b, genuineTension ? -2 : 2);
  changeBattleRelationship(second, a, genuineTension ? -2 : 2);
  scene(
    ep,
    'dorms',
    `${room.id}: settling in`,
    [
      genuineTension
        ? `${first.name} and ${second.name} struggle to agree on shared-room routines; the tension leaves a small mark.`
        : `${first.name} and ${second.name} find common ground while settling into the shared room.`,
      'The ranking reveal will happen on stage, not in the dorms.',
    ],
    [...room.memberIds],
  );
  ep.roomCursor++;
}

function createCaptains(ep: BattleEpisode): void {
  ep.teams = ep.rankedIds.slice(0, 6).map((id, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    captainId: id,
    memberIds: [id],
    songId: null,
    centerId: null,
    centerBallots: {},
    partAssignments: {},
    partReactions: {},
    coordination: 0,
    practice: [],
  }));
}

function draftRound(state: SimulationState, random: RandomSource): void {
  const ep = episode(state);
  const picked = new Set(ep.teams.flatMap((team) => team.memberIds));
  const picks: string[] = [];
  const paragraphs: string[] = [];
  const identities: string[][] = [];
  for (const team of ep.teams) {
    const captain = member(state, team.captainId);
    const available = ep.participantIds.filter((id) => !picked.has(id));
    const tie = new Map(available.map((id) => [id, random()]));
    const coreMean = (id: string) =>
      Object.values(member(state, id).coreSkills).reduce((a, b) => a + b, 0) / 7;
    available.sort(
      (a, b) =>
        battleRelationship(captain, b) - battleRelationship(captain, a) ||
        member(state, b).utilitySkills.charisma - member(state, a).utilitySkills.charisma ||
        coreMean(b) - coreMean(a) ||
        tie.get(a)! - tie.get(b)! ||
        a.localeCompare(b),
    );
    const chosen = available[0];
    if (!chosen) throw new Error('Draft exhausted the available contestants.');
    const chosenContestant = member(state, chosen);
    const relationship = battleRelationship(captain, chosen);
    const relationshipTies = available.filter((id) => battleRelationship(captain, id) === relationship);
    const charismaTies = relationshipTies.filter(
      (id) => member(state, id).utilitySkills.charisma === chosenContestant.utilitySkills.charisma,
    );
    const coreTies = charismaTies.filter((id) => coreMean(id) === coreMean(chosen));
    const reason =
      available.length === 1
        ? 'they are the last available contestant'
        : relationshipTies.length === 1
          ? `their relationship score (${relationship}/100) is the captain's highest among the available contestants`
          : charismaTies.length === 1
            ? `the highest relationship score is tied at ${relationship}/100, and their charisma (${chosenContestant.utilitySkills.charisma}/5) breaks the tie`
            : coreTies.length === 1
              ? `relationship (${relationship}/100) and charisma (${chosenContestant.utilitySkills.charisma}/5) are tied, and their higher average core skill (${coreMean(chosen).toFixed(2)}/5) decides the pick`
              : `relationship (${relationship}/100), charisma (${chosenContestant.utilitySkills.charisma}/5), and average core skill (${coreMean(chosen).toFixed(2)}/5) are tied; the saved seeded draw decides the pick`;
    paragraphs.push(`${captain.name} selects ${chosenContestant.name} for ${team.name} because ${reason}.`);
    identities.push([captain.id, chosen]);
    team.memberIds.push(chosen);
    picked.add(chosen);
    picks.push(chosen);
    for (const id of available) {
      if (picked.has(id)) continue;
      const unpicked = member(state, id);
      const { gentleness, maturity, sensitivity } = unpicked.personality;
      if (gentleness >= 5 || maturity >= 5) continue;
      const delta = sensitivity <= -5 ? -2 : -1;
      changeBattleRelationship(unpicked, captain.id, delta);
      changeBattleRelationship(unpicked, chosen, delta);
    }
  }
  ep.draftRound++;
  scene(ep, 'draft', `Draft round ${ep.draftRound}`, paragraphs, picks, identities);
}

function createPairings(state: SimulationState, random: RandomSource): void {
  const ep = episode(state);
  const teams = shuffleWithRandom(ep.teams, random);
  const catalog = state.runtime!.definitions.battleSongs!;
  // Adjacent difficulty levels are the closest production can fairly pair; choose only comparable pairs.
  const sorted = shuffleWithRandom(catalog, random).sort((a, b) => a.difficulty - b.difficulty);
  const songPairs: [BattleSong, BattleSong][] = [];
  const remaining = [...sorted];
  while (remaining.length > 1 && songPairs.length < 3) {
    const index = remaining.findIndex(
      (song, i) => i + 1 < remaining.length && Math.abs(song.difficulty - remaining[i + 1].difficulty) <= 1,
    );
    if (index < 0) break;
    songPairs.push([remaining[index], remaining[index + 1]]);
    remaining.splice(index, 2);
  }
  if (songPairs.length !== 3)
    throw new Error('Battle songs need three distinct comparable-difficulty song pairs.');
  const songs = shuffleWithRandom(songPairs, random).flatMap((pair) => shuffleWithRandom(pair, random));
  teams.forEach((team, index) => {
    team.songId = songs[index].id;
  });
  ep.pairings = Array.from({ length: 3 }, (_, index) => ({
    id: `battle-${index + 1}`,
    teamIds: [teams[index * 2].id, teams[index * 2 + 1].id],
    winnerId: null,
  }));
  const paragraphs = ep.pairings.map((pairing) => {
    const [a, b] = pairing.teamIds.map((id) => ep.teams.find((entry) => entry.id === id)!);
    const first = member(state, a.captainId);
    const second = member(state, b.captainId);
    const tense = first.personality.ambition > 4 || battleRelationship(first, second.id) < 40;
    changeBattleRelationship(first, second.id, tense ? -2 : 1);
    changeBattleRelationship(second, first.id, second.personality.gentleness > 0 ? 1 : -1);
    return `${a.name} (${songFor(state, a).title}) faces ${b.name} (${songFor(state, b).title}). ${first.name} responds with ${tense ? 'competitive tension' : 'measured respect'}.`;
  });
  scene(
    ep,
    'battles',
    'Production locks the three pairings',
    paragraphs,
    teams.map((team) => team.captainId),
  );
}

function assignRoles(state: SimulationState, team: BattleTeam, random: RandomSource): void {
  const song = songFor(state, team);
  const ids = [...team.memberIds];
  const permutations = (list: string[]): string[][] =>
    list.length === 1
      ? [list]
      : list.flatMap((id) => permutations(list.filter((other) => other !== id)).map((tail) => [id, ...tail]));
  const fit = (id: string, part: BattleSong['parts'][number]) =>
    part.testedSkills.reduce(
      (sum, requirement, index) =>
        sum +
        (member(state, id).coreSkills[requirement.skill] - requirement.requiredLevel) * (index === 0 ? 2 : 1),
      0,
    );
  // Maximize covered requirements, rather than rewarding the captain with the most demanding part.
  const utility = (order: string[]) =>
    order.reduce((sum, id, index) => {
      const requirements = song.parts[index].testedSkills;
      return (
        sum +
        requirements.reduce(
          (subtotal, requirement, checkIndex) =>
            subtotal +
            Math.min(member(state, id).coreSkills[requirement.skill], requirement.requiredLevel) *
              (checkIndex === 0 ? 2 : 1),
          0,
        )
      );
    }, 0);
  const allocations = permutations(ids).map((order) => ({ order, score: utility(order), tie: random() }));
  allocations.sort((a, b) => b.score - a.score || a.tie - b.tie);
  allocations[0].order.forEach((id, index) => {
    team.partAssignments[id] = song.parts[index].id;
  });
  const candidateBase = (id: string) => {
    const contestant = member(state, id);
    return (
      contestant.coreSkills.visual + contestant.coreSkills.stagePresence + contestant.utilitySkills.charisma
    );
  };
  for (const voterId of ids) {
    const voter = member(state, voterId);
    const eligible = ids
      .filter((id) => id !== voterId)
      .map((id) => ({
        id,
        score: candidateBase(id) + battleRelationship(voter, id) / 20,
        tie: random(),
      }));
    eligible.sort((a, b) => b.score - a.score || a.tie - b.tie);
    team.centerBallots[voterId] = eligible[0].id;
  }
  const votes = (id: string) => Object.values(team.centerBallots).filter((choice) => choice === id).length;
  const ties = new Map(ids.map((id) => [id, random()]));
  team.centerId = [...ids].sort(
    (a, b) =>
      votes(b) - votes(a) ||
      member(state, b).coreSkills.stagePresence - member(state, a).coreSkills.stagePresence ||
      member(state, b).coreSkills.visual - member(state, a).coreSkills.visual ||
      member(state, b).utilitySkills.charisma - member(state, a).utilitySkills.charisma ||
      ties.get(a)! - ties.get(b)!,
  )[0];
  member(state, team.centerId).aggregations.center++;
  member(state, team.captainId).aggregations.leader++;
  for (const id of ids) {
    const contestant = member(state, id);
    const assigned = song.parts.find((part) => part.id === team.partAssignments[id])!;
    const unhappy =
      fit(id, assigned) < -2 ||
      (contestant.personality.ambition > 5 &&
        assigned.testedSkills[0].requiredLevel <
          Math.max(...song.parts.map((part) => part.testedSkills[0].requiredLevel)) &&
        battleRelationship(contestant, team.captainId) < 50);
    team.partReactions[id] = unhappy ? 'unhappy' : fit(id, assigned) >= 0 ? 'happy' : 'neutral';
    if (id !== team.captainId)
      changeBattleRelationship(
        contestant,
        team.captainId,
        team.partReactions[id] === 'unhappy' ? -2 : team.partReactions[id] === 'happy' ? 1 : 0,
      );
  }
}

function preparation(state: SimulationState, random: RandomSource): void {
  const ep = episode(state);
  const teams = orderedTeams(ep);
  const team = teams[ep.teamCursor];
  if (!team) throw new Error('No team remains to prepare.');
  // Resolve the pair's past before A's live performance; B's footage remains hidden until its flashback.
  if (ep.teamCursor % 2 === 0) {
    for (const current of teams.slice(ep.teamCursor, ep.teamCursor + 2)) {
      assignRoles(state, current, random);
      practiceBattleTeam(current, songFor(state, current), state.contestants, random);
    }
  }
  const song = songFor(state, team);
  scene(
    ep,
    'practice',
    `${team.name}: preparation${ep.teamCursor % 2 ? ' flashback' : ''}`,
    [
      `${member(state, team.captainId).name} leads. ${member(state, team.centerId!).name} wins the no-self-vote center ballot. Center is a role, not a hidden score bonus.`,
      ...team.memberIds.map((id) => {
        const contestant = member(state, id);
        const part = song.parts.find((entry) => entry.id === team.partAssignments[id])!;
        return `${contestant.name}: ${part.name}; ${team.partReactions[id]} about the assignment. Practice ${contestant.aggregations.practice}/5.`;
      }),
      ...team.practice.map(
        (session) =>
          `${session.title}: ${session.leadershipSuccess ? 'clear leadership builds coordination' : 'the leadership check exposes coordination problems'}; coordination ${session.coordinationBefore} → ${session.coordinationAfter}.`,
      ),
      `Team coordination: ${team.coordination > 0 ? '+' : ''}${team.coordination}; no permanent skills or fatigue changed.`,
    ],
    [...team.memberIds],
  );
  ep.phase = 'preparation';
}

function featuredConflict(state: SimulationState): void {
  const ep = episode(state);
  const team = orderedTeams(ep)[ep.teamCursor];
  const leader = member(state, team.captainId);
  const candidates = team.memberIds
    .filter((id) => id !== team.captainId)
    .sort(
      (a, b) =>
        battleRelationship(member(state, a), leader.id) - battleRelationship(member(state, b), leader.id) ||
        member(state, b).personality.ambition - member(state, a).personality.ambition ||
        a.localeCompare(b),
    );
  const partner = member(state, candidates[0]);
  const strained = battleRelationship(partner, leader.id) < 40 || battleRelationship(leader, partner.id) < 40;
  ep.conflict = {
    teamId: team.id,
    contestantIds: [leader.id, partner.id],
    description: strained
      ? `${partner.name} and ${leader.name} disagree about how to finish the rehearsal.`
      : `${leader.name} and ${partner.name} weigh a practice approach; this is not a personal fight.`,
  };
  ep.phase = 'conflict';
  scene(
    ep,
    'practice',
    strained ? 'A rehearsal dispute' : 'Choosing a rehearsal approach',
    [
      ep.conflict.description,
      'Support: +2 coordination and +1 mutual bond. Mediate: +1 coordination and +2 mutual bond. Push: +3 coordination but -3 mutual bond. Final coordination stays within ±5.',
    ],
    ep.conflict.contestantIds,
  );
}

function perform(state: SimulationState, random: RandomSource): void {
  const ep = episode(state);
  const teams = orderedTeams(ep);
  const team = teams[ep.teamCursor];
  const paragraphs: string[] = [];
  let composure = 0;
  if (ep.teamCursor % 2 === 1) {
    const opponent = ep.performances.find((entry) => entry.teamId === teams[ep.teamCursor - 1].id)!;
    const resilience =
      team.memberIds.reduce((sum, id) => sum + member(state, id).personality.resilience, 0) / 5;
    composure = opponent.finalScore >= 70 ? (resilience >= 0 ? 1 : -1) : 1;
    for (const id of team.memberIds) {
      ep.composure[id] = composure;
      ep.changes[id] ??= [];
      ep.changes[id].push({
        path: 'episode2.composure',
        before: 0,
        after: composure,
        cause: `Immediate reaction to ${teams[ep.teamCursor - 1].name}'s delivered performance`,
      });
    }
    paragraphs.push(
      `Back in the present, ${team.name} reacts with ${composure > 0 ? 'focused resolve' : 'visible nerves'}: composure 0 → ${composure}. Only stage readiness changes, not the already completed practice.`,
    );
  }
  const performance = scoreBattleTeam(team, songFor(state, team), state.contestants, composure, random);
  ep.performances.push(performance);
  for (const evaluation of performance.evaluations) {
    const contestant = member(state, evaluation.contestantId);
    contestant.grade = evaluation.grade;
    contestant.missionRating =
      evaluation.grade === 'A'
        ? 5
        : evaluation.grade === 'B'
          ? 4
          : evaluation.grade === 'C'
            ? 3
            : evaluation.grade === 'D'
              ? 2
              : 1;
    contestant.events.push('GROUP_BATTLES_PERFORMED');
    if (composure !== 0) {
      ep.composure[contestant.id] = 0;
      ep.changes[contestant.id].push({
        path: 'episode2.composure',
        before: composure,
        after: 0,
        cause: 'Temporary composure is consumed by the Group Battles performance',
      });
    }
  }
  paragraphs.push(
    `${team.name} performs "${songFor(state, team).title}". The judges record individual delivery and bounded coordination; the winner remains sealed until results.`,
  );
  scene(ep, 'battles', `${team.name} performs`, paragraphs, [...team.memberIds]);
  ep.teamCursor++;
  ep.phase = 'performance';
}

function battleWinner(ep: BattleEpisode, teamIds: readonly string[]): string {
  const performances = teamIds.map((id) => ep.performances.find((entry) => entry.teamId === id));
  if (performances.some((entry) => !entry))
    throw new Error('Both teams must perform before a winner exists.');
  const technical = (id: string) =>
    ep.performances
      .find((entry) => entry.teamId === id)!
      .evaluations.reduce((sum, entry) => sum + entry.technicalScore, 0);
  const key = (id: string) =>
    ep.performances.find((entry) => entry.teamId === id)!.evaluations[0].tieBreakKey;
  return [...teamIds].sort(
    (a, b) =>
      ep.performances.find((entry) => entry.teamId === b)!.finalScore -
        ep.performances.find((entry) => entry.teamId === a)!.finalScore ||
      technical(b) - technical(a) ||
      key(a) - key(b) ||
      a.localeCompare(b),
  )[0];
}

function losingIds(ep: BattleEpisode): string[] {
  return ep.pairings.flatMap((pairing) => {
    const winner = battleWinner(ep, pairing.teamIds);
    return ep.teams.find((team) => pairing.teamIds.includes(team.id) && team.id !== winner)!.memberIds;
  });
}

function saves(state: SimulationState): void {
  const ep = episode(state);
  if (!ep.audience) throw new Error('Audience voting must close before saves.');
  const evaluations = ep.performances.flatMap((performance) => performance.evaluations);
  const byId = new Map(evaluations.map((evaluation) => [evaluation.contestantId, evaluation]));
  const eligible = losingIds(ep);
  for (const pairing of ep.pairings) {
    pairing.winnerId = battleWinner(ep, pairing.teamIds);
    const winner = ep.teams.find((team) => team.id === pairing.winnerId)!;
    const loser = ep.teams.find((team) => pairing.teamIds.includes(team.id) && team.id !== winner.id)!;
    scene(
      ep,
      'battles',
      `${pairing.id}: the winner`,
      [
        `${winner.name} wins against ${loser.name}. All five winners are safe; the losing team is at risk. The audience does not choose the battle winner.`,
      ],
      [...winner.memberIds, ...loser.memberIds],
    );
  }
  ep.revealedResults = 3;
  const performanceOrder = (a: string, b: string) =>
    byId.get(b)!.finalScore - byId.get(a)!.finalScore ||
    byId.get(b)!.technicalScore - byId.get(a)!.technicalScore ||
    byId.get(a)!.tieBreakKey - byId.get(b)!.tieBreakKey ||
    a.localeCompare(b);
  ep.judgeSaveId = [...eligible].sort(performanceOrder)[0];
  ep.audienceSaveId = eligible
    .filter((id) => id !== ep.judgeSaveId)
    .sort((a, b) => ep.audience!.votes[b] - ep.audience!.votes[a] || performanceOrder(a, b))[0];
  ep.productionShortlist = eligible
    .filter((id) => id !== ep.judgeSaveId && id !== ep.audienceSaveId)
    .sort(
      (a, b) =>
        member(state, b).aggregations.productionRatio - member(state, a).aggregations.productionRatio ||
        performanceOrder(a, b),
    )
    .slice(0, 3);
  ep.phase = 'saves';
  scene(
    ep,
    'saves',
    'Two lifelines, one decision',
    [
      `The judges save ${member(state, ep.judgeSaveId).name} for the highest individual performance among the losing teams.`,
      `The audience save goes to ${member(state, ep.audienceSaveId).name}, the most-voted remaining at-risk contestant.`,
      'Choose the final production save from the three eligible nominees on the losing teams.',
    ],
    [ep.judgeSaveId, ep.audienceSaveId],
  );
}

/** Snapshot all directional friendships first; apply each survivor→target penalty only once. */
export function applyBattleBacklash(contestants: Contestant[], ep: BattleEpisode): void {
  const relationships = new Map(
    contestants.map((contestant) => [
      contestant.id,
      new Map(
        ep.participantIds
          .filter((id) => id !== contestant.id)
          .map((id) => [id, battleRelationship(contestant, id)]),
      ),
    ]),
  );
  for (const survivorId of ep.survivorIds) {
    const survivor = contestants.find((entry) => entry.id === survivorId)!;
    const penalties = new Map<string, { amount: number; friends: string[] }>();
    for (const friendId of ep.eliminatedIds) {
      if ((relationships.get(survivorId)?.get(friendId) ?? 50) < 60) continue;
      const friendTeam = ep.teams.find((team) => team.memberIds.includes(friendId))!;
      const pairing = ep.pairings.find((entry) => entry.teamIds.includes(friendTeam.id))!;
      const winnerId = pairing.winnerId ?? battleWinner(ep, pairing.teamIds);
      const winner = ep.teams.find((team) => team.id === winnerId)!;
      for (const targetId of winner.memberIds) {
        if (targetId === survivorId) continue;
        const penalty = penalties.get(targetId) ?? { amount: 0, friends: [] };
        penalty.amount = Math.min(30, penalty.amount + 15);
        penalty.friends.push(friendId);
        penalties.set(targetId, penalty);
      }
    }
    for (const [targetId, penalty] of penalties) {
      const before = battleRelationship(survivor, targetId);
      changeBattleRelationship(survivor, targetId, -penalty.amount);
      const after = battleRelationship(survivor, targetId);
      if (before !== after) {
        ep.changes[survivorId] ??= [];
        ep.changes[survivorId].push({
          path: `relationships.${targetId}.affection`,
          before,
          after,
          cause: `Group Battles backlash: eliminated friend(s) ${penalty.friends.join(', ')} lost to ${targetId}'s team; episode penalty capped at -30.`,
        });
      }
    }
  }
}

function revealResult(state: SimulationState, random: RandomSource): void {
  const ep = episode(state);
  const departureCursor = ep.scenes.filter((entry) => entry.kind === 'eliminations').length;
  const pairing = ep.pairings[departureCursor];
  if (!pairing || !ep.productionSaveId) throw new Error('Valid saves are required before revealing results.');
  pairing.winnerId = battleWinner(ep, pairing.teamIds);
  const winner = ep.teams.find((team) => team.id === pairing.winnerId)!;
  const loser = ep.teams.find((team) => pairing.teamIds.includes(team.id) && team.id !== winner.id)!;
  const departing = loser.memberIds.filter((id) => ep.eliminatedIds.includes(id));
  for (const id of departing) {
    const contestant = member(state, id);
    contestant.status = 'ELIMINATED';
    contestant.events.push('GROUP_BATTLES_ELIMINATED');
  }
  scene(
    ep,
    'eliminations',
    `${pairing.id}: departures`,
    [
      `${departing.map((id) => member(state, id).name).join(', ')} leave the competition.`,
      `Saved from ${loser.name}: ${
        loser.memberIds
          .filter((id) => ep.survivorIds.includes(id))
          .map((id) => member(state, id).name)
          .join(', ') || 'none'
      }.`,
    ],
    departing,
  );
  if (departureCursor === 2) {
    applyBattleBacklash(state.contestants, ep);
    state.runtime!.show = transferEliminatedFans(
      state.runtime!.show,
      state.contestants,
      ep.survivorIds,
      random,
    );
    ep.phase = 'mvp';
    scene(
      ep,
      'saves',
      'Eighteen remain',
      [
        'All three saves are final. Twelve contestants depart; the remaining eighteen will vote for a peer MVP.',
        'Close friends of actual departures react to the teams that defeated them. Saved friends do not trigger backlash.',
      ],
      ep.survivorIds,
    );
  }
}

function finish(state: SimulationState): void {
  const ep = episode(state);
  const evaluations = new Map(
    ep.performances
      .flatMap((performance) => performance.evaluations)
      .map((evaluation) => [evaluation.contestantId, evaluation]),
  );
  state.contestants = state.contestants.map((contestant) => {
    if (!ep.participantIds.includes(contestant.id)) return contestant;
    const evaluation = evaluations.get(contestant.id);
    if (!evaluation) throw new Error('Cannot close Group Battles before all thirty performances.');
    return appendContestantHistory(
      contestant,
      {
        phaseId: 'episode-2',
        episode: 2,
        missionRating: contestant.missionRating,
        rank: contestant.rank,
        score: evaluation.finalScore,
        status: contestant.status,
        summary: `${evaluation.grade} Group Battles performance. ${contestant.status === 'ELIMINATED' ? 'Eliminated.' : 'Survives Group Battles.'}${ep.mvp?.winnerId === contestant.id ? ' Peer MVP.' : ''}`,
        events: contestant.events.filter(
          (event) =>
            event.startsWith('GROUP_BATTLES') ||
            (event.startsWith('SECRET_REVEALED:') &&
              ep.secret?.contestantId === contestant.id &&
              event === `SECRET_REVEALED:${ep.secret.cardId}`),
        ),
      },
      ep.changes[contestant.id] ?? [],
    );
  });
  ep.phase = 'complete';
  state.runtime!.phase = 'episode-complete';
  scene(
    ep,
    'recap',
    'Episode 2 complete',
    [
      'Eighteen contestants remain; twelve new departures join the archive.',
      'All performances, saves, peer votes, and closing consequences are saved. Episode 3 will not start automatically.',
    ],
    ep.survivorIds,
  );
}

function captureChanges(state: SimulationState, before: readonly Contestant[], cause: string): void {
  const ep = episode(state);
  for (const id of ep.participantIds) {
    const contestant = member(state, id);
    const previous = before.find((entry) => entry.id === id)!;
    if (recordContestantChanges(previous, contestant, cause).length) {
      contestant.updatedAt = Math.max(previous.updatedAt + 1, state.createdAt + ep.revision);
      ep.changes[id] ??= [];
      ep.changes[id].push(...recordContestantChanges(previous, contestant, cause));
    }
  }
}

export function transitionBattle(
  current: SimulationState,
  action: BattleAction,
  expectedRevision: number,
): SimulationState {
  if (!current.runtime || current.status !== 'ready')
    throw new Error('Initialize a season before starting Group Battles.');
  const existing = current.runtime.battle;
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0)
    throw new Error('Battle revision must be a nonnegative integer.');
  if (
    existing &&
    expectedRevision === existing.lastAction.revision &&
    JSON.stringify(action) === JSON.stringify(existing.lastAction.action)
  )
    return current;
  if (expectedRevision !== (existing?.revision ?? 0))
    throw new Error('This battle action is stale; reload the current episode.');
  if (
    !action ||
    typeof action !== 'object' ||
    !['start', 'advance', 'conflict', 'broadcast', 'production-save', 'secret'].includes(action.type)
  )
    throw new Error('Unknown Group Battles action.');
  if (existing) assertBattleEpisode(existing, current.contestants, current.runtime.definitions);
  const next = structuredClone(current);
  const runtime = next.runtime!;
  const random = createSeededRandom(runtime.randomState);
  const before = structuredClone(next.contestants);
  let closing = false;
  if (action.type === 'start') {
    if (runtime.battle) throw new Error('Episode 2 has already started.');
    runtime.battle = initialEpisode(next, random.next);
    runtime.episode = 2;
    runtime.phase = 'battles';
  } else {
    const ep = episode(next);
    if (ep.phase === 'complete') throw new Error('Episode 2 is complete.');
    ep.revision++;
    ep.lastAction = { revision: expectedRevision, action: structuredClone(action) };
    if (action.type === 'conflict') {
      if (ep.phase !== 'conflict' || !ep.conflict || ep.conflictChoice !== null)
        throw new Error('There is no unresolved practice decision.');
      if (!['support', 'mediate', 'push'].includes(action.choice))
        throw new Error('Choose support, mediate, or push.');
      ep.conflictChoice = action.choice;
      const team = ep.teams.find((entry) => entry.id === ep.conflict!.teamId)!;
      const coordination = action.choice === 'push' ? 3 : action.choice === 'support' ? 2 : 1;
      const bond = action.choice === 'push' ? -3 : action.choice === 'support' ? 1 : 2;
      const coordinationBefore = team.coordination;
      team.coordination = clampBattle(team.coordination + coordination, -5, 5);
      const [a, b] = ep.conflict.contestantIds;
      const first = member(next, a);
      const second = member(next, b);
      const firstRelationshipBefore = battleRelationship(first, b);
      const secondRelationshipBefore = battleRelationship(second, a);
      changeBattleRelationship(first, b, bond);
      changeBattleRelationship(second, a, bond);
      scene(
        ep,
        'practice',
        `Practice decision: ${action.choice}`,
        [
          `Production chooses to ${action.choice} the rehearsal with ${first.name} and ${second.name}.`,
          `Team coordination ${coordinationBefore} → ${team.coordination}.`,
          `${first.name}'s relationship with ${second.name} ${firstRelationshipBefore} → ${battleRelationship(first, b)}; ${second.name}'s relationship with ${first.name} ${secondRelationshipBefore} → ${battleRelationship(second, a)}.`,
        ],
        ep.conflict.contestantIds,
      );
      ep.phase = 'preparation';
    } else if (action.type === 'broadcast') {
      if (ep.phase !== 'broadcast') throw new Error('The broadcast choice is not available.');
      const cut = ep.cuts.find((entry) => entry.id === action.cutId);
      if (!cut) throw new Error('Choose one of the three recorded broadcast cuts.');
      const cast = ep.participantIds.map((id) => member(next, id));
      const songs: AuditionSong[] = ep.teams.map((team) => {
        const song = songFor(next, team);
        return {
          id: song.id,
          title: song.title,
          description: song.description,
          track: 'VOCAL',
          genre: song.genre,
          part: { testedSkills: song.parts[0].testedSkills },
        };
      });
      const mood = runtime.version === 2 ? runtime.preparations?.[2]?.mood : runtime.audition!.mood;
      if (!mood) throw new Error('The episode opening mood is missing.');
      const result = resolveBroadcast({
        contestants: cast,
        evaluations: battleAudienceEvaluations(ep.teams, ep.performances),
        reactions: [],
        cut,
        mood,
        show: runtime.show,
        random: random.next,
        songs,
        castSize: 30,
      });
      const updated = new Map(result.contestants.map((entry) => [entry.id, entry]));
      next.contestants = next.contestants.map((entry) => updated.get(entry.id) ?? entry);
      runtime.show = result.show;
      ep.selectedCutId = cut.id;
      ep.audience = result.outcome;
      ep.finalRankedIds = [...result.contestants].sort((a, b) => a.rank - b.rank).map((entry) => entry.id);
      ep.phase = 'audience';
      scene(
        ep,
        'audience',
        'The broadcast and public vote',
        [
          `${cut.title} reaches ${runtime.show.audience} viewers. Exactly ${ep.audience.votingPopulation} audience votes are closed.`,
          'The continuing ranking combines performance with public support. Battle victories remain a separate judges’ decision.',
        ],
        cut.featuredIds,
      );
    } else if (action.type === 'production-save') {
      if (ep.phase !== 'saves' || !ep.productionShortlist.includes(action.contestantId))
        throw new Error('Choose an eligible contestant from the production-save shortlist.');
      ep.productionSaveId = action.contestantId;
      const saved = new Set([ep.judgeSaveId, ep.audienceSaveId, ep.productionSaveId]);
      ep.eliminatedIds = losingIds(ep).filter((id) => !saved.has(id));
      ep.survivorIds = ep.finalRankedIds.filter((id) => !ep.eliminatedIds.includes(id));
      if (ep.survivorIds.length !== 18 || ep.eliminatedIds.length !== 12)
        throw new Error('Battle saves must leave eighteen survivors and twelve departures.');
      ep.phase = 'results';
      scene(
        ep,
        'saves',
        'The final lifeline',
        [
          `${member(next, action.contestantId).name} receives the production save. All three saves are locked; departures will now be announced one pair at a time.`,
        ],
        [action.contestantId],
      );
    } else if (action.type === 'secret') {
      if (ep.phase !== 'secret' || !ep.secretCandidates.includes(action.contestantId))
        throw new Error('Choose someone from the secret-check shortlist.');
      const result = revealAuditionSecret(next.contestants, action.contestantId, runtime.definitions);
      next.contestants = result.contestants;
      ep.secret = result.result;
      if (ep.secret.cardId) {
        runtime.revealedSecrets.push({ contestantId: action.contestantId, cardId: ep.secret.cardId });
        runtime.deferredConsequences.push(...ep.secret.deferred);
      }
      scene(
        ep,
        'secret',
        ep.secret.title,
        [
          ep.secret.description,
          ...(ep.secret.deferred.length
            ? ['Outcome-changing effects are deferred; the locked Group Battles results do not change.']
            : []),
        ],
        [action.contestantId],
      );
      closing = true;
    } else if (action.type === 'advance') {
      if (ep.phase === 'dorms') {
        if (ep.roomCursor < 5) roomHighlight(next, random.next);
        else {
          ep.phase = 'ranking';
          ep.rankedIds.forEach((id, index) => {
            member(next, id).rank = index + 1;
          });
          scene(
            ep,
            'ranking',
            'The ranking is revealed on stage',
            [
              'The continuing ranking reflects performances and public support. At the final, the top five will debut as Squirrel Zone 2.',
              ...ep.rankedIds.map((id, index) => `${index + 1}. ${member(next, id).name}`),
              'The top six in the Episode 1 combined ranking become captains.',
            ],
            ep.rankedIds,
            [[], ...ep.rankedIds.map((id) => [id]), []],
          );
        }
      } else if (ep.phase === 'ranking') {
        createCaptains(ep);
        ep.phase = 'draft';
        scene(
          ep,
          'draft',
          'Six captains take the floor',
          ['Captains pick in ranking order, one through six, for four rounds. Every pick is final.'],
          ep.teams.map((team) => team.captainId),
        );
      } else if (ep.phase === 'draft') {
        if (ep.draftRound < 4) draftRound(next, random.next);
        else {
          createPairings(next, random.next);
          ep.phase = 'pairings';
        }
      } else if (ep.phase === 'pairings') preparation(next, random.next);
      else if (ep.phase === 'preparation') {
        if (ep.conflictChoice === null) featuredConflict(next);
        else perform(next, random.next);
      } else if (ep.phase === 'performance') {
        if (ep.teamCursor < 6) preparation(next, random.next);
        else {
          ep.cuts = createBroadcastCuts(
            ep.participantIds.map((id) => member(next, id)),
            battleAudienceEvaluations(ep.teams, ep.performances),
            [],
            random.next,
            30,
          );
          for (const cut of ep.cuts) {
            cut.title =
              cut.id === 'music'
                ? 'The group performances'
                : cut.id === 'personalities'
                  ? 'The group personalities'
                  : 'The rehearsal room';
            cut.description =
              'A cut assembled from the recorded Group Battles footage, with baseline coverage for everyone.';
            for (const footage of cut.footage) {
              const team = ep.teams.find((entry) => entry.memberIds.includes(footage.contestantId))!;
              const evaluation = ep.performances
                .flatMap((entry) => entry.evaluations)
                .find((entry) => entry.contestantId === footage.contestantId)!;
              const practice = team.practice.map(
                (session) =>
                  session.contestants.find((entry) => entry.contestantId === footage.contestantId)!
                    .practiceAfter,
              );
              footage.description = `${member(next, footage.contestantId).name}: recorded performance of ${songFor(next, team).title}, graded ${evaluation.grade}; part ${evaluation.partId}; practice readiness ${practice.join(' → ')}.${team.centerId === footage.contestantId ? ' Elected center.' : ''}`;
            }
          }
          ep.phase = 'broadcast';
          scene(
            ep,
            'broadcast',
            'Thirty performances, three possible edits',
            [
              'Every contestant has performed once. Choose a broadcast assembled from the recorded performance and preparation footage.',
            ],
            ep.participantIds,
          );
        }
      } else if (ep.phase === 'audience') saves(next);
      else if (ep.phase === 'results') revealResult(next, random.next);
      else if (ep.phase === 'mvp') {
        ep.mvp = chooseAuditionMvp(
          ep.participantIds.map((id) => member(next, id)),
          battleAudienceEvaluations(ep.teams, ep.performances),
          ep.survivorIds,
          random.next,
          { castSize: 30, survivorCount: 18 },
        );
        const winner = member(next, ep.mvp.winnerId);
        winner.aggregations.mvp++;
        winner.events.push('GROUP_BATTLES_MVP');
        scene(
          ep,
          'mvp',
          'The survivors choose their MVP',
          [
            `${winner.name} wins the eighteen survivors’ peer ballot. Nobody votes for themselves; this honor adds no hidden ranking points.`,
          ],
          [winner.id],
        );
        const eligible = ep.participantIds.filter(
          (id) =>
            !member(next, id).attributes.some(
              (cardId) =>
                Object.hasOwn(runtime.definitions.cards.secret, cardId) &&
                (member(next, id).events.includes(`SECRET_REVEALED:${cardId}`) ||
                  runtime.revealedSecrets.some(
                    (entry) => entry.contestantId === id && entry.cardId === cardId,
                  )),
            ),
        );
        ep.secretCandidates = shuffleWithRandom(eligible, random.next).slice(0, 3);
        if (ep.secretCandidates.length) ep.phase = 'secret';
        else closing = true;
      } else throw new Error('Make the current Group Battles choice before continuing.');
    }
  }
  captureChanges(
    next,
    before,
    action.type === 'advance' && existing?.phase === 'draft' && existing.draftRound < 4
      ? `Episode 2: passed over during draft round ${existing.draftRound + 1}`
      : `Episode 2: ${action.type}`,
  );
  if (closing) finish(next);
  runtime.randomState = random.getState();
  freezeSimulationSnapshot(runtime.sourceContestants);
  freezeSimulationSnapshot(runtime.initialContestants);
  freezeSimulationSnapshot(runtime.definitions);
  next.persistenceError = null;
  assertBattleEpisode(episode(next), next.contestants, runtime.definitions);
  return next;
}
