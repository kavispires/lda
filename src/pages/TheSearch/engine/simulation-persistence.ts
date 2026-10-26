import LZString from 'lz-string';
import type { AttributeCard, ChangeValue, PropertyChange } from '../types/common';
import type { ChangeLogEntry, Contestant } from '../types/contestant';
import type { SimulationDefinitions, SimulationState } from '../types/simulation';
import { validateAuditionSongs } from '../utilities/audition-songs';
import { validateBattleSongs } from '../utilities/battle-songs';
import { ALIGNMENTS, GRADES, STATUSES, TRACKS } from '../utilities/constants';
import { createContestant } from '../utilities/contestant-factory';
import { validateFinaleCatalog } from '../utilities/finale-songs';
import { validateMegaGroupsCatalogs } from '../utilities/mega-groups-catalogs';
import { validateMusicVideoCatalog } from '../utilities/music-video-catalog';
import { validatePhotoshootConcepts } from '../utilities/photoshoot-concepts';
import { applySeasonRanks } from '../utilities/season-ranking';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { validateSpecialtiesCatalog } from '../utilities/specialties-songs';
import { validateTrackSpecialSongs } from '../utilities/track-special-songs';
import { validateVarietyShowCatalog } from '../utilities/variety-show-catalog';
import { validateVersatilityCatalogs } from '../utilities/versatility-catalogs';
import { restoreActivityProgression } from './activity-awards';
import { assertAuditionEpisode, isDeferredConsequence, isShowAudience } from './audition-validation';
import { assertBattleEpisode } from './battle-validation';
import { assertBootcampEpisode } from './bootcamp-validation';
import {
  assertPreparation,
  validateFinalePreparation,
  validateMusicVideoPreparation,
  validateSpecialtiesPreparation,
} from './episode-preparation';
import { assertFinaleEpisode, validateFinale } from './finale-validation';
import { assertMegaGroupsEpisode } from './mega-groups-validation';
import { assertMusicVideoEpisode, validateMusicVideo } from './music-video-validation';
import { assertNarrativeAudition } from './narrative-validation';
import { assertPhotoshootEpisode } from './photoshoot-validation';
import { createSeededRandom } from './random';
import { assertSpecialtiesEpisode, validateSpecialties } from './specialties-validation';
import { assertTrackSpecialsEpisode, validateTrackSpecials } from './track-specials-validation';
import { assertVarietyShowEpisode, validateVarietyShow } from './variety-show-validation';
import { assertVersatilityEpisode, validateVersatility } from './versatility-validation';

export const SIMULATION_STORAGE_KEY = 'the-search-simulation-setup';
const COMPRESSED_PREFIX = 'the-search:compressed:';
const STORAGE_FORMAT = `${COMPRESSED_PREFIX}1:`;

export function encodeSimulationState(state: SimulationState): string {
  return STORAGE_FORMAT + LZString.compressToUTF16(JSON.stringify(state));
}

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
  if (isRecord(value.aggregations) && value.aggregations.rankingScore === undefined) {
    value.aggregations.rankingScore = value.aggregations.score;
    value.aggregations.score = 0;
    if (Array.isArray(value.changeLog))
      for (const entry of value.changeLog) {
        if (!isRecord(entry)) continue;
        if (isRecord(entry.change)) {
          for (const [path, change] of Object.entries(entry.change)) {
            if (path === 'aggregations.score') {
              entry.change['aggregations.rankingScore'] = change;
              delete entry.change[path];
            } else migrateRankingEvidence(change, path);
          }
        }
        migrateRankingChanges(entry.changes);
      }
  }
  const { bias: _bias, ...template } = createContestant({
    id: 'validation',
    name: 'Validation',
    updatedAt: 1,
  });
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

function migrateRankingEvidence(value: unknown, path: string): void {
  if (!isRecord(value)) return;
  if (/(^|\.)aggregations$/.test(path) && Object.hasOwn(value, 'score')) {
    value.rankingScore = value.score;
    delete value.score;
  }
  for (const [key, child] of Object.entries(value))
    migrateRankingEvidence(child, path ? `${path}.${key}` : key);
}

function migrateRankingChanges(value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const change of value) {
    if (!isRecord(change) || typeof change.path !== 'string') continue;
    if (change.path === 'aggregations.score') change.path = 'aggregations.rankingScore';
    else {
      migrateRankingEvidence(change.before, change.path);
      migrateRankingEvidence(change.after, change.path);
    }
  }
}

