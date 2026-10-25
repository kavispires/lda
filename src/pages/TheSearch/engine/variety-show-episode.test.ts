import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SimulationState } from '../types/simulation';
import type { VarietyShowAction, VarietyShowSegment } from '../types/variety-show-episode';
import type { VersatilityEpisode } from '../types/versatility-episode';
import { createContestant } from '../utilities/contestant-factory';
import { getSimulationDefinitions } from '../utilities/simulation-definitions';
import { getVarietyShowCatalog, validateVarietyShowCatalog } from '../utilities/variety-show-catalog';
import { battleRelationship } from './battle-scoring';
import { createSeededRandom, shuffleWithRandom } from './random';
import { transitionVarietyShow, validateVarietyShow } from './variety-show-episode';
import { assessVarietyShow, finalizeVarietyShowSegment, scoreVarietyShow } from './variety-show-scoring';
import { createVarietyShowTeams, electVarietyShowLeader, varietyShowConflict } from './variety-show-teams';
import { awardVarietyIceCategory, createVarietyIcebreaker } from './variety-show-voting';

const peopleFor = () =>
  Array.from({ length: 12 }, (_, i) => {
    const person = createContestant({ id: `native-${i}`, name: `Performer ${i}`, rank: i + 1, updatedAt: 1 });
    for (let j = 0; j < 12; j++) if (i !== j) person.relationships[`native-${j}`] = [50];
    return person;
  });

export function varietyShowFixture(seed = 81): SimulationState {
  const participants = peopleFor();
  const departed = Array.from({ length: 38 }, (_, i) =>
    createContestant({
      id: `departed-${i}`,
      name: `Departed ${i}`,
      rank: i + 13,
      status: 'ELIMINATED',
      updatedAt: 1,
    }),
  );
  const contestants = [...participants, ...departed];
  participants[0].condition = 'STRESSED';
  participants[1].condition = 'ANXIOUS';
  participants[2].personality.curiosity = 8;
  participants[3].personality.discipline = 8;
  participants[3].personality.curiosity = -8;
  participants[4].personality.ambition = 9;
  participants[5].personality.ambition = -8;
  const definitions = getSimulationDefinitions();
  for (const person of contestants)
    for (const key of Object.keys(person.specialties) as (keyof typeof person.specialties)[])
      person.specialties[key] = Object.keys(definitions.specialties[key])[0];
  const ids = participants.map((person) => person.id);
  // This bounded fixture exercises the native episode, not earlier-season replay.
  const previous = {
    version: 1,
    phase: 'complete',
    survivorIds: ids,
    scenes: [],
    teams: [],
    performances: [],
  } as unknown as VersatilityEpisode;
  return {
    status: 'ready',
    persistenceError: null,
    createdAt: 1,
    contestants,
    runtime: {
      version: 3,
      runId: 'native-variety',
      seed,
      randomState: seed,
      episode: 7,
      phase: 'episode-complete',
      setup: { useBias: false, selectedIds: contestants.map((person) => person.id) },
      sourceContestants: Object.fromEntries(
        contestants.map((person) => [person.id, structuredClone(person)]),
      ),
      initialContestants: structuredClone(contestants),
      definitions,
      audition: null,
      versatility: previous,
      openingCast: ids.slice(0, 5),
      show: { audience: 100000, satisfaction: 50, general: 100000, fans: {}, pendingAttrition: 0 },
      revealedSecrets: [],
      deferredConsequences: [],
    },
  };
}

