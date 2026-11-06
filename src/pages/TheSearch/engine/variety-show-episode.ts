import type { EpisodeScene } from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import type { SimulationState } from '../types/simulation';
import type {
  VarietyShowAction,
  VarietyShowPhase,
  VarietyShowSegment,
  VarietyShowSegmentKind,
} from '../types/variety-show-episode';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { validateVarietyShowCatalog } from '../utilities/variety-show-catalog';
import { awardNewActivity, recordSceneTV } from './activity-awards';
import {
  chooseEvidenceMvp,
  resolveNarrativeEvidenceAudience,
  transferEliminatedFans,
} from './audition-audience';
import { rollAuditionDice } from './audition-scoring';
import { revealAuditionSecret, revealExactAuditionSecret } from './audition-secrets';
import { changeBattleRelationship, clampBattle } from './battle-scoring';
import { appendContestantHistory, recordContestantChanges } from './change-history';
import { applyPreparation, initializePreparation, playOpening } from './episode-preparation';
import { createSeededRandom, type RandomSource, shuffleWithRandom } from './random';
import { assessVarietyShow, finalizeVarietyShowSegment, scoreVarietyShow } from './variety-show-scoring';
import {
  createVarietyShowTeams,
  electVarietyShowLeader,
  varietyShowConflict,
  varietyShowConflictDescription,
  varietyShowIdeas,
} from './variety-show-teams';
import { assertVarietyShowEpisode, validateVarietyShow } from './variety-show-validation';
import { awardVarietyIceCategory, createVarietyIcebreaker } from './variety-show-voting';
import { unrevealedVersatilityCards } from './versatility-expulsion';

export { assertVarietyShowEpisode, validateVarietyShow } from './variety-show-validation';

const epFor = (state: SimulationState) => {
  if (!state.runtime?.varietyShow) throw new Error('Start Variety Show first.');
  return state.runtime.varietyShow;
};
const person = (state: SimulationState, id: string) => {
  const value = state.contestants.find((entry) => entry.id === id);
  if (!value) throw new Error(`Unknown Variety Show contestant "${id}".`);
  return value;
};
const mention = (id: string) => `[[contestant:${id}]]`;
const host = { name: 'Mike Philip', role: 'Host' };
const recordRandom =
  (values: number[], random: RandomSource): RandomSource =>
  () => {
    const value = random();
    values.push(value);
    return value;
  };

function append(
  state: SimulationState,
  phase: VarietyShowPhase,
  sequence: number,
  title: string,
  paragraphs: string[],
  ids: string[] = [],
  tier: 0 | 1 | 3 | 6 = 1,
  speaker?: { name: string; role: string },
) {
  const ep = epFor(state);
  const paragraphContestantIds: string[][] = [];
  const plain = paragraphs.map((paragraph) => {
    const references: string[] = [];
    const text = paragraph.replace(/\[\[contestant:([^\]]+)\]\]/g, (_, id: string) => {
      references.push(id);
      return person(state, id).name;
    });
    paragraphContestantIds.push(references);
    return text;
  });
  const kind: EpisodeScene['kind'] =
    phase === 'credits'
      ? 'opening'
      : phase === 'team-draw'
        ? 'draft'
        : phase === 'improv-preparation' || phase === 'intervention'
          ? 'practice'
          : phase === 'physical' || phase === 'interviews' || phase === 'improv'
            ? 'battles'
            : phase === 'ranking'
              ? 'ranking'
              : phase === 'elimination'
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
        id: `variety-show-${ep.scenes.length}`,
        sequence,
        kind,
        title,
        paragraphs: plain,
        contestantIds: [...new Set(ids)],
        paragraphContestantIds,
        presentation:
          phase === 'credits'
            ? 'credits'
            : ['physical', 'interviews', 'improv'].includes(phase)
              ? 'performance'
              : speaker
                ? 'host'
                : 'montage',
        ...(speaker ? { speaker } : {}),
      },
      tier,
    ),
  );
  for (const id of new Set(ids))
    if (ep.participantIds.includes(id)) person(state, id).aggregations.screenTime++;
}

