import type { EpisodeScene } from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import type { SimulationState } from '../types/simulation';
import type {
  VersatilityAction,
  VersatilityEpisode,
  VersatilityPhase,
  VersatilityTeam,
} from '../types/versatility-episode';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { validateVersatilityCatalogs } from '../utilities/versatility-catalogs';
import { awardNewActivity, recordSceneTV } from './activity-awards';
import {
  chooseEvidenceMvp,
  resolveNarrativeEvidenceAudience,
  transferEliminatedFans,
} from './audition-audience';
import { rollAuditionDice } from './audition-scoring';
import { revealAuditionSecret, revealExactAuditionSecret } from './audition-secrets';
import { battleRelationship, changeBattleRelationship, clampBattle } from './battle-scoring';
import { appendContestantHistory, recordContestantChanges } from './change-history';
import { applyPreparation, initializePreparation, playOpening } from './episode-preparation';
import { createSeededRandom, type RandomSource, shuffleWithRandom } from './random';
import { preserveTrackCondition } from './track-specials-scoring';
import { chooseVersatilityPick, createVersatilitySlots, versatilityPriority } from './versatility-draft';
import { selectVersatilityExpulsion, unrevealedVersatilityCards } from './versatility-expulsion';
import { electVersatilityRole, practiceVersatilityTeam, versatilityRefuses } from './versatility-rehearsal';
import { scoreVersatility, versatilityBreakthrough } from './versatility-scoring';
import { assertVersatilityEpisode, validateVersatility } from './versatility-validation';

export { assertVersatilityEpisode, validateVersatility } from './versatility-validation';

const mention = (id: string) => `[[contestant:${id}]]`;
const epFor = (state: SimulationState) => {
  if (!state.runtime?.versatility) throw new Error('Start Versatility first.');
  return state.runtime.versatility;
};
const person = (state: SimulationState, id: string) => {
  const entry = state.contestants.find((entry) => entry.id === id);
  if (!entry) throw new Error(`Unknown Versatility contestant "${id}".`);
  return entry;
};
const songFor = (state: SimulationState, team: VersatilityTeam) => {
  const song = state.runtime!.definitions.versatilitySongs!.find((song) => song.id === team.songId);
  if (!song) throw new Error('Missing frozen Versatility song.');
  return song;
};
const recordRandom =
  (values: number[], random: RandomSource): RandomSource =>
  () => {
    const value = random();
    values.push(value);
    return value;
  };

function append(
  state: SimulationState,
  phase: VersatilityPhase,
  sequence: number,
  title: string,
  paragraphs: string[],
  ids: string[] = [],
  tier: 0 | 1 | 3 | 6 = 1,
  personnel?: { name: string; role: string },
) {
  const ep = epFor(state);
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
    phase === 'credits'
      ? 'opening'
      : phase === 'draft'
        ? 'draft'
        : phase === 'practice' || phase === 'intervention'
          ? 'practice'
          : phase === 'performances'
            ? 'battles'
            : phase === 'ranking'
              ? 'ranking'
              : phase === 'holding'
                ? 'dorms'
                : phase === 'expulsion'
                  ? 'eliminations'
                  : phase === 'secret-choice' || phase === 'secret-result'
                    ? 'secret'
                    : phase === 'peer-mvp'
                      ? 'mvp'
                      : 'recap';
  ep.phase = phase;
  ep.scenes.push(
    recordSceneTV(
      {
        id: `versatility-${ep.scenes.length}`,
        sequence,
        kind,
        title,
        paragraphs: plain,
        contestantIds: [...new Set(ids)],
        paragraphContestantIds: references,
        presentation:
          phase === 'credits'
            ? 'credits'
            : phase === 'performances'
              ? 'performance'
              : personnel
                ? 'host'
                : 'montage',
        ...(personnel ? { speaker: personnel } : {}),
      },
      tier,
    ),
  );
  for (const id of ids) if (ep.participantIds.includes(id)) person(state, id).aggregations.screenTime++;
}
const host = { name: 'Mike Philip', role: 'Host' };

