import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuditionDice } from '../types/audition';
import type { MusicVideoAction, MusicVideoTake } from '../types/music-video-episode';
import type { EpisodePreparation } from '../types/narrative';
import type { SimulationState } from '../types/simulation';
import type { VarietyShowEpisode } from '../types/variety-show-episode';
import { createContestant } from '../utilities/contestant-factory';
import { getMusicVideoCatalog, validateMusicVideoCatalog } from '../utilities/music-video-catalog';
import { getSimulationDefinitions } from '../utilities/simulation-definitions';
import { battleRelationship } from './battle-scoring';
import { transitionMusicVideo, validateMusicVideo } from './music-video-episode';
import {
  assessMusicVideo,
  musicVideoSlots,
  scoreMusicVideoSolo,
  scoreMusicVideoTake,
} from './music-video-scoring';

const clamp = (value: number, low = 0, high = 100) => Math.max(low, Math.min(high, value));
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const check = (level: number, dice: AuditionDice) => {
  const floor = Math.max(1, Math.min(5, 2 * level - 3));
  return 10 * (Math.max(dice[0], floor) + Math.max(dice[1], floor) - 2);
};
const grade = (value: number) =>
  value >= 85 ? 'A' : value >= 70 ? 'B' : value >= 55 ? 'C' : value >= 40 ? 'D' : 'F';
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

export function musicVideoFixture(seed = 81, reset = false): SimulationState {
  const definitions = getSimulationDefinitions();
  const contestants = Array.from({ length: 50 }, (_, index) => {
    const entry = createContestant({
      id: `mv-${index}`,
      name: `Music Performer ${index}`,
      rank: index + 1,
      status: index < 10 ? 'ACTIVE' : 'ELIMINATED',
      updatedAt: 1,
    });
    for (const field of Object.keys(entry.specialties) as (keyof typeof entry.specialties)[])
      entry.specialties[field] = Object.keys(definitions.specialties[field])[0];
    entry.aggregations.rankingScore = 200 - index;
    if (index < 10) {
      for (let other = 0; other < 10; other++) if (index !== other) entry.relationships[`mv-${other}`] = [50];
      if (reset) {
        entry.utilitySkills.stamina = 2;
        entry.utilitySkills.consistency = 1;
        entry.coreSkills.dance = 1;
        entry.coreSkills.stagePresence = 1;
      }
    }
    return entry;
  });
  const ids = contestants.slice(0, 10).map((entry) => entry.id);
  const mood = structuredClone(contestants[0].specialties);
  const opening = ids.slice(0, 5);
  // Bounded native fixture: full historical Episode 8 replay belongs to integration tests.
  const previous = {
    version: 1,
    phase: 'complete',
    survivorIds: ids,
    scenes: [],
    teams: [],
    segments: [],
  } as unknown as VarietyShowEpisode;
  const prep8: EpisodePreparation = {
    episode: 8,
    revision: 1,
    lastAction: { revision: 0, action: { type: 'mood', choices: mood } },
    moodOptions: Object.fromEntries(
      Object.entries(mood).map(([field, value]) => [field, [value, value]]),
    ) as EpisodePreparation['moodOptions'],
    mood,
    randomizedMood: null,
    shortlist: ids.slice(5),
    slots: opening,
    requiredSelections: 0,
    openingPlayed: true,
  };
  return {
    status: 'ready',
    persistenceError: null,
    createdAt: 1,
    contestants,
    runtime: {
      version: 3,
      runId: 'native-music-video',
      seed,
      randomState: seed,
      episode: 8,
      phase: 'episode-complete',
      setup: { useBias: false, selectedIds: contestants.map((entry) => entry.id) },
      sourceContestants: Object.fromEntries(contestants.map((entry) => [entry.id, structuredClone(entry)])),
      initialContestants: structuredClone(contestants),
      definitions,
      audition: null,
      varietyShow: previous,
      openingCast: opening,
      preparations: { 8: prep8 },
      show: { audience: 200, general: 200, satisfaction: 50, fans: {}, pendingAttrition: 0 },
      revealedSecrets: [],
      deferredConsequences: [],
    },
  };
}