function start(state: SimulationState, randomStartState: number) {
  const runtime = state.runtime!;
  const ids = [...runtime.versatility!.survivorIds];
  const active = state.contestants.filter((entry) => entry.status === 'ACTIVE');
  if (
    ids.length !== 12 ||
    new Set(ids).size !== 12 ||
    active.length !== 12 ||
    active.some((entry) => !ids.includes(entry.id))
  )
    throw new Error('Variety Show needs exactly the twelve final Versatility survivors.');
  validateVarietyShowCatalog(runtime.definitions.varietyShowCatalog);
  const previousRankedIds = [...ids].sort((a, b) => person(state, a).rank - person(state, b).rank);
  runtime.varietyShow = {
    version: 1,
    randomStartState,
    revision: 0,
    lastAction: { revision: 0, action: { type: 'start' } },
    phase: 'briefing',
    participantIds: ids,
    startingContestants: structuredClone(state.contestants),
    startingShow: structuredClone(runtime.show),
    previousRankedIds,
    openingCast: [],
    icebreaker: null,
    drawOrder: [],
    drawRandom: [],
    drawCursor: 0,
    teams: [],
    teamCursor: 0,
    conflict: null,
    physicalGameId: null,
    segments: [],
    panel: [],
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
    secretCandidates: [],
    investigationEligibleIds: [],
    investigationContestants: [],
    investigationRandom: [],
    secret: null,
    rankedIds: [],
    survivorIds: [],
    eliminatedIds: [],
    rankRevealed: false,
    sealedRankingScores: {},
    rankingTieKeys: {},
    fanTransfers: [],
    scenes: [],
    changes: {},
  };
  runtime.episode = 8;
  runtime.phase = 'variety-show';
  append(
    state,
    'briefing',
    1,
    'Variety Show: the final twelve meet Roxana',
    [
      `Mike welcomes ${ids.map(mention).join(', ')} to the studio.`,
      '"Tonight is about wit, likability and making a scene work together. John, Megan and Michael are joined by actress Roxana Michaels."',
      'Roxana: "Let us see your physical timing, an honest public conversation and an improvised scene. Every turn matters."',
    ],
    ids,
    1,
    host,
  );
}

function icebreaker(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  if (!ep.icebreaker) {
    ep.icebreaker = createVarietyIcebreaker(
      ep.participantIds.map((id) => person(state, id)),
      random,
    );
    append(
      state,
      'icebreaker',
      3,
      'Eight playful superlatives',
      [
        'The twelve privately choose eight playful superlatives. These are lighthearted game labels, not predictions or judgments of anyone’s worth.',
        'Mike will announce one winner at a time. Individual choices stay private.',
      ],
      [],
      0,
      host,
    );
    return;
  }
  const category = awardVarietyIceCategory(state.contestants, ep.icebreaker);
  append(
    state,
    'icebreaker',
    3,
    `${category.label}: ${person(state, category.winnerId).name}`,
    [
      `Mike announces ${mention(category.winnerId)} as the winner of "${category.label}".`,
      `${mention(category.winnerId)} ${person(state, category.winnerId).personality.extroversion >= 5 ? 'celebrates with a broad bow and a delighted grin' : 'smiles and thanks the room'}. The cast applauds the playful result.`,
    ],
    [category.winnerId],
    3,
    host,
  );
}

