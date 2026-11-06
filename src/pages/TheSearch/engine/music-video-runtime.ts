import type { EpisodeScene } from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import type {
  MusicVideoAction,
  MusicVideoEpisode,
  MusicVideoPhase,
  MusicVideoTake,
} from '../types/music-video-episode';
import type { SimulationState } from '../types/simulation';
import {
  chooseEvidenceMvp,
  resolveNarrativeEvidenceAudience,
  transferEliminatedFans,
} from './audition-audience';
import { rollAuditionDice } from './audition-scoring';
import { revealAuditionSecret, revealExactAuditionSecret } from './audition-secrets';
import { battleRelationship, changeBattleRelationship, clampBattle } from './battle-scoring';
import { appendContestantHistory, recordContestantChanges } from './change-history';
import { playOpening } from './episode-preparation';
import {
  assessMusicVideo,
  createMusicVideoCut,
  musicVideoMean,
  musicVideoSlots,
  scoreMusicVideoSolo,
  scoreMusicVideoTake,
} from './music-video-scoring';
import { type RandomSource, shuffleWithRandom } from './random';
import { unrevealedVersatilityCards } from './versatility-expulsion';

const host = { name: 'Mike Philip', role: 'Host' };
const director = { name: 'Vivienne Voss', role: 'Guest Director' };
const epFor = (state: SimulationState) => state.runtime!.musicVideo!;
const person = (state: SimulationState, id: string): Contestant => {
  const found = state.contestants.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown Music Videos contestant "${id}".`);
  return found;
};
const mention = (id: string) => `[[contestant:${id}]]`;
const recorded =
  (draws: number[], random: RandomSource): RandomSource =>
  () => {
    const value = random();
    draws.push(value);
    return value;
  };

function append(
  state: SimulationState,
  phase: MusicVideoPhase,
  sequence: number,
  title: string,
  paragraphs: string[],
  ids: string[] = [],
  tv?: { key: string; ids: string[]; tier: 1 | 3 | 6 },
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
      : phase === 'solos' || phase === 'takes'
        ? 'battles'
        : phase === 'storyboards'
          ? 'practice'
          : phase === 'ranking'
            ? 'ranking'
            : phase === 'elimination' || phase === 'farewell'
              ? 'eliminations'
              : phase === 'peer-mvp'
                ? 'mvp'
                : phase === 'secret-choice' || phase === 'secret-result'
                  ? 'secret'
                  : 'recap';
  ep.phase = phase;
  ep.scenes.push({
    id: `music-video-${ep.scenes.length}`,
    sequence,
    kind,
    title,
    paragraphs: plain,
    paragraphContestantIds,
    contestantIds: [...new Set(ids)],
    presentation:
      phase === 'credits'
        ? 'credits'
        : phase === 'solos' || phase === 'takes'
          ? 'performance'
          : phase === 'panel'
            ? 'judges'
            : 'host',
    speaker: sequence >= 3 && sequence <= 7 ? director : host,
    ...(tv && tv.ids.length
      ? { tvMoments: { [tv.key]: Object.fromEntries(tv.ids.map((id) => [id, tv.tier])) } }
      : {}),
  });
  // Ordinary behind-the-scenes coverage is separate from the premiere's percentage credit.
  if (phase !== 'premiere') for (const id of new Set(ids)) person(state, id).aggregations.screenTime++;
}

export function initializeMusicVideo(state: SimulationState, randomStartState: number): void {
  const runtime = state.runtime!;
  const ids = [...runtime.varietyShow!.survivorIds];
  const active = state.contestants.filter((entry) => entry.status === 'ACTIVE');
  if (
    ids.length !== 10 ||
    new Set(ids).size !== 10 ||
    active.length !== 10 ||
    active.some((entry) => !ids.includes(entry.id))
  )
    throw new Error('Music Videos requires exactly the ten final Variety Show survivors.');
  const prep = runtime.preparations![9]!;
  if (!prep.mood || prep.requiredSelections || prep.openingPlayed)
    throw new Error('Confirm the Episode 9 opening before the briefing.');
  runtime.musicVideo = {
    version: 1,
    randomStartState,
    revision: 0,
    lastAction: { revision: 0, action: { type: 'start' } },
    phase: 'briefing',
    participantIds: ids,
    startingContestants: structuredClone(state.contestants),
    startingShow: structuredClone(runtime.show),
    previousRankedIds: [...ids].sort((a, b) => person(state, a).rank - person(state, b).rank),
    openingCast: [],
    startingOpeningCast: [...runtime.openingCast!],
    startingPreparation: structuredClone(prep),
    startingRevealedSecrets: structuredClone(runtime.revealedSecrets),
    startingDeferredConsequences: structuredClone(runtime.deferredConsequences),
    steps: [],
    storyboards: [],
    directorReactions: [],
    solos: [],
    takes: [],
    reset: null,
    conditionChanges: [],
    fatigue: {},
    heroSmileIds: [],
    filmingCompleted: false,
    recovered: false,
    cut: null,
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
    eliminatedId: null,
    rankRevealed: false,
    sealedRankingScores: {},
    rankingTieKeys: {},
    fanTransfers: [],
    scenes: [],
    changes: {},
  };
  runtime.episode = 9;
  runtime.phase = 'music-video';
  append(
    state,
    'briefing',
    1,
    'Squirrel Life: your shared concept',
    [
      `Mike welcomes the final ten: ${ids.map(mention).join(', ')}.`,
      '"You will make one official Squirrel Life music video together. Bring a real personal scene and help connect it to the shared concept."',
      'The cast have space to propose their own creative direction. The confirmed opening portraits will air after the storyboards.',
    ],
    ids,
  );
}

function storyboard(state: SimulationState) {
  const ep = epFor(state);
  const id = ep.participantIds[ep.storyboards.length];
  const entry = person(state, id);
  const prompts = state.runtime!.definitions.musicVideoCatalog!.storyboardPrompts;
  const prompt = prompts[ep.storyboards.length % prompts.length];
  const coordinates = entry.coreSkills.leadership >= 4;
  const elaborate = entry.personality.curiosity >= 5;
  const overnightFatigue = entry.personality.investment >= 5 ? 1 : 0;
  const proposal = `${entry.name} proposes ${prompt.name.toLowerCase()}: ${prompt.description}${elaborate ? ' Adds a detailed match-cut and expression cue to connect the locations.' : ' Supplies a clear entrance, personal reaction and exit into the group scene.'}${coordinates ? ' Coordinates the handoff between their scene and the next owned proposal.' : ''}`;
  ep.storyboards.push({
    contestantId: id,
    completed: true,
    promptId: prompt.id,
    proposal,
    coordinates,
    elaborate,
    overnightFatigue,
  });
  ep.fatigue[id] = overnightFatigue;
  append(
    state,
    'storyboards',
    1,
    `${entry.name}'s storyboard`,
    [
      `${mention(id)} owns this aired proposal. ${proposal}`,
      overnightFatigue
        ? `${mention(id)} rehearses facial expressions overnight, adding one temporary fatigue unit but no lasting skill advantage.`
        : `${mention(id)} finishes the proposal and takes the scheduled rest.`,
    ],
    [id],
  );
}

