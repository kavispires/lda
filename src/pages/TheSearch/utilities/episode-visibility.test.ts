import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transitionBattle } from '../engine/battle-episode';
import { advanceBattleTo, completedAuditionsFixture } from '../engine/battle-fixtures';
import { advanceBootcampTo, completedBattlesForBootcamp } from '../engine/bootcamp-fixtures';
import { transitionBattleStory } from '../engine/narrative-battle';
import {
  advanceBattleStoryTo,
  narrativeBattleFixture,
  nextBattleStoryAction,
} from '../engine/narrative-battle-fixtures';
import { decodeSimulationState } from '../engine/simulation-persistence';
import type { BattleStory } from '../types/battle-episode';
import type { AttributeCard } from '../types/common';
import type { SeasonRuntime } from '../types/simulation';
import { createContestant } from './contestant-factory';
import { isSeasonRankingVisible, projectEpisodeContestant, projectSeasonCast } from './episode-visibility';

const card: AttributeCard = {
  id: 'SECRET_TEST',
  type: 'SECRET',
  group: 'history',
  name: 'Private biography',
  description: 'An undisclosed past',
  occurrence: 1,
  influences: {},
};

function fixture() {
  const contestant = createContestant({ id: 'one', name: 'One', updatedAt: 1 });
  contestant.attributes = ['PUBLIC', card.id];
  contestant.events = ['PUBLIC_EVENT', card.id];
  contestant.rank = 7;
  contestant.aggregations.rankingScore = 123;
  contestant.changeLog = [
    {
      episode: 1,
      rank: 7,
      score: 76.4321,
      missionRating: 4,
      status: contestant.status,
      summary: `A performance; ${card.name}`,
      events: ['AUDITION', card.id],
      change: {
        rank: 7,
        'aggregations.rankingScore': 123,
        snapshot: {
          attributes: [card.id, { description: card.description }],
          aggregations: { rankingScore: 123, happiness: 60 },
          rank: 7,
        },
      },
      changes: [
        { path: 'rank', before: 0, after: 7, cause: 'Standings' },
        { path: 'aggregations.rankingScore', before: 0, after: 123, cause: 'Contribution' },
        {
          path: 'aggregations',
          before: { rankingScore: 0 },
          after: { rankingScore: 123, happiness: 60 },
          cause: 'Update',
        },
        {
          path: 'attributes',
          after: [card.id, 'PUBLIC'],
          cause: `Assigned ${card.name}: ${card.description}`,
        },
        { path: `events.${card.id}`, after: card.description, cause: card.id },
      ],
    },
  ];
  const runtime: SeasonRuntime = {
    version: 1,
    runId: 'visibility',
    seed: 1,
    randomState: 1,
    episode: 1,
    phase: 'auditions',
    setup: { useBias: false, selectedIds: ['one'] },
    sourceContestants: { one: contestant },
    initialContestants: [contestant],
    definitions: {
      cards: { persona: {}, identity: {}, interest: {}, secret: { [card.id]: card } },
      specialties: {
        vocalColor: {},
        danceStyle: {},
        rapStyle: {},
        visualVibe: {},
        leadershipStyle: {},
        genreAffinity: {},
      },
      zodiacSigns: {},
      auditionSongs: [],
    },
    audition: null,
    show: { audience: 100, satisfaction: 50, general: 100, fans: {}, pendingAttrition: 0 },
    revealedSecrets: [],
    deferredConsequences: [],
  };
  return { contestant, runtime };
}

test('simulation projection removes unrevealed secret identities from attributes, events and nested history', () => {
  const { contestant, runtime } = fixture();
  const before = structuredClone(contestant);
  const projected = projectEpisodeContestant(contestant, runtime);
  assert.deepEqual(projected.attributes, ['PUBLIC']);
  assert.deepEqual(projected.events, ['PUBLIC_EVENT']);
  assert.deepEqual(projected.changeLog[0].events, ['AUDITION']);
  for (const token of [card.id, card.name, card.description]) {
    assert.equal(JSON.stringify(projected).includes(token), false, token);
  }
  assert.equal(JSON.stringify(projected).includes('[unrevealed]'), false);
  assert.equal(
    projected.changeLog[0].changes?.some((change) => change.path.startsWith('events.')),
    false,
  );
  assert.deepEqual(contestant, before);
  projected.coreSkills.vocals = 5;
  projected.changeLog[0].events.push('EDIT');
  assert.deepEqual(contestant, before);
});

