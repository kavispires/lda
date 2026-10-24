import type { AttributeCard, ChangeValue, PropertyChange } from '../types/common';
import type { ChangeLogEntry, Contestant } from '../types/contestant';
import type { SimulationDefinitions, SimulationState } from '../types/simulation';
import { validateAuditionSongs } from '../utilities/audition-songs';
import { validateBattleSongs } from '../utilities/battle-songs';
import { ALIGNMENTS, GRADES, STATUSES, TRACKS } from '../utilities/constants';
import { createContestant } from '../utilities/contestant-factory';
import { applySeasonRanks } from '../utilities/season-ranking';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { assertAuditionEpisode, isDeferredConsequence, isShowAudience } from './audition-validation';
import { assertBattleEpisode } from './battle-validation';
import { assertBootcampEpisode } from './bootcamp-validation';
import { assertPreparation } from './episode-preparation';
import { assertNarrativeAudition } from './narrative-validation';
import { createSeededRandom } from './random';

export const SIMULATION_STORAGE_KEY = 'the-search-simulation-setup';

export function emptySimulationState(): SimulationState {
  return { contestants: [], status: 'idle', createdAt: 0, runtime: null, persistenceError: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasShape(value: unknown, template: unknown): boolean {
  if (typeof template === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (Array.isArray(template)) return Array.isArray(value);
  if (isRecord(template)) {
    return isRecord(value) && Object.entries(template).every(([key, entry]) => hasShape(value[key], entry));
  }
  return typeof value === typeof template;
}

function isChangeValue(value: unknown): value is ChangeValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isChangeValue);
  return isRecord(value) && Object.values(value).every(isChangeValue);
}

function isPropertyChange(value: unknown): value is PropertyChange {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    typeof value.cause === 'string' &&
    value.cause.trim().length > 0 &&
    (value.before === undefined || isChangeValue(value.before)) &&
    (value.after === undefined || isChangeValue(value.after))
  );
}

function isHistory(value: unknown): value is ChangeLogEntry {
  return (
    isRecord(value) &&
    hasShape(value, { episode: 0, missionRating: 0, rank: 0, score: 0, status: '', summary: '' }) &&
    Array.isArray(value.events) &&
    value.events.every((event) => typeof event === 'string') &&
    isRecord(value.change) &&
    Object.values(value.change).every(isChangeValue) &&
    (value.phaseId === undefined || typeof value.phaseId === 'string') &&
    (value.changes === undefined || (Array.isArray(value.changes) && value.changes.every(isPropertyChange)))
  );
}

function isContestant(value: unknown): value is Contestant {
  if (!isRecord(value)) return false;
  // Older setup snapshots predate these fields; this migration does not apply effects.
  if (isRecord(value.specialties) && value.specialties.genreAffinity === undefined) {
    value.specialties.genreAffinity = '';
  }
  if (isRecord(value.aggregations) && value.aggregations.practice === undefined) {
    value.aggregations.practice = 0;
  }
  const template = createContestant({ id: 'validation', name: 'Validation', updatedAt: 1 });
  return (
    hasShape(value, template) &&
    value.type === 'contestant' &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    Object.values(TRACKS).some((track) => track === value.track) &&
    Object.values(GRADES).some((grade) => grade === value.grade) &&
    Object.values(STATUSES).some((status) => status === value.status) &&
    Object.values(ALIGNMENTS).some((alignment) => alignment === value.alignment) &&
    Array.isArray(value.attributes) &&
    value.attributes.every((id) => typeof id === 'string') &&
    Array.isArray(value.events) &&
    value.events.every((id) => typeof id === 'string') &&
    Array.isArray(value.changeLog) &&
    value.changeLog.every(isHistory) &&
    isRecord(value.relationships) &&
    Object.values(value.relationships).every(
      (relationship) =>
        Array.isArray(relationship) &&
        relationship.every((score) => typeof score === 'number' && Number.isFinite(score)),
    ) &&
    (value.bias === undefined || typeof value.bias === 'boolean')
  );
}

