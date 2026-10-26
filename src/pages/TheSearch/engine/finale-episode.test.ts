import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuditionDice } from '../types/audition';
import type { FinaleAction } from '../types/finale-episode';
import type { EpisodePreparation } from '../types/narrative';
import type { SimulationState } from '../types/simulation';
import type { SpecialtiesEpisode } from '../types/specialties-episode';
import type { VersatilityEpisode } from '../types/versatility-episode';
import { createContestant } from '../utilities/contestant-factory';
import { getFinaleCatalog, validateFinaleCatalog } from '../utilities/finale-songs';
import { getSimulationDefinitions } from '../utilities/simulation-definitions';
import { createFinaleTeams, draftFinalePick } from './finale-draft';
import { assertFinaleEpisode, transitionFinale, validateFinale } from './finale-episode';
import { assessFinale, finalePostSeason, rehearseFinale, scoreFinalePerformance } from './finale-scoring';
import { finaleActivityTotals } from './finale-validation';
import { createSeededRandom } from './random';

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const normalized = (level: number, difficulty: number, dice: AuditionDice) => {
  const floor = Math.max(1, Math.min(5, 2 * level - difficulty));
  return 10 * (Math.max(dice[0], floor) + Math.max(dice[1], floor) - 2);
};
export function finaleFixture(seed = 100): SimulationState {
  const definitions = getSimulationDefinitions();
  const contestants = Array.from({ length: 50 }, (_, index) =>
    createContestant({
      id: `final-${index}`,
      name: `Finale Performer ${index}`,
      rank: index + 1,
      status: index < 8 ? 'ACTIVE' : 'ELIMINATED',
      updatedAt: 1,
    }),
  );
  for (const entry of contestants) {
    for (const field of Object.keys(entry.specialties) as (keyof typeof entry.specialties)[])
      entry.specialties[field] = Object.keys(definitions.specialties[field])[0];
    entry.aggregations.rankingScore = 200 - entry.rank;
    entry.aggregations.practice = 4;
    entry.aggregations.productionRatio = entry.rank === 1 ? 1 : 0;
    entry.aggregations.happiness = 50;
    for (const other of contestants.slice(0, 8))
      if (other.id !== entry.id) entry.relationships[other.id] = [50];
  }
  const ids = contestants.slice(0, 8).map((entry) => entry.id);
  const opening = ids.slice(0, 5);
  const mood = structuredClone(contestants[0].specialties);
  // This fixture supplies only the bounded predecessor boundary. Preparation 11 and every finale action are real.
  const previous = {
    phase: 'complete',
    survivorIds: ids,
    scenes: [],
    rehearsals: [],
    performances: [],
    steps: [{ endState: seed }],
  } as unknown as SpecialtiesEpisode;
  const prep10: EpisodePreparation = {
    episode: 10,
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
      runId: 'native-finale',
      seed,
      randomState: seed,
      episode: 10,
      phase: 'episode-complete',
      setup: { useBias: false, selectedIds: contestants.map((entry) => entry.id) },
      sourceContestants: Object.fromEntries(contestants.map((entry) => [entry.id, structuredClone(entry)])),
      initialContestants: structuredClone(contestants),
      definitions,
      audition: null,
      specialties: previous,
      versatility: { guestId: definitions.doubtGirls![1].id } as VersatilityEpisode,
      openingCast: opening,
      preparations: { 10: prep10 },
      show: { audience: 200, general: 200, satisfaction: 50, fans: {}, pendingAttrition: 0 },
      revealedSecrets: [],
      deferredConsequences: [
        {
          contestantId: ids[0],
          path: 'status',
          value: 'ELIMINATED',
          cause: 'Future test consequence must not run',
        },
      ],
    },
  };
}
export function nextFinaleAction(state: SimulationState): { action: FinaleAction; revision: number } {
  const ep = state.runtime!.finale;
  if (ep)
    return {
      revision: ep.revision,
      action:
        ep.phase === 'executive-choice'
          ? { type: 'executive', contestantIds: ep.participantIds.slice(0, 3) }
          : { type: 'advance' },
    };
  const prep = state.runtime!.preparations?.[11];
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
const next = (state: SimulationState) => {
  const { action, revision } = nextFinaleAction(state);
  return transitionFinale(state, action, revision);
};
function until(state: SimulationState, predicate: (state: SimulationState) => boolean) {
  for (let step = 0; step < 80; step++) {
    if (predicate(state)) return state;
    state = next(state);
  }
  throw new Error('Finale did not reach requested boundary.');
}
let cache: SimulationState | undefined;
const completed = () =>
  (cache ??= until(finaleFixture(), (state) => state.runtime!.finale?.phase === 'complete'));

describe('native Finale independent mechanics', () => {
  it('drafts the exact snake by normalized stage/utility consistency before outgoing affection', () => {
    const state = finaleFixture();
    const cast = state.contestants.slice(0, 8);
    for (const entry of cast) {
      entry.coreSkills.stagePresence = 3;
      entry.utilitySkills.consistency = 3;
    }
    cast[2].coreSkills.stagePresence = 5;
    cast[2].utilitySkills.consistency = 5;
    cast[0].relationships[cast[3].id] = [100];
    cast[2].aggregations.productionRatio = -1;
    const random = createSeededRandom(19);
    const teams = createFinaleTeams(
      cast.map((entry) => entry.id),
      getFinaleCatalog(),
      random.next,
    );
    const picks = Array.from({ length: 6 }, (_, turn) => draftFinalePick(cast, teams, turn, random.next));
    assert.equal(picks[0].contestantId, cast[2].id);
    assert.deepEqual(
      picks.map((pick) => pick.captainId),
      [cast[0].id, cast[1].id, cast[1].id, cast[0].id, cast[0].id, cast[1].id],
    );
    for (const pick of picks) {
      const best = [...pick.eligible].sort(
        (a, b) =>
          b.ability - a.ability ||
          b.affection - a.affection ||
          a.tieKey - b.tieKey ||
          a.contestantId.localeCompare(b.contestantId),
      )[0];
      assert.equal(pick.contestantId, best.contestantId);
      for (const candidate of pick.eligible)
        close(candidate.ability, (candidate.stage + candidate.consistency) / 2);
    }
    assert.deepEqual(
      teams.map((team) => team.memberIds.length),
      [4, 4],
    );
    assert.equal(new Set(teams.flatMap((team) => team.memberIds)).size, 8);
    const catalog = getFinaleCatalog();
    catalog.originals[1].parts[1].id = catalog.originals[1].parts[0].id;
    assert.throws(() => validateFinaleCatalog(catalog));
    const draft = until(state, (entry) => entry.runtime!.finale?.draftPicks.length === 6).runtime!.finale!;
    for (const team of draft.teams) {
      assert.equal(new Set(team.parts.map((part) => part.partId)).size, 4);
      for (const part of team.parts)
        assert.equal(part.track, state.contestants.find((entry) => entry.id === part.contestantId)!.track);
    }
    assert.notEqual(draft.teams[0].songId, draft.teams[1].songId);
  });
  it('independently derives both weighted rehearsals without touching old practice', () => {
    const entry = finaleFixture().contestants[0];
    entry.utilitySkills.learning = 4;
    entry.utilitySkills.memory = 2;
    entry.utilitySkills.consistency = 3;
    entry.utilitySkills.stamina = 1;
    const before = structuredClone(entry);
    const first = rehearseFinale(entry, 1, [1, 4]);
    const second = rehearseFinale(entry, 2, [2, 1], first.readinessAfter);
    for (const result of [first, second]) {
      const sum =
        result.checks.reduce((total, check) => {
          close(check.score, normalized(check.skillLevel, 3, result.rawDice));
          const floor = Math.max(1, Math.min(5, 2 * check.skillLevel - 3));
          return (
            total + check.weight * (Math.max(result.rawDice[0], floor) + Math.max(result.rawDice[1], floor))
          );
        }, 0) / 4;
      close(result.weightedSum, sum);
      assert.equal(result.sessionPractice, Math.min(5, Math.floor(sum / 2)));
    }
    assert.equal(second.readinessAfter, Math.max(first.readinessAfter, second.sessionPractice));
    assert.deepEqual(entry, before);
  });
  it('checks conjunctive breakdown gates, same-pair checks, exact original/theme and all seven formulas', () => {
    const entry = finaleFixture().contestants[0];
    for (const key of Object.keys(entry.coreSkills) as (keyof typeof entry.coreSkills)[])
      entry.coreSkills[key] = 3;
    for (const key of Object.keys(entry.utilitySkills) as (keyof typeof entry.utilitySkills)[])
      entry.utilitySkills[key] = 2;
    entry.personality.resilience = entry.personality.ambition = 8;
    const original = scoreFinalePerformance(entry, 'new-horizon', [1, 3], 3, 'original');
    const theme = scoreFinalePerformance(entry, 'squirrel-life', [5, 4], 3, 'theme');
    assert.equal(original.breakdownPenalty, 20);
    assert.equal(scoreFinalePerformance(entry, 'new-horizon', [1, 4], 3, 'original').breakdownPenalty, 0);
    const sturdy = structuredClone(entry);
    sturdy.utilitySkills.stamina = sturdy.utilitySkills.consistency = 3;
    assert.equal(scoreFinalePerformance(sturdy, 'new-horizon', [1, 1], 3, 'original').breakdownPenalty, 0);
    for (const act of [original, theme])
      for (const check of Object.values(act.checks))
        close(check.score, normalized(check.skillLevel, act === original ? 4 : 3, act.rawDice));
    const o = original.checks;
    const h = theme.checks;
    close(
      original.technical,
      Math.max(
        0,
        0.3 * o.track.score +
          0.2 * o.stagePresence.score +
          0.25 * o.stamina.score +
          0.25 * o.consistency.score +
          6 -
          20,
      ),
    );
    close(
      theme.technical,
      Math.min(
        100,
        0.5 * h.dance.score +
          0.2 * h.stagePresence.score +
          0.15 * h.stamina.score +
          0.15 * h.consistency.score +
          6,
      ),
    );
    const assessment = assessFinale(original, theme);
    const independent = [original, theme].map((act, index) => {
      const c = act.checks;
      const primary = index ? c.dance.score : c.track.score;
      return [
        primary,
        mean([c.stagePresence.score, c.uniqueness.score, c.potential.score]),
        mean([c.visual.score, c.consistency.score, c.leadership.score]),
        0.6 * c.dance.score + 0.4 * c.consistency.score,
        0.5 * primary + 0.3 * c.stagePresence.score + 0.2 * c.uniqueness.score,
        0.6 * c.charisma.score + 0.4 * Math.min(original.technical, theme.technical),
        0.4 * c.visual.score + 0.3 * c.stamina.score + 0.3 * c.consistency.score,
      ];
    });
    Object.values(assessment.judges).forEach((judge, index) => {
      close(judge.score, (independent[0][index] + independent[1][index]) / 2);
    });
    close(
      assessment.finalScore,
      0.5 * mean([original.technical, theme.technical]) +
        0.5 * mean(independent[0].map((value, index) => (value + independent[1][index]) / 2)),
    );
    assert.equal(original.emotionalPraise, false);
    const excellent = scoreFinalePerformance(entry, 'new-horizon', [6, 6], 5, 'original');
    assert.equal(excellent.emotionalPraise, true);
    close(excellent.technical, 100);
  });
  it('derives post-season floor retention without a ledger or random mutation', () => {
    assert.equal(finalePostSeason(101, 0).retainedGroupFans, 0);
    assert.equal(finalePostSeason(101, 100).retainedGroupFans, 101);
    assert.deepEqual(finalePostSeason(101, 52.5), {
      audience: 101,
      satisfaction: 52.5,
      retainedGroupFans: 53,
      retainedShare: 53 / 101,
      nonRetainedViewers: 48,
    });
    assert.equal(finalePostSeason(0, 100).retainedShare, 0);
    assert.throws(() => finalePostSeason(10, 101));
  });
});

describe('native Finale actual-action replay', () => {
  it('supports every single-track cast without off-track or duplicate part assignments', () => {
    for (const track of ['VOCAL', 'RAP', 'DANCE'] as const) {
      const fixture = finaleFixture(72);
      for (const entry of fixture.contestants.slice(0, 8)) entry.track = track;
      const draft = until(fixture, (state) => state.runtime!.finale?.draftPicks.length === 6).runtime!
        .finale!;
      for (const team of draft.teams) {
        const template = fixture.runtime!.definitions.finaleCatalog!.originals.find(
          (song) => song.id === team.songId,
        )!;
        assert.equal(new Set(team.parts.map((part) => part.partId)).size, 4);
        for (const part of team.parts) {
          assert.equal(part.track, track);
          assert.equal(
            part.arrangement,
            template.parts.find((entry) => entry.id === part.partId)!.arrangements[track],
          );
        }
      }
    }
  });
  it('grounds clamped support in real struggles and grants at most one interaction per team', () => {
    const fixture = finaleFixture(53);
    for (const entry of fixture.contestants.slice(0, 8)) {
      entry.personality.gentleness = entry.personality.sincerity = 8;
      entry.utilitySkills.learning =
        entry.utilitySkills.memory =
        entry.utilitySkills.consistency =
        entry.utilitySkills.stamina =
          1;
      entry.aggregations.happiness = 99;
      for (const other of fixture.contestants.slice(0, 8))
        if (entry.id !== other.id) entry.relationships[other.id] = [99];
    }
    const state = until(fixture, (entry) => entry.runtime!.finale?.phase === 'executive-choice');
    const ep = state.runtime!.finale!;
    assert.ok(ep.supports.length > 0);
    assert.equal(new Set(ep.supports.map((support) => support.captainId)).size, ep.supports.length);
    for (const support of ep.supports) {
      assert.notEqual(support.helperId, support.strugglingId);
      const helper = ep.startingContestants.find((entry) => entry.id === support.helperId)!;
      assert.ok(helper.personality.gentleness >= 5 && helper.personality.sincerity >= 5);
      const rehearsal = ep.rehearsals.find(
        (entry) => entry.contestantId === support.strugglingId && entry.session === support.session,
      )!;
      assert.ok(rehearsal.readinessAfter < 4 && rehearsal.checks.some((check) => check.score < 50));
      assert.equal(support.happinessAfter, Math.min(100, support.happinessBefore + 2));
      assert.equal(support.towardHelperAfter, Math.min(100, support.towardHelperBefore + 2));
      assert.equal(support.towardMemberAfter, Math.min(100, support.towardMemberBefore + 1));
    }
  });
  it('blocks at exactly sixteen real rehearsals and applies a private capped decision once atomically', () => {
    const gate = until(finaleFixture(), (state) => state.runtime!.finale?.phase === 'executive-choice');
    const ep = gate.runtime!.finale!;
    assert.equal(ep.rehearsals.length, 16);
    assert.equal(ep.originalPerformances.length, 0);
    assert.equal(ep.executive, null);
    const frozen = JSON.stringify(gate);
    assert.throws(() => transitionFinale(gate, { type: 'advance' }, ep.revision));
    for (const contestantIds of [
      [],
      ep.participantIds.slice(0, 2),
      ep.participantIds.slice(0, 4),
      [ep.participantIds[0], ep.participantIds[0], ep.participantIds[1]],
      [...ep.participantIds.slice(0, 2), 'final-49'],
    ])
      assert.throws(() => transitionFinale(gate, { type: 'executive', contestantIds }, ep.revision));
    assert.equal(JSON.stringify(gate), frozen);
    const action: FinaleAction = { type: 'executive', contestantIds: ep.participantIds.slice(0, 3) };
    assert.throws(() => transitionFinale(gate, action, ep.revision - 1));
    const selected = transitionFinale(gate, action, ep.revision);
    assert.strictEqual(transitionFinale(selected, action, ep.revision), selected);
    assert.deepEqual(selected.runtime!.finale!.scenes, ep.scenes);
    assert.deepEqual(
      selected.runtime!.finale!.executive!.effects.map((effect) => effect.after),
      [1, 0.5, 0.5],
    );
    assert.deepEqual(
      selected.contestants.map((entry) => entry.aggregations.rankingScore),
      gate.contestants.map((entry) => entry.aggregations.rankingScore),
    );
    assert.equal(selected.runtime!.randomState, gate.runtime!.randomState);
    const reloaded = JSON.parse(JSON.stringify(selected)) as SimulationState;
    validateFinale(reloaded);
    assert.equal(JSON.stringify(next(reloaded)), JSON.stringify(next(selected)));
  });
  it('protects physical/severe/pre-existing conditions and restores only induced nerves', () => {
    const fixture = finaleFixture(24);
    const cast = fixture.contestants.slice(0, 8);
    ['INJURED', 'RECOVERING', 'EXHAUSTED', 'DEPRESSED', 'ANXIOUS', 'STABLE', 'STRESSED', 'HEALTHY'].forEach(
      (condition, index) => {
        cast[index].condition = condition;
        cast[index].personality.sensitivity = 8;
      },
    );
    const panel = until(fixture, (state) => state.runtime!.finale?.phase === 'panel-return');
    assert.deepEqual(
      panel.contestants.slice(0, 8).map((entry) => entry.condition),
      ['INJURED', 'RECOVERING', 'EXHAUSTED', 'DEPRESSED', 'ANXIOUS', 'ANXIOUS', 'ANXIOUS', 'ANXIOUS'],
    );
    assert.equal(panel.runtime!.finale!.personnel.length, 7);
    assert.equal(
      panel.runtime!.finale!.personnel[4].name,
      fixture.runtime!.definitions.doubtGirls!.find(
        (entry) => entry.id === fixture.runtime!.versatility!.guestId,
      )!.name,
    );
    const final = until(panel, (state) => state.runtime!.finale?.phase === 'complete');
    assert.deepEqual(
      final.contestants.slice(0, 8).map((entry) => entry.condition),
      cast.map((entry) => entry.condition),
    );
  });
  it('keeps executive choices out of public voting, performance checks, panel terms and random chronology', () => {
    const gate = until(finaleFixture(64), (state) => state.runtime!.finale?.phase === 'executive-choice');
    const ep = gate.runtime!.finale!;
    const first = until(
      transitionFinale(
        gate,
        { type: 'executive', contestantIds: ep.participantIds.slice(0, 3) },
        ep.revision,
      ),
      (state) => state.runtime!.finale?.phase === 'tally',
    );
    const second = until(
      transitionFinale(
        gate,
        { type: 'executive', contestantIds: ep.participantIds.slice(3, 6) },
        ep.revision,
      ),
      (state) => state.runtime!.finale?.phase === 'tally',
    );
    const a = first.runtime!.finale!;
    const b = second.runtime!.finale!;
    for (const field of [
      'originalPerformances',
      'themePerformances',
      'panel',
      'evidence',
      'exposure',
      'audience',
      'audienceRandom',
      'scenes',
    ] as const)
      assert.deepEqual(a[field], b[field]);
    assert.equal(first.runtime!.randomState, second.runtime!.randomState);
    assert.deepEqual(first.runtime!.show, second.runtime!.show);
    for (const id of ep.participantIds) {
      const personA = first.contestants.find((entry) => entry.id === id)!;
      const personB = second.contestants.find((entry) => entry.id === id)!;
      const { productionRatio: _a, ...aggregationsA } = personA.aggregations;
      const { productionRatio: _b, ...aggregationsB } = personB.aggregations;
      assert.deepEqual(aggregationsA, aggregationsB);
    }
  });
  it('continues identically after a serializable reload at every actual beat including every reveal', () => {
    let state = finaleFixture(82);
    let steps = 0;
    while (state.runtime!.finale?.phase !== 'complete') {
      const before = JSON.stringify(state);
      const restored = JSON.parse(before) as SimulationState;
      const uninterrupted = next(state);
      const reloaded = next(restored);
      assert.equal(JSON.stringify(state), before);
      assert.equal(JSON.stringify(reloaded), JSON.stringify(uninterrupted));
      state = uninterrupted;
      assert.ok(++steps < 80);
    }
    validateFinale(JSON.parse(JSON.stringify(state)));
    assert.equal(state.runtime!.finale!.revealedWinnerIds.length, 5);
  });
  it('records precisely 32 pairs, +8 XP, equal acts, full prior retention and +50 only at tally', () => {
    const state = completed();
    const ep = state.runtime!.finale!;
    assert.equal(ep.rehearsals.length + ep.originalPerformances.length + ep.themePerformances.length, 32);
    const random = createSeededRandom(ep.randomStartState);
    let sceneCursor = 1;
    let rehearsalCursor = 0;
    let originalCursor = 0;
    let themeCursor = 0;
    for (const step of ep.steps) {
      const draws = Array.from({ length: step.drawCount }, () => random.next());
      assert.equal(random.getState(), step.endState);
      if (step.action.type === 'executive') {
        assert.equal(draws.length, 0);
        continue;
      }
      const scene = ep.scenes[sceneCursor++];
      const performance =
        scene.sequence === 5
          ? ep.originalPerformances[originalCursor++]
          : scene.sequence === 6
            ? ep.themePerformances[themeCursor++]
            : null;
      const rehearsal = scene.kind === 'practice' ? ep.rehearsals[rehearsalCursor++] : null;
      const evidence = performance ?? rehearsal;
      if (!evidence) continue;
      assert.deepEqual(
        evidence.rawDice,
        draws.slice(0, 2).map((value) => 1 + Math.floor(value * 6)),
      );
      const support = rehearsal
        ? ep.supports.find(
            (record) =>
              record.strugglingId === rehearsal.contestantId && record.session === rehearsal.session,
          )
        : null;
      assert.equal(draws.length, 2 + (support ? Object.keys(support.tieKeys).length : 0));
    }
    assert.equal(rehearsalCursor + originalCursor + themeCursor, 32);
    for (const id of ep.participantIds) {
      assert.equal(ep.rehearsals.filter((record) => record.contestantId === id).length, 2);
      assert.equal(finaleActivityTotals(ep)[id].experience, 8);
      const before = ep.startingContestants.find((entry) => entry.id === id)!;
      const after = state.contestants.find((entry) => entry.id === id)!;
      assert.equal(after.aggregations.experience - before.aggregations.experience, 8);
      assert.equal(after.aggregations.practice, before.aggregations.practice);
      assert.deepEqual(after.coreSkills, before.coreSkills);
      assert.deepEqual(after.utilitySkills, before.utilitySkills);
      const c = ep.rankingComponents[id];
      close(c.total, c.prior + c.performance + c.publicVotes + c.production + c.executive);
      close(c.prior, before.aggregations.rankingScore);
      assert.equal(c.executive, ep.executive!.contestantIds.includes(id) ? 50 : 0);
      close(c.performance, 0.6 * ep.panel.find((assessment) => assessment.contestantId === id)!.finalScore);
      close(
        c.publicVotes,
        (0.3 * 100 * ep.audience!.votes[id]) / Math.max(...Object.values(ep.audience!.votes)),
      );
      close(c.production, 0.1 * 50 * (after.aggregations.productionRatio + 1));
      assert.equal(after.aggregations.mvp, before.aggregations.mvp);
    }
    assert.deepEqual(state.runtime!.revealedSecrets, ep.startingRevealedSecrets);
    assert.deepEqual(state.runtime!.deferredConsequences, ep.startingDeferredConsequences);
    const lastTheme = until(
      finaleFixture(),
      (entry) => entry.runtime!.finale?.themePerformances.length === 7,
    );
    const beforeHappiness = lastTheme.contestants.slice(0, 8).map((entry) => entry.aggregations.happiness);
    const doneTheme = next(lastTheme);
    assert.deepEqual(
      doneTheme.contestants.slice(0, 8).map((entry) => entry.aggregations.happiness),
      beforeHappiness.map((value) => Math.min(100, value + 5)),
    );
    assert.deepEqual(
      next(doneTheme)
        .contestants.slice(0, 8)
        .map((entry) => entry.aggregations.happiness),
      doneTheme.contestants.slice(0, 8).map((entry) => entry.aggregations.happiness),
    );
  });
  it('keeps standings sealed through four individual reveals, then publishes five winners and all fifty places', () => {
    let state = until(finaleFixture(), (entry) => entry.runtime!.finale?.phase === 'tally');
    const old = structuredClone(
      state.contestants.map((entry) => ({
        id: entry.id,
        rank: entry.rank,
        status: entry.status,
        points: entry.aggregations.rankingScore,
        history: entry.changeLog,
      })),
    );
    for (let revealed = 1; revealed <= 5; revealed++) {
      state = next(state);
      const ep = state.runtime!.finale!;
      assert.equal(ep.revealedWinnerIds.length, revealed);
      assert.deepEqual(ep.revealedWinnerIds, ep.winnerIds.slice(5 - revealed).reverse());
      validateFinale(JSON.parse(JSON.stringify(state)));
      if (revealed < 5) {
        assert.equal(ep.centerId, null);
        assert.equal(ep.resultsPublished, false);
        assert.deepEqual(
          state.contestants.map((entry) => ({
            id: entry.id,
            rank: entry.rank,
            status: entry.status,
            points: entry.aggregations.rankingScore,
            history: entry.changeLog,
          })),
          old,
        );
      }
    }
    const ep = state.runtime!.finale!;
    assert.equal(ep.centerId, ep.winnerIds[0]);
    assert.equal(state.contestants.filter((entry) => entry.status === 'WINNER').length, 5);
    assert.equal(state.contestants.filter((entry) => entry.status === 'ACTIVE').length, 0);
    for (const entry of state.contestants.filter((person) => !ep.participantIds.includes(person.id)))
      assert.deepEqual(
        entry,
        ep.startingContestants.find((person) => person.id === entry.id),
      );
    assert.deepEqual(
      state.contestants.map((entry) => entry.rank).sort((a, b) => a - b),
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
    for (const id of ep.participantIds) {
      const entry = state.contestants.find((person) => person.id === id)!;
      const before = ep.startingContestants.find((person) => person.id === id)!;
      assert.equal(entry.aggregations.center - before.aggregations.center, Number(id === ep.centerId));
      assert.equal(
        entry.aggregations.leader - before.aggregations.leader,
        Number(ep.teams.some((team) => team.captainId === id)),
      );
      assert.equal(entry.changeLog.filter((log) => log.episode === 11).length, 1);
    }
    const terminal = until(state, (entry) => entry.runtime!.finale?.phase === 'complete');
    assert.equal(terminal.runtime!.phase, 'season-complete');
    assert.equal(terminal.runtime!.finale!.fanTransfers.length, 1);
    assert.equal(
      terminal.runtime!.show.general +
        Object.values(terminal.runtime!.show.fans).reduce((sum, value) => sum + value, 0),
      terminal.runtime!.show.audience,
    );
    assert.deepEqual(
      terminal.runtime!.finale!.postSeason,
      finalePostSeason(terminal.runtime!.show.audience, terminal.runtime!.show.satisfaction),
    );
  });
  it('rejects altered journals, plausible extra draws, private effects, reveals and closing ledgers', () => {
    const state = completed();
    validateFinale(state);
    assertFinaleEpisode(state.runtime!.finale, state.contestants, state.runtime!.definitions);
    const attacks: ((entry: SimulationState) => void)[] = [
      (entry) => {
        entry.runtime!.finale!.steps[0].drawCount++;
      },
      (entry) => {
        const step = entry.runtime!.finale!.steps[0];
        const random = createSeededRandom(step.endState);
        random.next();
        step.drawCount++;
        step.endState = random.getState();
      },
      (entry) => {
        const performance = entry.runtime!.finale!.originalPerformances[0];
        performance.rawDice = [6, performance.rawDice[1]];
      },
      (entry) => {
        entry.runtime!.finale!.executive!.effects[0].after = -0.5;
      },
      (entry) => {
        entry.runtime!.finale!.revealedWinnerIds.reverse();
      },
      (entry) => {
        entry.runtime!.finale!.panel[0].judges.roxana.score++;
      },
      (entry) => {
        entry.runtime!.show.general++;
        entry.runtime!.show.audience++;
      },
      (entry) => {
        entry.runtime!.deferredConsequences = [];
      },
      (entry) => {
        entry.contestants[0].aggregations.experience++;
      },
      (entry) => {
        entry.contestants[0].changeLog.at(-1)!.summary = 'Forged';
      },
    ];
    for (const attack of attacks) {
      const bad = structuredClone(state);
      attack(bad);
      assert.throws(() => validateFinale(bad));
    }
    assert.throws(() => transitionFinale(state, { type: 'advance' }, state.runtime!.finale!.revision));
  });
});
