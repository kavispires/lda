import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MoodChoices } from '../types/audition-episode';
import type { Contestant, Specialties } from '../types/contestant';
import type { EpisodePreparation } from '../types/narrative';
import type { SimulationState } from '../types/simulation';
import { createContestant } from '../utilities/contestant-factory';
import { transitionAudition } from './audition-episode';
import { transitionBattle } from './battle-episode';
import { recordContestantChanges } from './change-history';
import {
  applyPreparation,
  assertPreparation,
  initializePreparation,
  playOpening,
} from './episode-preparation';
import { createSeededRandom } from './random';
import { createSeasonSetup } from './season-setup';

const FIELDS: (keyof Specialties)[] = [
  'vocalColor',
  'danceStyle',
  'rapStyle',
  'visualVibe',
  'leadershipStyle',
  'genreAffinity',
];

function fixture(): SimulationState {
  const source = Object.fromEntries(
    Array.from({ length: 55 }, (_, index) => {
      const id = `preparation-${String(index).padStart(2, '0')}`;
      return [
        id,
        createContestant({
          id,
          name: id,
          updatedAt: 1,
          track: (['VOCAL', 'RAP', 'DANCE'] as const)[index % 3],
        }),
      ];
    }),
  );
  const state: SimulationState = {
    ...createSeasonSetup(source, { seed: 45123, runId: 'preparation-test', now: 1000 }),
    status: 'ready',
    persistenceError: null,
  };
  state.runtime!.version = 1;
  const started = transitionAudition(state, { type: 'start' }, 0);
  started.runtime!.version = 2;
  for (const contestant of started.contestants) {
    for (const field of FIELDS)
      contestant.specialties[field] = Object.keys(started.runtime!.definitions.specialties[field])[0];
  }
  return started;
}

function mood(preparation: EpisodePreparation): MoodChoices {
  return Object.fromEntries(FIELDS.map((field) => [field, preparation.moodOptions[field][0]])) as MoodChoices;
}

function lock(state: SimulationState, random = createSeededRandom(89).next): EpisodePreparation {
  const preparation = initializePreparation(state, 1, random);
  applyPreparation(state, { type: 'opening-cast', contestantIds: preparation.shortlist.slice(0, 5) }, random);
  applyPreparation(state, { type: 'mood', choices: mood(preparation) }, random);
  return preparation;
}

function completed(state: SimulationState): void {
  state.runtime!.audition!.phase = 'complete';
  state.contestants.forEach((contestant, index) => {
    contestant.rank = index + 1;
    contestant.changeLog.push({
      ...structuredClone(contestant.changeLog[0]),
      phaseId: 'episode-1',
      episode: 1,
      rank: index + 1,
    });
  });
}

test('preparation freezes seeded top ten using all seven effective core skills, visual, then seeded ties', () => {
  const state = fixture();
  for (const contestant of state.contestants) {
    for (const field of Object.keys(contestant.coreSkills) as (keyof Contestant['coreSkills'])[])
      contestant.coreSkills[field] = 3;
  }
  const [leader, visual, lowerVisual] = state.contestants;
  leader.coreSkills.leadership = 5;
  visual.coreSkills.visual = 4;
  visual.coreSkills.rap = 2;
  lowerVisual.coreSkills.vocals = 4;
  lowerVisual.coreSkills.dance = 2;
  const second = structuredClone(state);
  const before = structuredClone(state);
  const random = createSeededRandom(777);
  const preparation = initializePreparation(state, 1, random.next);
  assert.deepEqual(preparation, initializePreparation(second, 1, createSeededRandom(777).next));
  assert.equal(preparation.shortlist.length, 10);
  assert.deepEqual(preparation.shortlist.slice(0, 2), [leader.id, visual.id]);
  assert.ok(
    !preparation.shortlist.includes(lowerVisual.id) || preparation.shortlist.indexOf(lowerVisual.id) > 1,
  );
  assert.deepEqual(preparation.slots, [null, null, null, null, null]);
  assert.equal(preparation.requiredSelections, 5);
  delete state.runtime!.preparations;
  assert.deepEqual(state, before);
  state.runtime!.preparations = { 1: preparation };
  assert.equal(
    initializePreparation(state, 1, () => {
      throw new Error('Rerolled');
    }),
    preparation,
  );
  assertPreparation(preparation, { contestants: state.contestants, runtime: state.runtime! }, 1);
});

