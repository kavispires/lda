import type { AuditionAction, AuditionEpisode, EpisodeScene } from '../types/audition-episode';
import type { BattleAction } from '../types/battle-episode';
import type { Contestant } from '../types/contestant';
import { auditionSequence } from '../types/narrative';
import { isNarrativeSeason, type SimulationState } from '../types/simulation';
import { findPublicAttributeCard } from '../utilities/attribute-libraries';
import { selectAuditionHighlights } from '../utilities/audition-highlights';
import { projectEpisodeContestant } from '../utilities/episode-visibility';
import { applySeasonRanks } from '../utilities/season-ranking';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { awardNewActivity, recordAiredReactions, recordSceneTV } from './activity-awards';
import { chooseAuditionMvp, resolveNarrativeAudience } from './audition-audience';
import { transitionAudition } from './audition-episode';
import { chooseAuditionSongs, resolveLiveAudition } from './audition-live';
import { applyAuditionFarewells, scorePanelAudition } from './audition-panel';
import { rankAuditions } from './audition-scoring';
import { transitionBattle } from './battle-episode';
import { recordContestantChanges } from './change-history';
import { applyPreparation, initializePreparation, playOpening } from './episode-preparation';
import { createSeededRandom, shuffleWithRandom } from './random';

function episode(state: SimulationState): AuditionEpisode {
  if (!state.runtime?.audition?.story) throw new Error('The narrative Auditions episode is missing.');
  return state.runtime.audition;
}

function person(state: SimulationState, id: string): Contestant {
  const result = state.contestants.find((entry) => entry.id === id);
  if (!result) throw new Error(`Unknown episode contestant "${id}".`);
  return result;
}

function appendScene(
  ep: AuditionEpisode,
  kind: EpisodeScene['kind'],
  title: string,
  paragraphs: string[],
  ids: string[] = [],
  mentions?: string[][],
) {
  ep.scenes.push(
    recordSceneTV({
      id: `story-${ep.scenes.length}`,
      kind,
      title,
      paragraphs,
      contestantIds: ids,
      sequence: ep.story?.sequence,
      presentation: ep.story?.presentation,
      ...(['host', 'judges', 'results'].includes(ep.story?.presentation ?? '')
        ? { speaker: { name: 'Mike Philip', role: 'Host' } }
        : {}),
      ...(mentions
        ? { paragraphContestantIds: mentions }
        : ids.length === 0
          ? { paragraphContestantIds: paragraphs.map(() => []) }
          : {}),
    }),
  );
}

function capture(state: SimulationState, before: readonly Contestant[], cause: string) {
  const ep = episode(state);
  for (const contestant of state.contestants) {
    const previous = before.find((entry) => entry.id === contestant.id);
    if (!previous) throw new Error('A narrative transition changed the cast.');
    const changes = recordContestantChanges(previous, contestant, cause);
    if (!changes.length) continue;
    contestant.updatedAt = Math.max(previous.updatedAt + 1, state.createdAt + ep.revision);
    ep.changes[contestant.id] ??= [];
    ep.changes[contestant.id].push(...changes);
  }
}

function intro(state: SimulationState, id: string): string[] {
  const runtime = state.runtime;
  if (!runtime) throw new Error('Missing season.');
  const contestant = projectEpisodeContestant(person(state, id), runtime);
  const ep = episode(state);
  const song = ep.pool.find((entry) => entry.id === ep.songChoices[id]);
  if (!song) throw new Error('The contestant has no locked audition song.');
  const cards = runtime.definitions.cards;
  const persona = cards.persona[contestant.persona];
  if (!persona) throw new Error(`Unknown introduction persona "${contestant.persona}".`);
  const zodiac = runtime.definitions.zodiacSigns[contestant.zodiacSign]?.name ?? contestant.zodiacSign;
  const attributes = contestant.attributes
    .filter((id) => id !== contestant.persona && !Object.hasOwn(cards.secret, id))
    .map((id) => {
      const card = findPublicAttributeCard(cards, id);
      if (!card) throw new Error(`Unknown public introduction card "${id}".`);
      return card;
    });
  const track = contestant.track[0] + contestant.track.slice(1).toLowerCase();
  const specialties = Object.entries(contestant.specialties)
    .map(
      ([key, value]) =>
        runtime.definitions.specialties[key as keyof typeof contestant.specialties][value]?.name ?? value,
    )
    .filter(Boolean);
  const extremes = Object.entries(contestant.personality)
    .filter(([, value]) => value > 5 || value < -5)
    .map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`);
  return [
    `${contestant.name} steps forward: he chose the <Tag>${track}</Tag> track, his zodiac sign is ${zodiac}. ${persona.description} <Tag>${persona.name}</Tag>`,
    ...attributes.map((card) => `${contestant.name}: ${card.description} <Tag>${card.name}</Tag>`),
    ...(specialties.length ? [`${contestant.name}'s specialties: ${specialties.join(', ')}.`] : []),
    ...(extremes.length ? [`${contestant.name} stands out for ${extremes.join(', ')}.`] : []),
    `${contestant.name} has chosen "${song.title}"${song.track !== contestant.track ? ', stepping outside their usual track' : ''}.`,
  ];
}