test('only the selected contestant’s revealed secret becomes inspectable', () => {
  const { contestant, runtime } = fixture();
  runtime.revealedSecrets = [{ contestantId: 'someone-else', cardId: card.id }];
  assert.equal(projectEpisodeContestant(contestant, runtime).attributes.includes(card.id), false);
  runtime.revealedSecrets.push({ contestantId: contestant.id, cardId: card.id });
  const projected = projectEpisodeContestant(contestant, runtime);
  assert.ok(projected.attributes.includes(card.id));
  assert.ok(projected.events.includes(card.id));
  assert.ok(projected.changeLog[0].summary.includes(card.name));
});

test('cumulative rankings and nested score changes are hidden without concealing judged audition scores', () => {
  const { contestant, runtime } = fixture();
  const projected = projectEpisodeContestant(contestant, runtime);
  assert.equal(projected.rank, 0);
  assert.equal(projected.aggregations.rankingScore, 0);
  assert.equal(projected.changeLog[0].rank, 0);
  assert.equal(projected.changeLog[0].score, 76.4321);
  assert.equal('rank' in projected.changeLog[0].change, false);
  assert.equal('aggregations.rankingScore' in projected.changeLog[0].change, false);
  assert.deepEqual(projected.changeLog[0].change.snapshot, {
    attributes: [],
    aggregations: { happiness: 60 },
  });
  assert.deepEqual(projected.changeLog[0].changes?.find((change) => change.path === 'aggregations')?.after, {
    happiness: 60,
  });
  assert.equal(
    projected.changeLog[0].changes?.some(
      (change) => change.path === 'rank' || change.path === 'aggregations.rankingScore',
    ),
    false,
  );
  contestant.changeLog[0].episode = 0;
  assert.equal(projectEpisodeContestant(contestant, runtime).changeLog[0].score, 0);
});

function battleStory(): BattleStory {
  return {
    stage: 'captains',
    sequence: 3,
    draftPick: 0,
    pairingCursor: 0,
    reviewCursor: 0,
    departureCursor: 0,
    interventions: {},
    exposure: {},
    creditedTeamIds: [],
    matchupReactions: [],
    rankReactions: [],
    rankRevealed: false,
    backlashApplied: false,
  };
}

test('new battles hide full ranks until the closing reveal and never publish initial ranks through history', () => {
  const { contestant, runtime } = fixture();
  const started = transitionBattle(completedAuditionsFixture(), { type: 'start' }, 0);
  assert.ok(started.runtime?.battle);
  runtime.version = 3;
  runtime.battle = started.runtime.battle;
  runtime.battle.participantIds = [contestant.id];
  runtime.battle.survivorIds = [contestant.id];
  runtime.battle.story = battleStory();
  runtime.battle.phase = 'ranking';
  assert.equal(isSeasonRankingVisible(runtime), false);
  assert.equal(projectEpisodeContestant(contestant, runtime).rank, 0);
  assert.equal(projectSeasonCast([contestant], runtime)[0].rank, 0);
  assert.equal(projectEpisodeContestant(contestant, runtime).aggregations.rankingScore, 0);
  runtime.battle.story.rankRevealed = true;
  const revealed = projectEpisodeContestant(contestant, runtime);
  assert.equal(isSeasonRankingVisible(runtime), true);
  assert.equal(revealed.rank, contestant.rank);
  assert.equal(revealed.aggregations.rankingScore, contestant.aggregations.rankingScore);
  assert.equal(revealed.changeLog[0].rank, 0);
  assert.equal('rank' in revealed.changeLog[0].change, false);
  assert.deepEqual(revealed.changeLog[0].change.snapshot, {
    attributes: [],
    aggregations: { happiness: 60 },
  });
  assert.equal(isSeasonRankingVisible({ battle: { phase: 'ranking' } }), true);
  assert.equal(isSeasonRankingVisible({ battle: { phase: 'dorms' } }), false);
});