function draw(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  if (!ep.drawOrder.length) {
    ep.drawOrder = shuffleWithRandom(ep.participantIds, recordRandom(ep.drawRandom, random));
    ep.teams = createVarietyShowTeams(
      ep.drawOrder,
      ep.participantIds.map((id) => person(state, id)),
    );
  }
  const id = ep.drawOrder[ep.drawCursor++];
  const team = ep.teams.find((team) => team.memberIds.includes(id))!;
  const lines = [
    `${mention(id)} draws a ${team.name.split(' ')[0].toLowerCase()} ball and joins ${team.name}.`,
  ];
  const done = ep.drawCursor % 4 === 0;
  if (done) {
    lines.push(`${team.name}: ${team.memberIds.map(mention).join(', ')}.`);
    const hype = team.memberIds.find((id) => person(state, id).personality.extroversion >= 5);
    if (hype) lines.push(`${mention(hype)} rallies the new group with an enthusiastic team introduction.`);
    if (team.ambitionClash) {
      const [first, second] = team.ambitionClash.contestantIds;
      changeBattleRelationship(person(state, first), second, -2);
      changeBattleRelationship(person(state, second), first, -2);
      lines.push(
        `${mention(first)} and ${mention(second)} disagree over whether winning or simply enjoying the group should come first. The brief clash cools their exchange.`,
      );
    }
  }
  append(
    state,
    'team-draw',
    4,
    `${team.name}: blind draw ${ep.drawCursor} of 12`,
    lines,
    done ? team.memberIds : [id],
    done ? 3 : 1,
  );
}

function newSegment(
  state: SimulationState,
  kind: VarietyShowSegmentKind,
  index: number,
  random: RandomSource,
): VarietyShowSegment {
  const ep = epFor(state);
  const catalog = state.runtime!.definitions.varietyShowCatalog!;
  const team = ep.teams[index];
  const challengeDraw = kind === 'physical' && !ep.physicalGameId ? random() : null;
  if (challengeDraw !== null)
    ep.physicalGameId = catalog.physicalGames[Math.floor(challengeDraw * catalog.physicalGames.length)].id;
  const segment: VarietyShowSegment = {
    kind,
    teamId: team.id,
    challengeId:
      kind === 'physical'
        ? ep.physicalGameId!
        : kind === 'improv'
          ? team.preparation!.sceneId
          : 'public-interview',
    challengeDraw,
    promptIds: {},
    promptDraws: {},
    evaluations: [],
    teamScore: null,
    cohesion: 0,
    coordination: 0,
    chaosPenalty: 0,
    frozenContestants: structuredClone(team.memberIds.map((id) => person(state, id))),
  };
  ep.segments.push(segment);
  return segment;
}

