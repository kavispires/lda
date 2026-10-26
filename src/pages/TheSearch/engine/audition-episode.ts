import type { AuditionEvaluation } from '../types/audition';
import type {
  AuditionAction,
  AuditionEpisode,
  AuditionReaction,
  EpisodeScene,
} from '../types/audition-episode';
import type { PropertyChange } from '../types/common';
import type { Contestant, Specialties } from '../types/contestant';
import type { SeasonRuntime, SimulationState } from '../types/simulation';
import { selectAuditionHighlights } from '../utilities/audition-highlights';
import { applySeasonRanks } from '../utilities/season-ranking';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { awardNewActivity, recordAiredReactions, recordSceneTV } from './activity-awards';
import {
  chooseAuditionMvp,
  createBroadcastCuts,
  resolveBroadcast,
  transferEliminatedFans,
} from './audition-audience';
import { AUDITION_CONFIG } from './audition-config';
import { chooseAuditionSongs, resolveLiveAudition, selectAuditionPool } from './audition-live';
import {
  AUDITION_BATCH_SIZES,
  auditionBiasScoreBoosts,
  drawAuditionTieBreakKey,
  rankAuditions,
  startAuditionBatch,
} from './audition-scoring';
import { revealAuditionSecret, validateSecretConsequences } from './audition-secrets';
import { appendContestantHistory, recordContestantChanges } from './change-history';
import { createSeededRandom, type RandomSource, shuffleWithRandom } from './random';

export const MOOD_FIELDS: (keyof Specialties)[] = [
  'vocalColor',
  'danceStyle',
  'rapStyle',
  'visualVibe',
  'leadershipStyle',
  'genreAffinity',
];

function requireEpisode(runtime: SeasonRuntime): AuditionEpisode {
  if (!runtime.audition) throw new Error('Start Episode 1 before continuing.');
  return runtime.audition;
}

function requireContestant(contestants: readonly Contestant[], id: string): Contestant {
  const contestant = contestants.find((entry) => entry.id === id);
  if (!contestant) throw new Error(`Episode contestant "${id}" does not exist.`);
  return contestant;
}

function scene(
  episode: AuditionEpisode,
  kind: EpisodeScene['kind'],
  title: string,
  paragraphs: string[],
  contestantIds: string[] = [],
): void {
  episode.scenes.push(
    recordSceneTV({
      id: `auditions-scene-${episode.scenes.length}`,
      kind,
      title,
      paragraphs,
      contestantIds,
    }),
  );
}

function captureChanges(state: SimulationState, before: readonly Contestant[], cause: string): void {
  if (!state.runtime) throw new Error('Missing season runtime.');
  const episode = requireEpisode(state.runtime);
  for (const contestant of state.contestants) {
    const previous = requireContestant(before, contestant.id);
    if (recordContestantChanges(previous, contestant, cause).length === 0) continue;
    contestant.updatedAt = state.createdAt + episode.revision;
    const changes = recordContestantChanges(previous, contestant, cause);
    episode.changes[contestant.id] ??= [];
    episode.changes[contestant.id].push(...changes);
  }
}

function finishEpisode(state: SimulationState): void {
  if (!state.runtime) throw new Error('Missing season runtime.');
  const runtime = state.runtime;
  const episode = requireEpisode(runtime);
  const byId = new Map(episode.evaluations.map((evaluation) => [evaluation.contestantId, evaluation]));
  state.contestants = state.contestants.map((contestant) => {
    const evaluation = byId.get(contestant.id);
    if (!evaluation) throw new Error('Cannot close Auditions before everyone performs.');
    return appendContestantHistory(
      contestant,
      {
        phaseId: 'episode-1',
        episode: 1,
        missionRating: contestant.missionRating,
        rank: contestant.rank,
        score: evaluation.finalScore,
        status: contestant.status,
        summary: `${evaluation.grade} audition. ${contestant.status === 'ELIMINATED' ? 'Eliminated.' : 'Survives Auditions.'}${episode.mvp?.winnerId === contestant.id ? ' Peer MVP.' : ''}`,
        events: contestant.events.filter(
          (event) =>
            !runtime.initialContestants
              .find((initial) => initial.id === contestant.id)
              ?.events.includes(event),
        ),
      },
      episode.changes[contestant.id] ?? [],
    );
  });
  episode.phase = 'complete';
  runtime.phase = 'episode-complete';
  scene(episode, 'recap', 'Episode 1 complete', [
    'Thirty contestants remain. Twenty departures are recorded in the season archive.',
    'The votes, performances, peer recognition, and closing consequences are saved. The next episode will not start automatically.',
  ]);
}