function migrateLegacyRankingPaths(value: unknown): void {
  if (Array.isArray(value)) {
    for (const child of value) migrateLegacyRankingPaths(child);
  } else if (isRecord(value)) {
    if (value.path === 'aggregations.score') value.path = 'aggregations.rankingScore';
    if (Object.hasOwn(value, 'aggregations.score')) {
      value['aggregations.rankingScore'] = value['aggregations.score'];
      delete value['aggregations.score'];
    }
    for (const child of Object.values(value)) migrateLegacyRankingPaths(child);
  }
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
  for (const type of ['lifestyle', 'history', 'quirk']) {
    const library = cards[type];
    if (
      library !== undefined &&
      (!isCardLibrary(library) || Object.values(library).some((card) => card.type !== type))
    )
      throw new Error(`The saved ${type} card definitions are invalid.`);
  }
  const genres = specialties.genreAffinity;
  if (!isCardLibrary(genres)) throw new Error('The saved genre definitions are invalid.');
  validateAuditionSongs(value.auditionSongs, Object.keys(genres));
  if (value.battleSongs !== undefined) validateBattleSongs(value.battleSongs, Object.keys(genres));
  if (value.megaGroupTests !== undefined || value.megaGroupSongs !== undefined)
    validateMegaGroupsCatalogs(value.megaGroupTests, value.megaGroupSongs, Object.keys(genres));
  if (value.photoshootConcepts !== undefined) {
    const visualVibes = specialties.visualVibe;
    if (!isCardLibrary(visualVibes)) throw new Error('The saved visual-vibe definitions are invalid.');
    validatePhotoshootConcepts(value.photoshootConcepts, Object.keys(visualVibes));
  }
  if (value.trackSpecialSongs !== undefined) validateTrackSpecialSongs(value.trackSpecialSongs);
  if (value.versatilitySongs !== undefined || value.doubtGirls !== undefined)
    validateVersatilityCatalogs(value.versatilitySongs, value.doubtGirls, specialties);
  if (value.varietyShowCatalog !== undefined) validateVarietyShowCatalog(value.varietyShowCatalog);
  if (value.musicVideoCatalog !== undefined) validateMusicVideoCatalog(value.musicVideoCatalog);
  if (value.specialtiesCatalog !== undefined) validateSpecialtiesCatalog(value.specialtiesCatalog);
  if (value.finaleCatalog !== undefined) validateFinaleCatalog(value.finaleCatalog);
}

