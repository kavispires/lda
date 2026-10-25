import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { AuditionAction, MoodChoices } from '../types/audition-episode';
import type { BattleAction } from '../types/battle-episode';
import type { EpisodePreparation } from '../types/narrative';
import type { SimulationState } from '../types/simulation';
import { createContestant } from '../utilities/contestant-factory';
import { getSimulationDefinitions } from '../utilities/simulation-definitions';
import { MOOD_FIELDS } from './audition-episode';
import { auditionGrade } from './audition-scoring';
import { completedAuditionsFixture, nextBattleAction } from './battle-fixtures';
import { transitionNarrativeAudition, transitionNarrativeBattle } from './narrative-audition';
import { createSeasonSetup } from './season-setup';
import { decodeSimulationState, encodeSimulationState } from './simulation-persistence';

function setup(formatVersion: 2 | 3 = 2): SimulationState {
  const definitions = getSimulationDefinitions();
  const source = Object.fromEntries(
    Array.from({ length: 65 }, (_, index) => {
      const id = `narrative-${index}`;
      const contestant = createContestant({
        id,
        name: `Artist ${index}`,
        updatedAt: 1,
        track: (['VOCAL', 'RAP', 'DANCE'] as const)[index % 3],
      });
      contestant.coreSkills.vocals = 1 + (index % 5);
      contestant.coreSkills.dance = 1 + ((index + 2) % 5);
      contestant.personality.gentleness = (index % 11) - 5;
      for (const field of MOOD_FIELDS) {
        const choices = Object.keys(definitions.specialties[field]);
        contestant.specialties[field] = choices[index % choices.length];
      }
      return [id, contestant];
    }),
  );
  return {
    ...createSeasonSetup(source, { seed: 12345, runId: 'narrative-test', now: 1000, formatVersion }),
    status: 'ready',
    persistenceError: null,
  };
}

function mood(prep: EpisodePreparation): MoodChoices {
  return {
    vocalColor: prep.moodOptions.vocalColor[0],
    danceStyle: prep.moodOptions.danceStyle[0],
    rapStyle: prep.moodOptions.rapStyle[0],
    visualVibe: prep.moodOptions.visualVibe[0],
    leadershipStyle: prep.moodOptions.leadershipStyle[0],
    genreAffinity: prep.moodOptions.genreAffinity[0],
  };
}

function nextAction(state: SimulationState): AuditionAction {
  const ep = state.runtime?.audition;
  if (!ep) return { type: 'start' };
  const prep = state.runtime?.preparations?.[1];
  assert.ok(prep);
  if (ep.phase === 'opening-cast') return { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, 5) };
  if (ep.phase === 'mood') return { type: 'mood', choices: mood(prep) };
  if (ep.phase === 'secret') return { type: 'secret', contestantId: ep.secretCandidates[0] };
  return { type: 'advance' };
}

function battleAction(state: SimulationState) {
  const ep = state.runtime?.battle;
  const prep = state.runtime?.preparations?.[2];
  const action: BattleAction =
    !ep && prep
      ? prep.mood
        ? { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) }
        : { type: 'mood', choices: mood(prep) }
      : nextBattleAction(state);
  return { action, revision: ep?.revision ?? prep?.revision ?? 0 };
}

function play(initial: SimulationState, reload: boolean) {
  let state = initial;
  for (let count = 0; count < 80 && state.runtime?.audition?.phase !== 'complete'; count++) {
    const action = nextAction(state);
    const revision = state.runtime?.audition?.revision ?? 0;
    const before = structuredClone(state);
    const next = transitionNarrativeAudition(state, action, revision);
    if (state.runtime?.audition?.phase === 'mvp' && !state.runtime.audition.mvp) {
      assert.equal(next.runtime?.audition?.phase, 'mvp', 'MVP gets its own beat before the secret dialog');
      assert.ok(next.runtime?.audition?.mvp);
    }
    assert.deepEqual(state, before, 'story beats do not mutate their input');
    assert.equal(
      transitionNarrativeAudition(next, action, revision),
      next,
      'duplicate actions do not replay a beat',
    );
    state = reload ? decodeSimulationState(JSON.stringify(next)) : next;
  }
  assert.equal(state.runtime?.audition?.phase, 'complete');
  return state;
}

