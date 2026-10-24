import type { MoodChoices, MoodOptions } from '../types/audition-episode';
import type { Contestant, CoreSkills, Specialties } from '../types/contestant';
import type { EpisodePreparation, PreparationAction } from '../types/narrative';
import { isNarrativeSeason, type SeasonRuntime, type SimulationState } from '../types/simulation';
import { recordContestantChanges } from './change-history';
import { type RandomSource, shuffleWithRandom } from './random';

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
  episode: 1 | 2 | 3,
  random: RandomSource,
): EpisodePreparation {
  const runtime = runtimeOf(state);
  const existing = runtime.preparations?.[episode];
  if (existing) return existing;
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
  const previousRanking = episode === 3 ? runtime.battle!.finalRankedIds : null;
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
    runtime.preparations?.[3] && runtime.battle?.phase === 'complete'
      ? 3
      : runtime.battle
        ? 2
        : runtime.audition?.phase === 'complete'
          ? 2
          : 1;
  const preparation = runtime.preparations?.[episode];
  if (!preparation) throw new Error('Initialize episode preparation first.');
  if (preparation.openingPlayed) throw new Error('Opening preparation is already complete.');
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
}

export function playOpening(state: SimulationState, episode: 1 | 2 | 3): void {
  const runtime = runtimeOf(state);
  const preparation = runtime.preparations?.[episode];
  if (!preparation) throw new Error('Initialize episode preparation first.');
  if (preparation.openingPlayed) return;
  const record = episode === 1 ? runtime.audition : episode === 2 ? runtime.battle : runtime.bootcamp;
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
    const before = episode === 3 ? null : structuredClone(contestant);
    contestant.aggregations.audienceRatio = Math.min(1, contestant.aggregations.audienceRatio + 0.02);
    // Boot Camp captures every beat's contestant changes in its transition.
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
  episode: 1 | 2 | 3,
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
  const latest = !([1, 2, 3] as const).some(
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