function start(state: SimulationState) {
  const runtime = state.runtime!;
  const ids = [...runtime.trackSpecials!.survivorIds];
  const active = state.contestants.filter((entry) => entry.status === 'ACTIVE');
  if (
    ids.length !== 15 ||
    new Set(ids).size !== 15 ||
    active.length !== 15 ||
    active.some((entry) => !ids.includes(entry.id))
  )
    throw new Error('Versatility requires exactly the fifteen Track Specials survivors.');
  validateVersatilityCatalogs(
    runtime.definitions.versatilitySongs,
    runtime.definitions.doubtGirls,
    runtime.definitions.specialties,
  );
  runtime.versatility = {
    version: 1,
    phase: 'briefing',
    revision: 0,
    lastAction: { revision: 0, action: { type: 'start' } },
    participantIds: ids,
    startingContestants: structuredClone(state.contestants),
    previousRankedIds: [...runtime.trackSpecials!.rankedIds],
    openingCast: [],
    teams: [],
    slots: [],
    draftOrder: [],
    draftTieKeys: {},
    slotTieKeys: {},
    draftPicks: [],
    frozenRelationships: Object.fromEntries(
      ids.map((id) => [
        id,
        Object.fromEntries(ids.map((other) => [other, battleRelationship(person(state, id), other)])),
      ]),
    ),
    priorPractice: Object.fromEntries(ids.map((id) => [id, person(state, id).aggregations.practice])),
    teamCursor: 0,
    practiceCursor: 0,
    performanceOrder: [],
    conflict: null,
    refusals: [],
    guestId: null,
    guestDraw: null,
    performances: [],
    breakthroughs: [],
    evidence: [],
    exposure: {},
    audience: null,
    audienceContestants: [],
    audienceBefore: null,
    audienceAfter: null,
    audienceRandom: [],
    audienceMood: null,
    mvp: null,
    mvpContestants: [],
    mvpRandom: [],
    fanTransfers: [],
    secretCandidates: [],
    investigationEligibleIds: [],
    investigationContestants: [],
    secret: null,
    rankedIds: [],
    survivorIds: [],
    eliminatedIds: [],
    expelledId: null,
    expulsion: null,
    rankRevealed: false,
    sealedRankingScores: {},
    rankingTieKeys: {},
    scenes: [],
    changes: {},
  };
  runtime.episode = 7;
  runtime.phase = 'versatility';
  for (const id of ids) person(state, id).aggregations.practice = 0;
  append(
    state,
    'briefing',
    1,
    'Versatility: outside your specialty',
    [
      '"Tonight you will interpret three Doubt Girls songs, in groups of five. Everyone must take a role outside their primary track. There are no exceptions."',
      ...ids
        .slice(0, 3)
        .map(
          (id) =>
            `${mention(id)} ${person(state, id).personality.curiosity >= 5 ? 'welcomes a chance to try a new kind of performance' : 'listens closely to the unfamiliar-role rule'}.`,
        ),
      '"John, Megan and Michael remain on the panel. A fourth judge will join us after rehearsals."',
    ],
    ids.slice(0, 3),
    1,
    host,
  );
}

function initializeDraft(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const songs = shuffleWithRandom(state.runtime!.definitions.versatilitySongs!, random).slice(0, 3);
  const people = ep.participantIds.map((id) => person(state, id));
  ep.slots = createVersatilitySlots(people, songs);
  ep.teams = songs.map((song, index) => ({
    id: `versatility-${index + 1}`,
    name: `Group ${index + 1}`,
    songId: song.id,
    captainId: '',
    memberIds: [],
    centerId: null,
    centerBallots: {},
    partAssignments: {},
    partReactions: {},
    coordination: 0,
    practice: [],
    leaderElection: null,
    centerElection: null,
    leaderContestants: [],
    centerContestants: [],
    intervention: null,
  }));
  ep.draftTieKeys = Object.fromEntries(people.map((entry) => [entry.id, random()]));
  ep.slotTieKeys = Object.fromEntries(
    people.map((entry) => [entry.id, Object.fromEntries(ep.slots.map((slot) => [slot.id, random()]))]),
  );
  ep.draftOrder = [...people]
    .sort(
      (a, b) =>
        versatilityPriority(b) - versatilityPriority(a) ||
        a.rank - b.rank ||
        ep.draftTieKeys[a.id] - ep.draftTieKeys[b.id] ||
        a.id.localeCompare(b.id),
    )
    .map((entry) => entry.id);
  ep.performanceOrder = ep.teams.map((team) => team.id);
  append(
    state,
    'draft',
    2,
    'Three songs, fifteen fixed off-track slots',
    [
      ...ep.teams.map(
        (team) =>
          `${team.name}: ${songFor(state, team).title}. ${songFor(state, team).concept} Roles: ${ep.slots
            .filter((slot) => slot.teamId === team.id)
            .map((slot) => slot.track)
            .join(', ')}.`,
      ),
      `Picking order: ${ep.draftOrder.map(mention).join(', ')}.`,
      'Backing arrangements support every legal role combination; each pick must leave a complete off-track assignment for the remaining performers.',
    ],
    [],
  );
}