test('opening selection rejects duplicates, inactive and non-shortlisted IDs; replacements preserve slots', () => {
  const state = fixture();
  const random = createSeededRandom(291).next;
  const first = initializePreparation(state, 1, random);
  assert.throws(() => applyPreparation(state, { type: 'mood', choices: mood(first) }, random), /cast/);
  assert.throws(
    () =>
      applyPreparation(
        state,
        {
          type: 'opening-cast',
          contestantIds: Array(5).fill(first.shortlist[0]),
        },
        random,
      ),
    /distinct/,
  );
  const outside = state.contestants.find((contestant) => !first.shortlist.includes(contestant.id))!;
  assert.throws(
    () =>
      applyPreparation(
        state,
        {
          type: 'opening-cast',
          contestantIds: [...first.shortlist.slice(0, 4), outside.id],
        },
        random,
      ),
    /shortlist/,
  );
  const slots = first.shortlist.slice(0, 5);
  applyPreparation(state, { type: 'opening-cast', contestantIds: slots }, random);
  slots[0] = 'mutated input';
  const original = [...state.runtime!.openingCast!];
  assert.equal(first.requiredSelections, 0);
  assert.throws(
    () =>
      applyPreparation(
        state,
        {
          type: 'opening-cast',
          contestantIds: original,
        },
        random,
      ),
    /no vacant/,
  );
  completed(state);
  for (const index of [1, 3])
    state.contestants.find((contestant) => contestant.id === original[index])!.status = 'ELIMINATED';
  const next = initializePreparation(state, 2, random);
  assert.deepEqual(next.slots, [original[0], null, original[2], null, original[4]]);
  assert.equal(next.requiredSelections, 2);
  assert.ok(next.shortlist.every((id) => !original.includes(id)));
  applyPreparation(state, { type: 'mood', choices: mood(next) }, random);
  const replacements = next.shortlist.slice(0, 2);
  const eliminated = state.contestants.find((contestant) => contestant.id === replacements[0])!;
  eliminated.status = 'ELIMINATED';
  assert.throws(
    () => applyPreparation(state, { type: 'opening-cast', contestantIds: replacements }, random),
    /active/,
  );
  eliminated.status = 'ACTIVE';
  applyPreparation(state, { type: 'opening-cast', contestantIds: replacements }, random);
  assert.deepEqual(next.slots, [original[0], replacements[0], original[2], replacements[1], original[4]]);
  assert.deepEqual(state.runtime!.openingCast, next.slots);
});

test('later moods use saved cumulative ranks among active survivors, not judge order or current rank', () => {
  const state = fixture();
  lock(state);
  completed(state);
  const ranked = [...state.contestants].sort((left, right) => left.id.localeCompare(right.id));
  const leader = ranked[1];
  const trailer = ranked[ranked.length - 2];
  ranked[0].status = 'ELIMINATED';
  ranked[ranked.length - 1].status = 'ELIMINATED';
  for (const [index, contestant] of ranked.entries()) {
    contestant.changeLog[contestant.changeLog.length - 1].rank = index + 1;
    contestant.rank = ranked.length - index;
    for (const field of FIELDS) {
      const values = Object.keys(state.runtime!.definitions.specialties[field]);
      contestant.specialties[field] = contestant === trailer ? values[1] : values[0];
    }
  }
  state.runtime!.audition!.rankedIds = [...ranked].reverse().map((contestant) => contestant.id);
  const preparation = initializePreparation(state, 2, createSeededRandom(999).next);
  for (const field of FIELDS) {
    assert.deepEqual(
      [...preparation.moodOptions[field]].sort(),
      [leader.specialties[field], trailer.specialties[field]].sort(),
    );
  }
  assert.equal(preparation.requiredSelections, preparation.slots.filter((id) => id === null).length);
  assert.deepEqual(Object.keys(preparation.moodOptions).sort(), [...FIELDS].sort());
});