export function nextVarietyAction(state: SimulationState): { action: VarietyShowAction; revision: number } {
  const ep = state.runtime!.varietyShow;
  if (ep)
    return {
      revision: ep.revision,
      action:
        ep.phase === 'intervention'
          ? { type: 'conflict', choice: 'mediate' }
          : ep.phase === 'secret-choice'
            ? { type: 'secret', contestantId: ep.secretCandidates[0] }
            : { type: 'advance' },
    };
  const prep = state.runtime!.preparations?.[8];
  if (!prep) return { revision: 0, action: { type: 'start' } };
  return {
    revision: prep.revision,
    action: prep.mood
      ? { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) }
      : {
          type: 'mood',
          choices: {
            vocalColor: prep.moodOptions.vocalColor[0],
            danceStyle: prep.moodOptions.danceStyle[0],
            rapStyle: prep.moodOptions.rapStyle[0],
            visualVibe: prep.moodOptions.visualVibe[0],
            leadershipStyle: prep.moodOptions.leadershipStyle[0],
            genreAffinity: prep.moodOptions.genreAffinity[0],
          },
        },
  };
}
function step(state: SimulationState) {
  const { action, revision } = nextVarietyAction(state);
  return transitionVarietyShow(state, action, revision);
}
function toPhase(initial: SimulationState, phase: string) {
  let state = initial;
  for (let i = 0; i < 100 && state.runtime!.varietyShow?.phase !== phase; i++) state = step(state);
  assert.equal(state.runtime!.varietyShow?.phase, phase);
  return state;
}

