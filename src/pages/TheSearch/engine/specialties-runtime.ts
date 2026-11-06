import type { EpisodeScene } from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import type { SimulationState } from '../types/simulation';
import type { SpecialtiesAction, SpecialtiesPhase } from '../types/specialties-episode';
import {
  chooseEvidenceMvp,
  resolveNarrativeEvidenceAudience,
  transferEliminatedFans,
} from './audition-audience';
import { auditionGrade, rollAuditionDice } from './audition-scoring';
import { revealAuditionSecret, revealExactAuditionSecret } from './audition-secrets';
import { clampBattle } from './battle-scoring';
import { appendContestantHistory, recordContestantChanges } from './change-history';
import { playOpening } from './episode-preparation';
import { type RandomSource, shuffleWithRandom } from './random';
import { rehearseSpecialties, scoreSpecialtiesSolo, specialtiesFinalScore } from './specialties-scoring';
import { castSpecialtiesBallots, lockSpecialtiesFriendship } from './specialties-voting';
import { unrevealedVersatilityCards } from './versatility-expulsion';

const epFor = (state: SimulationState) => state.runtime!.specialties!;
const person = (state: SimulationState, id: string): Contestant => {
  const found = state.contestants.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown Specialties contestant "${id}".`);
  return found;
};
const mention = (id: string) => `[[contestant:${id}]]`;
const judges = {
  john: { name: 'John Stan', role: 'Music producer' },
  megan: { name: 'Megan Ryder', role: 'Veteran artist' },
  michael: { name: 'Michael Lion', role: 'Record-label executive' },
};
const recorded =
  (draws: number[], random: RandomSource): RandomSource =>
  () => {
    const value = random();
    draws.push(value);
    return value;
  };
function append(
  state: SimulationState,
  phase: SpecialtiesPhase,
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
      : phase === 'rehearsals'
        ? 'practice'
        : phase === 'performances'
          ? 'battles'
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
    id: `specialties-${ep.scenes.length}`,
    sequence,
    kind,
    title,
    paragraphs: plain,
    paragraphContestantIds,
    contestantIds: [...new Set(ids)],
    presentation:
      phase === 'credits'
        ? 'credits'
        : phase === 'performances'
          ? 'performance'
          : phase === 'panel'
            ? 'judges'
            : 'host',
    speaker: { name: 'Mike Philip', role: 'Host' },
    ...(tv && tv.ids.length
      ? { tvMoments: { [tv.key]: Object.fromEntries(tv.ids.map((id) => [id, tv.tier])) } }
      : {}),
  });
  for (const id of new Set(ids)) person(state, id).aggregations.screenTime++;
}
export function initializeSpecialties(state: SimulationState, randomStartState: number): void {
  const runtime = state.runtime!;
  const ids = [...runtime.musicVideo!.survivorIds];
  const active = state.contestants.filter((entry) => entry.status === 'ACTIVE');
  if (
    ids.length !== 9 ||
    new Set(ids).size !== 9 ||
    active.length !== 9 ||
    active.some((entry) => !ids.includes(entry.id))
  )
    throw new Error('Specialties requires exactly the nine Music Videos survivors.');
  const prep = runtime.preparations![10]!;
  if (!prep.mood || prep.requiredSelections || prep.openingPlayed)
    throw new Error('Confirm the Episode 10 opening before the briefing.');
  runtime.specialties = {
    version: 1,
    randomStartState,
    revision: 0,
    lastAction: { revision: 0, action: { type: 'start' } },
    phase: 'briefing',
    participantIds: ids,
    previousRankedIds: [...ids].sort((a, b) => person(state, a).rank - person(state, b).rank),
    startingContestants: structuredClone(state.contestants),
    startingShow: structuredClone(runtime.show),
    openingCast: [],
    startingOpeningCast: [...runtime.openingCast!],
    startingPreparation: structuredClone(prep),
    startingRevealedSecrets: structuredClone(runtime.revealedSecrets),
    startingDeferredConsequences: structuredClone(runtime.deferredConsequences),
    steps: [],
    friendship: null,
    songs: [],
    songOrder: [],
    performanceOrder: [],
    rehearsals: [],
    performances: [],
    peer: null,
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
  runtime.episode = 10;
  runtime.phase = 'specialties';
  append(
    state,
    'briefing',
    1,
    'Nine individual voices',
    [
      `Mike welcomes the Top 9: ${ids.map(mention).join(', ')}.`,
      '"Your own specialty takes the stage. We will see nine individual solos, and your peers will privately rank the complete performances."',
      '"First, after the opening, each of you will name the person you feel closest to. Mutual choices bring a shared reward."',
    ],
    ids,
  );
}
function friendship(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.friendship ??= lockSpecialtiesFriendship(
    ep.participantIds.map((id) => person(state, id)),
    random,
  );
  const game = ep.friendship;
  const choice = game.choices[game.revealedIds.length];
  game.revealedIds.push(choice.contestantId);
  const reciprocal = game.choices.find(
    (other) => other.contestantId === choice.targetId && other.targetId === choice.contestantId,
  );
  const matched = reciprocal && game.revealedIds.includes(reciprocal.contestantId);
  const paragraphs = [
    `${mention(choice.contestantId)} names ${mention(choice.targetId)} as their best-friend choice.`,
  ];
  if (matched) {
    const pair = [choice.contestantId, choice.targetId].sort() as [string, string];
    game.pairs.push(pair);
    for (const id of pair) {
      const entry = person(state, id);
      const happinessBefore = entry.aggregations.happiness;
      const audienceBefore = entry.aggregations.audienceRatio;
      const fanbaseBefore = entry.aggregations.fanbaseRatio;
      entry.aggregations.happiness = clampBattle(happinessBefore + 20);
      entry.aggregations.audienceRatio = clampBattle(audienceBefore + 0.1, -1, 1);
      entry.aggregations.fanbaseRatio = clampBattle(fanbaseBefore + 0.1, -1, 1);
      game.rewards.push({
        contestantId: id,
        happinessBefore,
        happinessAfter: entry.aggregations.happiness,
        audienceBefore,
        audienceAfter: entry.aggregations.audienceRatio,
        fanbaseBefore,
        fanbaseAfter: entry.aggregations.fanbaseRatio,
      });
    }
    paragraphs.push(
      `${pair.map(mention).join(' and ')} have now both named each other. The room applauds the reciprocal reveal as they celebrate the mutual choice.`,
    );
  } else paragraphs.push('Only this selection is public; Mike moves to the next booth recording.');
  append(
    state,
    'friendship',
    3,
    `${person(state, choice.contestantId).name}'s choice`,
    paragraphs,
    [choice.contestantId, choice.targetId],
    matched ? { key: 'mutual-choice', ids: [choice.contestantId, choice.targetId], tier: 3 } : undefined,
  );
}
function friendshipReactions(state: SimulationState) {
  const ep = epFor(state);
  const game = ep.friendship!;
  const matched = new Set(game.pairs.flat());
  for (const id of ep.participantIds) {
    const entry = person(state, id);
    if (!matched.has(id) && game.snapshot.find((other) => other.id === id)!.personality.sensitivity >= 5) {
      const before = entry.aggregations.happiness;
      entry.aggregations.happiness = clampBattle(before - 3);
      game.reactions.push({ contestantId: id, before, after: entry.aggregations.happiness });
    }
  }
  game.reactionsComplete = true;
  append(
    state,
    'friendship-reactions',
    3,
    'The full picture',
    [
      `All nine choices are now public. There are ${game.pairs.length} mutual pairs.`,
      ...game.reactions.map(
        (reaction) =>
          `${mention(reaction.contestantId)} quietly absorbs an unreturned choice. Mike gives them room before the rehearsal briefing.`,
      ),
      'Mike thanks everyone for making an honest choice and brings the cast back to their individual stages.',
    ],
    game.reactions.map((entry) => entry.contestantId),
    { key: 'unreturned-choice', ids: game.reactions.map((entry) => entry.contestantId), tier: 1 },
  );
}
function assignSongs(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const definitions = state.runtime!.definitions;
  const templates = shuffleWithRandom(definitions.specialtiesCatalog!.songs, random);
  ep.songOrder = templates.map((entry) => entry.id);
  ep.performanceOrder = shuffleWithRandom(ep.participantIds, random);
  ep.songs = ep.participantIds.map((id, index) => {
    const entry = person(state, id);
    const template = templates[index];
    const field = entry.track === 'VOCAL' ? 'vocalColor' : entry.track === 'RAP' ? 'rapStyle' : 'danceStyle';
    const specialtyId = entry.specialties[field];
    const visualVibeId = entry.specialties.visualVibe;
    const specialty = definitions.specialties[field][specialtyId];
    const visual = definitions.specialties.visualVibe[visualVibeId];
    if (!specialty || !visual || !template.arrangements[entry.track])
      throw new Error(
        'Specialties assignment requires valid frozen primary specialty and visual references.',
      );
    return {
      contestantId: id,
      songId: template.id,
      name: template.name,
      description: template.description,
      track: entry.track,
      specialtyId,
      specialtyDescription: specialty.description,
      visualVibeId,
      visualDescription: visual.description,
      arrangement: template.arrangements[entry.track],
      difficulty: 3 as const,
    };
  });
  append(
    state,
    'songs',
    4,
    'Nine tailored solo arrangements',
    ep.songs.map(
      (song) =>
        `${mention(song.contestantId)} receives "${song.name}": ${song.description} ${song.arrangement} The ${song.specialtyId} specialty (${song.specialtyDescription}) and ${song.visualVibeId} visual direction (${song.visualDescription}) shape this medium-difficulty solo.`,
    ),
    ep.participantIds,
  );
}
function rehearse(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const id = ep.participantIds[Math.floor(ep.rehearsals.length / 2)];
  const entry = person(state, id);
  const previous = ep.rehearsals.filter((record) => record.contestantId === id).at(-1);
  const result = rehearseSpecialties(
    entry,
    previous ? 2 : 1,
    rollAuditionDice(random),
    previous?.practiceAfter ?? 0,
  );
  ep.rehearsals.push(result);
  append(
    state,
    'rehearsals',
    4,
    `${entry.name}: rehearsal ${result.session}`,
    [
      `${mention(id)} ${result.session === 1 ? 'works through the complete solo in phrases, then puts the sections back together without the cue sheet' : 'performs a continuous full run, keeping the original phrasing and finishing marks'}.`,
      result.session === 1
        ? `${result.checks[0].score >= 70 ? 'The new material settles quickly' : 'The learning pass needs careful repetition'}; ${result.checks[1].score >= 50 ? 'the recalled phrases hold together' : 'several details need the cue sheet again'}. ${result.checks[2].score >= 50 ? 'Repeated entrances are reasonably consistent.' : 'Repeated entrances remain uneven, so the performer marks those transitions again.'}`
        : `${result.checks[0].score >= 50 ? 'Stamina supports the sustained run' : 'The continuous run is visibly demanding'}; ${result.checks[1].score >= 50 ? 'the repeated timing remains stable' : 'the timing varies between phrases'}, and ${result.checks[2].score >= 50 ? 'the remembered sequence stays intact' : 'the final sequence needs another look at the notes'}.`,
      result.enduranceStruggle
        ? 'The sustained run falters: uneven repeated timing and flagging stamina make the full arrangement harder to maintain. Crew offer a safe rest before the stage call.'
        : result.practiceAfter > result.practiceBefore
          ? 'The completed work gives the performer a firmer foundation for the solo.'
          : 'The completed work consolidates the stronger preparation already achieved.',
      entry.personality.ambition >= 5 && result.practiceAfter < 4
        ? `${mention(id)} is frustrated that the run is not yet as secure as intended, then returns to the marked transition instead of blaming a peer.`
        : `${mention(id)} notes the remaining cues and takes the scheduled break.`,
    ],
    [id],
    result.enduranceStruggle ? { key: 'endurance-run', ids: [id], tier: 1 } : undefined,
  );
}
function perform(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const id = ep.performanceOrder[ep.performances.length];
  const song = ep.songs.find((entry) => entry.contestantId === id)!;
  const rehearsal = ep.rehearsals.filter((entry) => entry.contestantId === id).at(-1)!;
  const result = scoreSpecialtiesSolo(
    person(state, id),
    song.songId,
    rollAuditionDice(random),
    rehearsal.practiceAfter,
    rehearsal.readinessModifier,
  );
  ep.performances.push(result);
  append(
    state,
    'performances',
    ep.performances.length <= 5 ? 5 : 6,
    `${person(state, id).name}: ${song.name}`,
    [
      `${mention(id)} performs the full ${song.track.toLowerCase()} arrangement of "${song.name}". ${song.description}`,
      'The three regular judges discuss the completed solo. The final assessment and grade wait until every solo and every private peer ballot is complete.',
    ],
    [id],
    result.shrinking || result.trainerAwe
      ? { key: result.trainerAwe ? 'trainer-awe' : 'shrinking-cue', ids: [id], tier: 3 }
      : undefined,
  );
  ep.scenes.at(-1)!.dialogues = result.comments.map((comment) => ({
    ...judges[comment.judgeId],
    paragraphs: [comment.description.replace(/^(John|Megan|Michael):\s*/, '')],
  }));
}
function peers(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.peer = castSpecialtiesBallots(
    ep.participantIds.map((id) => person(state, id)),
    ep.performances,
    random,
  );
  append(state, 'peer-rankings', 7, 'Nine private ballots', [
    'Each of the nine privately ranks all eight other completed solos. Every ballot is sealed before any received average is reported.',
    'Individual ballots and their motives are not broadcast to the cast. Each performer will learn only their received average, not who placed them where.',
  ]);
}
function panel(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.panel = ep.performances.map((performance) => {
    const peer = ep.peer!.averages[performance.contestantId];
    const finalScore = specialtiesFinalScore(performance, peer);
    return {
      contestantId: performance.contestantId,
      performance: performance.technical,
      john: performance.john,
      megan: performance.megan,
      michael: performance.michael,
      peer,
      finalScore,
      grade: auditionGrade(finalScore),
    };
  });
  ep.evidence = ep.performances.map((performance) => ({
    contestantId: performance.contestantId,
    finalScore: ep.panel.find((entry) => entry.contestantId === performance.contestantId)!.finalScore,
    observedScore: performance.observedScore,
    reception: clampBattle(performance.observedScore + (performance.trainerAwe ? 5 : 0)),
    category: person(state, performance.contestantId).track,
  }));
  const units = Object.fromEntries(
    ep.performances.map((entry) => [
      entry.contestantId,
      1 + Number(entry.trainerAwe) + Number(entry.shrinking),
    ]),
  );
  const total = Object.values(units).reduce((sum, value) => sum + value, 0);
  ep.exposure = Object.fromEntries(ep.participantIds.map((id) => [id, units[id] / total]));
  ep.audienceContestants = structuredClone(ep.participantIds.map((id) => person(state, id)));
  ep.audienceBefore = structuredClone(state.runtime!.show);
  ep.audienceMood = structuredClone(state.runtime!.preparations![10]!.mood!);
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
    'The complete solo assessment',
    [
      'Technical execution counts three parts; John, Megan and Michael one each; the received peer average two. The peer share is exactly one quarter of this episode assessment.',
      ...ep.panel.map(
        (entry) =>
          `${mention(entry.contestantId)}: technical ${entry.performance.toFixed(2)}, John ${entry.john.toFixed(2)}, Megan ${entry.megan.toFixed(2)}, Michael ${entry.michael.toFixed(2)}, received peer average ${entry.peer.toFixed(2)}. Final ${entry.finalScore.toFixed(2)} (${entry.grade}).`,
      ),
      'The audience votes once. Previous public standings remain in place until Mike announces the new result.',
    ],
    ep.participantIds,
  );
}
function rank(state: SimulationState) {
  const ep = epFor(state);
  ep.rankRevealed = true;
  const reactions: string[] = [];
  const standings = ep.rankedIds.map((id, index) => {
    const entry = person(state, id);
    const prior = entry.rank;
    entry.rank = index + 1;
    entry.aggregations.rankingScore = ep.sealedRankingScores[id];
    entry.grade = ep.panel.find((assessment) => assessment.contestantId === id)!.grade;
    entry.missionRating = { A: 5, B: 4, C: 3, D: 2, F: 1 }[entry.grade];
    const movement = prior - entry.rank;
    if (Math.abs(movement) >= 2 || entry.rank >= 7) {
      const reaction =
        movement > 0
          ? entry.personality.extroversion >= 5
            ? 'breaks into an open smile at the rise'
            : 'quietly smiles at the rise'
          : movement < 0
            ? entry.personality.resilience >= 5
              ? 'takes a steady breath and accepts the fall'
              : 'pauses to absorb the fall'
            : 'acknowledges the held place and waits for Mike to continue';
      reactions.push(`${mention(id)} ${reaction}.`);
    }
    return `${entry.rank}. ${mention(id)} moves from ${prior}.`;
  });
  append(state, 'ranking', 8, 'Mike announces all nine places', [...standings, ...reactions], ep.rankedIds, {
    key: 'standings-reaction',
    ids: ep.rankedIds,
    tier: 3,
  });
}
function eliminate(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.survivorIds = ep.rankedIds.slice(0, 8);
  ep.eliminatedId = ep.rankedIds[8];
  const entry = person(state, ep.eliminatedId);
  entry.status = 'ELIMINATED';
  entry.events.push('SPECIALTIES_ELIMINATED');
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
    'Rank nine leaves',
    [
      `${mention(entry.id)} is eliminated in ninth place. The single departure is final.`,
      'Eight survivors remain eligible for MVP and the ordinary investigation; the farewell follows those decisions.',
    ],
    [entry.id],
  );
}
function mvp(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  ep.mvpContestants = structuredClone(ep.survivorIds.map((id) => person(state, id)));
  // MVP observes native B, not the private peer-adjusted final assessment.
  ep.mvp = chooseEvidenceMvp(
    ep.mvpContestants,
    ep.evidence
      .map((entry) => ({ ...entry, finalScore: entry.observedScore }))
      .filter((entry) => ep.survivorIds.includes(entry.contestantId)),
    ep.survivorIds,
    recorded(ep.mvpRandom, random),
    8,
  );
  person(state, ep.mvp.winnerId).aggregations.mvp++;
  append(
    state,
    'peer-mvp',
    8,
    'Eight survivors choose their MVP',
    [
      'Each survivor privately votes among the other seven, using the observed solos and their own affinity.',
      `${mention(ep.mvp.winnerId)} receives the peer MVP. The sealed standings and departure remain unchanged.`,
    ],
    [ep.mvp.winnerId],
  );
}
function investigate(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  const definitions = state.runtime!.definitions;
  ep.investigationContestants = structuredClone(state.contestants);
  ep.investigationEligibleIds = ep.survivorIds.filter(
    (id) =>
      !person(state, id).events.some((event) => event.startsWith('SECRET_REVEALED:')) ||
      unrevealedVersatilityCards(person(state, id), definitions).length > 0,
  );
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
    ep.secretCandidates.length ? 'The investigation desk' : 'The investigation desk closes',
    ep.secretCandidates.length
      ? [
          'Production may investigate one of the shortlisted survivors. No finding can rewrite the ranking or add a departure.',
          ...ep.secretCandidates.map(mention),
          ...(ep.secretCandidates.length < 3
            ? ['Fewer than three eligible names remain; every eligible survivor is offered.']
            : []),
        ]
      : ['No eligible hidden card remains. No consolation investigation is assigned.'],
  );
}
function advance(state: SimulationState, random: RandomSource) {
  const ep = epFor(state);
  switch (ep.phase) {
    case 'briefing':
      playOpening(state, 10);
      ep.openingCast = [...state.runtime!.openingCast!];
      append(
        state,
        'credits',
        2,
        'Opening credits',
        ['The five confirmed portraits and shared opening welcome the continuing cast.'],
        ep.openingCast,
      );
      break;
    case 'credits':
      friendship(state, random);
      break;
    case 'friendship':
      if (ep.friendship!.revealedIds.length < 9) friendship(state, random);
      else friendshipReactions(state);
      break;
    case 'friendship-reactions':
      assignSongs(state, random);
      break;
    case 'songs':
      rehearse(state, random);
      break;
    case 'rehearsals':
      if (ep.rehearsals.length < 18) rehearse(state, random);
      else perform(state, random);
      break;
    case 'performances':
      if (ep.performances.length < 9) perform(state, random);
      else peers(state, random);
      break;
    case 'peer-rankings':
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
        'A final solo farewell',
        [
          `${mention(ep.eliminatedId!)} thanks the cast for sharing the stage and says goodbye in ninth place.`,
          'The eight survivors applaud the completed journey before returning to Mike.',
        ],
        [ep.eliminatedId!],
        { key: 'farewell', ids: [ep.eliminatedId!], tier: 3 },
      );
      break;
    case 'farewell':
      append(state, 'complete', 8, 'The Top 8 reach the upcoming finale', [
        `The eight continuing performers: ${ep.survivorIds.map(mention).join(', ')}.`,
        'Specialties closes with one departure. The upcoming finale awaits the Top 8; no new episode has begun.',
      ]);
      state.runtime!.phase = 'episode-complete';
      break;
    default:
      throw new Error('Resolve the current Specialties investigation first.');
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
export function captureSpecialtiesStart(state: SimulationState, before: Contestant[]): void {
  capture(state, before, 'Specialties: briefing');
}
export function applySpecialtiesAction(
  state: SimulationState,
  action: SpecialtiesAction,
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
        'The sealed ranking and single departure stand; status and ranking consequences remain deferred.',
      ],
      [action.contestantId],
      result.result.cardId
        ? { key: 'public-investigation-reaction', ids: [action.contestantId], tier: 6 }
        : undefined,
    );
  } else throw new Error('Only the current Specialties action is available.');
  capture(state, before, `Specialties: ${previousPhase}`);
  if (ep.phase === 'complete')
    state.contestants = state.contestants.map((entry) =>
      !ep.participantIds.includes(entry.id)
        ? entry
        : appendContestantHistory(
            entry,
            {
              episode: 10,
              phaseId: `${state.runtime!.runId}:specialties:complete`,
              rank: entry.rank,
              status: entry.status,
              score: entry.aggregations.rankingScore,
              missionRating: entry.missionRating,
              events: entry.events.filter((event) => event.startsWith('SPECIALTIES_')),
              summary:
                ep.eliminatedId === entry.id
                  ? 'Eliminated in ninth place after Specialties.'
                  : 'Reaches the upcoming finale among the Top 8 after Specialties.',
            },
            ep.changes[entry.id] ?? [],
          ),
    );
}