function isContestants(value: unknown): value is Contestant[] {
  return (
    Array.isArray(value) &&
    value.every(isContestant) &&
    new Set(value.map((contestant) => contestant.id)).size === value.length
  );
}

function isSourceContestants(value: unknown): value is Record<string, Contestant> {
  return (
    isRecord(value) &&
    Object.entries(value).every(([id, contestant]) => isContestant(contestant) && contestant.id === id)
  );
}

function isCard(value: unknown): value is AttributeCard {
  return (
    isRecord(value) &&
    hasShape(value, { id: '', type: '', group: '', name: '', description: '', occurrence: 0 }) &&
    isRecord(value.influences) &&
    Object.values(value.influences).every(
      (influence) => typeof influence === 'number' || typeof influence === 'string',
    ) &&
    [value.set, value.consequence].every(
      (changes) =>
        changes === undefined ||
        (isRecord(changes) &&
          Object.values(changes).every((entry) => typeof entry === 'number' || typeof entry === 'string')),
    )
  );
}

function isCardLibrary(value: unknown): value is Record<string, AttributeCard> {
  return isRecord(value) && Object.entries(value).every(([id, card]) => isCard(card) && card.id === id);
}

function assertDefinitions(value: unknown): asserts value is SimulationDefinitions {
  if (!isRecord(value) || !isRecord(value.cards) || !isRecord(value.specialties)) {
    throw new Error('The saved simulation definitions are invalid.');
  }
  const { cards, specialties } = value;
  if (
    !['persona', 'identity', 'interest', 'secret'].every((key) => isCardLibrary(cards[key])) ||
    !['vocalColor', 'danceStyle', 'rapStyle', 'visualVibe', 'leadershipStyle', 'genreAffinity'].every((key) =>
      isCardLibrary(specialties[key]),
    ) ||
    !isCardLibrary(value.zodiacSigns)
  )
    throw new Error('The saved simulation definitions are invalid.');
  const genres = specialties.genreAffinity;
  if (!isCardLibrary(genres)) throw new Error('The saved genre definitions are invalid.');
  validateAuditionSongs(value.auditionSongs, Object.keys(genres));
  if (value.battleSongs !== undefined) validateBattleSongs(value.battleSongs, Object.keys(genres));
}

