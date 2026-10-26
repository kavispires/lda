import type { MoodChoices, MoodOptions } from '../types/audition-episode';
import type { Contestant, CoreSkills, Specialties } from '../types/contestant';
import type { EpisodePreparation, PreparationAction } from '../types/narrative';
import { isNarrativeSeason, type SeasonRuntime, type SimulationState } from '../types/simulation';
import { getMegaGroupsCatalogs } from '../utilities/mega-groups-catalogs';
import { getMusicVideoCatalog } from '../utilities/music-video-catalog';
import { getPhotoshootConcepts } from '../utilities/photoshoot-concepts';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { getTrackSpecialSongs } from '../utilities/track-special-songs';
import { getVarietyShowCatalog } from '../utilities/variety-show-catalog';
import { getVersatilityCatalogs } from '../utilities/versatility-catalogs';
import { recordContestantChanges } from './change-history';
import { createSeededRandom, type RandomSource, shuffleWithRandom } from './random';

const FIELDS: (keyof Specialties)[] = [
  'vocalColor',
  'danceStyle',
  'rapStyle',
  'visualVibe',
  'leadershipStyle',
  'genreAffinity',
];
const CORE: (keyof CoreSkills)[] = [
  'vocals',
  'rap',
  'dance',
  'stagePresence',
  'visual',
  'uniqueness',
  'leadership',
];

function runtimeOf(state: SimulationState): SeasonRuntime {
  if (!state.runtime || !isNarrativeSeason(state.runtime))
    throw new Error('Episode preparation requires a narrative season.');
  return state.runtime;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ids(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((id) => typeof id === 'string') &&
    new Set(value).size === value.length
  );
}

function choices(value: unknown, options: MoodOptions): value is MoodChoices {
  return (
    object(value) &&
    Object.keys(value).length === FIELDS.length &&
    FIELDS.every((field) => typeof value[field] === 'string' && options[field].includes(value[field]))
  );
}