function draft(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const id = ep.draftOrder[ep.draftPicks.length];
  const baseline = ep.startingContestants.filter((entry) => ep.participantIds.includes(entry.id));
  const remaining = baseline.filter((entry) => !ep.draftPicks.some((pick) => pick.contestantId === entry.id));
  const free = ep.slots.filter((slot) => !ep.draftPicks.some((pick) => pick.slotId === slot.id));
  const pick = chooseVersatilityPick(
    baseline.find((entry) => entry.id === id)!,
    remaining,
    free,
    Object.fromEntries(ep.teams.map((team) => [team.id, team.memberIds])),
    baseline,
    random(),
    ep.slotTieKeys[id],
  );
  ep.draftPicks.push(pick);
  const slot = ep.slots.find((slot) => slot.id === pick.slotId)!;
  const team = ep.teams.find((team) => team.id === slot.teamId)!;
  team.memberIds.push(id);
  team.partAssignments[id] = slot.partId;
  team.partReactions[id] = 'neutral';
  append(
    state,
    'draft',
    2,
    `Pick ${ep.draftPicks.length}: ${person(state, id).name}`,
    [
      `${mention(id)} chooses ${team.name}, ${slot.track}, ${songFor(state, team).parts.find((part) => part.id === slot.partId)!.name}.`,
      pick.tactic === 'professional'
        ? 'A disciplined, professional choice favors the strongest legal secondary skill.'
        : pick.tactic === 'gamble'
          ? 'A bold gamble favors the weaker secondary skill still available.'
          : 'The stronger secondary skill available guides the choice.',
      `Existing affection breaks equivalent group choices; ${team.name} now includes ${team.memberIds.map(mention).join(', ')}.`,
      ...(pick.availableSlotIds.length === 1 ? ['Only one completion-safe off-track slot remains.'] : []),
    ],
    [id],
  );
}

function prepareTeam(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const team = ep.teams[ep.teamCursor];
  const members = team.memberIds.map((id) => person(state, id));
  team.leaderContestants = structuredClone(members);
  team.leaderElection = electVersatilityRole(
    members,
    'leader',
    Object.fromEntries(team.memberIds.map((id) => [id, random()])),
  );
  team.captainId = team.leaderElection.winnerId;
  person(state, team.captainId).aggregations.leader++;
  ep.practiceCursor = 0;
  append(
    state,
    'practice',
    3,
    `${team.name}: a leader for unfamiliar roles`,
    [
      `${mention(team.captainId)} wins the leadership election for ${songFor(state, team).title}.`,
      ...Object.entries(team.leaderElection.ballots).map(
        ([voter, candidate]) => `${mention(voter)} votes for ${mention(candidate)}.`,
      ),
      ...team.memberIds.map(
        (id) =>
          `${mention(id)} rehearses the actual ${ep.slots.find((slot) => slot.id === ep.draftPicks.find((pick) => pick.contestantId === id)!.slotId)!.track} part, not their primary specialty.`,
      ),
    ],
    team.memberIds,
  );
}

function rehearse(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const team = ep.teams[ep.teamCursor];
  practiceVersatilityTeam(
    team,
    team.memberIds.map((id) => person(state, id)),
    random,
  );
  ep.practiceCursor = team.practice.length;
  const record = team.practice.at(-1)!;
  append(
    state,
    'practice',
    3,
    `${team.name}: ${record.title}`,
    [
      `${mention(team.captainId)} ${record.leadershipSuccess ? 'gives clear guidance and tightens the transitions' : 'struggles to organize the transitions'}.`,
      ...record.contestants.map(
        (entry) =>
          `${mention(entry.contestantId)} ${entry.improved ? 'makes progress in the unfamiliar part' : 'works through the rehearsal without improving the prior preparation'}.`,
      ),
    ],
    team.memberIds,
  );
  if (team.practice.length === 2)
    for (const id of team.memberIds) {
      const entry = person(state, id);
      if (!versatilityRefuses(entry, team)) continue;
      ep.refusals.push({ contestantId: id, teamId: team.id, leaderId: team.captainId, penalty: -10 });
      for (const other of team.memberIds)
        if (other !== id) changeBattleRelationship(person(state, other), id, -2);
      if (id !== team.captainId) changeBattleRelationship(entry, team.captainId, -1);
      append(
        state,
        'practice',
        3,
        `${entry.name}: a recorded refusal`,
        [
          `${mention(id)} stops the concept gesture after a stalled second rehearsal: "I am not doing that character choice."`,
          'The camera records the refusal rather than treating presentation or an unfamiliar role as a failure by itself.',
          `${mention(team.captainId)} must continue organizing the group around the missing action.`,
        ],
        [id, ...team.memberIds.filter((other) => other !== id)],
        3,
      );
    }
}