function takeover(state: SimulationState) {
  const ep = epFor(state);
  ep.directorReactions = ep.storyboards.map((board) => {
    const entry = person(state, board.contestantId);
    const happinessBefore = entry.aggregations.happiness;
    const professionalPivot = entry.personality.maturity >= 5 || entry.personality.resilience >= 5;
    if (entry.personality.ambition >= 5 && board.completed)
      entry.aggregations.happiness = clampBattle(happinessBefore - 4);
    return {
      contestantId: entry.id,
      happinessBefore,
      happinessAfter: entry.aggregations.happiness,
      professionalPivot,
      description: `${entry.name}'s owned proposal is set aside.${entry.personality.ambition >= 5 ? ' The loss of creative ownership visibly disappoints them.' : ' They take in the changed direction.'}${professionalPivot ? ' They pivot professionally and ask for the new marks, without pretending the disappointment has vanished.' : ' They listen to the new marks before returning to work.'}`,
    };
  });
  append(
    state,
    'director',
    3,
    'Vivienne Voss takes the floor',
    [
      'On the soundstage, Mike introduces guest director Vivienne Voss for the first time.',
      'Vivienne sets aside the ten recorded storyboards: "One official video, one coherent cut. We will use the prepared physical sets and my marked choreography."',
      ...ep.directorReactions.map((reaction) => `${mention(reaction.contestantId)}: ${reaction.description}`),
    ],
    ep.participantIds,
    {
      key: 'takeover-reaction',
      ids: ep.directorReactions
        .filter((entry) => entry.happinessAfter !== entry.happinessBefore || entry.professionalPivot)
        .map((entry) => entry.contestantId),
      tier: 3,
    },
  );
}