describe('native Variety Show', () => {
  it('uses literal category stats and exactly five candidates, never charisma, rank or fans', () => {
    const people = peopleFor();
    for (const [i, person] of people.entries()) {
      person.coreSkills.visual = [5, 5, 4, 4, 3, 2, 2, 2, 1, 1, 1, 1][i];
      const trait = (offset: number) => ((i + offset) % 21) - 10;
      person.personality = {
        discipline: trait(0),
        curiosity: trait(2),
        extroversion: trait(4),
        sensitivity: trait(6),
        gentleness: trait(8),
        sincerity: trait(10),
        ambition: trait(12),
        resilience: trait(14),
        maturity: trait(16),
        investment: trait(18),
      };
    }
    const expected = people.map(({ id, coreSkills, personality: p }) => ({
      id,
      scores: {
        model: coreSkills.visual,
        girlfriend: p.gentleness + p.extroversion,
        marry: p.maturity,
        rich: p.ambition,
        smartest: p.discipline,
        creative: p.curiosity,
        sincere: p.sincerity,
        'best-person':
          p.discipline +
          p.curiosity +
          p.extroversion +
          p.sensitivity +
          p.gentleness +
          p.sincerity +
          p.ambition +
          p.resilience +
          p.maturity +
          p.investment,
      },
    }));
    assert.deepEqual(Object.keys(people[0].personality).sort(), [
      'ambition',
      'curiosity',
      'discipline',
      'extroversion',
      'gentleness',
      'investment',
      'maturity',
      'resilience',
      'sensitivity',
      'sincerity',
    ]);
    const random = createSeededRandom(101);
    const ice = createVarietyIcebreaker(people, random.next);
    for (const id of [
      'model',
      'girlfriend',
      'marry',
      'rich',
      'smartest',
      'creative',
      'sincere',
      'best-person',
    ] as const) {
      const category = ice.categories.find((entry) => entry.id === id);
      assert.ok(category);
      assert.deepEqual(
        category.statValues,
        Object.fromEntries(expected.map((person) => [person.id, person.scores[id]])),
        `${id}: literal statistic`,
      );
      const ordered = [...expected].sort((a, b) => b.scores[id] - a.scores[id]);
      assert.ok(ordered[4].scores[id] > ordered[5].scores[id], `${id}: no cutoff tie in the oracle`);
      assert.deepEqual(
        [...category.shortlistIds].sort(),
        ordered
          .slice(0, 5)
          .map((person) => person.id)
          .sort(),
        `${id}: independently selected top five`,
      );
    }
    const changed = structuredClone(people);
    for (const person of changed) {
      person.rank = 50 - person.rank;
      person.utilitySkills.charisma = 5;
      person.aggregations.fanbaseRatio = 1;
    }
    assert.deepEqual(
      createVarietyIcebreaker(changed, createSeededRandom(101).next).categories,
      ice.categories,
    );
  });

  it('locks all96 pure outgoing-affection ballots before boosts; repeat wins clamp and award exact reciprocity', () => {
    const people = peopleFor();
    const favorite = people[0];
    favorite.coreSkills.visual = 5;
    for (const key of Object.keys(favorite.personality))
      favorite.personality[key as keyof typeof favorite.personality] = 10;
    favorite.aggregations.audienceRatio = 0.85;
    favorite.aggregations.happiness = 98;
    for (const person of people.slice(1)) person.relationships[favorite.id] = [99];
    const ice = createVarietyIcebreaker(people, createSeededRandom(22).next);
    const frozen = structuredClone(ice);
    assert.equal(
      ice.categories.reduce((sum, category) => sum + Object.keys(category.ballots).length, 0),
      96,
    );
    for (const category of ice.categories)
      for (const voter of people) {
        assert.notEqual(category.ballots[voter.id], voter.id);
        const candidates = category.shortlistIds.filter((id) => id !== voter.id);
        assert.equal(candidates.length, category.shortlistIds.includes(voter.id) ? 4 : 5);
        assert.equal(
          battleRelationship(voter, category.ballots[voter.id]),
          Math.max(...candidates.map((id) => battleRelationship(voter, id))),
        );
      }
    assert.ok(ice.categories.every((category) => category.winnerId === favorite.id));
    for (let i = 0; i < 8; i++) awardVarietyIceCategory(people, ice);
    assert.equal(favorite.aggregations.audienceRatio, 1);
    assert.equal(favorite.aggregations.happiness, 100);
    assert.equal(people[1].aggregations.happiness, 58);
    assert.equal(battleRelationship(people[1], favorite.id), 100);
    assert.equal(battleRelationship(favorite, people[1].id), 58);
    assert.deepEqual(
      ice.categories.map((category) => category.ballots),
      frozen.categories.map((category) => category.ballots),
    );
    assert.deepEqual(ice.frozenContestants, frozen.frozenContestants);
    assert.equal(Object.hasOwn(favorite.relationships, favorite.id), false);
    assert.throws(() => awardVarietyIceCategory(people, ice));
  });

  it('uses seeded cutoff and affection ties rather than secret skill overrides', () => {
    const people = peopleFor();
    const first = createVarietyIcebreaker(people, createSeededRandom(1).next);
    const again = createVarietyIcebreaker(people, createSeededRandom(1).next);
    assert.deepEqual(first, again);
    const second = createVarietyIcebreaker(people, createSeededRandom(2).next);
    assert.notDeepEqual(first.categories[0].shortlistIds, second.categories[0].shortlistIds);
    assert.notDeepEqual(first.categories[0].ballots, second.categories[0].ballots);
  });

  it('draws an unbalanced blind partition and only records real ambition gaps', () => {
    const people = peopleFor();
    people[0].personality.ambition = 10;
    people[1].personality.ambition = -10;
    const ids = people.map((person) => person.id);
    const teams = createVarietyShowTeams(ids, people);
    assert.deepEqual(
      teams.map((team) => team.memberIds),
      [ids.slice(0, 4), ids.slice(4, 8), ids.slice(8)],
    );
    assert.equal(teams[0].ambitionClash!.gap, 20);
    assert.equal(teams[1].ambitionClash, null);
    assert.equal(teams[0].leaderId, null);
    const shuffled = shuffleWithRandom(ids, createSeededRandom(4).next);
    assert.notDeepEqual(
      createVarietyShowTeams(shuffled, people).map((team) => team.memberIds),
      teams.map((team) => team.memberIds),
    );
  });

  it('normalizes medium utility floors and direct traits without music checks; covers trait gates', () => {
    const person = peopleFor()[0];
    person.utilitySkills = { ...person.utilitySkills, stamina: 1, acrobatics: 1, charisma: 1 };
    person.personality.discipline = 8;
    person.personality.curiosity = -8;
    assert.equal(scoreVarietyShow(person, 'physical', [1, 1]).modifier, -5);
    person.personality.curiosity = 0;
    assert.equal(scoreVarietyShow(person, 'physical', [1, 1]).modifier, 0);
    person.personality.sincerity = -8;
    person.personality.ambition = 8;
    person.personality.sensitivity = 8;
    const answer = scoreVarietyShow(person, 'interview', [1, 1]);
    assert.equal(answer.modifier, -10);
    assert.deepEqual(
      answer.events.map((event) => event.kind),
      ['calculated-fumble', 'sensitive-fumble'],
    );
    const strong = scoreVarietyShow(person, 'interview', [6, 6]);
    assert.equal(strong.modifier, 0);
    assert.ok(strong.events.some((event) => event.kind === 'shy-recovery'));
    person.personality.resilience = 8;
    person.personality.extroversion = -10;
    const recovery = scoreVarietyShow(person, 'improv', [1, 1]);
    assert.equal(recovery.modifier, 5);
    assert.match(recovery.events[0].description, /first joke fails/i);
    person.coreSkills = { ...person.coreSkills, vocals: 5, rap: 5, dance: 5, stagePresence: 5 };
    person.track = 'DANCE';
    assert.deepEqual(scoreVarietyShow(person, 'improv', [1, 1]), recovery);
    assert.ok(scoreVarietyShow(person, 'improv', [6, 6]).personalScore > recovery.personalScore);
    assert.throws(() => scoreVarietyShow(person, 'physical', [0, 6]));
  });

  it('defers interview means, applies actual cohesion/chaos and independently computes equal panel weights', () => {
    const people = peopleFor().slice(0, 4);
    for (const person of people) person.coreSkills.leadership = 1;
    const segments = (['physical', 'interview', 'improv'] as const).map(
      (kind): VarietyShowSegment => ({
        kind,
        teamId: 'team',
        challengeId: 'game',
        challengeDraw: null,
        promptIds: {},
        promptDraws: {},
        evaluations: people.map((person) => scoreVarietyShow(person, kind, [4, 5])),
        teamScore: null,
        cohesion: 0,
        coordination: 0,
        chaosPenalty: 0,
        frozenContestants: structuredClone(people),
      }),
    );
    const interview = structuredClone(segments[1]);
    interview.evaluations.pop();
    assert.throws(() => finalizeVarietyShowSegment(interview, 0), /four actual turns/);
    assert.equal(interview.teamScore, null);
    for (const segment of segments) finalizeVarietyShowSegment(segment, 2);
    assert.equal(segments[2].chaosPenalty, -15);
    assert.equal(segments[2].cohesion, 0);
    assert.equal(segments[2].teamScore, segments[2].evaluations[0].personalScore + 2 - 15);
    const assessment = assessVarietyShow(people[0].id, segments);
    const personal = segments.map((segment) => segment.evaluations[0].personalScore);
    const charisma = 70;
    const v =
      segments.reduce(
        (sum, segment) => sum + 0.7 * segment.evaluations[0].personalScore + 0.3 * segment.teamScore!,
        0,
      ) / 3;
    const michael =
      0.7 * charisma + (0.3 * segments.reduce((sum, segment) => sum + segment.teamScore!, 0)) / 3;
    const roxana = 0.6 * charisma + 0.4 * Math.min(...personal);
    assert.equal(
      assessment.finalScore,
      (v + personal[0] + (personal[1] + personal[2]) / 2 + michael + roxana) / 5,
    );
    assert.equal(assessment.comments.length, 4);
    assert.throws(() => assessVarietyShow(people[0].id, segments.slice(0, 2)));
  });

  it('elects ordinary leaders with self votes and only presents incompatible/strained conflicts', () => {
    const people = peopleFor().slice(0, 4);
    assert.equal(varietyShowConflict(people), null);
    people[0].coreSkills.leadership = 5;
    const election = electVarietyShowLeader(
      people,
      Object.fromEntries(people.map((person, i) => [person.id, i / 4])),
    );
    assert.equal(election.winnerId, people[0].id);
    assert.equal(election.ballots[people[0].id], people[0].id);
    people[0].personality.curiosity = 8;
    people[1].personality.discipline = 8;
    people[1].personality.curiosity = -8;
    assert.deepEqual(varietyShowConflict(people), [people[0].id, people[1].id]);
  });

  it('completes seeded through ten, preserves conditions/practice/earlier places, reloads and rejects stale/forged effects', () => {
    let state = varietyShowFixture();
    const initial = structuredClone(state);
    let reloaded = structuredClone(state);
    for (let i = 0; i < 100 && state.runtime!.varietyShow?.phase !== 'complete'; i++) {
      const before = structuredClone(state);
      const { action, revision } = nextVarietyAction(state);
      const next = transitionVarietyShow(state, action, revision);
      assert.deepEqual(state, before, 'immutable input');
      assert.equal(transitionVarietyShow(next, action, revision), next, 'idempotent duplicate');
      state = next;
      reloaded = JSON.parse(JSON.stringify(transitionVarietyShow(reloaded, action, revision)));
      validateVarietyShow(reloaded);
      assert.deepEqual(reloaded, JSON.parse(JSON.stringify(state)));
      if (state.runtime!.varietyShow?.icebreaker && state.runtime!.varietyShow.phase === 'icebreaker')
        assert.ok(
          state
            .runtime!.varietyShow.scenes.filter((scene) => scene.sequence === 3)
            .every((scene) => !scene.contestantChanges),
        );
    }
    const ep = state.runtime!.varietyShow!;
    assert.equal(ep.phase, 'complete');
    assert.equal(ep.segments.flatMap((segment) => segment.evaluations).length, 36);
    assert.equal(ep.survivorIds.length, 10);
    assert.deepEqual(ep.eliminatedIds, ep.rankedIds.slice(10));
    assert.equal(ep.fanTransfers.length, 1);
    assert.ok(
      ep.scenes
        .filter((scene) => scene.presentation === 'performance')
        .every((scene) => !scene.tvMoments?.appearance),
    );
    assert.equal(state.contestants.filter((person) => person.status === 'ACTIVE').length, 10);
    assert.equal(
      state.runtime!.show.general + Object.values(state.runtime!.show.fans).reduce((a, b) => a + b, 0),
      state.runtime!.show.audience,
    );
    for (const person of state.contestants) {
      const prior = initial.contestants.find((entry) => entry.id === person.id)!;
      assert.equal(person.condition, prior.condition);
      assert.equal(person.aggregations.practice, prior.aggregations.practice);
      if (ep.participantIds.includes(person.id))
        assert.equal(person.aggregations.experience - prior.aggregations.experience, 10);
      else assert.equal(person.rank, prior.rank);
    }
    const corrupted = structuredClone(state);
    corrupted.runtime!.varietyShow!.panel[0].roxana++;
    assert.throws(() => validateVarietyShow(corrupted), /panel/);
    const doubled = structuredClone(state);
    doubled.contestants[0].aggregations.happiness--;
    assert.throws(() => validateVarietyShow(doubled), /effects/);
    assert.throws(() => transitionVarietyShow(state, { type: 'advance' }, 0), /stale/);
  });

  it('does not finalize a team interview before its fourth actually aired answer', () => {
    let state = toPhase(varietyShowFixture(18), 'interviews');
    for (let i = 1; i < 4; i++) {
      const segment = state.runtime!.varietyShow!.segments.at(-1)!;
      assert.equal(segment.evaluations.length, i);
      assert.equal(segment.teamScore, null);
      assert.ok(segment.evaluations.every((entry) => entry.finalScore === null && entry.grade === null));
      state = step(state);
    }
    assert.notEqual(state.runtime!.varietyShow!.segments.at(-1)!.teamScore, null);
  });

  it('applies each genuine intervention trade-off once without manufacturing music practice', () => {
    const fixture = varietyShowFixture(33);
    for (const person of fixture.contestants.slice(0, 12)) {
      person.personality.gentleness = -8;
      for (const id of Object.keys(person.relationships)) person.relationships[id] = [30];
      person.aggregations.practice = 4;
    }
    const initial = toPhase(fixture, 'intervention');
    const ep = initial.runtime!.varietyShow!;
    const team = ep.teams[ep.teamCursor];
    const [first, second] = ep.conflict!.contestantIds;
    const before = battleRelationship(initial.contestants.find((entry) => entry.id === first)!, second);
    for (const choice of ['support', 'mediate', 'push'] as const) {
      const action: VarietyShowAction = { type: 'conflict', choice };
      const state = transitionVarietyShow(initial, action, ep.revision);
      const preparation = state.runtime!.varietyShow!.teams.find((entry) => entry.id === team.id)!
        .preparation!;
      const delta = choice === 'push' ? -3 : choice === 'mediate' ? 2 : 1;
      assert.equal(preparation.coordination, choice === 'push' ? 3 : choice === 'support' ? 2 : 1);
      assert.equal(
        battleRelationship(state.contestants.find((entry) => entry.id === first)!, second),
        before + delta,
      );
      assert.equal(transitionVarietyShow(state, action, ep.revision), state);
      assert.ok(state.contestants.slice(0, 12).every((person) => person.aggregations.practice === 4));
      validateVarietyShow(state);
    }
    assert.throws(() => transitionVarietyShow(initial, { type: 'advance' }, ep.revision), /choice/);
  });

  it('reveals another hidden card after an earlier public one, applies immediate effects once and defers status/rank', () => {
    const fixture = varietyShowFixture(39);
    const definitions = fixture.runtime!.definitions;
    const template = Object.values(definitions.cards.secret)[0];
    definitions.cards.secret = {
      nativeOld: { ...template, id: 'nativeOld', consequence: {} },
      nativeHidden: {
        ...template,
        id: 'nativeHidden',
        name: 'A harmless offstage hobby',
        description: 'Collects miniature cardboard houses.',
        consequence: {
          'aggregations.happiness': 4,
          condition: 'CONFIDENT',
          status: 'ELIMINATED',
          'aggregations.rankingScore': 999,
        },
      },
    };
    for (const person of fixture.contestants.slice(0, 12)) {
      person.attributes = ['nativeOld', 'nativeHidden'];
      person.events = ['SECRET_REVEALED:nativeOld'];
    }
    const initial = toPhase(fixture, 'secret-choice');
    const ep = initial.runtime!.varietyShow!;
    assert.equal(ep.investigationEligibleIds.length, 12);
    assert.equal(ep.secretCandidates.length, 3);
    const id = ep.secretCandidates[0];
    const action: VarietyShowAction = { type: 'secret', contestantId: id };
    const before = initial.contestants.find((entry) => entry.id === id)!;
    const next = transitionVarietyShow(initial, action, ep.revision);
    const after = next.contestants.find((entry) => entry.id === id)!;
    assert.equal(next.runtime!.varietyShow!.secret!.cardId, 'nativeHidden');
    assert.equal(after.aggregations.happiness, Math.min(100, before.aggregations.happiness + 4));
    assert.equal(after.condition, 'CONFIDENT');
    assert.equal(after.status, 'ACTIVE');
    assert.equal(after.rank, before.rank);
    assert.equal(after.aggregations.rankingScore, before.aggregations.rankingScore);
    assert.equal(next.runtime!.varietyShow!.secret!.deferred.length, 2);
    assert.deepEqual(next.runtime!.varietyShow!.sealedRankingScores, ep.sealedRankingScores);
    assert.equal(transitionVarietyShow(next, action, ep.revision), next);
    const complete = toPhase(next, 'complete');
    assert.equal(complete.contestants.filter((person) => person.status === 'ACTIVE').length, 10);
    assert.equal(complete.runtime!.varietyShow!.eliminatedIds.length, 2);
    assert.equal(complete.runtime!.varietyShow!.fanTransfers.length, 1);
  });

  it('permits a genuine investigation miss and explicitly handles a shorter eligible shortlist', () => {
    const fixture = varietyShowFixture(43);
    const definitions = fixture.runtime!.definitions;
    const [first, second] = Object.keys(definitions.cards.secret);
    for (const person of fixture.contestants.slice(0, 12)) {
      person.attributes = [first];
      person.events = [`SECRET_REVEALED:${first}`];
    }
    fixture.contestants[0].attributes.push(second);
    fixture.contestants[1].attributes = [];
    fixture.contestants[1].events = [];
    const initial = toPhase(fixture, 'secret-choice');
    const ep = initial.runtime!.varietyShow!;
    assert.equal(ep.secretCandidates.length, 2);
    assert.deepEqual(
      new Set(ep.secretCandidates),
      new Set(fixture.contestants.slice(0, 2).map((person) => person.id)),
    );
    const id = fixture.contestants[1].id;
    const before = structuredClone(initial.contestants.find((person) => person.id === id)!);
    const next = transitionVarietyShow(initial, { type: 'secret', contestantId: id }, ep.revision);
    const after = next.contestants.find((person) => person.id === id)!;
    assert.equal(next.runtime!.varietyShow!.secret!.cardId, null);
    assert.deepEqual(after.attributes, before.attributes);
    assert.deepEqual(after.events, before.events);
    assert.equal(after.aggregations.happiness, before.aggregations.happiness);
    assert.deepEqual(next.runtime!.varietyShow!.sealedRankingScores, ep.sealedRankingScores);
    validateVarietyShow(next);
  });

  it('rejects forged dice, ballots, private awards and phase chronology without consuming RNG', () => {
    const state = toPhase(varietyShowFixture(48), 'panel');
    const edits = [
      (copy: SimulationState) => {
        copy.runtime!.varietyShow!.icebreaker!.categories[0].ballots['native-0'] = 'native-0';
      },
      (copy: SimulationState) => {
        copy.runtime!.varietyShow!.icebreaker!.categories[0].ties.shortlist['native-0'] = 0.123;
      },
      (copy: SimulationState) => {
        copy.runtime!.varietyShow!.segments[0].evaluations[0].rawDice = [1, 1];
      },
      (copy: SimulationState) => {
        copy.runtime!.varietyShow!.segments[0].teamScore! += 2;
      },
      (copy: SimulationState) => {
        copy.runtime!.varietyShow!.icebreaker!.revealCursor--;
      },
      (copy: SimulationState) => {
        copy.runtime!.varietyShow!.phase = 'physical';
      },
      (copy: SimulationState) => {
        copy.runtime!.varietyShow!.changes['native-0'][0].cause = '';
      },
      (copy: SimulationState) => {
        const person = copy.contestants[0];
        const before = person.aggregations.experience;
        person.aggregations.experience += 3;
        copy.runtime!.varietyShow!.changes[person.id].push({
          path: 'aggregations.experience',
          before,
          after: person.aggregations.experience,
          cause: 'Completed episode activity',
        });
      },
    ];
    for (const edit of edits) {
      const copy = structuredClone(state);
      edit(copy);
      assert.throws(() => validateVarietyShow(copy));
    }
    const before = JSON.stringify(state);
    validateVarietyShow(state);
    assert.equal(JSON.stringify(state), before);
  });

  it('rejects invalid frozen catalogs instead of substituting prompts', () => {
    const catalog = getVarietyShowCatalog();
    catalog.interviewPrompts[0].difficulty = 4 as 3;
    assert.throws(() => validateVarietyShowCatalog(catalog));
    const other = getVarietyShowCatalog();
    other.physicalGames.push(other.physicalGames[0]);
    assert.throws(() => validateVarietyShowCatalog(other));
  });
});