function perform(state: SimulationState, kind: VarietyShowSegmentKind, index: number, random: RandomSource) {
  const ep = epFor(state);
  const team = ep.teams[index];
  const catalog = state.runtime!.definitions.varietyShowCatalog!;
  const segment =
    ep.segments.find((segment) => segment.kind === kind && segment.teamId === team.id) ??
    newSegment(state, kind, index, random);
  const ids = kind === 'interview' ? [team.memberIds[segment.evaluations.length]] : team.memberIds;
  const lines: string[] = [];
  if (kind === 'physical') {
    const game = catalog.physicalGames.find((game) => game.id === segment.challengeId)!;
    lines.push(`${game.name}: ${game.description}`);
  }
  if (kind === 'improv') {
    const prep = team.preparation!;
    lines.push(
      `${catalog.improvScenes.find((scene) => scene.id === prep.sceneId)!.description} The group puts its five-minute plan into action.`,
    );
  }
  for (const id of ids) {
    if (kind === 'interview') {
      segment.promptDraws[id] = random();
      const prompt =
        catalog.interviewPrompts[Math.floor(segment.promptDraws[id] * catalog.interviewPrompts.length)];
      segment.promptIds[id] = prompt.id;
      lines.push(`Mike asks ${mention(id)}: "${prompt.description}"`);
    }
    const evaluation = scoreVarietyShow(
      segment.frozenContestants.find((entry) => entry.id === id)!,
      kind,
      rollAuditionDice(random),
    );
    segment.evaluations.push(evaluation);
    if (kind === 'interview') {
      const interest = person(state, id)
        .attributes.map((attribute) => state.runtime!.definitions.cards.interest[attribute])
        .find(Boolean);
      const prompt = segment.promptIds[id];
      const answer = evaluation.events.some((event) => event.kind === 'calculated-fumble')
        ? '"I would obviously be the best at every job here. Even the—well, perhaps I should have picked just one."'
        : prompt === 'team-introduction'
          ? `"We are ${team.name}'s Department of Misplaced Objects. ${team.memberIds.map(mention).join(', ')}: four people, one prop, and far too many instructions."`
          : prompt === 'aired-learning'
            ? '"During the game just now, I learned that a clear handoff matters more than rushing. My lesson is called: Please Wait Until I Am Actually Holding It."'
            : prompt === 'public-interest' && interest
              ? `"My interest is ${interest.name}. For this demonstration, the imaginary object in my hand is my entire equipment budget. Please be impressed by how portable it is."`
              : prompt === 'ordinary-day'
                ? person(state, id).personality.extroversion >= 5
                  ? '"I would invite everyone over for an afternoon together. The harmless complication is discovering I only own one cup."'
                  : '"I would enjoy a quiet afternoon with something interesting to do. Then the telephone rings, and apparently I am in charge of a parade."'
                : '"Give me an ordinary afternoon and an empty cup. I can turn it into a remarkably unconvincing telephone."';
      lines.push(`${mention(id)}: ${answer}`);
    } else if (kind === 'improv') {
      const cue = team.memberIds.indexOf(id);
      lines.push(
        `${mention(id)}: ${
          [
            '"Before we begin, does this object actually belong here?"',
            '"It did until someone changed its label. Now I have no idea what to call it."',
            '"I can explain the label, but I will need a much larger imaginary clipboard."',
            '"Then let us put the first object back before the clipboard needs a label too."',
          ][cue]
        }`,
      );
    }
    lines.push(`${mention(id)}: ${evaluation.description.replace(`${person(state, id).name} `, '')}`);
  }
  if (segment.evaluations.length === 4) {
    finalizeVarietyShowSegment(segment, team.preparation?.coordination ?? 0);
    if (segment.chaosPenalty)
      lines.push(
        'With no member taking a firm structural lead, entrances overlap and the ending arrives without a clear cue. Individual jokes still receive their own response.',
      );
    lines.push(
      `${team.name}'s four completed turns settle the ensemble result at ${segment.teamScore!.toFixed(1)}.`,
    );
    lines.push(
      kind === 'physical'
        ? 'John: "The handoffs showed which movements were controlled and which still needed timing."'
        : kind === 'interview'
          ? 'Megan: "We heard four different public answers; the pauses and the spontaneous details both mattered."'
          : 'Michael: "The handoffs between your ideas showed the ensemble chemistry, separately from each joke."',
    );
  }
  append(
    state,
    kind === 'interview' ? 'interviews' : kind,
    kind === 'physical' ? 5 : kind === 'interview' ? 6 : 7,
    kind === 'interview' ? `${team.name}: ${person(state, ids[0]).name}'s answer` : `${team.name}: ${kind}`,
    lines,
    ids,
    0,
  );
  const scene = ep.scenes.at(-1)!;
  for (const evaluation of segment.evaluations.filter((entry) => ids.includes(entry.contestantId))) {
    for (const event of evaluation.events) {
      scene.tvMoments ??= {};
      scene.tvMoments[`gag:${evaluation.contestantId}:${event.kind}`] = { [evaluation.contestantId]: 3 };
    }
  }
}

