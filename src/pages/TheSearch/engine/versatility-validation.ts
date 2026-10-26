import type { Contestant } from '../types/contestant';
import type { SimulationDefinitions, SimulationState } from '../types/simulation';
import type { VersatilityEpisode, VersatilityTeam } from '../types/versatility-episode';
import { validateVersatilityCatalogs } from '../utilities/versatility-catalogs';
import {
  chooseEvidenceMvp,
  resolveNarrativeEvidenceAudience,
  transferEliminatedFans,
} from './audition-audience';
import { revealAuditionSecret, revealExactAuditionSecret } from './audition-secrets';
import { battleRelationship, changeBattleRelationship, clampBattle } from './battle-scoring';
import { preserveTrackCondition } from './track-specials-scoring';
import {
  canCompleteVersatility,
  chooseVersatilityPick,
  createVersatilitySlots,
  versatilityPriority,
} from './versatility-draft';
import { selectVersatilityExpulsion, unrevealedVersatilityCards } from './versatility-expulsion';
import { electVersatilityRole, practiceVersatilityTeam, versatilityRefuses } from './versatility-rehearsal';
import { scoreVersatility, versatilityBreakthrough } from './versatility-scoring';

const fail = (detail: string): never => {
  throw new Error(`Invalid Versatility episode: ${detail}.`);
};
const same = (actual: unknown, expected: unknown, detail: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(detail);
};
const unit = (value: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1;
const unique = (ids: string[]) =>
  Array.isArray(ids) && ids.every((id) => typeof id === 'string') && new Set(ids).size === ids.length;
const integer = (value: number, min: number, max: number) =>
  Number.isSafeInteger(value) && value >= min && value <= max;
const phases = [
  'briefing',
  'credits',
  'draft',
  'practice',
  'intervention',
  'guest-reveal',
  'performances',
  'breakthroughs',
  'ranking',
  'holding',
  'expulsion',
  'peer-mvp',
  'secret-choice',
  'secret-result',
  'complete',
];

function replayRandom(values: number[]) {
  if (!Array.isArray(values) || values.some((value) => !unit(value))) fail('saved random evidence');
  let index = 0;
  return {
    next: () => {
      if (index >= values.length) return fail('missing saved random evidence');
      return values[index++];
    },
    done: () => {
      if (index !== values.length) fail('extra saved random evidence');
    },
  };
}
function checkCast(people: readonly Contestant[], detail: string) {
  if (!Array.isArray(people) || people.length !== 50 || !unique(people.map((person) => person.id)))
    fail(detail);
  for (const person of people) {
    if (
      !person ||
      typeof person.name !== 'string' ||
      !['VOCAL', 'RAP', 'DANCE'].includes(person.track) ||
      !Array.isArray(person.attributes) ||
      !Array.isArray(person.events) ||
      !integer(person.rank, 1, 50)
    )
      fail(detail);
    for (const skill of [
      'vocals',
      'rap',
      'dance',
      'stagePresence',
      'visual',
      'uniqueness',
      'leadership',
    ] as const)
      if (!integer(person.coreSkills?.[skill], 1, 5)) fail(detail);
    for (const skill of [
      'potential',
      'memory',
      'stamina',
      'learning',
      'acrobatics',
      'consistency',
      'charisma',
    ] as const)
      if (!integer(person.utilitySkills?.[skill], 1, 5)) fail(detail);
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
      if (!integer(person.personality?.[trait], -10, 10)) fail(detail);
    if (
      !Number.isFinite(person.aggregations?.rankingScore) ||
      !Number.isFinite(person.aggregations?.practice)
    )
      fail(detail);
  }
  if (new Set(people.map((person) => person.rank)).size !== 50) fail(`${detail} placements`);
}
function frozenIdentity(actual: Contestant, baseline: Contestant) {
  same(actual.coreSkills, baseline.coreSkills, 'frozen role skills');
  same(actual.utilitySkills, baseline.utilitySkills, 'frozen role utility');
  same(actual.specialties, baseline.specialties, 'frozen role specialties');
  same(actual.personality, baseline.personality, 'frozen role personality');
  same(actual.relationships, baseline.relationships, 'frozen role relationships');
  if (actual.id !== baseline.id || actual.track !== baseline.track) fail('frozen role identity');
}

export function assertVersatilityEpisode(
  value: unknown,
  contestants: readonly Contestant[],
  definitions: SimulationDefinitions,
): asserts value is VersatilityEpisode {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('record');
  const ep = value as VersatilityEpisode;
  if (
    ep.version !== 1 ||
    !phases.includes(ep.phase) ||
    !integer(ep.revision, 0, Number.MAX_SAFE_INTEGER) ||
    !ep.lastAction ||
    !integer(ep.lastAction.revision, 0, ep.revision) ||
    !ep.lastAction.action ||
    typeof ep.lastAction.action.type !== 'string'
  )
    fail('version, phase or revision');
  const lastAction = ep.lastAction.action;
  if (
    !['start', 'advance', 'conflict', 'secret'].includes(lastAction.type) ||
    (ep.revision === 0 ? lastAction.type !== 'start' : ep.lastAction.revision !== ep.revision - 1) ||
    (lastAction.type === 'conflict' && !['support', 'mediate', 'push'].includes(lastAction.choice)) ||
    (lastAction.type === 'secret' && !ep.participantIds?.includes(lastAction.contestantId))
  )
    fail('last transition evidence');
  const arrays: (keyof VersatilityEpisode)[] = [
    'participantIds',
    'startingContestants',
    'previousRankedIds',
    'teams',
    'slots',
    'draftOrder',
    'draftPicks',
    'performanceOrder',
    'performances',
    'breakthroughs',
    'refusals',
    'evidence',
    'audienceContestants',
    'audienceRandom',
    'mvpContestants',
    'mvpRandom',
    'fanTransfers',
    'secretCandidates',
    'investigationEligibleIds',
    'investigationContestants',
    'rankedIds',
    'survivorIds',
    'eliminatedIds',
    'scenes',
  ];
  for (const key of arrays) if (!Array.isArray(ep[key])) fail(`missing ${key}`);
  const records: (keyof VersatilityEpisode)[] = [
    'draftTieKeys',
    'slotTieKeys',
    'frozenRelationships',
    'priorPractice',
    'exposure',
    'sealedRankingScores',
    'rankingTieKeys',
    'changes',
  ];
  for (const key of records)
    if (!ep[key] || typeof ep[key] !== 'object' || Array.isArray(ep[key])) fail(`missing ${key}`);
  for (const key of [
    'guestId',
    'guestDraw',
    'conflict',
    'audience',
    'audienceBefore',
    'audienceAfter',
    'audienceMood',
    'mvp',
    'secret',
    'expelledId',
    'expulsion',
  ] as const)
    if (ep[key] === undefined) fail(`missing ${key}`);
  if (
    !integer(ep.teamCursor, 0, 2) ||
    !integer(ep.practiceCursor, 0, 2) ||
    typeof ep.rankRevealed !== 'boolean'
  )
    fail('cursors');
  checkCast(ep.startingContestants, 'starting cast');
  checkCast(contestants, 'current cast');
  const start = new Map(ep.startingContestants.map((person) => [person.id, person]));
  const live = new Map(contestants.map((person) => [person.id, person]));
  if (
    !unique(ep.participantIds) ||
    ep.participantIds.length !== 15 ||
    ep.participantIds.some((id) => start.get(id)?.status !== 'ACTIVE') ||
    ep.startingContestants.filter((person) => person.status === 'ACTIVE').length !== 15 ||
    contestants.some((person) => !start.has(person.id))
  )
    fail('exact participants');
  if (
    !unique(ep.previousRankedIds) ||
    ep.previousRankedIds.length !== 16 ||
    ep.participantIds.some((id) => !ep.previousRankedIds.includes(id))
  )
    fail('previous ranking');
  for (const id of ep.participantIds) {
    if (ep.priorPractice[id] !== start.get(id)!.aggregations.practice) fail('prior preparation');
    same(
      ep.frozenRelationships[id],
      Object.fromEntries(
        ep.participantIds.map((other) => [other, battleRelationship(start.get(id)!, other)]),
      ),
      'frozen draft relationships',
    );
  }
  validateVersatilityCatalogs(definitions.versatilitySongs, definitions.doubtGirls, definitions.specialties);
  const people = ep.participantIds.map((id) => start.get(id)!);
  if (
    !unique(ep.openingCast) ||
    (ep.phase === 'briefing'
      ? ep.openingCast.length !== 0
      : ep.openingCast.length < 1 || ep.openingCast.length > 15) ||
    ep.openingCast.some((id) => !ep.participantIds.includes(id))
  )
    fail('confirmed opening cast');
  const rehearsalPeople = new Map(people.map((person) => [person.id, structuredClone(person)]));
  if (ep.teams.length) {
    if (
      ep.teams.length !== 3 ||
      !unique(ep.teams.map((team) => team.id)) ||
      !unique(ep.teams.map((team) => team.songId!))
    )
      fail('three distinct groups and songs');
    const songs = ep.teams.map(
      (team) => definitions.versatilitySongs!.find((song) => song.id === team.songId) ?? fail('frozen song'),
    );
    same(ep.slots, createVersatilitySlots(people, songs), 'feasible fixed role inventory');
    if (!canCompleteVersatility(people, ep.slots)) fail('initial completion');
    for (const id of ep.participantIds) {
      if (!unit(ep.draftTieKeys[id]) || ep.slots.some((slot) => !unit(ep.slotTieKeys[id]?.[slot.id])))
        fail('saved draft ties');
    }
    same(
      ep.draftOrder,
      [...people]
        .sort(
          (a, b) =>
            versatilityPriority(b) - versatilityPriority(a) ||
            a.rank - b.rank ||
            ep.draftTieKeys[a.id] - ep.draftTieKeys[b.id] ||
            a.id.localeCompare(b.id),
        )
        .map((person) => person.id),
      'draft priority',
    );
    if (ep.draftPicks.length > 15) fail('draft length');
    const rosters = Object.fromEntries(ep.teams.map((team) => [team.id, [] as string[]]));
    const assignments = Object.fromEntries(ep.teams.map((team) => [team.id, {} as Record<string, string>]));
    const used = new Set<string>();
    ep.draftPicks.forEach((pick, index) => {
      const id = ep.draftOrder[index];
      if (pick.contestantId !== id || !unit(pick.gamble)) fail('pick order or saved gamble');
      const expected = chooseVersatilityPick(
        start.get(id)!,
        people.filter((person) => !ep.draftOrder.slice(0, index).includes(person.id)),
        ep.slots.filter((slot) => !used.has(slot.id)),
        rosters,
        people,
        pick.gamble,
        ep.slotTieKeys[id],
      );
      same(pick, expected, 'completion-safe choice, tactic or affection');
      const slot = ep.slots.find((slot) => slot.id === pick.slotId)!;
      rosters[slot.teamId].push(id);
      assignments[slot.teamId][id] = slot.partId;
      used.add(slot.id);
    });
    for (const team of ep.teams) {
      same(team.memberIds, rosters[team.id], 'individual draft roster');
      same(team.partAssignments, assignments[team.id], 'actual part assignments');
      if (
        !Array.isArray(team.practice) ||
        team.practice.length > 2 ||
        !Array.isArray(team.leaderContestants) ||
        !Array.isArray(team.centerContestants)
      )
        fail('team rehearsal records');
      if (team.leaderElection) {
        if (team.memberIds.length !== 5 || team.leaderContestants.length !== 5) fail('leader electorate');
        const members = team.memberIds.map((id) => structuredClone(start.get(id)!));
        for (const member of members) member.aggregations.practice = 0;
        team.leaderContestants.forEach((actual, index) => {
          frozenIdentity(actual, members[index]);
        });
        if (team.memberIds.some((id) => !unit(team.leaderElection!.tieKeys[id]))) fail('leader ties');
        same(
          team.leaderElection,
          electVersatilityRole(members, 'leader', team.leaderElection.tieKeys),
          'leader election',
        );
        if (team.captainId !== team.leaderElection.winnerId) fail('leader winner');
        const replay: VersatilityTeam = { ...structuredClone(team), practice: [], coordination: 0 };
        for (const session of team.practice) {
          const dice = [session.leaderDice, ...session.contestants.map((record) => record.rawDice)].flat();
          if (dice.some((die) => !integer(die, 1, 6))) fail('rehearsal dice');
          const random = replayRandom(dice.map((die) => (die - 0.5) / 6));
          practiceVersatilityTeam(replay, members, random.next);
          random.done();
          same(session, replay.practice.at(-1), 'standard rehearsal arithmetic');
        }
        const expectedRefusals =
          team.practice.length === 2
            ? members
                .filter((member) => versatilityRefuses(member, replay))
                .map((member) => ({
                  contestantId: member.id,
                  teamId: team.id,
                  leaderId: team.captainId,
                  penalty: -10,
                }))
            : [];
        same(
          ep.refusals.filter((record) => record.teamId === team.id),
          expectedRefusals,
          'stalled-session refusal gate',
        );
        for (const refusal of expectedRefusals) {
          for (const member of members)
            if (member.id !== refusal.contestantId)
              changeBattleRelationship(member, refusal.contestantId, -2);
          if (refusal.contestantId !== team.captainId)
            changeBattleRelationship(
              members.find((member) => member.id === refusal.contestantId)!,
              team.captainId,
              -1,
            );
        }
        if (team.intervention) {
          const leader = members.find((member) => member.id === team.captainId)!;
          const trouble = members
            .filter((member) => member.id !== leader.id)
            .find((member) => {
              const stalled = replay.practice.some(
                (session) =>
                  !session.contestants.find((record) => record.contestantId === member.id)!.improved,
              );
              return (
                stalled &&
                ((leader.personality.discipline >= 5 &&
                  member.personality.discipline <= -3 &&
                  leader.personality.discipline - member.personality.discipline >= 10) ||
                  (battleRelationship(leader, member.id) < 35 && battleRelationship(member, leader.id) < 35))
              );
            });
          if (!trouble) fail('invented conflict');
          same(team.intervention.contestantIds, [leader.id, trouble!.id], 'real conflict participants');
          changeBattleRelationship(leader, trouble!.id, -2);
          changeBattleRelationship(trouble!, leader.id, -2);
          const choice = team.intervention.choice;
          if (choice !== null) {
            if (!['support', 'mediate', 'push'].includes(choice)) fail('conflict decision');
            replay.coordination = clampBattle(
              replay.coordination + (choice === 'push' ? 3 : choice === 'support' ? 2 : 1),
              -5,
              5,
            );
            changeBattleRelationship(
              leader,
              trouble!.id,
              choice === 'push' ? -3 : choice === 'mediate' ? 2 : 1,
            );
            changeBattleRelationship(
              trouble!,
              leader.id,
              choice === 'push' ? -3 : choice === 'mediate' ? 2 : 1,
            );
          } else if (ep.phase !== 'intervention' || ep.conflict?.teamId !== team.id)
            fail('blocking conflict');
        }
        if (team.coordination !== replay.coordination) fail('coordination');
        for (const member of members) rehearsalPeople.set(member.id, member);
        if (team.centerElection) {
          if (
            team.practice.length !== 2 ||
            team.centerContestants.length !== 5 ||
            (team.intervention && !team.intervention.choice)
          )
            fail('center timing');
          team.centerContestants.forEach((actual, index) => {
            frozenIdentity(actual, members[index]);
          });
          if (team.memberIds.some((id) => !unit(team.centerElection!.tieKeys[id]))) fail('center ties');
          same(
            team.centerElection,
            electVersatilityRole(members, 'center', team.centerElection.tieKeys),
            'center election',
          );
          if (team.centerId !== team.centerElection.winnerId) fail('center winner');
          same(team.centerBallots, team.centerElection.ballots, 'center ballots');
        } else if (team.centerId !== null) fail('unrecorded center');
      } else if (team.practice.length || team.captainId || team.centerElection)
        fail('practice before leader');
    }
    same(
      ep.performanceOrder,
      ep.teams.map((team) => team.id),
      'performance order',
    );
  } else if (
    ep.slots.length ||
    ep.draftPicks.length ||
    ep.draftOrder.length ||
    !['briefing', 'credits'].includes(ep.phase)
  )
    fail('draft timing');
  if (ep.phase !== 'draft' && !['briefing', 'credits'].includes(ep.phase) && ep.draftPicks.length !== 15)
    fail('unfinished draft');
  const afterGuest = phases.indexOf(ep.phase) >= phases.indexOf('guest-reveal');
  if (afterGuest) {
    if (!unit(ep.guestDraw!)) fail('uniform guest draw');
    if (
      ep.guestId !== definitions.doubtGirls![Math.floor(ep.guestDraw! * 5)].id ||
      ep.teams.some((team) => !team.centerId || team.practice.length !== 2)
    )
      fail('guest identity or timing');
  } else if (ep.guestId !== null || ep.guestDraw !== null || ep.performances.length)
    fail('premature guest or result');
  if (ep.performances.length > 3) fail('performance count');
  ep.performances.forEach((performance, index) => {
    const team = ep.teams.find((team) => team.id === ep.performanceOrder[index]) ?? fail('performed team');
    if (performance.teamId !== team.id || performance.evaluations.length !== 5)
      fail('performance participants');
    performance.evaluations.forEach((evaluation, memberIndex) => {
      const id = team.memberIds[memberIndex];
      if (evaluation.contestantId !== id) fail('performed identity');
      const slot = ep.slots.find(
        (slot) => slot.id === ep.draftPicks.find((pick) => pick.contestantId === id)!.slotId,
      )!;
      const practice = team.practice[1].contestants.find(
        (record) => record.contestantId === id,
      )!.practiceAfter;
      const expected = scoreVersatility(
        start.get(id)!,
        team,
        definitions.versatilitySongs!.find((song) => song.id === team.songId)!,
        slot.track,
        definitions.doubtGirls!.find((member) => member.id === ep.guestId)!,
        evaluation.rawDice,
        practice,
        ep.refusals.some((record) => record.contestantId === id) ? -10 : 0,
      );
      same(evaluation, expected, 'frozen pre-growth skill, checks, guest bonus or result');
    });
    const mean = performance.evaluations.reduce((sum, evaluation) => sum + evaluation.finalScore, 0) / 5;
    if (
      performance.meanScore !== mean ||
      performance.finalScore !== mean ||
      performance.comments.length !== 4 ||
      new Set(performance.comments.map((comment) => comment.judgeId)).size !== 4 ||
      ['john', 'megan', 'michael', ep.guestId!].some(
        (id) => !performance.comments.some((comment) => comment.judgeId === id),
      )
    )
      fail('group mean or four judges');
  });
  const grown = phases.indexOf(ep.phase) >= phases.indexOf('breakthroughs');
  if (grown) {
    if (ep.performances.length !== 3 || ep.breakthroughs.length !== 15)
      fail('growth before locked performances');
    ep.performances
      .flatMap((performance) => performance.evaluations)
      .forEach((evaluation, index) => {
        const record = ep.breakthroughs[index];
        same(
          record,
          versatilityBreakthrough(
            start.get(evaluation.contestantId)!,
            evaluation.track,
            record.gateDie,
            record.potentialDie,
          ),
          'rare breakthrough predicate and actual capped delta',
        );
      });
  } else if (ep.breakthroughs.length) fail('early growth');
  if (ep.rankRevealed !== phases.indexOf(ep.phase) >= phases.indexOf('ranking')) fail('rank reveal timing');
  if (ep.rankRevealed) {
    const evidence = ep.performances.flatMap((performance) =>
      performance.evaluations.map((evaluation) => ({
        contestantId: evaluation.contestantId,
        finalScore: evaluation.finalScore,
        observedScore: evaluation.finalScore,
        reception: evaluation.finalScore,
        category: evaluation.track,
      })),
    );
    same(ep.evidence, evidence, 'locked audience evidence');
    same(ep.exposure, Object.fromEntries(ep.participantIds.map((id) => [id, 1 / 15])), 'positive exposure');
    if (
      !ep.audience ||
      !ep.audienceBefore ||
      !ep.audienceAfter ||
      !ep.audienceMood ||
      ep.audienceContestants.length !== 15
    )
      fail('public vote evidence');
    if (
      !unique(ep.audienceContestants.map((person) => person.id)) ||
      ep.audienceContestants.some((person) => !ep.participantIds.includes(person.id))
    )
      fail('audience participant identities');
    for (const person of ep.audienceContestants) {
      const original = start.get(person.id)!;
      if (
        person.aggregations.rankingScore !== original.aggregations.rankingScore ||
        person.aggregations.productionRatio !== original.aggregations.productionRatio ||
        person.aggregations.fanbaseRatio !== original.aggregations.fanbaseRatio
      )
        fail('frozen audience point inputs');
      same(person.specialties, original.specialties, 'audience own specialties');
      same(person.personality, original.personality, 'audience personality inputs');
      const openingMatch = ep.openingCast.includes(person.id);
      const expressive = original.personality.curiosity >= 5 || original.specialties.visualVibe === 'CUTE';
      const afterOpening = clampBattle(
        original.aggregations.audienceRatio + (openingMatch ? 0.02 : 0),
        -1,
        1,
      );
      if (person.aggregations.audienceRatio !== clampBattle(afterOpening + (expressive ? 0.02 : 0), -1, 1))
        fail('once-only opening and expressive preferences');
    }
    const random = replayRandom(ep.audienceRandom);
    const result = resolveNarrativeEvidenceAudience({
      contestants: ep.audienceContestants,
      evidence: ep.evidence,
      exposure: ep.exposure,
      mood: ep.audienceMood!,
      show: ep.audienceBefore!,
      random: random.next,
    });
    random.done();
    same(ep.audience, result.outcome, 'ordinary audience outcome');
    same(ep.audienceAfter, result.show, 'audience conservation');
    same(
      ep.sealedRankingScores,
      Object.fromEntries(result.contestants.map((person) => [person.id, person.aggregations.rankingScore])),
      'sealed points formula',
    );
    if (ep.participantIds.some((id) => !unit(ep.rankingTieKeys[id]))) fail('ranking ties');
    same(
      ep.rankedIds,
      [...ep.participantIds].sort(
        (a, b) =>
          ep.sealedRankingScores[b] - ep.sealedRankingScores[a] ||
          ep.rankingTieKeys[a] - ep.rankingTieKeys[b] ||
          a.localeCompare(b),
      ),
      'announced order',
    );
    same(ep.eliminatedIds, ep.rankedIds.slice(13), 'two ranked departures');
    const survivors = ep.rankedIds.slice(0, 13).filter((id) => id !== ep.expelledId);
    same(ep.survivorIds, survivors, 'survivor relative order');
    if (ep.fanTransfers.length !== (ep.expulsion ? 2 : 1)) fail('once-only fan departures');
    let show = ep.audienceAfter!;
    ep.fanTransfers.forEach((transfer, index) => {
      const ids = index ? survivors : ep.rankedIds.slice(0, 13);
      same(transfer.survivorIds, ids, 'actual fan departure roster');
      same(transfer.before, show, 'fan continuity');
      const random = replayRandom(transfer.random);
      const nextShow = transferEliminatedFans(show, contestants, ids, random.next);
      random.done();
      same(transfer.after, nextShow, 'fan population conservation');
      show = nextShow;
    });
  } else {
    if (
      ep.rankedIds.length ||
      ep.survivorIds.length ||
      ep.eliminatedIds.length ||
      ep.audience !== null ||
      Object.keys(ep.sealedRankingScores).length ||
      ep.fanTransfers.length
    )
      fail('early ranking');
  }
  const expelled = phases.indexOf(ep.phase) >= phases.indexOf('expulsion');
  if (expelled) {
    const record = ep.expulsion ?? fail('missing expulsion');
    if (ep.expelledId !== record.contestantId) fail('expelled identity');
    checkCast(record.beforeContestants, 'pre-expulsion cast');
    for (const before of record.beforeContestants) {
      const original = start.get(before.id) ?? fail('expulsion snapshot identity');
      same(before.attributes, original.attributes, 'pre-expulsion held cards');
      same(
        before.relationships,
        rehearsalPeople.get(before.id)?.relationships ?? original.relationships,
        'pre-expulsion actual bonds',
      );
      const grownSkills = structuredClone(original.coreSkills);
      for (const growth of ep.breakthroughs.filter((growth) => growth.contestantId === before.id))
        grownSkills[growth.skill] = growth.after;
      same(before.coreSkills, grownSkills, 'pre-expulsion grown skills');
      same(before.utilitySkills, original.utilitySkills, 'pre-expulsion utility skills');
      same(before.personality, original.personality, 'pre-expulsion traits');
      const expectedEvents = ep.eliminatedIds.includes(before.id)
        ? [...original.events, 'VERSATILITY_ELIMINATED']
        : original.events;
      same(before.events, expectedEvents, 'pre-expulsion actual revelations');
    }
    const draws = [
      ...record.eligibleIds.map((id) => record.tieKeys[id]),
      ...(record.assigned ? [record.assignmentDraw!] : []),
    ];
    const random = replayRandom(draws);
    const result = selectVersatilityExpulsion(
      record.beforeContestants,
      ep.rankedIds.slice(0, 13),
      definitions,
      random.next,
    );
    random.done();
    same(
      record,
      result.expulsion,
      'actual-secret candidates, all-peer incoming totals, fallback assignment or revelation',
    );
    if (!ep.scenes.some((scene) => scene.kind === 'dorms' && scene.sequence === 7))
      fail('missing thirteen-person holding beat');
    if (!ep.scenes.some((scene) => scene.kind === 'eliminations' && scene.sequence === 8))
      fail('missing genuine revelation');
  } else if (ep.expulsion !== null || ep.expelledId !== null) fail('future expulsion');
  if (phases.indexOf(ep.phase) >= phases.indexOf('peer-mvp')) {
    if (!ep.mvp || ep.mvpContestants.length !== 15) fail('twelve-person MVP');
    if (
      !unique(ep.mvpContestants.map((person) => person.id)) ||
      ep.mvpContestants.some((person) => !ep.participantIds.includes(person.id))
    )
      fail('MVP electorate identities');
    for (const person of ep.mvpContestants) {
      const original = start.get(person.id)!;
      same(person.relationships, rehearsalPeople.get(person.id)!.relationships, 'MVP actual bonds');
      let expected = [structuredClone(original)];
      for (const growth of ep.breakthroughs.filter((growth) => growth.contestantId === person.id))
        expected[0].coreSkills[growth.skill] = growth.after;
      if (ep.expulsion?.contestantId === person.id) {
        if (ep.expulsion.assigned) expected[0].attributes.push(ep.expulsion.cardId);
        expected = revealExactAuditionSecret(
          expected,
          person.id,
          ep.expulsion.cardId,
          definitions,
        ).contestants;
      }
      same(person.personality, expected[0].personality, 'MVP actual traits');
    }
    const random = replayRandom(ep.mvpRandom);
    same(
      ep.mvp,
      chooseEvidenceMvp(ep.mvpContestants, ep.evidence, ep.survivorIds, random.next, 12),
      'no-self MVP from actual performances and bonds',
    );
    random.done();
  } else if (ep.mvp !== null || ep.mvpRandom.length) fail('early MVP');
  if (phases.indexOf(ep.phase) >= phases.indexOf('secret-choice')) {
    checkCast(ep.investigationContestants, 'investigation cast');
    for (const person of ep.investigationContestants) {
      const original = start.get(person.id) ?? fail('investigation snapshot identity');
      const expectedAttributes =
        ep.expulsion?.assigned && ep.expelledId === person.id
          ? [...original.attributes, ep.expulsion.cardId]
          : original.attributes;
      same(person.attributes, expectedAttributes, 'investigation actual held cards');
      const expectedEvents = [
        ...original.events,
        ...(ep.eliminatedIds.includes(person.id) ? ['VERSATILITY_ELIMINATED'] : []),
        ...(ep.expelledId === person.id
          ? [`SECRET_REVEALED:${ep.expulsion!.cardId}`, 'VERSATILITY_EXPELLED']
          : []),
      ];
      same(person.events, expectedEvents, 'investigation actual revelations');
    }
    const eligible = ep.survivorIds.filter((id) => {
      const person = ep.investigationContestants.find((person) => person.id === id)!;
      return (
        !person.events.some((event) => event.startsWith('SECRET_REVEALED:')) ||
        unrevealedVersatilityCards(person, definitions).length > 0
      );
    });
    same(ep.investigationEligibleIds, eligible, 'standard investigation eligibility');
    const available = eligible.some(
      (id) =>
        unrevealedVersatilityCards(
          ep.investigationContestants.find((person) => person.id === id)!,
          definitions,
        ).length,
    );
    if (
      !unique(ep.secretCandidates) ||
      ep.secretCandidates.length !== (available ? Math.min(3, eligible.length) : 0) ||
      ep.secretCandidates.some((id) => !eligible.includes(id))
    )
      fail('shortlist gates');
    if (ep.secret) {
      if (!ep.secretCandidates.includes(ep.secret.contestantId)) fail('investigation choice');
      const entry = ep.investigationContestants.find((person) => person.id === ep.secret!.contestantId)!;
      const cards = unrevealedVersatilityCards(entry, definitions);
      const result = cards.length
        ? revealExactAuditionSecret(ep.investigationContestants, entry.id, cards[0], definitions)
        : revealAuditionSecret(ep.investigationContestants, entry.id, definitions);
      same(ep.secret, result.result, 'actual investigation result');
    } else if (ep.phase === 'secret-choice' && !ep.secretCandidates.length) fail('empty blocking shortlist');
  } else if (ep.secretCandidates.length || ep.secret !== null || ep.investigationContestants.length)
    fail('early investigation');
  for (const entry of contestants) {
    const original = start.get(entry.id)!;
    if (!ep.participantIds.includes(entry.id)) {
      if (entry.rank !== original.rank || entry.status !== original.status) fail('older placements changed');
      same(entry.coreSkills, original.coreSkills, 'older skills changed');
      continue;
    }
    const expected = structuredClone(original);
    for (const record of ep.breakthroughs.filter((record) => record.contestantId === entry.id))
      expected.coreSkills[record.skill] = record.after;
    let cast = [expected];
    if (ep.expulsion?.contestantId === entry.id) {
      if (ep.expulsion.assigned) expected.attributes.push(ep.expulsion.cardId);
      cast = revealExactAuditionSecret(cast, entry.id, ep.expulsion.cardId, definitions).contestants;
    }
    if (ep.secret?.cardId && ep.secret.contestantId === entry.id)
      cast = revealExactAuditionSecret(cast, entry.id, ep.secret.cardId, definitions).contestants;
    same(entry.coreSkills, cast[0].coreSkills, 'permanent skill changes');
    same(entry.utilitySkills, cast[0].utilitySkills, 'secret utility changes');
    same(entry.personality, cast[0].personality, 'secret personality changes');
    same(entry.specialties, original.specialties, 'unchanged primary specialties');
    same(entry.attributes, cast[0].attributes, 'actual held cards');
    same(
      entry.relationships,
      rehearsalPeople.get(entry.id)!.relationships,
      'directed rehearsal and refusal relationships',
    );
    const roleTeam = ep.teams.find((team) => team.memberIds.includes(entry.id));
    if (
      entry.aggregations.leader !== original.aggregations.leader + Number(roleTeam?.captainId === entry.id) ||
      entry.aggregations.center !== original.aggregations.center + Number(roleTeam?.centerId === entry.id) ||
      entry.aggregations.mvp !== original.aggregations.mvp + Number(ep.mvp?.winnerId === entry.id)
    )
      fail('once-only role and MVP counters');
    if (entry.track !== original.track) fail('changed primary track');
    const rank = !ep.rankRevealed
      ? original.rank
      : ep.eliminatedIds.includes(entry.id)
        ? 14 + ep.eliminatedIds.indexOf(entry.id)
        : entry.id === ep.expelledId
          ? 13
          : ep.survivorIds.indexOf(entry.id) + 1;
    if (
      entry.rank !== rank ||
      entry.status !==
        (ep.eliminatedIds.includes(entry.id) || entry.id === ep.expelledId ? 'ELIMINATED' : 'ACTIVE')
    )
      fail('all fifty final placements');
    if (
      entry.aggregations.rankingScore !==
      (ep.rankRevealed ? ep.sealedRankingScores[entry.id] : original.aggregations.rankingScore)
    )
      fail('public score visibility or late rerank');
    if (ep.phase === 'complete' && entry.aggregations.practice !== ep.priorPractice[entry.id])
      fail('practice restoration');
    if (expelled && ep.survivorIds.includes(entry.id)) {
      const pre = ep.expulsion!.beforeContestants.find((person) => person.id === entry.id)!;
      let condition = preserveTrackCondition(
        pre.condition,
        pre.personality.sensitivity >= 5 ? 'ANXIOUS' : 'STRESSED',
      );
      if (ep.secret?.cardId && ep.secret.contestantId === entry.id) {
        const effect = definitions.cards.secret[ep.secret.cardId].consequence?.condition;
        if (typeof effect === 'string') condition = effect;
      }
      if (entry.condition !== condition) fail('persistent shock condition');
    }
  }
  if (!ep.scenes.length || !unique(ep.scenes.map((scene) => scene.id))) fail('scenes');
  for (const scene of ep.scenes) {
    if (
      !Array.isArray(scene.paragraphs) ||
      scene.paragraphs.some((text) => typeof text !== 'string') ||
      !unique(scene.contestantIds) ||
      scene.contestantIds.some((id) => !ep.participantIds.includes(id)) ||
      !integer(scene.sequence!, 1, 8) ||
      !Array.isArray(scene.paragraphContestantIds) ||
      scene.paragraphContestantIds.length !== scene.paragraphs.length ||
      scene.paragraphContestantIds.some(
        (ids) => !Array.isArray(ids) || ids.some((id) => !ep.participantIds.includes(id)),
      )
    )
      fail('narrative references');
    if (scene.presentation === 'credits' && (scene.kind !== 'opening' || scene.sequence !== 1))
      fail('false opening');
  }
  for (const [id, changes] of Object.entries(ep.changes)) {
    if (
      !ep.participantIds.includes(id) ||
      !Array.isArray(changes) ||
      changes.some((change) => !change || typeof change.path !== 'string' || typeof change.cause !== 'string')
    )
      fail('change records');
  }
}

export function validateVersatility(state: SimulationState): void {
  const runtime = state.runtime;
  if (!runtime?.versatility) return;
  assertVersatilityEpisode(runtime.versatility, state.contestants, runtime.definitions);
  const ep = runtime.versatility;
  const archived = runtime.episode >= 8 && !!runtime.varietyShow && ep.phase === 'complete';
  if (
    !archived &&
    (runtime.episode !== 7 ||
      runtime.phase !== (ep.phase === 'complete' ? 'episode-complete' : 'versatility'))
  )
    fail('runtime phase');
  const show = ep.fanTransfers.at(-1)?.after ?? ep.audienceAfter;
  if (show)
    same(
      archived ? runtime.varietyShow!.startingShow : runtime.show,
      show,
      archived ? 'Episode 8 audience boundary' : 'live audience population',
    );
  if (
    ep.expulsion &&
    runtime.revealedSecrets.filter(
      (entry) => entry.contestantId === ep.expelledId && entry.cardId === ep.expulsion!.cardId,
    ).length !== 1
  )
    fail('once-only expulsion reveal registry');
  if (
    ep.secret?.cardId &&
    runtime.revealedSecrets.filter(
      (entry) => entry.contestantId === ep.secret!.contestantId && entry.cardId === ep.secret!.cardId,
    ).length !== 1
  )
    fail('once-only investigation reveal registry');
}
