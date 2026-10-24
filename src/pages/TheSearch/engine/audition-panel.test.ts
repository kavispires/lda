import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuditionSong, ScoreAuditionInput } from '../types/audition';
import type { AuditionEpisode, MoodChoices } from '../types/audition-episode';
import type { SimulationState } from '../types/simulation';
import { createContestant } from '../utilities/contestant-factory';
import { resolveLiveAudition } from './audition-live';
import { applyAuditionFarewells, judgeName, scorePanelAudition } from './audition-panel';
import { scoreAudition } from './audition-scoring';
import { createSeededRandom } from './random';
import { createSeasonSetup } from './season-setup';

const song: AuditionSong = {
  id: 'panel-song',
  title: 'Panel song',
  description: 'A vocal and dance arrangement.',
  track: 'VOCAL',
  genre: 'POP',
  part: {
    testedSkills: [
      { skill: 'vocals', requiredLevel: 4 },
      { skill: 'dance', requiredLevel: 3 },
    ],
  },
};

function input(): ScoreAuditionInput {
  const contestant = createContestant({ id: 'performer', name: 'Performer', updatedAt: 1 });
  Object.assign(contestant.coreSkills, {
    vocals: 3,
    rap: 1,
    dance: 4,
    stagePresence: 3,
    visual: 4,
    uniqueness: 2,
    leadership: 3,
  });
  Object.assign(contestant.utilitySkills, { potential: 5, consistency: 2, charisma: 1 });
  return {
    contestant,
    song,
    rawDice: [1, 4],
    preferences: { visualOrUniqueness: 'visual', potentialOrCharisma: 'potential' },
    tieBreakKey: 0.25,
  };
}

