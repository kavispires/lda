import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuditionEvaluation, AuditionSong } from '../types/audition';
import type { AuditionReaction, MoodChoices, ShowAudience } from '../types/audition-episode';
import { createContestant } from '../utilities/contestant-factory';
import {
  chooseAuditionMvp,
  createBroadcastCuts,
  resolveBroadcast,
  resolveNarrativeAudience,
  transferEliminatedFans,
} from './audition-audience';
import { rankAuditions, scoreAudition } from './audition-scoring';
import { createSeededRandom } from './random';

const song: AuditionSong = {
  id: 'test-song',
  title: 'Test song',
  description: 'A recorded audition.',
  track: 'VOCAL',
  genre: 'POP',
  part: { testedSkills: [{ skill: 'vocals', requiredLevel: 3 }] },
};
const mood: MoodChoices = {
  vocalColor: '',
  danceStyle: '',
  rapStyle: '',
  visualVibe: '',
  leadershipStyle: '',
  genreAffinity: '',
};
const random = (seed = 7) => createSeededRandom(seed).next;

function fixture() {
  const contestants = Array.from({ length: 50 }, (_, index) =>
    createContestant({
      id: `c-${index}`,
      name: `Contestant ${index}`,
      updatedAt: 1,
      track: (['VOCAL', 'RAP', 'DANCE'] as const)[index % 3],
    }),
  );
  const evaluations = contestants.map((contestant, index) =>
    scoreAudition({
      contestant,
      song,
      rawDice: [2 + (index % 4), 3],
      preferences: { visualOrUniqueness: 'visual', potentialOrCharisma: 'potential' },
      tieBreakKey: index / 50,
    }),
  );
  const show: ShowAudience = {
    audience: 1000,
    satisfaction: 50,
    general: 1000,
    fans: {},
    pendingAttrition: 0,
  };
  const cuts = createBroadcastCuts(contestants, evaluations, [], random());
  return { contestants, evaluations, show, cuts };
}

function reaction(observerId = 'c-2', type: AuditionReaction['type'] = 'admiration'): AuditionReaction {
  return {
    observerId,
    performerId: 'c-0',
    type,
    sameSong: true,
    gap: 35,
    relationshipBefore: 50,
    relationshipAfter: type === 'admiration' ? 53 : 47,
    composureBefore: 0,
    composureAfter: -3,
    narrative: `${observerId} recorded ${type} while watching c-0.`,
  };
}