test('season cast ranks include all fifty contestants after the reveal, including eliminated contestants', () => {
  const state = completedBattlesForBootcamp();
  const runtime = state.runtime!;
  const original = JSON.stringify(state);
  const projected = projectSeasonCast(state.contestants, runtime);
  assert.deepEqual(
    projected.map((person) => person.rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
    'Everyone has a unique season position, including the contestants eliminated in Episodes 1 and 2.',
  );
  const departed = projected.filter((person) => person.status === 'ELIMINATED');
  assert.equal(departed.length, 32);
  for (const person of departed) {
    const isAuditionDeparture = runtime.audition!.eliminatedIds.includes(person.id);
    assert.ok(isAuditionDeparture ? person.rank >= 31 : person.rank >= 19 && person.rank <= 30);
    assert.ok(
      person.changeLog
        .filter((entry) => entry.status === 'ELIMINATED')
        .every((entry) => entry.rank === person.rank),
    );
  }
  const closed = advanceBootcampTo(state, 'relief');
  const sealed = projectSeasonCast(closed.contestants, closed.runtime!);
  assert.deepEqual(
    sealed.map((person) => person.rank),
    projected.map((person) => person.rank),
  );
  const final = advanceBootcampTo(closed, 'complete');
  const updated = projectSeasonCast(final.contestants, final.runtime!);
  for (const person of departed)
    assert.equal(updated.find((entry) => entry.id === person.id)?.rank, person.rank);
  for (const [index, id] of final.runtime!.bootcamp!.rankedIds.entries())
    assert.equal(updated.find((person) => person.id === id)?.rank, index + 1);
  assert.equal(JSON.stringify(state), original);
});

test('existing saved seasons recover locked season placements without changing random state or archived episodes', () => {
  const old = structuredClone(advanceBootcampTo(completedBattlesForBootcamp(), 'relief'));
  const runtime = old.runtime!;
  const episode = runtime.bootcamp!;
  for (const cast of [old.contestants, episode.startingContestants]) {
    const auditionDepartures = cast
      .filter((person) => runtime.audition!.eliminatedIds.includes(person.id))
      .sort((a, b) => a.rank - b.rank);
    auditionDepartures.forEach((person, index) => {
      person.rank = index + 1;
      for (const entry of person.changeLog) if (entry.episode === 1) entry.rank = index + 1;
    });
    for (const person of cast.filter((entry) => runtime.battle!.eliminatedIds.includes(entry.id))) {
      person.rank = runtime.battle!.finalRankedIds.indexOf(person.id) + 1;
      for (const entry of person.changeLog) if (entry.episode === 2) entry.rank = person.rank;
    }
  }
  const archived = JSON.stringify(episode.startingContestants);
  const episodes = JSON.stringify([runtime.audition, runtime.battle]);
  const serialized = JSON.stringify(old);
  const restored = decodeSimulationState(serialized);
  assert.deepEqual(
    restored.contestants.map((person) => person.rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
  );
  assert.equal(restored.runtime!.randomState, runtime.randomState);
  assert.equal(JSON.stringify(restored.runtime!.bootcamp!.startingContestants), archived);
  assert.equal(JSON.stringify([restored.runtime!.audition, restored.runtime!.battle]), episodes);
  assert.deepEqual(
    projectSeasonCast(old.contestants, runtime).map((person) => person.rank),
    projectSeasonCast(restored.contestants, restored.runtime!).map((person) => person.rank),
  );
  assert.equal(JSON.stringify(old), serialized);
});

test('unshown flashback practice, roles, grades, relationships and episode history stay private', () => {
  const { contestant, runtime } = fixture();
  const started = transitionBattle(completedAuditionsFixture(), { type: 'start' }, 0);
  assert.ok(started.runtime?.battle);
  runtime.version = 3;
  runtime.battle = started.runtime.battle;
  const episode = runtime.battle;
  episode.participantIds = [contestant.id];
  episode.story = battleStory();
  episode.story.stage = 'performance';
  episode.scenes = [
    {
      id: 'shown-team',
      kind: 'practice',
      title: 'Team A rehearses',
      paragraphs: [],
      contestantIds: ['other'],
    },
  ];
  episode.teams = [
    {
      id: 'hidden-team',
      name: 'Team One',
      captainId: contestant.id,
      memberIds: [contestant.id],
      songId: null,
      centerId: contestant.id,
      centerBallots: {},
      partAssignments: {},
      partReactions: {},
      coordination: 4,
      practice: [
        {
          session: 1,
          title: 'Hidden session',
          leaderDice: [3, 4],
          leadershipCheck: {
            skill: 'leadership',
            skillLevel: 3,
            requiredLevel: 2,
            floor: 2,
            adjustedDice: [3, 4],
            score: 7,
            weight: 1,
            successThreshold: 7,
          },
          leadershipSuccess: true,
          coordinationChange: 2,
          coordinationBefore: 0,
          coordinationAfter: 2,
          contestants: [
            {
              contestantId: contestant.id,
              rawDice: [3, 4],
              checks: [],
              practiceBefore: 0,
              practiceAfter: 4,
              weightedSum: 8,
              sessionPractice: 4,
              improved: true,
            },
          ],
        },
      ],
    },
  ];
  runtime.initialContestants = [structuredClone(contestant)];
  runtime.initialContestants[0].grade = 'B';
  contestant.grade = 'F';
  contestant.missionRating = 1;
  contestant.aggregations.practice = 4;
  contestant.aggregations.center = 3;
  contestant.aggregations.leader = 2;
  contestant.relationships.other = [70];
  contestant.changeLog.push({
    ...structuredClone(contestant.changeLog[0]),
    episode: 2,
    summary: 'Unshown F performance',
  });
  episode.changes[contestant.id] = [
    {
      path: 'relationships.other',
      before: [65],
      after: [70],
      cause: 'Team rehearsal practice',
    },
  ];
  const canonical = structuredClone(contestant);
  const hidden = projectEpisodeContestant(contestant, runtime);
  assert.equal(hidden.grade, 'B');
  assert.equal(hidden.missionRating, 4);
  assert.equal(hidden.aggregations.practice, 0);
  assert.equal(hidden.aggregations.center, 2);
  assert.equal(hidden.aggregations.leader, 1);
  assert.deepEqual(hidden.relationships.other, [65]);
  assert.equal(
    hidden.changeLog.some((entry) => entry.episode === 2),
    false,
  );
  assert.deepEqual(contestant, canonical);

  episode.scenes.push({
    id: 'flashback',
    kind: 'practice',
    title: 'Team One rehearsal',
    paragraphs: [],
    contestantIds: [contestant.id],
  });
  const rehearsed = projectEpisodeContestant(contestant, runtime);
  assert.equal(rehearsed.aggregations.practice, 4);
  assert.equal(rehearsed.aggregations.leader, 2);
  assert.equal(rehearsed.aggregations.center, 2);
  assert.equal(rehearsed.grade, 'B');
  episode.story.creditedTeamIds.push('hidden-team');
  const performed = projectEpisodeContestant(contestant, runtime);
  assert.equal(performed.grade, 'F');
  assert.equal(performed.aggregations.center, 3);
  runtime.version = 2;
  assert.equal(projectEpisodeContestant(contestant, runtime).grade, 'F');
  assert.equal(projectEpisodeContestant(contestant, runtime).changeLog.length, 2);
});

test('rankings first become public at the Episode 2 stage announcement, not dorm arrival', () => {
  const dorms = transitionBattle(completedAuditionsFixture(), { type: 'start' }, 0);
  assert.ok(dorms.runtime?.battle);
  const contestant = dorms.contestants.find((entry) => entry.id === dorms.runtime?.battle?.rankedIds[0]);
  assert.ok(contestant);
  assert.ok(contestant.rank > 0);
  const hidden = projectEpisodeContestant(contestant, dorms.runtime);
  assert.equal(hidden.rank, 0);
  assert.equal(hidden.aggregations.rankingScore, 0);
  assert.ok(hidden.changeLog.every((entry) => entry.rank === 0));

  const stage = advanceBattleTo(dorms, 'ranking');
  assert.ok(stage.runtime);
  const canonical = stage.contestants.find((entry) => entry.id === contestant.id);
  assert.ok(canonical);
  const revealed = projectEpisodeContestant(canonical, stage.runtime);
  assert.equal(revealed.rank, canonical.rank);
  assert.equal(revealed.aggregations.rankingScore, canonical.aggregations.rankingScore);
  assert.deepEqual(
    revealed.changeLog.map((entry) => entry.rank),
    canonical.changeLog.map((entry) => entry.rank),
  );
});

test('real opposing-team flashbacks project their last public relationships and roles, not precomputed practice', () => {
  let state = advanceBattleStoryTo(narrativeBattleFixture(), 'pairings');
  for (let index = 0; index < 2; index++) {
    const { action, revision } = nextBattleStoryAction(state);
    state = transitionBattleStory(state, action, revision);
  }
  const before = structuredClone(state);
  const { action, revision } = nextBattleStoryAction(state);
  state = transitionBattleStory(state, action, revision);
  assert.equal(state.runtime?.battle?.story?.stage, 'rehearsal');
  const episode = state.runtime?.battle;
  assert.ok(episode && state.runtime);
  const team = episode.teams.find((entry) => entry.id === episode.pairings[0].teamIds[1]);
  assert.ok(team);
  assert.equal(team.practice.length, 2, 'the hidden rehearsal is already calculated');
  for (const id of team.memberIds) {
    const canonical = state.contestants.find((entry) => entry.id === id);
    const previous = before.contestants.find((entry) => entry.id === id);
    assert.ok(canonical && previous);
    const projected = projectEpisodeContestant(canonical, state.runtime);
    assert.equal(projected.aggregations.practice, 0);
    assert.equal(projected.aggregations.leader, previous.aggregations.leader);
    assert.equal(projected.aggregations.center, previous.aggregations.center);
    assert.equal(projected.grade, previous.grade);
    assert.deepEqual(projected.relationships, previous.relationships);
  }
  state = advanceBattleStoryTo(state, 'opponent-reaction');
  assert.ok(state.runtime);
  const captain = state.contestants.find((entry) => entry.id === team.captainId);
  assert.ok(captain);
  assert.equal(
    projectEpisodeContestant(captain, state.runtime).aggregations.practice,
    0,
    'watching the opponent does not reveal the rehearsal',
  );
  state = advanceBattleStoryTo(state, 'rehearsal');
  assert.ok(state.runtime);
  const shown = state.contestants.find((entry) => entry.id === team.captainId);
  assert.ok(shown);
  assert.equal(
    projectEpisodeContestant(shown, state.runtime).aggregations.practice,
    shown.aggregations.practice,
  );
  state = advanceBattleStoryTo(state, 'complete');
  assert.ok(state.runtime?.battle);
  const finalRuntime = state.runtime;
  const survivors = finalRuntime.battle?.survivorIds ?? [];
  assert.equal(survivors.length, 18);
  assert.deepEqual(
    survivors.map((id) => {
      const person = state.contestants.find((entry) => entry.id === id);
      assert.ok(person);
      const projected = projectEpisodeContestant(person, finalRuntime);
      assert.ok(projected.changeLog.filter((entry) => entry.episode < 2).every((entry) => entry.rank === 0));
      return projected.rank;
    }),
    Array.from({ length: 18 }, (_, index) => index + 1),
  );
  for (const id of finalRuntime.battle?.eliminatedIds ?? []) {
    const person = state.contestants.find((entry) => entry.id === id);
    assert.ok(person);
    const projected = projectEpisodeContestant(person, finalRuntime);
    assert.equal(projected.status, 'ELIMINATED');
    assert.equal(projected.rank, person.rank);
    assert.ok(projected.changeLog.some((entry) => entry.episode === 2));
  }
});