function makeEpisode(runtime: SeasonRuntime, random: RandomSource): AuditionEpisode {
  if (runtime.setup.useBias && runtime.initialContestants.filter((entry) => entry.bias === true).length > 30)
    throw new Error('Only 30 bias contestants can be protected in Auditions.');
  validateSecretConsequences(runtime.definitions.cards.secret);
  const pool = runtime.setup.auditionPoolIds
    ? runtime.setup.auditionPoolIds.map((id) => {
        const song = runtime.definitions.auditionSongs.find((entry) => entry.id === id);
        if (!song) throw new Error(`The snapshotted audition pool contains an unknown song: ${id}.`);
        return song;
      })
    : selectAuditionPool(runtime.definitions.auditionSongs, random);
  runtime.setup.auditionPoolIds = pool.map((song) => song.id);
  const options = (field: keyof Specialties): string[] => {
    const ids = Object.keys(runtime.definitions.specialties[field]);
    if (ids.length < 3) throw new Error(`The ${field} library needs at least three mood options.`);
    return shuffleWithRandom(ids, random).slice(0, 3);
  };
  return {
    version: 1,
    ...(runtime.setup.useBias ? { biasProtectionVersion: 1 as const } : {}),
    relationshipPolicy: 'everyone-forms-opinions',
    phase: 'mood',
    revision: 1,
    lastAction: { revision: 0, action: { type: 'start' } },
    pool: structuredClone(pool),
    moodOptions: {
      vocalColor: options('vocalColor'),
      danceStyle: options('danceStyle'),
      rapStyle: options('rapStyle'),
      visualVibe: options('visualVibe'),
      leadershipStyle: options('leadershipStyle'),
      genreAffinity: options('genreAffinity'),
    },
    mood: null,
    songChoices: {},
    order: [],
    cursor: 0,
    evaluations: [],
    batches: [],
    composure: {},
    reactions: [],
    scenes: [],
    changes: {},
    cuts: [],
    selectedCutId: null,
    audience: null,
    rankedIds: [],
    survivorIds: [],
    eliminatedIds: [],
    revealedEliminations: 0,
    mvp: null,
    secretCandidates: [],
    secret: null,
  };
}

function recordComposure(episode: AuditionEpisode, id: string, before: number, after: number, cause: string) {
  if (before === after) return;
  const change: PropertyChange = { path: 'episode1.composure', before, after, cause };
  episode.changes[id] ??= [];
  episode.changes[id].push(change);
}