function uniformEvaluation(evaluation: AuditionEvaluation, score: number): AuditionEvaluation {
  const withScore = (check: AuditionEvaluation['stagePresence']) => ({ ...check, score });
  return {
    ...evaluation,
    technical: { ...evaluation.technical, score },
    stagePresence: withScore(evaluation.stagePresence),
    impressions: {
      visual: withScore(evaluation.impressions.visual),
      uniqueness: withScore(evaluation.impressions.uniqueness),
      potential: withScore(evaluation.impressions.potential),
      charisma: withScore(evaluation.impressions.charisma),
    },
  };
}

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} differs from ${expected}`);
}

function narrativeExposure() {
  return Object.fromEntries(
    Array.from({ length: 50 }, (_, index) => [
      `c-${index}`,
      index < 16 ? 1 / 19 : index < 28 || index >= 38 ? 1 / 228 : 1 / 190,
    ]),
  );
}

test('narrative coverage conserves audience and votes without legacy floors or a second screen-time credit', () => {
  const { contestants, evaluations, show } = fixture();
  const exposure = narrativeExposure();
  for (const contestant of contestants) {
    contestant.aggregations.screenTime = 7 + exposure[contestant.id] * 100;
  }
  show.general = 900;
  show.fans['c-0'] = 100;
  const input = { contestants, evaluations, show, exposure, mood, reactions: [], songs: [song] };
  const before = structuredClone(input);
  const result = resolveNarrativeAudience({ ...input, random: random(99) });
  assert.deepEqual(result, resolveNarrativeAudience({ ...input, random: random(99) }));
  assert.deepEqual(input, before);
  close(
    Object.values(exposure).reduce((sum, value) => sum + value, 0),
    1,
  );
  assert.equal(
    Object.values(result.outcome.votes).reduce((sum, value) => sum + value, 0),
    result.outcome.votingPopulation,
  );
  assert.equal(result.outcome.votingPopulation, result.show.audience);
  assert.equal(
    result.show.general + Object.values(result.show.fans).reduce((sum, value) => sum + value, 0),
    result.show.audience,
  );
  assert.ok(result.outcome.votes['c-0'] >= 100);
  for (const [index, contestant] of result.contestants.entries()) {
    assert.equal(contestant.aggregations.screenTime, contestants[index].aggregations.screenTime);
    close(
      contestant.aggregations.audienceRatio,
      exposure[contestant.id] * ((result.outcome.receptions[contestant.id] - 50) / 50) * 0.08,
    );
  }
  assert.ok(result.contestants.every(({ rank }) => rank > 0));
});

test('narrative audience shares legacy reception, fan, satisfaction and cumulative rules without package selection', () => {
  const { contestants, evaluations, cuts, show } = fixture();
  const shared = { contestants, evaluations, show, mood, reactions: [], songs: [song] };
  const legacy = resolveBroadcast({ ...shared, cut: cuts[0], random: random(21) });
  const modern = resolveNarrativeAudience({ ...shared, exposure: cuts[0].exposure, random: random(21) });
  assert.deepEqual(modern.show, legacy.show);
  assert.deepEqual(modern.outcome, legacy.outcome);
  assert.deepEqual(
    modern.contestants.map(({ aggregations, rank }) => ({ ...aggregations, screenTime: 0, rank })),
    legacy.contestants.map(({ aggregations, rank }) => ({ ...aggregations, screenTime: 0, rank })),
  );
});

test('only supplied shown reactions affect narrative scenes at recorded coverage, without inventing cutaways', () => {
  const { contestants, evaluations, show } = fixture();
  const shared = { contestants, evaluations, show, mood, exposure: narrativeExposure(), songs: [song] };
  const none = resolveNarrativeAudience({ ...shared, reactions: [], random: random() });
  const shown = resolveNarrativeAudience({ ...shared, reactions: [reaction()], random: random() });
  close(shown.outcome.attention - none.outcome.attention, 30 * shared.exposure['c-2']);
  close(shown.outcome.enjoyment, none.outcome.enjoyment);
  const negative = resolveNarrativeAudience({
    ...shared,
    reactions: [reaction('c-28', 'jealousy')],
    random: random(),
  });
  close(negative.outcome.attention - none.outcome.attention, 30 * shared.exposure['c-28']);
  close(none.outcome.enjoyment - negative.outcome.enjoyment, 20 * shared.exposure['c-28']);
});

test('narrative coverage requires exactly the full cast with positive normalized shares', () => {
  const { contestants, evaluations, show } = fixture();
  const input = { contestants, evaluations, show, mood, reactions: [], songs: [song], random: random() };
  const valid = narrativeExposure();
  const missing = { ...valid };
  delete missing['c-0'];
  for (const exposure of [
    missing,
    { ...valid, stranger: 0.1 },
    { ...valid, 'c-0': 0 },
    { ...valid, 'c-0': -0.1 },
    { ...valid, 'c-0': Number.NaN },
    { ...valid, 'c-0': 0.5 },
  ]) {
    assert.throws(() => resolveNarrativeAudience({ ...input, exposure }), /exposure/);
  }
});

test('three seeded cuts cover all 50, feature mandatory extremes, and preview only recorded content', () => {
  const { contestants, evaluations } = fixture();
  const reactions = [reaction()];
  const cuts = createBroadcastCuts(contestants, evaluations, reactions, random());
  assert.deepEqual(cuts, createBroadcastCuts(contestants, evaluations, reactions, random()));
  assert.deepEqual(
    cuts.map((cut) => cut.id),
    ['music', 'personalities', 'backstage'],
  );
  const ranked = rankAuditions(evaluations);
  const mandatory = [...ranked.slice(0, 2), ...ranked.slice(-2)].map((evaluation) => evaluation.contestantId);
  for (const cut of cuts) {
    assert.equal(cut.featuredIds.length, 10);
    assert.equal(new Set(cut.featuredIds).size, 10);
    for (const id of mandatory) assert.ok(cut.featuredIds.includes(id));
    assert.equal(Object.keys(cut.exposure).length, 50);
    close(
      Object.values(cut.exposure).reduce((sum, exposure) => sum + exposure, 0),
      1,
    );
    for (const contestant of contestants) {
      close(cut.exposure[contestant.id], cut.featuredIds.includes(contestant.id) ? 0.06 : 0.01);
    }
    const preview = [cut.title, cut.description, ...cut.footage.map((footage) => footage.description)].join(
      ' ',
    );
    assert.doesNotMatch(
      preview,
      /risk|enjoyment|attention|satisfaction|audienceRatio|popularity|amazing|feud|\s[+-]\d|\d+%/i,
    );
  }
  const backstage = createBroadcastCuts(contestants, evaluations, [], random())[2];
  assert.ok(backstage.footage.every((footage) => /no reaction was captured/.test(footage.description)));
  assert.throws(() => createBroadcastCuts(contestants.slice(1), evaluations, [], random()), /50/);
  assert.throws(
    () => createBroadcastCuts([...contestants.slice(1), contestants[1]], evaluations, [], random()),
    /unique/,
  );
  assert.throws(
    () => createBroadcastCuts(contestants, [...evaluations.slice(1), evaluations[1]], [], random()),
    /Duplicate/,
  );
});

test('reception uses actual deliveries and raw doubles only, never adjusted doubles or judge bonuses', () => {
  const { contestants, evaluations, cuts, show } = fixture();
  const changed = evaluations.map(
    (evaluation, index): AuditionEvaluation => ({
      ...uniformEvaluation(evaluation, 50),
      rawDice: index === 0 ? [1, 1] : index === 1 ? [6, 6] : [1, 2],
      stagePresence: { ...evaluation.stagePresence, score: 50, adjustedDice: [6, 6] },
      impressions: {
        ...uniformEvaluation(evaluation, 50).impressions,
        potential: { ...evaluation.impressions.potential, score: 100 },
      },
    }),
  );
  const before = structuredClone(changed);
  const { outcome } = resolveBroadcast({
    contestants,
    evaluations: changed,
    cut: cuts[0],
    reactions: [],
    mood,
    show,
    random: random(),
  });
  assert.equal(outcome.receptions['c-0'], 60);
  assert.equal(outcome.receptions['c-1'], 40);
  assert.equal(outcome.receptions['c-2'], 50);
  assert.deepEqual(changed, before);
  const capped = changed.map(
    (evaluation, index): AuditionEvaluation => ({
      ...uniformEvaluation(evaluation, index ? 0 : 100),
      rawDice: index ? [6, 6] : [1, 1],
    }),
  );
  const result = resolveBroadcast({
    contestants,
    evaluations: capped,
    cut: cuts[0],
    reactions: [],
    mood,
    show,
    random: random(),
  });
  assert.equal(result.outcome.receptions['c-0'], 100);
  assert.equal(result.outcome.receptions['c-1'], 0);
});

test('votes are seeded, population conserving, and never recursively use updated popularity', () => {
  const { contestants, evaluations, cuts, show } = fixture();
  contestants[0].aggregations.audienceRatio = 0.8;
  contestants[1].aggregations.fanbaseRatio = 1;
  contestants[2].aggregations.fanbaseRatio = -1;
  show.general = 900;
  show.fans['c-0'] = 100;
  const before = structuredClone({ contestants, show, evaluations, cut: cuts[0] });
  const args = { contestants, evaluations, cut: cuts[0], reactions: [], mood, show };
  const first = resolveBroadcast({ ...args, random: random(99) });
  assert.deepEqual(first, resolveBroadcast({ ...args, random: random(99) }));
  assert.deepEqual({ contestants, show, evaluations, cut: cuts[0] }, before);
  assert.equal(
    Object.values(first.outcome.votes).reduce((sum, count) => sum + count, 0),
    first.show.audience,
  );
  assert.equal(first.outcome.votingPopulation, show.audience + first.outcome.newViewers);
  assert.ok(first.outcome.votes['c-0'] >= 100);
  const generalVotes: Record<string, number> = {
    ...first.outcome.votes,
    'c-0': first.outcome.votes['c-0'] - 100,
  };
  for (const contestant of contestants) {
    const expected = Math.round(
      generalVotes[contestant.id] * 0.1 * (1 + contestant.aggregations.fanbaseRatio),
    );
    assert.equal(first.outcome.newFans[contestant.id], expected);
  }
  assert.equal(
    first.show.general + Object.values(first.show.fans).reduce((sum, count) => sum + count, 0),
    first.show.audience,
  );
  assert.ok(Object.values(first.show.fans).every(Number.isSafeInteger));

  // Independently reproduce each ballot from the ORIGINAL preference snapshot.
  const next = random(99);
  const ids = contestants.map((contestant) => contestant.id);
  const weights = ids.map((id) => cuts[0].exposure[id]);
  const expected: Record<string, number> = Object.fromEntries(ids.map((id) => [id, show.fans[id] ?? 0]));
  function draw(values: number[]): number {
    let cursor = next() * values.reduce((sum, value) => sum + value, 0);
    for (let index = 0; index < values.length; index++) {
      cursor -= values[index];
      if (cursor < 0) return index;
    }
    throw new Error('Unexpected exhausted reference draw.');
  }
  const appeals = contestants.map(
    (contestant) =>
      Math.max(1, first.outcome.receptions[contestant.id]) *
      (1 + contestant.aggregations.audienceRatio / 2) *
      1.18,
  );
  for (let viewer = 0; viewer < show.general + first.outcome.newViewers; viewer++) {
    const remaining = [...weights];
    const noticed = Array.from({ length: 3 }, () => {
      const index = draw(remaining);
      remaining[index] = 0;
      return index;
    });
    assert.equal(new Set(noticed).size, 3);
    expected[ids[noticed[draw(noticed.map((index) => appeals[index]))]]]++;
  }
  assert.deepEqual(first.outcome.votes, expected);
  const invalid = { ...show, fans: { departed: 100 } };
  assert.throws(() => resolveBroadcast({ ...args, show: invalid, random: random() }), /eligible favorite/);
});

test('growth joins general before voting; effects derive from footage rather than the cut name', () => {
  const { contestants, evaluations, cuts, show } = fixture();
  const strong = evaluations.map((evaluation) => uniformEvaluation(evaluation, 100));
  const args = { contestants, evaluations: strong, reactions: [], mood, show, cut: cuts[0] };
  const first = resolveBroadcast({ ...args, random: random() });
  const relabeled = resolveBroadcast({
    ...args,
    cut: { ...cuts[0], id: 'backstage' },
    random: random(),
  });
  assert.deepEqual(first, relabeled);
  assert.equal(first.outcome.newViewers, 60);
  assert.equal(first.outcome.votingPopulation, 1060);
  assert.equal(
    Object.values(first.outcome.votes).reduce((sum, count) => sum + count, 0),
    1060,
  );
  assert.equal(first.show.satisfaction, 60);

  const observer = cuts[0].featuredIds.find((id) => id !== 'c-0');
  assert.ok(observer);
  const negative = reaction(observer, 'jealousy');
  const withScene = {
    ...cuts[0],
    footage: cuts[0].footage.map((footage) => ({
      ...footage,
      description:
        footage.contestantId === observer
          ? `${footage.description} ${negative.narrative}`
          : footage.description,
    })),
  };
  const hidden = resolveBroadcast({ ...args, reactions: [negative], random: random() });
  const shown = resolveBroadcast({ ...args, cut: withScene, reactions: [negative], random: random() });
  assert.equal(hidden.outcome.enjoyment, first.outcome.enjoyment);
  assert.ok(shown.outcome.enjoyment < first.outcome.enjoyment);
  assert.ok(shown.outcome.attention > first.outcome.attention);
  close(shown.outcome.enjoyment, first.outcome.enjoyment - 2);
  close(shown.outcome.attention, first.outcome.attention + 3);
});

test('song metadata supplies genre diversity and missing metadata uses tracks', () => {
  const { contestants, evaluations, cuts, show } = fixture();
  const args = { contestants, evaluations, cut: cuts[0], reactions: [], mood, show };
  const tracks = resolveBroadcast({ ...args, random: random() });
  const oneGenre = resolveBroadcast({ ...args, songs: [song], random: random() });
  assert.ok(oneGenre.outcome.enjoyment < tracks.outcome.enjoyment);
  assert.equal(oneGenre.outcome.attention, tracks.outcome.attention);
  assert.throws(() => resolveBroadcast({ ...args, songs: [], random: random() }), /metadata/);
});

test('screen time, bounded popularity, cumulative contributions and ranks update without changing auditions or survival', () => {
  const { contestants, evaluations, cuts, show } = fixture();
  contestants[0].aggregations.rankingScore = 400;
  contestants[0].aggregations.screenTime = 10;
  contestants[0].aggregations.productionRatio = 2;
  contestants[0].aggregations.audienceRatio = 2;
  const grades = contestants.map((contestant) => contestant.grade);
  const before = structuredClone(evaluations);
  const result = resolveBroadcast({
    contestants,
    evaluations,
    cut: cuts[0],
    reactions: [],
    mood,
    show,
    random: random(),
  });
  const maxVotes = Math.max(...Object.values(result.outcome.votes));
  for (let index = 0; index < contestants.length; index++) {
    const contestant = result.contestants[index];
    const original = contestants[index];
    const id = contestant.id;
    close(contestant.aggregations.screenTime, original.aggregations.screenTime + cuts[0].exposure[id] * 100);
    const production = Math.min(1, original.aggregations.productionRatio);
    close(
      contestant.aggregations.rankingScore,
      0.75 * original.aggregations.rankingScore +
        0.6 * evaluations[index].finalScore +
        (0.3 * 100 * result.outcome.votes[id]) / maxVotes +
        0.1 * 50 * (production + 1),
    );
    close(
      contestant.aggregations.audienceRatio,
      Math.max(
        -1,
        Math.min(
          1,
          Math.min(1, original.aggregations.audienceRatio) +
            cuts[0].exposure[id] * ((result.outcome.receptions[id] - 50) / 50) * 0.08,
        ),
      ),
    );
    assert.equal(contestant.grade, grades[index]);
    assert.equal(contestant.status, original.status);
  }
  assert.deepEqual(evaluations, before);
  assert.deepEqual(
    result.contestants.map((contestant) => contestant.rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
  );
  result.contestants[0].coreSkills.vocals = 1;
  assert.equal(contestants[0].coreSkills.vocals, 3);
  result.show.fans['c-0'] = 99999;
  assert.deepEqual(show.fans, {});
});

test('low satisfaction schedules attrition without removing closed voters', () => {
  const { contestants, evaluations, cuts, show } = fixture();
  show.satisfaction = 5;
  const result = resolveBroadcast({
    contestants,
    evaluations: evaluations.map((evaluation) => uniformEvaluation(evaluation, 0)),
    cut: cuts[0],
    reactions: [],
    mood,
    show,
    random: random(),
  });

  assert.equal(result.show.audience, 1000);
  assert.equal(result.show.satisfaction, 0);
  assert.equal(result.show.pendingAttrition, 100);
  assert.equal(
    Object.values(result.outcome.votes).reduce((sum, count) => sum + count, 0),
    1000,
  );
  assert.throws(
    () =>
      resolveBroadcast({
        contestants,
        evaluations,
        cut: { ...cuts[0], exposure: { ...cuts[0].exposure, 'c-0': 0 } },
        reactions: [],
        mood,
        show,
        random: random(),
      }),
    /baseline/,
  );
});

test('zero viewers produce zero votes and cumulative ties follow the persisted audition ranking', () => {
  const { contestants, evaluations, cuts, show } = fixture();
  const tied = evaluations.map((evaluation) => ({
    ...uniformEvaluation(evaluation, 50),
    finalScore: 50,
  }));
  const empty = { ...show, audience: 0, general: 0 };
  const result = resolveBroadcast({
    contestants,
    evaluations: tied,
    cut: cuts[0],
    reactions: [],
    mood,
    show: empty,
    random: random(),
  });
  assert.equal(result.show.audience, 0);
  assert.ok(Object.values(result.outcome.votes).every((count) => count === 0));
  assert.deepEqual(
    [...result.contestants].sort((left, right) => left.rank - right.rank).map(({ id }) => id),
    rankAuditions(tied).map(({ contestantId }) => contestantId),
  );
  assert.ok(result.contestants.every((contestant) => contestant.aggregations.rankingScore === 35));
});

test('fan transfer uses directional final relationships, integer allocation, and seeded remainder ties', () => {
  const { contestants } = fixture();
  contestants[2].relationships['c-0'] = [100, 50];
  contestants[2].relationships['c-1'] = [50, 100];
  const show: ShowAudience = {
    audience: 1000,
    general: 798,
    fans: { 'c-0': 1, 'c-2': 101, 'c-3': 100 },
    satisfaction: 50,
    pendingAttrition: 0,
  };
  const original = structuredClone({ show, contestants });
  const transfer = transferEliminatedFans(show, contestants, ['c-0', 'c-1'], random());
  assert.deepEqual(transfer, transferEliminatedFans(show, contestants, ['c-0', 'c-1'], random()));
  assert.equal(transfer.audience, 1000);
  assert.equal(transfer.general, 839);
  assert.equal(transfer.fans['c-0'], 43);
  assert.equal(transfer.fans['c-1'], 118);
  assert.equal(transfer.fans['c-2'], 0);
  assert.equal(transfer.fans['c-3'], 0);
  assert.equal(transfer.general + Object.values(transfer.fans).reduce((sum, count) => sum + count, 0), 1000);
  assert.deepEqual({ show, contestants }, original);

  const tied: ShowAudience = { ...show, general: 998, fans: { 'c-2': 2 } };
  const first = transferEliminatedFans(tied, contestants, ['c-3', 'c-4'], () => 0.1);
  const second = transferEliminatedFans(
    tied,
    contestants,
    ['c-3', 'c-4'],
    (() => {
      let draw = 0;
      return () => (draw++ ? 0.1 : 0.9);
    })(),
  );
  assert.notDeepEqual(first.fans, second.fans);
});

test('all-survivor and no-survivor fan transfers conserve people; duplicate survivors and unknown favorites fail', () => {
  const { contestants } = fixture();
  const show: ShowAudience = {
    audience: 1000,
    general: 900,
    fans: { 'c-0': 100 },
    satisfaction: 40,
    pendingAttrition: 10,
  };
  const unchanged = transferEliminatedFans(
    show,
    contestants,
    contestants.map(({ id }) => id),
    random(),
  );
  assert.deepEqual(unchanged, show);
  assert.notEqual(unchanged.fans, show.fans);
  const none = transferEliminatedFans(show, contestants, [], random());
  assert.equal(none.general, 1000);
  assert.equal(none.audience, 1000);
  assert.equal(none.fans['c-0'], 0);
  assert.throws(() => transferEliminatedFans(show, contestants, ['c-0', 'c-0'], random()), /unique/);
  assert.throws(
    () => transferEliminatedFans({ ...show, fans: { unknown: 100 } }, contestants, [], random()),
    /departed/,
  );
});

test('all 30 survivors cast one private MVP ballot for another survivor; seeded plurality tie is persisted', () => {
  const { contestants, evaluations } = fixture();
  const survivors = contestants.slice(0, 30).map(({ id }) => id);
  const uniform = evaluations.map((evaluation) => uniformEvaluation(evaluation, 50));
  const before = structuredClone(contestants);
  // With equal weights choose one successor per voter, producing a 30-way plurality tie.
  const draws = Array.from({ length: 30 }, (_, index) => (index === 29 ? 0.5 : index + 0.5) / 29);
  function tiedRandom(tie: number) {
    let cursor = 0;
    return () => (cursor < draws.length ? draws[cursor++] : tie);
  }
  const first = chooseAuditionMvp(contestants, uniform, survivors, tiedRandom(0));
  const last = chooseAuditionMvp(contestants, uniform, survivors, tiedRandom(0.999));
  assert.equal(Object.keys(first.ballots).length, 30);
  assert.equal(
    Object.values(first.totals).reduce((sum, count) => sum + count, 0),
    30,
  );
  assert.deepEqual(first.tiedIds, survivors);
  assert.equal(first.winnerId, 'c-0');
  assert.equal(last.winnerId, 'c-29');
  for (const [voter, recipient] of Object.entries(first.ballots)) {
    assert.notEqual(voter, recipient);
    assert.ok(survivors.includes(recipient));
  }
  assert.deepEqual(contestants, before);
  assert.deepEqual(
    chooseAuditionMvp(contestants, evaluations, survivors, random()),
    chooseAuditionMvp(contestants, evaluations, survivors, random()),
  );
  assert.throws(() => chooseAuditionMvp(contestants, evaluations, survivors.slice(1), random()), /30/);
});

test('MVP ballot weights blend observed performance, directional relationships and all personality traits', () => {
  const { contestants, evaluations } = fixture();
  const survivors = contestants.slice(0, 30).map(({ id }) => id);
  const changed = evaluations.map((evaluation, index) => uniformEvaluation(evaluation, (index % 3) * 40));
  for (let index = 0; index < 30; index++) {
    const contestant = contestants[index];
    for (const trait of Object.keys(contestant.personality) as (keyof typeof contestant.personality)[]) {
      contestant.personality[trait] = index % 2 ? 10 : -10;
    }
    for (const id of survivors) contestant.relationships[id] = [25, index % 2 ? 90 : 10];
  }
  const draw = 0.61;
  const result = chooseAuditionMvp(contestants, changed, survivors, () => draw);
  for (let voterIndex = 0; voterIndex < 30; voterIndex++) {
    const eligible = survivors.filter((_, index) => index !== voterIndex);
    const weights = eligible.map((id) => {
      const candidateIndex = contestants.findIndex((contestant) => contestant.id === id);
      const observed = (candidateIndex % 3) * 40;
      const relationship = voterIndex % 2 ? 90 : 10;
      const affinity = candidateIndex % 2 === voterIndex % 2 ? 100 : 0;
      return 0.4 * observed + 0.4 * relationship + 0.2 * affinity;
    });
    let cursor = draw * weights.reduce((sum, weight) => sum + weight, 0);
    const expected = eligible.find((_, index) => {
      cursor -= weights[index];
      return cursor < 0;
    });
    assert.equal(result.ballots[survivors[voterIndex]], expected);
  }
});
