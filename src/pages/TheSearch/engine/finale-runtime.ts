import type { EpisodeScene } from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import type { FinaleAction, FinalePhase } from '../types/finale-episode';
import type { SimulationState } from '../types/simulation';
import { resolveNarrativeEvidenceAudience, transferEliminatedFans } from './audition-audience';
import { rollAuditionDice } from './audition-scoring';
import { battleRelationship, changeBattleRelationship, clampBattle } from './battle-scoring';
import { appendContestantHistory, recordContestantChanges } from './change-history';
import { playOpening } from './episode-preparation';
import { assignFinaleParts, createFinaleTeams, draftFinalePick } from './finale-draft';
import { assessFinale, finalePostSeason, rehearseFinale, scoreFinalePerformance } from './finale-scoring';
import type { RandomSource } from './random';
import { preserveTrackCondition } from './track-specials-scoring';

const epFor = (state: SimulationState) => state.runtime!.finale!;
const person = (state: SimulationState, id: string) => {
  const found = state.contestants.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown Finale contestant "${id}".`);
  return found;
};
const mention = (id: string) => `[[contestant:${id}]]`;
const recorded = (draws: number[], random: RandomSource) => () => {
  const value = random();
  draws.push(value);
  return value;
};
function append(
  state: SimulationState,
  phase: FinalePhase,
  sequence: number,
  title: string,
  paragraphs: string[],
  ids: string[] = [],
  tv?: { key: string; ids: string[]; tier: 1 | 3 | 6 },
) {
  const ep = epFor(state);
  const paragraphContestantIds: string[][] = [];
  const plain = paragraphs.map((paragraph) => {
    const refs: string[] = [];
    const text = paragraph.replace(/\[\[contestant:([^\]]+)\]\]/g, (_, id: string) => {
      refs.push(id);
      return person(state, id).name;
    });
    paragraphContestantIds.push(refs);
    return text;
  });
  const kind: EpisodeScene['kind'] =
    phase === 'credits'
      ? 'opening'
      : phase === 'draft'
        ? 'draft'
        : phase === 'rehearsals'
          ? 'practice'
          : phase === 'originals' || phase === 'theme'
            ? 'battles'
            : phase === 'winner-reveal'
              ? 'ranking'
              : 'recap';
  ep.phase = phase;
  ep.scenes.push({
    id: `finale-${ep.scenes.length}`,
    sequence,
    kind,
    title,
    paragraphs: plain,
    paragraphContestantIds,
    contestantIds: [...new Set(ids)],
    presentation:
      phase === 'credits'
        ? 'credits'
        : phase === 'originals' || phase === 'theme'
          ? 'performance'
          : phase === 'panel' || phase === 'panel-return'
            ? 'judges'
            : 'host',
    speaker: { name: 'Mike Philip', role: 'Host' },
    ...(tv?.ids.length
      ? { tvMoments: { [tv.key]: Object.fromEntries(tv.ids.map((id) => [id, tv.tier])) } }
      : {}),
  });
  for (const id of new Set(ids)) person(state, id).aggregations.screenTime++;
}
export function initializeFinale(state: SimulationState, randomStartState: number): void {
  const runtime = state.runtime!;
  const ids = [...runtime.specialties!.survivorIds];
  const active = state.contestants.filter((entry) => entry.status === 'ACTIVE');
  if (
    ids.length !== 8 ||
    new Set(ids).size !== 8 ||
    active.length !== 8 ||
    active.some((entry) => !ids.includes(entry.id))
  )
    throw new Error('Finale requires exactly the eight Specialties survivors.');
  const prep = runtime.preparations![11]!;
  if (!prep.mood || prep.requiredSelections || prep.openingPlayed)
    throw new Error('Confirm the Finale opening first.');
  const guestId = runtime.versatility?.guestId;
  if (!guestId || !runtime.definitions.doubtGirls?.some((entry) => entry.id === guestId))
    throw new Error('Finale requires the actual Episode 7 guest.');
  runtime.finale = {
    version: 1,
    randomStartState,
    revision: 0,
    lastAction: { revision: 0, action: { type: 'start' } },
    phase: 'briefing',
    participantIds: ids,
    previousRankedIds: [...ids].sort((a, b) => person(state, a).rank - person(state, b).rank),
    startingContestants: structuredClone(state.contestants),
    startingShow: structuredClone(runtime.show),
    startingOpeningCast: [...runtime.openingCast!],
    startingPreparation: structuredClone(prep),
    startingRevealedSecrets: structuredClone(runtime.revealedSecrets),
    startingDeferredConsequences: structuredClone(runtime.deferredConsequences),
    startingGuestId: guestId,
    openingCast: [],
    steps: [],
    teams: [],
    songOrder: [],
    draftPicks: [],
    rehearsalOrder: [],
    rehearsals: [],
    supports: [],
    executive: null,
    personnel: [],
    nerves: [],
    originalPerformances: [],
    themePerformances: [],
    panel: [],
    evidence: [],
    exposure: {},
    audience: null,
    audienceContestants: [],
    audienceBefore: null,
    audienceAfter: null,
    audienceRandom: [],
    audienceMood: null,
    sealedRankingScores: {},
    rankingComponents: {},
    rankingTieKeys: {},
    rankedIds: [],
    winnerIds: [],
    revealedWinnerIds: [],
    centerId: null,
    resultsPublished: false,
    fanTransfers: [],
    postSeason: null,
    scenes: [],
    changes: {},
  };
  runtime.episode = 11;
  runtime.phase = 'finale';
  append(
    state,
    'briefing',
    1,
    'Eight finalists, one final stage',
    [
      `Mike welcomes the exact Top 8: ${ids.map(mention).join(', ')}.`,
      'The two highest-ranked survivors captain two original-song groups of four. Both originals and the shared live Squirrel Life performance count equally.',
      'Seven returning judges will assess the completed stages. Tonight five performers join the group, with its official Center announced last.',
    ],
    ids,
  );
}
function draft(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const catalog = state.runtime!.definitions.finaleCatalog!;
  const cast = ep.participantIds.map((id) => person(state, id));
  if (!ep.teams.length) {
    ep.teams = createFinaleTeams(ep.previousRankedIds, catalog, random);
    ep.songOrder = ep.teams.map((team) => team.songId);
    for (const team of ep.teams) person(state, team.captainId).aggregations.leader++;
  }
  const pick = draftFinalePick(cast, ep.teams, ep.draftPicks.length, random);
  ep.draftPicks.push(pick);
  const paragraphs =
    ep.draftPicks.length === 1
      ? ep.teams.map(
          (team) =>
            `${mention(team.captainId)} leads "${catalog.originals.find((song) => song.id === team.songId)!.name}".`,
        )
      : [];
  paragraphs.push(
    `${mention(pick.captainId)} chooses ${mention(pick.contestantId)} for the group, looking for dependable stage delivery.`,
  );
  if (ep.draftPicks.length === 6) {
    assignFinaleParts(cast, ep.teams, catalog, random);
    ep.rehearsalOrder = ep.teams.flatMap((team) => team.memberIds);
    for (const team of ep.teams) {
      const song = catalog.originals.find((entry) => entry.id === team.songId)!;
      paragraphs.push(
        `"${song.name}": ${song.description}`,
        ...team.parts.map(
          (part) =>
            `${mention(part.contestantId)} takes ${song.parts.find((entry) => entry.id === part.partId)!.name}. ${part.arrangement} ${part.staging}`,
        ),
      );
    }
    paragraphs.push(
      'Backing arrangements support every primary track; no member is asked to change their specialty.',
    );
  }
  append(state, 'draft', 1, `Group draft: pick ${ep.draftPicks.length}`, paragraphs, [
    pick.captainId,
    pick.contestantId,
  ]);
}
function rehearse(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const id = ep.rehearsalOrder[Math.floor(ep.rehearsals.length / 2)];
  const entry = person(state, id);
  const previous = ep.rehearsals.filter((record) => record.contestantId === id).at(-1);
  const result = rehearseFinale(
    entry,
    previous ? 2 : 1,
    rollAuditionDice(random),
    previous?.readinessAfter ?? 0,
  );
  ep.rehearsals.push(result);
  const paragraphs = [
    `${mention(id)} rehearses both the original group arrangement and the familiar live theme, ${result.session === 1 ? 'learning the phrases and recalling the transitions' : 'running the full sequence for stamina and repeated timing'}.`,
    ...result.checks.map(
      (check) =>
        `${check.skill === 'memory' ? 'Recalled phrases' : check.skill === 'consistency' ? 'Repeated entrances' : check.skill === 'stamina' ? 'Sustained movement and breath' : 'New transitions'} ${check.score < 50 ? 'need careful marking and another look at the cue sheet' : 'hold together through this rehearsal pass'}.`,
    ),
  ];
  const team = ep.teams.find((record) => record.memberIds.includes(id))!;
  if (
    result.readinessAfter < 4 &&
    result.checks.some((check) => check.score < 50) &&
    !ep.supports.some((record) => record.captainId === team.captainId)
  ) {
    const helpers = team.memberIds.filter(
      (other) =>
        other !== id &&
        person(state, other).personality.gentleness >= 5 &&
        person(state, other).personality.sincerity >= 5,
    );
    const tieKeys = Object.fromEntries(helpers.map((other) => [other, random()]));
    helpers.sort(
      (a, b) =>
        battleRelationship(person(state, b), id) - battleRelationship(person(state, a), id) ||
        tieKeys[a] - tieKeys[b] ||
        a.localeCompare(b),
    );
    if (helpers.length) {
      const helper = person(state, helpers[0]);
      const happinessBefore = entry.aggregations.happiness;
      const towardHelperBefore = battleRelationship(entry, helper.id);
      const towardMemberBefore = battleRelationship(helper, id);
      entry.aggregations.happiness = clampBattle(happinessBefore + 2);
      changeBattleRelationship(entry, helper.id, 2);
      changeBattleRelationship(helper, id, 1);
      ep.supports.push({
        captainId: team.captainId,
        helperId: helper.id,
        strugglingId: id,
        session: result.session,
        tieKeys,
        happinessBefore,
        happinessAfter: entry.aggregations.happiness,
        towardHelperBefore,
        towardHelperAfter: battleRelationship(entry, helper.id),
        towardMemberBefore,
        towardMemberAfter: battleRelationship(helper, id),
      });
      paragraphs.push(
        `${mention(helper.id)} quietly walks the uncertain transition with ${mention(id)}. The practical kindness eases the moment without pretending the rehearsal difficulty has disappeared.`,
      );
    }
  }
  append(
    state,
    'rehearsals',
    3,
    `${entry.name}: rehearsal ${result.session}`,
    paragraphs,
    [
      id,
      ...ep.supports
        .filter((support) => support.strugglingId === id && support.session === result.session)
        .map((support) => support.helperId),
    ],
    result.checks.some((check) => check.score < 50)
      ? { key: 'actual-rehearsal-struggle', ids: [id], tier: 1 }
      : undefined,
  );
  if (ep.rehearsals.length === 16) ep.phase = 'executive-choice';
}
function returningPanel(state: SimulationState) {
  const ep = epFor(state);
  const definitions = state.runtime!.definitions;
  const guest = definitions.doubtGirls!.find((entry) => entry.id === ep.startingGuestId)!;
  const director = definitions.musicVideoCatalog!.director;
  ep.personnel = [
    { id: 'john', name: 'John Stan', role: 'Music producer' },
    { id: 'megan', name: 'Megan Ryder', role: 'Veteran artist' },
    { id: 'michael', name: 'Michael Lion', role: 'Record-label executive' },
    { id: 'jane', name: 'Jane Strauss', role: 'Choreographer' },
    { id: 'doubt-girls', name: guest.name, role: guest.role },
    { id: 'roxana', name: 'Roxana Michaels', role: 'Variety mentor' },
    { id: 'vivienne', name: director.name, role: director.role },
  ];
  for (const id of ep.participantIds) {
    const entry = person(state, id);
    if (entry.personality.sensitivity < 5) continue;
    const before = entry.condition;
    entry.condition = preserveTrackCondition(before, 'ANXIOUS');
    ep.nerves.push({ contestantId: id, before, after: entry.condition });
  }
  append(
    state,
    'panel-return',
    4,
    'Seven familiar perspectives',
    [
      `Mike welcomes ${ep.personnel.map((judge) => judge.name).join(', ')} back to the judging desk.`,
      ...ep.nerves.map(
        (record) =>
          `${mention(record.contestantId)} takes a breath at the familiar faces and the weight of the evening. Crew respect the performer's existing needs.`,
      ),
      'The judges will watch both arrangements before giving their final numerical assessments.',
    ],
    ep.nerves.map((record) => record.contestantId),
    { key: 'returning-panel-nerves', ids: ep.nerves.map((record) => record.contestantId), tier: 1 },
  );
  ep.scenes.at(-1)!.dialogues = ep.personnel.map((judge) => ({
    name: judge.name,
    role: judge.role,
    paragraphs: [
      judge.id === 'john'
        ? '“Let us hear how you carry the complete arrangement.”'
        : judge.id === 'jane'
          ? '“The shared timing matters as much as the entrance.”'
          : judge.id === 'doubt-girls'
            ? '“It is good to see how far you have come since we met.”'
            : judge.id === 'vivienne'
              ? '“Give each other room in the frame.”'
              : judge.id === 'roxana'
                ? '“Stay connected to the room through both stages.”'
                : judge.id === 'megan'
                  ? '“Keep your own identity inside the group.”'
                  : '“We will consider the finish as carefully as the opening.”',
    ],
  }));
}
function perform(state: SimulationState, random: RandomSource, act: 'original' | 'theme') {
  const ep = epFor(state);
  const records = act === 'original' ? ep.originalPerformances : ep.themePerformances;
  const order =
    act === 'original'
      ? ep.teams.flatMap((team) => team.parts.map((part) => part.contestantId))
      : ep.rehearsalOrder;
  const id = order[records.length];
  const entry = person(state, id);
  const team = ep.teams.find((record) => record.memberIds.includes(id))!;
  const catalog = state.runtime!.definitions.finaleCatalog!;
  const song = catalog.originals.find((record) => record.id === team.songId)!;
  const readiness = ep.rehearsals.filter((record) => record.contestantId === id).at(-1)!.readinessAfter;
  const result = scoreFinalePerformance(
    entry,
    act === 'original' ? song.id : catalog.theme.id,
    rollAuditionDice(random),
    readiness,
    act,
  );
  records.push(result);
  const paragraphs =
    act === 'original'
      ? [
          `${records.length % 4 === 1 ? `The four-person group begins "${song.name}". ${song.description} ` : 'The same group act continues. '}The camera follows ${mention(id)} through their actual ${entry.track.toLowerCase()} arrangement. ${team.parts.find((part) => part.contestantId === id)!.staging}`,
          result.breakdownPenalty
            ? 'The phrase breaks down during the sustained passage; breath or repeated timing fails under the low opening cue. The performer safely regains their place without a restart.'
            : `${result.checks.stamina.score >= 50 ? 'Breath and movement support the sustained phrase' : 'The sustained phrase visibly tests stamina'}, while ${result.checks.consistency.score >= 50 ? 'the repeated timing stays controlled' : 'some repeated entrances remain uneven'}.`,
        ]
      : [
          `${records.length === 1 ? `All eight begin the single live "${catalog.theme.title}" performance. ${catalog.theme.staging} ` : 'Within the same shared live arrangement, '}the camera finds ${mention(id)} carrying their contribution.`,
          result.checks.dance.score >= 70 && result.checks.consistency.score >= 50
            ? 'The movement and repeated entrances connect clearly to the surrounding formation.'
            : 'The camera catches specific movement or entrance details that do not align completely with the shared formation; the live act continues.',
        ];
  if (act === 'original' && result.emotionalPraise)
    paragraphs.push(
      'The strength of this actual delivery earns warm praise for holding the emotional line under pressure.',
    );
  if (act === 'theme' && records.length === 8) {
    for (const participantId of ep.participantIds)
      person(state, participantId).aggregations.happiness = clampBattle(
        person(state, participantId).aggregations.happiness + 5,
      );
    paragraphs.push(
      'All eight share the final formation and enjoy completing the familiar song together. The celebration does not erase the judges’ observations.',
    );
  }
  append(
    state,
    act === 'original' ? 'originals' : 'theme',
    act === 'original' ? 5 : 6,
    act === 'original' ? `${song.name}: ${entry.name}` : `Squirrel Life: ${entry.name} in the ensemble`,
    paragraphs,
    [id],
  );
  if (act === 'original')
    ep.scenes.at(-1)!.dialogues = ep.personnel.slice(0, 3).map((judge) => ({
      name: judge.name,
      role: judge.role,
      paragraphs: [
        judge.id === 'john'
          ? `“That ${entry.track.toLowerCase()} phrase ${result.checks.track.score >= 70 ? 'held its shape clearly' : 'had places where the control could settle further'}.”`
          : judge.id === 'megan'
            ? `“Your expression ${result.checks.stagePresence.score >= 70 ? 'reached beyond your own mark' : 'could connect more consistently to the other members'}.”`
            : `“The group frame ${result.checks.consistency.score >= 50 ? 'supported your repeated entrances' : 'made the uneven repeated entrances visible'}.”`,
      ],
    }));
}
function panel(state: SimulationState) {
  const ep = epFor(state);
  ep.panel = ep.participantIds.map((id) =>
    assessFinale(
      ep.originalPerformances.find((record) => record.contestantId === id)!,
      ep.themePerformances.find((record) => record.contestantId === id)!,
    ),
  );
  append(state, 'panel', 7, 'Two stages, seven perspectives', [
    'Both original groups and the complete shared live theme have now finished. The seven judges submit their assessments; technical execution and the seven-person mean each contribute half.',
    'The final numerical accounting remains sealed while the public vote closes.',
  ]);
  ep.scenes.at(-1)!.dialogues = ep.personnel.map((judge) => ({
    name: judge.name,
    role: judge.role,
    paragraphs: ep.panel.map((assessment) => {
      const score = assessment.judges[judge.id].score;
      return `${person(state, assessment.contestantId).name}: “${score >= 70 ? 'Your completed stages gave us a clear, sustained contribution' : score >= 50 ? 'Both stages had real strengths and details still to refine' : 'The completed stages showed specific control and connection still to develop'}.”`;
    }),
    paragraphContestantIds: ep.panel.map((assessment) => [assessment.contestantId]),
  }));
}
function tally(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.evidence = ep.panel.map((assessment) => ({
    contestantId: assessment.contestantId,
    finalScore: assessment.finalScore,
    observedScore: assessment.performance,
    reception: clampBattle(
      assessment.performance +
        (ep.originalPerformances.find((record) => record.contestantId === assessment.contestantId)!
          .emotionalPraise
          ? 5
          : 0),
    ),
    category: person(state, assessment.contestantId).track,
  }));
  const units = Object.fromEntries(
    ep.participantIds.map((id) => [
      id,
      1 + Number(ep.originalPerformances.find((record) => record.contestantId === id)!.emotionalPraise),
    ]),
  );
  const total = Object.values(units).reduce((sum, value) => sum + value, 0);
  ep.exposure = Object.fromEntries(ep.participantIds.map((id) => [id, units[id] / total]));
  ep.audienceContestants = structuredClone(ep.participantIds.map((id) => person(state, id)));
  ep.audienceBefore = structuredClone(state.runtime!.show);
  ep.audienceMood = structuredClone(state.runtime!.preparations![11]!.mood!);
  const result = resolveNarrativeEvidenceAudience({
    contestants: ep.audienceContestants,
    evidence: ep.evidence,
    exposure: ep.exposure,
    mood: ep.audienceMood,
    show: state.runtime!.show,
    random: recorded(ep.audienceRandom, random),
    rankingRetention: 1,
  });
  ep.audience = result.outcome;
  ep.audienceAfter = structuredClone(result.show);
  state.runtime!.show = result.show;
  const maximumVotes = Math.max(...Object.values(result.outcome.votes));
  for (const entry of result.contestants) {
    const previous = person(state, entry.id);
    const finalScore = ep.panel.find((assessment) => assessment.contestantId === entry.id)!.finalScore;
    const bonus = ep.executive!.contestantIds.includes(entry.id) ? 50 : 0;
    const components = {
      prior: previous.aggregations.rankingScore,
      performance: 0.6 * finalScore,
      publicVotes: 0.3 * (maximumVotes ? (100 * result.outcome.votes[entry.id]) / maximumVotes : 0),
      production: 0.1 * (50 * (entry.aggregations.productionRatio + 1)),
      executive: bonus,
      total: entry.aggregations.rankingScore + bonus,
    };
    ep.rankingComponents[entry.id] = components;
    ep.sealedRankingScores[entry.id] = components.total;
    entry.rank = previous.rank;
    entry.aggregations.rankingScore = previous.aggregations.rankingScore;
    ep.rankingTieKeys[entry.id] = random();
  }
  ep.rankedIds = [...ep.participantIds].sort(
    (a, b) =>
      ep.sealedRankingScores[b] - ep.sealedRankingScores[a] ||
      ep.rankingTieKeys[a] - ep.rankingTieKeys[b] ||
      a.localeCompare(b),
  );
  ep.winnerIds = ep.rankedIds.slice(0, 5);
  const updated = new Map(result.contestants.map((entry) => [entry.id, entry]));
  state.contestants = state.contestants.map((entry) => updated.get(entry.id) ?? entry);
  append(
    state,
    'tally',
    7,
    'The vote closes',
    [
      'Mike stands with all eight finalists while the public vote closes. The room waits together.',
      'Only five group members will be called. No numerical totals or unseen places are announced.',
    ],
    ep.participantIds,
  );
}
function publishResults(state: SimulationState) {
  const ep = epFor(state);
  ep.resultsPublished = true;
  ep.centerId = ep.winnerIds[0];
  for (const [index, id] of ep.rankedIds.entries()) {
    const entry = person(state, id);
    entry.rank = index + 1;
    entry.aggregations.rankingScore = ep.sealedRankingScores[id];
    entry.status = index < 5 ? 'WINNER' : 'ELIMINATED';
    entry.events.push(index < 5 ? 'FINALE_WINNER' : 'FINALE_NOT_SELECTED');
    entry.grade = ep.panel.find((assessment) => assessment.contestantId === id)!.grade;
    entry.missionRating = { A: 5, B: 4, C: 3, D: 2, F: 1 }[entry.grade];
    if (id === ep.centerId) {
      entry.aggregations.center++;
      entry.events.push('FINALE_CENTER');
    }
  }
  for (const record of ep.nerves)
    if (record.before !== record.after && person(state, record.contestantId).condition === record.after)
      person(state, record.contestantId).condition = record.before;
}
function reveal(state: SimulationState) {
  const ep = epFor(state);
  const rank = 5 - ep.revealedWinnerIds.length;
  const id = ep.winnerIds[rank - 1];
  ep.revealedWinnerIds.push(id);
  if (rank === 1) publishResults(state);
  append(
    state,
    'winner-reveal',
    8,
    rank === 1 ? 'The official Center' : `Group member: place ${rank}`,
    [
      `${mention(id)} is announced ${rank === 1 ? 'in first place, the official Center of the five-person group' : `in place ${rank}, joining the final group`}.`,
      `${mention(id)} ${person(state, id).personality.extroversion >= 5 ? 'breaks into a bright smile and reaches for the other announced members' : 'takes a breath, smiles through the emotion and joins the announced members'}.`,
    ],
    [id],
    { key: 'winner-announcement', ids: [id], tier: 3 },
  );
}
function advance(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  switch (ep.phase) {
    case 'briefing':
      draft(state, random);
      break;
    case 'draft':
      if (ep.draftPicks.length < 6) draft(state, random);
      else {
        playOpening(state, 11);
        ep.openingCast = [...state.runtime!.openingCast!];
        append(
          state,
          'credits',
          2,
          'The final opening',
          ['The confirmed five portraits and shared opening welcome the finalists to their final evening.'],
          ep.openingCast,
        );
      }
      break;
    case 'credits':
    case 'rehearsals':
      rehearse(state, random);
      break;
    case 'panel-return':
      perform(state, random, 'original');
      break;
    case 'originals':
      if (ep.originalPerformances.length < 8) perform(state, random, 'original');
      else perform(state, random, 'theme');
      break;
    case 'theme':
      if (ep.themePerformances.length < 8) perform(state, random, 'theme');
      else panel(state);
      break;
    case 'panel':
      tally(state, random);
      break;
    case 'tally':
      reveal(state);
      break;
    case 'winner-reveal':
      if (ep.revealedWinnerIds.length < 5) reveal(state);
      else {
        const before = structuredClone(state.runtime!.show);
        const draws: number[] = [];
        const after = transferEliminatedFans(
          before,
          state.contestants,
          ep.winnerIds,
          recorded(draws, random),
        );
        state.runtime!.show = after;
        ep.fanTransfers.push({
          survivorIds: [...ep.winnerIds],
          before,
          after: structuredClone(after),
          random: draws,
        });
        append(
          state,
          'celebration',
          8,
          'The group takes its first bow',
          [
            `The five members stand together: ${ep.winnerIds.map(mention).join(', ')}.`,
            'Mike thanks all eight finalists for the stages they shared. The group celebrates its first bow as the lights soften.',
          ],
          ep.winnerIds,
        );
      }
      break;
    case 'celebration':
      append(state, 'complete', 8, 'Squirrel Zone: The Search concludes', [
        'The five-person group shares the final frame. The broadcast fades to black.',
      ]);
      ep.postSeason = finalePostSeason(state.runtime!.show.audience, state.runtime!.show.satisfaction);
      state.runtime!.phase = 'season-complete';
      break;
    default:
      throw new Error('Confirm exactly three finalists in the private executive decision first.');
  }
}
function capture(state: SimulationState, before: Contestant[], cause: string, privateAction = false) {
  const ep = epFor(state);
  const scene = ep.scenes.at(-1)!;
  for (const id of ep.participantIds) {
    const changes = recordContestantChanges(
      before.find((entry) => entry.id === id)!,
      person(state, id),
      cause,
    );
    ep.changes[id] ??= [];
    ep.changes[id].push(...changes);
    if (changes.length && !privateAction) {
      scene.contestantChanges ??= {};
      scene.contestantChanges[id] = structuredClone(changes);
    }
  }
}
export function captureFinaleStart(state: SimulationState, before: Contestant[]): void {
  capture(state, before, 'Finale: briefing');
}
export function applyFinaleAction(state: SimulationState, action: FinaleAction, random: RandomSource): void {
  const ep = epFor(state);
  const before = structuredClone(state.contestants.filter((entry) => ep.participantIds.includes(entry.id)));
  const previousPhase = ep.phase;
  if (action.type === 'executive') {
    if (
      ep.phase !== 'executive-choice' ||
      ep.executive ||
      !Array.isArray(action.contestantIds) ||
      action.contestantIds.length !== 3 ||
      new Set(action.contestantIds).size !== 3 ||
      action.contestantIds.some((id) => !ep.participantIds.includes(id))
    )
      throw new Error('Choose exactly three distinct current finalists at the executive gate.');
    ep.executive = {
      contestantIds: [...action.contestantIds],
      effects: action.contestantIds.map((id) => {
        const entry = person(state, id);
        const before = entry.aggregations.productionRatio;
        entry.aggregations.productionRatio = clampBattle(before + 0.5, -1, 1);
        return { contestantId: id, before, after: entry.aggregations.productionRatio, rankingBonus: 50 };
      }),
    };
    // The private action is deliberately not an aired scene or a public change attachment.
    ep.phase = 'rehearsals';
  } else if (action.type === 'advance') {
    if (ep.executive && ep.phase === 'rehearsals' && ep.rehearsals.length === 16) returningPanel(state);
    else advance(state, random);
  } else throw new Error('Only the current Finale action is available.');
  ep.lastAction = { revision: ep.revision, action: structuredClone(action) };
  ep.revision++;
  capture(
    state,
    before,
    action.type === 'executive'
      ? 'Private label executive decision (not broadcast)'
      : `Finale: ${previousPhase}`,
    action.type === 'executive',
  );
}
export function publishFinaleHistory(state: SimulationState): void {
  const ep = epFor(state);
  if (!ep.resultsPublished) return;
  state.contestants = state.contestants.map((entry) => {
    if (!ep.participantIds.includes(entry.id) || entry.changeLog.some((log) => log.episode === 11))
      return entry;
    return appendContestantHistory(
      entry,
      {
        episode: 11,
        phaseId: `${state.runtime!.runId}:finale:complete`,
        rank: entry.rank,
        status: entry.status,
        score: entry.aggregations.rankingScore,
        missionRating: entry.missionRating,
        events: entry.events.filter((event) => event.startsWith('FINALE_')),
        summary:
          entry.id === ep.centerId
            ? 'Official Center of the five-person group.'
            : ep.winnerIds.includes(entry.id)
              ? 'Selected for the five-person group.'
              : 'Not selected for the final group; the completed finale contribution remains part of the season.',
      },
      ep.changes[entry.id] ?? [],
    );
  });
}