function settleTeam(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
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
        stalled &&
        ((leader.personality.discipline >= 5 &&
          entry.personality.discipline <= -3 &&
          leader.personality.discipline - entry.personality.discipline >= 10) ||
          (battleRelationship(leader, id) < 35 && battleRelationship(entry, leader.id) < 35))
      );
    });
  if (trouble && !team.intervention) {
    const description = `${leader.name} asks ${person(state, trouble).name} to repeat a stalled passage; the strained rehearsal approach interrupts the group.`;
    team.intervention = { contestantIds: [leader.id, trouble], description, choice: null };
    ep.conflict = { teamId: team.id, contestantIds: [leader.id, trouble], description };
    changeBattleRelationship(leader, trouble, -2);
    changeBattleRelationship(person(state, trouble), leader.id, -2);
    append(
      state,
      'intervention',
      3,
      `${team.name}: a real rehearsal dispute`,
      [description, 'Production must support, mediate or push before work can resume.'],
      [leader.id, trouble],
      3,
    );
    return;
  }
  const members = team.memberIds.map((id) => person(state, id));
  team.centerContestants = structuredClone(members);
  team.centerElection = electVersatilityRole(
    members,
    'center',
    Object.fromEntries(team.memberIds.map((id) => [id, random()])),
  );
  team.centerId = team.centerElection.winnerId;
  team.centerBallots = { ...team.centerElection.ballots };
  person(state, team.centerId).aggregations.center++;
  append(
    state,
    'practice',
    3,
    `${team.name}: the center`,
    [
      ...Object.entries(team.centerBallots).map(
        ([voter, candidate]) => `${mention(voter)} votes for ${mention(candidate)} as center.`,
      ),
      `${mention(team.centerId)} wins the center election.`,
    ],
    team.memberIds,
  );
}

function revealGuest(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const members = state.runtime!.definitions.doubtGirls!;
  ep.guestDraw = random();
  const guest = members[Math.floor(ep.guestDraw * members.length)];
  ep.guestId = guest.id;
  append(
    state,
    'guest-reveal',
    4,
    `The fourth judge: ${guest.name}`,
    [
      `"Please welcome ${guest.name}, ${guest.role}. John, Megan and Michael will all continue judging alongside her."`,
      ...ep.participantIds
        .slice(0, 2)
        .map(
          (id) =>
            `${mention(id)} ${person(state, id).personality.extroversion >= 5 ? 'greets the guest enthusiastically' : 'watches the additional judge take her seat'}.`,
        ),
    ],
    ep.participantIds.slice(0, 2),
    3,
    host,
  );
  ep.scenes.at(-1)!.dialogues = [
    {
      name: guest.name,
      role: guest.role,
      paragraphs: [
        '"Show me how you make an unfamiliar role your own. I am judging the performance you actually give."',
      ],
    },
  ];
}

function perform(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const team = ep.teams.find((team) => team.id === ep.performanceOrder[ep.performances.length])!;
  const song = songFor(state, team);
  const guest = state.runtime!.definitions.doubtGirls!.find((member) => member.id === ep.guestId)!;
  const evaluations = team.memberIds.map((id) => {
    const slot = ep.slots.find(
      (slot) => slot.id === ep.draftPicks.find((pick) => pick.contestantId === id)!.slotId,
    )!;
    const baseline = ep.startingContestants.find((entry) => entry.id === id)!;
    const evaluation = scoreVersatility(
      baseline,
      team,
      song,
      slot.track,
      guest,
      rollAuditionDice(random),
      person(state, id).aggregations.practice,
      ep.refusals.some((record) => record.contestantId === id) ? -10 : 0,
    );
    if (evaluation.expressive)
      person(state, id).aggregations.audienceRatio = clampBattle(
        person(state, id).aggregations.audienceRatio + 0.02,
        -1,
        1,
      );
    return evaluation;
  });
  const average = (field: 'john' | 'megan' | 'michael' | 'guest') =>
    evaluations.reduce((sum, entry) => sum + entry[field], 0) / evaluations.length;
  const comments = (['john', 'megan', 'michael', 'guest'] as const).map((judgeId) => ({
    judgeId: judgeId === 'guest' ? guest.id : judgeId,
    description: `${judgeId === 'guest' ? guest.name : { john: 'John', megan: 'Megan', michael: 'Michael' }[judgeId]}: "${average(judgeId) >= 70 ? 'The choices connect securely' : 'There are details to strengthen'} in ${
      judgeId === 'john'
        ? 'the assigned off-track delivery'
        : judgeId === 'megan'
          ? 'stage presence, potential and distinctiveness'
          : judgeId === 'michael'
            ? 'visual impact, consistency and leadership'
            : 'the unfamiliar role and stage connection'
    }."`,
  }));
  const meanScore = evaluations.reduce((sum, entry) => sum + entry.finalScore, 0) / evaluations.length;
  ep.performances.push({ teamId: team.id, evaluations, meanScore, finalScore: meanScore, comments });
  append(
    state,
    'performances',
    5,
    `${team.name}: ${song.title}`,
    evaluations.map((entry) => entry.description),
    team.memberIds,
    3,
  );
  ep.scenes.at(-1)!.dialogues = comments.map((comment) => ({
    name:
      comment.judgeId === guest.id
        ? guest.name
        : { john: 'John', megan: 'Megan', michael: 'Michael' }[comment.judgeId as 'john'],
    role: comment.judgeId === guest.id ? guest.role : 'Judge',
    paragraphs: [comment.description],
  }));
}