export function nextMusicVideoAction(state: SimulationState): { action: MusicVideoAction; revision: number } {
  const ep = state.runtime!.musicVideo;
  if (ep)
    return {
      revision: ep.revision,
      action:
        ep.phase === 'secret-choice'
          ? { type: 'secret', contestantId: ep.secretCandidates[0] }
          : { type: 'advance' },
    };
  const prep = state.runtime!.preparations?.[9];
  if (!prep) return { revision: 0, action: { type: 'start' } };
  return {
    revision: prep.revision,
    action: !prep.mood
      ? {
          type: 'mood',
          choices: Object.fromEntries(
            Object.entries(prep.moodOptions).map(([field, values]) => [field, values[0]]),
          ) as NonNullable<typeof prep.mood>,
        }
      : { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) },
  };
}
function next(state: SimulationState) {
  const { action, revision } = nextMusicVideoAction(state);
  return transitionMusicVideo(state, action, revision);
}
function until(state: SimulationState, predicate: (state: SimulationState) => boolean): SimulationState {
  for (let steps = 0; steps < 85; steps++) {
    if (predicate(state)) return state;
    state = next(state);
  }
  throw new Error('Native Music Videos did not reach the requested seam.');
}
const complete = (state: SimulationState) =>
  until(state, (entry) => entry.runtime!.musicVideo?.phase === 'complete');
let noResetCache: SimulationState | undefined;
let resetCache: SimulationState | undefined;
const noResetSeason = () => (noResetCache ??= complete(musicVideoFixture()));
const resetSeason = () => (resetCache ??= complete(musicVideoFixture(81, true)));