function solo(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const id = ep.participantIds[ep.solos.length];
  const entry = person(state, id);
  const set = state.runtime!.definitions.musicVideoCatalog!.soloSets[ep.solos.length];
  const result = scoreMusicVideoSolo(entry, set.id, rollAuditionDice(random));
  ep.solos.push(result);
  entry.aggregations.audienceRatio = result.preferenceAfter;
  append(
    state,
    'solos',
    4,
    `${entry.name}: ${set.name}`,
    [
      `${mention(id)} films a complete solo at ${set.name}. ${set.description}`,
      `The saved visual check is ${result.checks.visual.score.toFixed(1)} and acting charisma ${result.checks.charisma.score.toFixed(1)}. The completed result is ${result.finalScore.toFixed(1)} (${result.grade}).`,
      result.feedback,
    ],
    [id],
    result.frozen ? { key: 'stalled-cue', ids: [id], tier: 3 } : undefined,
  );
}

function resetReactions(state: SimulationState, take: MusicVideoTake) {
  const ep = epFor(state);
  const failure = take.failureIds[0];
  if (!failure) return;
  const others = ep.participantIds.filter((id) => id !== failure);
  const critics = others
    .filter((id) => {
      const p = person(state, id).personality;
      return p.ambition >= 5 && p.gentleness <= -5;
    })
    .sort(
      (a, b) =>
        battleRelationship(person(state, a), failure) - battleRelationship(person(state, b), failure) ||
        a.localeCompare(b),
    );
  const supporters = others
    .filter((id) => person(state, id).personality.gentleness >= 5)
    .sort(
      (a, b) =>
        battleRelationship(person(state, b), failure) - battleRelationship(person(state, a), failure) ||
        a.localeCompare(b),
    );
  const criticId = critics[0] ?? null;
  const supporterId = supporters[0] ?? null;
  const relationshipChanges: NonNullable<MusicVideoEpisode['reset']>['relationshipChanges'] = [];
  const change = (fromId: string, toId: string, delta: number) => {
    const entry = person(state, fromId);
    const before = battleRelationship(entry, toId);
    changeBattleRelationship(entry, toId, delta);
    relationshipChanges.push({ fromId, toId, before, after: battleRelationship(entry, toId) });
  };
  if (criticId) {
    change(criticId, failure, -2);
    change(failure, criticId, -1);
  }
  if (supporterId) {
    change(failure, supporterId, 2);
    change(supporterId, failure, 1);
  }
  ep.reset = { takeId: take.id, causeId: failure, criticId, supporterId, relationshipChanges };
}