function resolveOne(state: SimulationState, random: ReturnType<typeof createSeededRandom>) {
  const ep = episode(state);
  const story = ep.story;
  if (!story) throw new Error('Missing audition story.');
  const id = ep.order[ep.cursor];
  const before = structuredClone(state.contestants);
  const oldComposure = ep.composure[id] ?? 0;
  const result = resolveLiveAudition({
    contestants: state.contestants,
    pool: ep.pool,
    songChoices: ep.songChoices,
    performerId: id,
    previousEvaluations: ep.evaluations,
    preferences: { visualOrUniqueness: 'visual', potentialOrCharisma: 'potential' },
    composure: ep.composure,
    random: random.next,
    relationshipPolicy: 'everyone-forms-opinions',
    score: (input) => scorePanelAudition(input, ep.cursor, ep.scoringVersion),
  });
  state.contestants = result.contestants;
  ep.composure = result.composure;
  ep.evaluations.push(result.evaluation);
  ep.reactions.push(...result.reactions);
  ep.cursor++;
  if (!story.creditedIds.includes(id)) {
    person(state, id).aggregations.screenTime += 100 * story.exposure[id];
    story.creditedIds.push(id);
  }
  capture(state, before, `Audition performance: ${person(state, id).name}`);
  const readiness = (target: string, beforeValue: number, afterValue: number) => {
    if (beforeValue === afterValue) return;
    ep.changes[target] ??= [];
    ep.changes[target].push({
      path: 'episode1.composure',
      before: beforeValue,
      after: afterValue,
      cause: `Audition readiness after ${person(state, id).name}'s performance`,
    });
  };
  readiness(id, oldComposure, 0);
  for (const reaction of result.reactions) {
    readiness(reaction.observerId, reaction.composureBefore, reaction.composureAfter);
  }
  return result;
}

function nextAudition(state: SimulationState, random: ReturnType<typeof createSeededRandom>) {
  const ep = episode(state);
  const story = ep.story;
  if (!story) throw new Error('Missing audition story.');
  const block = auditionSequence(ep.cursor);
  story.sequence = block.index + 4;
  if (block.featured) {
    const id = ep.order[ep.cursor];
    ep.phase = 'introduction';
    story.presentation = 'introduction';
    story.pendingPerformerId = id;
    const paragraphs = intro(state, id);
    appendScene(
      ep,
      'choices',
      `Meet ${person(state, id).name}`,
      paragraphs,
      [id],
      paragraphs.map(() => [id]),
    );
  } else {
    const paragraphs: string[] = [];
    const ids: string[] = [];
    const introductions: Record<string, string[]> = {};
    const reactions = [];
    for (let index = 0; index < block.size; index++) {
      const id = ep.order[ep.cursor];
      const bio = intro(state, id);
      introductions[id] = bio;
      const result = resolveOne(state, random);
      paragraphs.push(
        `${bio[0]} ${bio.at(-1)} The judges award ${person(state, id).name} graded ${result.evaluation.grade}.`,
      );
      ids.push(id);
      reactions.push(...result.reactions);
    }
    const highlights = selectAuditionHighlights(reactions);
    paragraphs.push(...highlights.map((reaction) => reaction.narrative));
    ep.phase = 'live';
    story.presentation = 'montage';
    story.pendingPerformerId = null;
    appendScene(ep, 'auditions', `A rush of new faces — ${block.size} auditions`, paragraphs, ids, [
      ...ids.map((id) => [id]),
      ...highlights.map((reaction) => [reaction.observerId, reaction.performerId]),
    ]);
    ep.scenes[ep.scenes.length - 1].introductions = introductions;
    recordAiredReactions(ep.scenes.at(-1)!, highlights);
  }
}