function close(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} differs from ${expected}`);
}

test('song track counts three times alongside the rotating panel at two, one and one', () => {
  for (const [position, lead] of [
    [0, 'john'],
    [6, 'john'],
    [7, 'megan'],
    [14, 'michael'],
    [49, 'megan'],
  ] as const) {
    const evaluation = scorePanelAudition(input(), position);
    assert.ok(evaluation.panel);
    assert.equal(evaluation.panel.lead, lead);
    assert.deepEqual(evaluation.panel.weights, {
      john: lead === 'john' ? 2 : 1,
      megan: lead === 'megan' ? 2 : 1,
      michael: lead === 'michael' ? 2 : 1,
    });
    close(evaluation.panel.scores.john, 136 / 3);
    close(evaluation.panel.scores.megan, 160 / 3);
    close(evaluation.panel.scores.michael, 160 / 3);
    assert.equal(evaluation.panel.track?.skill, 'vocals');
    assert.equal(evaluation.panel.track?.score, 36);
    assert.equal(evaluation.panel.track?.weight, 3);
    close(evaluation.finalScore, (3 * 36 + 456 / 3 + evaluation.panel.scores[lead]) / 7);
    assert.equal(evaluation.panel.finalScore, evaluation.finalScore);
    assert.equal(evaluation.grade, 'D');
  }
  assert.equal(judgeName('john'), 'John Stan');
  assert.equal(judgeName('megan'), 'Megan Ryder');
  assert.equal(judgeName('michael'), 'Michael Lion');
  for (const position of [-1, 50, 1.5, Number.NaN]) {
    assert.throws(() => scorePanelAudition(input(), position), /position/);
  }
});

test('the separate track check follows the chosen song, including off-track rap and dance auditions', () => {
  for (const [track, skill, expected] of [
    ['VOCAL', 'vocals', 36],
    ['RAP', 'rap', 27],
    ['DANCE', 'dance', 54],
  ] as const) {
    const original = input();
    const result = scorePanelAudition(
      {
        ...original,
        song: { ...song, track, part: { testedSkills: [{ skill, requiredLevel: 4 }] } },
      },
      7,
    );
    assert.ok(result.panel?.track);
    assert.equal(result.panel.track.skill, skill);
    assert.equal(result.panel.track.score, expected);
    assert.equal(result.panel.track.requiredLevel, 4);
    assert.deepEqual(result.panel.track.adjustedDice, result.technical.checks[0].adjustedDice);
    close(
      result.finalScore,
      (3 * expected +
        result.panel.scores.john +
        2 * result.panel.scores.megan +
        result.panel.scores.michael) /
        7,
    );
  }
});

test('panel shares the legacy checks and dice, ignores preferences for grading, and comments on its own evidence', () => {
  const original = input();
  const before = structuredClone(original);
  const legacy = scoreAudition(original);
  const john = scorePanelAudition(original, 0);
  assert.deepEqual(john.technical, legacy.technical);
  assert.deepEqual(john.stagePresence, legacy.stagePresence);
  assert.deepEqual(john.impressions, legacy.impressions);
  assert.deepEqual(john.rawDice, [1, 4]);
  assert.equal(john.panel?.consistency, 30);
  assert.equal(john.panel?.leadership, 50);
  assert.deepEqual(john.panel?.consistencyCheck, {
    skill: 'consistency',
    skillLevel: 2,
    requiredLevel: 3,
    floor: 1,
    adjustedDice: [1, 4],
    deliveryFraction: 0.3,
    ceiling: 100,
    score: 30,
  });
  assert.deepEqual(john.panel?.leadershipCheck, {
    skill: 'leadership',
    skillLevel: 3,
    requiredLevel: 3,
    floor: 3,
    adjustedDice: [3, 4],
    deliveryFraction: 0.5,
    ceiling: 100,
    score: 50,
  });
  assert.match(
    john.panel?.comment ?? '',
    /strongest check was dance \(64\.0\).*weakest was vocals \(36\.0\)/,
  );
  assert.match(
    scorePanelAudition(original, 7).panel?.comment ?? '',
    /strongest check was potential \(80\.0\).*weakest was uniqueness \(30\.0\)/,
  );
  assert.match(
    scorePanelAudition(original, 14).panel?.comment ?? '',
    /strongest check was visual \(80\.0\).*weakest was consistency \(30\.0\)/,
  );
  const alternative: ScoreAuditionInput = {
    ...original,
    preferences: { visualOrUniqueness: 'uniqueness', potentialOrCharisma: 'charisma' },
  };
  assert.notEqual(scoreAudition(alternative).finalScore, legacy.finalScore);
  assert.deepEqual(scorePanelAudition(alternative, 0).panel, john.panel);
  assert.equal(scorePanelAudition(alternative, 0).grade, john.grade);
  const composed = scorePanelAudition({ ...original, composure: 1 }, 7);
  assert.equal(composed.stagePresence.score, 80);
  assert.deepEqual(composed.technical, john.technical);
  assert.deepEqual(composed.impressions, john.impressions);
  assert.equal(composed.panel?.consistency, john.panel?.consistency);
  assert.equal(composed.panel?.leadership, john.panel?.leadership);
  assert.deepEqual(composed.panel?.consistencyCheck, john.panel?.consistencyCheck);
  assert.deepEqual(composed.panel?.leadershipCheck, john.panel?.leadershipCheck);
  assert.equal(composed.panel?.scores.john, john.panel?.scores.john);
  assert.equal(composed.panel?.scores.michael, john.panel?.scores.michael);
  assert.match(
    scorePanelAudition({ ...original, rawDice: [6, 6] }, 7).panel?.comment ?? '',
    /evenly matched at 100\.0/,
  );
  assert.deepEqual(original, before);
});

test('persisted utility checks retain minimum faces and natural sixes across JSON reloads', () => {
  const original = input();
  original.contestant.utilitySkills.consistency = 5;
  original.contestant.coreSkills.leadership = 4;
  const evaluation = scorePanelAudition({ ...original, rawDice: [1, 6] }, 14);
  assert.ok(evaluation.panel);
  assert.equal(evaluation.panel.consistencyCheck.floor, 5);
  assert.equal(evaluation.panel.leadershipCheck.floor, 5);
  for (const check of [evaluation.panel.consistencyCheck, evaluation.panel.leadershipCheck]) {
    assert.deepEqual(check.adjustedDice, [5, 6]);
    assert.equal(check.deliveryFraction, 0.9);
    assert.equal(check.score, 90);
  }
  assert.equal(evaluation.panel.consistency, evaluation.panel.consistencyCheck.score);
  assert.equal(evaluation.panel.leadership, evaluation.panel.leadershipCheck.score);
  assert.deepEqual(JSON.parse(JSON.stringify(evaluation)), evaluation);
});

test('John scores only the ordered song-tested technical skills, not unused ability or star qualities', () => {
  const original = input();
  const vocalOnly = {
    ...original,
    song: { ...song, part: { testedSkills: [song.part.testedSkills[0]] } },
  };
  assert.equal(scorePanelAudition(vocalOnly, 0).panel?.scores.john, 36);
  const withNonTechnical: ScoreAuditionInput = {
    ...original,
    song: {
      ...song,
      part: { testedSkills: [...song.part.testedSkills, { skill: 'visual', requiredLevel: 5 }] },
    },
  };
  close(scorePanelAudition(withNonTechnical, 0).panel?.scores.john ?? Number.NaN, 136 / 3);
});

test('live custom scorer runs only for the actual performer without changing observer comparisons or RNG', () => {
  const contestants = [
    createContestant({ id: 'performer', name: 'Performer', updatedAt: 1 }),
    createContestant({ id: 'observer-a', name: 'Observer A', updatedAt: 1 }),
    createContestant({ id: 'observer-b', name: 'Observer B', updatedAt: 1 }),
  ];
  const legacyRandom = createSeededRandom(73);
  const panelRandom = createSeededRandom(73);
  const shared = {
    contestants,
    pool: [song],
    songChoices: Object.fromEntries(contestants.map(({ id }) => [id, song.id])),
    performerId: 'performer',
    previousEvaluations: [],
    preferences: input().preferences,
    composure: {},
  };
  const legacy = resolveLiveAudition({ ...shared, random: legacyRandom.next });
  let scorerCalls = 0;
  const modern = resolveLiveAudition({
    ...shared,
    random: panelRandom.next,
    score: (performance) => {
      scorerCalls++;
      return scorePanelAudition(performance, 14);
    },
  });
  assert.equal(scorerCalls, 1);
  assert.equal(panelRandom.getState(), legacyRandom.getState());
  assert.deepEqual(modern.reactions, legacy.reactions);
  assert.deepEqual(modern.composure, legacy.composure);
  assert.deepEqual(
    modern.contestants.map(({ relationships }) => relationships),
    legacy.contestants.map(({ relationships }) => relationships),
  );
  assert.deepEqual(modern.evaluation.technical, legacy.evaluation.technical);
  assert.ok(modern.evaluation.panel);
});

function farewellFixture() {
  const contestants = Array.from({ length: 50 }, (_, index) =>
    createContestant({
      id: `c-${index.toString().padStart(2, '0')}`,
      name: `Contestant ${index}`,
      updatedAt: 1,
    }),
  );
  const mood: MoodChoices = {
    vocalColor: '',
    danceStyle: '',
    rapStyle: '',
    visualVibe: '',
    leadershipStyle: '',
    genreAffinity: '',
  };
  const episode: AuditionEpisode = {
    version: 2,
    relationshipPolicy: 'everyone-forms-opinions',
    phase: 'eliminations',
    revision: 1,
    lastAction: { revision: 0, action: { type: 'advance' } },
    pool: [song],
    moodOptions: {
      vocalColor: [],
      danceStyle: [],
      rapStyle: [],
      visualVibe: [],
      leadershipStyle: [],
      genreAffinity: [],
    },
    mood,
    songChoices: {},
    order: contestants.map(({ id }) => id),
    cursor: 50,
    evaluations: [],
    batches: [],
    composure: {},
    reactions: [],
    scenes: [
      {
        id: 'departures',
        kind: 'eliminations',
        title: 'Departures',
        paragraphs: ['Five contestants leave.'],
        contestantIds: contestants.slice(30, 35).map(({ id }) => id),
        paragraphContestantIds: [contestants.slice(30, 35).map(({ id }) => id)],
      },
    ],
    changes: {},
    cuts: [],
    selectedCutId: null,
    audience: null,
    rankedIds: contestants.map(({ id }) => id),
    survivorIds: contestants.slice(0, 30).map(({ id }) => id),
    eliminatedIds: contestants.slice(30).map(({ id }) => id),
    revealedEliminations: 5,
    mvp: null,
    secretCandidates: [],
    secret: null,
    story: {
      sequence: 0,
      presentation: 'results',
      pendingPerformerId: null,
      exposure: {},
      creditedIds: [],
      farewellBaseline: Object.fromEntries(
        contestants.map((actor) => [
          actor.id,
          Object.fromEntries(contestants.map((departed) => [departed.id, 50])),
        ]),
      ),
      farewellAppliedIds: [],
    },
  };
  const setup = createSeasonSetup(Object.fromEntries(contestants.map((entry) => [entry.id, entry])), {
    seed: 1,
    runId: 'farewell-test',
    now: 1000,
  });
  const state: SimulationState = {
    ...setup,
    contestants,
    runtime: { ...setup.runtime, audition: episode },
    status: 'ready',
    persistenceError: null,
  };
  assert.ok(episode.story);
  const baseline = episode.story.farewellBaseline;
  const departedIds = contestants.slice(30, 35).map(({ id }) => id);
  return { state, episode, baseline, contestants, departedIds };
}

test('farewells use frozen outgoing thresholds, clamp, record every actual change, and do not reciprocate', () => {
  const { state, episode, contestants, baseline, departedIds } = farewellFixture();
  const departed = contestants[30];
  const levels = [53, 47, 52, 48, 99, 1, 100, 0];
  for (const [index, level] of levels.entries()) {
    baseline[contestants[index].id][departed.id] = level;
    contestants[index].relationships[departed.id] = [level];
    departed.relationships[contestants[index].id] = [50];
  }
  // Current direction disagrees with the frozen baseline; eligibility still uses the baseline.
  contestants[0].relationships[departed.id] = [40];
  contestants[1].relationships[departed.id] = [60];
  baseline[contestants[8].id][departed.id] = 50;
  contestants[8].relationships[departed.id] = [90];
  const departedBefore = structuredClone(departed);
  const statuses = contestants.map(({ status }) => status);
  applyAuditionFarewells(state, departedIds);
  assert.deepEqual(
    contestants.slice(0, 9).map((actor) => actor.relationships[departed.id]),
    [[40, 42], [60, 58], [52], [48], [99, 100], [1, 0], [100], [0], [90]],
  );
  assert.deepEqual(departed, departedBefore);
  assert.deepEqual(
    contestants.map(({ status }) => status),
    statuses,
  );
  const changes = Object.values(episode.changes).flat();
  assert.equal(changes.length, 4);
  assert.ok(
    changes.every(({ path, cause }) => path === `relationships.${departed.id}` && /farewell/.test(cause)),
  );
  assert.deepEqual(episode.changes[contestants[0].id][0].before, [40]);
  assert.deepEqual(episode.changes[contestants[0].id][0].after, [40, 42]);
  assert.deepEqual(episode.story?.farewellAppliedIds, departedIds);
  const snapshot = structuredClone(state);
  applyAuditionFarewells(state, [...departedIds, departedIds[0]]);
  assert.deepEqual(state, snapshot);
});

test('farewell highlights are deterministic, truthful and limited while all qualifying pairs change', () => {
  const { state, episode, contestants, baseline, departedIds } = farewellFixture();
  const departed = contestants[30];
  for (const actor of contestants.slice(0, 30)) {
    baseline[actor.id][departed.id] = actor.id === 'c-01' ? 45 : 55;
    actor.relationships[departed.id] = [baseline[actor.id][departed.id]];
  }
  episode.survivorIds.reverse();
  const older = structuredClone(episode.scenes[0]);
  older.id = 'older-departures';
  episode.scenes.unshift(older);
  applyAuditionFarewells(state, departedIds);
  assert.equal(Object.values(episode.changes).flat().length, 30);
  assert.equal(older.paragraphs.length, 1);
  const latest = episode.scenes[1];
  assert.equal(latest.paragraphs.length, 3);
  assert.match(latest.paragraphs[1], /Contestant 0 is sad.*Contestant 30/);
  assert.match(latest.paragraphs[2], /Contestant 1 feels relief.*Contestant 30/);
  assert.deepEqual(latest.paragraphContestantIds?.slice(1), [
    ['c-00', 'c-30'],
    ['c-01', 'c-30'],
  ]);
  assert.equal(latest.paragraphContestantIds?.length, latest.paragraphs.length);
  assert.ok(latest.contestantIds.includes('c-00'));
  assert.ok(latest.contestantIds.includes('c-01'));
});

test('farewells exclude self and mark departures with no qualifying connection exactly once', () => {
  const { state, episode, contestants, baseline } = farewellFixture();
  const self = contestants[0];
  baseline[self.id][self.id] = 100;
  self.relationships[self.id] = [80];
  applyAuditionFarewells(state, [self.id, self.id]);
  assert.deepEqual(self.relationships[self.id], [80]);
  assert.deepEqual(episode.changes, {});
  assert.deepEqual(episode.story?.farewellAppliedIds, [self.id]);
  assert.equal(episode.scenes[0].paragraphs.length, 1);
  delete episode.scenes[0].paragraphContestantIds;
  baseline[self.id][contestants[31].id] = 53;
  applyAuditionFarewells(state, [contestants[31].id]);
  assert.equal(episode.scenes[0].paragraphContestantIds, undefined);
});