test('narrative Auditions plays all fifty in the exact story schedule and survives every reload', () => {
  const initial = setup();
  const direct = play(initial, false);
  const restored = play(initial, true);
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(direct)));
  const ep = restored.runtime?.audition;
  assert.ok(ep?.story);
  assert.equal(ep.version, 2);
  assert.equal(ep.scoringVersion, undefined);
  assert.equal(ep.evaluations.length, 50);
  const performances = ep.scenes.filter(({ kind }) => kind === 'auditions');
  assert.deepEqual(
    performances.map(({ contestantIds }) => contestantIds.length),
    [1, 1, 1, 12, 1, 1, 1, 1, 1, 10, 1, 1, 1, 1, 1, 12, 1, 1, 1],
  );
  assert.equal(
    ep.scenes.filter(({ title }) => title.startsWith('Meet ') && title !== 'Meet the judges').length,
    16,
  );
  assert.equal(
    ep.scenes.filter(({ kind }) => kind === 'choices').length,
    16,
    'there is no upfront song board',
  );
  assert.equal(ep.cuts.length, 0);
  assert.equal(ep.selectedCutId, null);
  assert.ok(ep.audience);
  assert.equal(ep.scenes.filter(({ kind }) => kind === 'broadcast' || kind === 'audience').length, 0);
  assert.equal(ep.survivorIds.length, 30);
  assert.equal(ep.eliminatedIds.length, 20);
  assert.deepEqual(ep.story.farewellAppliedIds, ep.eliminatedIds);
  assert.equal(ep.story.creditedIds.length, 50);
  assert.ok(Math.abs(Object.values(ep.story.exposure).reduce((a, b) => a + b, 0) - 1) < 1e-12);
  for (const contestant of restored.contestants) {
    const original = initial.contestants.find(({ id }) => id === contestant.id);
    assert.ok(original);
    assert.ok(
      Math.abs(
        contestant.aggregations.screenTime -
          original.aggregations.screenTime -
          100 * ep.story.exposure[contestant.id],
      ) < 1e-9,
    );
    assert.ok(!Object.hasOwn(contestant.relationships, contestant.id));
    assert.equal(contestant.changeLog.filter(({ episode }) => episode === 1).length, 1);
  }
  assert.deepEqual(
    ep.evaluations.map((entry) => entry.panel?.lead),
    Array.from(
      { length: 50 },
      (_, index) => (['john', 'megan', 'michael'] as const)[Math.floor(index / 7) % 3],
    ),
  );
});

test('new current-format auditions freeze the gentler scale and preserve it across every beat and compressed reload', () => {
  const finished = play(setup(3), true);
  const ep = finished.runtime?.audition;
  assert.ok(ep);
  assert.equal(ep.scoringVersion, 2);
  for (const entry of ep.evaluations) {
    assert.ok(entry.panel?.rawFinalScore !== undefined);
    assert.equal(entry.finalScore, entry.panel.rawFinalScore + 0.2 * (100 - entry.panel.rawFinalScore));
    assert.equal(entry.grade, auditionGrade(entry.finalScore));
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(decodeSimulationState(encodeSimulationState(finished)))),
    JSON.parse(JSON.stringify(finished)),
  );
});

test('already-started current-format auditions keep original grades and the original scale for remaining performers', () => {
  let state = transitionNarrativeAudition(setup(3), { type: 'start' }, 0);
  assert.ok(state.runtime?.audition);
  delete state.runtime.audition.scoringVersion;
  while (!state.runtime?.audition?.evaluations.length)
    state = transitionNarrativeAudition(state, nextAction(state), state.runtime?.audition?.revision ?? 0);
  const first = structuredClone(state.runtime.audition.evaluations[0]);
  const resumed = play(decodeSimulationState(encodeSimulationState(state)), false);
  const ep = resumed.runtime?.audition;
  assert.ok(ep);
  assert.deepEqual(ep.evaluations[0], first);
  assert.equal(ep.scoringVersion, undefined);
  for (const entry of ep.evaluations) {
    const panel = entry.panel;
    assert.ok(panel?.track);
    assert.equal(panel.rawFinalScore, undefined);
    assert.equal(
      entry.finalScore,
      (3 * panel.track.score +
        panel.scores.john +
        panel.scores.megan +
        panel.scores.michael +
        panel.scores[panel.lead]) /
        7,
    );
  }
  assert.doesNotThrow(() => decodeSimulationState(encodeSimulationState(resumed)));
});