export function initializePreparation(
  state: SimulationState,
  episode: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  random: RandomSource,
): EpisodePreparation {
  const runtime = runtimeOf(state);
  const existing = runtime.preparations?.[episode];
  if (existing) return existing;
  const startState = runtime.randomState;
  const initialDraws: number[] = [];
  if (episode === 9) {
    const source = random;
    random = () => {
      const value = source();
      initialDraws.push(value);
      return value;
    };
  }
  const active = state.contestants.filter((contestant) => contestant.status === 'ACTIVE');
  if (episode === 2 && runtime.audition?.phase !== 'complete')
    throw new Error('Complete Episode 1 before preparing Episode 2.');
  if (
    episode === 3 &&
    (runtime.version !== 3 ||
      runtime.battle?.phase !== 'complete' ||
      runtime.battle.survivorIds.length !== 18 ||
      active.length !== 18 ||
      active.some((person) => !runtime.battle!.survivorIds.includes(person.id)))
  )
    throw new Error('Complete The Battles with eighteen locked survivors before preparing Episode 3.');
  if (active.length < 5) throw new Error('The opening requires five active contestants.');
  if (episode === 9) {
    const previous = runtime.varietyShow;
    if (
      runtime.version !== 3 ||
      previous?.phase !== 'complete' ||
      previous.survivorIds.length !== 10 ||
      active.length !== 10 ||
      active.some((person) => !previous.survivorIds.includes(person.id))
    )
      throw new Error('Complete Variety Show with ten locked survivors before preparing Music Videos.');
    if (!runtime.definitions.musicVideoCatalog) {
      if (runtime.musicVideo) throw new Error('Music Videos definitions are missing from an active episode.');
      runtime.definitions = freezeSimulationSnapshot({
        ...runtime.definitions,
        musicVideoCatalog: getMusicVideoCatalog(),
      });
    }
  }
  if (episode === 8) {
    const previous = runtime.versatility;
    if (
      runtime.version !== 3 ||
      previous?.phase !== 'complete' ||
      previous.survivorIds.length !== 12 ||
      active.length !== 12 ||
      active.some((person) => !previous.survivorIds.includes(person.id))
    )
      throw new Error('Complete Versatility with twelve locked survivors before preparing Variety Show.');
    if (!runtime.definitions.varietyShowCatalog) {
      if (runtime.varietyShow)
        throw new Error('Variety Show definitions are missing from an active episode.');
      runtime.definitions = freezeSimulationSnapshot({
        ...runtime.definitions,
        varietyShowCatalog: getVarietyShowCatalog(),
      });
    }
  }
  if (episode === 7) {
    const previous = runtime.trackSpecials;
    if (
      runtime.version !== 3 ||
      previous?.phase !== 'complete' ||
      previous.survivorIds.length !== 15 ||
      active.length !== 15 ||
      active.some((person) => !previous.survivorIds.includes(person.id))
    )
      throw new Error('Complete Track Specials with fifteen locked survivors before preparing Versatility.');
    if (!runtime.definitions.versatilitySongs || !runtime.definitions.doubtGirls) {
      if (runtime.versatility) throw new Error('Versatility definitions are missing from an active episode.');
      const catalogs = getVersatilityCatalogs();
      runtime.definitions = freezeSimulationSnapshot({
        ...runtime.definitions,
        versatilitySongs: runtime.definitions.versatilitySongs ?? catalogs.versatilitySongs,
        doubtGirls: runtime.definitions.doubtGirls ?? catalogs.doubtGirls,
      });
    }
  }
  if (episode === 6) {
    const previous = runtime.photoshoot;
    if (
      runtime.version !== 3 ||
      previous?.phase !== 'complete' ||
      previous.survivorIds.length !== 16 ||
      active.length !== 16 ||
      active.some((person) => !previous.survivorIds.includes(person.id))
    )
      throw new Error('Complete Photoshoot with sixteen locked survivors before preparing Track Specials.');
    if (!runtime.definitions.trackSpecialSongs) {
      if (runtime.trackSpecials)
        throw new Error('Track Specials definitions are missing from an active episode.');
      runtime.definitions = freezeSimulationSnapshot({
        ...runtime.definitions,
        trackSpecialSongs: getTrackSpecialSongs(),
      });
    }
  }
  if (episode === 5) {
    const previous = runtime.megaGroups;
    if (
      runtime.version !== 3 ||
      previous?.phase !== 'complete' ||
      previous.survivorIds.length !== 16 ||
      active.length !== 16 ||
      active.some((person) => !previous.survivorIds.includes(person.id))
    )
      throw new Error('Complete Mega Groups with sixteen locked survivors before preparing Photoshoot.');
    if (!runtime.definitions.photoshootConcepts) {
      if (runtime.photoshoot) throw new Error('Photoshoot definitions are missing from an active episode.');
      runtime.definitions = freezeSimulationSnapshot({
        ...runtime.definitions,
        photoshootConcepts: getPhotoshootConcepts(),
      });
    }
  }
  if (episode === 4) {
    if (
      runtime.version !== 3 ||
      runtime.bootcamp?.phase !== 'complete' ||
      active.length !== 18 ||
      active.some((person) => !runtime.bootcamp!.participantIds.includes(person.id))
    )
      throw new Error('Complete Boot Camp with eighteen survivors before preparing Mega Groups.');
    if (!runtime.definitions.megaGroupTests || !runtime.definitions.megaGroupSongs) {
      if (runtime.megaGroups) throw new Error('Mega Groups definitions are missing from an active episode.');
      const catalogs = getMegaGroupsCatalogs();
      runtime.definitions = freezeSimulationSnapshot({
        ...runtime.definitions,
        megaGroupTests: runtime.definitions.megaGroupTests ?? catalogs.megaGroupTests,
        megaGroupSongs: runtime.definitions.megaGroupSongs ?? catalogs.megaGroupSongs,
      });
    }
  }
  const libraries = Object.fromEntries(
    FIELDS.map((field) => {
      const values = Object.keys(runtime.definitions.specialties[field]);
      if (values.length < 2) throw new Error(`Opening mood library "${field}" requires at least two values.`);
      return [field, values];
    }),
  ) as MoodOptions;
  const activeIds = new Set(active.map((contestant) => contestant.id));
  if (
    episode >= 2 &&
    (!runtime.openingCast || runtime.openingCast.length !== 5 || new Set(runtime.openingCast).size !== 5)
  )
    throw new Error(`Episode ${episode} requires the previous five-person opening cast.`);
  const slots: (string | null)[] =
    episode === 1
      ? Array<string | null>(5).fill(null)
      : runtime.openingCast!.map((id) => (activeIds.has(id) ? id : null));
  const retained = new Set(slots.filter((id) => id !== null));
  const candidates = shuffleWithRandom(
    active.filter((contestant) => !retained.has(contestant.id)),
    random,
  );
  const total = (contestant: Contestant) =>
    CORE.reduce((sum, skill) => sum + contestant.coreSkills[skill], 0);
  candidates.sort(
    (left, right) => total(right) - total(left) || right.coreSkills.visual - left.coreSkills.visual,
  );
  const shortlist = candidates.slice(0, 10).map((contestant) => contestant.id);
  const previousRanking =
    episode === 9
      ? runtime.varietyShow!.survivorIds
      : episode === 8
        ? runtime.versatility!.survivorIds
        : episode === 7
          ? runtime.trackSpecials!.survivorIds
          : episode === 6
            ? runtime.photoshoot!.rankedIds
            : episode === 5
              ? runtime.megaGroups!.finalRankedIds.filter((id) => activeIds.has(id))
              : episode === 4
                ? runtime.bootcamp!.rankedIds
                : episode === 3
                  ? runtime.battle!.finalRankedIds
                  : null;
  const rank = (contestant: Contestant) =>
    previousRanking
      ? previousRanking.indexOf(contestant.id)
      : (contestant.changeLog.findLast((entry) => entry.episode === episode - 1)?.rank ?? contestant.rank);
  const ranked = [...active].sort(
    (left, right) => rank(left) - rank(right) || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
  const moodOptions = {} as MoodOptions;
  for (const field of FIELDS) {
    const values = libraries[field];
    if (episode === 1) moodOptions[field] = shuffleWithRandom(values, random).slice(0, 2);
    else {
      const first = ranked[0].specialties[field];
      const last = ranked[ranked.length - 1].specialties[field];
      if (!values.includes(first) || !values.includes(last))
        throw new Error(`Ranked contestants have an invalid "${field}" specialty.`);
      const second =
        first === last
          ? values.filter((value) => value !== first)[Math.floor(random() * (values.length - 1))]
          : last;
      moodOptions[field] = shuffleWithRandom([first, second], random);
    }
  }
  const preparation: EpisodePreparation = {
    episode,
    revision: 0,
    lastAction: null,
    moodOptions,
    mood: null,
    randomizedMood: null,
    shortlist,
    slots,
    requiredSelections: slots.filter((id) => id === null).length,
    openingPlayed: false,
    ...(episode === 9
      ? {
          randomAudit: {
            version: 1 as const,
            startState,
            initialDraws,
            steps: [],
            endState: replayPreparationDraws(startState, initialDraws),
          },
        }
      : {}),
  };
  runtime.preparations ??= {};
  runtime.preparations[episode] = preparation;
  return preparation;
}

export function applyPreparation(
  state: SimulationState,
  action: PreparationAction,
  random: RandomSource,
): void {
  const runtime = runtimeOf(state);
  const episode =
    runtime.preparations?.[9] && runtime.varietyShow?.phase === 'complete'
      ? 9
      : runtime.preparations?.[8] && runtime.versatility?.phase === 'complete'
        ? 8
        : runtime.preparations?.[7] && runtime.trackSpecials?.phase === 'complete'
          ? 7
          : runtime.preparations?.[6] && runtime.photoshoot?.phase === 'complete'
            ? 6
            : runtime.preparations?.[5] && runtime.megaGroups?.phase === 'complete'
              ? 5
              : runtime.preparations?.[4] && runtime.bootcamp?.phase === 'complete'
                ? 4
                : runtime.preparations?.[3] && runtime.battle?.phase === 'complete'
                  ? 3
                  : runtime.battle
                    ? 2
                    : runtime.audition?.phase === 'complete'
                      ? 2
                      : 1;
  const preparation = runtime.preparations?.[episode];
  if (!preparation) throw new Error('Initialize episode preparation first.');
  if (preparation.openingPlayed) throw new Error('Opening preparation is already complete.');
  const draws: number[] = [];
  if (episode === 9) {
    if (!preparation.randomAudit) throw new Error('Music Videos preparation random audit is missing.');
    const source = random;
    random = () => {
      const value = source();
      draws.push(value);
      return value;
    };
  }
  if (action.type === 'opening-cast') {
    const gaps = preparation.slots.filter((id) => id === null).length;
    if (!gaps) throw new Error('The opening cast has no vacant slots.');
    if (
      !ids(action.contestantIds) ||
      action.contestantIds.length !== gaps ||
      action.contestantIds.some(
        (id) =>
          !preparation.shortlist.includes(id) ||
          preparation.slots.includes(id) ||
          !state.contestants.some((contestant) => contestant.id === id && contestant.status === 'ACTIVE'),
      )
    )
      throw new Error(`Select exactly ${gaps} distinct active contestants from the opening shortlist.`);
    let index = 0;
    const slots = preparation.slots.map((id) => id ?? action.contestantIds[index++]);
    preparation.slots = slots;
    preparation.requiredSelections = 0;
    runtime.openingCast = [...slots];
  } else if (action.type === 'mood') {
    if (preparation.mood) throw new Error('The opening mood is already locked.');
    if (episode === 1 && preparation.requiredSelections)
      throw new Error('Select the opening cast before the Episode 1 mood.');
    if (!choices(action.choices, preparation.moodOptions))
      throw new Error('Choose one offered mood value in each of the six categories.');
    preparation.mood = { ...action.choices };
  } else if (action.type === 'randomize-mood') {
    if (preparation.mood) throw new Error('The opening mood is already locked.');
    preparation.randomizedMood = Object.fromEntries(
      FIELDS.map((field) => [field, preparation.moodOptions[field][Math.floor(random() * 2)]]),
    ) as MoodChoices;
  } else throw new Error('Unknown episode preparation action.');
  if (episode === 9 && preparation.randomAudit) {
    const audit = preparation.randomAudit;
    audit.endState = replayPreparationDraws(audit.endState, draws);
    audit.steps.push({ revision: preparation.revision, action: structuredClone(action), draws });
  }
}

function replayPreparationDraws(startState: number, draws: readonly number[]): number {
  const random = createSeededRandom(startState);
  for (const draw of draws)
    if (draw !== random.next()) throw new Error('Invalid Music Videos preparation random draws.');
  return random.getState();
}

export function validateMusicVideoPreparation(state: SimulationState): void {
  const runtime = state.runtime;
  const preparation = runtime?.preparations?.[9];
  if (!runtime || !preparation) {
    if (runtime?.musicVideo) throw new Error('Music Videos preparation is missing.');
    return;
  }
  const audit = preparation.randomAudit;
  if (
    !audit ||
    audit.version !== 1 ||
    !Array.isArray(audit.initialDraws) ||
    !Array.isArray(audit.steps) ||
    !runtime.preparations?.[8] ||
    runtime.varietyShow?.phase !== 'complete' ||
    runtime.episode < 8 ||
    (runtime.musicVideo
      ? runtime.musicVideo.randomStartState !== audit.endState
      : runtime.randomState !== audit.endState || preparation.openingPlayed)
  )
    throw new Error('Invalid Music Videos preparation boundary.');
  createSeededRandom(audit.endState);
  const replay: SimulationState = {
    ...state,
    contestants: runtime.musicVideo?.startingContestants ?? state.contestants,
    runtime: {
      ...runtime,
      episode: 8,
      phase: 'episode-complete',
      musicVideo: undefined,
      randomState: audit.startState,
      openingCast: runtime.preparations[8].slots.filter((id) => id !== null),
      preparations: { ...runtime.preparations },
    },
  };
  delete replay.runtime!.preparations![9];
  const random = createSeededRandom(audit.startState);
  const expected = initializePreparation(replay, 9, random.next);
  for (const step of audit.steps) {
    if (!object(step) || step.revision !== expected.revision || !object(step.action))
      throw new Error('Invalid Music Videos preparation action chronology.');
    applyPreparation(replay, step.action, random.next);
    expected.lastAction = { revision: expected.revision, action: structuredClone(step.action) };
    expected.revision++;
  }
  expected.openingPlayed = preparation.openingPlayed;
  if (
    JSON.stringify(expected) !== JSON.stringify(preparation) ||
    JSON.stringify(replay.runtime!.openingCast) !== JSON.stringify(runtime.openingCast)
  )
    throw new Error('Music Videos preparation does not match its seeded actions and choices.');
}

export function playOpening(state: SimulationState, episode: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9): void {
  const runtime = runtimeOf(state);
  const preparation = runtime.preparations?.[episode];
  if (!preparation) throw new Error('Initialize episode preparation first.');
  if (preparation.openingPlayed) return;
  const record =
    episode === 1
      ? runtime.audition
      : episode === 2
        ? runtime.battle
        : episode === 3
          ? runtime.bootcamp
          : episode === 4
            ? runtime.megaGroups
            : episode === 5
              ? runtime.photoshoot
              : episode === 6
                ? runtime.trackSpecials
                : episode === 7
                  ? runtime.versatility
                  : episode === 8
                    ? runtime.varietyShow
                    : runtime.musicVideo;
  if (!record) throw new Error('Start the episode before playing its opening.');
  if (
    !preparation.mood ||
    preparation.slots.length !== 5 ||
    !ids(preparation.slots) ||
    preparation.slots.some(
      (id) => !state.contestants.some((contestant) => contestant.id === id && contestant.status === 'ACTIVE'),
    )
  )
    throw new Error('The opening requires five distinct active contestants and a locked mood.');
  for (const id of preparation.slots) {
    const contestant = state.contestants.find((entry) => entry.id === id)!;
    const before = episode >= 3 ? null : structuredClone(contestant);
    contestant.aggregations.audienceRatio = Math.min(1, contestant.aggregations.audienceRatio + 0.02);
    // Later episodes capture each beat's contestant changes in their transition.
    if (before) {
      const changes = recordContestantChanges(before, contestant, `Episode ${episode} opening credits`);
      record.changes[id] ??= [];
      record.changes[id].push(...changes);
    }
  }
  preparation.openingPlayed = true;
}

export function assertPreparation(
  value: unknown,
  state: { contestants: readonly Contestant[]; runtime: SeasonRuntime },
  episode: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
): asserts value is EpisodePreparation {
  const fail = () => {
    throw new Error(`Invalid Episode ${episode} preparation.`);
  };
  if (
    !object(value) ||
    value.episode !== episode ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    typeof value.openingPlayed !== 'boolean' ||
    !object(value.moodOptions)
  )
    fail();
  if (!object(value)) return fail();
  if (
    (episode === 9 &&
      (!object(value.randomAudit) ||
        value.randomAudit.version !== 1 ||
        !Array.isArray(value.randomAudit.initialDraws) ||
        !Array.isArray(value.randomAudit.steps))) ||
    (episode !== 9 && value.randomAudit !== undefined)
  )
    fail();
  const options = value.moodOptions;
  if (!object(options) || Object.keys(options).length !== FIELDS.length) return fail();
  for (const field of FIELDS) {
    const offered = options[field];
    if (
      !ids(offered) ||
      offered.length !== 2 ||
      offered.some((id) => !Object.hasOwn(state.runtime.definitions.specialties[field], id))
    )
      fail();
  }
  const moodOptions = options as MoodOptions;
  if (
    (value.mood !== null && !choices(value.mood, moodOptions)) ||
    (value.randomizedMood !== null && !choices(value.randomizedMood, moodOptions))
  )
    fail();
  const knownIds = new Set(state.contestants.map((contestant) => contestant.id));
  if (
    !ids(value.shortlist) ||
    value.shortlist.length > 10 ||
    value.shortlist.some((id) => !knownIds.has(id)) ||
    !Array.isArray(value.slots) ||
    value.slots.length !== 5 ||
    !value.slots.every((id) => id === null || (typeof id === 'string' && knownIds.has(id)))
  )
    return fail();
  const filled = value.slots.filter((id) => id !== null);
  const gaps = 5 - filled.length;
  if (
    new Set(filled).size !== filled.length ||
    value.requiredSelections !== gaps ||
    value.shortlist.length < gaps ||
    (value.openingPlayed && (gaps !== 0 || value.mood === null))
  )
    fail();
  if (
    episode === 1 &&
    ((gaps !== 0 && gaps !== 5) ||
      filled.some((id) => !(value.shortlist as string[]).includes(id)) ||
      (value.mood !== null && gaps !== 0))
  )
    fail();
  const latest = !([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).some(
    (number) => number > episode && state.runtime.preparations?.[number],
  );
  if (
    latest &&
    gaps === 0 &&
    (!ids(state.runtime.openingCast) ||
      value.slots.some((id, index) => id !== state.runtime.openingCast?.[index]))
  )
    fail();
  const last = value.lastAction;
  if (last !== null) {
    if (
      !object(last) ||
      !Number.isSafeInteger(last.revision) ||
      (last.revision as number) < 0 ||
      (last.revision as number) > (value.revision as number) ||
      !object(last.action)
    )
      return fail();
    const action = last.action;
    if (action.type === 'mood') {
      if (!choices(action.choices, moodOptions)) fail();
    } else if (action.type === 'opening-cast') {
      if (
        !ids(action.contestantIds) ||
        action.contestantIds.length < 1 ||
        action.contestantIds.length > 5 ||
        action.contestantIds.some((id) => !(value.shortlist as string[]).includes(id))
      )
        fail();
    } else if (action.type !== 'randomize-mood') fail();
  }
}