function film(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const last = ep.takes.at(-1);
  const isReset = last?.scheduledTake === 4 && !last.isReset && !!ep.reset;
  const scheduledTake = (isReset ? 4 : (last?.scheduledTake ?? 0) + 1) as MusicVideoTake['scheduledTake'];
  const actualOrdinal = ep.takes.length + 1;
  const evaluations = ep.participantIds.map((id) => {
    const entry = person(state, id);
    const result = scoreMusicVideoTake(
      entry,
      rollAuditionDice(random),
      scheduledTake,
      actualOrdinal,
      ep.storyboards.find((board) => board.contestantId === id)!.overnightFatigue,
      ep.heroSmileIds.includes(id),
    );
    ep.fatigue[id] = result.fatigue;
    if (result.idolSmile) ep.heroSmileIds.push(id);
    if (
      scheduledTake === 4 &&
      entry.utilitySkills.stamina < 3 &&
      !ep.conditionChanges.some((change) => change.contestantId === id) &&
      ['STABLE', 'HEALTHY', 'STRESSED', 'ANXIOUS', 'CONFIDENT', 'ELATED', 'TIRED'].includes(entry.condition)
    ) {
      ep.conditionChanges.push({
        contestantId: id,
        before: entry.condition,
        after: 'EXHAUSTED',
        restored: false,
      });
      entry.condition = 'EXHAUSTED';
    }
    return result;
  });
  const failures = !isReset && scheduledTake === 4 ? evaluations.filter((entry) => entry.resetFailure) : [];
  const failureTieKeys = Object.fromEntries(failures.map((entry) => [entry.contestantId, random()]));
  failures.sort(
    (a, b) =>
      a.checks.consistency.skillLevel - b.checks.consistency.skillLevel ||
      a.finalScore - b.finalScore ||
      failureTieKeys[a.contestantId] - failureTieKeys[b.contestantId] ||
      a.contestantId.localeCompare(b.contestantId),
  );
  const take: MusicVideoTake = {
    id: `take-${scheduledTake}${isReset ? '-reset' : ''}`,
    scheduledTake,
    actualOrdinal,
    isReset,
    evaluations,
    failureIds: failures.map((entry) => entry.contestantId),
    failureTieKeys,
  };
  ep.takes.push(take);
  if (failures.length) resetReactions(state, take);
  if (scheduledTake === 5) ep.filmingCompleted = true;
  append(
    state,
    'takes',
    scheduledTake < 4 ? 5 : 6,
    isReset ? 'Take 4: the single group reset' : `Group Take ${scheduledTake}`,
    [
      isReset
        ? 'The one genuine group reset is filmed now. Both Take 4 passes will count equally in that scheduled slot; another reset is unavailable.'
        : `All ten film scheduled Take ${scheduledTake}. This is actual group pass ${actualOrdinal}; every person receives a fresh saved pair of dice.`,
      ...evaluations.map(
        (evaluation) =>
          `${mention(evaluation.contestantId)}: ${evaluation.description} Result ${evaluation.finalScore.toFixed(1)} (${evaluation.grade}).`,
      ),
      ...(failures.length
        ? [
            `${mention(ep.reset!.causeId)} has the most visible qualifying timing fumble; ${failures.length} real failure${failures.length === 1 ? '' : 's'} cause just one group reset.`,
            ...(ep.reset!.criticId
              ? [
                  `${mention(ep.reset!.criticId)} delivers a harsh timing criticism toward ${mention(ep.reset!.causeId)}.`,
                ]
              : []),
            ...(ep.reset!.supporterId
              ? [
                  `${mention(ep.reset!.supporterId)} offers ${mention(ep.reset!.causeId)} a practical count and marked handoff.`,
                ]
              : []),
          ]
        : []),
      ...(scheduledTake === 5
        ? [
            'Filming ends with the actual fifth scheduled take, not a guaranteed perfect pass. Crew call a safe rest.',
          ]
        : []),
    ],
    ep.participantIds,
    failures.length && (ep.reset!.criticId || ep.reset!.supporterId)
      ? {
          key: 'reset-exchange',
          ids: [ep.reset!.causeId, ep.reset!.criticId, ep.reset!.supporterId].filter(
            (id): id is string => !!id,
          ),
          tier: 3,
        }
      : evaluations.some((entry) => entry.idolSmile)
        ? {
            key: 'idol-smile',
            ids: evaluations.filter((entry) => entry.idolSmile).map((entry) => entry.contestantId),
            tier: 3,
          }
        : undefined,
  );
}