function finish(state: SimulationState, random: ReturnType<typeof createSeededRandom>) {
  const runtime = state.runtime;
  if (!runtime) throw new Error('Missing season.');
  runtime.randomState = random.getState();
  freezeSimulationSnapshot(runtime.sourceContestants);
  freezeSimulationSnapshot(runtime.initialContestants);
  freezeSimulationSnapshot(runtime.definitions);
  state.persistenceError = null;
  return state;
}

export function transitionNarrativeAudition(
  current: SimulationState,
  action: AuditionAction,
  revision: number,
): SimulationState {
  return awardNewActivity(current, transitionNarrativeAuditionInternal(current, action, revision));
}

function transitionNarrativeAuditionInternal(
  current: SimulationState,
  action: AuditionAction,
  revision: number,
): SimulationState {
  if (!current.runtime || !isNarrativeSeason(current.runtime) || current.status !== 'ready')
    throw new Error('Start a new narrative simulation first.');
  const old = current.runtime.audition;
  if (revision !== (old?.revision ?? 0)) {
    if (
      old?.lastAction.revision === revision &&
      JSON.stringify(old.lastAction.action) === JSON.stringify(action)
    )
      return current;
    throw new Error('This episode action is stale.');
  }
  if (action.type === 'start') {
    const next = transitionAudition(current, action, revision);
    const ep = next.runtime?.audition;
    if (!ep || !next.runtime) throw new Error('Could not start Auditions.');
    const random = createSeededRandom(next.runtime.randomState);
    ep.version = 2;
    if (next.runtime.version === 3) ep.scoringVersion = 2;
    ep.phase = 'opening-cast';
    ep.scenes = [];
    ep.story = {
      sequence: 1,
      presentation: 'host',
      pendingPerformerId: null,
      exposure: {},
      creditedIds: [],
      farewellBaseline: {},
      farewellAppliedIds: [],
    };
    const prep = initializePreparation(next, 1, random.next);
    ep.moodOptions = prep.moodOptions;
    return finish(next, random);
  }
  if (!old?.story || old.version !== 2 || old.phase === 'complete')
    throw new Error('This narrative episode is not active.');
  if (action.type === 'secret') {
    if (old.phase !== 'secret') throw new Error('The secret investigation is not available.');
    const next = transitionAudition(current, action, revision);
    for (const scene of episode(next).scenes.slice(old.scenes.length)) {
      scene.sequence = 12;
      scene.presentation = 'results';
      if (scene.kind === 'recap') scene.speaker = { name: 'Mike Philip', role: 'Host' };
    }
    return next;
  }
  if (action.type === 'advance' && old.phase === 'eliminations') {
    const next = transitionAudition(current, action, revision);
    const ep = episode(next);
    const announcement = ep.scenes.at(-1);
    if (announcement) {
      announcement.sequence = 12;
      announcement.presentation = 'results';
      announcement.speaker = { name: 'Mike Philip', role: 'Host' };
    }
    applyAuditionFarewells(next, ep.eliminatedIds.slice(old.revealedEliminations, ep.revealedEliminations));
    return next;
  }
  const next = structuredClone(current);
  const runtime = next.runtime;
  if (!runtime) throw new Error('Missing season.');
  const ep = episode(next);
  const story = ep.story;
  if (!story) throw new Error('Missing audition story.');
  const random = createSeededRandom(runtime.randomState);
  ep.revision++;
  ep.lastAction = { revision, action: structuredClone(action) };
  if (action.type === 'opening-cast') {
    if (ep.phase !== 'opening-cast') throw new Error('The opening cast is already locked.');
    applyPreparation(next, action, random.next);
    ep.phase = 'mood';
  } else if (action.type === 'randomize-mood') {
    if (ep.phase !== 'mood') throw new Error('The opening mood is not available.');
    applyPreparation(next, action, random.next);
  } else if (action.type === 'mood') {
    if (ep.phase !== 'mood') throw new Error('The opening mood is already locked.');
    applyPreparation(next, action, random.next);
    ep.mood = structuredClone(action.choices);
    ep.songChoices = chooseAuditionSongs(next.contestants, ep.pool, random.next);
    ep.order = shuffleWithRandom(
      next.contestants.map(({ id }) => id),
      random.next,
    );
    story.exposure = Object.fromEntries(
      ep.order.map((id, index) => {
        const block = auditionSequence(index);
        return [id, 1 / (19 * (block.featured ? 1 : block.size))];
      }),
    );
    ep.phase = 'host-intro';
    appendScene(ep, 'opening', 'Welcome to The Search', [
      'I’m Mike Philip. Fifty contestants are competing for one of five places in the next iteration of the pop sensation Squirrel Zone!',
      'We begin with individual auditions before our panel of judges. By the end of tonight, only thirty contestants will move to the next round.',
    ]);
  } else if (action.type === 'advance') {
    if (ep.phase === 'host-intro') {
      playOpening(next, 1);
      ep.phase = 'credits';
      story.sequence = 2;
      story.presentation = 'credits';
      appendScene(
        ep,
        'opening',
        'Opening credits',
        ['This is The Search. Five faces step into the opening spotlight.'],
        runtime.openingCast,
      );
    } else if (ep.phase === 'credits') {
      ep.phase = 'judges';
      story.sequence = 3;
      story.presentation = 'judges';
      appendScene(ep, 'opening', 'Meet the judges', [
        'Mike Philip: Meet John Stan, our music producer. He listens for technical vocal, rap and dance quality.',
        'Megan Ryder is a veteran artist looking for stage presence, potential and uniqueness.',
        'Michael Lion, our record-label executive, considers visual appeal, consistency and leadership.',
        'The song’s track-skill check counts three times, the leading judge counts twice, and the other judges count once each. Every seven auditions, the next judge takes the lead.',
      ]);
    } else if (ep.phase === 'judges') nextAudition(next, random);
    else if (ep.phase === 'introduction') {
      const id = ep.order[ep.cursor];
      const result = resolveOne(next, random);
      const song = ep.pool.find((entry) => entry.id === result.evaluation.songId);
      if (!song) throw new Error('Missing audition song.');
      ep.phase = 'live';
      story.presentation = 'performance';
      story.pendingPerformerId = null;
      const highlights = selectAuditionHighlights(result.reactions);
      appendScene(
        ep,
        'auditions',
        `${person(next, id).name}'s audition`,
        [
          `${person(next, id).name} performs "${song.title}": graded ${result.evaluation.grade}.`,
          ...highlights.map((reaction) => reaction.narrative),
        ],
        [id],
        [[id], ...highlights.map((reaction) => [reaction.observerId, reaction.performerId])],
      );
      recordAiredReactions(ep.scenes.at(-1)!, highlights);
    } else if (ep.phase === 'live' && ep.cursor < 50) nextAudition(next, random);
    else if (ep.phase === 'live' && ep.cursor === 50) {
      if (!ep.mood) throw new Error('Missing opening mood.');
      const before = structuredClone(next.contestants);
      const shown = new Set(
        ep.scenes
          .filter((entry) => entry.kind === 'auditions')
          .flatMap((entry) => entry.paragraphContestantIds ?? [])
          .filter((ids) => ids.length === 2)
          .map((ids) => JSON.stringify(ids)),
      );
      const outcome = resolveNarrativeAudience({
        contestants: next.contestants,
        evaluations: ep.evaluations,
        reactions: ep.reactions.filter((reaction) =>
          shown.has(JSON.stringify([reaction.observerId, reaction.performerId])),
        ),
        exposure: story.exposure,
        mood: ep.mood,
        show: runtime.show,
        random: random.next,
        songs: ep.pool,
      });
      next.contestants = outcome.contestants;
      runtime.show = outcome.show;
      ep.audience = outcome.outcome;
      ep.rankedIds = rankAuditions(ep.evaluations).map((entry) => entry.contestantId);
      ep.survivorIds = ep.rankedIds.slice(0, 30);
      ep.eliminatedIds = ep.rankedIds.slice(30).reverse();
      applySeasonRanks(next);
      story.farewellBaseline = Object.fromEntries(
        next.contestants.map((entry) => [
          entry.id,
          Object.fromEntries(
            Object.entries(entry.relationships).map(([id, values]) => [id, values.at(-1) ?? 50]),
          ),
        ]),
      );
      capture(next, before, 'The audience closes its vote');
      ep.phase = 'eliminations';
      story.sequence = 12;
      story.presentation = 'results';
      appendScene(ep, 'eliminations', 'Mike returns with the results', [
        'Mike Philip: Every audition has been heard. Our judges have made their decision. Twenty contestants must leave tonight.',
        'We will say goodbye in groups of five. To everyone standing here: thank you for showing us who you are.',
      ]);
    } else if (ep.phase === 'mvp' && !ep.mvp) {
      const before = structuredClone(next.contestants);
      ep.mvp = chooseAuditionMvp(next.contestants, ep.evaluations, ep.survivorIds, random.next);
      const winner = person(next, ep.mvp.winnerId);
      winner.aggregations.mvp++;
      winner.events.push('AUDITIONS_MVP');
      capture(next, before, 'The survivors choose their MVP');
      ep.secretCandidates = shuffleWithRandom(
        next.contestants
          .filter((entry) => !runtime.revealedSecrets.some((secret) => secret.contestantId === entry.id))
          .map(({ id }) => id),
        random.next,
      ).slice(0, 3);
      appendScene(
        ep,
        'mvp',
        'A final moment of recognition',
        [
          `${winner.name} wins the survivors’ MVP vote. Before we close, production has one final secret investigation.`,
        ],
        [winner.id],
        [[winner.id]],
      );
    } else if (ep.phase === 'mvp' && ep.mvp) {
      ep.phase = 'secret';
      appendScene(ep, 'secret', 'One final investigation', [
        'Mike Philip: Before we say goodnight, production will choose one contestant for a secret investigation.',
      ]);
    } else throw new Error('Make the current production decision before continuing.');
  } else throw new Error('This action is not part of the narrative episode.');
  if (action.type === 'opening-cast' || action.type === 'mood' || action.type === 'randomize-mood') {
    const prep = runtime.preparations?.[1];
    if (!prep) throw new Error('Missing opening preparation.');
    prep.lastAction = { revision: prep.revision, action: structuredClone(action) };
    prep.revision++;
  }
  return finish(next, random);
}