test('two-value libraries support distinct initial options and same-specialty seeded fallbacks', () => {
  const state = fixture();
  const definitions = structuredClone(state.runtime!.definitions);
  state.runtime!.definitions = definitions;
  for (const field of FIELDS) {
    definitions.specialties[field] = Object.fromEntries(
      Object.entries(definitions.specialties[field]).slice(0, 2),
    );
    for (const contestant of state.contestants)
      contestant.specialties[field] = Object.keys(definitions.specialties[field])[0];
  }
  const first = lock(state);
  completed(state);
  const second = initializePreparation(state, 2, createSeededRandom(120).next);
  for (const field of FIELDS) {
    assert.equal(new Set(first.moodOptions[field]).size, 2);
    assert.deepEqual(
      [...second.moodOptions[field]].sort(),
      Object.keys(definitions.specialties[field]).sort(),
    );
  }
  const invalid = fixture();
  invalid.runtime!.definitions = structuredClone(invalid.runtime!.definitions);
  invalid.runtime!.definitions.specialties.genreAffinity = Object.fromEntries(
    Object.entries(invalid.runtime!.definitions.specialties.genreAffinity).slice(0, 1),
  );
  assert.throws(
    () =>
      initializePreparation(invalid, 1, () => {
        throw new Error('Drew before validation');
      }),
    /genreAffinity.*at least two/,
  );
  assert.equal(invalid.runtime!.preparations, undefined);
});

test('replacement pools shrink to available active candidates and saved-rank ties use stable IDs', () => {
  const state = fixture();
  const original = lock(state).slots as string[];
  completed(state);
  const retained = original.slice(0, 4);
  const extras = state.contestants.filter((contestant) => !original.includes(contestant.id)).slice(0, 2);
  const active = [...retained, ...extras.map((contestant) => contestant.id)];
  for (const contestant of state.contestants) {
    contestant.status = active.includes(contestant.id) ? 'ACTIVE' : 'ELIMINATED';
    contestant.changeLog[contestant.changeLog.length - 1].rank = 3;
  }
  const sorted = state.contestants
    .filter((contestant) => contestant.status === 'ACTIVE')
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const field of FIELDS) {
    const values = Object.keys(state.runtime!.definitions.specialties[field]);
    sorted[0].specialties[field] = values[0];
    sorted[sorted.length - 1].specialties[field] = values[1];
  }
  const preparation = initializePreparation(state, 2, createSeededRandom(600).next);
  assert.deepEqual([...preparation.shortlist].sort(), extras.map((contestant) => contestant.id).sort());
  assert.equal(preparation.requiredSelections, 1);
  for (const field of FIELDS) {
    assert.deepEqual(
      [...preparation.moodOptions[field]].sort(),
      [sorted[0].specialties[field], sorted[sorted.length - 1].specialties[field]].sort(),
    );
  }
});

test('randomize fills only persisted offered choices, never confirms or rerolls frozen options', () => {
  const state = fixture();
  const random = createSeededRandom(55).next;
  const preparation = initializePreparation(state, 1, random);
  const options = structuredClone(preparation.moodOptions);
  const shortlist = [...preparation.shortlist];
  applyPreparation(state, { type: 'randomize-mood' }, random);
  assert.equal(preparation.mood, null);
  for (const field of FIELDS) assert.ok(options[field].includes(preparation.randomizedMood![field]));
  applyPreparation(
    state,
    {
      type: 'opening-cast',
      contestantIds: preparation.shortlist.slice(0, 5),
    },
    random,
  );
  assert.throws(
    () =>
      applyPreparation(
        state,
        {
          type: 'mood',
          choices: { ...preparation.randomizedMood!, genreAffinity: 'not-offered' },
        },
        random,
      ),
    /six categories/,
  );
  applyPreparation(state, { type: 'mood', choices: preparation.randomizedMood! }, random);
  assert.deepEqual(preparation.mood, preparation.randomizedMood);
  assert.notEqual(preparation.mood, preparation.randomizedMood);
  assert.deepEqual(preparation.shortlist, shortlist);
  assert.deepEqual(preparation.moodOptions, options);
  assert.throws(() => applyPreparation(state, { type: 'randomize-mood' }, random), /locked/);
});