test('calibrated audition saves reject unknown models, mixed scales and damaged raw or final evidence', () => {
  let state = setup(3);
  while (!state.runtime?.audition?.evaluations.length)
    state = transitionNarrativeAudition(state, nextAction(state), state.runtime?.audition?.revision ?? 0);
  for (const damage of ['model', 'missing-model', 'raw', 'missing-raw', 'track', 'final'] as const) {
    const invalid = structuredClone(state);
    const ep = invalid.runtime?.audition;
    const entry = ep?.evaluations[0];
    assert.ok(ep && entry?.panel?.rawFinalScore !== undefined);
    if (damage === 'model') Reflect.set(ep, 'scoringVersion', 3);
    if (damage === 'missing-model') delete ep.scoringVersion;
    if (damage === 'raw') entry.panel.rawFinalScore++;
    if (damage === 'missing-raw') delete entry.panel.rawFinalScore;
    if (damage === 'track') delete entry.panel.track;
    if (damage === 'final') {
      const finalScore = entry.finalScore + 0.2 * (100 - entry.finalScore);
      ep.evaluations[0] = {
        ...entry,
        finalScore,
        grade: auditionGrade(finalScore),
        panel: { ...entry.panel, finalScore },
      };
    }
    assert.throws(() => decodeSimulationState(JSON.stringify(invalid)), /narrative Auditions/);
  }
});

test('featured introductions reveal public identity before resolving their performance, not secret cards', () => {
  let state = setup();
  while (state.runtime?.audition?.phase !== 'judges')
    state = transitionNarrativeAudition(state, nextAction(state), state.runtime?.audition?.revision ?? 0);
  const firstId = state.runtime?.audition?.order[0];
  const actor = state.contestants.find(({ id }) => id === firstId);
  assert.ok(actor);
  Object.assign(actor.personality, { sensitivity: -5, resilience: 5, gentleness: 6, maturity: -6 });
  state = transitionNarrativeAudition(state, { type: 'advance' }, state.runtime?.audition?.revision ?? 0);
  const ep = state.runtime?.audition;
  assert.ok(ep?.story);
  assert.equal(ep.cursor, 0);
  assert.equal(ep.evaluations.length, 0);
  const first = state.contestants.find(({ id }) => id === ep.order[0]);
  assert.ok(first);
  const introduction = ep.scenes.at(-1)?.paragraphs.join(' ');
  assert.ok(introduction?.includes(first.name));
  const track = first.track[0] + first.track.slice(1).toLowerCase();
  assert.ok(introduction?.includes(`he chose the <Tag>${track}</Tag> track`));
  const cards = state.runtime?.definitions.cards;
  assert.ok(cards);
  const persona = cards.persona[first.persona];
  assert.ok(introduction?.includes(`${persona.description} <Tag>${persona.name}</Tag>`));
  for (const id of first.attributes) {
    const card = cards.identity[id] ?? cards.interest[id];
    if (card) assert.ok(introduction?.includes(`${card.description} <Tag>${card.name}</Tag>`));
    const secret = cards.secret[id];
    if (secret) {
      assert.ok(!introduction?.includes(secret.description));
      assert.ok(!introduction?.includes(`<Tag>${secret.name}</Tag>`));
    }
  }
  assert.ok(!introduction?.includes('SECRET_'));
  assert.ok(introduction?.includes('gentleness +6'));
  assert.ok(introduction?.includes('maturity -6'));
  assert.ok(!introduction?.includes('sensitivity -5'));
  assert.ok(!introduction?.includes('resilience +5'));
  const next = transitionNarrativeAudition(state, { type: 'advance' }, ep.revision);
  assert.equal(next.runtime?.audition?.cursor, 1);
  assert.equal(next.runtime?.audition?.story?.presentation, 'performance');
  assert.ok(next.runtime?.audition?.evaluations[0].panel?.comment);
});

test('modern Group Battles prepares its own mood and plays credits after dorms, before ranking', () => {
  const initial = play(setup(), false);
  let state = initial;
  const originalCast = state.runtime?.openingCast;
  assert.ok(originalCast);
  let credits = 0;
  for (let step = 0; step < 120 && state.runtime?.battle?.phase !== 'complete'; step++) {
    const before = structuredClone(state);
    const runtime = state.runtime;
    assert.ok(runtime);
    const ep = runtime.battle;
    const { action, revision } = battleAction(state);
    const next = transitionNarrativeBattle(state, action, revision);
    assert.deepEqual(state, before);
    assert.equal(
      transitionNarrativeBattle(next, action, revision),
      next,
      'retries do not repeat preparation or battle effects',
    );
    if (!ep && next.runtime?.battle) {
      const locked = next.runtime.preparations?.[2];
      assert.ok(locked?.mood);
      for (const [index, id] of originalCast.entries()) {
        if (runtime.audition?.survivorIds.includes(id)) assert.equal(locked.slots[index], id);
      }
    }
    if (next.runtime?.battle?.scenes.at(-1)?.title === 'Opening credits') {
      credits++;
      assert.equal(next.runtime.battle.roomCursor, 5);
      assert.equal(next.runtime.battle.phase, 'dorms');
      assert.equal(
        transitionNarrativeBattle(next, action, revision),
        next,
        'credits retries do not repeat the bonus',
      );
    }
    state = decodeSimulationState(JSON.stringify(next));
  }
  assert.equal(credits, 1);
  assert.equal(state.runtime?.battle?.phase, 'complete');
  assert.equal(state.contestants.filter(({ status }) => status === 'ACTIVE').length, 18);
  assert.ok(state.runtime?.preparations?.[2]?.openingPlayed);
  let direct = initial;
  for (let count = 0; count < 120 && direct.runtime?.battle?.phase !== 'complete'; count++) {
    const { action, revision } = battleAction(direct);
    direct = transitionNarrativeBattle(direct, action, revision);
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(state)),
    JSON.parse(JSON.stringify(direct)),
    'all battle actions resume identically after reload',
  );
});