export function decodeSimulationState(stored: string): SimulationState {
  const value: unknown = JSON.parse(stored);
  if (
    !isRecord(value) ||
    !isContestants(value.contestants) ||
    !['idle', 'initializing', 'ready'].includes(String(value.status)) ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt)
  ) {
    throw new Error('The saved simulation setup is invalid.');
  }
  const status = value.status;
  if (status !== 'idle' && status !== 'initializing' && status !== 'ready') {
    throw new Error('The saved simulation status is invalid.');
  }
  const currentContestants = value.contestants;
  if (value.runtime === undefined || value.runtime === null) {
    return {
      contestants: value.contestants,
      status,
      createdAt: value.createdAt,
      runtime: null,
      persistenceError: null,
    };
  }
  const runtime = value.runtime;
  if (
    !isRecord(runtime) ||
    (runtime.version !== 1 && runtime.version !== 2 && runtime.version !== 3) ||
    typeof runtime.runId !== 'string' ||
    !runtime.runId.trim() ||
    typeof runtime.seed !== 'number' ||
    typeof runtime.randomState !== 'number' ||
    (runtime.episode !== 0 && runtime.episode !== 1 && runtime.episode !== 2 && runtime.episode !== 3) ||
    (runtime.phase !== 'setup-complete' &&
      runtime.phase !== 'auditions' &&
      runtime.phase !== 'battles' &&
      runtime.phase !== 'bootcamp' &&
      runtime.phase !== 'episode-complete') ||
    !isRecord(runtime.setup) ||
    typeof runtime.setup.useBias !== 'boolean' ||
    !Array.isArray(runtime.setup.selectedIds) ||
    !runtime.setup.selectedIds.every((id) => typeof id === 'string') ||
    !isSourceContestants(runtime.sourceContestants) ||
    !isContestants(runtime.initialContestants)
  ) {
    throw new Error('The saved season runtime is invalid or has an unsupported version.');
  }
  createSeededRandom(runtime.seed);
  createSeededRandom(runtime.randomState);
  assertDefinitions(runtime.definitions);
  const definitions = runtime.definitions;
  if (
    runtime.episode >= 1 &&
    ['audition', 'show', 'revealedSecrets', 'deferredConsequences'].some(
      (field) => runtime[field] === undefined,
    )
  ) {
    throw new Error('The saved episode audience or consequences are missing.');
  }
  const audition = runtime.audition ?? null;
  const battle = runtime.battle ?? null;
  const bootcamp = runtime.bootcamp ?? null;
  if (
    (runtime.episode === 3 && (runtime.version !== 3 || bootcamp === null)) ||
    (bootcamp !== null && (runtime.version !== 3 || runtime.episode !== 3)) ||
    (runtime.phase === 'bootcamp' && runtime.episode !== 3)
  )
    throw new Error('Boot Camp requires a current-format Episode 3 season.');
  let archiveContestants = currentContestants;
  if (bootcamp !== null) {
    if (!isRecord(bootcamp) || !isContestants(bootcamp.startingContestants))
      throw new Error('The saved Boot Camp starting cast is invalid.');
    archiveContestants = bootcamp.startingContestants;
  }
  const show =
    runtime.show === undefined
      ? {
          audience: 100000,
          satisfaction: 50,
          general: 100000,
          fans: {},
          pendingAttrition: 0,
        }
      : runtime.show;
  const revealedSecrets = runtime.revealedSecrets === undefined ? [] : runtime.revealedSecrets;
  const deferredConsequences = runtime.deferredConsequences === undefined ? [] : runtime.deferredConsequences;
  if (
    !isShowAudience(show) ||
    !Array.isArray(revealedSecrets) ||
    !revealedSecrets.every(
      (entry): entry is { contestantId: string; cardId: string } =>
        isRecord(entry) && typeof entry.contestantId === 'string' && typeof entry.cardId === 'string',
    ) ||
    !Array.isArray(deferredConsequences) ||
    !deferredConsequences.every(isDeferredConsequence)
  ) {
    throw new Error('The saved audience or secret consequences are invalid.');
  }
  if (audition !== null) {
    if (runtime.version === 1 && isRecord(audition) && audition.relationshipPolicy === undefined) {
      audition.relationshipPolicy = 'reactions-only';
    }
    if (runtime.version === 2 || runtime.version === 3) {
      assertNarrativeAudition(audition, archiveContestants, runtime.definitions, {
        archived: runtime.episode >= 2,
      });
    } else {
      assertAuditionEpisode(audition, archiveContestants, runtime.definitions, {
        archived: runtime.episode >= 2,
      });
    }
    if (runtime.episode === 1 && audition.audience && audition.audience.votingPopulation !== show.audience) {
      throw new Error('The saved closed votes do not match the audience population.');
    }
    if (
      runtime.episode === 0 ||
      (runtime.episode === 1 &&
        runtime.phase !== (audition.phase === 'complete' ? 'episode-complete' : 'auditions')) ||
      (runtime.episode >= 2 && audition.phase !== 'complete')
    ) {
      throw new Error('The saved episode phase does not match its progress.');
    }
  } else if (runtime.episode !== 0 || runtime.phase !== 'setup-complete') {
    throw new Error('The saved episode progress is missing.');
  }
  if (battle !== null) {
    if (runtime.episode < 2 || !audition || audition.phase !== 'complete') {
      throw new Error('Group Battles requires a completed Auditions archive.');
    }
    assertBattleEpisode(battle, archiveContestants, definitions);
    if ((runtime.version === 3) !== (battle.version === 2))
      throw new Error('The battle format does not match its season.');
    if (
      (runtime.episode === 2 &&
        runtime.phase !== (battle.phase === 'complete' ? 'episode-complete' : 'battles')) ||
      (runtime.episode === 3 && battle.phase !== 'complete') ||
      battle.participantIds.length !== audition.survivorIds.length ||
      !battle.participantIds.every((id) => audition.survivorIds.includes(id)) ||
      !audition.eliminatedIds.every(
        (id) => currentContestants.find((contestant) => contestant.id === id)?.status === 'ELIMINATED',
      ) ||
      (runtime.episode === 2 &&
        battle.audience !== null &&
        battle.audience.votingPopulation !== show.audience)
    ) {
      throw new Error('The saved battle progress does not match its cast, audience or phase.');
    }
  } else if (runtime.episode >= 2) {
    throw new Error('The saved Group Battles episode is missing.');
  }
  if (bootcamp !== null) {
    assertBootcampEpisode(bootcamp, currentContestants, definitions);
    freezeSimulationSnapshot(bootcamp.startingContestants);
    if (
      !battle ||
      battle.phase !== 'complete' ||
      runtime.phase !== (bootcamp.phase === 'complete' ? 'episode-complete' : 'bootcamp') ||
      bootcamp.participantIds.length !== battle.survivorIds.length ||
      !bootcamp.participantIds.every((id) => battle.survivorIds.includes(id)) ||
      (bootcamp.audience !== null && bootcamp.audience.votingPopulation !== show.audience)
    )
      throw new Error('The saved Boot Camp progress does not match its archive, cast or audience.');
  }
  const auditionPoolIds = runtime.setup.auditionPoolIds;
  if (
    auditionPoolIds !== undefined &&
    (!Array.isArray(auditionPoolIds) ||
      auditionPoolIds.length !== 9 ||
      !auditionPoolIds.every((id): id is string => typeof id === 'string') ||
      new Set(auditionPoolIds).size !== 9 ||
      !auditionPoolIds.every((id) => definitions.auditionSongs.some((song) => song.id === id)))
  ) {
    throw new Error('The saved audition song pool is invalid.');
  }
  if (audition && JSON.stringify(audition.pool.map((song) => song.id)) !== JSON.stringify(auditionPoolIds)) {
    throw new Error('The saved episode does not match its locked song pool.');
  }
  const selectedIds = runtime.setup.selectedIds;
  const sources = runtime.sourceContestants;
  const initialContestants = runtime.initialContestants;
  if (
    selectedIds.length !== 50 ||
    new Set(selectedIds).size !== 50 ||
    value.contestants.length !== 50 ||
    runtime.initialContestants.length !== 50 ||
    !selectedIds.every(
      (id) =>
        Object.hasOwn(sources, id) &&
        currentContestants.some((contestant) => contestant.id === id) &&
        initialContestants.some((contestant) => contestant.id === id),
    )
  ) {
    throw new Error('The saved cast does not match its season snapshot.');
  }
  if (
    !Object.keys(show.fans).every((id) => selectedIds.includes(id)) ||
    !revealedSecrets.every(
      (entry) =>
        selectedIds.includes(entry.contestantId) && Object.hasOwn(definitions.cards.secret, entry.cardId),
    ) ||
    !deferredConsequences.every((entry) => selectedIds.includes(entry.contestantId))
  ) {
    throw new Error('The saved audience or consequences refer to unknown contestants.');
  }
  const restored: SimulationState = {
    contestants: value.contestants,
    status,
    createdAt: value.createdAt,
    persistenceError: null,
    runtime: {
      version: runtime.version,
      runId: runtime.runId,
      seed: runtime.seed,
      randomState: runtime.randomState,
      episode: runtime.episode,
      phase: runtime.phase,
      setup: { useBias: runtime.setup.useBias, selectedIds, ...(auditionPoolIds ? { auditionPoolIds } : {}) },
      sourceContestants: freezeSimulationSnapshot(runtime.sourceContestants),
      initialContestants: freezeSimulationSnapshot(runtime.initialContestants),
      definitions: freezeSimulationSnapshot(runtime.definitions),
      audition,
      ...(battle ? { battle } : {}),
      ...(bootcamp ? { bootcamp } : {}),
      show,
      revealedSecrets,
      deferredConsequences,
    },
  };
  if ((runtime.version === 2 || runtime.version === 3) && restored.runtime) {
    if (runtime.openingCast !== undefined) {
      if (
        !Array.isArray(runtime.openingCast) ||
        runtime.openingCast.length !== 5 ||
        !runtime.openingCast.every(
          (id): id is string => typeof id === 'string' && selectedIds.includes(id),
        ) ||
        new Set(runtime.openingCast).size !== 5
      )
        throw new Error('The saved opening cast is invalid.');
      restored.runtime.openingCast = runtime.openingCast;
    }
    if (runtime.preparations !== undefined) {
      if (
        !isRecord(runtime.preparations) ||
        Object.keys(runtime.preparations).some(
          (key) => key !== '1' && key !== '2' && (key !== '3' || runtime.version !== 3),
        )
      )
        throw new Error('Invalid saved episode preparations.');
      restored.runtime.preparations = {};
      for (const number of [3, 2, 1] as const) {
        const preparation = runtime.preparations[number];
        if (preparation === undefined) continue;
        assertPreparation(
          preparation,
          { contestants: restored.contestants, runtime: restored.runtime },
          number,
        );
        restored.runtime.preparations[number] = preparation;
      }
    }
    const first = restored.runtime.preparations?.[1];
    const second = restored.runtime.preparations?.[2];
    const third = restored.runtime.preparations?.[3];
    if (
      audition &&
      (!first ||
        JSON.stringify(first.moodOptions) !== JSON.stringify(audition.moodOptions) ||
        JSON.stringify(first.mood) !== JSON.stringify(audition.mood))
    )
      throw new Error('Auditions preparation does not match the story.');
    if (audition && first) {
      const played = !['opening-cast', 'mood', 'host-intro'].includes(audition.phase);
      if (
        first.openingPlayed !== played ||
        (audition.phase === 'opening-cast') !== first.slots.some((id) => id === null)
      )
        throw new Error('Auditions preparation progress does not match its story.');
    }
    if (second && audition?.phase !== 'complete')
      throw new Error('Episode 2 preparation requires completed Auditions.');
    if (battle && (!second?.mood || second.slots.some((id) => id === null)))
      throw new Error('Group Battles preparation is missing.');
    if (
      battle &&
      second &&
      second.openingPlayed !== battle.scenes.some((scene) => scene.title === 'Opening credits')
    )
      throw new Error('Group Battles credits do not match their recorded effect.');
    if (third && battle?.phase !== 'complete')
      throw new Error('Episode 3 preparation requires completed Group Battles.');
    if (bootcamp && (!third?.mood || third.slots.some((id) => id === null)))
      throw new Error('Boot Camp preparation is missing.');
    if (
      bootcamp &&
      third &&
      third.openingPlayed !== bootcamp.scenes.some((scene) => scene.title === 'Opening credits')
    )
      throw new Error('Boot Camp credits do not match their recorded effect.');
    if (
      (first?.openingPlayed || second?.openingPlayed || third?.openingPlayed) &&
      !restored.runtime.openingCast
    )
      throw new Error('Opening credits are missing their cast.');
  } else if (runtime.openingCast !== undefined || runtime.preparations !== undefined) {
    throw new Error('A legacy season cannot contain narrative preparations.');
  }
  applySeasonRanks(restored);
  return restored;
}

export function loadSimulationState(storage: Pick<Storage, 'getItem'>): SimulationState {
  try {
    const stored = storage.getItem(SIMULATION_STORAGE_KEY);
    return stored === null ? emptySimulationState() : decodeSimulationState(stored);
  } catch (error) {
    return {
      ...emptySimulationState(),
      persistenceError: `Could not restore the saved simulation: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