test('opening bonus caps at one and survives replay without fans, exposure, relationships or snapshot changes', () => {
  const state = fixture();
  const preparation = lock(state);
  const cast = preparation.slots as string[];
  state.contestants.find((contestant) => contestant.id === cast[0])!.aggregations.audienceRatio = 0.99;
  state.contestants.find((contestant) => contestant.id === cast[1])!.aggregations.audienceRatio = 1;
  const before = structuredClone(state);
  playOpening(state, 1);
  for (const contestant of state.contestants) {
    const previous = before.contestants.find((entry) => entry.id === contestant.id)!;
    assert.equal(
      contestant.aggregations.audienceRatio,
      cast.includes(contestant.id)
        ? Math.min(1, previous.aggregations.audienceRatio + 0.02)
        : previous.aggregations.audienceRatio,
    );
    assert.equal(contestant.aggregations.screenTime, previous.aggregations.screenTime);
    assert.deepEqual(contestant.relationships, previous.relationships);
    assert.ok(!Object.hasOwn(contestant.relationships, contestant.id));
    const changes = recordContestantChanges(previous, contestant, 'test');
    assert.ok(changes.every((change) => change.path === 'aggregations.audienceRatio'));
    if (changes.length) {
      assert.deepEqual(
        state.runtime!.audition!.changes[contestant.id],
        changes.map((change) => ({
          ...change,
          cause: 'Episode 1 opening credits',
        })),
      );
    }
  }
  assert.deepEqual(state.runtime!.sourceContestants, before.runtime!.sourceContestants);
  assert.deepEqual(state.runtime!.initialContestants, before.runtime!.initialContestants);
  assert.deepEqual(state.runtime!.show, before.runtime!.show);
  const played = structuredClone(state);
  playOpening(state, 1);
  assert.deepEqual(state, played);
  const reloaded = JSON.parse(JSON.stringify(state)) as SimulationState;
  playOpening(reloaded, 1);
  assert.deepEqual(reloaded, JSON.parse(JSON.stringify(played)));
  assertPreparation(preparation, { contestants: state.contestants, runtime: state.runtime! }, 1);
});

test('opening requires a locked mood and five active unique IDs, and malformed saves fail safely', () => {
  const state = fixture();
  const preparation = initializePreparation(state, 1, createSeededRandom(90).next);
  assert.throws(() => playOpening(state, 1), /five distinct active/);
  lock(state);
  const contestant = state.contestants.find((entry) => entry.id === preparation.slots[0])!;
  contestant.status = 'ELIMINATED';
  assert.throws(() => playOpening(state, 1), /active/);
  contestant.status = 'ACTIVE';
  const context = { contestants: state.contestants, runtime: state.runtime! };
  for (const invalid of [
    null,
    [],
    {},
    { ...preparation, moodOptions: null },
    { ...preparation, slots: null },
    { ...preparation, mood: {} },
    { ...preparation, lastAction: { revision: 1, action: null } },
    { ...preparation, requiredSelections: 5 },
    { ...preparation, slots: Array(5).fill(contestant.id) },
    { ...preparation, moodOptions: { ...preparation.moodOptions, vocalColor: [null, null] } },
  ]) {
    assert.throws(() => assertPreparation(invalid, context, 1), /Invalid Episode 1 preparation/);
  }
  completed(state);
  const second = initializePreparation(state, 2, createSeededRandom(15).next);
  assert.equal(second.requiredSelections, 0);
  assert.throws(
    () =>
      applyPreparation(
        state,
        {
          type: 'opening-cast',
          contestantIds: [],
        },
        createSeededRandom(1).next,
      ),
    /no vacant/,
  );
});

test('Episode 2 opening records a separate once-only bonus in battle history', () => {
  let state = fixture();
  const first = lock(state);
  playOpening(state, 1);
  completed(state);
  const cast = first.slots as string[];
  const survivors = [
    ...cast,
    ...state.contestants
      .filter((contestant) => !cast.includes(contestant.id))
      .slice(0, 25)
      .map((contestant) => contestant.id),
  ];
  for (const contestant of state.contestants)
    contestant.status = survivors.includes(contestant.id) ? 'ACTIVE' : 'ELIMINATED';
  state.runtime!.audition!.survivorIds = survivors;
  state.runtime!.phase = 'episode-complete';
  state.runtime!.version = 1;
  state = transitionBattle(state, { type: 'start' }, 0);
  state.runtime!.version = 2;
  const random = createSeededRandom(1200).next;
  const preparation = initializePreparation(state, 2, random);
  applyPreparation(state, { type: 'mood', choices: mood(preparation) }, random);
  const before = structuredClone(state);
  playOpening(state, 2);
  assert.deepEqual(state.runtime!.audition!.changes, before.runtime!.audition!.changes);
  assert.deepEqual(state.runtime!.show, before.runtime!.show);
  for (const id of cast) {
    const previous = before.contestants.find((contestant) => contestant.id === id)!;
    const current = state.contestants.find((contestant) => contestant.id === id)!;
    const changes = recordContestantChanges(previous, current, 'Episode 2 opening credits');
    assert.deepEqual(state.runtime!.battle!.changes[id], [
      ...(before.runtime!.battle!.changes[id] ?? []),
      ...changes,
    ]);
  }
  const played = structuredClone(state);
  playOpening(state, 2);
  assert.deepEqual(state, played);
});