test('saved panel-only results remain unchanged while subsequent auditions use the song-track weight', () => {
  let state = setup();
  while (!state.runtime?.audition?.evaluations.length)
    state = transitionNarrativeAudition(state, nextAction(state), state.runtime?.audition?.revision ?? 0);
  const ep = state.runtime?.audition;
  assert.ok(ep);
  const result = ep.evaluations[0];
  assert.ok(result.panel);
  const panel = structuredClone(result.panel);
  delete panel.track;
  const score =
    (panel.scores.john + panel.scores.megan + panel.scores.michael + panel.scores[panel.lead]) / 4;
  panel.finalScore = score;
  ep.evaluations[0] = { ...result, panel, finalScore: score, grade: auditionGrade(score) };
  const performer = state.contestants.find(({ id }) => id === result.contestantId);
  assert.ok(performer);
  performer.grade = auditionGrade(score);
  state = decodeSimulationState(JSON.stringify(state));
  assert.equal(state.runtime?.audition?.evaluations[0].finalScore, score);
  assert.equal(state.runtime?.audition?.evaluations[0].panel?.track, undefined);
  for (let step = 0; step < 2; step++)
    state = transitionNarrativeAudition(state, { type: 'advance' }, state.runtime?.audition?.revision ?? 0);
  assert.equal(state.runtime?.audition?.evaluations[1].panel?.track?.weight, 3);
  assert.doesNotThrow(() => decodeSimulationState(JSON.stringify(state)));
});

test('new narrative state rejects damaged coverage, judge blocks and missing preparation; legacy stays version 1', () => {
  const finished = play(setup(), false);
  for (const damage of [
    (state: SimulationState) => {
      if (state.runtime) delete state.runtime.preparations;
    },
    (state: SimulationState) => {
      const ep = state.runtime?.audition;
      if (ep?.story) ep.story.exposure[ep.order[0]] = 0.5;
    },
    (state: SimulationState) => {
      const panel = state.runtime?.audition?.evaluations[7].panel;
      if (panel) panel.lead = 'john';
    },
    (state: SimulationState) => {
      const ep = state.runtime?.audition;
      const result = ep?.evaluations[0];
      const panel = result?.panel;
      if (ep && result && panel?.track)
        ep.evaluations[0] = {
          ...result,
          panel: { ...panel, track: { ...panel.track, weight: 2 } },
        };
    },
  ]) {
    const invalid = structuredClone(finished);
    damage(invalid);
    assert.throws(() => decodeSimulationState(JSON.stringify(invalid)));
  }
  const legacy = completedAuditionsFixture();
  const restored = decodeSimulationState(JSON.stringify(legacy));
  assert.equal(restored.runtime?.version, 1);
  assert.equal(restored.runtime?.audition?.version, 1);
  assert.equal(restored.runtime?.preparations, undefined);
});

test('failed storage keeps narrative choice, random state and published revision unchanged', () => {
  const previous = simulationStore.state;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    let state = setup();
    state = transitionNarrativeAudition(state, { type: 'start' }, 0);
    const ep = state.runtime?.audition;
    const prep = state.runtime?.preparations?.[1];
    assert.ok(ep && prep);
    state = transitionNarrativeAudition(
      state,
      { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, 5) },
      ep.revision,
    );
    simulationStore.setState(() => state);
    const revision = state.runtime?.audition?.revision;
    assert.notEqual(revision, undefined);
    if (revision === undefined) assert.fail('Missing episode revision');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          setItem() {
            throw new Error('storage unavailable');
          },
        },
      },
    });
    assert.throws(
      () => simulationActions.dispatchAudition({ type: 'randomize-mood' }, revision),
      /storage unavailable/,
    );
    assert.equal(simulationStore.state, state);
  } finally {
    simulationStore.setState(() => previous);
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