function premiere(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  if (!ep.filmingCompleted) throw new Error('Finish scheduled Take 5 before recovery and the cut.');
  for (const change of ep.conditionChanges) {
    const entry = person(state, change.contestantId);
    if (entry.condition === change.after) {
      entry.condition = change.before;
      change.restored = true;
    }
  }
  ep.fatigue = Object.fromEntries(ep.participantIds.map((id) => [id, 0]));
  ep.recovered = true;
  ep.cut = createMusicVideoCut(
    ep.solos,
    ep.takes,
    Object.fromEntries(ep.participantIds.map((id) => [id, random()])),
  );
  ep.exposure = { ...ep.cut.exposure };
  for (const id of ep.participantIds) person(state, id).aggregations.screenTime += ep.cut.presence[id];
  append(
    state,
    'premiere',
    7,
    'A few days later: the actual director’s cut',
    [
      'A few days of managed rest pass before the premiere. Episode-owned fatigue clears; only exhaustion caused by this shoot is restored to the recorded prior condition. Earlier injuries, exhaustion and emotional conditions are not cured.',
      'Vivienne screens one official Squirrel Life video: twenty percent shared choreography and eighty percent individual focus. Existing opening words may accompany the display; no new audio or rendered video asset is claimed.',
      ...ep.participantIds.map((id) => {
        const entry = person(state, id);
        const focus = ep.cut!.individualFocus[id];
        const reaction =
          focus > 0
            ? 'recognizes their completed solo and smiles at the individual focus'
            : entry.personality.ambition >= 5
              ? 'is visibly disappointed about losing individual focus, while recognizing their group footage remains'
              : 'looks for their marked position in the shared choreography and acknowledges the group-only edit';
        return `${mention(id)} ${reaction}. Individual focus ${focus.toFixed(2)}%; actual presence ${ep.cut!.presence[id].toFixed(2)}%.`;
      }),
    ],
    ep.participantIds,
    { key: 'premiere-reaction', ids: ep.participantIds, tier: 1 },
  );
}