describe('native Music Videos', () => {
  it('validates editable distinct medium sets and fixed original theme/director', () => {
    const catalog = getMusicVideoCatalog();
    validateMusicVideoCatalog(catalog);
    const duplicate = structuredClone(catalog);
    duplicate.soloSets[1] = structuredClone(duplicate.soloSets[0]);
    assert.throws(() => validateMusicVideoCatalog(duplicate));
    assert.throws(() => validateMusicVideoCatalog({ ...catalog, version: 2 }));
    assert.throws(() => validateMusicVideoCatalog({ ...catalog, soloSets: catalog.soloSets.slice(0, 9) }));
    assert.throws(() =>
      validateMusicVideoCatalog({
        ...catalog,
        soloSets: catalog.soloSets.map((entry) => ({ ...entry, difficulty: 4 })),
      }),
    );
    catalog.soloSets[0].name = 'Edited local copy';
    assert.notEqual(getMusicVideoCatalog().soloSets[0].name, catalog.soloSets[0].name);
  });

  it('independently calculates every solo face/skill combination, freeze gate and capped once-only preference', () => {
    const person = createContestant({ id: 'oracle', name: 'Oracle', updatedAt: 1 });
    for (let visual = 1; visual <= 5; visual++)
      for (let charisma = 1; charisma <= 5; charisma++)
        for (let first = 1; first <= 6; first++)
          for (let second = 1; second <= 6; second++) {
            person.coreSkills.visual = visual;
            person.utilitySkills.charisma = charisma;
            person.personality.sensitivity = 5;
            person.aggregations.audienceRatio = 0.98;
            const dice: AuditionDice = [first, second];
            const result = scoreMusicVideoSolo(person, 'rooftop', dice);
            const frozen = first + second <= 4;
            const expected = clamp(
              0.55 * check(visual, dice) + 0.45 * check(charisma, dice) - (frozen ? 10 : 0),
            );
            close(result.finalScore, expected);
            assert.equal(result.grade, grade(expected));
            assert.equal(result.frozen, frozen);
            assert.equal(result.oneTakeWonder, expected >= 85 && !frozen);
            close(result.preferenceAfter, expected >= 85 && !frozen ? 1 : 0.98);
            assert.deepEqual(result.rawDice, dice);
          }
    person.personality.sensitivity = 4;
    assert.equal(scoreMusicVideoSolo(person, 'rooftop', [1, 1]).frozen, false);
    person.personality.sensitivity = 5;
    assert.equal(scoreMusicVideoSolo(person, 'rooftop', [2, 3]).frozen, false);
    assert.equal(scoreMusicVideoSolo(person, 'rooftop', [2, 2]).stalledSeconds, 20);
  });

  it('independently calculates fatigue, overnight cost, low-stamina two/three boundary and actual reset ordinal', () => {
    const person = createContestant({ id: 'fatigue', name: 'Fatigue', updatedAt: 1 });
    for (let stamina = 1; stamina <= 5; stamina++)
      for (const overnight of [0, 1])
        for (let actual = 1; actual <= 6; actual++)
          for (const dice of [
            [1, 1],
            [2, 5],
            [6, 6],
          ] as AuditionDice[]) {
            person.utilitySkills.stamina = stamina;
            const scheduled = Math.min(5, actual);
            const result = scoreMusicVideoTake(person, dice, scheduled, actual, overnight);
            const fatigue = Math.min(12, overnight + Math.max(0, actual - 2) * (6 - stamina));
            const penalty = scheduled >= 4 && stamina < 3 ? 10 : 0;
            assert.equal(result.fatigue, fatigue);
            assert.equal(result.lowStaminaPenalty, penalty);
            close(
              result.finalScore,
              clamp(0.6 * check(3, dice) + 0.4 * check(3, dice) - 2 * fatigue - penalty),
            );
          }
    person.utilitySkills.stamina = 3;
    assert.equal(scoreMusicVideoTake(person, [6, 6], 4, 4, 1).lowStaminaPenalty, 0);
    assert.equal(scoreMusicVideoTake(person, [6, 6], 4, 5, 1).fatigue, 10);
  });

  it('requires all three real take-four failure predicates and preserves weak feet under a genuine smile', () => {
    const person = createContestant({ id: 'fumble', name: 'Fumble', updatedAt: 1 });
    person.coreSkills.dance = 1;
    person.coreSkills.stagePresence = 1;
    person.utilitySkills.consistency = 2;
    person.utilitySkills.stamina = 5;
    assert.equal(scoreMusicVideoTake(person, [2, 3], 4, 4, 0).resetFailure, true);
    assert.equal(scoreMusicVideoTake(person, [2, 5], 4, 4, 0).resetFailure, false);
    person.utilitySkills.consistency = 3;
    assert.equal(scoreMusicVideoTake(person, [1, 1], 4, 4, 0).resetFailure, false);
    person.utilitySkills.consistency = 2;
    person.coreSkills.dance = person.coreSkills.stagePresence = 5;
    assert.equal(scoreMusicVideoTake(person, [2, 3], 4, 4, 0).resetFailure, false);
    person.coreSkills.dance = person.coreSkills.stagePresence = 3;
    const above = scoreMusicVideoTake(person, [1, 5], 4, 4, 0);
    const below = scoreMusicVideoTake(person, [1, 5], 4, 4, 1);
    assert.equal(above.finalScore, 56);
    assert.equal(above.resetFailure, false);
    assert.equal(below.finalScore, 54);
    assert.equal(below.resetFailure, true);
    person.coreSkills.dance = 1;
    person.coreSkills.stagePresence = 5;
    person.personality.resilience = person.personality.investment = 5;
    const smile = scoreMusicVideoTake(person, [1, 1], 4, 4, 1);
    assert.equal(smile.idolSmile, true);
    assert.ok(smile.finalScore < 55);
    assert.ok(smile.fatigue > 0);
    assert.equal(scoreMusicVideoTake(person, [1, 1], 4, 5, 1, true).idolSmile, false);
    person.coreSkills.stagePresence = 3;
    assert.equal(scoreMusicVideoTake(person, [4, 4], 4, 4, 1).idolSmile, false);
    assert.equal(scoreMusicVideoTake(person, [4, 5], 4, 4, 1).idolSmile, true);
    assert.equal(scoreMusicVideoTake(person, [4, 5], 3, 3, 1).idolSmile, false);
  });

  it('averages the original and reset inside slot four rather than choosing the better pass', () => {
    const person = createContestant({ id: 'slots', name: 'Slots', updatedAt: 1 });
    const takes: MusicVideoTake[] = [1, 2, 3, 4, 4, 5].map((scheduled, index) => ({
      id: `oracle-${index}`,
      scheduledTake: scheduled as MusicVideoTake['scheduledTake'],
      actualOrdinal: index + 1,
      isReset: index === 4,
      failureIds: [],
      failureTieKeys: {},
      evaluations: [scoreMusicVideoTake(person, index === 3 ? [1, 1] : [6, 6], scheduled, index + 1, 0)],
    }));
    const slots = musicVideoSlots(person.id, takes, (entry) => entry.finalScore);
    close(slots[3], (takes[3].evaluations[0].finalScore + takes[4].evaluations[0].finalScore) / 2);
    assert.ok(slots[3] < takes[4].evaluations[0].finalScore);
    const solo = scoreMusicVideoSolo(person, 'rooftop', [5, 6]);
    const result = assessMusicVideo(solo, takes, true, true);
    close(result.performance, 0.4 * solo.finalScore + 0.6 * mean(slots));
    close(
      result.professionalism,
      clamp(
        0.6 * mean(musicVideoSlots(person.id, takes, (entry) => entry.checks.consistency.score)) +
          0.4 *
            mean(musicVideoSlots(person.id, takes, (entry) => entry.checks.stagePresence.score).slice(3)) +
          10,
      ),
    );
    assert.throws(() => musicVideoSlots(person.id, takes.slice(0, 5), (entry) => entry.finalScore));
  });

  it('prepares before the cold open, records ten owned proposals and withholds the takeover until sequence three', () => {
    let state = musicVideoFixture();
    state.contestants[0].personality.investment = 5;
    state.contestants[0].personality.ambition = 5;
    state.contestants[0].personality.resilience = 5;
    state = until(state, (entry) => entry.runtime!.musicVideo?.phase === 'credits');
    const ep = state.runtime!.musicVideo!;
    assert.equal(ep.storyboards.length, 10);
    assert.ok(ep.storyboards.every((entry) => entry.completed));
    assert.equal(ep.storyboards[0].overnightFatigue, 1);
    assert.equal(ep.startingPreparation.openingPlayed, false);
    assert.equal(state.runtime!.preparations![9]!.openingPlayed, true);
    assert.equal(ep.scenes.at(-1)!.sequence, 2);
    assert.ok(!JSON.stringify(ep.scenes).includes('Vivienne'));
    for (const id of ep.openingCast)
      close(
        state.contestants.find((entry) => entry.id === id)!.aggregations.audienceRatio,
        ep.startingContestants.find((entry) => entry.id === id)!.aggregations.audienceRatio + 0.02,
      );
    state = next(state);
    const reaction = state.runtime!.musicVideo!.directorReactions[0];
    assert.equal(reaction.happinessAfter, reaction.happinessBefore - 4);
    assert.equal(reaction.professionalPivot, true);
    assert.equal(state.runtime!.musicVideo!.scenes.at(-1)!.sequence, 3);
    assert.equal(state.contestants[0].aggregations.leader, 0);
  });

  it('films exactly sixty pairs without a reset and awards every full competitor exactly seven XP', () => {
    const state = noResetSeason();
    const ep = state.runtime!.musicVideo!;
    assert.equal(ep.solos.length, 10);
    assert.equal(new Set(ep.solos.map((entry) => entry.setId)).size, 10);
    assert.deepEqual(
      ep.takes.map((entry) => entry.scheduledTake),
      [1, 2, 3, 4, 5],
    );
    assert.equal(ep.takes.flatMap((entry) => entry.evaluations).length + ep.solos.length, 60);
    assert.equal(ep.reset, null);
    for (const id of ep.participantIds) {
      const before = ep.startingContestants.find((entry) => entry.id === id)!;
      const after = state.contestants.find((entry) => entry.id === id)!;
      assert.equal(after.aggregations.experience - before.aggregations.experience, 7);
      assert.deepEqual(after.coreSkills, before.coreSkills);
      assert.deepEqual(after.utilitySkills, before.utilitySkills);
      const solo = ep.solos.find((entry) => entry.contestantId === id)!;
      const sceneTV = ep.scenes.reduce(
        (sum, scene) =>
          sum + Object.values(scene.tvMoments ?? {}).reduce((total, moment) => total + (moment[id] ?? 0), 0),
        0,
      );
      assert.equal(after.aggregations.score, sceneTV + (solo.finalScore >= 85 ? 6 : 3) + 3);
    }
    validateMusicVideo(state);
  });

  it('persists all qualifying failures but permits only one reset and no retry XP', () => {
    const state = resetSeason();
    const ep = state.runtime!.musicVideo!;
    assert.deepEqual(
      ep.takes.map((entry) => entry.scheduledTake),
      [1, 2, 3, 4, 4, 5],
    );
    assert.equal(ep.takes.filter((entry) => entry.isReset).length, 1);
    assert.ok(ep.takes[3].failureIds.length > 1);
    assert.equal(ep.takes[4].isReset, true);
    assert.equal(ep.takes[4].actualOrdinal, 5);
    assert.equal(ep.takes[5].actualOrdinal, 6);
    assert.equal(ep.takes.flatMap((entry) => entry.evaluations).length + ep.solos.length, 70);
    for (const id of ep.participantIds) {
      const after = state.contestants.find((entry) => entry.id === id)!;
      assert.equal(after.aggregations.experience, 7);
      assert.equal(ep.fatigue[id], 0);
    }
  });

  it('recovers only shoot-owned conditions and bounds real critic/helper relationship effects', () => {
    let state = musicVideoFixture(81, true);
    const conditions = ['INJURED', 'RECOVERING', 'EXHAUSTED', 'DEPRESSED', 'STRESSED', 'ANXIOUS'];
    conditions.forEach((condition, index) => {
      state.contestants[index].condition = condition;
    });
    state.contestants[8].personality.ambition = 5;
    state.contestants[8].personality.gentleness = -5;
    state.contestants[9].personality.gentleness = 5;
    state = until(state, (entry) => !!entry.runtime!.musicVideo?.filmingCompleted);
    const ep = state.runtime!.musicVideo!;
    assert.equal(ep.recovered, false);
    conditions.slice(0, 4).forEach((condition, index) => {
      assert.equal(state.contestants[index].condition, condition);
    });
    assert.equal(state.contestants[4].condition, 'EXHAUSTED');
    assert.equal(state.contestants[5].condition, 'EXHAUSTED');
    if (ep.reset?.criticId)
      close(
        battleRelationship(
          state.contestants.find((entry) => entry.id === ep.reset!.criticId)!,
          ep.reset.causeId,
        ),
        48,
      );
    if (ep.reset?.supporterId)
      close(
        battleRelationship(
          state.contestants.find((entry) => entry.id === ep.reset!.supporterId)!,
          ep.reset.causeId,
        ),
        51,
      );
    assert.ok((ep.reset?.relationshipChanges.length ?? 0) <= 4);
    state = next(state);
    conditions.forEach((condition, index) => {
      assert.equal(state.contestants[index].condition, condition);
    });
    assert.ok(state.runtime!.musicVideo!.conditionChanges.every((entry) => entry.restored));
  });

  it('independently reconstructs five-focus eighty/twenty editing, real footage, all panel terms and one audience decay', () => {
    const state = resetSeason();
    const ep = state.runtime!.musicVideo!;
    const values = (id: string, field: 'result' | 'dance' | 'consistency' | 'stage') =>
      [1, 2, 3, 4, 5].map((scheduled) =>
        mean(
          ep.takes
            .filter((take) => take.scheduledTake === scheduled)
            .map((take) => {
              const e = take.evaluations.find((entry) => entry.contestantId === id)!;
              return field === 'result'
                ? e.finalScore
                : field === 'dance'
                  ? e.checks.dance.score
                  : field === 'consistency'
                    ? e.checks.consistency.score
                    : e.checks.stagePresence.score;
            }),
        ),
      );
    const quality = Object.fromEntries(
      ep.solos.map((solo) => [
        solo.contestantId,
        0.5 * solo.finalScore + 0.5 * mean(values(solo.contestantId, 'result').slice(3)),
      ]),
    );
    const cut = ep.cut!;
    const expectedFocus = [...ep.participantIds]
      .sort((a, b) => quality[b] - quality[a] || cut.tieKeys[a] - cut.tieKeys[b] || a.localeCompare(b))
      .slice(0, 5);
    assert.deepEqual(cut.featuredIds, expectedFocus);
    const weight = expectedFocus.reduce((sum, id) => sum + 1 + quality[id], 0);
    close(
      Object.values(cut.individualFocus).reduce((sum, value) => sum + value, 0),
      80,
    );
    close(
      cut.shots.reduce((sum, shot) => sum + shot.percent, 0),
      100,
    );
    close(
      Object.values(cut.presence).reduce((sum, value) => sum + value, 0),
      280,
    );
    close(
      Object.values(cut.exposure).reduce((sum, value) => sum + value, 0),
      1,
    );
    const maxVotes = Math.max(...Object.values(ep.audience!.votes));
    for (const assessment of ep.panel) {
      const id = assessment.contestantId;
      const solo = ep.solos.find((entry) => entry.contestantId === id)!;
      const late = mean(values(id, 'result').slice(3));
      const lateStage = mean(values(id, 'stage').slice(3));
      const C = mean(values(id, 'consistency'));
      const P = 0.4 * solo.finalScore + 0.6 * mean(values(id, 'result'));
      const J = mean(values(id, 'dance'));
      const M = solo.checks.charisma.score;
      const L = 0.5 * solo.checks.visual.score + 0.5 * lateStage;
      const professional = clamp(
        0.6 * C +
          0.4 * lateStage +
          (ep.directorReactions.find((entry) => entry.contestantId === id)!.professionalPivot ? 5 : 0) +
          (ep.heroSmileIds.includes(id) ? 5 : 0),
      );
      const D = 0.35 * solo.finalScore + 0.45 * late + 0.2 * professional;
      close(assessment.performance, P);
      close(assessment.john, J);
      close(assessment.megan, M);
      close(assessment.michael, L);
      close(assessment.director, D);
      close(assessment.finalScore, clamp((P + J + M + L + D) / 5));
      close(cut.individualFocus[id], expectedFocus.includes(id) ? (80 * (1 + quality[id])) / weight : 0);
      close(cut.presence[id], 20 + cut.individualFocus[id]);
      close(cut.exposure[id], cut.presence[id] / 280);
      const prior = ep.audienceContestants.find((entry) => entry.id === id)!;
      close(
        ep.sealedRankingScores[id],
        0.75 * prior.aggregations.rankingScore +
          0.6 * assessment.finalScore +
          (0.3 * 100 * ep.audience!.votes[id]) / maxVotes +
          0.1 * 50 * (prior.aggregations.productionRatio + 1),
      );
    }
    for (const shot of cut.shots)
      assert.ok(
        shot.kind === 'group'
          ? ep.takes.some((take) => take.id === shot.sourceId && take.scheduledTake >= 4)
          : ep.solos.some((solo) => `solo-${solo.contestantId}` === shot.sourceId),
      );
  });

  it('removes rank ten before nine-person MVP/investigation and preserves all fifty placements and Episode 8', () => {
    const original = musicVideoFixture();
    const state = noResetSeason();
    const ep = state.runtime!.musicVideo!;
    assert.equal(ep.eliminatedId, ep.rankedIds[9]);
    assert.equal(state.contestants.filter((entry) => entry.status === 'ACTIVE').length, 9);
    assert.equal(ep.mvpContestants.length, 9);
    assert.equal(Object.keys(ep.mvp!.ballots).length, 9);
    for (const [voter, candidate] of Object.entries(ep.mvp!.ballots)) {
      assert.notEqual(voter, candidate);
      assert.ok(ep.survivorIds.includes(voter) && ep.survivorIds.includes(candidate));
    }
    assert.ok(!ep.investigationEligibleIds.includes(ep.eliminatedId!));
    assert.equal(ep.fanTransfers.length, 1);
    const transfer = ep.fanTransfers[0];
    assert.equal(transfer.before.audience, transfer.after.audience);
    assert.equal(
      transfer.after.general + Object.values(transfer.after.fans).reduce((sum, fans) => sum + fans, 0),
      transfer.after.audience,
    );
    assert.deepEqual(
      state.contestants.slice(10).map((entry) => [entry.id, entry.rank, entry.status]),
      original.contestants.slice(10).map((entry) => [entry.id, entry.rank, entry.status]),
    );
    assert.deepEqual(state.runtime!.varietyShow, original.runtime!.varietyShow);
    assert.equal(
      ep.scenes.findIndex((entry) => entry.kind === 'mvp') >
        ep.scenes.findIndex((entry) => entry.title === 'Rank ten leaves the competition'),
      true,
    );
    assert.equal(ep.scenes.at(-2)!.title, 'The departing performer’s farewell');
    assert.equal(state.runtime!.episode, 9);
  });

  it('supports a second hidden card, fewer-than-three candidates, deferred effects and exactly-once reveal', () => {
    let state = musicVideoFixture();
    const publicId = Object.keys(state.runtime!.definitions.cards.secret)[0];
    for (const entry of state.contestants.slice(0, 10)) {
      entry.events.push(`SECRET_REVEALED:${publicId}`);
      entry.attributes = [publicId];
      state.runtime!.revealedSecrets.push({ contestantId: entry.id, cardId: publicId });
    }
    const hidden = ['mv-hidden-one', 'mv-hidden-two'];
    for (const id of hidden)
      state.runtime!.definitions.cards.secret[id] = {
        id,
        type: 'secret',
        group: 'secret',
        name: id,
        description: 'A bounded public revelation.',
        occurrence: 1,
        influences: {},
        consequence: { 'aggregations.happiness': -5, status: 'ELIMINATED', 'aggregations.rankingScore': -99 },
      };
    // Everyone has a public card; two hold another unrevealed card. At least one survives.
    for (const entry of state.contestants.slice(0, 2)) entry.attributes = [publicId, ...hidden];
    state = until(state, (entry) => entry.runtime!.musicVideo?.phase === 'secret-choice');
    const ep = state.runtime!.musicVideo!;
    assert.ok(ep.secretCandidates.length >= 1 && ep.secretCandidates.length <= 2);
    assert.deepEqual(ep.secretCandidates.slice().sort(), ep.investigationEligibleIds.slice().sort());
    const selected = ep.secretCandidates[0];
    const action: MusicVideoAction = { type: 'secret', contestantId: selected };
    const before = state.contestants.find((entry) => entry.id === selected)!;
    const revision = ep.revision;
    const changed = transitionMusicVideo(state, action, revision);
    assert.equal(changed.runtime!.musicVideo!.secret!.cardId, hidden[0]);
    assert.equal(changed.runtime!.deferredConsequences.length, 2);
    assert.equal(changed.contestants.find((entry) => entry.id === selected)!.status, 'ACTIVE');
    assert.equal(
      changed.contestants.find((entry) => entry.id === selected)!.aggregations.happiness,
      before.aggregations.happiness - 5,
    );
    assert.equal(
      changed.contestants.find((entry) => entry.id === selected)!.aggregations.rankingScore,
      before.aggregations.rankingScore,
    );
    assert.equal(transitionMusicVideo(changed, action, revision), changed);
    assert.equal(complete(changed).contestants.filter((entry) => entry.status === 'ACTIVE').length, 9);
  });

  it('permits an unbiased investigation miss without fallback and never investigates the departing performer', () => {
    let state = musicVideoFixture();
    const cardId = Object.keys(state.runtime!.definitions.cards.secret)[0];
    for (const entry of state.contestants.slice(0, 2)) entry.attributes = [cardId];
    state = until(state, (entry) => entry.runtime!.musicVideo?.phase === 'secret-choice');
    const ep = state.runtime!.musicVideo!;
    assert.equal(ep.secretCandidates.length, 3);
    const miss = ep.secretCandidates.find(
      (id) => !state.contestants.find((entry) => entry.id === id)!.attributes.length,
    )!;
    assert.ok(miss);
    const changed = transitionMusicVideo(state, { type: 'secret', contestantId: miss }, ep.revision);
    assert.equal(changed.runtime!.musicVideo!.secret!.cardId, null);
    assert.equal(changed.runtime!.revealedSecrets.length, 0);
    assert.ok(!ep.secretCandidates.includes(ep.eliminatedId!));
  });

  it('rejects corrupt dice, effects, phase, shots, RNG and illegal investigation actions', () => {
    const original = resetSeason();
    const mutations: ((state: SimulationState) => void)[] = [
      (state) => {
        const solo = state.runtime!.musicVideo!.solos[0];
        solo.rawDice = [solo.rawDice[0] === 6 ? 1 : 6, solo.rawDice[1]];
      },
      (state) => {
        state.runtime!.musicVideo!.takes[0].evaluations[0].fatigue++;
      },
      (state) => {
        state.runtime!.musicVideo!.phase = 'director';
      },
      (state) => {
        state.runtime!.musicVideo!.cut!.shots[0].sourceId = 'unfilmed';
      },
      (state) => {
        state.runtime!.musicVideo!.steps[0].drawCount++;
      },
      (state) => {
        state.runtime!.randomState = (state.runtime!.randomState + 1) >>> 0;
      },
      (state) => {
        state.contestants[0].aggregations.happiness++;
      },
      (state) => {
        state.contestants[0].aggregations.score++;
      },
      (state) => {
        state.contestants[0].aggregations.experience++;
      },
      (state) => {
        state.contestants[0].condition = 'INJURED';
      },
      (state) => {
        state.runtime!.musicVideo!.mvp!.ballots[state.runtime!.musicVideo!.survivorIds[0]] =
          state.runtime!.musicVideo!.survivorIds[0];
      },
      (state) => {
        state.runtime!.musicVideo!.audienceRandom[0] = 0.123;
      },
    ];
    for (const mutate of mutations) {
      const corrupted = structuredClone(original);
      mutate(corrupted);
      assert.throws(() => validateMusicVideo(corrupted));
    }
    const active = until(musicVideoFixture(), (entry) => entry.runtime!.musicVideo?.phase === 'solos');
    assert.throws(() =>
      transitionMusicVideo(
        active,
        { type: 'secret', contestantId: 'mv-0' },
        active.runtime!.musicVideo!.revision,
      ),
    );
    assert.throws(() =>
      transitionMusicVideo(active, { type: 'advance' }, active.runtime!.musicVideo!.revision + 1),
    );
  });

  it('JSON reloads every native beat identically and makes repeated randomize/action deliveries idempotent', () => {
    let state = transitionMusicVideo(musicVideoFixture(), { type: 'start' }, 0);
    for (let index = 0; index < 2; index++) {
      const revision = state.runtime!.preparations![9]!.revision;
      state = transitionMusicVideo(state, { type: 'randomize-mood' }, revision);
      assert.equal(transitionMusicVideo(state, { type: 'randomize-mood' }, revision), state);
      state = JSON.parse(JSON.stringify(state)) as SimulationState;
    }
    while (state.runtime!.musicVideo?.phase !== 'complete') {
      const { action, revision } = nextMusicVideoAction(state);
      const uninterrupted = transitionMusicVideo(state, action, revision);
      const reloaded = transitionMusicVideo(
        JSON.parse(JSON.stringify(state)) as SimulationState,
        action,
        revision,
      );
      assert.deepEqual(reloaded, uninterrupted);
      assert.equal(transitionMusicVideo(uninterrupted, action, revision), uninterrupted);
      state = reloaded;
    }
    validateMusicVideo(state);
  });
});