function resolveLiveScene(state: SimulationState, random: RandomSource): void {
  if (!state.runtime) throw new Error('Missing season runtime.');
  const episode = requireEpisode(state.runtime);
  const paragraphs: string[] = [];
  const featured: string[] = [];
  const notes: { index: number; reaction: AuditionReaction }[] = [];
  for (let count = 0; count < AUDITION_CONFIG.auditionsPerScene && episode.cursor < 50; count++) {
    const batchIndex = episode.cursor < 13 ? 0 : episode.cursor < 26 ? 1 : episode.cursor < 39 ? 2 : 3;
    if (!episode.batches[batchIndex]) {
      const previous =
        batchIndex === 0 ? null : episode.evaluations.slice((batchIndex - 1) * 13, batchIndex * 13);
      const batch = startAuditionBatch(previous, random);
      episode.batches.push(batch);
      paragraphs.push(
        `The judges settle on ${batch.preferences.visualOrUniqueness} and ${batch.preferences.potentialOrCharisma} for this batch.`,
      );
    }
    const performerId = episode.order[episode.cursor];
    const before = structuredClone(state.contestants);
    const beforeComposure = episode.composure[performerId] ?? 0;
    const result = resolveLiveAudition({
      contestants: state.contestants,
      pool: episode.pool,
      songChoices: episode.songChoices,
      performerId,
      previousEvaluations: episode.evaluations,
      preferences: episode.batches[batchIndex].preferences,
      composure: episode.composure,
      random,
      relationshipPolicy: episode.relationshipPolicy ?? 'reactions-only',
    });
    let evaluation: AuditionEvaluation = result.evaluation;
    for (
      let attempt = 0;
      episode.evaluations.some((entry) => entry.tieBreakKey === evaluation.tieBreakKey);
      attempt++
    ) {
      if (attempt >= 100) throw new Error('Could not resolve a seeded audition tie-break collision.');
      evaluation = { ...evaluation, tieBreakKey: drawAuditionTieBreakKey(random) };
    }
    state.contestants = result.contestants;
    episode.composure = result.composure;
    episode.evaluations.push(evaluation);
    episode.reactions.push(...result.reactions);
    episode.cursor++;
    const performer = requireContestant(state.contestants, performerId);
    const song = episode.pool.find((entry) => entry.id === evaluation.songId);
    if (!song) throw new Error('Resolved audition has no locked song.');
    captureChanges(state, before, `Live audition: ${performer.name}`);
    recordComposure(
      episode,
      performerId,
      beforeComposure,
      0,
      `Perform ${song.title}; consume temporary composure`,
    );
    for (const reaction of result.reactions) {
      recordComposure(
        episode,
        reaction.observerId,
        reaction.composureBefore,
        reaction.composureAfter,
        reaction.narrative,
      );
    }
    const quality =
      evaluation.grade === 'A' ? 'a standout' : evaluation.grade === 'F' ? 'a difficult' : 'a steady';
    paragraphs.push(
      `${performer.name} performs "${song.title}"${performer.track !== song.track ? ' outside their usual track' : ''}: ${quality} audition, graded ${evaluation.grade}.`,
    );
    for (const reaction of result.reactions) {
      notes.push({ index: paragraphs.length, reaction });
      paragraphs.push(reaction.narrative);
    }
    featured.push(performerId);
    if (episode.cursor === AUDITION_BATCH_SIZES.slice(0, batchIndex + 1).reduce((sum, size) => sum + size, 0))
      break;
  }
  const highlights = new Set(selectAuditionHighlights(notes.map((note) => note.reaction)));
  const hiddenNotes = new Set(
    notes.filter((note) => !highlights.has(note.reaction)).map((note) => note.index),
  );
  scene(
    episode,
    'auditions',
    `${episode.cursor} of 50 auditions complete`,
    paragraphs.filter((_, index) => !hiddenNotes.has(index)),
    featured,
  );
  recordAiredReactions(episode.scenes.at(-1)!, [...highlights]);
  if (episode.cursor === 50) {
    episode.cuts = createBroadcastCuts(state.contestants, episode.evaluations, episode.reactions, random);
    episode.phase = 'broadcast';
  }
}

export function transitionAudition(
  current: SimulationState,
  action: AuditionAction,
  revision: number,
): SimulationState {
  return awardNewActivity(current, transitionAuditionInternal(current, action, revision));
}