function panel(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.panel = ep.solos.map((solo) =>
    assessMusicVideo(
      solo,
      ep.takes,
      ep.directorReactions.some(
        (entry) => entry.contestantId === solo.contestantId && entry.professionalPivot,
      ),
      ep.heroSmileIds.includes(solo.contestantId),
    ),
  );
  ep.evidence = ep.panel.map((assessment) => {
    const id = assessment.contestantId;
    const late = musicVideoMean(musicVideoSlots(id, ep.takes, (entry) => entry.finalScore).slice(3));
    const consistency = musicVideoMean(
      musicVideoSlots(id, ep.takes, (entry) => entry.checks.consistency.score),
    );
    const support = ep.reset?.supporterId === id ? 2 : 0;
    const reception = ep.heroSmileIds.includes(id) ? 5 : 0;
    return {
      contestantId: id,
      finalScore: assessment.finalScore,
      observedScore: clampBattle(0.6 * late + 0.4 * consistency + support),
      reception: clampBattle(assessment.finalScore + reception),
      category: person(state, id).track,
    };
  });
  ep.audienceContestants = structuredClone(ep.participantIds.map((id) => person(state, id)));
  ep.audienceBefore = structuredClone(state.runtime!.show);
  ep.audienceMood = structuredClone(state.runtime!.preparations![9]!.mood!);
  const result = resolveNarrativeEvidenceAudience({
    contestants: ep.audienceContestants,
    evidence: ep.evidence,
    exposure: ep.exposure,
    mood: ep.audienceMood,
    show: state.runtime!.show,
    random: recorded(ep.audienceRandom, random),
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
    const previous = person(state, entry.id);
    entry.rank = previous.rank;
    entry.aggregations.rankingScore = previous.aggregations.rankingScore;
  }
  const updated = new Map(result.contestants.map((entry) => [entry.id, entry]));
  state.contestants = state.contestants.map((entry) => updated.get(entry.id) ?? entry);
  append(
    state,
    'panel',
    7,
    'Four judges, five equal contributions',
    [
      'The technical performance and John, Megan, Michael LION and Vivienne each contribute twenty percent. Only the completed footage is assessed.',
      ...ep.panel.flatMap((assessment) => [
        `${mention(assessment.contestantId)}: ${assessment.finalScore.toFixed(1)} (${assessment.grade}).`,
        ...assessment.comments.map((entry) => entry.description),
      ]),
      'The audience votes once from this locked performance and actual presence. Public standings remain unchanged until Mike announces them.',
    ],
    ep.participantIds,
  );
}

function rank(state: SimulationState) {
  const ep = epFor(state);
  ep.rankRevealed = true;
  append(
    state,
    'ranking',
    8,
    'Mike announces all ten places',
    ep.rankedIds.map((id, index) => {
      const entry = person(state, id);
      const prior = entry.rank;
      entry.rank = index + 1;
      entry.aggregations.rankingScore = ep.sealedRankingScores[id];
      const assessment = ep.panel.find((entry) => entry.contestantId === id)!;
      entry.grade = assessment.grade;
      entry.missionRating = { A: 5, B: 4, C: 3, D: 2, F: 1 }[assessment.grade];
      const reaction =
        prior > entry.rank
          ? 'smiles at the rise'
          : prior < entry.rank
            ? entry.personality.resilience >= 5
              ? 'accepts the fall with a steady nod'
              : 'pauses to absorb the fall'
            : 'acknowledges the held position';
      return `${entry.rank}. ${mention(id)} moves from ${prior} and ${reaction}.`;
    }),
    ep.rankedIds,
    { key: 'standings-reaction', ids: ep.rankedIds, tier: 3 },
  );
}

function eliminate(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.survivorIds = ep.rankedIds.slice(0, 9);
  ep.eliminatedId = ep.rankedIds[9];
  const departing = person(state, ep.eliminatedId);
  departing.status = 'ELIMINATED';
  departing.events.push('MUSIC_VIDEO_ELIMINATED');
  const before = structuredClone(state.runtime!.show);
  const draws: number[] = [];
  const after = transferEliminatedFans(before, state.contestants, ep.survivorIds, recorded(draws, random));
  state.runtime!.show = after;
  ep.fanTransfers.push({
    survivorIds: [...ep.survivorIds],
    before,
    after: structuredClone(after),
    random: draws,
  });
  append(
    state,
    'elimination',
    8,
    'Rank ten leaves the competition',
    [
      `${mention(ep.eliminatedId)} is eliminated in tenth place. The departure status and fan transfer are now final.`,
      'Exactly nine remain eligible for the separate peer vote and investigation. The departing performer will give their farewell after those decisions.',
    ],
    [ep.eliminatedId],
  );
}

function mvp(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.mvpContestants = structuredClone(ep.survivorIds.map((id) => person(state, id)));
  ep.mvp = chooseEvidenceMvp(
    ep.mvpContestants,
    ep.evidence.filter((entry) => ep.survivorIds.includes(entry.contestantId)),
    ep.survivorIds,
    recorded(ep.mvpRandom, random),
    9,
  );
  person(state, ep.mvp.winnerId).aggregations.mvp++;
  append(
    state,
    'peer-mvp',
    8,
    'Nine survivors choose their MVP',
    [
      'All nine survivors vote privately among the other eight. The ranking and single departure are already final.',
      `${mention(ep.mvp.winnerId)} receives the peer MVP for the observed late filming, consistency and actual support.`,
    ],
    [ep.mvp.winnerId],
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
    (id) => unrevealedVersatilityCards(person(state, id), definitions).length > 0,
  );
  ep.secretCandidates = available
    ? shuffleWithRandom(ep.investigationEligibleIds, recorded(ep.investigationRandom, random)).slice(0, 3)
    : [];
  append(
    state,
    ep.secretCandidates.length ? 'secret-choice' : 'secret-result',
    8,
    ep.secretCandidates.length ? 'A separate investigation' : 'The investigation desk closes',
    ep.secretCandidates.length
      ? [
          'Production may investigate one of these survivors. Nothing found here can rewrite the sealed ranking or cause another departure.',
          ...ep.secretCandidates.map(mention),
          ...(ep.secretCandidates.length < 3
            ? ['Fewer than three eligible names remain; every eligible survivor is offered.']
            : []),
        ]
      : ['No eligible unrevealed card remains. No fallback secret or extra investigation is assigned.'],
  );
}

function advance(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  switch (ep.phase) {
    case 'briefing':
      storyboard(state);
      break;
    case 'storyboards':
      if (ep.storyboards.length < 10) storyboard(state);
      else {
        playOpening(state, 9);
        ep.openingCast = [...state.runtime!.openingCast!];
        append(
          state,
          'credits',
          2,
          'Opening credits',
          ['The five confirmed portraits and the shared opening introduce the continuing cast.'],
          ep.openingCast,
        );
      }
      break;
    case 'credits':
      takeover(state);
      break;
    case 'director':
      solo(state, random);
      break;
    case 'solos':
      if (ep.solos.length < 10) solo(state, random);
      else film(state, random);
      break;
    case 'takes':
      if (!ep.filmingCompleted) film(state, random);
      else premiere(state, random);
      break;
    case 'premiere':
      panel(state, random);
      break;
    case 'panel':
      rank(state);
      break;
    case 'ranking':
      eliminate(state, random);
      break;
    case 'elimination':
      mvp(state, random);
      break;
    case 'peer-mvp':
      investigate(state, random);
      break;
    case 'secret-result':
      append(
        state,
        'farewell',
        8,
        'The departing performer’s farewell',
        [
          `${mention(ep.eliminatedId!)} thanks the cast for the shared video and says goodbye in tenth place.`,
          `${mention(ep.survivorIds[0])} and the other survivors offer a final round of applause.`,
        ],
        [ep.eliminatedId!],
        { key: 'farewell', ids: [ep.eliminatedId!], tier: 3 },
      );
      break;
    case 'farewell':
      append(state, 'complete', 8, 'The final nine', [
        `The nine continuing performers: ${ep.survivorIds.map(mention).join(', ')}.`,
        'Music Videos closes with one departure. No further episode has begun.',
      ]);
      state.runtime!.phase = 'episode-complete';
      break;
    default:
      throw new Error('Resolve the current Music Videos investigation first.');
  }
}

function capture(state: SimulationState, before: Contestant[], cause: string) {
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
    if (changes.length) {
      scene.contestantChanges ??= {};
      scene.contestantChanges[id] = structuredClone(changes);
    }
  }
}