export function transitionNarrativeBattle(
  current: SimulationState,
  action: BattleAction,
  revision: number,
): SimulationState {
  return awardNewActivity(current, transitionNarrativeBattleInternal(current, action, revision));
}

function transitionNarrativeBattleInternal(
  current: SimulationState,
  action: BattleAction,
  revision: number,
): SimulationState {
  if (current.runtime?.version !== 2 || current.status !== 'ready')
    throw new Error('A modern season is required.');
  if (!current.runtime.battle) {
    const existing = current.runtime.preparations?.[2];
    if (!existing) {
      if (action.type !== 'start' || revision !== 0) throw new Error('Start Episode 2 preparation first.');
      if (current.runtime.audition?.phase !== 'complete') throw new Error('Complete Auditions first.');
      const next = structuredClone(current);
      const random = createSeededRandom(current.runtime.randomState);
      initializePreparation(next, 2, random.next);
      return finish(next, random);
    }
    if (action.type === 'start' && existing.revision === 0 && revision === 0) return current;
    if (revision !== existing.revision) {
      if (
        existing.lastAction?.revision === revision &&
        JSON.stringify(existing.lastAction.action) === JSON.stringify(action)
      )
        return current;
      throw new Error('This preparation choice is stale.');
    }
    if (action.type !== 'mood' && action.type !== 'opening-cast' && action.type !== 'randomize-mood')
      throw new Error('Complete the episode preparation.');
    const next = structuredClone(current);
    const prep = next.runtime?.preparations?.[2];
    if (!prep) throw new Error('Missing preparation.');
    const random = createSeededRandom(current.runtime.randomState);
    applyPreparation(next, action, random.next);
    prep.revision++;
    prep.lastAction = { revision, action: structuredClone(action) };
    finish(next, random);
    if (prep.mood && prep.slots.every((id) => id !== null))
      return transitionBattle(next, { type: 'start' }, 0);
    return next;
  }
  const battle = current.runtime.battle;
  const prep = current.runtime.preparations?.[2];
  if (!prep?.mood) throw new Error('Episode 2 has no opening mood.');
  if (
    revision !== battle.revision &&
    battle.lastAction.revision === revision &&
    JSON.stringify(battle.lastAction.action) === JSON.stringify(action)
  )
    return current;
  if (
    (action.type === 'mood' || action.type === 'opening-cast' || action.type === 'randomize-mood') &&
    prep.lastAction?.revision === revision &&
    JSON.stringify(prep.lastAction.action) === JSON.stringify(action)
  )
    return current;
  if (
    action.type === 'advance' &&
    battle.phase === 'dorms' &&
    battle.roomCursor === 5 &&
    !prep.openingPlayed
  ) {
    if (revision !== battle.revision) throw new Error('This opening action is stale.');
    const next = structuredClone(current);
    const ep = next.runtime?.battle;
    if (!ep) throw new Error('Missing battle episode.');
    ep.revision++;
    ep.lastAction = { revision, action };
    playOpening(next, 2);
    ep.scenes.push({
      id: `battles-scene-${ep.scenes.length}`,
      kind: 'opening',
      title: 'Opening credits',
      paragraphs: ['After a first night in the dorms, a new chapter of The Search begins.'],
      contestantIds: next.runtime?.openingCast ?? [],
    });
    return finish(next, createSeededRandom(current.runtime.randomState));
  }
  return transitionBattle(current, action, revision);
}