function breakthroughs(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.breakthroughs = ep.performances.flatMap((performance) =>
    performance.evaluations.map((evaluation) => {
      const baseline = ep.startingContestants.find((entry) => entry.id === evaluation.contestantId)!;
      const [gate, potential] = rollAuditionDice(random);
      const record = versatilityBreakthrough(baseline, evaluation.track, gate, potential);
      person(state, record.contestantId).coreSkills[record.skill] = record.after;
      return record;
    }),
  );
  const gains = ep.breakthroughs.filter((record) => record.after > record.before);
  append(
    state,
    'breakthroughs',
    6,
    gains.length ? 'Small discoveries that stay' : 'The work still matters',
    [
      ...gains.map(
        (record) =>
          `${mention(record.contestantId)} finds a repeatable adjustment in ${record.skill} after revisiting the actual rehearsal and performance footage. ${record.before} becomes ${record.after}; the recorded performance grade stays unchanged.`,
      ),
      ...ep.breakthroughs
        .filter((record) => record.passed && record.after === record.before)
        .map(
          (record) =>
            `${mention(record.contestantId)} consolidates work already at the skill ceiling; no additional skill gain is claimed.`,
        ),
      ...(!gains.length
        ? [
            'No permanent skill increase emerges tonight. The rehearsals and performances still stand on their own; no success is invented.',
          ]
        : []),
      'Every performance and grade was locked before these later discoveries.',
    ],
    gains.map((record) => record.contestantId),
    gains.length ? 3 : 0,
  );
}

function sealRanking(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.evidence = ep.performances.flatMap((performance) =>
    performance.evaluations.map((evaluation) => ({
      contestantId: evaluation.contestantId,
      finalScore: evaluation.finalScore,
      observedScore: evaluation.finalScore,
      reception: evaluation.finalScore,
      category: evaluation.track,
    })),
  );
  ep.exposure = Object.fromEntries(ep.participantIds.map((id) => [id, 1 / 15]));
  ep.audienceContestants = structuredClone(ep.participantIds.map((id) => person(state, id)));
  ep.audienceBefore = structuredClone(state.runtime!.show);
  ep.audienceMood = structuredClone(state.runtime!.preparations![7]!.mood!);
  const result = resolveNarrativeEvidenceAudience({
    contestants: ep.audienceContestants,
    evidence: ep.evidence,
    exposure: ep.exposure,
    mood: state.runtime!.preparations![7]!.mood!,
    show: state.runtime!.show,
    random: recordRandom(ep.audienceRandom, random),
  });
  ep.audience = result.outcome;
  ep.audienceAfter = structuredClone(result.show);
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
}
function transferFans(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const before = structuredClone(state.runtime!.show);
  const draws: number[] = [];
  const after = transferEliminatedFans(
    before,
    state.contestants,
    ep.survivorIds,
    recordRandom(draws, random),
  );
  ep.fanTransfers.push({
    survivorIds: [...ep.survivorIds],
    before,
    after: structuredClone(after),
    random: draws,
  });
  state.runtime!.show = after;
}
function rank(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  sealRanking(state, random);
  ep.rankRevealed = true;
  ep.survivorIds = ep.rankedIds.slice(0, 13);
  ep.eliminatedIds = ep.rankedIds.slice(13);
  const lines = ep.rankedIds.map((id, index) => {
    const entry = person(state, id);
    const prior = entry.rank;
    entry.rank = index + 1;
    entry.aggregations.rankingScore = ep.sealedRankingScores[id];
    const grade = ep.performances
      .flatMap((performance) => performance.evaluations)
      .find((evaluation) => evaluation.contestantId === id)!.grade;
    entry.grade = grade;
    entry.missionRating = { A: 5, B: 4, C: 3, D: 2, F: 1 }[grade];
    if (index >= 13) {
      entry.status = 'ELIMINATED';
      entry.events.push('VERSATILITY_ELIMINATED');
    }
    return `${index + 1}. ${mention(id)} ${prior > index + 1 ? `↑ rises from ${prior}` : prior < index + 1 ? `↓ falls from ${prior}` : `holds ${prior}`}. ${index >= 13 ? 'Eliminated; there are no saves.' : 'Remains after the announced cut.'}`;
  });
  transferFans(state, random);
  append(state, 'ranking', 7, 'The fifteen-person announced ranking', lines, ep.rankedIds, 3, host);
  ep.scenes.at(-1)!.dialogues = ep.rankedIds
    .filter(
      (id, index) => Math.abs(ep.startingContestants.find((entry) => entry.id === id)!.rank - index - 1) >= 3,
    )
    .slice(0, 3)
    .map((id) => ({
      name: person(state, id).name,
      role: 'Contestant',
      paragraphs: [
        person(state, id).personality.resilience >= 5
          ? '"I will take this result and keep working."'
          : person(state, id).personality.sensitivity >= 5
            ? '"I need a moment to take that in."'
            : '"That was not the place I expected."',
      ],
      paragraphContestantIds: [[id]],
    }));
}