export function captureMusicVideoStart(state: SimulationState, before: Contestant[]): void {
  capture(state, before, 'Music Videos: briefing');
}

export function applyMusicVideoAction(
  state: SimulationState,
  action: MusicVideoAction,
  random: RandomSource,
): void {
  const ep = epFor(state);
  const before = structuredClone(state.contestants.filter((entry) => ep.participantIds.includes(entry.id)));
  const previousPhase = ep.phase;
  ep.lastAction = { revision: ep.revision, action: structuredClone(action) };
  ep.revision++;
  if (action.type === 'advance') advance(state, random);
  else if (
    action.type === 'secret' &&
    ep.phase === 'secret-choice' &&
    ep.secretCandidates.includes(action.contestantId)
  ) {
    const cards = unrevealedVersatilityCards(person(state, action.contestantId), state.runtime!.definitions);
    const result = cards.length
      ? revealExactAuditionSecret(
          state.contestants,
          action.contestantId,
          cards[0],
          state.runtime!.definitions,
        )
      : revealAuditionSecret(state.contestants, action.contestantId, state.runtime!.definitions);
    state.contestants = result.contestants;
    ep.secret = result.result;
    state.runtime!.deferredConsequences.push(...result.result.deferred);
    if (result.result.cardId)
      state.runtime!.revealedSecrets.push({
        contestantId: action.contestantId,
        cardId: result.result.cardId,
      });
    append(
      state,
      'secret-result',
      8,
      result.result.title,
      [
        `${mention(action.contestantId)}: ${result.result.description}`,
        'The sealed ranking and single departure stand. Status and ranking consequences remain deferred.',
      ],
      [action.contestantId],
      result.result.cardId
        ? { key: 'public-investigation-reaction', ids: [action.contestantId], tier: 6 }
        : undefined,
    );
  } else throw new Error('Only the current Music Videos action is available.');
  capture(state, before, `Music Videos: ${previousPhase}`);
  if (ep.phase === 'complete')
    state.contestants = state.contestants.map((entry) =>
      !ep.participantIds.includes(entry.id)
        ? entry
        : appendContestantHistory(
            entry,
            {
              episode: 9,
              phaseId: `${state.runtime!.runId}:music-video:complete`,
              rank: entry.rank,
              status: entry.status,
              score: entry.aggregations.rankingScore,
              missionRating: entry.missionRating,
              events: entry.events.filter((event) => event.startsWith('MUSIC_VIDEO_')),
              summary:
                ep.eliminatedId === entry.id
                  ? 'Eliminated in tenth place after Music Videos.'
                  : 'Continues among the final nine after Music Videos.',
            },
            ep.changes[entry.id] ?? [],
          ),
    );
}