function prepareImprov(state: SimulationState, index: number, random: RandomSource) {
  const ep = epFor(state);
  ep.teamCursor = index;
  const team = ep.teams[index];
  if (team.preparation) throw new Error('Improv preparation is already recorded.');
  const members = team.memberIds.map((id) => person(state, id));
  team.leaderContestants = structuredClone(members);
  team.leaderElection = electVarietyShowLeader(
    members,
    Object.fromEntries(team.memberIds.map((id) => [id, random()])),
  );
  team.leaderId = team.leaderElection.winnerId;
  person(state, team.leaderId).aggregations.leader++;
  const catalog = state.runtime!.definitions.varietyShowCatalog!;
  const sceneDraw = random();
  const propDraw = random();
  const scene = catalog.improvScenes[Math.floor(sceneDraw * catalog.improvScenes.length)];
  const props = catalog.propBoxes[Math.floor(propDraw * catalog.propBoxes.length)];
  const pair = varietyShowConflict(members);
  const description = varietyShowConflictDescription(members);
  const ideas = varietyShowIdeas(members);
  team.preparation = {
    completed: true,
    minutes: 5,
    sceneId: scene.id,
    propBoxId: props.id,
    sceneDraw,
    propDraw,
    coordination: 0,
    ideas,
    conflict: pair ? { contestantIds: pair, description: description!, choice: null } : null,
  };
  ep.conflict = pair ? { teamId: team.id, contestantIds: pair, description: description! } : null;
  append(
    state,
    pair ? 'intervention' : 'improv-preparation',
    7,
    `${team.name}: five minutes to build a scene`,
    [
      `${mention(team.leaderId)} is elected improv leader. There is no center role.`,
      `${scene.name}: ${scene.description}`,
      `${props.name}: ${props.description}`,
      ...ideas.map((idea) => `${mention(idea.contestantId)} proposes: ${idea.description}`),
      'The four test entrances, pass the props and rehearse the closing cue during five substantive minutes.',
      ...(description ? [description] : ['The group agrees on its cues without a production intervention.']),
    ],
    team.memberIds,
    3,
  );
}

function panel(state: SimulationState) {
  const ep = epFor(state);
  ep.panel = ep.participantIds.map((id) => assessVarietyShow(id, ep.segments));
  append(
    state,
    'panel',
    8,
    'Four judges, three completed segments',
    ep.panel.flatMap((entry) => [
      `${mention(entry.contestantId)}: variety ${entry.variety.toFixed(1)}; overall ${entry.finalScore.toFixed(1)} (${entry.grade}).`,
      ...entry.comments.map((comment) => comment.description),
    ]),
    [],
    0,
  );
}