function holding(state: SimulationState) {
  const ep = epFor(state);
  append(
    state,
    'holding',
    7,
    'Thirteen in the holding room',
    [
      ...ep.eliminatedIds.map(
        (id) => `${mention(id)} says goodbye from announced place ${person(state, id).rank}.`,
      ),
      ...ep.eliminatedIds.map((id) => {
        const companion = [...ep.survivorIds].sort(
          (a, b) => battleRelationship(person(state, id), b) - battleRelationship(person(state, id), a),
        )[0];
        return `${mention(companion)} ${battleRelationship(person(state, id), companion) >= 60 ? 'shares a warm farewell' : 'offers a respectful farewell'} with ${mention(id)}.`;
      }),
      'The thirteen remaining performers wait backstage, believing the announced departures have finished.',
      ...ep.survivorIds
        .slice(0, 2)
        .map((id) => `${mention(id)} takes a seat and finally lets the tension of the ranking ease.`),
    ],
    [...ep.eliminatedIds, ...ep.survivorIds.slice(0, 2)],
    3,
  );
}
function expel(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const result = selectVersatilityExpulsion(
    state.contestants,
    ep.survivorIds,
    state.runtime!.definitions,
    random,
  );
  state.contestants = result.contestants;
  ep.expulsion = result.expulsion;
  ep.expelledId = result.expulsion.contestantId;
  state.runtime!.revealedSecrets.push({ contestantId: ep.expelledId, cardId: result.expulsion.cardId });
  state.runtime!.deferredConsequences.push(...result.expulsion.result.deferred);
  ep.survivorIds = ep.rankedIds.slice(0, 13).filter((id) => id !== ep.expelledId);
  ep.survivorIds.forEach((id, index) => {
    person(state, id).rank = index + 1;
  });
  const departed = person(state, ep.expelledId);
  departed.rank = 13;
  departed.status = 'ELIMINATED';
  departed.events.push('VERSATILITY_EXPELLED');
  for (const id of ep.survivorIds) {
    const entry = person(state, id);
    entry.condition = preserveTrackCondition(
      entry.condition,
      entry.personality.sensitivity >= 5 ? 'ANXIOUS' : 'STRESSED',
    );
  }
  transferFans(state, random);
  append(
    state,
    'expulsion',
    8,
    'A revelation, then a separate production decision',
    [
      `${mention(departed.id)}: ${result.expulsion.result.title}. ${result.expulsion.result.description}`,
      'The revelation above is the actual secret, not an invented allegation of misconduct.',
      `"Production has made a separate decision: ${departed.name} will leave the program. This is an expulsion, not a third ranked elimination."`,
      `${mention(departed.id)} leaves in final season position thirteen. The announced fifteenth and fourteenth places remain unchanged.`,
      ...ep.survivorIds
        .slice(0, 3)
        .map(
          (id) =>
            `${mention(id)} ${person(state, id).personality.sensitivity >= 5 ? 'looks anxious after the unexpected removal' : 'sits with the stress of the unexpected removal'}.`,
        ),
      'Twelve remain. The public vote is not run again.',
    ],
    [departed.id, ...ep.survivorIds.slice(0, 3)],
    6,
    { name: 'Production', role: 'Production' },
  );
}
function mvp(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.mvpContestants = structuredClone(ep.participantIds.map((id) => person(state, id)));
  ep.mvp = chooseEvidenceMvp(
    ep.mvpContestants,
    ep.evidence,
    ep.survivorIds,
    recordRandom(ep.mvpRandom, random),
    12,
  );
  person(state, ep.mvp.winnerId).aggregations.mvp++;
  append(
    state,
    'peer-mvp',
    8,
    'The twelve-person private MVP',
    [
      'Only the twelve continuing contestants vote. No one can vote for themselves.',
      ...Object.entries(ep.mvp.ballots).map(
        ([voter, candidate]) => `${mention(voter)} votes for ${mention(candidate)}.`,
      ),
      `${mention(ep.mvp.winnerId)} is peer MVP.`,
    ],
    [ep.mvp.winnerId],
    3,
  );
}
function investigate(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const definitions = state.runtime!.definitions;
  ep.investigationContestants = structuredClone(state.contestants);
  ep.investigationEligibleIds = ep.survivorIds.filter((id) => {
    const entry = person(state, id);
    return (
      !entry.events.some((event) => event.startsWith('SECRET_REVEALED:')) ||
      unrevealedVersatilityCards(entry, definitions).length > 0
    );
  });
  const available = ep.investigationEligibleIds.some(
    (id) => unrevealedVersatilityCards(person(state, id), definitions).length,
  );
  ep.secretCandidates = available ? shuffleWithRandom(ep.investigationEligibleIds, random).slice(0, 3) : [];
  append(
    state,
    ep.secretCandidates.length ? 'secret-choice' : 'secret-result',
    8,
    ep.secretCandidates.length ? 'A separate investigation shortlist' : 'The investigation desk is closed',
    ep.secretCandidates.length
      ? [
          'Production may investigate one of these names. A legitimate miss changes nothing; no result can cause a fourth departure or rewrite the locked standings.',
          ...ep.secretCandidates.map(mention),
          ...(ep.secretCandidates.length < 3
            ? ['Fewer than three eligible contestants remain; every eligible name is offered.']
            : []),
        ]
      : ['No eligible unrevealed secret remains among the twelve. The final standings remain locked.'],
    ep.secretCandidates,
    0,
  );
}
function complete(state: SimulationState) {
  const ep = epFor(state);
  for (const id of ep.participantIds) person(state, id).aggregations.practice = ep.priorPractice[id];
  append(
    state,
    'complete',
    8,
    'Twelve continue',
    [
      `The twelve continuing performers: ${ep.survivorIds.map(mention).join(', ')}.`,
      'Two ranked departures and one separate expulsion close Versatility. Episode 8 is next; no further challenge has begun.',
    ],
    [],
    0,
  );
  state.runtime!.phase = 'episode-complete';
}
function advance(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  switch (ep.phase) {
    case 'briefing':
      playOpening(state, 7);
      ep.openingCast = [...(state.runtime!.openingCast ?? [])];
      append(
        state,
        'credits',
        1,
        'Opening credits',
        ['The confirmed portraits and opening introduce the fifteen continuing performers.'],
        state.runtime!.openingCast,
      );
      break;
    case 'credits':
      initializeDraft(state, random);
      break;
    case 'draft':
      if (ep.draftPicks.length < 15) draft(state, random);
      else prepareTeam(state, random);
      break;
    case 'practice': {
      const team = ep.teams[ep.teamCursor];
      if (team.practice.length < 2) rehearse(state, random);
      else if (!team.centerId) settleTeam(state, random);
      else if (ep.teamCursor < 2) {
        ep.teamCursor++;
        prepareTeam(state, random);
      } else revealGuest(state, random);
      break;
    }
    case 'guest-reveal':
      perform(state, random);
      break;
    case 'performances':
      if (ep.performances.length < 3) perform(state, random);
      else breakthroughs(state, random);
      break;
    case 'breakthroughs':
      rank(state, random);
      break;
    case 'ranking':
      holding(state);
      break;
    case 'holding':
      expel(state, random);
      break;
    case 'expulsion':
      mvp(state, random);
      break;
    case 'peer-mvp':
      investigate(state, random);
      break;
    case 'secret-result':
      complete(state);
      break;
    default:
      throw new Error('Resolve the current Versatility production choice first.');
  }
}
function capture(state: SimulationState, before: Contestant[], cause: string, oldSceneId?: string) {
  const ep = epFor(state);
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
  if (state.runtime!.versatility) freezeSimulationSnapshot(state.runtime!.versatility.startingContestants);
  validateVersatility(state);
  state.persistenceError = null;
  return state;
}
export function transitionVersatility(
  current: SimulationState,
  action: VersatilityAction,
  revision: number,
): SimulationState {
  return awardNewActivity(current, transitionInternal(current, action, revision));
}
function transitionInternal(
  current: SimulationState,
  action: VersatilityAction,
  revision: number,
): SimulationState {
  const runtime = current.runtime;
  if (runtime?.version !== 3 || current.status !== 'ready' || runtime.trackSpecials?.phase !== 'complete')
    throw new Error('Complete Track Specials in a current-format season before Versatility.');
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error('A valid Versatility revision is required.');
  const old = runtime.versatility;
  const prep = runtime.preparations?.[7];
  if (!old) {
    if (!prep) {
      if (action.type !== 'start' || revision !== 0) throw new Error('Start Episode 7 preparation first.');
      const next = structuredClone(current);
      const random = createSeededRandom(runtime.randomState);
      initializePreparation(next, 7, random.next);
      return finalize(next, random);
    }
    if (
      (action.type === 'start' && revision === 0 && prep.revision === 0) ||
      (prep.lastAction?.revision === revision &&
        JSON.stringify(prep.lastAction.action) === JSON.stringify(action))
    )
      return current;
    if (revision !== prep.revision) throw new Error('This Versatility preparation action is stale.');
    if (action.type !== 'mood' && action.type !== 'opening-cast' && action.type !== 'randomize-mood')
      throw new Error('Confirm the opening mood and replacement cast first.');
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    const before = structuredClone(next.contestants);
    applyPreparation(next, action, random.next);
    const nextPrep = next.runtime!.preparations![7]!;
    nextPrep.revision++;
    nextPrep.lastAction = { revision, action: structuredClone(action) };
    if (nextPrep.mood && !nextPrep.requiredSelections) {
      start(next);
      capture(next, before, 'Versatility: briefing');
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
  if (old.revision !== revision) throw new Error('This Versatility action is stale; reload the episode.');
  if (old.phase === 'complete') throw new Error('Versatility is complete.');
  assertVersatilityEpisode(old, current.contestants, runtime.definitions);
  const next = structuredClone(current);
  const random = createSeededRandom(runtime.randomState);
  const before = structuredClone(next.contestants);
  const ep = epFor(next);
  ep.revision++;
  ep.lastAction = { revision, action: structuredClone(action) };
  if (action.type === 'conflict') {
    if (
      ep.phase !== 'intervention' ||
      !ep.conflict ||
      !['support', 'mediate', 'push'].includes(action.choice)
    )
      throw new Error('No eligible Versatility rehearsal conflict.');
    const team = ep.teams.find((team) => team.id === ep.conflict!.teamId)!;
    team.intervention!.choice = action.choice;
    const ids = ep.conflict.contestantIds;
    team.coordination = clampBattle(
      team.coordination + (action.choice === 'push' ? 3 : action.choice === 'support' ? 2 : 1),
      -5,
      5,
    );
    for (const id of ids)
      for (const other of ids)
        if (id !== other)
          changeBattleRelationship(
            person(next, id),
            other,
            action.choice === 'push' ? -3 : action.choice === 'mediate' ? 2 : 1,
          );
    ep.conflict = null;
    append(
      next,
      'practice',
      3,
      `${team.name}: production ${action.choice}`,
      [
        action.choice === 'push'
          ? 'Production pushes for a finished run; coordination improves but the pair are left colder.'
          : action.choice === 'mediate'
            ? 'Production hears both sides and helps the pair return to the passage with a little more trust.'
            : 'Production offers practical reassurance so the pair can continue.',
      ],
      ids,
      3,
    );
  } else if (action.type === 'secret') {
    if (ep.phase !== 'secret-choice' || !ep.secretCandidates.includes(action.contestantId))
      throw new Error('Choose an eligible Versatility investigation candidate.');
    const cards = unrevealedVersatilityCards(person(next, action.contestantId), runtime.definitions);
    const result = cards.length
      ? revealExactAuditionSecret(next.contestants, action.contestantId, cards[0], runtime.definitions)
      : revealAuditionSecret(next.contestants, action.contestantId, runtime.definitions);
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
        'The twelve continuing places and all three departures remain unchanged.',
      ],
      [action.contestantId],
      result.result.cardId ? 6 : 0,
    );
  } else if (action.type === 'advance') advance(next, random.next);
  else throw new Error('Only the current Versatility story action is available.');
  capture(next, before, `Versatility: ${old.phase}`, old.scenes.at(-1)?.id);
  if (ep.phase === 'complete')
    next.contestants = next.contestants.map((entry) =>
      !ep.participantIds.includes(entry.id)
        ? entry
        : appendContestantHistory(
            entry,
            {
              episode: 7,
              phaseId: `${runtime.runId}:versatility:complete`,
              rank: entry.rank,
              status: entry.status,
              score: entry.aggregations.rankingScore,
              missionRating: entry.missionRating,
              events: entry.events.filter((event) => event.startsWith('VERSATILITY_')),
              summary:
                entry.id === ep.expelledId
                  ? 'Expelled in final season position thirteen after an actual-secret revelation.'
                  : ep.eliminatedIds.includes(entry.id)
                    ? `Eliminated in place ${entry.rank} after Versatility.`
                    : 'Continues among the final twelve after Versatility.',
            },
            ep.changes[entry.id] ?? [],
          ),
    );
  return finalize(next, random);
}