function transitionAuditionInternal(
  current: SimulationState,
  action: AuditionAction,
  expectedRevision: number,
): SimulationState {
  if (!current.runtime || current.status !== 'ready')
    throw new Error('Initialize a seeded season before starting Auditions.');
  const oldEpisode = current.runtime.audition;
  const actualRevision = oldEpisode?.revision ?? 0;
  if (actualRevision !== expectedRevision) {
    if (
      oldEpisode?.lastAction.revision === expectedRevision &&
      JSON.stringify(oldEpisode.lastAction.action) === JSON.stringify(action)
    )
      return current;
    throw new Error('This episode has advanced. Return to its current scene before making another choice.');
  }
  const next = structuredClone(current);
  const runtime = next.runtime;
  if (!runtime) throw new Error('Missing season runtime.');
  const random = createSeededRandom(runtime.randomState);
  if (action.type === 'start') {
    if (runtime.episode !== 0 || runtime.audition) throw new Error('Auditions has already started.');
    if (
      next.contestants.length !== 50 ||
      next.contestants.some((contestant) => contestant.status !== 'ACTIVE')
    )
      throw new Error('Auditions requires fifty active contestants.');
    runtime.audition = makeEpisode(runtime, random.next);
    runtime.episode = 1;
    runtime.phase = 'auditions';
    scene(runtime.audition, 'opening', 'The doors open', [
      'Fifty contestants arrive with different strengths, ambitions, and expectations. Thirty will survive tonight.',
      'Set the episode mood. These choices shape general-viewer appeal, not the judges’ scores.',
      'Everyone forms a small opinion of every other audition. Stronger reactions leave a bigger impression.',
    ]);
  } else {
    const episode = requireEpisode(runtime);
    episode.relationshipPolicy ??= 'reactions-only';
    if (episode.phase === 'complete') throw new Error('Episode 1 is complete.');
    episode.revision++;
    episode.lastAction = { revision: expectedRevision, action: structuredClone(action) };
    if (action.type === 'mood') {
      if (episode.phase !== 'mood') throw new Error('The episode mood is already locked.');
      for (const field of MOOD_FIELDS) {
        if (!episode.moodOptions[field].includes(action.choices[field]))
          throw new Error(`Choose an available ${field} mood.`);
      }
      episode.mood = structuredClone(action.choices);
      episode.songChoices = chooseAuditionSongs(next.contestants, episode.pool, random.next);
      episode.order = shuffleWithRandom(
        next.contestants.map((contestant) => contestant.id),
        random.next,
      );
      episode.phase = 'choices';
      const offTrack = next.contestants.filter(
        (contestant) =>
          episode.pool.find((song) => song.id === episode.songChoices[contestant.id])?.track !==
          contestant.track,
      );
      scene(
        episode,
        'choices',
        'The song board',
        [
          'The contestants have chosen their material. Some share the same song; none can switch after seeing a rival perform.',
          offTrack.length
            ? `${offTrack.map((contestant) => contestant.name).join(', ')} chose to audition outside their usual track.`
            : 'Tonight, everyone stays within their usual track.',
          'The live order is locked. What happens on stage can still change the atmosphere backstage.',
        ],
        offTrack.map((contestant) => contestant.id),
      );
    } else if (action.type === 'broadcast') {
      if (episode.phase !== 'broadcast' || !episode.mood)
        throw new Error('The broadcast choice is not available.');
      const cut = episode.cuts.find((entry) => entry.id === action.cutId);
      if (!cut) throw new Error('Choose one of the preassembled broadcast cuts.');
      const before = structuredClone(next.contestants);
      const result = resolveBroadcast({
        contestants: next.contestants,
        evaluations: episode.evaluations,
        reactions: episode.reactions,
        cut,
        mood: episode.mood,
        show: runtime.show,
        random: random.next,
        songs: episode.pool,
      });
      next.contestants = result.contestants;
      runtime.show = result.show;
      episode.audience = result.outcome;
      episode.selectedCutId = cut.id;
      if (episode.biasProtectionVersion === 1)
        episode.biasScoreBoosts = auditionBiasScoreBoosts(
          episode.evaluations,
          runtime.initialContestants.filter((entry) => entry.bias === true).map((entry) => entry.id),
        );
      const ranked = rankAuditions(episode.evaluations, episode.biasScoreBoosts);
      episode.rankedIds = ranked.map((evaluation) => evaluation.contestantId);
      episode.survivorIds = episode.rankedIds.slice(0, 30);
      episode.eliminatedIds = episode.rankedIds.slice(30).reverse();
      applySeasonRanks(next);
      captureChanges(next, before, `Broadcast and closed audience vote: ${cut.title}`);
      episode.phase = 'audience';
      scene(
        episode,
        'audience',
        'The broadcast goes out',
        [
          `The selected cut, "${cut.title}", reaches ${runtime.show.audience.toLocaleString('en-US')} viewers. Satisfaction is ${runtime.show.satisfaction}/100.`,
          `${result.outcome.votingPopulation.toLocaleString('en-US')} votes are closed. New favorites have fans, but popularity cannot overturn tonight’s judges.`,
        ],
        cut.featuredIds,
      );
    } else if (action.type === 'secret') {
      if (episode.phase !== 'secret' || !episode.secretCandidates.includes(action.contestantId))
        throw new Error('Choose someone from the secret-check shortlist.');
      const before = structuredClone(next.contestants);
      const result = revealAuditionSecret(next.contestants, action.contestantId, runtime.definitions);
      next.contestants = result.contestants;
      episode.secret = result.result;
      if (result.result.cardId) {
        runtime.revealedSecrets.push({ contestantId: action.contestantId, cardId: result.result.cardId });
        runtime.deferredConsequences.push(...result.result.deferred);
        captureChanges(next, before, `Public secret reveal: ${result.result.title}`);
      }
      scene(
        episode,
        'secret',
        result.result.title,
        [
          result.result.description,
          ...(result.result.deferred.length
            ? [
                'An authored outcome-changing consequence is recorded for later; tonight’s locked results do not change.',
              ]
            : []),
        ],
        [action.contestantId],
      );
      finishEpisode(next);
    } else if (action.type === 'advance') {
      if (episode.phase === 'choices') {
        episode.phase = 'live';
        resolveLiveScene(next, random.next);
      } else if (episode.phase === 'live') {
        resolveLiveScene(next, random.next);
      } else if (episode.phase === 'audience') {
        episode.phase = 'eliminations';
        scene(episode, 'eliminations', 'The room goes quiet', [
          'The judges’ audition evaluations determine the twenty departures. The audience vote cannot save anyone tonight.',
          'The results will be revealed in small groups.',
        ]);
      } else if (episode.phase === 'eliminations') {
        const before = structuredClone(next.contestants);
        const revealed = episode.eliminatedIds.slice(
          episode.revealedEliminations,
          episode.revealedEliminations + 5,
        );
        for (const id of revealed) {
          const contestant = requireContestant(next.contestants, id);
          contestant.status = 'ELIMINATED';
          contestant.events.push('AUDITIONS_ELIMINATED');
        }
        episode.revealedEliminations += revealed.length;
        captureChanges(next, before, 'Judges’ elimination reveal');
        scene(
          episode,
          'eliminations',
          `${episode.revealedEliminations} departures revealed`,
          [
            `${revealed.map((id) => requireContestant(next.contestants, id).name).join(', ')} leave the competition.`,
            episode.revealedEliminations === 20
              ? 'Thirty contestants remain. Every performance and departure stays in the archive.'
              : 'More results are still to come.',
          ],
          revealed,
        );
        if (episode.revealedEliminations === 20) {
          runtime.show = transferEliminatedFans(
            runtime.show,
            next.contestants,
            episode.survivorIds,
            random.next,
          );
          episode.phase = 'mvp';
        }
      } else if (episode.phase === 'mvp') {
        const before = structuredClone(next.contestants);
        episode.mvp = chooseAuditionMvp(
          next.contestants,
          episode.evaluations,
          episode.survivorIds,
          random.next,
        );
        const winner = requireContestant(next.contestants, episode.mvp.winnerId);
        winner.aggregations.mvp++;
        winner.events.push('AUDITIONS_MVP');
        captureChanges(next, before, 'Survivors’ private MVP vote');
        scene(
          episode,
          'mvp',
          'The contestants have their say',
          [
            `${winner.name} is the survivors’ MVP. Their peers recognize a performance and a presence that mattered tonight.`,
            'This recognition does not add a hidden ranking bonus.',
          ],
          [winner.id],
        );
        const hasUnrevealedSecret = (contestant: Contestant) =>
          contestant.attributes.some(
            (id) =>
              Object.hasOwn(runtime.definitions.cards.secret, id) &&
              !runtime.revealedSecrets.some(
                (entry) => entry.contestantId === contestant.id && entry.cardId === id,
              ),
          );
        if (
          next.contestants.some(
            (contestant) => episode.survivorIds.includes(contestant.id) && hasUnrevealedSecret(contestant),
          )
        ) {
          const eligible = next.contestants.filter(
            (contestant) => !runtime.revealedSecrets.some((entry) => entry.contestantId === contestant.id),
          );
          episode.secretCandidates = shuffleWithRandom(
            eligible.map((contestant) => contestant.id),
            random.next,
          ).slice(0, 3);
          episode.phase = 'secret';
        } else finishEpisode(next);
      } else throw new Error('Make the current episode choice before continuing.');
    }
  }
  runtime.randomState = random.getState();
  freezeSimulationSnapshot(runtime.sourceContestants);
  freezeSimulationSnapshot(runtime.initialContestants);
  freezeSimulationSnapshot(runtime.definitions);
  next.persistenceError = null;
  return next;
}