export function decodeSimulationState(stored: string): SimulationState {
  let json = stored;
  if (stored.startsWith(COMPRESSED_PREFIX)) {
    if (!stored.startsWith(STORAGE_FORMAT))
      throw new Error('The saved simulation uses an unsupported compression format.');
    const decompressed = LZString.decompressFromUTF16(stored.slice(STORAGE_FORMAT.length));
    if (!decompressed) throw new Error('The compressed simulation save is invalid.');
    json = decompressed;
  }
  const value: unknown = JSON.parse(json);
  if (isRecord(value) && isRecord(value.runtime) && value.runtime.progression === undefined)
    migrateLegacyRankingPaths(value);
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
    (runtime.episode !== 0 &&
      runtime.episode !== 1 &&
      runtime.episode !== 2 &&
      runtime.episode !== 3 &&
      runtime.episode !== 4 &&
      runtime.episode !== 5 &&
      runtime.episode !== 6 &&
      runtime.episode !== 7 &&
      runtime.episode !== 8 &&
      runtime.episode !== 9 &&
      runtime.episode !== 10 &&
      runtime.episode !== 11) ||
    (runtime.phase !== 'setup-complete' &&
      runtime.phase !== 'auditions' &&
      runtime.phase !== 'battles' &&
      runtime.phase !== 'bootcamp' &&
      runtime.phase !== 'mega-groups' &&
      runtime.phase !== 'photoshoot' &&
      runtime.phase !== 'track-specials' &&
      runtime.phase !== 'versatility' &&
      runtime.phase !== 'variety-show' &&
      runtime.phase !== 'music-video' &&
      runtime.phase !== 'specialties' &&
      runtime.phase !== 'finale' &&
      runtime.phase !== 'season-complete' &&
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
  const megaGroups = runtime.megaGroups ?? null;
  const photoshoot = runtime.photoshoot ?? null;
  const trackSpecials = runtime.trackSpecials ?? null;
  const versatility = runtime.versatility ?? null;
  const varietyShow = runtime.varietyShow ?? null;
  const musicVideo = runtime.musicVideo ?? null;
  const specialties = runtime.specialties ?? null;
  const finale = runtime.finale ?? null;
  if (runtime.progression === undefined)
    for (const record of [
      audition,
      battle,
      bootcamp,
      megaGroups,
      photoshoot,
      trackSpecials,
      versatility,
      varietyShow,
      musicVideo,
      specialties,
      finale,
    ])
      if (isRecord(record) && isRecord(record.changes))
        for (const changes of Object.values(record.changes)) migrateRankingChanges(changes);
  if (
    (runtime.episode === 3 && (runtime.version !== 3 || bootcamp === null)) ||
    (bootcamp !== null && (runtime.version !== 3 || runtime.episode < 3)) ||
    (runtime.phase === 'bootcamp' && runtime.episode !== 3)
  )
    throw new Error('Boot Camp requires a current-format Episode 3 season.');
  if (
    (runtime.episode === 4 && (runtime.version !== 3 || megaGroups === null)) ||
    (megaGroups !== null && (runtime.version !== 3 || runtime.episode < 4)) ||
    (runtime.phase === 'mega-groups' && runtime.episode !== 4)
  )
    throw new Error('Mega Groups requires a current-format Episode 4 season.');
  if (
    (runtime.episode === 5 && (runtime.version !== 3 || photoshoot === null)) ||
    (photoshoot !== null && (runtime.version !== 3 || runtime.episode < 5)) ||
    (runtime.phase === 'photoshoot' && runtime.episode !== 5)
  )
    throw new Error('Photoshoot requires a current-format Episode 5 season.');
  if (
    (runtime.episode === 6 && (runtime.version !== 3 || trackSpecials === null)) ||
    (trackSpecials !== null && (runtime.version !== 3 || runtime.episode < 6)) ||
    (runtime.phase === 'track-specials' && runtime.episode !== 6)
  )
    throw new Error('Track Specials requires a current-format Episode 6 season.');
  if (
    (runtime.episode === 7 && (runtime.version !== 3 || versatility === null)) ||
    (versatility !== null && (runtime.version !== 3 || runtime.episode < 7)) ||
    (runtime.phase === 'versatility' && runtime.episode !== 7)
  )
    throw new Error('Versatility requires a current-format Episode 7 season.');
  if (
    (runtime.episode === 8 && (runtime.version !== 3 || varietyShow === null)) ||
    (varietyShow !== null && (runtime.version !== 3 || runtime.episode < 8)) ||
    (runtime.phase === 'variety-show' && runtime.episode !== 8)
  )
    throw new Error('Variety Show requires a current-format Episode 8 season.');
  if (
    (runtime.episode === 9 && (runtime.version !== 3 || musicVideo === null)) ||
    (musicVideo !== null && (runtime.version !== 3 || runtime.episode < 9)) ||
    (runtime.phase === 'music-video' && runtime.episode !== 9)
  )
    throw new Error('Music Videos requires a current-format Episode 9 season.');
  if (
    (runtime.episode === 10 && (runtime.version !== 3 || specialties === null)) ||
    (specialties !== null && (runtime.version !== 3 || runtime.episode < 10)) ||
    (runtime.phase === 'specialties' && runtime.episode !== 10)
  )
    throw new Error('Specialties requires a current-format Episode 10 season.');
  if (
    (runtime.episode === 11 && (runtime.version !== 3 || finale === null)) ||
    (finale !== null && (runtime.version !== 3 || runtime.episode !== 11)) ||
    ((runtime.phase === 'finale' || runtime.phase === 'season-complete') && runtime.episode !== 11)
  )
    throw new Error('The Finale requires a current-format Episode 11 season.');
  let specialtiesContestants = currentContestants;
  if (finale !== null) {
    if (!isRecord(finale) || !isContestants(finale.startingContestants))
      throw new Error('The saved Finale starting cast is invalid.');
    specialtiesContestants = finale.startingContestants;
  }
  let musicVideoContestants = currentContestants;
  if (specialties !== null) {
    if (!isRecord(specialties) || !isContestants(specialties.startingContestants))
      throw new Error('The saved Specialties starting cast is invalid.');
    musicVideoContestants = specialties.startingContestants;
  }
  let varietyShowContestants = currentContestants;
  if (musicVideo !== null) {
    if (!isRecord(musicVideo) || !isContestants(musicVideo.startingContestants))
      throw new Error('The saved Music Videos starting cast is invalid.');
    varietyShowContestants = musicVideo.startingContestants;
  }
  let versatilityContestants = currentContestants;
  if (varietyShow !== null) {
    if (!isRecord(varietyShow) || !isContestants(varietyShow.startingContestants))
      throw new Error('The saved Variety Show starting cast is invalid.');
    versatilityContestants = varietyShow.startingContestants;
  }
  let trackSpecialsContestants = currentContestants;
  if (versatility !== null) {
    if (!isRecord(versatility) || !isContestants(versatility.startingContestants))
      throw new Error('The saved Versatility starting cast is invalid.');
    trackSpecialsContestants = versatility.startingContestants;
  }
  let photoshootContestants = currentContestants;
  if (trackSpecials !== null) {
    if (!isRecord(trackSpecials) || !isContestants(trackSpecials.startingContestants))
      throw new Error('The saved Track Specials starting cast is invalid.');
    photoshootContestants = trackSpecials.startingContestants;
  }
  let megaGroupsContestants = currentContestants;
  if (photoshoot !== null) {
    if (!isRecord(photoshoot) || !isContestants(photoshoot.startingContestants))
      throw new Error('The saved Photoshoot starting cast is invalid.');
    megaGroupsContestants = photoshoot.startingContestants;
  }
  let bootcampContestants = currentContestants;
  if (megaGroups !== null) {
    if (!isRecord(megaGroups) || !isContestants(megaGroups.startingContestants))
      throw new Error('The saved Mega Groups starting cast is invalid.');
    bootcampContestants = megaGroups.startingContestants;
  }
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
        useBias: runtime.setup.useBias,
      });
    } else {
      assertAuditionEpisode(audition, archiveContestants, runtime.definitions, {
        archived: runtime.episode >= 2,
        useBias: runtime.setup.useBias,
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
      (runtime.episode >= 3 && battle.phase !== 'complete') ||
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
    assertBootcampEpisode(bootcamp, bootcampContestants, definitions);
    freezeSimulationSnapshot(bootcamp.startingContestants);
    if (
      !battle ||
      battle.phase !== 'complete' ||
      (runtime.episode === 3 &&
        runtime.phase !== (bootcamp.phase === 'complete' ? 'episode-complete' : 'bootcamp')) ||
      (runtime.episode >= 4 && bootcamp.phase !== 'complete') ||
      bootcamp.participantIds.length !== battle.survivorIds.length ||
      !bootcamp.participantIds.every((id) => battle.survivorIds.includes(id)) ||
      (runtime.episode === 3 &&
        bootcamp.audience !== null &&
        bootcamp.audience.votingPopulation !== show.audience)
    )
      throw new Error('The saved Boot Camp progress does not match its archive, cast or audience.');
  }
  if (runtime.episode >= 4 && !bootcamp)
    throw new Error('Mega Groups requires a completed Boot Camp archive.');
  if (megaGroups !== null) {
    assertMegaGroupsEpisode(megaGroups, megaGroupsContestants, definitions);
    freezeSimulationSnapshot(megaGroups.startingContestants);
    if (
      !bootcamp ||
      bootcamp.phase !== 'complete' ||
      (runtime.episode === 4 &&
        runtime.phase !== (megaGroups.phase === 'complete' ? 'episode-complete' : 'mega-groups')) ||
      (runtime.episode >= 5 && megaGroups.phase !== 'complete') ||
      megaGroups.participantIds.length !== bootcamp.participantIds.length ||
      !megaGroups.participantIds.every((id) => bootcamp.participantIds.includes(id)) ||
      (runtime.episode === 4 &&
        megaGroups.audience !== null &&
        megaGroups.audience.votingPopulation !== show.audience)
    )
      throw new Error('The saved Mega Groups progress does not match its archive, cast or audience.');
  }
  if (runtime.episode >= 5 && !megaGroups)
    throw new Error('Photoshoot requires a completed Mega Groups archive.');
  if (photoshoot !== null) {
    assertPhotoshootEpisode(photoshoot, photoshootContestants, definitions);
    freezeSimulationSnapshot(photoshoot.startingContestants);
    if (
      !megaGroups ||
      megaGroups.phase !== 'complete' ||
      (runtime.episode === 5 &&
        runtime.phase !== (photoshoot.phase === 'complete' ? 'episode-complete' : 'photoshoot')) ||
      (runtime.episode >= 6 && photoshoot.phase !== 'complete') ||
      photoshoot.participantIds.length !== megaGroups.survivorIds.length ||
      !photoshoot.participantIds.every((id) => megaGroups.survivorIds.includes(id)) ||
      (runtime.episode === 5 &&
        photoshoot.audience !== null &&
        photoshoot.audience.votingPopulation !== show.audience)
    )
      throw new Error('The saved Photoshoot progress does not match its archive, cast or audience.');
  }
  if (runtime.episode >= 6 && !photoshoot)
    throw new Error('Track Specials requires a completed Photoshoot archive.');
  if (trackSpecials !== null) {
    assertTrackSpecialsEpisode(trackSpecials, trackSpecialsContestants, definitions);
    freezeSimulationSnapshot(trackSpecials.startingContestants);
    if (
      !photoshoot ||
      photoshoot.phase !== 'complete' ||
      (runtime.episode === 6 &&
        runtime.phase !== (trackSpecials.phase === 'complete' ? 'episode-complete' : 'track-specials')) ||
      (runtime.episode >= 7 && trackSpecials.phase !== 'complete') ||
      trackSpecials.participantIds.length !== photoshoot.survivorIds.length ||
      !trackSpecials.participantIds.every((id) => photoshoot.survivorIds.includes(id)) ||
      (runtime.episode === 6 &&
        trackSpecials.audience !== null &&
        trackSpecials.audience.votingPopulation !== show.audience)
    )
      throw new Error('The saved Track Specials progress does not match its archive, cast or audience.');
  }
  if (runtime.episode >= 7 && !trackSpecials)
    throw new Error('Versatility requires a completed Track Specials archive.');
  if (versatility !== null) {
    assertVersatilityEpisode(versatility, versatilityContestants, definitions);
    freezeSimulationSnapshot(versatility.startingContestants);
    if (
      !trackSpecials ||
      trackSpecials.phase !== 'complete' ||
      (runtime.episode === 7 &&
        runtime.phase !== (versatility.phase === 'complete' ? 'episode-complete' : 'versatility')) ||
      (runtime.episode >= 8 && versatility.phase !== 'complete') ||
      versatility.participantIds.length !== trackSpecials.survivorIds.length ||
      !versatility.participantIds.every((id) => trackSpecials.survivorIds.includes(id)) ||
      (runtime.episode === 7 &&
        versatility.audience !== null &&
        versatility.audience.votingPopulation !== show.audience)
    )
      throw new Error('The saved Versatility progress does not match its archive, cast or audience.');
  }
  if (runtime.episode >= 8 && !versatility)
    throw new Error('Variety Show requires a completed Versatility archive.');
  if (varietyShow !== null) {
    assertVarietyShowEpisode(varietyShow, varietyShowContestants, definitions);
    freezeSimulationSnapshot(varietyShow.startingContestants);
    if (
      !versatility ||
      versatility.phase !== 'complete' ||
      (runtime.episode === 8 &&
        runtime.phase !== (varietyShow.phase === 'complete' ? 'episode-complete' : 'variety-show')) ||
      (runtime.episode >= 9 && varietyShow.phase !== 'complete') ||
      varietyShow.participantIds.length !== versatility.survivorIds.length ||
      !varietyShow.participantIds.every((id) => versatility.survivorIds.includes(id)) ||
      (runtime.episode === 8 &&
        varietyShow.audience !== null &&
        varietyShow.audience.votingPopulation !== show.audience)
    )
      throw new Error('The saved Variety Show progress does not match its archive, cast or audience.');
  }
  if (runtime.episode >= 9 && !varietyShow)
    throw new Error('Music Videos requires a completed Variety Show archive.');
  if (musicVideo !== null) {
    assertMusicVideoEpisode(musicVideo, musicVideoContestants, definitions);
    freezeSimulationSnapshot(musicVideo.startingContestants);
    if (
      !varietyShow ||
      varietyShow.phase !== 'complete' ||
      (runtime.episode === 9 &&
        runtime.phase !== (musicVideo.phase === 'complete' ? 'episode-complete' : 'music-video')) ||
      (runtime.episode >= 10 && musicVideo.phase !== 'complete') ||
      musicVideo.participantIds.length !== varietyShow.survivorIds.length ||
      !musicVideo.participantIds.every((id) => varietyShow.survivorIds.includes(id)) ||
      (runtime.episode === 9 &&
        musicVideo.audience !== null &&
        musicVideo.audience.votingPopulation !== show.audience)
    )
      throw new Error('The saved Music Videos progress does not match its archive, cast or audience.');
  }
  if (runtime.episode >= 10 && !musicVideo)
    throw new Error('Specialties requires a completed Music Videos archive.');
  if (specialties !== null) {
    assertSpecialtiesEpisode(specialties, specialtiesContestants, definitions);
    freezeSimulationSnapshot(specialties.startingContestants);
    if (
      !musicVideo ||
      musicVideo.phase !== 'complete' ||
      (runtime.episode === 10 &&
        runtime.phase !== (specialties.phase === 'complete' ? 'episode-complete' : 'specialties')) ||
      (runtime.episode >= 11 && specialties.phase !== 'complete') ||
      specialties.participantIds.length !== musicVideo.survivorIds.length ||
      !specialties.participantIds.every((id) => musicVideo.survivorIds.includes(id)) ||
      (runtime.episode === 10 &&
        specialties.audience !== null &&
        specialties.audience.votingPopulation !== show.audience)
    )
      throw new Error('The saved Specialties progress does not match its archive, cast or audience.');
  }
  if (runtime.episode >= 11 && !specialties)
    throw new Error('The Finale requires a completed Specialties archive.');
  if (finale !== null) {
    assertFinaleEpisode(finale, currentContestants, definitions);
    freezeSimulationSnapshot(finale.startingContestants);
    if (
      !specialties ||
      specialties.phase !== 'complete' ||
      runtime.phase !== (finale.phase === 'complete' ? 'season-complete' : 'finale') ||
      finale.participantIds.length !== specialties.survivorIds.length ||
      !finale.participantIds.every((id) => specialties.survivorIds.includes(id)) ||
      (finale.audience !== null && finale.audience.votingPopulation !== show.audience)
    )
      throw new Error('The saved Finale progress does not match its archive, cast or audience.');
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
      ...(megaGroups ? { megaGroups } : {}),
      ...(photoshoot ? { photoshoot } : {}),
      ...(trackSpecials ? { trackSpecials } : {}),
      ...(versatility ? { versatility } : {}),
      ...(varietyShow ? { varietyShow } : {}),
      ...(musicVideo ? { musicVideo } : {}),
      ...(specialties ? { specialties } : {}),
      ...(finale ? { finale } : {}),
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
          (key) =>
            key !== '1' &&
            key !== '2' &&
            ((key !== '3' &&
              key !== '4' &&
              key !== '5' &&
              key !== '6' &&
              key !== '7' &&
              key !== '8' &&
              key !== '9' &&
              key !== '10' &&
              key !== '11') ||
              runtime.version !== 3),
        )
      )
        throw new Error('Invalid saved episode preparations.');
      restored.runtime.preparations = {};
      for (const number of [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const) {
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
    const fourth = restored.runtime.preparations?.[4];
    const fifth = restored.runtime.preparations?.[5];
    const sixth = restored.runtime.preparations?.[6];
    const seventh = restored.runtime.preparations?.[7];
    const eighth = restored.runtime.preparations?.[8];
    const ninth = restored.runtime.preparations?.[9];
    const tenth = restored.runtime.preparations?.[10];
    const eleventh = restored.runtime.preparations?.[11];
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
    if (fourth && bootcamp?.phase !== 'complete')
      throw new Error('Episode 4 preparation requires completed Boot Camp.');
    if (megaGroups && (!fourth?.mood || fourth.slots.some((id) => id === null)))
      throw new Error('Mega Groups preparation is missing.');
    if (
      megaGroups &&
      fourth &&
      fourth.openingPlayed !== megaGroups.scenes.some((scene) => scene.title === 'Opening credits')
    )
      throw new Error('Mega Groups credits do not match their recorded effect.');
    if (fifth && megaGroups?.phase !== 'complete')
      throw new Error('Episode 5 preparation requires completed Mega Groups.');
    if (photoshoot && (!fifth?.mood || fifth.slots.some((id) => id === null)))
      throw new Error('Photoshoot preparation is missing.');
    if (
      photoshoot &&
      fifth &&
      fifth.openingPlayed !== photoshoot.scenes.some((scene) => scene.title === 'Opening credits')
    )
      throw new Error('Photoshoot credits do not match their recorded effect.');
    if (sixth && photoshoot?.phase !== 'complete')
      throw new Error('Episode 6 preparation requires completed Photoshoot.');
    if (trackSpecials && (!sixth?.mood || sixth.slots.some((id) => id === null)))
      throw new Error('Track Specials preparation is missing.');
    if (
      trackSpecials &&
      sixth &&
      sixth.openingPlayed !== trackSpecials.scenes.some((scene) => scene.title === 'Opening credits')
    )
      throw new Error('Track Specials credits do not match their recorded effect.');
    if (seventh && trackSpecials?.phase !== 'complete')
      throw new Error('Episode 7 preparation requires completed Track Specials.');
    if (versatility && (!seventh?.mood || seventh.slots.some((id) => id === null)))
      throw new Error('Versatility preparation is missing.');
    if (
      versatility &&
      seventh &&
      seventh.openingPlayed !== versatility.scenes.some((scene) => scene.title === 'Opening credits')
    )
      throw new Error('Versatility credits do not match their recorded effect.');
    if (eighth && versatility?.phase !== 'complete')
      throw new Error('Episode 8 preparation requires completed Versatility.');
    if (varietyShow && (!eighth?.mood || eighth.slots.some((id) => id === null)))
      throw new Error('Variety Show preparation is missing.');
    if (
      varietyShow &&
      eighth &&
      eighth.openingPlayed !== varietyShow.scenes.some((scene) => scene.title === 'Opening credits')
    )
      throw new Error('Variety Show credits do not match their recorded effect.');
    if (ninth && varietyShow?.phase !== 'complete')
      throw new Error('Episode 9 preparation requires completed Variety Show.');
    if (musicVideo && (!ninth?.mood || ninth.slots.some((id) => id === null)))
      throw new Error('Music Videos preparation is missing.');
    if (
      musicVideo &&
      ninth &&
      ninth.openingPlayed !== musicVideo.scenes.some((scene) => scene.title === 'Opening credits')
    )
      throw new Error('Music Videos credits do not match their recorded effect.');
    if (tenth && musicVideo?.phase !== 'complete')
      throw new Error('Episode 10 preparation requires completed Music Videos.');
    if (specialties && (!tenth?.mood || tenth.slots.some((id) => id === null)))
      throw new Error('Specialties preparation is missing.');
    if (
      specialties &&
      tenth &&
      tenth.openingPlayed !== specialties.scenes.some((scene) => scene.title === 'Opening credits')
    )
      throw new Error('Specialties credits do not match their recorded effect.');
    if (eleventh && specialties?.phase !== 'complete')
      throw new Error('Episode 11 preparation requires completed Specialties.');
    if (finale && (!eleventh?.mood || eleventh.slots.some((id) => id === null)))
      throw new Error('The Finale preparation is missing.');
    if (
      finale &&
      eleventh &&
      eleventh.openingPlayed !== finale.scenes.some((scene) => scene.presentation === 'credits')
    )
      throw new Error('The Finale credits do not match their recorded effect.');
    if (
      (first?.openingPlayed ||
        second?.openingPlayed ||
        third?.openingPlayed ||
        fourth?.openingPlayed ||
        fifth?.openingPlayed ||
        sixth?.openingPlayed ||
        seventh?.openingPlayed ||
        eighth?.openingPlayed ||
        ninth?.openingPlayed ||
        tenth?.openingPlayed ||
        eleventh?.openingPlayed) &&
      !restored.runtime.openingCast
    )
      throw new Error('Opening credits are missing their cast.');
  } else if (runtime.openingCast !== undefined || runtime.preparations !== undefined) {
    throw new Error('A legacy season cannot contain narrative preparations.');
  }
  applySeasonRanks(restored);
  restoreActivityProgression(restored, runtime.progression);
  if (restored.runtime?.trackSpecials)
    validateTrackSpecials({ ...restored, contestants: trackSpecialsContestants });
  if (restored.runtime?.versatility)
    validateVersatility({ ...restored, contestants: versatilityContestants });
  validateMusicVideoPreparation(restored);
  validateSpecialtiesPreparation(restored);
  validateFinalePreparation(restored);
  if (restored.runtime?.varietyShow) validateVarietyShow(restored);
  if (restored.runtime?.musicVideo) validateMusicVideo(restored);
  if (restored.runtime?.specialties) validateSpecialties(restored);
  if (restored.runtime?.finale) validateFinale(restored);
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