function sealRanking(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  if (ep.audience) throw new Error('Variety Show audience was already resolved.');
  ep.evidence = ep.panel.map((assessment) => {
    const evaluations = ep.segments.flatMap((segment) =>
      segment.evaluations.filter((entry) => entry.contestantId === assessment.contestantId),
    );
    const physical = evaluations[0];
    const interview = evaluations[1];
    const improv = evaluations[2];
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
        0.5 * improv.personalScore +
          0.3 * physical.checks.charisma.score +
          0.2 * interview.checks.charisma.score +
          comic,
      ),
      reception: clampBattle(assessment.finalScore + reception),
      category: 'variety',
    };
  });
  const units = Object.fromEntries(
    ep.participantIds.map((id) => [
      id,
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
    ]),
  );
  const total = Object.values(units).reduce((sum, value) => sum + value, 0);
  ep.exposure = Object.fromEntries(ep.participantIds.map((id) => [id, units[id] / total]));
  ep.audienceContestants = structuredClone(ep.participantIds.map((id) => person(state, id)));
  ep.audienceBefore = structuredClone(state.runtime!.show);
  ep.audienceMood = structuredClone(state.runtime!.preparations![8]!.mood!);
  const result = resolveNarrativeEvidenceAudience({
    contestants: ep.audienceContestants,
    evidence: ep.evidence,
    exposure: ep.exposure,
    mood: ep.audienceMood,
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
  const updated = new Map(result.contestants.map((entry) => [entry.id, entry]));
  state.contestants = state.contestants.map((entry) => updated.get(entry.id) ?? entry);
}

function mvp(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  sealRanking(state, random);
  ep.mvpContestants = structuredClone(ep.participantIds.map((id) => person(state, id)));
  ep.mvp = chooseEvidenceMvp(
    ep.mvpContestants,
    ep.evidence,
    ep.participantIds,
    recordRandom(ep.mvpRandom, random),
    12,
  );
  person(state, ep.mvp.winnerId).aggregations.mvp++;
  append(
    state,
    'peer-mvp',
    8,
    'The comic MVP',
    [
      'All twelve cast a private peer ballot. Every other performer is eligible; no one votes for themselves.',
      `${mention(ep.mvp.winnerId)} is the comic MVP, recognized for the actual game, conversation and scene.`,
      'The public outcome has been sealed, but Mike has not announced any new place.',
    ],
    [ep.mvp.winnerId],
    3,
  );
}

function investigate(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const definitions = state.runtime!.definitions;
  ep.investigationContestants = structuredClone(state.contestants);
  ep.investigationEligibleIds = ep.participantIds.filter((id) => {
    const entry = person(state, id);
    return (
      !entry.events.some((event) => event.startsWith('SECRET_REVEALED:')) ||
      unrevealedVersatilityCards(entry, definitions).length > 0
    );
  });
  const available = ep.investigationEligibleIds.some(
    (id) => unrevealedVersatilityCards(person(state, id), definitions).length > 0,
  );
  ep.secretCandidates = available
    ? shuffleWithRandom(ep.investigationEligibleIds, recordRandom(ep.investigationRandom, random)).slice(0, 3)
    : [];
  append(
    state,
    ep.secretCandidates.length ? 'secret-choice' : 'secret-result',
    8,
    ep.secretCandidates.length ? 'A separate investigation' : 'The investigation desk closes',
    ep.secretCandidates.length
      ? [
          'Production may investigate one of these names before anyone leaves. Nothing found here can rewrite the sealed ranking or cause another departure.',
          ...ep.secretCandidates.map(mention),
          ...(ep.secretCandidates.length < 3
            ? ['Fewer than three eligible names remain; all eligible names are offered.']
            : []),
        ]
      : ['No eligible unrevealed card remains. The sealed ranking stands.'],
    ep.secretCandidates,
    0,
  );
}

function rank(state: SimulationState) {
  const ep = epFor(state);
  ep.rankRevealed = true;
  append(
    state,
    'ranking',
    8,
    'Mike announces all twelve places',
    ep.rankedIds.map((id, index) => {
      const entry = person(state, id);
      const prior = entry.rank;
      entry.rank = index + 1;
      entry.aggregations.rankingScore = ep.sealedRankingScores[id];
      const assessment = ep.panel.find((entry) => entry.contestantId === id)!;
      entry.grade = assessment.grade;
      entry.missionRating = { A: 5, B: 4, C: 3, D: 2, F: 1 }[assessment.grade];
      const movement =
        prior > index + 1
          ? `rises from ${prior}`
          : prior < index + 1
            ? `falls from ${prior}`
            : `holds ${prior}`;
      const reaction =
        Math.abs(prior - index - 1) >= 3
          ? entry.personality.resilience >= 5
            ? ' The large move draws a steady promise to keep working.'
            : entry.personality.sensitivity >= 5
              ? ' The large move leaves a visible pause before a quiet nod.'
              : ' The unexpected move draws a surprised breath.'
          : '';
      return `${index + 1}. ${mention(id)} ${movement}.${reaction}`;
    }),
    ep.rankedIds,
    3,
    host,
  );
}

function eliminate(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.survivorIds = ep.rankedIds.slice(0, 10);
  ep.eliminatedIds = ep.rankedIds.slice(10);
  for (const id of ep.eliminatedIds) {
    person(state, id).status = 'ELIMINATED';
    person(state, id).events.push('VARIETY_SHOW_ELIMINATED');
  }
  const before = structuredClone(state.runtime!.show);
  const values: number[] = [];
  const after = transferEliminatedFans(
    before,
    state.contestants,
    ep.survivorIds,
    recordRandom(values, random),
  );
  ep.fanTransfers.push({
    survivorIds: [...ep.survivorIds],
    before,
    after: structuredClone(after),
    random: values,
  });
  state.runtime!.show = after;
  append(
    state,
    'elimination',
    8,
    'Two farewells, ten continuing performers',
    [
      ...ep.eliminatedIds.map(
        (id) =>
          `${mention(id)} leaves in place ${person(state, id).rank}, thanking the group for the afternoon's scenes.`,
      ),
      ...ep.eliminatedIds.map(
        (id) =>
          `${mention(ep.survivorIds[0])} and the continuing cast offer ${mention(id)} a final round of applause.`,
      ),
      'Exactly ten continue. No additional elimination or expulsion is announced.',
    ],
    ep.eliminatedIds,
    3,
    host,
  );
}

function advance(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  switch (ep.phase) {
    case 'briefing':
      playOpening(state, 8);
      ep.openingCast = [...state.runtime!.openingCast!];
      append(
        state,
        'credits',
        2,
        'Opening credits',
        ['The five confirmed portraits and the opening introduce the continuing cast.'],
        ep.openingCast,
        1,
      );
      break;
    case 'credits':
      icebreaker(state, random);
      break;
    case 'icebreaker':
      if (ep.icebreaker!.revealCursor < 8) icebreaker(state, random);
      else draw(state, random);
      break;
    case 'team-draw':
      if (ep.drawCursor < 12) draw(state, random);
      else perform(state, 'physical', 0, random);
      break;
    case 'physical': {
      const count = ep.segments.filter((segment) => segment.kind === 'physical').length;
      if (count < 3) perform(state, 'physical', count, random);
      else perform(state, 'interview', 0, random);
      break;
    }
    case 'interviews': {
      const acts = ep.segments.filter((segment) => segment.kind === 'interview');
      const last = acts.at(-1)!;
      if (last.evaluations.length < 4) perform(state, 'interview', acts.length - 1, random);
      else if (acts.length < 3) perform(state, 'interview', acts.length, random);
      else prepareImprov(state, 0, random);
      break;
    }
    case 'improv-preparation':
      perform(state, 'improv', ep.teamCursor, random);
      break;
    case 'improv':
      if (ep.teamCursor < 2) prepareImprov(state, ep.teamCursor + 1, random);
      else panel(state);
      break;
    case 'panel':
      mvp(state, random);
      break;
    case 'peer-mvp':
      investigate(state, random);
      break;
    case 'secret-result':
      rank(state);
      break;
    case 'ranking':
      eliminate(state, random);
      break;
    case 'elimination':
      append(
        state,
        'complete',
        8,
        'The final ten',
        [
          `The ten continuing performers: ${ep.survivorIds.map(mention).join(', ')}.`,
          'Variety Show closes with two farewells. No further challenge has begun.',
        ],
        [],
        0,
      );
      state.runtime!.phase = 'episode-complete';
      break;
    default:
      throw new Error('Resolve the current Variety Show production choice first.');
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
    if (scene && scene.id !== oldSceneId && ep.phase !== 'icebreaker' && changes.length) {
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
  if (state.runtime!.varietyShow) freezeSimulationSnapshot(state.runtime!.varietyShow.startingContestants);
  state.persistenceError = null;
  return state;
}

export function transitionVarietyShow(
  current: SimulationState,
  action: VarietyShowAction,
  expectedRevision: number,
): SimulationState {
  const next = awardNewActivity(current, transitionInternal(current, action, expectedRevision));
  validateVarietyShow(next);
  return next;
}

function transitionInternal(
  current: SimulationState,
  action: VarietyShowAction,
  revision: number,
): SimulationState {
  const runtime = current.runtime;
  if (runtime?.version !== 3 || current.status !== 'ready' || runtime.versatility?.phase !== 'complete')
    throw new Error('Complete Versatility before starting Variety Show.');
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error('A valid Variety Show revision is required.');
  const old = runtime.varietyShow;
  const prep = runtime.preparations?.[8];
  if (!old) {
    if (!prep) {
      if (action.type !== 'start' || revision !== 0) throw new Error('Start Episode 8 preparation first.');
      const next = structuredClone(current);
      const random = createSeededRandom(runtime.randomState);
      initializePreparation(next, 8, random.next);
      return finalize(next, random);
    }
    if (
      (action.type === 'start' && revision === 0 && prep.revision === 0) ||
      (prep.lastAction?.revision === revision &&
        JSON.stringify(prep.lastAction.action) === JSON.stringify(action))
    )
      return current;
    if (revision !== prep.revision) throw new Error('This Variety Show preparation action is stale.');
    if (action.type !== 'mood' && action.type !== 'opening-cast' && action.type !== 'randomize-mood')
      throw new Error('Confirm the opening mood and replacements first.');
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    const before = structuredClone(next.contestants);
    applyPreparation(next, action, random.next);
    const nextPrep = next.runtime!.preparations![8]!;
    nextPrep.revision++;
    nextPrep.lastAction = { revision, action: structuredClone(action) };
    if (nextPrep.mood && !nextPrep.requiredSelections) {
      start(next, random.getState());
      capture(next, before, 'Variety Show: briefing');
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
  if (revision !== old.revision) throw new Error('This Variety Show action is stale; reload the episode.');
  if (old.phase === 'complete') throw new Error('Variety Show is complete.');
  assertVarietyShowEpisode(old, current.contestants, runtime.definitions);
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
      throw new Error('No eligible improv disagreement.');
    const team = ep.teams.find((team) => team.id === ep.conflict!.teamId)!;
    team.preparation!.conflict!.choice = action.choice;
    team.preparation!.coordination = clampBattle(
      team.preparation!.coordination + (action.choice === 'push' ? 3 : action.choice === 'support' ? 2 : 1),
      -5,
      5,
    );
    const [first, second] = ep.conflict.contestantIds;
    const delta = action.choice === 'push' ? -3 : action.choice === 'mediate' ? 2 : 1;
    changeBattleRelationship(person(next, first), second, delta);
    changeBattleRelationship(person(next, second), first, delta);
    ep.conflict = null;
    append(
      next,
      'improv-preparation',
      7,
      `${team.name}: production ${action.choice}`,
      [
        action.choice === 'push'
          ? 'Production pushes for a finished scene. The cues become clearer, but the pair return to work with less warmth.'
          : action.choice === 'mediate'
            ? 'Production hears the incompatible ideas and helps the pair agree on a cue, restoring some trust.'
            : 'Production offers practical reassurance. The pair agree on a handoff and return to the scene.',
      ],
      [first, second],
      3,
    );
  } else if (action.type === 'secret') {
    if (ep.phase !== 'secret-choice' || !ep.secretCandidates.includes(action.contestantId))
      throw new Error('Choose an eligible investigation candidate.');
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
        'The sealed ranking stands. Any status or ranking consequence is deferred; there are no additional departures.',
      ],
      [action.contestantId],
      result.result.cardId ? 6 : 0,
    );
  } else if (action.type === 'advance') advance(next, random.next);
  else throw new Error('Only the current Variety Show story action is available.');
  capture(next, before, `Variety Show: ${old.phase}`, old.scenes.at(-1)?.id);
  if (ep.phase === 'complete')
    next.contestants = next.contestants.map((entry) =>
      !ep.participantIds.includes(entry.id)
        ? entry
        : appendContestantHistory(
            entry,
            {
              episode: 8,
              phaseId: `${runtime.runId}:variety-show:complete`,
              rank: entry.rank,
              status: entry.status,
              score: entry.aggregations.rankingScore,
              missionRating: entry.missionRating,
              events: entry.events.filter((event) => event.startsWith('VARIETY_SHOW_')),
              summary: ep.eliminatedIds.includes(entry.id)
                ? `Eliminated in place ${entry.rank} after Variety Show.`
                : 'Continues among the final ten after Variety Show.',
            },
            ep.changes[entry.id] ?? [],
          ),
    );
  return finalize(next, random);
}
